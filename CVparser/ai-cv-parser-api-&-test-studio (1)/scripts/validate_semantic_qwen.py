"""Manual local-Qwen semantic smoke test; never collected by default pytest."""

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import Settings
from app.llm.client_factory import create_llm_client
from app.models.cv_models import CVData
from app.services.semantic_extraction_service import SemanticExtractionService


def main() -> int:
    settings = Settings(
        MODEL_ENABLED=True,
        MODEL_LOCAL_FILES_ONLY=True,
        MODEL_DEVICE="cpu",
        _env_file=None,
    )
    client = create_llm_client(settings)
    if client is None or not client.is_available():
        print("Local Qwen is unavailable; no model was downloaded.")
        return 2
    outcome = SemanticExtractionService(timeout_seconds=120).extract(
        CVData(), {"SKILLS": "Python\nFastAPI\nPostgreSQL"}, client
    )
    names = [skill.name for skill in outcome.cv_data.skills]
    if not names or any(name not in {"Python", "FastAPI", "PostgreSQL"} for name in names):
        print("Semantic output did not pass grounded schema validation.")
        return 1
    print(f"Semantic Qwen validation passed with {len(names)} grounded skill(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
