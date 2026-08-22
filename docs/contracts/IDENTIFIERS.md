# Identifier vocabulary

| Name | Current representation | Required semantics |
|---|---|---|
| `candidateUserId` | Firebase UID; persisted CV `uid` | Authenticated candidate/account owner |
| `recruiterUserId` | Firebase UID; Job `recruiterId` | Authenticated recruiter/account owner |
| `cvId` | Canonical CV `id` | One persisted CV Firestore document |
| `cvVersion` | `parsing.schemaVersion` | CV contract/data schema version; currently `1` |
| `jobId` | Canonical Job `id` | One persisted Job Firestore document |
| `jobVersion` | `schemaVersion` | Job contract/data schema version; currently `1` |
| `interviewSessionId` | Interview `session_id` UUID | One immutable-start-context interview session |
| `matchResultId` | Not implemented | Reserved for a future persisted matching result; never fabricate it |

Interview owner identity maps to `candidateUserId`, never `cvId`. With internal authentication,
the trusted owner header supplies this value and overrides/ignores request-body `candidate_id`.

Matching Engine `candidate_id` currently carries `cvId`, because ranking evaluates a specific CV
record/version. Express maintains a private `cvId -> candidateUserId` correlation and returns both
as distinct `cvId` and `candidateId` fields. This existing behavior is deliberate and is not renamed
silently.
