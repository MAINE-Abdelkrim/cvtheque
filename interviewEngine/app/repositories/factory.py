from app.config.settings import Settings
from app.repositories.base import InterviewSessionRepository
from app.repositories.errors import RepositoryConfigurationError
from app.repositories.firebase_admin_client import create_firebase_admin_firestore_client
from app.repositories.firestore import FirestoreInterviewSessionRepository
from app.repositories.firestore_client import FirestoreClient
from app.repositories.in_memory import InMemoryInterviewSessionRepository


def create_repository(
    settings: Settings, *, firestore_client: FirestoreClient | None = None
) -> InterviewSessionRepository:
    repository_name = settings.interview_repository.strip().lower()
    if repository_name == "in_memory":
        return InMemoryInterviewSessionRepository()
    if repository_name == "firestore":
        if firestore_client is None:
            firestore_client = create_firebase_admin_firestore_client(settings)
        return FirestoreInterviewSessionRepository(
            firestore_client,
            collection_name=settings.interview_firestore_collection,
        )
    raise RepositoryConfigurationError("Unsupported interview repository")
