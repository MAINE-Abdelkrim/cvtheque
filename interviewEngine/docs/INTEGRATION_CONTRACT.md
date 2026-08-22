# Interview Engine Integration Contract

This document defines the future internal HTTP boundary between the main recruitment application
and the standalone text Interview Engine. The current API is versioned under `/api/v1` and remains
independently runnable. It has an optional provider-independent service-to-service authentication
and ownership boundary; human authentication remains outside this service.

## A. Architecture boundary

The intended production path is:

```text
Browser
  -> Main Recruitment Backend
     -> authenticate the human and derive a trusted opaque candidate ID
     -> attach internal service token + opaque owner context
        -> Interview Engine
           -> InterviewService
              -> Repository
```

The browser must not call the Interview Engine directly. The future main recruitment backend is
the trusted caller and supplies canonical CV and optional Job snapshots after authenticating the
user. Main-platform integration remains future work.

The standalone hosting boundary is defined in
[`DEPLOYMENT_BOUNDARY.md`](DEPLOYMENT_BOUNDARY.md): TLS terminates at a trusted proxy/ingress,
server traffic uses TLS or a private route, CORS remains disabled, forwarded headers are not used
for identity, and network isolation supplements rather than replaces internal authentication.

When internal authentication is enabled, every interview route requires:

```http
Authorization: Bearer <internal service token>
X-Interview-Owner-Id: <opaque owner identifier>
```

The bearer token authenticates the calling backend, not the human candidate. Human authentication
belongs to the future main recruitment backend. `X-Interview-Owner-Id` is trusted only because the
authenticated backend supplies it. The engine does not parse JWTs and intentionally does not
implement Firebase Auth, OAuth, roles, or a user database.

## B. Start interview request

`POST /api/v1/interviews`

```json
{
  "candidate_id": "internal-correlation-123",
  "cv": {
    "identity": {"job_title": "Backend Developer", "location": "Casablanca"},
    "skills": [{"name": "Python"}, {"name": "FastAPI"}],
    "experiences": [
      {
        "job_title": "Backend Developer",
        "company": "Example Tech",
        "description": "Developed fictional REST APIs using FastAPI."
      }
    ]
  },
  "job": {
    "job_id": "job-456",
    "title": "Backend Developer",
    "company": "Example Company",
    "required_skills": ["Python"],
    "preferred_skills": ["PostgreSQL"],
    "minimum_experience": "Two years",
    "location": "Casablanca",
    "work_mode": "hybrid"
  },
  "interview_type": "technical",
  "max_questions": 5
}
```

`candidate_id` remains temporarily available for standalone compatibility. With internal auth
disabled, its existing optional behavior is preserved. With internal auth enabled, it is ignored:
the trusted principal owner always becomes the stored `candidate_id`, so a conflicting body value
cannot replace trusted ownership. Callers cannot select a model, provider, prompt, score, status,
or report. Unknown top-level request fields are rejected.

The response is HTTP 201 and contains a safe session view plus `first_question`. It never returns
the CV, Job, or candidate correlation value.

## C. Submit answer request

`POST /api/v1/interviews/{session_id}/answers`

```json
{
  "question_id": "question-uuid",
  "answer": "I separated routing from service logic and added automated tests."
}
```

Answers are submitted one at a time against the current question. The response contains the
evaluation, session status, the next question when applicable, and the final report when complete.
Stale, duplicate, completed-session, and cancelled-session submissions are rejected.

## D. Read session response

`GET /api/v1/interviews/{session_id}` returns:

```json
{
  "session_id": "session-uuid",
  "interview_type": "technical",
  "status": "IN_PROGRESS",
  "current_question_index": 1,
  "max_questions": 5,
  "created_at": "2026-01-01T10:00:00Z",
  "completed_at": null,
  "turns": [],
  "final_report": null
}
```

