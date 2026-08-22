import re

_EMAIL = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_PHONE = re.compile(r"(?<!\w)(?:\+?\d[\d\s().-]{6,}\d)(?!\w)")
_URL = re.compile(r"(?:https?://|www\.)\S+", re.IGNORECASE)


def safe_professional_value(value: str | None, *, max_length: int = 100) -> str | None:
    if not value:
        return None
    cleaned = " ".join(value.split()).strip()
    if not cleaned or _EMAIL.search(cleaned) or _PHONE.search(cleaned) or _URL.search(cleaned):
        return None
    return cleaned[:max_length]
