"""
Deterministic extractor for technical and professional skills using a catalog.
"""

import re
from typing import Dict, List, Optional, Set
from app.extractors.base_extractor import BaseExtractor
from app.models.cv_models import Skill
from app.core.skill_catalog import SKILL_CATALOG, SkillDefinition
from app.utils.text_cleaning import normalize_header_title


class SkillsExtractor(BaseExtractor):
    """Extracts catalog skills with word-boundary regexes, deduplication, and source tracing."""

    @classmethod
    def extract(
        cls,
        sections: Optional[Dict[str, str]] = None,
        cleaned_text: str = ""
    ) -> List[Skill]:
        """Extract skills from SKILLS section, other sections, and full text."""
        extracted_skills: List[Skill] = []
        seen_names: Set[str] = set()

        sections = sections or {}

        # Priority 1: SKILLS section
        skills_text = sections.get("SKILLS", "")
        if skills_text:
            cls._extract_from_text(
                skills_text, "skills_section", extracted_skills, seen_names
            )
            cls._extract_explicit_section_items(skills_text, extracted_skills, seen_names)

        # Priority 2: Other explicit sections (e.g., EXPERIENCES, EDUCATION, HEADER)
        for sec_name, sec_text in sections.items():
            if sec_name in ("SKILLS", "HEADER"):
                continue
            if sec_text:
                source = f"{sec_name.lower()}_section"
                cls._extract_from_text(
                    sec_text, source, extracted_skills, seen_names
                )

        # Priority 3: HEADER or full cleaned_text fallback
        header_text = sections.get("HEADER", "")
        if header_text:
            cls._extract_from_text(
                header_text, "header", extracted_skills, seen_names
            )

        if cleaned_text and not skills_text:
            cls._extract_from_text(
                cleaned_text, "catalog_match", extracted_skills, seen_names
            )

        return extracted_skills

    @classmethod
    def _extract_from_text(
        cls,
        text: str,
        source: str,
        results: List[Skill],
        seen_names: Set[str]
    ) -> None:
        if not text:
            return

        text_clean = cls.sanitize_text_for_skill_detection(text)
        if not text_clean.strip():
            return

        for skill_def in SKILL_CATALOG:
            canonical = skill_def["canonical"]
            if canonical in seen_names:
                continue

            pattern = skill_def["pattern"]
            category = skill_def["category"]

            # Additional safety check for short single-letter skills like R or C
            if canonical == "R":
                # Ensure R is not isolated in words like "R&D" unless in list context, or avoid matching R in plain prose
                if re.search(r"(?<![A-Za-z0-9])R(?![A-Za-z0-9])", text_clean):
                    # Validate context: must be surrounded by separators or in skills list
                    if re.search(r"[,;/•|\n\r]\s*R\s*[,;/•|\n\r]", text_clean) or source == "skills_section":
                        seen_names.add(canonical)
                        results.append(Skill(name=canonical, category=category, source=source))
                continue

            if canonical == "C":
                if re.search(r"(?<![A-Za-z0-9+#])C(?![A-Za-z0-9+#])", text_clean):
                    if re.search(r"[,;/•|\n\r]\s*C\s*[,;/•|\n\r]", text_clean) or source == "skills_section":
                        seen_names.add(canonical)
                        results.append(Skill(name=canonical, category=category, source=source))
                continue

            # Standard regex search
            if re.search(pattern, text_clean, re.IGNORECASE):
                seen_names.add(canonical)
                results.append(Skill(name=canonical, category=category, source=source))

    @classmethod
    def _extract_explicit_section_items(cls, text: str, results: List[Skill], seen_names: Set[str]) -> None:
        """Preserve conservative list items explicitly written under SKILLS."""
        known_lower = {name.casefold() for name in seen_names}
        for line in cls._merge_wrapped_section_lines(cls.split_non_empty_lines(text)):
            for raw in re.split(r"\s*[|;,]\s*", line):
                value = re.sub(r"^[\s\-•*]+", "", raw).strip()
                words = value.split()
                if not value or not (1 <= len(words) <= 6) or len(value) > 50:
                    continue
                if "@" in value or re.search(r"\+?\d[\d\s()./-]{5,}", value):
                    continue
                if re.fullmatch(r"(?:19|20)\d{2}(?:[-/]\d{1,2})?", value):
                    continue
                if value.endswith((".", "!", "?", ":")):
                    continue
                if normalize_header_title(value) in {"SKILLS", "TECHNICAL SKILLS", "COMPETENCES", "COMPETENCES TECHNIQUES"}:
                    continue
                if re.search(r"\b(university|université|school|école|institute|institut|college|faculty|faculté)\b", value, re.IGNORECASE):
                    continue
                if value.casefold() in {"ibm", "google", "microsoft", "amazon"}:
                    continue
                if not all(character.isalnum() or character in " .+#/&'-" for character in value):
                    continue
                if any(re.search(skill["pattern"], value, re.IGNORECASE) for skill in SKILL_CATALOG):
                    continue
                if value.casefold() not in known_lower:
                    results.append(Skill(name=value, category=None, source="skills_section"))
                    seen_names.add(value)
                    known_lower.add(value.casefold())

    @staticmethod
    def _merge_wrapped_section_lines(lines: List[str]) -> List[str]:
        """Rejoin narrow-column continuations using grammatical join signals."""
        merged: List[str] = []
        leading_connector = re.compile(r"^(?:de|des|du|d['’]|et|and|of|for)\b", re.IGNORECASE)
        trailing_connector = re.compile(r"(?:\bde|\bdes|\bdu|\bd['’]|\bet|\band|\bof|\bfor)$", re.IGNORECASE)
        for raw in lines:
            value = raw.strip()
            if not value:
                continue
            if merged and not re.match(r"^[\-•*]", value) and (
                trailing_connector.search(merged[-1]) or leading_connector.search(value)
            ):
                merged[-1] = f"{merged[-1]} {value}"
            else:
                merged.append(value)
        return merged
