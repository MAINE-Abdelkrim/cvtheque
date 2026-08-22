"""
Service orchestrating deterministic extraction across all business extractors.
Produces CVData and non-fatal warnings without external ML/LLM dependencies.
"""

import logging
from typing import Dict, List, Optional, Any
from app.models.cv_models import (
    CVData,
    Identity,
    Skill,
    Language,
    Certification,
    Education,
    Experience,
)
from app.extractors import (
    IdentityExtractor,
    SummaryExtractor,
    SkillsExtractor,
    LanguagesExtractor,
    CertificationsExtractor,
    EducationExtractor,
    ExperienceExtractor,
)
from app.utils.list_utils import unique_preserve_order

logger = logging.getLogger(__name__)


class CVExtractionService:
    """Orchestrates deterministic CV field extractors and produces structured CVData."""

    @classmethod
    def extract(
        cls,
        cleaned_text: str,
        sections: Dict[str, str]
    ) -> CVData:
        """Run all deterministic extractors sequentially and compile CVData with warnings."""
        warnings: List[str] = []
        sections = sections or {}
        cleaned_text = cleaned_text or ""

        # 1. Identity Extractor
        try:
            identity = IdentityExtractor.extract(cleaned_text, sections)
            if not identity.full_name:
                warnings.append("full_name non détecté")
        except Exception:
            logger.exception("Deterministic identity extraction failed")
            warnings.append("Deterministic identity extraction failed")
            identity = Identity()

        # 2. Summary Extractor
        try:
            summary = SummaryExtractor.extract(cleaned_text, sections, identity=identity)
        except Exception:
            logger.exception("Deterministic summary extraction failed")
            warnings.append("Deterministic summary extraction failed")
            summary = None

        # 3. Skills Extractor
        try:
            skills = SkillsExtractor.extract(sections, cleaned_text)
            if not skills:
                warnings.append("aucune compétence détectée")
        except Exception:
            logger.exception("Deterministic skills extraction failed")
            warnings.append("Deterministic skills extraction failed")
            skills = []

        # 4. Languages Extractor
        try:
            languages = LanguagesExtractor.extract(sections, cleaned_text)
        except Exception:
            logger.exception("Deterministic languages extraction failed")
            warnings.append("Deterministic languages extraction failed")
            languages = []

        # 5. Certifications Extractor
        try:
            certifications = CertificationsExtractor.extract(sections, cleaned_text)
        except Exception:
            logger.exception("Deterministic certifications extraction failed")
            warnings.append("Deterministic certifications extraction failed")
            certifications = []

        # 6. Education Extractor
        try:
            education = EducationExtractor.extract(sections, cleaned_text)
            if not education:
                warnings.append("section formation absente")
        except Exception:
            logger.exception("Deterministic education extraction failed")
            warnings.append("Deterministic education extraction failed")
            education = []

        # 7. Experience Extractor
        try:
            experiences = ExperienceExtractor.extract(sections, cleaned_text)
            if not experiences:
                warnings.append("section expérience absente")
        except Exception:
            logger.exception("Deterministic experience extraction failed")
            warnings.append("Deterministic experience extraction failed")
            experiences = []

        # Deduplicate warnings preserving order
        unique_warnings = unique_preserve_order(warnings)

        return CVData(
            identity=identity,
            summary=summary,
            skills=skills,
            languages=languages,
            certifications=certifications,
            education=education,
            experiences=experiences,
            warnings=unique_warnings,
        )

    @classmethod
    def extract_from_pipeline_result(
        cls,
        pipeline_result: Any
    ) -> CVData:
        """Extract CVData from an existing PipelineExtractionResult object without re-running PDF/OCR/layout."""
        cleaned_text = getattr(pipeline_result, "cleaned_text", "")
        sections = getattr(pipeline_result, "sections", {})
        return cls.extract(cleaned_text, sections)
