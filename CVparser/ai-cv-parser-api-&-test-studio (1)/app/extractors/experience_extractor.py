"""
Deterministic extractor for professional experiences.
"""

import re
from typing import Dict, List, Optional
from app.core.constants import COMMON_CITIES
from app.extractors.base_extractor import BaseExtractor
from app.models.cv_models import Experience


class ExperienceExtractor(BaseExtractor):
    """Extracts job title, company, location, start date, end date, and description."""

    JOB_TITLE_PATTERNS = [
        r"développeur(\s+\w+)*", r"developer(\s+\w+)*", r"software\s+engineer",
        r"ingénieur(\s+\w+)*", r"engineer(\s+\w+)*", r"data\s+scientist",
        r"data\s+analyst", r"data\s+engineer", r"consultant(\s+\w+)*",
        r"chef\s+de\s+projet", r"project\s+manager", r"manager(\s+\w+)*",
        r"responsable(\s+\w+)*", r"accountant", r"comptable", r"auditor",
        r"auditeur", r"financial\s+analyst", r"analyste\s+financier",
        r"backend\s+developer", r"frontend\s+developer", r"fullstack\s+developer",
        r"stagiaire", r"intern"
    ]

    MONTH_NAME = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|Janv(?:ier)?|F[ée]vr(?:ier)?|Mars|Avr(?:il)?|Mai|Juin|Juil(?:let)?|Ao[ûu]t|Sept(?:embre)?|Oct(?:obre)?|Nov(?:embre)?|D[ée]c(?:embre)?)"
    DATE_TOKEN = rf"(?:{MONTH_NAME}\.?\s+(?:19|20)\d{{2}}|(?:19|20)\d{{2}}-(?:0[1-9]|1[0-2])|(?:0[1-9]|1[0-2])/(?:19|20)\d{{2}}|(?:19|20)\d{{2}})"
    PRESENT_TOKEN = r"(?:pr[ée]sent|present|actuel|aujourd['’]hui|current|en\s+cours)"
    DATE_RANGE_REGEX = rf"\b({DATE_TOKEN})\s*(?:-|–|—|à|au|to|depuis|since)\s*({DATE_TOKEN}|{PRESENT_TOKEN})\b"
    SINGLE_DATE_REGEX = rf"\b({DATE_TOKEN})\b"
    MONTH_RANGE_SAME_YEAR_REGEX = r"\b(Janv(?:ier)?\.?|F[ée]vr(?:ier)?\.?|Mars|Avr(?:il)?\.?|Mai|Juin|Juil(?:let)?\.?|Ao[ûu]t|Sept(?:embre)?\.?|Oct(?:obre)?\.?|Nov(?:embre)?\.?|D[ée]c(?:embre)?\.?)\s*(?:-|–|—|à|au)\s*(Janv(?:ier)?\.?|F[ée]vr(?:ier)?\.?|Mars|Avr(?:il)?\.?|Mai|Juin|Juil(?:let)?\.?|Ao[ûu]t|Sept(?:embre)?\.?|Oct(?:obre)?\.?|Nov(?:embre)?\.?|D[ée]c(?:embre)?\.?)\s+(20\d{2}|19\d{2})\b"
    FLEX_MONTH_RANGE_REGEX = r"\b((?:Janvier|F[ée]vrier|Mars|Avril|Mai|Juin|Juillet|Ao[ûu]t|Septembre|Octobre|Novembre|D[ée]cembre)\s+(?:20\d{2}|19\d{2}))\s*[-–—]\s*((?:(?:Janvier|F[ée]vrier|Mars|Avril|Mai|Juin|Juillet|Ao[ûu]t|Septembre|Octobre|Novembre|D[ée]cembre)\s+(?:20\d{2}|19\d{2}))|(?:en\s+cours|pr[ée]sent|present|current))\b"

    @classmethod
    def extract(
        cls,
        sections: Optional[Dict[str, str]] = None,
        cleaned_text: str = ""
    ) -> List[Experience]:
        """Extract experience entries from EXPERIENCES section."""
        sections = sections or {}
        text = sections.get("EXPERIENCES", "")

        if not text:
            return []

        blocks = cls._segment_experience_blocks(text)
        results: List[Experience] = []

        for block in blocks:
            exp_item = cls._parse_experience_block(block)
            normalized = block.lower()
            contact_only = any(label in normalized for label in (
                "date de naissance", "date of birth", "téléphone", "telephone",
                "phone", "adresse", "address", "permis", "driving licence",
            )) and not re.search(cls.DATE_RANGE_REGEX, block, re.IGNORECASE)
            # A company-like line by itself is not enough evidence for an
            # employment record; it may be a detached label or prose fragment.
            if exp_item and not contact_only and (exp_item.job_title or exp_item.start_date):
                results.append(exp_item)

        return results

    @classmethod
    def _segment_experience_blocks(cls, text: str) -> List[str]:
        """Segment experiences text into individual experience blocks."""
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

            # Check if line starts a new experience block
            is_new_date = bool(re.search(cls.DATE_RANGE_REGEX, line_clean, re.IGNORECASE)) or bool(re.search(cls.SINGLE_DATE_REGEX, line_clean))
            is_new_title = cls._looks_like_title_line(line_clean)
            is_bullet = line_clean.startswith("-") or line_clean.startswith("•") or line_clean.startswith("*")

            block_text = " ".join(current_block)
            block_has_title = any(cls._looks_like_title_line(value) for value in current_block)
            block_has_date = bool(re.search(cls.DATE_RANGE_REGEX, block_text, re.IGNORECASE)) or bool(re.search(cls.SINGLE_DATE_REGEX, block_text))
            block_has_description = any(
                value.startswith(("-", "•", "*")) or len(value.split()) > 8 or value.endswith(".")
                for value in current_block
            )

            should_split = current_block and not is_bullet and (
                (is_new_date and block_has_date) or
                (is_new_title and block_has_title and block_has_date and block_has_description)
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
    def _parse_experience_block(cls, block: str) -> Experience:
        lines = [l.strip() for l in block.splitlines() if l.strip()]
        if not lines:
            return Experience()

        full_block_text = " ".join(lines)

        # Dates
        start_date = None
        end_date = None
        same_year_month_match = re.search(
            cls.MONTH_RANGE_SAME_YEAR_REGEX, full_block_text, re.IGNORECASE
        )
        flexible_month_match = re.search(cls.FLEX_MONTH_RANGE_REGEX, full_block_text, re.IGNORECASE)
        date_match = re.search(cls.DATE_RANGE_REGEX, full_block_text, re.IGNORECASE)
        if flexible_month_match:
            start_date = cls.normalize_date_text(flexible_month_match.group(1))
            end_date = cls.normalize_date_text(flexible_month_match.group(2))
            if end_date and end_date.lower() == "en cours":
                end_date = "Présent"
        elif same_year_month_match:
            year = same_year_month_match.group(3)
            start_date = f"{same_year_month_match.group(1)} {year}"
            end_date = f"{same_year_month_match.group(2)} {year}"
        elif date_match:
            start_date = cls.normalize_date_text(date_match.group(1))
            end_date = cls.normalize_date_text(date_match.group(2))
        else:
            dates = re.findall(cls.SINGLE_DATE_REGEX, full_block_text)
            if len(dates) >= 2:
                start_date = dates[0]
                end_date = dates[1]
            elif len(dates) == 1:
                start_date = dates[0]

        # Job title
        structural_parts = next((cls._structural_title_parts(line) for line in lines if cls._structural_title_parts(line)), None)
        job_title = cls.clean_value(structural_parts[0]) if structural_parts else None
        company_first = cls._company_first_header(lines)
        if company_first:
            company, structural_job_title = company_first
            job_title = structural_job_title
        for pat in cls.JOB_TITLE_PATTERNS:
            if job_title:
                break
            match = re.search(r"\b" + pat + r"\b", full_block_text, re.IGNORECASE)
            if match:
                # Find line containing title or matched title string
                for line in lines:
                    if re.search(r"\b" + pat + r"\b", line, re.IGNORECASE) and not (line.startswith("-") or line.startswith("•")):
                        # Clean title line from company or dates
                        title_candidate = re.split(r"(?i)\b(chez|at)\b|[|—:]", line)[0]
                        job_title = cls.clean_value(title_candidate)
                        break
                if not job_title:
                    job_title = cls.clean_value(match.group(0).title())
                break

        if not job_title and start_date:
            structural = [
                line for line in lines
                if cls._looks_like_title_line(line)
                and not re.search(cls.DATE_RANGE_REGEX, line, re.IGNORECASE)
                and not re.search(cls.FLEX_MONTH_RANGE_REGEX, line, re.IGNORECASE)
                and not re.fullmatch(r"[+()\d\s./-]+", line)
                and not line.endswith(".")
            ]
            if structural:
                job_title = cls.clean_value(structural[0].rstrip(" :"))

        # Company
        company = company if company_first else (cls.clean_value(structural_parts[1]) if structural_parts else None)
        if not company and lines and re.search(cls.DATE_RANGE_REGEX, lines[0], re.IGNORECASE):
            for candidate in lines[1:3]:
                if cls._looks_like_company_line(candidate):
                    company = cls.clean_value(candidate)
                    break
        company_match = re.search(r"\b(chez|at)\s+([A-Za-z0-9À-ÿ\s&.-]+)", full_block_text, re.IGNORECASE)
        if company_match:
            cand = company_match.group(2)
            cand = re.split(r"[,;–—|:\n]", cand)[0]
            company = cls.clean_value(cand)
        else:
            # Look for line with "Company, Location" or "Company — Location"
            for line in lines:
                if not (line.startswith("-") or line.startswith("•")):
                    parts = [p.strip() for p in re.split(r"[,|–—]", line) if p.strip()]
                    if len(parts) >= 2:
                        # If first part is title, second might be company
                        if job_title and job_title.lower() in parts[0].lower():
                            company = cls.clean_value(parts[1])
                            break
            if not company:
                for line in lines:
                    if (
                        not line.startswith(("-", "•", "*"))
                        and (not job_title or cls.clean_value(line.rstrip(" :")) != job_title)
                        and not re.search(cls.DATE_RANGE_REGEX, line, re.IGNORECASE)
                        and not re.search(cls.MONTH_RANGE_SAME_YEAR_REGEX, line, re.IGNORECASE)
                        and not re.search(cls.SINGLE_DATE_REGEX, line)
                        and "," not in line
                        and 1 <= len(line.split()) <= 5
                    ):
                        company = cls.clean_value(line)
                        break

        # Location
        location = None
        for city in COMMON_CITIES:
            if re.search(r"\b" + re.escape(city) + r"\b", full_block_text, re.IGNORECASE):
                location = city
                break

        # Description: bullet lines or lines that are not title/company/date header
        desc_lines = []
        for line in lines:
            if line.startswith("-") or line.startswith("•") or line.startswith("*"):
                desc_lines.append(line)
            elif job_title and line != job_title and not (date_match and date_match.group(0) in line):
                # If line is longer description line
                if len(line.split()) > 6:
                    desc_lines.append(line)

        description = "\n".join(desc_lines) if desc_lines else None

        if company and (
            re.fullmatch(r"[+()\d\s.-]+", company)
            or re.fullmatch(cls.PRESENT_TOKEN, company.strip(), re.IGNORECASE)
            or company.strip().lower() in {"permis", "driving licence", "adresse", "address", "email", "téléphone", "telephone", "phone"}
        ):
            company = None

        return Experience(
            job_title=job_title,
            company=company,
            location=location,
            start_date=start_date,
            end_date=end_date,
            description=description,
        )

    @classmethod
    def _looks_like_title_line(cls, line: str) -> bool:
        """Return true only for short header-like title evidence, never prose."""
        value = line.strip(" :")
        if not value or value.endswith((".", ",", ";")) or len(value.split()) > 8:
            return False
        if re.search(cls.DATE_RANGE_REGEX, value, re.IGNORECASE):
            return False
        if re.fullmatch(cls.PRESENT_TOKEN, value, re.IGNORECASE):
            return False
        if cls._structural_title_parts(value):
            return True
        if ExperienceExtractor._looks_like_company_line(value):
            return False
        if any(re.fullmatch(pat, value, re.IGNORECASE) for pat in cls.JOB_TITLE_PATTERNS):
            return True
        words = value.split()
        return 1 <= len(words) <= 6 and all(
            re.match(r"^[A-ZÀ-Ý][A-Za-zÀ-ÿ'’/&-]*$", word) for word in words
        )

    @staticmethod
    def _looks_like_company_line(line: str) -> bool:
        """Conservative organization signal for date-first records."""
        value = line.strip()
        if not (1 <= len(value.split()) <= 8) or value.endswith((".", ";")):
            return False
        return bool(re.search(
            r"\b(?:company|corporation|corp\.?|group|labs?|studio|services|systems?|"
            r"cooperative|association|agency|services|partners?|holdings?|limited|ltd\.?|inc\.?)\b",
            value,
            re.IGNORECASE,
        ))

    @classmethod
    def _company_first_header(cls, lines: List[str]) -> Optional[tuple[str, str]]:
        """Recognize `Company, Location <date>` followed by a short title line."""
        if len(lines) < 2:
            return None
        date = re.search(cls.DATE_RANGE_REGEX, lines[0], re.IGNORECASE)
        if not date:
            return None
        prefix = lines[0][:date.start()].strip(" ,|–—-")
        if not prefix or len(prefix.split()) > 10:
            return None
        title = lines[1].strip(" :|–—-")
        if not (1 <= len(title.split()) <= 7) or title.endswith(".") or any(char.isdigit() for char in title):
            return None
        company = prefix
        comma_parts = [part.strip() for part in prefix.split(",") if part.strip()]
        if len(comma_parts) >= 2 and any(
            re.fullmatch(re.escape(city), comma_parts[-1], re.IGNORECASE) for city in COMMON_CITIES
        ):
            company = ", ".join(comma_parts[:-1])
        return cls.clean_value(company), cls.clean_value(title)

    @classmethod
    def _structural_title_parts(cls, line: str) -> Optional[tuple[str, str]]:
        """Extract short title/company fields separated visually on one line."""
        match = re.match(r"^(.+?)\s*(?:\||\s+[–—-]\s+)\s*(.+?)\s*$", line)
        if not match:
            return None
        title = match.group(1).strip()
        company = re.split(r"[,|]", match.group(2), maxsplit=1)[0].strip()
        if not (1 <= len(title.split()) <= 8 and 1 <= len(company.split()) <= 8):
            return None
        if any(character.isdigit() for character in title) or title.endswith((".", ":")):
            return None
        return title, company
