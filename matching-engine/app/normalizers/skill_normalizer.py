from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from app.exceptions import MalformedAliasConfigurationError
from .text_normalizer import normalize_text


@dataclass(frozen=True)
class NormalizedSkill:
    original: str
    normalized: str
    canonical: str
    used_alias: bool


class SkillNormalizer:
    def __init__(self, config_path: Path | None = None) -> None:
        path = config_path or Path(__file__).resolve().parents[2] / "data" / "skill_aliases.json"
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            aliases = payload["aliases"]
            partials = payload.get("approved_partials", {})
            if not isinstance(aliases, dict) or not isinstance(partials, dict):
                raise TypeError
            self.aliases = {normalize_text(str(k)): normalize_text(str(v)) for k, v in aliases.items()}
            self.approved_partials = {
                normalize_text(str(k)): {normalize_text(str(item)) for item in values}
                for k, values in partials.items()
            }
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise MalformedAliasConfigurationError(f"Invalid skill alias configuration: {path}") from exc

    def normalize(self, skill: str) -> NormalizedSkill:
        normalized = normalize_text(skill)
        canonical = self.aliases.get(normalized, normalized)
        return NormalizedSkill(skill, normalized, canonical, canonical != normalized)

    def is_approved_partial(self, required: str, candidate: str) -> bool:
        return candidate in self.approved_partials.get(required, set())

