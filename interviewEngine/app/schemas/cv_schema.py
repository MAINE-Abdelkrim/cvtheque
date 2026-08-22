from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

ShortText = Annotated[str, Field(max_length=256)]
LongText = Annotated[str, Field(max_length=10_000)]


class CVIdentity(BaseModel):
    model_config = ConfigDict(extra="ignore")

    full_name: ShortText | None = None
    location: ShortText | None = None
    job_title: ShortText | None = None


class CVSkill(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: ShortText = ""
    category: ShortText | None = None
    source: ShortText | None = None


class CVExperience(BaseModel):
    model_config = ConfigDict(extra="ignore")

    job_title: ShortText | None = None
    company: ShortText | None = None
    location: ShortText | None = None
    start_date: ShortText | None = None
    end_date: ShortText | None = None
    description: LongText | None = None


class CVEducation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    degree: ShortText | None = None
    field_of_study: ShortText | None = None
    institution: ShortText | None = None
    location: ShortText | None = None
    start_date: ShortText | None = None
    end_date: ShortText | None = None
    description: LongText | None = None


class CVLanguage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    language: ShortText | None = None
    level: ShortText | None = None
    original_level: ShortText | None = None


class Certification(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: ShortText | None = None
    issuer: ShortText | None = None
    date: ShortText | None = None


class CanonicalCV(BaseModel):
    """Boundary adapter for canonical CV data; unknown parser fields are ignored."""

    model_config = ConfigDict(extra="ignore")

    identity: CVIdentity = Field(default_factory=CVIdentity)
    summary: LongText | None = None
    skills: list[CVSkill] = Field(default_factory=list, max_length=100)
    experiences: list[CVExperience] = Field(default_factory=list, max_length=100)
    education: list[CVEducation] = Field(default_factory=list, max_length=50)
    languages: list[CVLanguage] = Field(default_factory=list, max_length=50)
    certifications: list[Certification] = Field(default_factory=list, max_length=100)
