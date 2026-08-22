"""
Deterministic extractor for candidate identity, contact details, and location.
"""

import re
from typing import Dict, Optional, List
from app.core.constants import COMMON_CITIES, SECTION_HEADER_ALIASES
from app.extractors.base_extractor import BaseExtractor
from app.models.cv_models import Identity
from app.utils.text_cleaning import normalize_header_title
from app.utils.list_utils import unique_preserve_order


class IdentityExtractor(BaseExtractor):
    """Extracts email, phone, LinkedIn, GitHub, website, location, job title, and full name."""

    # Common job titles pattern for candidate title matching
    COMMON_JOB_TITLES = [
        r"développeur(\s+\w+)*",
        r"developer(\s+\w+)*",
        r"software\s+engineer",
        r"ingénieur(\s+\w+)*",
        r"(?:future\s+)?ingénieure?(\s+\w+)*",
        r"engineer(\s+\w+)*",
        r"data\s+scientist",
        r"data\s+analyst",
        r"data\s+engineer",
        r"architecte(\s+\w+)*",
        r"chef\s+de\s+projet",
        r"project\s+manager",
        r"scrum\s+master",
        r"product\s+owner",
        r"comptable",
        r"financial\s+analyst",
        r"analyste\s+financier",
        r"consultant(\s+\w+)*",
        r"administrateur(\s+\w+)*",
        r"devops(\s+engineer)?",
        r"full\s*stack(\s+developer)?",
        r"backend(\s+developer)?",
        r"frontend(\s+developer)?",
        r"stagiaire",
        r"intern",
    ]

    @classmethod
    def extract(
        cls,
        cleaned_text: str,
        sections: Optional[Dict[str, str]] = None
    ) -> Identity:
        """Extract identity fields deterministically from cleaned_text and sections."""
        header_text = ""
        if sections and "HEADER" in sections:
            header_text = sections["HEADER"]
        
        # Combine without duplicating HEADER lines already present at the top of cleaned text.
        header_lines = cls.split_non_empty_lines(header_text)
        top_lines = cls.split_non_empty_lines(cleaned_text)[:15]
        identity_lines = unique_preserve_order(header_lines + top_lines)[:15]
        identity_lines = cls._merge_spaced_capital_name(identity_lines)
        search_text = "\n".join(identity_lines)

        # Contact blocks may live in a sidebar after the visual header.
        email = cls._extract_email(cleaned_text)
        phone = cls._extract_phone(cleaned_text)
        linkedin = cls._extract_linkedin(search_text or cleaned_text)
        github = cls._extract_github(search_text or cleaned_text)
        website = cls._extract_website(search_text or cleaned_text, linkedin, github)
        job_title = cls._extract_job_title(search_text)
        # When a geometry-owned HEADER exists, never search later section prose
        # for a name. A conservative null is safer than promoting a sentence.
        name_source = header_text or search_text
        full_name = cls._extract_full_name(name_source, email, phone, linkedin, github, website, job_title)
        if sections and header_lines and len(header_lines) == 1 and not job_title:
            header_candidate = cls.clean_value(header_lines[0]) or ""
            experience_text = sections.get("EXPERIENCES", "")
            if (
                header_candidate
                and 1 <= len(header_candidate.split()) <= 6
                and not header_candidate.endswith(".")
                and re.search(r"(?im)^" + re.escape(header_candidate) + r"(?:\s*[|–—:-]|\s*$)", experience_text)
            ):
                job_title = header_candidate
                full_name = None
        contact_text = sections.get("CONTACT", "") if sections else ""
        # An explicit CONTACT section is authoritative for residence. Falling
        # through to later flattened sections can incorrectly promote a school
        # or employer city to the candidate's current location.
        location_source = contact_text if sections and "CONTACT" in sections else search_text
        location = cls._extract_location(location_source)

        other_links = []
        if website:
            other_links.append(website)

        return Identity(
            full_name=full_name,
            email=email,
            phone=phone,
            linkedin=linkedin,
            github=github,
            website=website,
            location=location,
            job_title=job_title,
            other_links=other_links,
        )

    @staticmethod
    def _merge_spaced_capital_name(lines: List[str]) -> List[str]:
        """Collapse two leading display-name lines made of spaced capitals."""
        if len(lines) < 2:
            return lines

        def collapse(value: str) -> Optional[str]:
            tokens = value.split()
            if len(tokens) < 2 or not all(len(token) == 1 and token.isalpha() and token.isupper() for token in tokens):
                return None
            return "".join(tokens).title()

        first = collapse(lines[0])
        second = collapse(lines[1])
        if first and second:
            return [f"{first} {second}", *lines[2:]]
        return lines

    @classmethod
    def _extract_email(cls, text: str) -> Optional[str]:
        pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
        match = re.search(pattern, text)
        if match:
            raw_email = match.group(0)
            return raw_email.rstrip(".,;:)")
        return None

    @classmethod
    def _extract_phone(cls, text: str) -> Optional[str]:
        # Support Moroccan (+212 6/7/5..., 06/07/05..., (06)...), French (+33...), international
        patterns = [
            r"(\+212|00212)[\s.-]?[5-7][\s.-]?(\d[\s.-]?){8}\b",
            r"\(?0[5-7]\)?[\s.-]?(\d[\s.-]?){8}\b",
            r"(\+33|0033)[\s.-]?[1-9][\s.-]?(\d[\s.-]?){8}\b",
            r"\b\+\d{1,3}[\s.-]?\(?\d{1,4}\)?([\s.-]?\d{2,4}){2,4}\b",
        ]
        for pat in patterns:
            match = re.search(pat, text)
            if match:
                phone_str = match.group(0).strip(".,;: \t\r\n")
                # Clean multiple internal spaces
                phone_str = re.sub(r"\s+", " ", phone_str)
                return phone_str
        return None

    @classmethod
    def _extract_linkedin(cls, text: str) -> Optional[str]:
        pattern = r"(https?://)?(www\.)?linkedin\.com/in/[a-zA-Z0-9%_-]+/?(?=\s|$|[.,;)])"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            url = match.group(0).rstrip(".,;/)")
            if not url.startswith("http"):
                url = "https://" + url.lstrip("/")
            return url
        return None

    @classmethod
    def _extract_github(cls, text: str) -> Optional[str]:
        pattern = r"(https?://)?(www\.)?github\.com/[a-zA-Z0-9%_-]+/?(?=\s|$|[.,;)])"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            url = match.group(0).rstrip(".,;/)")
            if not url.startswith("http"):
                url = "https://" + url.lstrip("/")
            return url
        return None

    @classmethod
    def _extract_website(
        cls, text: str, linkedin: Optional[str], github: Optional[str]
    ) -> Optional[str]:
        pattern = r"(https?://)?(www\.)?[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+(/[a-zA-Z0-9_.~%+-]*)*/?"
        for match in re.finditer(pattern, text, re.IGNORECASE):
            url = match.group(0).rstrip(".,;)")
            url_lower = url.lower()
            if "linkedin.com" in url_lower or "github.com" in url_lower:
                continue
            if not url_lower.startswith(("http://", "https://", "www.")) and url_lower.endswith(".js"):
                continue
            if not url_lower.startswith(("http://", "https://", "www.")):
                common_tlds = {"com", "org", "net", "io", "dev", "fr", "ma", "co", "edu", "me", "ai"}
                if url_lower.rsplit(".", 1)[-1] not in common_tlds:
                    continue
            # Avoid matching email domain part
            if "@" in text[max(0, match.start() - 20):match.end()]:
                continue
            if not url.startswith("http"):
                url = "https://" + url.lstrip("/")
            return url
        return None

    REJECT_TITLE_KEYWORDS = [
        r"\bexpérimenté", r"\bexpérimentée", r"\bspécialisé", r"\bspécialisée",
        r"\bavec\b", r"\bpassionné", r"\bpassionnée", r"\bexpert\b", r"\bprofessionnel",
        r"\bayant\b", r"\borienté", r"\bexpérience", r"\bannées", r"\bresults?\b"
    ]

    @classmethod
    def _extract_job_title(cls, text: str) -> Optional[str]:
        lines = cls.split_non_empty_lines(text)[:10]
        section_headings = cls._normalized_section_headings()
        for index, line in enumerate(lines):
            line_clean = cls.clean_value(line)
            if not line_clean:
                continue

            candidates = [line_clean]
            if cls._contains_job_title_pattern(line_clean) and index + 1 < len(lines):
                next_line = cls.clean_value(lines[index + 1])
                if (
                    next_line
                    and "@" not in next_line
                    and "http" not in next_line.lower()
                    and normalize_header_title(next_line) not in section_headings
                ):
                    candidates.insert(0, f"{line_clean} {next_line}")

            for candidate in candidates:
                if cls._is_job_title_candidate(candidate):
                    return candidate
        # OCR templates and international CVs may use a legitimate title outside
        # the finite taxonomy.  Only accept the short line immediately following
        # a plausible name-like header, never labels, contacts, or prose.
        if len(lines) >= 2:
            first = cls.clean_value(lines[0]) or ""
            candidate = cls.clean_value(lines[1]) or ""
            headings = cls._normalized_section_headings()
            if (
                2 <= len(first.split()) <= 5
                and 1 <= len(candidate.split()) <= 6
                and all(character.isalpha() or character in " '-" for character in candidate)
                and not candidate.endswith(".")
                and normalize_header_title(candidate) not in headings
                and normalize_header_title(candidate) not in {"EMAIL", "TELEPHONE", "PHONE", "ADRESSE", "ADDRESS"}
            ):
                return candidate
        return None

    @classmethod
    def _is_job_title_candidate(cls, line_clean: str) -> bool:
        """Return whether a short line is a plausible professional title."""

        if line_clean.endswith("."):
            return False

        words = line_clean.split()
        if not (1 <= len(words) <= 12):
            return False

        if any(re.search(kw, line_clean, re.IGNORECASE) for kw in cls.REJECT_TITLE_KEYWORDS):
            return False

        return cls._contains_job_title_pattern(line_clean)

    @classmethod
    def _contains_job_title_pattern(cls, value: str) -> bool:
        return any(
            re.search(r"\b" + pattern + r"\b", value, re.IGNORECASE)
            for pattern in cls.COMMON_JOB_TITLES
        )

    @classmethod
    def _normalized_section_headings(cls) -> set[str]:
        return {
            normalize_header_title(alias)
            for aliases in SECTION_HEADER_ALIASES.values()
            for alias in aliases
        }

    @classmethod
    def _extract_full_name(
        cls,
        text: str,
        email: Optional[str],
        phone: Optional[str],
        linkedin: Optional[str],
        github: Optional[str],
        website: Optional[str],
        job_title: Optional[str],
    ) -> Optional[str]:
        lines = cls.split_non_empty_lines(text)[:10]
        excluded = {"cv", "curriculum", "vitae", "resume", "contact"}
        section_headings = cls._normalized_section_headings()

        for line in lines:
            line_clean = cls.clean_value(line)
            if not line_clean:
                continue

            # Skip if contains contact elements
            if email and email.lower() in line_clean.lower():
                continue
            if phone and phone in line_clean:
                continue
            if "@" in line_clean or "http" in line_clean.lower() or "www." in line_clean.lower():
                continue
            if linkedin and "linkedin" in line_clean.lower():
                continue
            if github and "github" in line_clean.lower():
                continue

            # Skip if matches section headers or excluded words
            if line_clean.lower() in excluded or normalize_header_title(line_clean) in section_headings:
                continue

            # Skip if line is equal or very close to job_title
            if job_title and line_clean.lower() == job_title.lower():
                continue
            if any(re.search(r"\b" + pat + r"\b", line_clean, re.IGNORECASE) for pat in cls.COMMON_JOB_TITLES):
                continue

            # Candidate checks
            words = line_clean.split()
            if 1 <= len(words) <= 5:
                # Check character ratio (majority letters)
                letters_count = sum(c.isalpha() or c in " '-" for c in line_clean)
                if letters_count / len(line_clean) >= 0.8:
                    # Check that words don't contain digits
                    if not any(char.isdigit() for char in line_clean):
                        return line_clean.title()

        return None

    @classmethod
    def _extract_location(cls, text: str) -> Optional[str]:
        lines = cls.split_non_empty_lines(text)[:10]
        for line in lines:
            line_clean = cls.clean_value(line)
            if not line_clean:
                continue
            # Search for city match
            for city in COMMON_CITIES:
                pattern = r"\b" + re.escape(city) + r"(?:\s*,\s*[A-Za-zÀ-ÿ]+(?:[ '-][A-Za-zÀ-ÿ]+)*)?\b"
                match = re.search(pattern, line_clean, re.IGNORECASE)
                if match:
                    # Return full matched line if short, e.g. "Casablanca, Maroc"
                    words = line_clean.split()
                    if (
                        len(words) <= 5
                        and line_clean[:1].isalnum()
                        and not any(c.isdigit() for c in line_clean if c not in "+")
                    ):
                        return line_clean
                    return match.group(0).strip()
        return None
