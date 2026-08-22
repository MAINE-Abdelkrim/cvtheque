"""
Section detection and content segmentation service.
Operates exclusively on cleaned text.
Identifies section headers in French and English using alias maps and title normalization.
Preserves dates, bullet points, and business content intact.
"""

from typing import Dict, List, Tuple
from app.core.constants import SECTION_HEADER_ALIASES
from app.utils.text_cleaning import (
    normalize_header_title,
    remove_accents_and_lowercase,
)


class SectionService:
    """Service for segmenting cleaned resume text into canonical section blocks."""

    ALL_SECTION_ALIASES: Dict[str, List[str]] = SECTION_HEADER_ALIASES

    @classmethod
    def _match_canonical_section(cls, line_title: str) -> str | None:
        """
        Attempts to match a cleaned line title to a canonical section name.
        Returns the canonical section string (e.g. 'EXPERIENCES') or None if not matched.
        """
        normalized_line = remove_accents_and_lowercase(line_title).strip()
        if not normalized_line:
            return None

        for canonical_name, aliases in cls.ALL_SECTION_ALIASES.items():
            for alias in aliases:
                norm_alias = remove_accents_and_lowercase(alias).strip()
                if normalized_line == norm_alias:
                    return canonical_name

        return None

    @classmethod
    def detect_and_segment_sections(cls, cleaned_text: str) -> Tuple[Dict[str, str], List[str]]:
        """
        Segment cleaned resume text into a dictionary of section names to text content.
        Preserves all dates, bullet points, and original text formatting inside section bodies.
        Returns a tuple: (sections_dict, detected_section_canonical_names)
        """
        if not cleaned_text or not cleaned_text.strip():
            return {}, []

        lines = cleaned_text.split("\n")
        sections_dict: Dict[str, List[str]] = {}
        detected_sections: List[str] = []

        current_section = "HEADER"
        sections_dict[current_section] = []
        consumed_heading_continuations: set[int] = set()

        contact_labels = {"adresse", "email", "telephone", "date de naissance", "permis",
                          "address", "phone", "date of birth", "driving licence"}
        for index, line in enumerate(lines):
            if index in consumed_heading_continuations:
                continue
            line_str = line.strip()
            if not line_str:
                # Retain blank line spacing in current section
                sections_dict[current_section].append("")
                continue

            # Check if line looks like a header (short length, no trailing sentence punctuation, or bullet stripped)
            candidate_header = normalize_header_title(line_str)
            canonical_match = cls._match_canonical_section(candidate_header)

            # A sidebar headed "Profil/Profile" commonly contains contact labels,
            # not a professional summary.  Keep it internal and bounded so it
            # cannot absorb the real summary or contaminate business sections.
            if canonical_match == "SUMMARY" and normalize_header_title(line_str) in {"PROFIL", "PROFILE"}:
                following = {
                    remove_accents_and_lowercase(value).rstrip(":").strip()
                    for value in lines[index + 1:index + 8]
                }
                if len(following.intersection(contact_labels)) >= 2:
                    canonical_match = "PROFILE_CONTACT"

            if canonical_match:
                # Narrow columns commonly wrap a canonical heading over two
                # lines (for example, "EXPÉRIENCES" / "PROFESSIONNELLES").
                # Consume the continuation only when the exact combined text
                # maps back to the same controlled canonical section.
                if index + 1 < len(lines) and lines[index + 1].strip():
                    combined = normalize_header_title(f"{line_str} {lines[index + 1].strip()}")
                    if cls._match_canonical_section(combined) == canonical_match:
                        consumed_heading_continuations.add(index + 1)
                current_section = canonical_match
                if current_section not in sections_dict:
                    sections_dict[current_section] = []
                    detected_sections.append(current_section)
                # Header line processed, do not duplicate header in body
                continue

            sections_dict[current_section].append(line)

        # Recombine list of lines into trimmed strings
        result_dict: Dict[str, str] = {}
        for sec_name, sec_lines in sections_dict.items():
            content = "\n".join(sec_lines).strip()
            if content:
                result_dict[sec_name] = content

        return result_dict, detected_sections
