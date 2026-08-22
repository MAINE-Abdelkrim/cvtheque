from typing import Protocol

from app.domain.interview_session import InterviewSession
from app.repositories.history import RepositoryHistoryCursor, RepositoryHistoryPage


class InterviewSessionRepository(Protocol):
    async def add(self, session: InterviewSession) -> InterviewSession: ...

    async def get(self, session_id: str) -> InterviewSession | None: ...

    async def get_for_owner(
        self, session_id: str, owner_id: str
    ) -> InterviewSession | None: ...

    async def list_for_owner(
        self,
        owner_id: str,
        *,
        limit: int,
        cursor: RepositoryHistoryCursor | None = None,
    ) -> RepositoryHistoryPage: ...

    async def save(
        self, session: InterviewSession, *, expected_version: int
    ) -> InterviewSession: ...
