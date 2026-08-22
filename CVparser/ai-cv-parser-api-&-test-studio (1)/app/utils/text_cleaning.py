"""
Text cleaning and normalization utilities for CV preprocessing and section header normalization.
"""

import re
import unicodedata
from typing import Tuple


def remove_accents_and_lowercase(text: str) -> str:
    """
    Remove accents, diacritics and convert to lowercase for robust string matching.
    Example: "Éducation & Formations" -> "education & formations"
    """
    if not text:
        return ""
    # Normalize unicode to NFD and strip combining characters
    nfkd_form = unicodedata.normalize("NFD", text)
    only_ascii = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
    return only_ascii.lower().strip()


def clean_whitespace(text: str) -> str:
    """
    Normalize irregular spaces, tabs, zero-width spaces, while retaining line structure.
    """
    if not text:
        return ""
    # Replace non-breaking spaces and special whitespace characters
    text = text.replace("\xa0", " ").replace("\u200b", "").replace("\r\n", "\n").replace("\r", "\n")
    # Replace multiple horizontal spaces/tabs with single space on each line
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    return "\n".join(lines)


def normalize_line_breaks(text: str) -> str:
    """
    Collapse 3 or more consecutive empty lines into at most 2 line breaks.
    """
    if not text:
        return ""
    return re.sub(r"\n{3,}", "\n\n", text)


_INTENTIONAL_COMPOUNDS = {
    "back-end",
    "front-end",
    "full-stack",
    "machine-learning",
    "client-server",
    "e-mail",
}


def dehyphenate_pdf_line_wraps(text: str) -> str:
    """Join lowercase words split by a PDF line-wrap hyphen.

    Newlines are direct layout evidence. A horizontal-space form is accepted only
    for sufficiently substantial lowercase fragments and excludes common intentional
    compounds; punctuation dashes, dates, bullets, and mixed-case tokens are ignored.
    """
    if not text:
        return ""

    pattern = re.compile(
        r"(?P<left>[A-Za-zÀ-ÖØ-öø-ÿ]{2,}[a-zà-öø-ÿ])-(?P<break>\n|[ \t]+)(?P<right>[a-zà-öø-ÿ]{4,})"
    )

    def join_wrapped_word(match: re.Match[str]) -> str:
        compound = f"{match.group('left')}-{match.group('right')}".lower()
        if compound in _INTENTIONAL_COMPOUNDS:
            return match.group(0)
        return match.group("left") + match.group("right")

    return pattern.sub(join_wrapped_word, text)


def strip_bullet_points_and_symbols(text: str) -> str:
    """
    Remove bullet points, icons, emojis, and leading symbols or section numbers from lines or headers.
    Examples: "• Expérience" -> "Expérience", "► 1. COMPÉTENCES :" -> "COMPÉTENCES"
    """
    if not text:
        return ""
    lines = []
    for line in text.split("\n"):
        cleaned_line = line.strip()
        # Remove leading bullet symbols / icons
        cleaned_line = re.sub(r"^[\s\t]*[•\-\*▪►✓✔✦★■✦\u2022\u2013\u2014>]+\s*", "", cleaned_line)
        # Remove leading numbering like 1., 2., 1.1, etc.
        cleaned_line = re.sub(r"^\s*(?:\d+[\.\)\-]\s*)+", "", cleaned_line)
        # Remove remaining leading symbols if any left after number removal
        cleaned_line = re.sub(r"^[\s\t]*[•\-\*▪►✓✔✦★■✦\u2022\u2013\u2014>]+\s*", "", cleaned_line)
        # Remove trailing colon if present at line end
        cleaned_line = re.sub(r"\s*:\s*$", "", cleaned_line)
        lines.append(cleaned_line.strip())
    return "\n".join(lines)


def normalize_header_title(header: str) -> str:
    """
    Clean and canonicalize section header titles for section classification.
    Strips bullets, symbols, accents, punctuation, and converts to uppercase ASCII.
    Example: "★ 1. Expériences Professionnelles :" -> "EXPERIENCES PROFESSIONNELLES"
    """
    if not header:
        return ""
    # First strip bullet symbols
    cleaned = strip_bullet_points_and_symbols(header)
    # Remove remaining non-alphanumeric chars except space
    cleaned = re.sub(r"[^\w\s]", " ", cleaned)
    # Convert accents to ascii uppercase
    normalized = remove_accents_and_lowercase(cleaned).upper()
    # Clean whitespace
    return re.sub(r"\s+", " ", normalized).strip()


def clean_raw_resume_text(text: str) -> Tuple[str, str]:
    """
    Takes raw extracted text and returns a tuple (original_text, cleaned_text).
    The cleaned_text has normalized whitespace, line breaks, and sanitized characters.
    """
    if not text:
        return "", ""
    original_text = text
    cleaned = dehyphenate_pdf_line_wraps(text)
    cleaned = clean_whitespace(cleaned)
    cleaned = normalize_line_breaks(cleaned)
    return original_text, cleaned
