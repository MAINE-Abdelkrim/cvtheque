# CVparser Integration — Candidate Flow, Phases 0–3

Implementation date: 2026-08-06  
Repository: React 19/Vite SPA + Express + separate FastAPI CVparser

## Outcome

The candidate upload flow now uses the real CVparser through an authenticated Express boundary:

```text
CandidateView -> POST /api/cv/parse -> Firebase Admin authorization
              -> POST FastAPI /api/v1/cv/parse (multipart field: file)
              -> safe DTO mapper -> structured candidate review UI
```

The browser never receives the FastAPI URL and never calls FastAPI directly. The integration does not create scores, recommendations, embeddings, Gemini/Qwen calls, or persistence records. `MODEL_ENABLED=false` is supported and was used for the baseline.

## Files changed

Modified:

- `.env.example`
- `package.json` (added only the `test:cv` script; dependencies unchanged)
- `server.ts`
- `src/components/dashboard/candidate-view.tsx`
- `docs/CVPARSER_INTEGRATION_AUDIT.md`

Created:

- `src/types/cv-parser.ts`
- `src/server/config.ts`
- `src/server/cv-auth.ts`
- `src/server/cv-errors.ts`
- `src/server/cv-mapper.ts`
- `src/server/cv-parser-client.ts`
- `src/server/cv-route.ts`
- `src/server/cv-upload.ts`
- `src/lib/api/cv-parser-client.ts`
- `src/components/cv/cv-structured-result.tsx`
- `src/components/cv/cv-warning-list.tsx`
- `tests/cv-integration.test.ts`
- `docs/CVPARSER_INTEGRATION_PHASE_1.md`

No file under `CVparser/.../app` was changed. `recruiter-view.tsx`, matching, Firestore rules/schema, parser internals, parser `.env`, frontend `.env`, and model files were not changed.

## Dependencies

No dependency was added and `bun.lock` was not changed. Bun is unavailable on this machine and `node_modules` is absent.

The server uses Node 24's built-in Fetch API `Request.formData()`, `FormData`, `Blob`, and `AbortController`. Express request bytes are read through a strict bounded buffer before multipart parsing. This avoids base64 JSON and avoids relying on an undeclared transitive multipart package. The deployment runtime must retain these Node Web APIs; a future move to an older Node runtime would require an approved Bun-locked multipart dependency.

## Security fixes

1. Removed hard-coded Cloudinary credential fallback values from `server.ts`.
2. Cloudinary is configured only when all three server environment variables are present; its existing upload route returns a safe 503 when configuration is incomplete.
3. Added Firebase Admin middleware for the new CV endpoint:
   - requires a Bearer token;
   - verifies the ID token with revocation checking;
   - reads the server-side Firestore user profile;
   - requires `isActive === true`;
   - requires role `CANDIDATE`.
4. Added strict server validation for one PDF, filename extension, MIME type, nonempty bytes, configured size, and `%PDF-` signature after ASCII whitespace.
5. Added explicit parser timeout and safe network/timeout mappings.
6. Added an allowlist-style DTO mapper. Raw text, cleaned text, sections, pages, OCR/page text, columns, pipeline steps, internal timing, `llm_available`, stack traces, paths, and raw exceptions are not returned.
7. Parser warning text is not forwarded verbatim; the server emits a generic candidate-friendly `PARTIAL_EXTRACTION` warning.
8. Technical error logs contain only generated request ID, verified UID (or `unverified`), safe code/status, duration, and upload size. They do not log tokens, PDF bytes, parsed JSON, or CV fields.

### Required owner action

Credentials that were previously exposed in application source or repository history **must be revoked and rotated by the project owner**. This implementation does not and cannot rotate external credentials automatically. The sensitive `firebase-service-account.json` file was neither displayed nor modified during implementation.

Existing admin, registration, Cloudinary, Gemini, and mock profile routes identified as unprotected in the audit remain outside this phase and must be secured separately.

## Environment variables

Added to root `.env.example` with empty values:

```env
CV_PARSER_API_URL=
CV_PARSER_TIMEOUT_MS=
CV_UPLOAD_MAX_BYTES=
```

They are server-only and must never use `VITE_` or `NEXT_PUBLIC_` prefixes. Safe code defaults when variables are absent:

- URL: `http://127.0.0.1:8000`
- timeout: `60000` ms
- upload maximum: `10485760` bytes (10 MiB)

Explicit invalid URLs or non-positive/non-integer numeric settings fail safely instead of being silently accepted.

## Express route contract

### Request

`POST /api/cv/parse`

- Header: `Authorization: Bearer <Firebase ID token>`
- Content type: `multipart/form-data` with an automatically generated boundary
- Exactly one file field named `file`
- PDF MIME `application/pdf`
- `.pdf` filename
- nonempty, at most configured bytes, valid `%PDF-` signature

Express forwards the file to `${CV_PARSER_API_URL}/api/v1/cv/parse` as multipart field `file`. It does not manually set the outbound `Content-Type`, allowing Fetch to generate the boundary.

### Success

```json
{
  "status": "success",
  "cv": {
    "identity": {
      "full_name": null,
      "email": null,
      "phone": null,
      "linkedin": null,
      "github": null,
      "website": null,
      "location": null,
      "job_title": null,
      "other_links": []
    },
    "summary": null,
    "skills": [],
    "languages": [],
    "certifications": [],
    "education": [],
    "experiences": []
  },
  "warnings": [],
  "metadata": {
    "pageCount": 1,
    "extractionMethod": "native_pdf"
  }
}
```

