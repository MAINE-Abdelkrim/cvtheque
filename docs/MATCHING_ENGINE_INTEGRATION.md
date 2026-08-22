# Matching Engine integration

## Architecture

The browser never calls the Matching Engine directly. An authenticated recruiter calls `POST /api/jobs/:jobId/match` on Express. Express verifies recruiter identity and ownership, loads the canonical Job and all current canonical CVs from Firestore, converts only matching-relevant fields, and sends one bulk request to the deterministic Python service at `POST /api/v1/rank-candidates`.

The Python Matching Engine remains database-independent. It owns scoring, default weights, mandatory education/language checks, eligibility, ranking, tie-breaking, and Top K selection. Express does not reproduce those rules.

## Canonical adapters

The CV adapter uses the canonical CV document ID as `candidate_id`; Express retains a private `cvId -> uid` map for correlation. It sends name, summary, location, skill names, supported experience fields, education, languages, and certifications. It excludes email, phone, links, file metadata, parser metadata, warnings, and raw content.

The Job adapter maps the canonical document ID to `job_id` and `title` to `job_title`. It sends structured skills, experience limits, education, languages, location/work-mode fields, and contract type. It excludes recruiter ownership, company, status, timestamps, Firestore metadata, application schema markers, and scoring weights.

## Date policy

The adapter preserves valid `YYYY-MM` and `YYYY-MM-DD` values. Explicit English or French month/year text and `MM/YYYY` are converted to `YYYY-MM`. Current markers such as `Present`, `Présent`, and `Current` set `is_current=true` without inventing an end date. Year-only and ambiguous or invalid experience dates are omitted. Education and certification years are retained only when an explicit year can be read.

## Mandatory requirements and weights

Free-text `mandatory_requirements` are omitted in V1 because Express cannot safely decide whether a candidate satisfies arbitrary prose. Structured mandatory education and language requirements continue to work in the engine. The Matching Engine owns its default scoring profile; canonical Jobs do not supply scoring weights.

## Configuration and local startup

Set the server-only variables:

```env
MATCHING_ENGINE_URL=http://127.0.0.1:8002
MATCHING_ENGINE_TIMEOUT_MS=30000
```

Start the service locally from `matching-engine` without external dependencies:

```powershell
python -m uvicorn app.api.fastapi_app:app --host 127.0.0.1 --port 8002
```

Express does not start or supervise this process.

## Authorization, privacy, and response

The route requires an active Firebase user with the `RECRUITER` role. A recruiter may match only a canonical, OPEN Job whose `recruiterId` equals the verified Firebase UID. Missing and foreign Jobs both return the same non-disclosing response.

The public result contains Job identity, aggregate counts, and at most three recruiter-readable candidate results: application candidate/CV identifiers, name, score, match level, eligibility, criterion displays, strengths, gaps, and mandatory failures. It never includes contact details, the full CV, parser/file metadata, raw technical results, or score weights.

Zero current CVs returns an empty successful result without calling the engine. Requests above the engine limit of 5,000 candidates are rejected rather than silently truncated. Invalid candidates are skipped by the engine and reported only as an aggregate count.

## Failure handling

The internal HTTP call has a bounded timeout. Unavailable service, timeout, non-success HTTP status, invalid JSON, contract-invalid responses, and unknown returned candidate IDs become controlled Express errors. There is no simulated-score fallback.

## Recruiter frontend

`RecruiterView` keeps the existing Job selection layout but now sends the selected canonical Firestore document ID to Express through the authenticated frontend matching client. The client obtains the current Firebase ID token and calls `POST /api/jobs/:jobId/match`; it never contacts port 8002 or reads candidate CV documents for matching.

The view renders candidates in the order returned by the engine. It displays the real score and match level, eligibility, required skill matches and gaps, experience, education, languages, location/work mode, contract compatibility, strengths, gaps, and mandatory failures. Loading disables duplicate submissions, an empty Top 3 is a successful state, and controlled backend failures are shown without fabricated fallback results.

The previous `getMatchScore()` keyword/`aiScore` calculation and its fake candidate-detail modal are no longer part of the recruiter matching flow. Results remain in React state only; match-result persistence and a secure full candidate profile view remain intentionally out of scope.
