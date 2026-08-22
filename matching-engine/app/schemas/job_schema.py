from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.constants import JOB_SCHEMA_VERSION


CRITERIA = {
    "required_skills", "experience", "education", "languages",
    "preferred_skills", "location_and_work_mode", "contract_type",
}


class TolerantModel(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class SkillRequirement(TolerantModel):
    name: str = Field(min_length=1)
    mandatory: bool = False


class EducationRequirement(TolerantModel):
    minimum_level: str
    preferred_fields: list[str] = Field(default_factory=list)
    mandatory: bool = False


class LanguageRequirement(TolerantModel):
    name: str
    minimum_level: str
    mandatory: bool = False


class MandatoryRequirement(TolerantModel):
    code: str
    description: str
    satisfied: bool | None = None


class ScoringWeights(BaseModel):
    model_config = ConfigDict(extra="forbid")
    required_skills: float = Field(default=0, ge=0)
    experience: float = Field(default=0, ge=0)
    education: float = Field(default=0, ge=0)
    languages: float = Field(default=0, ge=0)
    preferred_skills: float = Field(default=0, ge=0)
    location_and_work_mode: float = Field(default=0, ge=0)
    contract_type: float = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_total(self) -> "ScoringWeights":
        total = sum(getattr(self, key) for key in CRITERIA)
        if not (abs(total - 1.0) <= 1e-6 or abs(total - 100.0) <= 1e-6):
            raise ValueError("scoring weights must total 1.0 or 100")
        return self

    def percentages(self) -> dict[str, float]:
        values = {key: float(getattr(self, key)) for key in CRITERIA}
        return {key: value * 100 for key, value in values.items()} if sum(values.values()) <= 1.000001 else values


class JobProfile(TolerantModel):
    schema_version: str = JOB_SCHEMA_VERSION
    job_id: str | None = None
    job_title: str | None = None
    description: str | None = None
    required_skills: list[SkillRequirement] = Field(default_factory=list)
    preferred_skills: list[SkillRequirement] = Field(default_factory=list)
    minimum_experience_years: float | None = Field(default=None, ge=0)
    maximum_experience_years: float | None = Field(default=None, ge=0)
    required_education: EducationRequirement | None = None
    required_languages: list[LanguageRequirement] = Field(default_factory=list)
    location: str | None = None
    remote_allowed: bool = False
    work_mode: str | None = None
    contract_type: str | None = None
    mandatory_requirements: list[MandatoryRequirement] = Field(default_factory=list)
    scoring_weights: ScoringWeights | None = None

    @field_validator("required_skills", "preferred_skills", mode="before")
    @classmethod
    def normalize_skill_forms(cls, value: object) -> object:
        if value is None:
            return []
        if not isinstance(value, list):
            raise ValueError("must be a list")
        return [{"name": item} if isinstance(item, str) else item for item in value]

    @model_validator(mode="after")
    def validate_experience_range(self) -> "JobProfile":
        if (self.minimum_experience_years is not None and self.maximum_experience_years is not None
                and self.maximum_experience_years < self.minimum_experience_years):
            raise ValueError("maximum experience must be at least the minimum")
        return self