The full view may contain candidate-visible questions, submitted answer text, and evaluations. It
does not contain CV/Job snapshots, candidate ID, prompts, provider internals, credentials, or retry
details. `POST /api/v1/interviews/{session_id}/cancel` cancels an active session and returns the
same safe view.

## E. Owner-scoped history

`GET /api/v1/interviews?page_size=20&cursor=<opaque cursor>` requires the authenticated internal
backend principal and never accepts an owner query parameter. If internal authentication is
disabled, the endpoint returns `OWNER_CONTEXT_REQUIRED` rather than a global list. Page size
defaults to 20 and is bounded from 1 through 50.

```json
{
  "items": [
    {
      "session_id": "session-uuid",
      "interview_type": "technical",
      "status": "COMPLETED",
      "created_at": "2026-01-01T10:00:00Z",
      "completed_at": "2026-01-01T10:20:00Z",
      "questions_answered": 5,
      "max_questions": 5,
      "overall_score": 82,
      "classification": "good"
    }
  ],
  "next_cursor": "opaque-value-or-null"
}
```

Ordering is newest `created_at` first and then descending `session_id` for deterministic ties. The
cursor is bounded URL-safe base64 JSON containing only those two continuation values. It has no
owner or private interview data; repository queries remain owner-scoped even if a cursor originated
from another owner. Malformed cursors return HTTP 400 `INVALID_CURSOR` without parsing details.

History never includes candidate/owner identity, CV, Job, turns, questions, answers, evaluations,
report narrative/lists, planner intent, provider/model data, versions, schema metadata, or Firebase
details. No recruiter, administrator, unscoped, search, or analytics history endpoint exists.

## F. Complete interview response

The final answer response has `status: "COMPLETED"`, `next_question: null`, and a final report:

```json
{
  "session_id": "session-uuid",
  "status": "COMPLETED",
  "evaluation": {
    "score": 82,
    "classification": "good",
    "strengths": ["Used a concrete example"],
    "weaknesses": ["Could quantify the outcome"],
    "feedback": "The response was relevant and specific."
  },
  "next_question": null,
  "final_report": {
    "session_id": "session-uuid",
    "overall_score": 80,
    "classification": "good",
    "questions_answered": 5,
    "category_scores": {"technical": 80},
    "strengths": ["Used concrete examples"],
    "areas_for_improvement": ["Quantify outcomes"],
    "summary": "The fictional responses were relevant and generally specific."
  }
}
```

## G. Error envelope

Engine-owned runtime failures use:

```json
{"error":{"code":"QUESTION_MISMATCH","message":"question_id is not the current question"}}
```

Stable codes include `AUTH_REQUIRED`, `AUTH_INVALID`, `OWNER_CONTEXT_REQUIRED`, `INVALID_CURSOR`,
`SESSION_NOT_FOUND`, `INVALID_SESSION_STATE`, `QUESTION_MISMATCH`, `ANSWER_ALREADY_SUBMITTED`, and
safe provider codes such as `PROVIDER_UNAVAILABLE`. Missing bearer authentication returns 401
`AUTH_REQUIRED`; malformed or invalid authentication returns 401 `AUTH_INVALID`; missing, blank,
or oversized owner context returns 400 `OWNER_CONTEXT_REQUIRED`. Missing sessions and wrong-owner
access both return the same 404 `SESSION_NOT_FOUND` envelope. State conflicts return 409, and
provider failures return 503 without exposing SDK errors. Ordinary request-schema failures retain
FastAPI's HTTP 422 format.

## H. Candidate identity trust model

The main application must derive candidate identity from its verified authentication principal and
enforce candidate/recruiter roles before calling this API. It should load the current canonical CV
and selected Job from trusted storage. The engine authenticates that backend with a server-side
internal bearer token and accepts only its bounded opaque owner context. Token comparison is
constant-time. The token, Authorization header, owner header, and owner ID are never returned or
logged.

The service accepts one current token and, during rotation only, one optional previous token:

