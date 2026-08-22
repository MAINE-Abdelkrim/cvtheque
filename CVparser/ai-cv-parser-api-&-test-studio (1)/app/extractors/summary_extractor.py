"""
Deterministic extractor for professional summary / profile overview.
"""

import re
from typing import Dict, Optional
from app.extractors.base_extractor import BaseExtractor
from app.models.cv_models import Identity


class SummaryExtractor(BaseExtractor):
    """Extracts summary/profile section content deterministically from sections."""

    SUMMARY_SECTION_KEYS = [
        "SUMMARY",
        "PROFILE",
        "PROFIL",
        "ABOUT",
        "ABOUT_ME",
        "PROFESSIONAL_SUMMARY",
    ]

    @classmethod
    def extract(
        cls,
        cleaned_text: str,
        sections: Optional[Dict[str, str]] = None,
        identity: Optional[Identity] = None,
    ) -> Optional[str]:
        """Return the cleaned summary text if a summary section exists, otherwise None."""
        if not sections:
            return None

        for key in cls.SUMMARY_SECTION_KEYS:
            if key in sections and sections[key]:
                content = cls._without_contact_lines(sections[key], identity)
                if content:
                    cleaned_summary = re.sub(r"\s+", " ", content).strip()
                    return cls.clean_value(cleaned_summary)

        return None

    @classmethod
    def _without_contact_lines(
        cls, content: str, identity: Optional[Identity]
    ) -> str:
        """Remove strong standalone contact lines while preserving professional prose."""
        known_values = set()
        if identity:
            for value in (
                identity.email,
                identity.phone,
                identity.linkedin,
                identity.github,
                identity.website,
            ):
                if value:
                    normalized = value.lower().removeprefix("https://").removeprefix("http://")
                    known_values.add(normalized.rstrip("/"))

        lines = [line.strip() for line in content.splitlines() if line.strip()]
        contact_indexes = set()
        for index, raw_line in enumerate(lines):
            line = raw_line.strip()
            normalized = line.lower().lstrip("+#§ï\x83•· ").removeprefix("https://").removeprefix("http://").rstrip("/")
            strong_contact = (
                bool(re.fullmatch(r"[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}", normalized))
                or bool(re.fullmatch(r"(?:www\.)?(?:linkedin\.com/in|github\.com)/[^\s]+", normalized, re.I))
                or bool(re.fullmatch(r"(?:\+?\d[\d .()/-]{7,}\d)", normalized))
                or normalized in known_values
            )
            if strong_contact:
                contact_indexes.add(index)

        if len(contact_indexes) >= 2:
            first_contact = min(contact_indexes)
            if first_contact > 0:
                candidate = lines[first_contact - 1].lstrip("+•· ").strip()
                if "," in candidate and len(candidate.split()) <= 5 and not candidate.endswith((".", "!", "?")):
                    contact_indexes.add(first_contact - 1)

        kept = [line for index, line in enumerate(lines) if index not in contact_indexes]
        return "\n".join(kept)
