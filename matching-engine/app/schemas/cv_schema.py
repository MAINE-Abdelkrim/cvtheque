from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.constants import CV_SCHEMA_VERSION


class TolerantModel(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class ExperienceEntry(TolerantModel):
    job_title: str | None = None
    company: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_current: bool = False
    duration_months: int | None = Field(default=None, ge=0)
    description: str | None = None
    skills: list[str] = Field(default_factory=list)

    @field_validator("start_date", "end_date")
    @classmethod
    def valid_month(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            date.fromisoformat(value if len(value) > 7 else f"{value}-01")
        except ValueError as exc:
            raise ValueError("must be YYYY-MM or YYYY-MM-DD") from exc
        return value


class EducationEntry(TolerantModel):
    degree: str
    field: str | None = None
    institution: str | None = None
    graduation_year: int | None = Field(default=None, ge=1900, le=2200)


class LanguageEntry(TolerantModel):
    name: str
    level: str | None = None


class CertificationEntry(TolerantModel):
    name: str
    issuer: str | None = None
    year: int | None = Field(default=None, ge=1900, le=2200)


class CVProfile(TolerantModel):
    schema_version: str = CV_SCHEMA_VERSION
    candidate_id: str | None = None
    full_name: str | None = None
    summary: str | None = None
    skills: list[str] = Field(default_factory=list)
    experiences: list[ExperienceEntry] = Field(default_factory=list)
    total_experience_years: float | None = Field(default=None, ge=0)
    education: list[EducationEntry] = Field(default_factory=list)
    languages: list[LanguageEntry] = Field(default_factory=list)
    certifications: list[CertificationEntry | str] = Field(default_factory=list)
    location: str | None = None
    preferred_work_mode: str | None = None
    preferred_contract_types: list[str] = Field(default_factory=list)

    @field_validator("skills", "preferred_contract_types")
    @classmethod
    def no_blank_items(cls, values: list[str]) -> list[str]:
        if any(not value.strip() for value in values):
            raise ValueError("items must not be blank")
        return values

