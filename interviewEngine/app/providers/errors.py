from enum import StrEnum


class ProviderFailureCause(StrEnum):
    RATE_LIMIT = "RATE_LIMIT"
    AUTHENTICATION = "AUTHENTICATION"
    PERMISSION = "PERMISSION"
    MODEL_OR_REQUEST = "MODEL_OR_REQUEST"
    SERVER = "SERVER"
    TRANSPORT = "TRANSPORT"
    TIMEOUT = "TIMEOUT"
    UNKNOWN = "UNKNOWN"


class ProviderValidationReason(StrEnum):
    UNKNOWN = "UNKNOWN"
    INVALID_STRUCTURE = "INVALID_STRUCTURE"
    CATEGORY_MISMATCH = "CATEGORY_MISMATCH"
    DIFFICULTY_MISMATCH = "DIFFICULTY_MISMATCH"
    SOURCE_REFERENCE_MISMATCH = "SOURCE_REFERENCE_MISMATCH"
    DUPLICATE_QUESTION = "DUPLICATE_QUESTION"
    UNSUPPORTED_HISTORY_PREMISE = "UNSUPPORTED_HISTORY_PREMISE"
    PROHIBITED_INFERENCE = "PROHIBITED_INFERENCE"
    AGGREGATE_MISMATCH = "AGGREGATE_MISMATCH"


class InterviewProviderError(Exception):
    """Safe base error for provider-boundary failures."""

    code = "PROVIDER_ERROR"


class ProviderUnavailableError(InterviewProviderError):
    code = "PROVIDER_UNAVAILABLE"

    def __init__(
        self,
        message: str,
        *,
        cause: ProviderFailureCause = ProviderFailureCause.UNKNOWN,
    ) -> None:
        super().__init__(message)
        self.cause = cause


class ProviderTimeoutError(InterviewProviderError):
    code = "PROVIDER_TIMEOUT"

    cause = ProviderFailureCause.TIMEOUT


class ProviderInvalidResponseError(InterviewProviderError):
    code = "PROVIDER_INVALID_RESPONSE"

    def __init__(
        self,
        message: str,
        *,
        reason: ProviderValidationReason = ProviderValidationReason.INVALID_STRUCTURE,
    ) -> None:
        super().__init__(message)
        self.reason = reason


class ProviderConfigurationError(InterviewProviderError):
    code = "PROVIDER_CONFIGURATION_ERROR"
