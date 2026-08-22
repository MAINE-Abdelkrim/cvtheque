from .text_normalizer import normalize_text


ALIASES = {
    "cdi": "permanent", "permanent": "permanent", "full time permanent": "permanent",
    "cdd": "fixed-term", "fixed term": "fixed-term", "fixed-term": "fixed-term",
    "stage": "internship", "internship": "internship",
    "freelance": "contractor", "contractor": "contractor",
    "temporary": "temporary", "part time": "part-time", "part-time": "part-time",
    "full time": "full-time", "full-time": "full-time",
}


def normalize_contract(value: str) -> str:
    normalized = normalize_text(value)
    return ALIASES.get(normalized, normalized)

