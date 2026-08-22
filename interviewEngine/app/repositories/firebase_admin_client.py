import asyncio
import importlib
from collections.abc import Awaitable, Callable
from copy import deepcopy
from threading import Lock
from typing import Any, TypeVar, cast

from app.config.settings import Settings
from app.repositories.errors import RepositoryConfigurationError
from app.repositories.firestore_client import (
    FirestoreClient,
    FirestoreDocument,
    FirestoreQueryCursor,
    FirestoreTransaction,
)

T = TypeVar("T")
_FIREBASE_APP_NAME = "interview-engine"
_initialization_lock = Lock()


class FirebaseAdminClientError(Exception):
    """Sanitized failure raised by the Firebase Admin SDK boundary."""


class _ApplicationTransactionError(Exception):
    def __init__(self, error: Exception) -> None:
        self.error = error


class FirebaseAdminFirestoreTransaction(FirestoreTransaction):
    def __init__(self, transaction: Any, client: Any) -> None:
        self._transaction = transaction
        self._client = client

    async def get_document(
        self, collection: str, document_id: str
    ) -> FirestoreDocument | None:
        reference = self._client.collection(collection).document(document_id)
        try:
            snapshot = await asyncio.to_thread(
                _get_transaction_snapshot, self._transaction, reference
            )
            return _snapshot_document(snapshot)
        except FirebaseAdminClientError:
            raise
        except Exception:
            raise FirebaseAdminClientError("Firestore transaction read failed") from None

    async def set_document(
        self, collection: str, document_id: str, document: FirestoreDocument
    ) -> None:
        reference = self._client.collection(collection).document(document_id)
        try:
            await asyncio.to_thread(
                self._transaction.set, reference, deepcopy(document)
            )
        except Exception:
            raise FirebaseAdminClientError("Firestore transaction write failed") from None


class FirebaseAdminFirestoreClient(FirestoreClient):
    """Async adapter over the synchronous Firebase Admin Firestore client."""

    def __init__(
        self,
        client: Any,
        *,
        already_exists_error: type[Exception],
        transactional: Callable[[Callable[..., Any]], Callable[..., Any]],
    ) -> None:
        self._client = client
        self._already_exists_error = already_exists_error
        self._transactional = transactional

    async def create_document(
        self, collection: str, document_id: str, document: FirestoreDocument
    ) -> bool:
        reference = self._client.collection(collection).document(document_id)
        try:
            await asyncio.to_thread(reference.create, deepcopy(document))
        except self._already_exists_error:
            return False
        except Exception:
            raise FirebaseAdminClientError("Firestore create failed") from None
        return True

    async def get_document(
        self, collection: str, document_id: str
    ) -> FirestoreDocument | None:
        reference = self._client.collection(collection).document(document_id)
        try:
            snapshot = await asyncio.to_thread(reference.get)
            return _snapshot_document(snapshot)
        except FirebaseAdminClientError:
            raise
        except Exception:
            raise FirebaseAdminClientError("Firestore read failed") from None

    async def list_documents_for_owner(
        self,
        collection: str,
        owner_id: str,
        *,
        limit: int,
        cursor: FirestoreQueryCursor | None = None,
    ) -> list[FirestoreDocument]:
        try:
            return await asyncio.to_thread(
                _list_owner_documents,
                self._client,
                collection,
                owner_id,
                limit,
                cursor,
            )
        except FirebaseAdminClientError:
            raise
        except Exception:
            raise FirebaseAdminClientError("Firestore owner query failed") from None

    async def run_transaction(
        self, operation: Callable[[FirestoreTransaction], Awaitable[T]]
    ) -> T:
        def invoke() -> T:
            raw_transaction = self._client.transaction(max_attempts=1)

            def callback(active_transaction: Any) -> T:
                adapter = FirebaseAdminFirestoreTransaction(
                    active_transaction, self._client
                )

                async def execute() -> T:
                    return await operation(adapter)

                try:
                    return asyncio.run(execute())
                except Exception as exc:
                    raise _ApplicationTransactionError(exc) from exc

            return cast(T, self._transactional(callback)(raw_transaction))

        try:
            return await asyncio.to_thread(invoke)
        except _ApplicationTransactionError as exc:
            raise exc.error from None
        except Exception:
            raise FirebaseAdminClientError("Firestore transaction failed") from None


def create_firebase_admin_firestore_client(settings: Settings) -> FirestoreClient:
    """Lazily initialize one named Firebase Admin app from standalone settings."""
    credentials_file = settings.interview_firebase_credentials_file
    project_id = settings.interview_firebase_project_id
    if not credentials_file or not project_id:
        raise RepositoryConfigurationError(
            "Firestore requires standalone Firebase project and credential configuration"
        )

    try:
        firebase_admin = importlib.import_module("firebase_admin")
        credentials = importlib.import_module("firebase_admin.credentials")
        firestore = importlib.import_module("firebase_admin.firestore")
        google_exceptions = importlib.import_module("google.api_core.exceptions")
    except (ImportError, ModuleNotFoundError):
        raise RepositoryConfigurationError(
            "Firebase Admin support is not installed"
        ) from None

    try:
        with _initialization_lock:
            try:
                app = firebase_admin.get_app(_FIREBASE_APP_NAME)
            except ValueError:
                credential = credentials.Certificate(credentials_file)
                app = firebase_admin.initialize_app(
                    credential,
                    {"projectId": project_id},
                    name=_FIREBASE_APP_NAME,
                )
        raw_client = firestore.client(app=app)
        already_exists = cast(
            type[Exception], google_exceptions.AlreadyExists
        )
        return FirebaseAdminFirestoreClient(
            raw_client,
            already_exists_error=already_exists,
            transactional=firestore.transactional,
        )
    except RepositoryConfigurationError:
        raise
    except Exception:
        raise RepositoryConfigurationError(
            "Firebase Admin Firestore initialization failed"
        ) from None


def _snapshot_document(snapshot: Any) -> FirestoreDocument | None:
    if snapshot is None or not snapshot.exists:
        return None
    document = snapshot.to_dict()
    if not isinstance(document, dict):
        raise FirebaseAdminClientError("Firestore returned an invalid document")
    return deepcopy(document)


def _get_transaction_snapshot(transaction: Any, reference: Any) -> Any:
    snapshots = transaction.get(reference)
    return next(iter(snapshots), None)


def _list_owner_documents(
    client: Any,
    collection_name: str,
    owner_id: str,
    limit: int,
    cursor: FirestoreQueryCursor | None,
) -> list[FirestoreDocument]:
    base_query = importlib.import_module("google.cloud.firestore_v1.base_query")
    field_path = importlib.import_module("google.cloud.firestore_v1.field_path")
    collection = client.collection(collection_name)
    document_id_field = field_path.FieldPath.document_id()
    query = (
        collection.where(filter=base_query.FieldFilter("owner_id", "==", owner_id))
        .order_by("created_at", direction="DESCENDING")
        .order_by(document_id_field, direction="DESCENDING")
    )
    if cursor is not None:
        query = query.start_after(
            {
                "created_at": cursor.created_at,
                document_id_field: collection.document(cursor.document_id),
            }
        )
    snapshots = query.limit(limit).stream()
    documents: list[FirestoreDocument] = []
    for snapshot in snapshots:
        document = _snapshot_document(snapshot)
        if document is None:
            raise FirebaseAdminClientError("Firestore returned an invalid document")
        documents.append(document)
    return documents
