import asyncio
from typing import Any

from app.domain.interview_session import InterviewSession
from app.repositories.errors import (
    RepositorySessionNotFoundError,
    SessionConflictError,
)
from app.repositories.history import RepositoryHistoryCursor, RepositoryHistoryPage
from app.repositories.serialization import (
    deserialize_interview_session,
    serialize_interview_session,
)


class InMemoryInterviewSessionRepository:
    """Process-local MVP storage. Copies prevent callers mutating stored state."""

    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def add(self, session: InterviewSession) -> InterviewSession:
        async with self._lock:
            if session.session_id in self._sessions:
                raise SessionConflictError("Interview session already exists")
            if session.version != 0:
                raise SessionConflictError("New interview session must start at version zero")
            self._sessions[session.session_id] = serialize_interview_session(session)
            return deserialize_interview_session(self._sessions[session.session_id])

    async def get(self, session_id: str) -> InterviewSession | None:
        async with self._lock:
            document = self._sessions.get(session_id)
            return deserialize_interview_session(document) if document else None

    async def get_for_owner(
        self, session_id: str, owner_id: str
    ) -> InterviewSession | None:
        session = await self.get(session_id)
        if session is None or session.candidate_id != owner_id:
            return None
        return session

    async def list_for_owner(
        self,
        owner_id: str,
        *,
        limit: int,
        cursor: RepositoryHistoryCursor | None = None,
    ) -> RepositoryHistoryPage:
        if not 1 <= limit <= 50:
            raise ValueError("History page limit is invalid")
        async with self._lock:
            sessions = [
                deserialize_interview_session(document)
                for document in self._sessions.values()
                if document["session"].get("candidate_id") == owner_id
            ]
        sessions.sort(key=lambda item: (item.created_at, item.session_id), reverse=True)
        if cursor is not None:
            cursor_key = (cursor.created_at, cursor.session_id)
            sessions = [
                session
                for session in sessions
                if (session.created_at, session.session_id) < cursor_key
            ]
        selected = sessions[: limit + 1]
        page_sessions = selected[:limit]
        next_cursor = (
            RepositoryHistoryCursor(
                created_at=page_sessions[-1].created_at,
                session_id=page_sessions[-1].session_id,
            )
            if len(selected) > limit
            else None
        )
        return RepositoryHistoryPage(sessions=page_sessions, next_cursor=next_cursor)

    async def save(
        self, session: InterviewSession, *, expected_version: int
    ) -> InterviewSession:
        async with self._lock:
            document = self._sessions.get(session.session_id)
            if document is None:
                raise RepositorySessionNotFoundError("Interview session was not found")
            stored = deserialize_interview_session(document)
            if stored.version != expected_version or session.version != expected_version:
                raise SessionConflictError(
                    "The interview changed while this request was being processed"
                )
            committed = session.model_copy(update={"version": expected_version + 1}, deep=True)
            self._sessions[session.session_id] = serialize_interview_session(committed)
            return deserialize_interview_session(self._sessions[session.session_id])
