# CV Parser runtime integration diagnosis

## Objective

Determine why the web application displayed pre-generalization parsing while the validated parser test suite passed. The private diagnostic PDF was used locally only. No private content or identifiers are stored here.

## Runtime topology

```text
Browser http://localhost:3000
  -> POST /api/cv/parse
  -> Express/tsx server.ts on port 3000
  -> CV_PARSER_API_URL=http://127.0.0.1:8001
  -> POST http://127.0.0.1:8001/api/v1/cv/parse
  -> FastAPI app.main:app
  -> safe Express DTO mapper
  -> React CVStructuredResult
```

The frontend sends one multipart field named `file` and an authenticated bearer token. It does not parse CV text locally. CandidateView clears its previous parse state for each selected/uploaded file and renders the returned structured DTO directly. No parse-response cache, service worker, React Query, SWR, sessionStorage, or localStorage path participates in this request.

## Parser copies

Two plausible source copies were found:

| Source | Geometry ownership | Status |
| --- | --- | --- |
| `<repository-root>\CVparser\ai-cv-parser-api-&-test-studio (1)` | Present | Current validated source and `.venv-llm` |
| `<obsolete-download-location>\ai-cv-parser-api-&-test-studio (1)` | Absent | Older copy; not used by port 8001 |

The active project modules resolve to the first source tree. The runtime-selected files include `app/main.py`, the extraction pipeline, GeometrySectionService, and the experience, education, and certification extractors. Their combined diagnostic SHA-256 prefix after the restart was `adda6c4257fc`.

## Processes and ports

At diagnosis time:

- Express/Vite: Node PID 14072, `tsx server.ts`, ports 3000 and 24678, current web project.
- Configured CV Parser: port 8001. The stale parent/child processes were started at 13:19 without `--reload`.
- Unrelated FastAPI service: PID 19204 on port 8000 using Anaconda and `app.api.fastapi_app:app`. Express did not call this port.

After correction, port 8001 was served by PID 484 using Python 3.12 and:

```text
python -B -m uvicorn app.main:app
  --app-dir "<repository-root>\CVparser\ai-cv-parser-api-&-test-studio (1)"
  --host 127.0.0.1 --port 8001
```

The virtual-environment launcher is `.venv-llm\Scripts\python.exe`; on Windows it delegates to the Python 3.12 base executable while retaining the virtual environment through `sys.prefix` and its site-packages.

## Direct versus Express comparison

Only category-level results were recorded.

| Category | Stale direct FastAPI | Restarted direct FastAPI | Restarted Express client/mapper |
| --- | ---: | ---: | ---: |
| Summary | Incorrect neighboring heading | Correct nonempty summary | Correct nonempty summary |
| Skills | 0 | 4 | 4 |
| Experiences | 4, incorrectly grouped | 4 | 4 |
| Education | 2, partial | 2 | 2 |
| Languages | 3 | 4 | 4 |
| Certifications | 2 | 1 | 1 |

All calls returned HTTP 200. The Express client generated exactly `http://127.0.0.1:8001/api/v1/cv/parse`; the safe mapper preserved the restarted parser counts and summary state.

## Root cause

The FastAPI process was stale. It started around three hours before the latest parser source modifications and was launched without reload. Python had the old module objects resident in memory, so the UI correctly called port 8001 but received behavior from the pre-generalization code already loaded by that process.

This was integration case A: direct FastAPI was already wrong. Express mapping and frontend rendering were not the divergence point.

## Fix

No extraction, layout, section, API, mapper, or frontend code was changed. Only the stale port-8001 FastAPI parent/child processes were stopped and FastAPI was restarted from the exact current parser directory with `MODEL_ENABLED=false`.

## Verification

- FastAPI `/health`: HTTP 200.
- Express `/api/health`: HTTP 200 and Firebase Admin configured.
- Direct private-PDF parse: corrected category-level result.
- Express FastAPI client plus safe DTO mapper: identical corrected category-level result.
- The frontend displays that DTO without secondary parsing or result caching.

## Restart instructions

From the parser project directory:

```powershell
$env:MODEL_ENABLED='false'
& .\.venv-llm\Scripts\python.exe -B -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Restart FastAPI whenever parser Python source changes unless development uvicorn is deliberately run with a safe reload configuration. The Express server only needs restarting when its own code or startup-loaded environment changes.
