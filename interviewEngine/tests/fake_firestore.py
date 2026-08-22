import asyncio
from collections.abc import Awaitable, Callable
from copy import deepcopy
from typing import Any, TypeVar

from app.repositories.firestore_client import (
    FirestoreDocument,
    FirestoreQueryCursor,
    FirestoreTransaction,
)

T = TypeVar("T")
DocumentKey = tuple[str, str]


class FakeFirestoreTransaction(FirestoreTransaction):
    def __init__(self, documents: dict[DocumentKey, FirestoreDocument]) -> None:
        self._documents = documents

    async def get_document(
        self, collection: str, document_id: str
    ) -> FirestoreDocument | None:
        document = self._documents.get((collection, document_id))
        return deepcopy(document) if document is not None else None

    async def set_document(
        self, collection: str, document_id: str, document: FirestoreDocument
    ) -> None:
        self._documents[(collection, document_id)] = deepcopy(document)


class FakeFirestoreClient:
    """Offline transactional fake implementing the repository's injected client port."""

    def __init__(self) -> None:
        self.documents: dict[DocumentKey, FirestoreDocument] = {}
        self._lock = asyncio.Lock()
        self.fail_reads = False
        self.fail_creates = False
        self.fail_transactions = False
        self.fail_queries = False
        self.fail_after_transaction_operation = False

    async def create_document(
        self, collection: str, document_id: str, document: FirestoreDocument
    ) -> bool:
        if self.fail_creates:
            raise RuntimeError("private SDK create detail")
        async with self._lock:
            key = (collection, document_id)
            if key in self.documents:
                return False
            self.documents[key] = deepcopy(document)
            return True

    async def get_document(
        self, collection: str, document_id: str
    ) -> FirestoreDocument | None:
        if self.fail_reads:
            raise RuntimeError("private SDK read detail")
        async with self._lock:
            document = self.documents.get((collection, document_id))
            return deepcopy(document) if document is not None else None

    async def list_documents_for_owner(
        self,
        collection: str,
        owner_id: str,
        *,
        limit: int,
        cursor: FirestoreQueryCursor | None = None,
    ) -> list[FirestoreDocument]:
        if self.fail_queries:
            raise RuntimeError("private SDK query detail")
        async with self._lock:
            matching = [
                (document_id, deepcopy(document))
                for (document_collection, document_id), document in self.documents.items()
                if document_collection == collection and document.get("owner_id") == owner_id
            ]
        matching.sort(
            key=lambda item: (str(item[1].get("created_at")), item[0]), reverse=True
        )
        if cursor is not None:
            cursor_key = (cursor.created_at, cursor.document_id)
            matching = [
                item
                for item in matching
                if (str(item[1].get("created_at")), item[0]) < cursor_key
            ]
        return [document for _, document in matching[:limit]]

    async def run_transaction(
        self, operation: Callable[[FirestoreTransaction], Awaitable[T]]
    ) -> T:
        if self.fail_transactions:
            raise RuntimeError("private SDK transaction detail")
        async with self._lock:
            staged = deepcopy(self.documents)
            result = await operation(FakeFirestoreTransaction(staged))
            if self.fail_after_transaction_operation:
                raise RuntimeError("private SDK commit detail")
            self.documents = staged
            return result

    def inject_document(
        self, collection: str, document_id: str, document: dict[str, Any]
    ) -> None:
        self.documents[(collection, document_id)] = deepcopy(document)
