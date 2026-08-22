# Canonical job persistence

## Flow

The rich recruiter form and optional Gemini prefill remain unchanged as a user experience. Final submission now obtains a Firebase ID token and calls authenticated `POST /api/jobs`. Express verifies an active recruiter, validates and normalizes the job with Zod, derives `recruiterId` from the verified token, and writes through Firebase Admin.

The Firestore document ID is returned as the public `id`; no second ID is stored in the document.

## Canonical schema

Canonical `jobs/{jobId}` documents are flat for compatibility with the current dashboards. They contain recruiter ownership, matching fields, `status`, `schemaVersion: 1`, and server timestamps. Matching fields include required/preferred skills, numeric experience limits, education, languages, location, work mode, contract type, remote policy, and mandatory requirements.

Strings are trimmed, empty list values are removed, exact duplicates are removed, enums and nested objects are validated, and maximum experience cannot be below minimum experience. New jobs are always `OPEN`. Clients cannot set ownership, status, versions, IDs, or timestamps.

## Gemini

`/api/jobs/ai-generate` now requires an active Premium recruiter verified by Firebase Admin. Gemini still returns conversational text plus a fenced draft. The draft is schema-validated on the server and again by the client before the explicit prefill action. Invalid drafts are not applied; the reply remains visible and manual entry remains available.

Gemini-proposed `job_id` and `scoring_weights` are discarded. Matching owns its default weights; recruiters do not configure them in this MVP.

## Ownership and access

Canonical writes and deletion use Firebase Admin. Repository deletion verifies that `job.recruiterId` equals the authenticated recruiter UID. `GET /api/jobs/mine` derives ownership from authentication and returns only that recruiter's canonical jobs.

Client Firestore rules deny canonical writes. Candidates may read only `OPEN` jobs. Recruiters and admins may read jobs, while temporary legacy client writes are restricted to the owning recruiter. Legacy records lack `schemaVersion: 1` and are excluded from canonical repository and matcher queries.

## Retrieval and matching

The server repository exposes retrieval by Firestore document ID, recruiter-owned history, and all OPEN canonical jobs. A future matcher can combine `getCanonicalJobById(jobId)` with current canonical CV records without reparsing job descriptions. No matching algorithm or public all-canonical-jobs route is included.
