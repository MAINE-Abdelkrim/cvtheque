# AI Interview Engine

AI Interview Engine is a standalone, text-only FastAPI service that runs structured interviews from canonical CV JSON and optional job context. Its deterministic planner and resilient provider boundary support a completely offline mock mode and an optional Gemini provider. It does not integrate with the recruitment application or voice components; standalone Firestore persistence is optional and server-side only.

## Why this architecture

The development machine has 8 GB RAM and a 2 GB MX330 GPU, so running a 7B model or installing PyTorch/Transformers is neither required nor appropriate for this MVP. The business workflow depends on the `InterviewLLMProvider` protocol, not a model SDK. `MockLLMProvider` is small, deterministic, offline, and replaceable later. Provider calls are protected by validation, timeouts, conservative retries, and explicit fallback.

```text
Main Recruitment App (future)
        |
        | internal HTTP
        v
Interview Engine
        |
        +---- InterviewService
        |
        +---- LLM Provider
        |       + Mock (default, offline)
        |       + Gemini (optional remote provider)
        |       + Local Qwen (later, suitable hardware)
        |
        +---- Session Repository
                + In-memory (default)
                + Firestore adapter (optional, injected client)
```

The service core accepts and returns text only. A future voice mode wraps, rather than modifies, it:

```text
Browser microphone
      |
      v
Speech-to-Text adapter
      |
      v
Interview Engine (text)
      |
      v
Text-to-Speech adapter
```

## Components

- `app/schemas`: permissive CV/job boundary adapters and strict HTTP requests.
- `app/domain`: session, turn, question, answer, evaluation, and report models.
- `app/providers`: provider protocol and offline deterministic implementation.
- `app/repositories`: persistence protocol and concurrency-safe in-memory implementation.
- `app/services`: provider-independent session lifecycle and business rules.
- `app/api`: FastAPI routes, dependency wiring, and structured domain errors.

The planner owns interview strategy and the provider owns language-oriented generation. The resilient boundary prevents a provider from changing planner-controlled category, difficulty, or grounding.

## Resilient provider boundary

```text
CV + Job
   |
   v
Interview Planner
   |
   v
QuestionIntent
   |
   v
Resilient Provider Boundary
   +-- Primary Provider
   +-- Fallback Provider
   |
   v
Validated Question / Evaluation / Report
   |
   v
InterviewService
   |
   v
Session
```

Each async provider operation has an independent deadline. Transient unavailability and timeouts are retried only up to the configured limit. Invalid output and configuration errors are not retried. When enabled, fallback runs after the primary exhausts transient retries or returns invalid output. Fallback results pass through the same validation.

Validation enforces question IDs and text limits, intent-compatible category/difficulty/grounding, bounded scores, controlled classifications, bounded feedback lists, report/session coherence, and assessed-category accuracy. A failed operation is never saved as a partial session transition.

Operational logs contain only operation, provider name, session ID, result state, and duration. They never include CV/job content, candidate identity, answers, prompts, credentials, or raw provider responses.

## Install and run

Python 3.12 is required.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

OpenAPI documentation is available at `http://127.0.0.1:8000/docs`. No credentials, network model
calls, or Firebase configuration are needed in the default mock and in-memory mode.

## Local Interview Test UI

The Streamlit interface in `tools/interview_test_ui.py` is for local development of this standalone
engine only. Install the UI extra and launch it from the repository root:

```powershell
python -m pip install -e ".[ui]"
python -m streamlit run tools/interview_test_ui.py
```

It always uses the process-local `InMemoryInterviewSessionRepository`; it does not initialize or
call Firestore. Mock mode works completely offline. Gemini mode requires the server-side API key
already configured for this project and can encounter external quota or rate limits, after which
the configured mock fallback may be used. Use fictional test data only—never enter real candidate
data or expose credentials in this development UI.

## API

The stable future integration boundary is documented in
[`docs/INTEGRATION_CONTRACT.md`](docs/INTEGRATION_CONTRACT.md). In production, browsers must call
the authenticated main recruitment backend, which performs role and ownership checks and sends
trusted canonical snapshots to this internal API. The Interview Engine is not currently an
internet-facing authentication boundary.

The optional internal trust boundary follows this production path:

```text
Browser
  -> Main Recruitment Backend
     -> authenticate the human and derive an opaque candidate owner ID
     -> attach an internal bearer token and opaque owner context
        -> Interview Engine -> InterviewService -> Repository
```

The bearer token authenticates the calling backend, not the human candidate. Human authentication
remains the future main recruitment backend's responsibility. The Interview Engine must not be
exposed directly to browsers. Firebase Auth, JWT parsing, OAuth, roles, and main-platform
integration are intentionally not implemented here.

