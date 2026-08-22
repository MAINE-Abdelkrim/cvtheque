class MatchingEngineError(Exception):
    """Base exception for expected engine failures."""

    code = "MATCHING_ENGINE_ERROR"


class InvalidCVPayloadError(MatchingEngineError):
    code = "INVALID_CV_PAYLOAD"


class InvalidJobPayloadError(MatchingEngineError):
    code = "INVALID_JOB_PAYLOAD"


class InvalidScoringWeightsError(MatchingEngineError):
    code = "INVALID_SCORING_WEIGHTS"


class UnsupportedSchemaVersionError(MatchingEngineError):
    code = "UNSUPPORTED_SCHEMA_VERSION"


class MalformedAliasConfigurationError(MatchingEngineError):
    code = "MALFORMED_ALIAS_CONFIGURATION"


class InternalScoringError(MatchingEngineError):
    code = "INTERNAL_SCORING_ERROR"


class InvalidRankingRequestError(MatchingEngineError):
    code = "INVALID_RANKING_REQUEST"