### Error

```json
{
  "error": {
    "code": "CV_PARSER_UNAVAILABLE",
    "message": "The CV analysis service is temporarily unavailable.",
    "details": []
  }
}
```

Stable mappings include `INVALID_PDF`/400, `FILE_TOO_LARGE`/413, `PDF_PAGE_LIMIT_EXCEEDED`/413, `UNSUPPORTED_FILE_TYPE`/415, `IMAGE_ONLY_PDF`/422, `CV_PARSER_TIMEOUT`/504, `CV_PARSER_UNAVAILABLE`/503, and sanitized `INTERNAL_ERROR`/500. Raw FastAPI details are not forwarded.

## Candidate interface

The existing dashboard design is retained. The candidate upload panel now:

- accepts PDF only and displays the 10 MiB/20-page policy;
- validates MIME, extension, empty file, and size before requesting the server;
- obtains the current Firebase ID token through the focused API client;
- supports idle, selected, validating, uploading, parsing, success, error, and cancelled states;
- provides cancellation through `AbortController`;
- contains no fake timer, fake upload, filename-derived skill extraction, new `aiScore`, or parser-generated recruiter feedback;
- keeps the result only in React state;
- renders name, title, email, phone, location, summary, skills, experience, education, languages, certifications, and friendly warnings;
- displays `Not detected` for missing values;
- does not overwrite the authenticated account profile.

Legacy persisted/mock CV history and the separate matching simulator remain visible because persistence and matching were explicitly out of scope. The new parsing path does not write to that history or invoke `dbEngine.uploadCV`.

## Local startup

Terminal 1:

```powershell
cd "CVparser/ai-cv-parser-api-&-test-studio (1)"
$env:MODEL_ENABLED='false'
.\.venv-llm\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```powershell
bun install --frozen-lockfile
bun run dev
```

Firebase Admin server variables and Firebase client configuration must be valid. Simulation-only authentication cannot satisfy the new endpoint's valid-ID-token requirement.

## Tests and verification

### Before edits

- Git status: blocked because the `git` executable is unavailable on `PATH`; `.git` exists.
- Web install/typecheck/build: blocked because Bun is unavailable and `node_modules` is absent.
- Python 3.12.10 `.venv-llm` `pip check`: passed (`No broken requirements found`).
- CVparser suite with `MODEL_ENABLED=false`: **446 passed, 53 warnings in 23.93 seconds**.

### Focused tests added

`tests/cv-integration.test.ts` covers:

- missing/invalid authentication, unavailable Admin, inactive account, wrong role, valid candidate;
- missing/multiple files, non-PDF, empty, oversized, invalid signature, valid synthetic PDF;
- client PDF/DOCX/size validation;
- safe success mapping and forbidden-field exclusion;
- invalid response sanitization;
- FastAPI 400/413/415/image-only 422 mappings;
- timeout, unavailable service, successful forwarding, and exact outbound `file` field.

Run when Bun dependencies are available:

```powershell
bun run test:cv
bun run lint
bun run build
```

These JavaScript/TypeScript commands were **not executed in this environment** and are not claimed as passing. No alternative package manager or lock file was used. Static searches confirmed removal of the old fake candidate upload handler/call and absence of forbidden diagnostics in browser-facing contract/client/components.

## Known limitations

- No Phase 4 persistence: parsed state disappears on refresh and no original file is stored.
- No private object-storage implementation or deletion lifecycle.
- Browser Fetch does not expose upload byte progress; UI state distinguishes request initiation and server parsing but does not show a percentage.
- Cancellation aborts the browser request; downstream server/parser cancellation depends on runtime propagation and may not stop CPU work already underway.
- The multipart implementation buffers at most the configured file limit plus 64 KiB envelope overhead. It is bounded but not disk-streamed; this matches the parser's own in-memory behavior for the current 10 MiB limit.
- The parser remains synchronous and no queue/retry was added.
- OCR/image-only policy and parser internals are unchanged.
- The current Node runtime is 24.15.0 and no runtime pin exists yet.
- Unrelated pre-existing Express routes remain unprotected as documented in the audit.
- Git status and frontend build certification remain blocked by missing executables/dependencies.

## Exact remaining Phase 4 work

1. Select private object storage and define signed retrieval, retention, and deletion policy.
2. Define a versioned Firestore CV record with owner UID, private object key, original filename/type/size, status, structured safe data, parser/schema versions, warnings, and timestamps.
3. Persist immutable parser output separately from candidate-confirmed edits.
4. Add idempotency and transactional cleanup so storage or database failures cannot create orphaned files/records.
5. Move CV history reads/writes behind authenticated Express APIs and enforce owner/recruiter campaign scope server-side.
6. Update Firestore rules and indexes after the schema and access policy are approved.
7. Add authorized download/delete endpoints and audit logging.
8. Replace or clearly separate legacy mock `CandidateCV` history from real parsed records.
9. Add end-to-end persistence, authorization, deletion, and retention tests using synthetic PDFs only.

The candidate parser transport is implemented, but the overall CV integration must not be considered production-complete until these Phase 4 privacy and persistence controls are delivered.
