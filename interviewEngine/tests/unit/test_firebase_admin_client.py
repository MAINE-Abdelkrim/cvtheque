import asyncio
import threading
from collections.abc import Awaitable
from copy import deepcopy
from types import SimpleNamespace
from typing import Any

import pytest
from google.auth.credentials import AnonymousCredentials
from google.cloud.firestore_v1 import Client as RealFirestoreClient

from app.config.settings import Settings
from app.repositories.errors import RepositoryConfigurationError
from app.repositories.firebase_admin_client import (
    FirebaseAdminClientError,
    FirebaseAdminFirestoreClient,
    FirebaseAdminFirestoreTransaction,
    create_firebase_admin_firestore_client,
)
from app.repositories.firestore_client import FirestoreQueryCursor, FirestoreTransaction


class FakeAlreadyExists(Exception):
    pass


class FakeSnapshot:
    def __init__(self, document: dict[str, Any] | None) -> None:
        self.exists = document is not None
        self._document = document

    def to_dict(self) -> dict[str, Any] | None:
        return deepcopy(self._document)


class FakeDocumentReference:
    def __init__(self, client: "FakeSdkClient", key: tuple[str, str]) -> None:
        self._client = client
        self._key = key

    def create(self, document: dict[str, Any]) -> None:
        self._client.thread_ids.append(threading.get_ident())
        if self._client.fail_operations:
            raise RuntimeError("private project and credential detail")
        if self._key in self._client.documents:
            raise FakeAlreadyExists
        self._client.documents[self._key] = deepcopy(document)

    def get(self) -> FakeSnapshot:
        self._client.thread_ids.append(threading.get_ident())
        if self._client.fail_operations:
            raise RuntimeError("private project and credential detail")
        return FakeSnapshot(self._client.documents.get(self._key))


class FakeCollection:
    def __init__(self, client: "FakeSdkClient", name: str) -> None:
        self._client = client
        self._name = name

    def document(self, document_id: str) -> FakeDocumentReference:
        return FakeDocumentReference(self._client, (self._name, document_id))

    def where(self, *, filter: Any) -> "FakeSdkQuery":
        query = FakeSdkQuery(self._client, self._name)
        return query.where(filter=filter)


class FakeSdkQuery:
    def __init__(self, client: "FakeSdkClient", collection: str) -> None:
        self._client = client
        self._collection = collection
        self._owner_id: str | None = None
        self._orders: list[tuple[str, str]] = []
        self._cursor: dict[str, Any] | None = None
        self._limit = 0

    def where(self, *, filter: Any) -> "FakeSdkQuery":
        assert filter.field_path == "owner_id"
        assert filter.op_string == "=="
        self._owner_id = filter.value
        return self

    def order_by(self, field: str, *, direction: str) -> "FakeSdkQuery":
        self._orders.append((field, direction))
        return self

    def start_after(self, values: dict[str, Any]) -> "FakeSdkQuery":
        self._cursor = values
        return self

    def limit(self, value: int) -> "FakeSdkQuery":
        self._limit = value
        return self

    def stream(self) -> object:
        self._client.thread_ids.append(threading.get_ident())
        if self._client.fail_operations:
            raise RuntimeError("private owner query detail")
        assert self._owner_id is not None
        matching = [
            (document_id, document)
            for (collection, document_id), document in self._client.documents.items()
            if collection == self._collection and document.get("owner_id") == self._owner_id
        ]
        matching.sort(
            key=lambda item: (item[1]["created_at"], item[0]), reverse=True
        )
        if self._cursor is not None:
            cursor_reference = self._cursor["__name__"]
            cursor_key = (self._cursor["created_at"], cursor_reference._key[1])
            matching = [
                item
                for item in matching
                if (item[1]["created_at"], item[0]) < cursor_key
            ]
        self._client.query_calls.append(
            {
                "owner_id": self._owner_id,
                "orders": list(self._orders),
                "limit": self._limit,
                "cursor": self._cursor,
            }
        )
        return iter(FakeSnapshot(document) for _, document in matching[: self._limit])


class FakeSdkTransaction:
    def __init__(self, client: "FakeSdkClient") -> None:
        self._client = client
        self._staged = deepcopy(client.documents)

    def get(self, reference: FakeDocumentReference) -> object:
        self._client.thread_ids.append(threading.get_ident())
        return iter([FakeSnapshot(self._staged.get(reference._key))])

    def set(
        self, reference: FakeDocumentReference, document: dict[str, Any]
    ) -> None:
        self._client.thread_ids.append(threading.get_ident())
        self._staged[reference._key] = deepcopy(document)

    def commit(self) -> None:
        self._client.thread_ids.append(threading.get_ident())
        if self._client.fail_commit:
            raise RuntimeError("private transaction detail")
        self._client.documents = self._staged


