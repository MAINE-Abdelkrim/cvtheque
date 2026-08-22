from app.normalizers.experience_normalizer import calculate_experience_years
from app.schemas.cv_schema import CVProfile
from .base import ScoreOutcome, inactive


def score_experience(cv: CVProfile, required_years: float | None) -> ScoreOutcome:
    if required_years is None:
        return inactive("No minimum experience was specified.")
    warnings: list[str] = []
    years = cv.total_experience_years
    if years is None:
        years, warnings = calculate_experience_years(cv.experiences)
    if required_years == 0:
        score = 100.0
    elif years is None:
        score = 0.0
        warnings.append("Candidate total experience could not be determined.")
    else:
        score = min(years / required_years * 100, 100.0)
    shown = "unknown" if years is None else f"{years:g}"
    return ScoreOutcome(score, True, explanation=f"Candidate experience is {shown} years; {required_years:g} years were required.", warnings=warnings, details={"candidate_years": years, "required_years": required_years})

