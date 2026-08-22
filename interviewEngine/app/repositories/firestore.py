from typing import Any

from app.domain.interview_session import InterviewSession
from app.repositories.errors import (
    InterviewRepositoryError,
    InvalidStoredSessionError,
    RepositorySessionNotFoundError,
    SessionConflictError,
)
from app.repositories.firestore_client import (
    FirestoreClient,
    FirestoreQueryCursor,
    FirestoreTransaction,
)
from app.repositories.history import RepositoryHistoryCursor, RepositoryHistoryPage
from app.repositories.serialization import (
    deserialize_interview_session,
    serialize_interview_session,
)


class FirestoreInterviewSessionRepository:
    """Whole-document Firestore adapter using an injected, async client boundary."""

    def __init__(
        self, client: FirestoreClient, collection_name: str = "interviewSessions"
    ) -> None:
        if not collection_name or len(collection_name) > 128:
            raise ValueError("Firestore collection name is invalid")
        self._client = client
        self._collection_name = collection_name

    async def add(self, session: InterviewSession) -> InterviewSession:
        if session.version != 0:
            raise SessionConflictError("New interview session must start at version zero")
        document = _firestore_document(session)
        try:
            created = await self._client.create_document(
                self._collection_name, session.session_id, document
            )
        except InterviewRepositoryError:
            raise
        except Exception as exc:
            raise InterviewRepositoryError("Interview session storage is unavailable") from exc
        if not created:
            raise SessionConflictError("Interview session already exists")
        return _session_from_firestore_document(document)

    async def get(self, session_id: str) -> InterviewSession | None:
        try:
            document = await self._client.get_document(self._collection_name, session_id)
        except InterviewRepositoryError:
            raise
        except Exception as exc:
            raise InterviewRepositoryError("Interview session storage is unavailable") from exc
        return _session_from_firestore_document(document) if document is not None else None

    async def get_for_owner(
        self, session_id: str, owner_id: str
    ) -> InterviewSession | None:
        try:
            document = await self._client.get_document(self._collection_name, session_id)
        except InterviewRepositoryError:
            raise
        except Exception as exc:
            raise InterviewRepositoryError("Interview session storage is unavailable") from exc
        if document is None or document.get("owner_id") != owner_id:
            return None
        session = _session_from_firestore_document(document)
        return session if session.candidate_id == owner_id else None

    async def list_for_owner(
        self,
        owner_id: str,
        *,
        limit: int,
        cursor: RepositoryHistoryCursor | None = None,
    ) -> RepositoryHistoryPage:
        if not 1 <= limit <= 50:
            raise ValueError("History page limit is invalid")
        query_cursor = (
            FirestoreQueryCursor(
                created_at=cursor.created_at.isoformat(),
                document_id=cursor.session_id,
            )
            if cursor is not None
            else None
        )
        try:
            documents = await self._client.list_documents_for_owner(
                self._collection_name,
                owner_id,
                limit=limit + 1,
                cursor=query_cursor,
            )
        except InterviewRepositoryError:
            raise
        except Exception as exc:
            raise InterviewRepositoryError("Interview session storage is unavailable") from exc
        sessions = [_session_from_firestore_document(document) for document in documents]
        if any(session.candidate_id != owner_id for session in sessions):
            raise InvalidStoredSessionError("Stored interview session metadata is inconsistent")
        page_sessions = sessions[:limit]
        next_cursor = (
            RepositoryHistoryCursor(
                created_at=page_sessions[-1].created_at,
                session_id=page_sessions[-1].session_id,
            )
            if len(sessions) > limit
            else None
        )
        return RepositoryHistoryPage(sessions=page_sessions, next_cursor=next_cursor)

    async def save(
        self, session: InterviewSession, *, expected_version: int
    ) -> InterviewSession:
        async def commit(transaction: FirestoreTransaction) -> InterviewSession:
            document = await transaction.get_document(
                self._collection_name, session.session_id
            )
            if document is None:
                raise RepositorySessionNotFoundError("Interview session was not found")
            stored = _session_from_firestore_document(document)
            if stored.version != expected_version or session.version != expected_version:
                raise SessionConflictError(
                    "The interview changed while this request was being processed"
                )
            committed = session.model_copy(
                update={"version": expected_version + 1}, deep=True
            )
            committed_document = _firestore_document(committed)
            await transaction.set_document(
                self._collection_name, session.session_id, committed_document
            )
            return _session_from_firestore_document(committed_document)

        try:
            return await self._client.run_transaction(commit)
        except InterviewRepositoryError:
            raise
        except Exception as exc:
            raise InterviewRepositoryError("Interview session storage is unavailable") from exc


def _firestore_document(session: InterviewSession) -> dict[str, Any]:
    serialized = serialize_interview_session(session)
    return {
        **serialized,
        "owner_id": session.candidate_id,
        "version": session.version,
        "created_at": session.created_at.isoformat(),
        "status": session.status.value,
    }


def _session_from_firestore_document(document: dict[str, Any]) -> InterviewSession:
    session = deserialize_interview_session(document)
    expected = {
        "owner_id": session.candidate_id,
        "version": session.version,
        "created_at": session.created_at.isoformat(),
        "status": session.status.value,
    }
    if any(document.get(field) != value for field, value in expected.items()):
        raise InvalidStoredSessionError("Stored interview session metadata is inconsistent")
    return session