class FakeSdkClient:
    def __init__(self) -> None:
        self.documents: dict[tuple[str, str], dict[str, Any]] = {}
        self.thread_ids: list[int] = []
        self.query_calls: list[dict[str, Any]] = []
        self.fail_operations = False
        self.fail_commit = False

    def collection(self, name: str) -> FakeCollection:
        return FakeCollection(self, name)

    def transaction(self, *, max_attempts: int) -> FakeSdkTransaction:
        assert max_attempts == 1
        return FakeSdkTransaction(self)


def client_pair() -> tuple[FirebaseAdminFirestoreClient, FakeSdkClient]:
    sdk = FakeSdkClient()
    return FirebaseAdminFirestoreClient(
        sdk,
        already_exists_error=FakeAlreadyExists,
        transactional=fake_transactional,
    ), sdk


def fake_transactional(callback: Any) -> Any:
    def run(transaction: FakeSdkTransaction) -> Any:
        try:
            result = callback(transaction)
            transaction.commit()
            return result
        except Exception:
            raise

    return run


async def test_create_document_is_atomic_and_duplicate_returns_false() -> None:
    client, sdk = client_pair()
    document = {"nested": {"value": 1}}
    assert await client.create_document("sessions", "one", document) is True
    document["nested"]["value"] = 99
    assert sdk.documents[("sessions", "one")]["nested"]["value"] == 1
    assert await client.create_document("sessions", "one", {}) is False


async def test_get_document_returns_plain_isolated_data_or_none() -> None:
    client, sdk = client_pair()
    sdk.documents[("sessions", "one")] = {"value": [1]}
    fetched = await client.get_document("sessions", "one")
    assert fetched == {"value": [1]}
    assert isinstance(fetched, dict)
    fetched["value"].append(2)
    assert sdk.documents[("sessions", "one")] == {"value": [1]}
    assert await client.get_document("sessions", "missing") is None


async def test_owner_query_applies_filter_order_limit_and_cursor_off_thread() -> None:
    client, sdk = client_pair()
    sdk.documents = {
        ("sessions", "session-c"): {"owner_id": "owner-a", "created_at": "2026-01-03"},
        ("sessions", "session-b"): {"owner_id": "owner-a", "created_at": "2026-01-02"},
        ("sessions", "session-a"): {"owner_id": "owner-a", "created_at": "2026-01-01"},
        ("sessions", "other"): {"owner_id": "owner-b", "created_at": "2027-01-01"},
    }
    event_loop_thread = threading.get_ident()
    documents = await client.list_documents_for_owner(
        "sessions",
        "owner-a",
        limit=2,
        cursor=FirestoreQueryCursor(
            created_at="2026-01-03", document_id="session-c"
        ),
    )
    assert [document["created_at"] for document in documents] == [
        "2026-01-02",
        "2026-01-01",
    ]
    assert len(sdk.query_calls) == 1
    call = sdk.query_calls[0]
    assert call["owner_id"] == "owner-a"
    assert call["orders"] == [
        ("created_at", "DESCENDING"),
        ("__name__", "DESCENDING"),
    ]
    assert call["limit"] == 2
    assert call["cursor"]["created_at"] == "2026-01-03"
    assert call["cursor"]["__name__"]._key == ("sessions", "session-c")
    assert sdk.thread_ids[-1] != event_loop_thread


async def test_owner_query_sdk_failure_is_sanitized() -> None:
    client, sdk = client_pair()
    sdk.fail_operations = True
    with pytest.raises(FirebaseAdminClientError) as caught:
        await client.list_documents_for_owner("sessions", "owner-a", limit=2)
    assert str(caught.value) == "Firestore owner query failed"
    assert "private" not in str(caught.value)


async def test_transaction_read_write_and_callback_result() -> None:
    client, sdk = client_pair()
    sdk.documents[("sessions", "one")] = {"version": 0}
    callback_calls = 0

    async def operation(transaction: FirestoreTransaction) -> str:
        nonlocal callback_calls
        callback_calls += 1
        assert await transaction.get_document("sessions", "one") == {"version": 0}
        await transaction.set_document("sessions", "one", {"version": 1})
        return "committed"

    assert await client.run_transaction(operation) == "committed"
    assert callback_calls == 1
    assert sdk.documents[("sessions", "one")] == {"version": 1}


