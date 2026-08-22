"""
Base Extractor class providing common text utility and cleaning methods.
"""

import re
from typing import List, Optional


class BaseExtractor:
    """Base class for all deterministic CV extractors."""

    @staticmethod
    def normalize_whitespace(text: Optional[str]) -> str:
        """Replace multiple spaces and tabs with a single space, stripping edges."""
        if not text:
            return ""
        # Preserve newlines if needed or flatten
        return re.sub(r"[ \t]+", " ", text).strip()

    @staticmethod
    def clean_value(val: Optional[str]) -> Optional[str]:
        """Strip surrounding spaces/punctuation and return None if empty or blank."""
        if val is None:
            return None
        cleaned = val.strip(" \t\n\r,;:•-·|–—")
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        return cleaned if cleaned else None

    @staticmethod
    def sanitize_text_for_skill_detection(text: str) -> str:
        """Mask emails, URLs, GitHub/LinkedIn links, and phones before skill search."""
        if not text:
            return ""
        # Remove emails
        sanitized = re.sub(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", " ", text)
        # Remove URLs (http, https, www, linkedin.com, github.com)
        sanitized = re.sub(r"(https?://|www\.)[^\s,;)]+", " ", sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r"\b(linkedin\.com|github\.com)/[a-zA-Z0-9%_-]+", " ", sanitized, flags=re.IGNORECASE)
        # Remove phone numbers
        sanitized = re.sub(r"(\+212|00212|0)[5-7][\s.-]?(\d[\s.-]?){8}\b", " ", sanitized)
        sanitized = re.sub(r"\+\d{1,3}[\s.-]?\(?\d{1,4}\)?([\s.-]?\d{2,4}){2,4}\b", " ", sanitized)
        return sanitized

    @staticmethod
    def split_non_empty_lines(text: Optional[str]) -> List[str]:
        """Split text into non-empty stripped lines."""
        if not text:
            return []
        lines = [line.strip() for line in text.splitlines()]
        return [line for line in lines if line]

    @staticmethod
    def normalize_date_text(text: Optional[str]) -> Optional[str]:
        """Clean and normalize date strings (e.g., '2020 - 2022' -> '2020 - 2022')."""
        if not text:
            return None
        text = text.strip()
        # Replace en-dash / em-dash with standard hyphen surrounded by spaces
        text = re.sub(r"\s*[–—]\s*", " - ", text)
        text = re.sub(r"\s+-\s+", " - ", text)
        # Normalize Present/Aujourd'hui/Présent
        text = re.sub(r"(?i)\b(présent|present|aujourd['’]?hui|current)\b", "Présent", text)
        return text

    @staticmethod
    def remove_duplicate_lines(text: Optional[str]) -> str:
        """Remove exact duplicate lines while keeping order."""
        if not text:
            return ""
        lines = text.splitlines()
        seen = set()
        unique_lines = []
        for line in lines:
            stripped = line.strip()
            if stripped not in seen:
                seen.add(stripped)
                unique_lines.append(line)
        return "\n".join(unique_lines)
