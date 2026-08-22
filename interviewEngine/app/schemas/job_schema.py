from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

ShortText = Annotated[str, Field(max_length=500)]
LongText = Annotated[str, Field(max_length=10_000)]


class JobContext(BaseModel):
    """Permissive future-facing adapter; job context is optional in the MVP."""

    model_config = ConfigDict(extra="ignore")

    job_id: ShortText | None = None
    title: ShortText | None = None
    company: ShortText | None = None
    description: LongText | None = None
    required_skills: list[ShortText] = Field(default_factory=list, max_length=100)
    preferred_skills: list[ShortText] = Field(default_factory=list, max_length=100)
    experience_requirements: list[ShortText] = Field(default_factory=list, max_length=100)
    minimum_experience: ShortText | None = None
    required_education: list[ShortText] = Field(default_factory=list, max_length=50)
    language_requirements: list[ShortText] = Field(default_factory=list, max_length=50)
    location: ShortText | None = None
    work_mode: ShortText | None = None
    mandatory_requirements: list[ShortText] = Field(default_factory=list, max_length=100)
