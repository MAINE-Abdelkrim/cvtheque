from typing import Any

from pydantic import ValidationError

from app.domain.interview_session import InterviewSession, SessionStatus
from app.repositories.errors import (
    InvalidStoredSessionError,
    UnsupportedStorageSchemaVersionError,
)

STORAGE_SCHEMA_VERSION = 1


def serialize_interview_session(session: InterviewSession) -> dict[str, Any]:
    """Create a deterministic, JSON-safe storage document for one complete session snapshot."""
    validate_persisted_session(session)
    payload = session.model_dump(mode="json")
    for serialized_turn, turn in zip(payload["turns"], session.turns, strict=True):
        serialized_turn["intent"] = (
            turn.intent.model_dump(mode="json") if turn.intent is not None else None
        )
    return {
        "storage_schema_version": STORAGE_SCHEMA_VERSION,
        "session": payload,
    }


def deserialize_interview_session(document: dict[str, Any]) -> InterviewSession:
    """Validate and restore a stored session without database-SDK-specific behavior."""
    version = document.get("storage_schema_version")
    if version != STORAGE_SCHEMA_VERSION:
        raise UnsupportedStorageSchemaVersionError(
            "Stored interview session uses an unsupported schema version"
        )
    payload = document.get("session")
    if not isinstance(payload, dict):
        raise InvalidStoredSessionError("Stored interview session is invalid")
    try:
        session = InterviewSession.model_validate(payload)
    except (TypeError, ValueError, ValidationError) as exc:
        raise InvalidStoredSessionError("Stored interview session is invalid") from exc
    validate_persisted_session(session)
    return session


def validate_persisted_session(session: InterviewSession) -> None:
    """Enforce invariants required at a durable snapshot boundary."""
    answered = sum(turn.answer is not None for turn in session.turns)
    if (
        session.version < 0
        or session.current_question_index != answered
        or len(session.turns) > session.max_questions
        or any((turn.answer is None) != (turn.evaluation is None) for turn in session.turns)
    ):
        raise InvalidStoredSessionError("Interview session state is inconsistent")

    unanswered = [index for index, turn in enumerate(session.turns) if turn.answer is None]
    if unanswered and unanswered != [len(session.turns) - 1]:
        raise InvalidStoredSessionError("Interview session state is inconsistent")

    if session.status is SessionStatus.CREATED:
        valid = (
            not session.turns
            and session.current_question_index == 0
            and session.completed_at is None
            and session.final_report is None
        )
    elif session.status is SessionStatus.IN_PROGRESS:
        valid = (
            bool(session.turns)
            and unanswered == [len(session.turns) - 1]
            and session.completed_at is None
            and session.final_report is None
        )
    elif session.status is SessionStatus.COMPLETED:
        valid = (
            bool(session.turns)
            and not unanswered
            and session.completed_at is not None
            and session.final_report is not None
            and session.final_report.session_id == session.session_id
            and session.final_report.questions_answered == answered
        )
    else:
        valid = session.completed_at is not None and session.final_report is None

    if not valid:
        raise InvalidStoredSessionError("Interview session state is inconsistent")
