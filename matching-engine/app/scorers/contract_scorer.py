from app.config.scoring_config import ScoringConfig
from app.normalizers.contract_normalizer import normalize_contract
from .base import ScoreOutcome, inactive


def score_contract(preferences: list[str], required: str | None, config: ScoringConfig) -> ScoreOutcome:
    if not required:
        return inactive("No contract requirement was specified.")
    if not preferences:
        return ScoreOutcome(config.neutral_information_score, True, explanation="Candidate contract preferences were not provided; a neutral score was used.", warnings=["Contract compatibility could not be fully assessed."])
    matched = any(normalize_contract(item) == normalize_contract(required) for item in preferences)
    return ScoreOutcome(100.0 if matched else 0.0, True, matched=[required] if matched else [], missing=[] if matched else [required], explanation=f"Contract preference {'matched' if matched else 'did not match'} '{required}'.")

