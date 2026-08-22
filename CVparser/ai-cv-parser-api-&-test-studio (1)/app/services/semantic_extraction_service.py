"""Optional, grounded, section-by-section semantic extraction."""

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from dataclasses import dataclass
import logging
import re
import time
from typing import Any, Dict, Optional, Type
import unicodedata

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.llm.base_client import BaseLLMClient
from app.llm.cv_semantic_prompts import SECTION_SCHEMAS, build_semantic_section_prompt
from app.llm.response_parser import LLMResponseParser
from app.models.cv_models import Certification, CVData, Education, Experience, Language, Skill
from app.utils.list_utils import unique_preserve_order

logger = logging.getLogger(__name__)


class SemanticEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SummaryResult(SemanticEnvelope):
    summary: Optional[str] = None


class SkillsResult(SemanticEnvelope):
    skills: list[Skill] = Field(default_factory=list)


class ExperiencesResult(SemanticEnvelope):
    experiences: list[Experience] = Field(default_factory=list)


class EducationResult(SemanticEnvelope):
    education: list[Education] = Field(default_factory=list)


class LanguagesResult(SemanticEnvelope):
    languages: list[Language] = Field(default_factory=list)


class CertificationsResult(SemanticEnvelope):
    certifications: list[Certification] = Field(default_factory=list)


SECTION_MODELS: Dict[str, Type[BaseModel]] = {
    "SUMMARY": SummaryResult,
    "SKILLS": SkillsResult,
    "EXPERIENCES": ExperiencesResult,
    "EDUCATION": EducationResult,
    "LANGUAGES": LanguagesResult,
    "CERTIFICATIONS": CertificationsResult,
}
SECTION_FIELDS = {
    "SUMMARY": "summary", "SKILLS": "skills", "EXPERIENCES": "experiences",
    "EDUCATION": "education", "LANGUAGES": "languages", "CERTIFICATIONS": "certifications",
}


@dataclass(frozen=True)
class SemanticExtractionOutcome:
    cv_data: CVData
    contributed: bool
    successful_sections: tuple[str, ...]


class SemanticExtractionService:
    """Extract semantic records from canonical sections with grounded fallback."""

    def __init__(self, response_parser: Optional[LLMResponseParser] = None, timeout_seconds: float = 30.0) -> None:
        self.response_parser = response_parser or LLMResponseParser()
        self.timeout_seconds = timeout_seconds

    @staticmethod
    def _normalize(value: str) -> str:
        folded = "".join(
            character for character in unicodedata.normalize("NFKD", value.casefold())
            if not unicodedata.combining(character)
        )
        return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", folded)).strip()

    @classmethod
    def classify_evidence(cls, value: Any, source: str) -> str:
        if not isinstance(value, str) or not value.strip():
            return "UNSUPPORTED"
        if value.strip().casefold() in source.casefold():
            return "SUPPORTED"
        normalized_value = cls._normalize(value)
        normalized_source = cls._normalize(source)
        if normalized_value and normalized_value in normalized_source:
            return "NORMALIZED_SUPPORTED"
        present_terms = {"present", "current", "actuel", "aujourd hui", "en cours"}
        if normalized_value in present_terms and any(term in normalized_source for term in present_terms):
            return "NORMALIZED_SUPPORTED"
        numeric_date = re.fullmatch(r"((?:19|20)\d{2})[/-](0[1-9]|1[0-2])", value.strip())
        if numeric_date:
            alternate = f"{numeric_date.group(2)}/{numeric_date.group(1)}"
            if alternate in source:
                return "NORMALIZED_SUPPORTED"
        return "UNSUPPORTED"

    @classmethod
    def _ground_model(cls, model: BaseModel, source: str) -> tuple[Optional[BaseModel], bool]:
        data = model.model_dump()
        rejected = False
        for key, value in list(data.items()):
            if value is None:
                continue
            if not isinstance(value, str) or cls.classify_evidence(value, source) == "UNSUPPORTED":
                data[key] = None
                rejected = True
        try:
            grounded = type(model).model_validate(data)
        except ValidationError:
            return None, True
        meaningful = any(value is not None and value != "" for value in grounded.model_dump().values())
        return (grounded if meaningful else None), rejected

    def _generate(self, client: BaseLLMClient, prompt: str) -> str:
        executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="cv-semantic")
        future = executor.submit(client.generate, prompt)
        try:
            return future.result(timeout=self.timeout_seconds)
        except FutureTimeout as exc:
            future.cancel()
            raise TimeoutError("Semantic extraction timed out") from exc
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

    def extract(self, deterministic_data: CVData, sections: Dict[str, str], client: BaseLLMClient) -> SemanticExtractionOutcome:
        result = CVData.model_validate(deterministic_data.model_dump())
        contributed = False
        successful: list[str] = []
        fallback_used = False

        for section_name in SECTION_SCHEMAS:
            source = (sections.get(section_name) or "").strip()
            if not source:
                continue
            started = time.perf_counter()
            try:
                raw = self._generate(client, build_semantic_section_prompt(section_name, source))
                parsed = self.response_parser.parse_completion_response(raw)
                envelope = SECTION_MODELS[section_name].model_validate(parsed)
                field_name = SECTION_FIELDS[section_name]
                value = getattr(envelope, field_name)
                rejected = False
                if section_name == "SUMMARY":
                    if value and self.classify_evidence(value, source) != "UNSUPPORTED":
                        result.summary = value.strip()
                        contributed = True
                        successful.append(section_name)
                    elif value:
                        rejected = True
                else:
                    grounded_items = []
                    seen = set()
                    for item in value:
                        grounded, item_rejected = self._ground_model(item, source)
                        rejected = rejected or item_rejected
                        if grounded is not None:
                            key = grounded.model_dump_json()
                            if key not in seen:
                                seen.add(key)
                                grounded_items.append(grounded)
                    if grounded_items:
                        setattr(result, field_name, grounded_items)
                        contributed = True
                        successful.append(section_name)
                if rejected:
                    result.warnings.append("LLM semantic extraction rejected unsupported values")
                logger.info("LLM semantic section completed", extra={"section": section_name, "input_chars": len(source), "duration_ms": round((time.perf_counter() - started) * 1000), "record_count": len(value) if isinstance(value, list) else int(bool(value))})
            except Exception:
                fallback_used = True
                logger.warning("LLM semantic section fallback", extra={"section": section_name, "input_chars": len(source), "duration_ms": round((time.perf_counter() - started) * 1000)})

        if fallback_used:
            result.warnings.append("LLM semantic extraction unavailable; deterministic fallback used")
        result.warnings = unique_preserve_order(result.warnings)
        return SemanticExtractionOutcome(result, contributed, tuple(successful))