The persistence-neutral versioning, ownership, serialization, and future Firestore transaction
design is documented in [`docs/PERSISTENCE_DESIGN.md`](docs/PERSISTENCE_DESIGN.md).
Standalone TLS, reverse-proxy, request-size, timeout, rate-limit, health, and worker assumptions are
documented in [`docs/DEPLOYMENT_BOUNDARY.md`](docs/DEPLOYMENT_BOUNDARY.md).
Deterministic question, scoring, aggregation, adaptation, safety, and offline scenario guarantees are
documented in [`docs/INTERVIEW_QUALITY.md`](docs/INTERVIEW_QUALITY.md).

Repository selection is server-side configuration:

```dotenv
INTERVIEW_REPOSITORY=in_memory
INTERVIEW_FIRESTORE_COLLECTION=interviewSessions
INTERVIEW_FIREBASE_PROJECT_ID=
INTERVIEW_FIREBASE_CREDENTIALS_FILE=
INTERVIEW_INTERNAL_AUTH_ENABLED=false
INTERVIEW_INTERNAL_API_TOKEN=
INTERVIEW_INTERNAL_API_TOKEN_PREVIOUS=
INTERVIEW_OWNER_HEADER=X-Interview-Owner-Id
INTERVIEW_ALLOWED_HOSTS=
INTERVIEW_MAX_REQUEST_BYTES=1048576
```

`in_memory` remains the default and does not import or initialize Firebase. For a future durable
standalone runtime, set `INTERVIEW_REPOSITORY=firestore`, a standalone project ID, and an absolute
server-side service-account path. Firebase Admin initialization is lazy, named, and reused. Missing
configuration or initialization failure stops repository construction; it never silently falls
back to memory. Never commit the credential file or expose these settings to browser code.

Internal authentication is disabled by default, preserving isolated standalone behavior. When
`INTERVIEW_INTERNAL_AUTH_ENABLED=true`, startup fails unless
`INTERVIEW_INTERNAL_API_TOKEN` contains a non-blank server-side token. Every interview
create/read/answer/cancel call then requires `Authorization: Bearer <internal token>` and the
configured owner header (default `X-Interview-Owner-Id`) containing a bounded opaque identifier.
`INTERVIEW_INTERNAL_API_TOKEN_PREVIOUS` optionally accepts one prior token during a controlled
rotation. A blank previous token is treated as absent, and current and previous tokens must differ.

Production secrets should be supplied through deployment configuration, such as environment
variables, Docker/Kubernetes secret injection, CI/CD secret injection, or a future cloud secret
manager adapter. No specific secret-management platform is implemented here. `.env` is local
configuration only and must not be committed. Service tokens must never be sent to browsers or
placed in frontend environment variables.

Rotate without an abrupt caller cutover:

1. Initial: current is token A; previous is empty.
2. Rotation step 1: set current to token B and previous to token A, then perform the normal
   configuration reload/application restart. Both tokens work temporarily.
3. After every backend caller uses token B, rotation step 2 removes the previous token and performs
   the normal reload/restart. Token A no longer works.

Dynamic runtime secret refresh is intentionally not implemented.

`INTERVIEW_ALLOWED_HOSTS` is an optional comma-separated trusted-host list; empty preserves local
development behavior. `INTERVIEW_MAX_REQUEST_BYTES` limits the actual HTTP body before JSON model
validation and returns HTTP 413 `REQUEST_TOO_LARGE` without echoing the body. No CORS middleware is
enabled because this is not a browser API.

In trusted-auth mode, the owner header always determines session ownership; transitional body
`candidate_id` is ignored and cannot override it. With auth disabled, body `candidate_id` retains
its existing optional behavior. Authentication errors use `AUTH_REQUIRED`, `AUTH_INVALID`, and
`OWNER_CONTEXT_REQUIRED` without returning token or identity values.

The Firebase Admin bridge wraps synchronous SDK work with `asyncio.to_thread`, while the repository
performs whole-document optimistic-concurrency transactions. With Firebase Admin 7.5.0 and
google-cloud-firestore 2.28.1, it uses the SDK's `firestore.transactional` wrapper with one maximum
attempt; transactional document reads materialize the SDK's snapshot generator. Offline tests use
fake SDK objects and actual SDK classes without credentials, an emulator, or network access.

### Health

```http
GET /health
```

Returns safe, non-inference metadata:

```json
{
  "status": "ok",
  "service": "ai-interview-engine"
}
```

