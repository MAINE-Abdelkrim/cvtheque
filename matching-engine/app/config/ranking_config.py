from dataclasses import dataclass


@dataclass(frozen=True)
class RankingConfig:
    """Immutable service and presentation limits for ranking V1."""

    version: str = "1.0.0"
    default_top_k: int = 3
    maximum_top_k: int = 100
    maximum_candidates: int = 5_000
    single_match_max_request_bytes: int = 1_048_576
    ranking_max_request_bytes: int = 20 * 1_048_576


DEFAULT_RANKING_CONFIG = RankingConfig()
