"""
Deterministic extractor for professional certifications and accreditations.
"""

import re
from typing import Dict, List, Optional
from app.extractors.base_extractor import BaseExtractor
from app.models.cv_models import Certification


class CertificationsExtractor(BaseExtractor):
    """Extracts professional certifications, issuing organizations, dates, and credential IDs."""

    KNOWN_ISSUERS = [
        "AWS", "Amazon", "Microsoft", "Azure", "Google", "Cisco", "Scrum.org",
        "PMI", "Oracle", "Red Hat", "HashiCorp", "Databricks", "Salesforce",
        "ETS", "British Council"
    ]

    @classmethod
    def extract(
        cls,
        sections: Optional[Dict[str, str]] = None,
        cleaned_text: str = ""
    ) -> List[Certification]:
        """Extract certification records from CERTIFICATIONS section or fallback text."""
        sections = sections or {}
        text = sections.get("CERTIFICATIONS", "")

        if not text and cleaned_text:
            text = cls._find_certifications_in_text(cleaned_text)

        if not text:
            return []

        entries = cls._segment_entries(text)
        results: List[Certification] = []

        for entry in entries:
            line_clean = cls.clean_value(entry)
            if not line_clean or not re.search(r"[A-Za-zÀ-ÿ]", line_clean):
                continue

            # Extract date (e.g. 2024, 05/2023, 2022-2025)
            date_match = re.search(r"\b(20\d{2}|19\d{2}|(0[1-9]|1[0-2])/(20\d{2}))\b", line_clean)
            date = date_match.group(0) if date_match else None

            # Extract credential ID if present (e.g. ID: 12345, Credential ID #9876)
            cred_match = re.search(r"(?i)\b(?:credential\s+id|id|n[°º]|numéro)\s*[:#]?\s*([a-zA-Z0-9-]+)\b", line_clean)
            credential_id = cred_match.group(1) if cred_match else None

            # Parse a structurally separated issuer, keeping internal title hyphens.
            issuer = None

            # Clean name by removing date and credential id if they were part of line
            name = line_clean
            if date:
                name = re.sub(r"\b" + re.escape(date) + r"\b", "", name)
            if cred_match:
                name = re.sub(re.escape(cred_match.group(0)), "", name, flags=re.IGNORECASE)

            pipe_parts = [part.strip() for part in name.split("|") if part.strip()]
            if len(pipe_parts) == 2:
                name, issuer = pipe_parts
                issuer_split = None
            else:
                issuer_split = re.match(r"^(.+?)\s+(?:–|—)\s+([^|]+?)$", name)
            if not issuer and not issuer_split:
                issuer_split = re.match(r"^(.+?)\s+\|\s+([^|]+?)$", name)
            if not issuer and not issuer_split:
                comma_split = re.match(r"^(.+?),\s+([^,]+?)$", name)
                if comma_split and cls._looks_like_issuer(comma_split.group(2)):
                    issuer_split = comma_split
            if issuer_split and not re.fullmatch(r"[()\s]*(?:19|20)\d{2}[()\s]*", issuer_split.group(2)):
                name = issuer_split.group(1)
                issuer = issuer_split.group(2)
            elif not issuer:
                for known_issuer in cls.KNOWN_ISSUERS:
                    if re.search(r"\b" + re.escape(known_issuer) + r"\b", name, re.IGNORECASE):
                        issuer = known_issuer
                        break

            name = name.strip()
            name = re.sub(r"[\s\-–—|:;,•·.]+$", "", name).strip()
            name = re.sub(r"^[\s\-–—|:;,•·.]+", "", name).strip()
            name = cls.clean_value(name)
            if name:
                results.append(
                    Certification(
                        name=name,
                        issuer=cls.clean_value(issuer),
                        date=cls.clean_value(date),
                        credential_id=cls.clean_value(credential_id)
                    )
                )

        return results

    @classmethod
    def _segment_entries(cls, text: str) -> List[str]:
        """Respect standalone visual pipes and join wrapped lines within each entry."""
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if any(re.fullmatch(r"\|+", line) for line in lines):
            entries: List[str] = []
            current: List[str] = []
            for line in lines:
                if re.fullmatch(r"\|+", line):
                    if current:
                        entries.append(" ".join(current))
                        current = []
                else:
                    current.append(line)
            if current:
                entries.append(" ".join(current))
            return entries
        entries = [
            line for line in cls.split_non_empty_lines(text)
            if re.search(r"[A-Za-zÀ-ÿ]", line) or re.fullmatch(r"(?:19|20)\d{2}", line)
        ]
        # A narrow column may wrap the title immediately before a structurally
        # separated issuer/date line. Join only that strong two-line pattern;
        # ordinary one-certification-per-line lists remain untouched.
        joined: List[str] = []
        pending: List[str] = []
        for line in entries:
            has_separator = bool(re.search(r"\s(?:\||–|—)\s", line))
            has_date = bool(re.search(r"\b(?:19|20)\d{2}\b", line))
            issuer_line = cls._looks_like_issuer(re.sub(r"\b(?:19|20)\d{2}\b", "", line).strip())
            terminal = has_separator or has_date
            if terminal:
                if pending:
                    if issuer_line and has_date and not has_separator:
                        joined.append(f"{' '.join(pending[-2:])} | {line}")
                    elif re.fullmatch(r"(?:19|20)\d{2}", line) and cls._looks_like_issuer(pending[-1]):
                        title_parts = pending[-3:-1] or pending[:-1]
                        joined.append(f"{' '.join(title_parts)} | {pending[-1]} {line}")
                    else:
                        joined.append(" ".join([*pending[-2:], line]))
                    for orphan in pending[:-3 if re.fullmatch(r"(?:19|20)\d{2}", line) and cls._looks_like_issuer(pending[-1]) else -2]:
                        joined.append(orphan)
                    pending = []
                else:
                    joined.append(line)
            elif line[:1].islower() and pending:
                pending[-1] = f"{pending[-1]} {line}"
            else:
                pending.append(line)
        if len(pending) >= 2 and cls._looks_like_issuer(pending[-1]):
            joined.extend(pending[:-2])
            joined.append(f"{pending[-2]} | {pending[-1]}")
        else:
            joined.extend(pending)
        return joined

    @classmethod
    def _looks_like_issuer(cls, value: str) -> bool:
        value = value.strip()
        if any(re.search(r"\b" + re.escape(issuer) + r"\b", value, re.I) for issuer in cls.KNOWN_ISSUERS):
            return True
        return bool(re.search(r"\b(university|université|institute|institut|college|academy|coursera|edx)\b", value, re.I))

    @classmethod
    def _find_certifications_in_text(cls, cleaned_text: str) -> str:
        cert_keywords = ["certified", "certification", "certificat", "aws", "azure", "toeic", "ielts", "scrum", "psm", "ccna"]
        matched_lines = []
        for line in cls.split_non_empty_lines(cleaned_text):
            line_lower = line.lower()
            if any(kw in line_lower for kw in cert_keywords):
                matched_lines.append(line)
        return "\n".join(matched_lines)
