from app.config.scoring_config import ScoringConfig
from app.normalizers.location_normalizer import normalize_location, normalize_work_mode
from .base import ScoreOutcome, inactive


def score_location(candidate_location: str | None, candidate_mode: str | None, job_location: str | None, job_mode: str | None, remote_allowed: bool, config: ScoringConfig) -> ScoreOutcome:
    if not job_location and not job_mode and not remote_allowed:
        return inactive("No location or work-mode requirement was specified.")
    if not candidate_location and not candidate_mode:
        return ScoreOutcome(config.neutral_information_score, True, explanation="Candidate location and work-mode preference were not provided; a neutral score was used.", warnings=["Location compatibility could not be fully assessed."])
    location_match = bool(candidate_location and job_location and normalize_location(candidate_location) == normalize_location(job_location))
    candidate_work, job_work = normalize_work_mode(candidate_mode), normalize_work_mode(job_mode)
    mode_match = candidate_work == job_work or candidate_work == "flexible" or remote_allowed and candidate_work == "remote"
    if remote_allowed and candidate_work == "remote":
        score = 100.0
    elif job_location and job_mode:
        score = (50 if location_match else 0) + (50 if mode_match else 0)
    elif job_location:
        score = 100.0 if location_match else config.neutral_information_score
    else:
        score = 100.0 if mode_match else 0.0
    return ScoreOutcome(score, True, matched=[item for item, ok in [(job_location or "", location_match), (job_mode or "", mode_match)] if item and ok], explanation=f"Location match: {location_match}; work-mode match: {mode_match}.", details={"location_match": location_match, "work_mode_match": mode_match, "remote_allowed": remote_allowed})

