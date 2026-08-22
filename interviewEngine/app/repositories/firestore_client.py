from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Protocol, TypeVar

T = TypeVar("T")
FirestoreDocument = dict[str, Any]


@dataclass(frozen=True, slots=True)
class FirestoreQueryCursor:
    created_at: str
    document_id: str


class FirestoreTransaction(Protocol):
    """Minimal transaction port required by the repository adapter."""

    async def get_document(
        self, collection: str, document_id: str
    ) -> FirestoreDocument | None: ...

    async def set_document(
        self, collection: str, document_id: str, document: FirestoreDocument
    ) -> None: ...


class FirestoreClient(Protocol):
    """Injected Firestore boundary; Firebase SDK objects do not cross this port."""

    async def create_document(
        self, collection: str, document_id: str, document: FirestoreDocument
    ) -> bool:
        """Atomically create a document, returning false when it already exists."""
        ...

    async def get_document(
        self, collection: str, document_id: str
    ) -> FirestoreDocument | None: ...

    async def list_documents_for_owner(
        self,
        collection: str,
        owner_id: str,
        *,
        limit: int,
        cursor: FirestoreQueryCursor | None = None,
    ) -> list[FirestoreDocument]: ...

    async def run_transaction(
        self, operation: Callable[[FirestoreTransaction], Awaitable[T]]
    ) -> T: ...