## Server boundary example

Keep local/in-memory development on one worker:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Behind a trusted TLS-terminating proxy or private service route, a deployment-neutral example is:

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --no-proxy-headers
```

The engine does not terminate public TLS and does not trust forwarded headers in application
authorization. Configure trusted proxy behavior at the proxy/Uvicorn boundary. One worker is
mandatory for `in_memory`; Firestore can provide cross-process persistence/version conflicts, but
multi-worker load and operational testing remain pending.

### Create an interview

```http
POST /api/v1/interviews
Content-Type: application/json

{
  "candidate_id": "candidate-123",
  "cv": {"skills": [{"name": "FastAPI"}]},
  "job": null,
  "interview_type": "mixed",
  "max_questions": 5
}
```

Returns HTTP 201 with a safe session view and `first_question`. Interview types are `general`, `behavioral`, `technical`, and `mixed`. The current mock uses the same deterministic source selection for all types; the enum preserves the future contract.

### Submit an answer

```http
POST /api/v1/interviews/{session_id}/answers
Content-Type: application/json

{
  "question_id": "question UUID",
  "answer": "I used FastAPI to build REST APIs..."
}
```

Returns the evaluation, status, the next question when continuing, and the final report when completed. Answers must be non-blank and at most 20,000 characters.

### Read or cancel

```http
GET  /api/v1/interviews/{session_id}
POST /api/v1/interviews/{session_id}/cancel
```

The session view includes interview turns but excludes the CV snapshot, job snapshot, and candidate identifier. Domain failures use a stable envelope such as:

```json
{"error":{"code":"QUESTION_MISMATCH","message":"question_id is not the current question"}}
```

Invalid payloads use FastAPI's standard HTTP 422 response. Missing sessions return 404; state conflicts return 409.

### Owner-scoped history

```http
GET /api/v1/interviews?page_size=20&cursor=<opaque cursor>
Authorization: Bearer <internal service token>
X-Interview-Owner-Id: <opaque owner identifier>
```

History is always scoped to the authenticated backend principal. It is unavailable when internal
authentication is disabled because there is no trusted owner context; query parameters cannot
supply an owner. Page size defaults to 20 and is bounded from 1 through 50. Results are ordered by
`created_at` newest-first with `session_id` as a deterministic descending tie-breaker.

The response contains only session ID, interview type, status, timestamps, answered/max question
counts, and nullable overall score/classification. It excludes owner identity, CV, Job, turns,
questions, answers, evaluations, report narrative, planner/provider data, and persistence metadata.
The cursor is opaque and contains only the timestamp/session tie-breaker. Invalid cursors return
HTTP 400 `INVALID_CURSOR`. No recruiter, administrator, or global history route exists.

## Session lifecycle

```text
create -> CREATED -> first question -> IN_PROGRESS
                                  |          |
                                  |          +-> cancel -> CANCELLED
                                  |
                                  +-> answer/evaluate/next question
                                             |
                                             +-> max reached -> COMPLETED + report
