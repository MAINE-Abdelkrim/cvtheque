# Candidate Interview frontend

The candidate Interview is available at `/dashboard/candidate/interview`.

```text
Candidate browser
  ↓ Firebase-authenticated request
Express backend
  ↓ internal service authentication
Interview Engine
```

The browser communicates only with relative Express `/api/...` routes. It never contacts the Interview Engine directly and never receives its internal token or owner header.

The current MVP requires the authenticated candidate's processed current CV. The candidate may optionally choose one open Job loaded from the candidate-safe `GET /api/jobs/open` Express endpoint; leaving the selection empty starts a general CV-based Interview.

```text
Candidate
  ↓ processed CV required
  ↓ optional OPEN Job from Express
POST /api/interviews
  ↓ Express loads trusted CanonicalCV and optional CanonicalJob
Interview Engine
```

The browser sends only `cvId` and, when selected, `jobId`. It never sends a CanonicalJob object or accesses recruiter-private Job fields. Express reloads and validates the selected Job as `OPEN` at Interview start, so the browser's earlier Job list is not authoritative.

Refresh recovery stores only the Interview session ID in `sessionStorage`; tokens, candidate identity, answers, CV data, and reports are not stored there. The session is reconstructed from Express.

Voice and recruiter Interview management are not implemented. Provider/mock behavior remains server-side.

## Interview history and resume

Authenticated candidates can open `/dashboard/candidate/interviews`. The browser calls only the candidate-authenticated Express `GET /api/interviews` endpoint. Express supplies the authenticated owner context to the Engine's existing owner-scoped history endpoint.

History contains only status, type, dates, progress, and completed score/classification. It excludes owners, CV/Job snapshots, questions, answers, evaluations, detailed reports, prompts, and provider data. `IN_PROGRESS` sessions resume through the existing session retrieval flow; completed sessions reuse the existing report endpoint.

Durable production history requires `INTERVIEW_REPOSITORY=firestore` and deployment of the `interviewSessions` composite index declared in `firestore.indexes.json` (`owner_id` ascending, `created_at` descending, document ID descending). The index is configuration only and is not deployed automatically.
