# Integration

## Direct Python backend

```python
from app.services.matching_service import MatchingService

result = MatchingService().match(cv_json, job_json)
safe_payload = result.model_dump(mode="json")
```

For one job against a backend-selected candidate collection:

```python
from app.services.candidate_ranking_service import CandidateRankingService

ranking = CandidateRankingService().rank_candidates(job_json, cv_json_list, top_k=3)
safe_payload = ranking.model_dump(mode="json", exclude_none=True)
```

## Generic backend over HTTP

```python
import urllib.request, json

body = json.dumps({"cv": cv_json, "job": job_json}).encode("utf-8")
request = urllib.request.Request("http://matching-engine:8000/api/v1/match", body, {"Content-Type": "application/json"})
with urllib.request.urlopen(request, timeout=10) as response:
    result = json.load(response)
```

An equivalent backend in any language should set connection/read timeouts, authenticate service-to-service traffic, restrict network access, and avoid retrying invalid 4xx payloads.

## Next.js-facing backend route

The route authenticates and authorizes the recruiter, loads the CV/job JSON, calls the engine, optionally persists the result, and returns only the safe matching result:

```text
POST /backend/jobs/{jobId}/candidates/{candidateId}/match
→ 200 { match: <engine result> }
```

Next.js must not call the matching engine directly. The engine does not manage users, authorization, UI state, passwords, or databases.

For recruiter ranking, the backend loads CV JSON from the candidate database and one job JSON from the recruiter database, then calls `/api/v1/rank-candidates`. Only its authenticated Next.js-facing route exposes the recruiter result. The matching engine never receives database credentials.

For persistence, the backend may store `{match_id, candidate_id, job_id, matching_version, input_schema_versions, scoring_profile, result, created_at}`. Avoid duplicating CV content or sensitive attributes. Version storage makes historical results auditable after rules change.

Deployment options are an imported package in a Python backend or the Dockerized FastAPI microservice. The latter needs network policy, TLS/service authentication at the platform layer, resource limits, monitoring, and controlled alias/config deployment.

V1 batch execution is synchronous and sequential. Configure backend and proxy timeouts for the maximum accepted batch, enforce the 20 MiB limit at ingress, and consider an asynchronous backend job only if observed production latency requires it.
