# AI service contract ownership

```text
CV Parser extraction output
        |
        v
Platform CanonicalCV v1
        +--> CV -> Interview projection
        +--> CV -> Matching projection

Job AI recruiter draft
        |
        v
Platform CanonicalJob v1
        +--> Job -> Interview projection
        +--> Job -> Matching projection
```

Ownership rule:

- Platform `CanonicalCV` and `CanonicalJob` are authoritative product records.
- CV Parser models describe extraction output only.
- Interview models describe the Interview service input boundary only.
- Matching models describe the scoring input boundary only.
- Backend adapters are the explicit, testable translations between these contracts.

## CV to Interview

Name, job title, location, summary, skills, experiences, education, languages, and certification
name/issuer/date pass unchanged. Contact fields, links, `other_links`, certification
`credential_id`, file metadata, parser metadata/warnings, ownership, and timestamps are omitted.
The candidate owner is supplied separately as `candidateUserId`; the Interview CV payload never
selects ownership.

## Job to Interview

IDs, title, company, description, skills, location, work mode, and mandatory text map directly.
Minimum/maximum years, structured education, and structured languages are converted into stable
English text templates by `interview-contract-adapter.ts`; no LLM is involved. `remote_allowed`,
`contract_type`, recruiter ownership, status, timestamps, and schema metadata are intentionally
outside current `JobContext`. Snapshot metadata remains an eventual main-backend concern.

## Matching projections

CV skills are flattened to names and supported dates are normalized. Matching `candidate_id` is the
`cvId`. Job identity is renamed to `job_id`/`job_title`. Mandatory requirement text is preserved as
structured requirements with deterministic codes and `satisfied: null`; only real evidence may
later change satisfaction to true or false.

## Snapshot/version policy

At interview creation the main backend should retain, outside or alongside the service payload:
`candidateUserId`, `cvId`, CV `schemaVersion`, optional `jobId`, and optional Job `schemaVersion`.
Answers and reports always refer to the CV/Job snapshots captured at start; later edits must not
mutate an existing session's meaning.

MVP retention: retain the snapshot for the session/report lifetime, restrict it to the candidate
owner and trusted backend, and delete/anonymize it when the owning account is deleted. CV or Job
record deletion alone may leave an existing interview snapshot until the interview retention period
expires so the report remains auditable. A documented account-deletion cascade is required before
production RGPD sign-off.

## Interview internal trust rule

Integrated/production environments must use `INTERVIEW_INTERNAL_AUTH_ENABLED=true`, a server-only
current token (with the previous-token setting used only during rotation), and the configured owner
header containing the verified `candidateUserId`. The browser never receives the internal token and
never supplies authoritative ownership. Standalone mock development may keep authentication off.

## Job Parser MVP decision

For MVP, Job AI remains an internal backend module helping a recruiter construct CanonicalJob.
Canonical validation is the authoritative boundary. A separate JD Parser is postponed until
file-based JD parsing is required. The hardcoded Job Gemini model is P1 configuration cleanup, not a
P0 blocker.
