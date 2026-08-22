class InterviewRepositoryError(Exception):
    """Safe persistence-boundary error."""

    code = "REPOSITORY_ERROR"


class RepositoryConfigurationError(InterviewRepositoryError):
    code = "REPOSITORY_CONFIGURATION_ERROR"


class SessionConflictError(InterviewRepositoryError):
    code = "SESSION_CONFLICT"


class RepositorySessionNotFoundError(InterviewRepositoryError):
    code = "SESSION_NOT_FOUND"


class InvalidStoredSessionError(InterviewRepositoryError):
    code = "INVALID_STORED_SESSION"


class UnsupportedStorageSchemaVersionError(InterviewRepositoryError):
    code = "UNSUPPORTED_STORAGE_SCHEMA_VERSION"
