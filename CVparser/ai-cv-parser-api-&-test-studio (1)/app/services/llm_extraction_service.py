"""
LLM Extraction Service for completing missing CV fields safely.
"""

import re
from typing import Any, Dict, List, Optional, Set

from pydantic import ValidationError

from app.core.exceptions import (
    JSONValidationError,
    LLMClientDisabledError,
    LLMDependencyError,
    LLMGenerationError,
    LLMModelLoadError,
    NoJSONObjectFoundError,
)
from app.extractors.base_extractor import BaseExtractor
from app.llm.base_client import BaseLLMClient
from app.llm.prompt_builder import LLMPromptBuilder
from app.llm.response_parser import LLMResponseParser
from app.models.cv_models import (
    Certification,
    CVData,
    Education,
    Experience,
    Identity,
    Language,
    Skill,
)
from app.utils.list_utils import unique_preserve_order


class LLMExtractionService:
    """Orchestrates LLM-assisted CV completion over deterministic results."""

    def __init__(
        self,
        prompt_builder: Optional[LLMPromptBuilder] = None,
        response_parser: Optional[LLMResponseParser] = None,
    ) -> None:
        self.prompt_builder = prompt_builder or LLMPromptBuilder()
        self.response_parser = response_parser or LLMResponseParser()

    @staticmethod
    def _normalize_text(text: str) -> str:
        """Normalize string for factual support verification."""
        if not text:
            return ""
        # Lowercase and replace non-alphanumeric with spaces
        return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", text.lower())).strip()

    def _is_supported_scalar(self, val: Any, cleaned_text: str) -> bool:
        """Check if a scalar string value is supported by cleaned_text."""
        if not isinstance(val, str) or not val.strip():
            return False
        norm_val = self._normalize_text(val)
        norm_text = self._normalize_text(cleaned_text)
        return norm_val in norm_text

    @classmethod
    def _is_meaningful_field_value(
        cls, model_cls: Any, field_name: str, value: Any
    ) -> bool:
        """Reject blank/trivial values while preserving valid short skill names."""
        if not isinstance(value, str):
            return False

        normalized = cls._normalize_text(value)
        if not normalized:
            return False

        compact = normalized.replace(" ", "")
        if len(compact) >= 2:
            return True

        return model_cls is Skill and field_name == "name" and compact in {"c", "r"}

    def _filter_grounded_item(
        self,
        item_data: Dict[str, Any],
        model_cls: Any,
        cleaned_text: str,
    ) -> tuple[Optional[Any], bool]:
        """Build a validated copy containing only independently grounded fields."""
        filtered_data: Dict[str, Any] = {}
        rejected_value = False

        for field_name in model_cls.model_fields:
            if field_name not in item_data or item_data[field_name] is None:
                continue

            value = item_data[field_name]
            if not self._is_meaningful_field_value(model_cls, field_name, value):
                rejected_value = True
                continue

            stripped_value = value.strip()
            if self._is_supported_scalar(stripped_value, cleaned_text):
                filtered_data[field_name] = stripped_value
            else:
                rejected_value = True

        if not filtered_data:
            return None, True

        return model_cls.model_validate(filtered_data), rejected_value

    def enrich(
        self,
        deterministic_data: CVData,
        cleaned_text: str,
        sections: Dict[str, str],
        client: Optional[BaseLLMClient] = None,
    ) -> CVData:
        """Safely enrich missing CVData fields using LLM completion.

        Never mutates deterministic_data. Returns a deep validated copy.
        """
        # Create safe deep copy
        cv_data = CVData.model_validate(deterministic_data.model_dump())

        if client is None or not client.is_available():
            return cv_data

        missing_fields, _ = self.prompt_builder.get_missing_and_protected_fields(
            cv_data
        )
        if not missing_fields:
            return cv_data

        try:
            prompt = self.prompt_builder.build_completion_prompt(
                cleaned_text, sections, cv_data
            )
            if getattr(self.prompt_builder, "last_text_was_bounded", False):
                cv_data.warnings.append("CV text was bounded to fit model context limit")

            raw_response = client.generate(prompt)
            response_dict = self.response_parser.parse_completion_response(
                raw_response
            )
            self._merge_llm_response(cv_data, response_dict, cleaned_text)
        except LLMClientDisabledError:
            cv_data.warnings.append("LLM enrichment unavailable")
        except LLMDependencyError:
            cv_data.warnings.append("LLM initialization failed")
        except LLMModelLoadError:
            cv_data.warnings.append("LLM initialization failed")
        except LLMGenerationError:
            cv_data.warnings.append("LLM completion failed")
        except NoJSONObjectFoundError:
            cv_data.warnings.append("LLM response contained no valid JSON object")
        except JSONValidationError:
            cv_data.warnings.append("LLM response was malformed")
        except Exception:
            cv_data.warnings.append("LLM completion failed")

        cv_data.warnings = unique_preserve_order(cv_data.warnings)
        return cv_data

    def _merge_llm_response(
        self,
        cv_data: CVData,
        response_dict: Dict[str, Any],
        cleaned_text: str,
    ) -> None:
        """Merge parsed LLM dictionary into cv_data according to strict rules."""
        valid_top_keys = {
            "identity",
            "summary",
            "skills",
            "languages",
            "certifications",
            "education",
            "experiences",
        }

        # Check unknown top-level keys
        unknown_top_keys = set(response_dict.keys()) - valid_top_keys
        if unknown_top_keys:
            cv_data.warnings.append("LLM response contained unsupported fields")

        # 1. Identity scalar completion
        if "identity" in response_dict and isinstance(response_dict["identity"], dict):
            id_dict = response_dict["identity"]
            valid_id_keys = {
                "full_name",
                "email",
                "phone",
                "location",
                "linkedin",
                "github",
                "website",
                "job_title",
            }
            if set(id_dict.keys()) - valid_id_keys:
                cv_data.warnings.append("LLM response contained unsupported fields")

            for key in valid_id_keys:
                if key in id_dict:
                    val = id_dict[key]
                    det_val = getattr(cv_data.identity, key, None)
                    if BaseExtractor.clean_value(det_val) is None:
                        if isinstance(val, str) and val.strip():
                            if self._is_supported_scalar(val, cleaned_text):
                                setattr(cv_data.identity, key, val.strip())
                            else:
                                cv_data.warnings.append(
                                    "LLM response contained unsupported values"
                                )

        # 2. Summary completion
        if "summary" in response_dict:
            val = response_dict["summary"]
            if BaseExtractor.clean_value(cv_data.summary) is None:
                if isinstance(val, str) and val.strip():
                    if self._is_supported_scalar(val, cleaned_text):
                        cv_data.summary = val.strip()
                    else:
                        cv_data.warnings.append(
                            "LLM response contained unsupported values"
                        )

        # 3. List fields completion (only if deterministic list is empty)
        list_specs = [
            ("skills", Skill, cv_data.skills),
            ("languages", Language, cv_data.languages),
            ("certifications", Certification, cv_data.certifications),
            ("education", Education, cv_data.education),
            ("experiences", Experience, cv_data.experiences),
        ]

        for field_name, model_cls, target_list in list_specs:
            if field_name in response_dict:
                raw_items = response_dict[field_name]
                if not isinstance(raw_items, list):
                    cv_data.warnings.append("LLM response failed schema validation")
                    continue

                if len(target_list) == 0 and len(raw_items) > 0:
                    new_items = []
                    seen_items = set()
                    for item_data in raw_items:
                        if not isinstance(item_data, dict):
                            cv_data.warnings.append(
                                "LLM response failed schema validation"
                            )
                            continue
                        try:
                            item_obj, rejected_value = self._filter_grounded_item(
                                item_data, model_cls, cleaned_text
                            )
                            if rejected_value:
                                cv_data.warnings.append(
                                    "LLM response contained unsupported values"
                                )
                            if item_obj is not None:
                                item_key = item_obj.model_dump_json()
                                if item_key not in seen_items:
                                    seen_items.add(item_key)
                                    new_items.append(item_obj)
                        except ValidationError:
                            cv_data.warnings.append(
                                "LLM response failed schema validation"
                            )

                    if new_items:
                        setattr(cv_data, field_name, new_items)
