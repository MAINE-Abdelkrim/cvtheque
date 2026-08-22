from functools import lru_cache
from secrets import compare_digest

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "AI Interview Engine"
    app_env: str = "development"
    log_level: str = "INFO"
    interview_repository: str = "in_memory"
    interview_firestore_collection: str = Field(
        default="interviewSessions", min_length=1, max_length=128
    )
    interview_firebase_project_id: str | None = Field(
        default=None, min_length=1, max_length=256
    )
    interview_firebase_credentials_file: str | None = Field(
        default=None, min_length=1, max_length=2_048
    )
    interview_internal_auth_enabled: bool = False
    interview_internal_api_token: SecretStr | None = None
    interview_internal_api_token_previous: SecretStr | None = None
    interview_owner_header: str = Field(
        default="X-Interview-Owner-Id", min_length=1, max_length=128
    )
    interview_allowed_hosts: str = ""
    interview_max_request_bytes: int = Field(default=1_048_576, ge=1, le=10_485_760)
    interview_provider: str = "mock"
    interview_provider_timeout_seconds: float = Field(default=20.0, gt=0, le=300)
    interview_provider_max_retries: int = Field(default=1, ge=0, le=5)
    interview_provider_retry_delay_seconds: float = Field(default=0.0, ge=0, le=10)
    interview_provider_fallback_enabled: bool = True
    gemini_api_key: SecretStr | None = None
    gemini_model: str = Field(default="gemini-2.5-flash", min_length=1, max_length=128)
    gemini_temperature: float = Field(default=0.2, ge=0, le=2)
    gemini_max_output_tokens: int = Field(default=2_048, ge=256, le=8_192)

    @field_validator("interview_owner_header")
    @classmethod
    def validate_owner_header(cls, value: str) -> str:
        stripped = value.strip()
        allowed = frozenset(
            "!#$%&'*+-.^_`|~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
        )
        if not stripped or any(character not in allowed for character in stripped):
            raise ValueError("Interview owner header is invalid")
        return stripped

    @field_validator("interview_allowed_hosts")
    @classmethod
    def validate_allowed_hosts(cls, value: str) -> str:
        hosts = [host.strip() for host in value.split(",") if host.strip()]
        for host in hosts:
            if (
                host == "*"
                or "/" in host
                or "\\" in host
                or any(character.isspace() for character in host)
                or ("*" in host and (not host.startswith("*.") or host.count("*") != 1))
            ):
                raise ValueError("Interview allowed hosts configuration is invalid")
        return ",".join(hosts)

    @property
    def parsed_interview_allowed_hosts(self) -> list[str]:
        return self.interview_allowed_hosts.split(",") if self.interview_allowed_hosts else []

    @field_validator("interview_internal_api_token_previous")
    @classmethod
    def normalize_blank_previous_token(
        cls, value: SecretStr | None
    ) -> SecretStr | None:
        if value is None or not value.get_secret_value().strip():
            return None
        return value

    @model_validator(mode="after")
    def require_internal_token_when_enabled(self) -> "Settings":
        token = self.interview_internal_api_token
        previous = self.interview_internal_api_token_previous
        if self.interview_internal_auth_enabled and (
            token is None or not token.get_secret_value().strip()
        ):
            raise ValueError(
                "Internal API token is required when internal authentication is enabled"
            )
        if token is not None and previous is not None and compare_digest(
            token.get_secret_value().encode("utf-8"),
            previous.get_secret_value().encode("utf-8"),
        ):
            raise ValueError("Current and previous internal API tokens must differ")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
