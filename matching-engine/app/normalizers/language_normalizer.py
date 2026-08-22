import json
from pathlib import Path

from .text_normalizer import normalize_text


LANGUAGE_ALIASES = {
    "francais": "french", "french": "french", "anglais": "english", "english": "english",
    "arabe": "arabic", "arabic": "arabic", "espagnol": "spanish", "spanish": "spanish",
    "allemand": "german", "german": "german",
}


class LanguageNormalizer:
    def __init__(self, path: Path | None = None) -> None:
        source = path or Path(__file__).resolve().parents[2] / "data" / "language_levels.json"
        self.levels: dict[str, int] = json.loads(source.read_text(encoding="utf-8"))

    def name(self, value: str) -> str:
        normalized = normalize_text(value)
        return LANGUAGE_ALIASES.get(normalized, normalized)

    def level(self, value: str | None) -> int:
        return self.levels.get(normalize_text(value or ""), 0)

