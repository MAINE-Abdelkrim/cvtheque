import pytest

from app.config.settings import Settings
from app.repositories.errors import RepositoryConfigurationError
from app.repositories.factory import create_repository
from app.repositories.firestore import FirestoreInterviewSessionRepository
from app.repositories.in_memory import InMemoryInterviewSessionRepository
from tests.fake_firestore import FakeFirestoreClient


def test_repository_defaults_to_in_memory(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unexpected_initializer(settings: Settings) -> FakeFirestoreClient:
        del settings
        raise AssertionError("Firebase initializer must remain lazy")

    monkeypatch.setattr(
        "app.repositories.factory.create_firebase_admin_firestore_client",
        unexpected_initializer,
    )
    repository = create_repository(Settings(_env_file=None))
    assert isinstance(repository, InMemoryInterviewSessionRepository)


def test_repository_explicit_in_memory(monkeypatch: pytest.MonkeyPatch) -> None:
    def unexpected_initializer(settings: Settings) -> FakeFirestoreClient:
        del settings
        raise AssertionError("Firebase initializer must remain lazy")

    monkeypatch.setattr(
        "app.repositories.factory.create_firebase_admin_firestore_client",
        unexpected_initializer,
    )
    repository = create_repository(
        Settings(_env_file=None, interview_repository="in_memory")
    )
    assert isinstance(repository, InMemoryInterviewSessionRepository)


def test_repository_selects_firestore_with_injected_client() -> None:
    repository = create_repository(
        Settings(_env_file=None, interview_repository="firestore"),
        firestore_client=FakeFirestoreClient(),
    )
    assert isinstance(repository, FirestoreInterviewSessionRepository)


def test_firestore_selection_without_client_fails_clearly() -> None:
    with pytest.raises(RepositoryConfigurationError):
        create_repository(Settings(_env_file=None, interview_repository="firestore"))


def test_firestore_selection_bootstraps_configured_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = 0

    def initializer(settings: Settings) -> FakeFirestoreClient:
        nonlocal calls
        calls += 1
        assert settings.interview_firebase_project_id == "standalone-project"
        return FakeFirestoreClient()

    monkeypatch.setattr(
        "app.repositories.factory.create_firebase_admin_firestore_client", initializer
    )
    repository = create_repository(
        Settings(
            _env_file=None,
            interview_repository="firestore",
            interview_firebase_project_id="standalone-project",
            interview_firebase_credentials_file="C:/private/service-account.json",
        )
    )
    assert isinstance(repository, FirestoreInterviewSessionRepository)
    assert calls == 1


def test_unsupported_repository_fails_clearly() -> None:
    with pytest.raises(RepositoryConfigurationError):
        create_repository(Settings(_env_file=None, interview_repository="unknown"))