```dotenv
INTERVIEW_INTERNAL_AUTH_ENABLED=false
INTERVIEW_INTERNAL_API_TOKEN=
INTERVIEW_INTERNAL_API_TOKEN_PREVIOUS=
INTERVIEW_OWNER_HEADER=X-Interview-Owner-Id
```

When authentication is enabled, the current token is required. A blank previous token is absent;
when present it must differ from current. Both configured tokens are checked with constant-time
comparison. Production values should be injected externally through environment variables,
Docker/Kubernetes secrets, CI/CD secrets, or a future cloud secret-manager integration. This
contract does not implement those systems. `.env` is local-only and must not be committed. Tokens
must never be put in frontend environment variables or exposed to browsers.

The operational rotation sequence is:

1. Initial: current is token A and previous is empty.
2. Step 1: current becomes token B and previous becomes token A. After the normal configuration
   reload/restart, both token A and token B work temporarily.
3. Step 2, after callers migrate: current remains token B and previous becomes empty. After the
   normal reload/restart, token A no longer works.

No dynamic runtime secret refresh is provided. These tokens authenticate the calling backend, not
the candidate; candidate authentication remains the future main platform's responsibility.

`InterviewService` remains independent of HTTP and authentication libraries. The API dependency
constructs an `InterviewPrincipal`; routes pass only `principal.owner_id` to owner-scoped service
methods. Those methods use `repository.get_for_owner`, which deliberately makes absent sessions
and owner mismatches indistinguishable.

## I. CV and Job snapshot rules

The main application sends point-in-time canonical snapshots. The Interview Engine uses only fields
needed for planning and ignores compatible unknown canonical fields. Job context is optional and is
not a matching score. Supported Job fields include ID, title, company, description, required and
preferred skills, experience requirements/minimum experience, education, languages, location,
work mode, and mandatory requirements.

Snapshots are internal session state and are never returned by public operational responses.

## J. Privacy guarantees

- Candidate ID, CV, and Job snapshots are omitted from responses.
- Provider prompts and raw responses are not logged.
- Application logs omit tokens, authentication/owner headers, owner IDs, CV/Job content, candidate
  answers, prompts, raw provider responses, and credentials.
- Question generation receives narrow planner evidence rather than a full CV.
- Final-report generation receives evaluation summaries rather than raw answers.
- The service performs no direct Firebase access.

## K. Persistence assumptions

Current sessions are process-local, non-durable, and deep-copied by the in-memory repository.
Provider-dependent transitions are saved only after all work succeeds. A future persistent
repository must preserve this atomic-transition behavior and implement the existing repository
protocol without leaking database-specific document types into `InterviewService`.

Sessions carry an internal optimistic-concurrency version that is omitted from public responses.
Repository saves reject stale versions with `SESSION_CONFLICT`. The internal `candidate_id` acts as
the opaque owner/correlation value, and owner-aware repository reads conceal owner mismatches as
not found. When internal authentication is enabled, create/read/answer/cancel routes use the trusted
principal and owner-scoped service paths. See [`PERSISTENCE_DESIGN.md`](PERSISTENCE_DESIGN.md).

Multiple application workers are unsafe until shared persistence and concurrency control exist.
With `in_memory`, one worker is mandatory. With Firestore, transactions and version conflicts are
the cross-process protection; the service's mutation lock remains same-process coordination only.

## L. Future voice compatibility

Voice must wrap the existing text contract:

```text
Browser microphone -> Speech-to-Text -> submit-answer text endpoint
next text question -> Text-to-Speech
```

`InterviewService` remains text-only. Audio payloads and speech dependencies do not belong in this
API contract.

## M. What the main application must not do

- Do not expose the Interview Engine directly to browsers.
- Do not trust browser-supplied candidate ownership.
- Do not send the internal service token to a browser.
- Do not send API keys, provider/model choices, prompts, scores, status, or reports.
- Do not mix CV-to-Job matching scores with interview response-quality evaluation.
- Do not depend on the in-memory repository for production durability.
- Do not send audio through the text interview endpoints.
