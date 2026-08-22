# CanonicalCV v1

The main platform owns CanonicalCV v1. Its implementation types are `CVStructuredData` and
`CanonicalPersistedCV` in `src/types/cv-parser.ts`; the persisted schema version is
`parsing.schemaVersion = 1`.

## Record envelope

| Contract name | Current field | Meaning |
|---|---|---|
| `cvId` | `id` | Firestore CV document ID; identifies one persisted CV record |
| `candidateUserId` | `uid` | Authenticated Firebase candidate UID and CV owner |
| `schemaVersion` / `cvVersion` | `parsing.schemaVersion` | Canonical data-contract version, currently `1`; not an edit revision |
| `isCurrent` | `isCurrent` | Whether this record is the candidate's current CV for this schema version |
| structured content | `parsedData` | CanonicalCV content below |
| provenance | `file`, `parsing` | Private file metadata and parser provenance; never an AI-service input by default |

## Structured content

- `identity`: `full_name`, `email`, `phone`, `linkedin`, `github`, `website`, `location`,
  `job_title`, and `other_links`. Nullable scalar values mean not extracted; lists use `[]`.
- `summary`: nullable source-grounded professional summary.
- `skills`: `{name, category, source}[]`; `name` is required, while category/provenance are nullable.
- `experiences`: `{job_title, company, location, start_date, end_date, description}[]`.
- `education`: `{degree, field_of_study, institution, location, start_date, end_date, description}[]`.
- `languages`: `{language, level, original_level}[]`.
- `certifications`: `{name, issuer, date, credential_id}[]`.

Dates are source-oriented strings in v1, not guaranteed ISO values. Consumers that require ISO
dates must use an explicit adapter and must not invent an unparseable date. Projects are absent
because they are not implemented. Parser diagnostics/raw text are not canonical platform fields.

## Ownership

The CV Parser schema is extraction output. Interview and Matching schemas are consumer contracts.
Neither replaces this platform record. See `AI_SERVICE_CONTRACTS.md`.
