# Interview Session Persistence Design

## A. Current persistence limitation

The default repository is process-local and non-durable. A Firestore repository adapter now
implements the same serialization and optimistic-concurrency contract through an injected client
boundary. A concrete Firebase Admin bridge is available, but is initialized only when Firestore is
explicitly selected.

## B. Repository abstraction

`InterviewSessionRepository` exposes only domain values:

- `add(session) -> committed session`
- `get(session_id) -> session | None`
- `get_for_owner(session_id, owner_id) -> session | None`
- `list_for_owner(owner_id, limit, cursor) -> history page`
- `save(session, expected_version=...) -> committed session`

No database references, snapshots, transactions, collection names, or Firebase types cross this
boundary. `InterviewService` coordinates complete domain transitions and the repository commits
them. Narrow `FirestoreClient` and `FirestoreTransaction` ports remain inside the repository layer.

## C. Session ownership

The existing bounded `candidate_id` is the internal opaque owner/correlation identifier. It remains
named for API compatibility and is never included in `SessionView`. The trusted main backend must
derive it from authenticated identity; this engine does not validate Firebase credentials.

`get_for_owner` returns `None` for both missing sessions and owner mismatches, preventing existence
disclosure. When internal authentication is enabled, the API principal supplies the verified owner
and create/read/answer/cancel routes use owner-scoped service paths.

## D. Optimistic concurrency and versioning

Every session has a non-negative `version`. Creation starts at version 0. A save supplies the
version read by the caller as `expected_version`; a successful commit increments it by one and
returns the committed snapshot.

If two requests read version 3, the first can commit version 4. The second receives
`SESSION_CONFLICT` and cannot overwrite version 4. Version values are internal and omitted from API
responses.

## E. Atomic interview transitions

The required answer transition is:

```text
read isolated snapshot
  -> validate current question/state
  -> evaluate answer
  -> generate next question or final report
  -> validate provider output
  -> save one complete snapshot with expected version
```

Provider or validation failure causes no save. Durable adapters must write the complete document in
one transaction rather than partially updating answer, evaluation, index, or next question fields.

## F. Serialization format

`serialize_interview_session` produces a deterministic JSON-safe dictionary using snake_case domain
field names. It includes nested CV and Job snapshots, planner intents, questions, answers,
evaluations, timestamps, enums, final report, owner ID, and session version. Runtime providers,
clients, locks, and repository objects are never serialized.

`deserialize_interview_session` validates the storage version, reconstructs Pydantic domain models,
and enforces persisted-state invariants. Planner intents are explicitly included even though they
are excluded from public serialization.

## G. Storage schema version

Each stored document includes internal `storage_schema_version: 1`, separate from `/api/v1`.
Unsupported versions fail safely with `UNSUPPORTED_STORAGE_SCHEMA_VERSION`. No migration framework
is included yet.

## H. Firestore document design

The adapter stores one complete document at the configurable collection path:

```text
interviewSessions/{sessionId}
```

The implemented envelope is:

```text
storage_schema_version
owner_id                    # must match session.candidate_id
version                     # must match session.version
created_at                  # must match session.created_at
status                      # must match session.status
session                     # complete serialized InterviewSession
```

Duplicated fields are validated against the nested session on every read and written atomically.

The owner-history query needs a composite index conceptually equivalent to:

```text
owner_id ASC, created_at DESC, document ID DESC
```

Optional status filtering conceptually requires `owner_id ASC, status ASC, created_at DESC`. No
indexes are deployed by this project.

## I. Firestore transaction behavior

Save runs through the injected client's transaction boundary:

1. Read `interviewSessions/{sessionId}`.
2. Return not-found safely if absent.
3. Compare stored `version` with `expected_version`.
4. Reject mismatches as `SESSION_CONFLICT`.
5. Validate and write the entire updated snapshot with `version + 1`.

Whole-document writes keep the answer, evaluation, planner intent, next question/final report,
index, lifecycle state, and version coherent.

The adapter does not retry stale writes or silently fall back to memory. SDK failures are mapped to
safe repository errors; a failed transaction leaves the prior complete document unchanged.

## J. Owner history and pagination

