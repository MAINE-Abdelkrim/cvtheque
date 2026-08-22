from dataclasses import dataclass
from datetime import datetime

from app.domain.interview_session import InterviewSession


@dataclass(frozen=True, slots=True)
class RepositoryHistoryCursor:
    created_at: datetime
    session_id: str


@dataclass(frozen=True, slots=True)
class RepositoryHistoryPage:
    sessions: list[InterviewSession]
    next_cursor: RepositoryHistoryCursor | None
