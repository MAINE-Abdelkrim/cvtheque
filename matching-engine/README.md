# Matching Engine

A production-oriented V1 decision-support service that deterministically compares structured CV and job JSON. It returns criterion scores, evidence, gaps, explicit hard-requirement failures, and concise explanations. It never makes a hiring decision and never scores personal or sensitive attributes.

It also ranks one job against up to 5,000 backend-supplied CV documents. Every valid unique candidate uses the same single-candidate matcher, while the recruiter response returns Top 3 by default using deterministic eligibility-first ordering. See [candidate ranking](docs/ranking.md).

## V1 scope

V1 uses configurable rules and curated aliases. It does **not** use an LLM, embeddings, machine learning, RAG, vector databases, paid APIs, PDFs, or inferred undocumented skills. It does not guarantee fairness by itself or replace recruiter judgment.

The core is stateless and framework-independent:

`schemas → normalizers → scorers → MatchingService → optional FastAPI adapter`

See [architecture](docs/architecture.md), [scoring](docs/scoring.md), [API contract](docs/api-contract.md), and [integration](docs/integration.md).

## Install and test

Requires Python 3.11+.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
python -m pytest
```

On POSIX systems activate with `source .venv/bin/activate`.

## Direct Python usage

```python
import json
from pathlib import Path
from app.services.matching_service import MatchingService

cv = json.loads(Path("examples/sample_cv.json").read_text(encoding="utf-8"))
job = json.loads(Path("examples/sample_job.json").read_text(encoding="utf-8"))
result = MatchingService().match(cv, job)
print(result.model_dump(mode="json"))
```

## HTTP usage

```powershell
uvicorn app.api.fastapi_app:app --host 0.0.0.0 --port 8000
curl.exe -X POST http://localhost:8000/api/v1/match -H "Content-Type: application/json" --data-binary "@examples/request.json"
```

The POST body is `{"cv": {...}, "job": {...}, "options": {"include_explanation": true}}`. The Next.js application should call the existing authenticated backend, never this engine directly in production.

Ranking uses `POST /api/v1/rank-candidates` with the shape in `examples/ranking_request.json`. The default response includes only three recruiter-facing candidates; add `include_technical_details: true` only when the backend needs Top-K audit details.

## Configuration and versions

Business defaults are immutable and versioned in `app/config/scoring_config.py`; aliases are UTF-8 JSON in `data/`. Default weights are required skills 40, experience 25, education 10, languages 10, preferred skills 5, location/work mode 5, and contract 5. Missing job criteria are inactive and their weights are redistributed across active criteria.

Algorithm `1.0.0`, API `v1`, CV/job schemas `1.0`, scoring profile `default-v1`.

## Limitations and roadmap

Exact normalization cannot understand deep semantic equivalence, infer experience relevance, calculate travel distance, analyze PDFs, or infer skills. A future V2 may evaluate sentence embeddings, occupation taxonomies, multilingual semantic normalization, learning-to-rank, and recruiter-feedback calibration only after governance and fairness review.
