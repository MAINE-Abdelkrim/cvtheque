from .text_normalizer import normalize_text


LOCATION_ALIASES = {"casa": "casablanca", "casablanca city": "casablanca"}
WORK_MODE_ALIASES = {
    "on site": "onsite", "on-site": "onsite", "onsite": "onsite",
    "hybrid": "hybrid", "remote": "remote", "flexible": "flexible",
}


def normalize_location(value: str | None) -> str:
    normalized = normalize_text(value or "")
    return LOCATION_ALIASES.get(normalized, normalized)


def normalize_work_mode(value: str | None) -> str:
    normalized = normalize_text(value or "")
    return WORK_MODE_ALIASES.get(normalized, normalized or "unspecified")