async def test_transaction_preserves_application_callback_error() -> None:
    client, sdk = client_pair()

    async def operation(transaction: FirestoreTransaction) -> None:
        del transaction
        raise LookupError("controlled application conflict")

    with pytest.raises(LookupError, match="controlled application conflict"):
        await client.run_transaction(operation)
    assert sdk.documents == {}


@pytest.mark.parametrize("operation", ["create", "get", "transaction"])
async def test_sdk_failures_are_sanitized(operation: str) -> None:
    client, sdk = client_pair()
    if operation == "create":
        sdk.fail_operations = True
        action: Awaitable[object] = client.create_document("sessions", "one", {})
    elif operation == "get":
        sdk.fail_operations = True
        action = client.get_document("sessions", "one")
    else:
        sdk.fail_commit = True

        async def transaction_action(transaction: FirestoreTransaction) -> None:
            await transaction.set_document("sessions", "one", {"value": 1})

        action = client.run_transaction(transaction_action)

    with pytest.raises(FirebaseAdminClientError) as caught:
        await action
    assert "private" not in str(caught.value)


async def test_sync_sdk_operations_run_off_event_loop_thread() -> None:
    client, sdk = client_pair()
    event_loop_thread = threading.get_ident()
    await client.create_document("sessions", "one", {})
    await client.get_document("sessions", "one")

    async def operation(transaction: FirestoreTransaction) -> None:
        await transaction.get_document("sessions", "one")
        await transaction.set_document("sessions", "one", {"value": 2})

    await client.run_transaction(operation)
    assert sdk.thread_ids
    assert all(thread_id != event_loop_thread for thread_id in sdk.thread_ids)
    await asyncio.sleep(0)


async def test_actual_firestore_transaction_generator_shape_offline() -> None:
    client = RealFirestoreClient(
        project="offline-compatibility-test", credentials=AnonymousCredentials()
    )
    raw_transaction = client.transaction(max_attempts=1)
    snapshot = FakeSnapshot({"version": 0})
    client.get_all = lambda references, transaction: iter([snapshot])  # type: ignore[method-assign]
    adapter = FirebaseAdminFirestoreTransaction(raw_transaction, client)

    assert await adapter.get_document("sessions", "one") == {"version": 0}
    await adapter.set_document("sessions", "one", {"version": 1})
    assert raw_transaction._max_attempts == 1
    assert len(raw_transaction._write_pbs) == 1


def test_initializer_requires_configuration_before_importing_sdk(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unexpected_import(name: str) -> object:
        raise AssertionError(f"unexpected import: {name}")

    monkeypatch.setattr(
        "app.repositories.firebase_admin_client.importlib.import_module",
        unexpected_import,
    )
    with pytest.raises(RepositoryConfigurationError):
        create_firebase_admin_firestore_client(
            Settings(_env_file=None, interview_repository="firestore")
        )


def test_initializer_creates_named_app_once_and_reuses_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    apps: dict[str, object] = {}
    sdk_client = FakeSdkClient()
    certificate_calls: list[str] = []
    initialization_calls: list[tuple[object, dict[str, str], str]] = []

    def get_app(name: str) -> object:
        if name not in apps:
            raise ValueError("not initialized")
        return apps[name]

    def initialize_app(
        credential: object, options: dict[str, str], *, name: str
    ) -> object:
        app = object()
        apps[name] = app
        initialization_calls.append((credential, options, name))
        return app

    def certificate(path: str) -> object:
        certificate_calls.append(path)
        return object()

    firebase_admin = SimpleNamespace(get_app=get_app, initialize_app=initialize_app)
    credentials = SimpleNamespace(Certificate=certificate)
    firestore = SimpleNamespace(
        client=lambda *, app: sdk_client, transactional=fake_transactional
    )
    exceptions = SimpleNamespace(AlreadyExists=FakeAlreadyExists)
    modules = {
        "firebase_admin": firebase_admin,
        "firebase_admin.credentials": credentials,
        "firebase_admin.firestore": firestore,
        "google.api_core.exceptions": exceptions,
    }
    monkeypatch.setattr(
        "app.repositories.firebase_admin_client.importlib.import_module",
        lambda name: modules[name],
    )
    settings = Settings(
        _env_file=None,
        interview_repository="firestore",
        interview_firebase_project_id="standalone-project",
        interview_firebase_credentials_file="C:/private/service-account.json",
    )

    first = create_firebase_admin_firestore_client(settings)
    second = create_firebase_admin_firestore_client(settings)
    assert isinstance(first, FirebaseAdminFirestoreClient)
    assert isinstance(second, FirebaseAdminFirestoreClient)
    assert len(initialization_calls) == 1
    assert certificate_calls == ["C:/private/service-account.json"]
