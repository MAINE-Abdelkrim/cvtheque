import json
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def sample_cv() -> dict:
    return json.loads((ROOT / "examples" / "sample_cv.json").read_text(encoding="utf-8"))


@pytest.fixture
def sample_job() -> dict:
    return json.loads((ROOT / "examples" / "sample_job.json").read_text(encoding="utf-8"))

