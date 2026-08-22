"""
Deterministic extractor for spoken and written language competencies.
"""

import re
from typing import Dict, List, Optional
from app.extractors.base_extractor import BaseExtractor
from app.models.cv_models import Language


class LanguagesExtractor(BaseExtractor):
    """Extracts languages and normalizes proficiency levels and names."""

    LANGUAGE_MAP = {
        "français": "French",
        "francais": "French",
        "french": "French",
        "anglais": "English",
        "english": "English",
        "arabe": "Arabic",
        "arabic": "Arabic",
        "espagnol": "Spanish",
        "spanish": "Spanish",
        "allemand": "German",
        "german": "German",
        "italien": "Italian",
        "italian": "Italian",
    }

    LEVEL_MAP = [
        (r"\b(maternelle|native|langue\s+maternelle)\b", "Native"),
        (r"\b(bilingue|bilingual)\b", "Bilingual"),
        (r"\b(courant|fluent|c1|c2)\b", "Fluent"),
        (r"\b(professionnel|professional|b2|working\s+proficiency)\b", "Professional"),
        (r"\b(intermédiaire|intermediaire|intermediate|b1)\b", "Intermediate"),
        (r"\b(notions|basic|élémentaire|elementaire|a1|a2)\b", "Basic"),
    ]

    @classmethod
    def extract(
        cls,
        sections: Optional[Dict[str, str]] = None,
        cleaned_text: str = ""
    ) -> List[Language]:
        """Extract language entries from LANGUAGES section or full cleaned_text."""
        sections = sections or {}
        text = sections.get("LANGUAGES", "")

        # Fallback: search for language keywords in cleaned_text if no LANGUAGES section
        if not text and cleaned_text:
            text = cls._find_languages_in_text(cleaned_text)

        if not text:
            return []

        lines = cls.split_non_empty_lines(text)
        results: List[Language] = []
        seen_languages = set()

        for line in lines:
            # Check each known language in line
            line_lower = line.lower()
            matched_known_language = False
            for lang_key, canonical_lang in cls.LANGUAGE_MAP.items():
                if canonical_lang in seen_languages:
                    continue

                # Match language as word boundary
                if re.search(r"\b" + re.escape(lang_key) + r"\b", line_lower):
                    matched_known_language = True
                    seen_languages.add(canonical_lang)
                    level, original_level = cls._parse_level(line, lang_key)
                    results.append(
                        Language(
                            language=canonical_lang,
                            level=level,
                            original_level=original_level
                        )
                    )

            # An explicit LANGUAGES section plus a recognized proficiency is a
            # strong enough signal to retain languages outside the finite map.
            if not matched_known_language:
                structural = re.match(r"^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '\-]{1,30})\s*[:\-]\s*(.+)$", line.strip())
                if structural:
                    raw_language = cls.clean_value(structural.group(1))
                    level, original_level = cls._parse_level(line, structural.group(1))
                    key = raw_language.casefold() if raw_language else ""
                    if raw_language and level and key not in {value.casefold() for value in seen_languages}:
                        seen_languages.add(raw_language)
                        results.append(Language(language=raw_language, level=level, original_level=original_level))
                else:
                    # Inside an explicit LANGUAGES section, a short standalone
                    # alphabetic item is a language record even without level.
                    raw_language = cls.clean_value(line.strip(" •-*"))
                    if (
                        raw_language
                        and 1 <= len(raw_language.split()) <= 3
                        and re.fullmatch(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '\-]+", raw_language)
                        and raw_language.casefold() not in {value.casefold() for value in seen_languages}
                    ):
                        seen_languages.add(raw_language)
                        results.append(Language(language=raw_language, level=None, original_level=None))

        return results

    @classmethod
    def _parse_level(cls, line: str, lang_key: str) -> tuple[Optional[str], Optional[str]]:
        # Remove the language name from line to extract level part
        level_part = re.sub(r"(?i)\b" + re.escape(lang_key) + r"\b", "", line).strip(" :,-–—•|()")
        level_part_clean = cls.clean_value(level_part)

        if not level_part_clean:
            return None, None

        original_level = level_part_clean

        for level_pattern, canonical_level in cls.LEVEL_MAP:
            if re.search(level_pattern, level_part_clean, re.IGNORECASE):
                return canonical_level, original_level

        return None, original_level

    @classmethod
    def _find_languages_in_text(cls, cleaned_text: str) -> str:
        matched_lines = []
        for line in cls.split_non_empty_lines(cleaned_text):
            line_lower = line.lower()
            if any(re.search(r"\b" + re.escape(lk) + r"\b", line_lower) for lk in cls.LANGUAGE_MAP):
                matched_lines.append(line)
        return "\n".join(matched_lines)
