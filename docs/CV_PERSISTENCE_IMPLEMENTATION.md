# CV persistence implementation

## Flow

Previously, `/api/cv/parse` returned sanitized parser JSON that lived only in React state. The authenticated Express route now validates the PDF, computes its SHA-256 hash, checks for an equivalent canonical record, calls FastAPI when needed, validates useful content, and persists the result through Firebase Admin before reporting success.

The browser never supplies the owner UID or canonical parsed JSON. Ownership always comes from the verified Firebase principal at `request.candidate.uid`.

## Firestore document

Canonical records use `cvs/{cvId}` with `status: "PROCESSED"`, `isCurrent`, `uid`, `parsedData`, bounded `file` metadata, `parsing` metadata, and server timestamps. `parsedData` contains the complete sanitized `CVStructuredData`. `parsing` contains schema/parser versions, deterministic or hybrid mode, page count, extraction method, and bounded safe warnings.

Raw PDF bytes, extracted text, page diagnostics, prompts, raw model output, simulated scores, and simulated feedback are never persisted.

## Duplicates and history

SHA-256 is computed from server-received PDF bytes. Equivalence is scoped by `uid + SHA-256 + parserVersion + schemaVersion`. An equivalent record is returned instead of duplicated. A transaction rechecks equivalence, marks the candidate's previous canonical current record inactive, and creates the new current record. A failed transaction leaves the previous record unchanged.

Older canonical documents remain as history and can be queried by UID in descending creation order. Legacy simulator documents remain untouched and are excluded because they lack `parsedData` and `parsing.schemaVersion`.

## Versions

The persisted JSON contract is schema version 1. `CV_PARSER_VERSION` should be set by the deployment. When absent, the explicit value `local-unversioned` is stored rather than claiming a parser release that does not exist.

## Privacy and files

Only filename, MIME type, byte size, and SHA-256 are stored. There is no PDF upload to Cloudinary, Firebase Storage, or Firestore. Firestore client rules prevent recruiter browser access to canonical CV documents and prevent client creation or mutation of canonical records. Candidates may read their own canonical records; server-side matching can later use Firebase Admin.

Logs contain lifecycle data and record/version identifiers only, never parsed CV content or contact information.

## Future matching

The internal repository provides current canonical CV retrieval. A future server-side matcher can consume each record's `parsedData` directly. No public all-CV endpoint or matching behavior is implemented here.