```

A current question can be answered once. Wrong/stale question IDs, duplicate submissions, and answers after completion are rejected. `max_questions` is configurable from 1 to 20.

## Deterministic behavior

Questions are planned as internal `QuestionIntent` objects before a provider phrases them. An intent records category, topic, objective, difficulty, grounding, and source references. The deterministic planner derives coverage from existing turns, prioritizes categories by interview type, prefers unused categories and topics, and avoids repeating the same topic/objective pair.

Grounding references are explicit:

- `cv:*` means the topic is documented in the CV.
- `job:*` means the topic comes only from a role requirement.
- Both reference types mean CV and role evidence overlap.
- No references means the question is a generic fallback.

Question intents also distinguish documented CV facts from skill-only, hypothetical, and generic
grounding. A listed skill establishes a topic, not a past project or production decision. New
technical concepts must be phrased as hypothetical or knowledge questions unless narrow CV
evidence supports them as candidate history. Provider output is checked for obvious unsupported
past-experience premises before it can reach the service. This deterministic guard is defense in
depth, not a complete natural-language entailment proof.

Job-only wording asks what experience the candidate has, if any; it never claims that the candidate used the technology. Job fields supported by the boundary adapter include required/preferred skills, experience, education, language, location/work mode, and mandatory requirements. The engine uses them to choose questions, not to calculate match scores.

General interviews emphasize introduction, experience, motivation, selected skills, and behavioral evidence. Technical interviews prioritize technical depth, skills, and problem solving. Behavioral interviews prioritize teamwork, adaptation, conflict, responsibility, and communication. Mixed interviews balance professional, technical, behavioral, and motivational coverage.

Difficulty begins at easy, moves through medium, and can reach hard later; technical interviews reach deeper questions sooner. A response scoring below 50 and lacking detail/context/examples can trigger one deterministic clarification intent and cannot escalate the next difficulty. A response scoring at least 85 may deepen a technical question one step earlier after the opening turns. A stronger response otherwise advances to another topic.

Email-like, phone-like, and URL-like source values are discarded before planning. Candidate names are not used. Empty CVs receive safe generic questions, while an empty CV with job requirements receives explicitly job-grounded questions.

Evaluation uses only observable response properties: lexical relevance, answer development, reasoning, and simple evidence/result markers. Fluent irrelevant text is kept below the fair threshold. It produces a bounded score, classification, strengths, weaknesses, and feedback. The deterministic mock is not a general technical-correctness oracle; correctness and real-provider quality require separate evaluation. It does not infer honesty, intelligence, emotion, personality, mental state, protected traits, or other psychological attributes.

Scores use one deterministic policy: 85–100 excellent, 70–84 good, 50–69 fair, and 0–49 needs improvement. Numeric scores are authoritative when provider labels conflict. The final report deterministically averages response scores overall and by category, verifies counts, deduplicates response-quality strengths and improvement areas, and produces a short recruiter-readable summary. It does not use raw answer text in its summary.

## Privacy

- Sessions live only in process memory and disappear on restart when the default repository is used.
- Application code does not log CV content, contact details, or answers.
- Public session responses omit CV/job snapshots and candidate IDs.
- Questions use narrow, sanitized CV fields; email and phone patterns are excluded.
- This is an API minimization measure, not a complete production DLP system.

## Provider configuration

```dotenv
INTERVIEW_PROVIDER=mock
INTERVIEW_PROVIDER_TIMEOUT_SECONDS=20
INTERVIEW_PROVIDER_MAX_RETRIES=1
INTERVIEW_PROVIDER_RETRY_DELAY_SECONDS=0
INTERVIEW_PROVIDER_FALLBACK_ENABLED=true
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TEMPERATURE=0.2
GEMINI_MAX_OUTPUT_TOKENS=2048
```

`INTERVIEW_PROVIDER=mock` is the default, makes no network calls, and requires no credentials. `INTERVIEW_PROVIDER=gemini` uses the official `google-genai` SDK and requires `GEMINI_API_KEY` in the server environment. Never expose this key to browser or frontend code. Model choice and generation limits remain server configuration rather than business-logic constants.

With fallback enabled, Gemini is the primary provider and `MockLLMProvider` handles runtime failures after the resilient boundary exhausts its configured attempts. Missing or blank Gemini credentials fail during provider construction and do not silently select the mock provider.

## Provider boundary

Both mock and Gemini implement the existing three-method `InterviewLLMProvider` protocol. Gemini uses structured Pydantic response schemas and an injectable client so its adapter is tested without network calls. It receives planner-selected intent, but cannot select or override category, difficulty, topic, grounding references, ordering, or session state.

Gemini question prompts contain only the narrow intent selected by the planner. Evaluation prompts contain the question and answer. Final-report prompts use collected evaluation data and omit raw answers, CV data, and job data. Prompts and raw responses are never logged.

## Tests and checks

All tests are offline:

```powershell
pytest
ruff check .
mypy app
```

Coverage includes creation, interview strategy, CV/job grounding, provider contracts, output validation, timeout, transient retry, retry limits, fallback, configuration failures, atomic session state, safe logging, answer/evaluation flow, completion and report creation, session isolation, privacy filtering, health, cancellation, full HTTP contracts, classification boundaries, adaptive difficulty, aggregate consistency, and 15 synthetic interview-quality scenarios.

## MVP limitations and future integration

- In-memory state is single-process and non-durable; multiple workers must not be used.
- The standalone Firestore adapter and Firebase Admin bridge have completed one controlled live
  verification; broader operational/load validation is not included.
- The mock scoring heuristic and offline scenario suite validate workflow policy, not candidate suitability, hiring validity, or real-model quality.
- Strategy uses deterministic field-level evidence, not semantic understanding of free-form CV or job descriptions.
- Optional internal backend authentication and owner scoping are included; human authentication,
  roles, rate limiting, and main-platform integration are not.
- Contact filtering is intentionally narrow and must be strengthened before production.
- In-process timeouts cannot guarantee cancellation of work performed by a provider SDK in an unmanaged external thread.

Main-platform topology, human authentication, history, voice, deployment, and UI remain separate
later phases.