`list_for_owner` accepts only a trusted owner, a limit from 1 through 50, and a neutral cursor made
of `created_at` plus `session_id`. It returns isolated domain sessions and the next neutral cursor;
HTTP DTOs, encoded cursors, Firestore snapshots, and query objects do not cross the repository
protocol.

The in-memory adapter filters by owner, sorts by `(created_at, session_id)` descending, and resumes
strictly after the cursor without global pagination state. The Firestore adapter uses the injected
client query boundary with owner equality, descending creation time, descending document ID,
start-after values, and `limit + 1` lookahead.

`InterviewService` encodes/decodes the bounded opaque cursor and maps full sessions into safe
summary DTOs. The public summary excludes owner identity, CV/Job snapshots, turns, answers,
evaluations, report narrative, planner/provider details, versions, and storage metadata. There is
no unscoped, recruiter, admin, search, or status-filtered history operation.

## K. Security assumptions

The main recruitment backend authenticates users and supplies the trusted owner identifier. The
Interview Engine must remain behind that backend. CV, Job, owner ID, version, and storage schema
version remain internal. Firestore security rules and Firebase UID verification are outside this
service and are not implemented here.

## L. Failure and retry behavior

Conflicts map to HTTP 409 with a safe reload-and-retry message. Responses do not reveal expected or
current versions. Automatic replay of an answer transition is not implemented: a caller must reload
and decide whether the answer still targets the current question. Provider retry behavior remains
independent from storage concurrency.

## M. Migration path

1. Validate the bridge only in a separately authorized emulator or isolated development project.
2. Decide whether Express owns persistence or this engine owns trusted Admin credentials.
3. Backfill or migrate only known `storage_schema_version` values.
4. Add trusted owner dependencies before enabling multi-tenant routes.
5. Design owner-history pagination after durable storage is available.

## N. What InterviewService must never know

`InterviewService` must never depend on Firestore clients, collection/document paths, transactions,
snapshots, server timestamps, index definitions, Firebase credentials, or retry APIs. It should
continue to operate only on `InterviewSession` and the persistence-neutral repository protocol.

## O. Configuration and deployment boundary

`INTERVIEW_REPOSITORY=in_memory` is the default. It does not import Firebase, load credentials, or
construct a Firestore client. `INTERVIEW_REPOSITORY=firestore` lazily constructs the Firebase Admin
bridge using `INTERVIEW_FIREBASE_PROJECT_ID` and
`INTERVIEW_FIREBASE_CREDENTIALS_FILE`. `INTERVIEW_FIRESTORE_COLLECTION` defaults to
`interviewSessions`. Missing dependency/configuration or initialization failure is reported as a
safe configuration error; persistence never falls back automatically.

The compatibility audit used Firebase Admin 7.5.0 and google-cloud-firestore 2.28.1. The SDK is
synchronous, so the bridge executes document calls and the complete transactional wrapper with
`asyncio.to_thread`, avoiding event-loop blocking without a custom thread pool. Document `create`
supplies atomic create-if-absent behavior.

The SDK's `Transaction.get(document_reference)` returns a snapshot generator, which the bridge
materializes inside the blocking boundary. Transactions use `firestore.transactional` so the SDK
begins, binds reads/writes to, commits, and rolls back the correct transaction ID. The bridge creates
the transaction with `max_attempts=1`, so the application callback is not replayed after an ABORTED
commit. Public `Transaction.commit()` is not used because it follows inherited batch semantics.

Tests use injected fake SDK and transactional objects, require no credentials, and make no network
calls. This standalone engine does not reuse the main CV platform's Firebase configuration.

## P. Undecided main-platform topology

This implementation only makes the standalone Interview Engine capable of using Firestore. It does
not choose the final deployment topology:

- Option A: the main CV platform/Express owns Firestore and sends interview data over HTTP.
- Option B: the Interview Engine receives trusted identity context and owns its Firebase Admin
  persistence.

Credentials are not shared or reused automatically. That decision belongs to a later integration
design phase.

## Q. Worker coordination

The `InterviewService` mutation lock coordinates mutations only within one process. It is not a
distributed lock. Firestore transactions and optimistic versions remain the cross-process
lost-update protection, so a concurrent caller can receive `SESSION_CONFLICT`. The in-memory
repository is process-local and must run with exactly one worker; restart loses its sessions.
