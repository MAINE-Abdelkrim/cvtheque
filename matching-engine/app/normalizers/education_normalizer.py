import json
from pathlib import Path

from .text_normalizer import normalize_text


class EducationNormalizer:
    def __init__(self, path: Path | None = None) -> None:
        source = path or Path(__file__).resolve().parents[2] / "data" / "education_levels.json"
        self.levels: dict[str, int] = json.loads(source.read_text(encoding="utf-8"))

    def level(self, value: str | None) -> int:
        return self.levels.get(normalize_text(value or ""), 0)

    def field(self, value: str | None) -> str:
        return normalize_text(value or "")

