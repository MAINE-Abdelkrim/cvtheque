"""
Deterministic extractor for academic education and degrees.
"""

import re
from typing import Dict, List, Optional
from app.core.constants import COMMON_CITIES
from app.extractors.base_extractor import BaseExtractor
from app.models.cv_models import Education


class EducationExtractor(BaseExtractor):
    """Extracts degree, field of study, institution, location, dates, and description."""

    DEGREE_PATTERNS = [
        r"master\s+of\s+science",
        r"professional\s+diploma",
        r"national\s+diploma",
        r"technicien\s+sp[ée]cialis[ée]",
        r"specialized\s+technician",
        r"b\.?\s*com\.?",
        r"matric",
        r"cycle\s+(?:d')?ingénieur",
        r"cycle\s+préparatoire",
        r"diplôme\s+d'?ingénieur",
        r"engineering\s+degree",
        r"bachelor\s+of\s+science",
        r"high\s+school\s+diploma",
        r"doctorat", r"ph\.?d\.?",
        r"master", r"mba", r"msc",
        r"licence", r"bachelor",
        r"dut", r"bts", r"deug",
        r"baccalauréat", r"bac"
    ]

    INSTITUTION_KEYWORDS = [
        "Université", "University", "École", "School", "Institut", "Institute",
        "Faculté", "Faculty", "Lycée", "High School", "College", "Collège",
        "EMSI", "ENSET", "ENSA", "EMI", "INPT", "EST", "FST"
    ]

    DATE_RANGE_REGEX = r"\b((?:(?:0[1-9]|1[0-2])/)?(?:20\d{2}|19\d{2}))\s*(?:-|–|—|à|au|to)\s*((?:(?:0[1-9]|1[0-2])/)?(?:20\d{2}|19\d{2}|présent|present|actuel|aujourd'hui))\b"
    SINGLE_YEAR_REGEX = r"\b(20\d{2}|19\d{2})\b"

    @classmethod
    def extract(
        cls,
        sections: Optional[Dict[str, str]] = None,
        cleaned_text: str = ""
    ) -> List[Education]:
        """Extract education items from EDUCATION section."""
        sections = sections or {}
        text = sections.get("EDUCATION", "")

        if not text:
            return []

        blocks = cls._segment_education_blocks(text)
        results: List[Education] = []

        for block in blocks:
            edu_item = cls._parse_education_block(block)
            if edu_item and (edu_item.degree or edu_item.institution or edu_item.start_date):
                results.append(edu_item)

        return results

    @classmethod
    def _segment_education_blocks(cls, text: str) -> List[str]:
        """Segment education section text into individual formation blocks."""
        raw_lines = text.splitlines()
        blocks = []
        current_block = []

        for line in raw_lines:
            line_clean = line.strip()
            if not line_clean:
                if current_block:
                    blocks.append("\n".join(current_block))
                    current_block = []
                continue

            # Check if line starts a new education item
            is_new_degree = cls._has_degree(line_clean)
            is_new_institution = cls._has_institution(line_clean)
            is_new_date = bool(re.search(cls.DATE_RANGE_REGEX, line_clean, re.IGNORECASE)) or bool(
                re.fullmatch(r"\s*(?:20\d{2}|19\d{2})\s*", line_clean)
            )
            is_bullet = line_clean.startswith("-") or line_clean.startswith("•")

            # Check if current_block already has degree or date
            block_text = " ".join(current_block)
            block_has_degree = cls._has_degree(block_text)
            block_has_institution = cls._has_institution(block_text)
            block_has_date = bool(re.search(cls.DATE_RANGE_REGEX, block_text, re.IGNORECASE)) or bool(re.search(cls.SINGLE_YEAR_REGEX, block_text))

            # Only split if current block already contains a degree OR if it already has both date and degree
            should_split = current_block and not is_bullet and (
                (is_new_date and block_has_date) or
                (is_new_degree and (block_has_degree or (block_has_institution and block_has_date))) or
                (is_new_institution and block_has_degree and block_has_institution and block_has_date)
            )

            if should_split:
                blocks.append("\n".join(current_block))
                current_block = [line_clean]
            else:
                current_block.append(line_clean)

        if current_block:
            blocks.append("\n".join(current_block))

        return blocks

    @classmethod
    def _has_degree(cls, value: str) -> bool:
        return any(re.search(r"\b" + pat + r"\b", value, re.IGNORECASE) for pat in cls.DEGREE_PATTERNS)

    @classmethod
    def _has_institution(cls, value: str) -> bool:
        return any(re.search(r"\b" + re.escape(keyword) + r"\b", value, re.IGNORECASE) for keyword in cls.INSTITUTION_KEYWORDS)

    @classmethod
    def _parse_degree_line(cls, line: str):
        degree = None
        field_of_study = None
        matched_pat = None

        for pat in cls.DEGREE_PATTERNS:
            match = re.search(r"\b(" + pat + r")\b", line, re.IGNORECASE)
            if match:
                matched_pat = match.group(0)
                degree = cls.clean_value(matched_pat)
                break

        if degree and matched_pat:
            # Extract remaining text after removing degree pattern
            remainder = re.sub(r"\b" + re.escape(matched_pat) + r"\b", "", line, count=1, flags=re.IGNORECASE)
            # Strip leading connector words
            remainder = re.sub(r"^(en|in|de|d'|du|es|option|spécialité|major|-[ \t]*|:[ \t]*|\|[ \t]*)+", "", remainder.strip(), flags=re.IGNORECASE)
            field_of_study = cls.clean_value(remainder)

        return degree, field_of_study

    @classmethod
    def _parse_education_block(cls, block: str) -> Education:
        lines = [l.strip() for l in block.splitlines() if l.strip()]
        if not lines:
            return Education()

        full_block_text = " ".join(lines)

        # 1. Dates extraction
        start_date = None
        end_date = None

        date_range_match = re.search(cls.DATE_RANGE_REGEX, full_block_text, re.IGNORECASE)
        if date_range_match:
            start_date = cls.normalize_date_text(date_range_match.group(1))
            end_date = cls.normalize_date_text(date_range_match.group(2))
        else:
            single_years = re.findall(cls.SINGLE_YEAR_REGEX, full_block_text)
            if len(single_years) >= 2:
                start_date = single_years[0]
                end_date = single_years[1]
            elif len(single_years) == 1:
                start_date = single_years[0]
                end_date = single_years[0]

        # 2. Institution and Location extraction
        institution = None
        location = None

        inst_match_line = None
        for line in lines:
            for kw in cls.INSTITUTION_KEYWORDS:
                match = re.search(r"\b" + re.escape(kw) + r"\b", line, re.IGNORECASE)
                if match:
                    inst_match_line = line
                    inst_start = match.start()
                    before_keyword = line[:inst_start].strip()
                    before_is_degree = any(
                        re.search(r"\b" + pattern + r"\b", before_keyword, re.IGNORECASE)
                        for pattern in cls.DEGREE_PATTERNS
                    )
                    comma_segments = [segment.strip() for segment in line.split(",") if segment.strip()]
                    keyword_segment = next(
                        (segment for segment in comma_segments if len(comma_segments) > 1 and re.search(r"\b" + re.escape(kw) + r"\b", segment, re.IGNORECASE)),
                        None,
                    )
                    inst_text = keyword_segment or (line[inst_start:] if before_is_degree else line)
                    parts = re.split(r"[—–|;]", inst_text)
                    first_part = parts[0].strip()
                    comma_parts = [cp.strip() for cp in first_part.split(",") if cp.strip()]
                    if comma_parts:
                        institution = cls.clean_value(comma_parts[0])
                        if len(comma_parts) > 1:
                            cand_loc = comma_parts[1]
                            if any(re.search(r"\b" + re.escape(c) + r"\b", cand_loc, re.IGNORECASE) for c in COMMON_CITIES):
                                location = cls.clean_value(cand_loc)
                    break
            if institution:
                break

        if institution:
            institution = re.sub(cls.SINGLE_YEAR_REGEX, "", institution).strip()
            institution = cls.clean_value(institution)

        if not location:
            for city in COMMON_CITIES:
                if re.search(r"\b" + re.escape(city) + r"\b", full_block_text, re.IGNORECASE):
                    location = city
                    break

        # 3. Degree & Field of study extraction
        degree = None
        field_of_study = None

        degree_text_candidates = []
        if inst_match_line and institution:
            kw_idx = -1
            for kw in cls.INSTITUTION_KEYWORDS:
                if kw.lower() in inst_match_line.lower():
                    kw_idx = inst_match_line.lower().find(kw.lower())
                    break
            if kw_idx > 0:
                text_before = inst_match_line[:kw_idx]
                degree_text_candidates.append(text_before)

        for line in lines:
            if institution and institution.lower() in line.lower() and line not in degree_text_candidates:
                continue
            degree_text_candidates.append(line)

        chosen_degree_text = None
        for cand in degree_text_candidates:
            if any(re.search(r"\b" + pat + r"\b", cand, re.IGNORECASE) for pat in cls.DEGREE_PATTERNS):
                chosen_degree_text = cand
                break

        if not chosen_degree_text and degree_text_candidates:
            chosen_degree_text = degree_text_candidates[0]

        if chosen_degree_text:
            chosen_index = lines.index(chosen_degree_text) if chosen_degree_text in lines else -1
            if chosen_index >= 0:
                continuation = []
                for value in lines[chosen_index + 1:]:
                    if cls._has_institution(value) or re.search(cls.DATE_RANGE_REGEX, value, re.IGNORECASE) or re.fullmatch(cls.SINGLE_YEAR_REGEX, value):
                        break
                    if len(value.split()) <= 6 and not value.endswith("."):
                        continuation.append(value)
                    else:
                        break
                if continuation:
                    chosen_degree_text = " ".join([chosen_degree_text, *continuation])
            cleaned_deg_text = re.sub(cls.DATE_RANGE_REGEX, "", chosen_degree_text, flags=re.IGNORECASE)
            cleaned_deg_text = re.sub(cls.SINGLE_YEAR_REGEX, "", cleaned_deg_text)
            cleaned_deg_text = re.sub(r"\b(à|at|in|en)\s+(l'|la|le)?\s*$", "", cleaned_deg_text.strip(), flags=re.IGNORECASE)
            cleaned_deg_text = cls.clean_value(cleaned_deg_text)
            if cleaned_deg_text:
                degree, field_of_study = cls._parse_degree_line(cleaned_deg_text)

        if degree and re.search(r"\b(baccalauréat|bac)\b", degree, re.IGNORECASE):
            if start_date and start_date == end_date:
                start_date = None

        # Sanity cleanups
        if institution:
            if degree and institution.lower() in degree.lower():
                degree = re.sub(re.escape(institution), "", degree, flags=re.IGNORECASE)
                degree = cls.clean_value(degree)
            if field_of_study and institution.lower() in field_of_study.lower():
                field_of_study = re.sub(re.escape(institution), "", field_of_study, flags=re.IGNORECASE)
                field_of_study = cls.clean_value(field_of_study)

        if field_of_study:
            field_of_study = re.sub(r"\s+\b(à|at|en|in)\s*(l')?$", "", field_of_study, flags=re.IGNORECASE)
            field_of_study = cls.clean_value(field_of_study)

        # Description: remaining bullet points or details
        desc_lines = [l for l in lines if l.startswith("-") or l.startswith("•")]
        description = "\n".join(desc_lines) if desc_lines else None

        return Education(
            degree=degree,
            field_of_study=field_of_study,
            institution=institution,
            location=location,
            start_date=start_date,
            end_date=end_date,
            description=description,
        )
