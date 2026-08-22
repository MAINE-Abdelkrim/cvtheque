# API contract

## Endpoints

- `GET /health` → `{"status":"ok","service":"matching-engine","version":"1.0.0"}`
- `GET /version` → service, algorithm, and API versions
- `POST /api/v1/match` → complete `MatchResult`
- `POST /api/v1/rank-candidates` → recruiter-facing Top K ranking (Top 3 by default)

Request:

```json
{"cv": {}, "job": {}, "options": {"include_explanation": true}}
```

CV and job shapes are demonstrated in `examples/`. Required/preferred skills accept either strings or `{"name":"Python","mandatory":true}`. Recruiter weights accept all supported criterion keys and total 1.0 or 100. Unknown top-level CV/job fields are ignored; unknown request-envelope and weight fields are rejected.

The response includes algorithm version, IDs, overall score/classification, eligibility and hard failures, every criterion's raw/effective/weighted score, active status, matched/missing/partial evidence, explanations, warnings, strengths/gaps, and version metadata.

Errors are always `{"error":{"code":"...","message":"...","details":[]}}`. Schema errors use 422, unsupported versions 400, oversized bodies 413, and unexpected failures 500 without stack traces. JSON bodies are limited to 1 MiB.

Ranking request: `{"job": {...}, "candidates": [{...}], "options": {"top_k": 3, "include_technical_details": false, "invalid_candidate_policy": "skip"}}`. It accepts 1–5,000 candidate objects, `top_k` 1–100, and a 20 MiB HTTP body. The response contains aggregate valid/invalid/duplicate/eligibility counts, safe invalid records, and no more than Top K candidates. Default candidates omit technical scoring internals. See `docs/ranking.md` and both ranking examples.
