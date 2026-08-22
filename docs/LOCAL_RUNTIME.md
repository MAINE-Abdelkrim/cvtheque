# Local Runtime

## Architecture

The browser opens the Node application at `http://localhost:3000`. The same Node process serves the React/Vite frontend and the authenticated Express API.

```text
Browser :3000
  -> Node/Express + Vite :3000
       -> Firebase Authentication and Cloud Firestore
       -> CV Parser FastAPI :8001
       -> Matching Engine FastAPI :8002
       -> Interview Engine FastAPI :8003
       -> Gemini API (optional description import only)
```

Express owns authentication checks and Firestore access for canonical CVs, canonical Jobs, Admin mutations, matching, and Interview ownership. The Python services receive JSON/files from Express. In demo mode, Parser and Matching are stateless and Interview uses process-local in-memory persistence.

## Runtime matrix

| Service | Start directory | Command | Port | Health | Required local configuration |
| --- | --- | --- | ---: | --- | --- |
| Express + Vite | repository root | `npm run dev` | 3000 | `/api/health` | Local service URLs and the same Interview token as the Engine; Firebase only for live authentication/persistence |
| CV Parser | repository root | `npm run dev:parser` | 8001 | `/health` | `MODEL_ENABLED=false` |
| Matching Engine | repository root | `npm run dev:matching` | 8002 | `/health` | None for deterministic scoring |
| Interview Engine | repository root | `npm run dev:interview` | 8003 | `/health` | `INTERVIEW_PROVIDER=mock`, `INTERVIEW_REPOSITORY=in_memory`, internal auth enabled, and a process-only token |

Job AI runs inside Express. It is not needed for the deterministic E2E/demo path; create Jobs manually and leave `GEMINI_API_KEY` unset.

## First-time setup

### Node application

Install a current Node.js LTS release, open PowerShell in the repository root, and run:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` with the Firebase configuration for the target development project. Do not commit `.env` or a service-account file.

### CV Parser

The parser is in `CVparser/ai-cv-parser-api-&-test-studio (1)`. It requires Python 3.12 on Windows. Do not use Python 3.14 for this service.

```powershell
Set-Location "CVparser/ai-cv-parser-api-&-test-studio (1)"
py -3.12 -m venv .venv-llm
& .\.venv-llm\Scripts\python.exe -m pip install --upgrade pip setuptools wheel
& .\.venv-llm\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Tesseract OCR is a separate installation. Put it on `PATH`, or set `TESSERACT_CMD` in the parser's `.env`. Native-text PDFs do not normally require OCR, but image-only documents do.

For optional PyTorch/Transformers or llama.cpp model support, install the additional requirements only on the machine intended for model testing:

```powershell
& .\.venv-llm\Scripts\python.exe -m pip install -r requirements-llm.txt
```

This installation may be large. The repository does not require it for deterministic parsing.

### Matching Engine

The deterministic matcher is in `matching-engine` and requires Python 3.11 or newer. Python 3.12 can be shared as a version, but use a separate virtual environment.

```powershell
Set-Location matching-engine
py -3.12 -m venv .venv
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

The matcher needs no model, API key, network service, or database during scoring.

### Firebase

The browser client needs the six `VITE_FIREBASE_*` values in the root `.env`, or equivalent non-secret application configuration in `firebase-applet-config.json`.

Express needs Firebase Admin credentials. Use one of these approaches:

1. Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` in the root `.env`; or
2. Place an uncommitted `firebase-service-account.json` at the repository root.

Never expose Admin credentials through a `VITE_` variable. Email/password and Google providers must be enabled in Firebase Authentication, and `localhost` must be an authorized domain for Google sign-in.

Before real validation, deploy the repository's `firestore.rules` and `firestore.indexes.json` to the selected development Firebase project. Deployment is deliberately not part of local startup.

### Interview Engine

The Interview Engine requires Python 3.12. Create its isolated environment in `interviewEngine`:

```powershell
Set-Location interviewEngine
py -3.12 -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

## Starting the application

Use four service terminals. A fifth terminal is useful for health checks. All commands assume the repository root is the initial directory and each environment assignment is process-local.

### Terminal 1: CV Parser

```powershell
Set-Location "CVparser/ai-cv-parser-api-&-test-studio (1)"
$env:MODEL_ENABLED='false'
& .\.venv-llm\Scripts\python.exe -B -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Port `8001` is intentional. The parser's standalone documentation defaults to `8000`, but Express defaults to `http://127.0.0.1:8001`.

### Terminal 2: Matching Engine

```powershell
Set-Location matching-engine
& .\.venv\Scripts\python.exe -m uvicorn app.api.fastapi_app:app --host 127.0.0.1 --port 8002 --workers 1 --no-access-log
```

Port `8002` is intentional. The engine's standalone README and Docker image use `8000`; the application integration uses `8002` to avoid the parser.

### Terminal 3: Interview Engine

Generate a temporary local token without writing it to a file. Set the same value in Terminal 4. Do not paste the value into logs, documentation, source, or a `VITE_` variable.

```powershell
Set-Location interviewEngine
$env:INTERVIEW_PROVIDER='mock'
$env:INTERVIEW_REPOSITORY='in_memory'
$env:INTERVIEW_INTERNAL_AUTH_ENABLED='true'
$env:INTERVIEW_INTERNAL_API_TOKEN='<temporary-process-only-token>'
& .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8003 --workers 1
```

### Terminal 4: Application

```powershell
$env:CV_PARSER_API_URL='http://127.0.0.1:8001'
$env:MATCHING_ENGINE_URL='http://127.0.0.1:8002'
$env:INTERVIEW_ENGINE_BASE_URL='http://127.0.0.1:8003'
$env:INTERVIEW_ENGINE_API_TOKEN='<same-temporary-process-only-token>'
npm run dev
```

`npm run dev` starts one `tsx server.ts` process on port `3000`. Express hosts the APIs and mounts Vite in middleware mode. It does not start any Python service.

Open `http://localhost:3000`.

For a production-style local run:

```powershell
npm run build
$env:NODE_ENV='production'
npm run start
```

Setting `NODE_ENV=production` is required so Express serves `dist` instead of creating Vite development middleware.

## Health checks

Run these after starting all four service terminals:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
Invoke-RestMethod http://127.0.0.1:8002/health
Invoke-RestMethod http://127.0.0.1:8003/health
Invoke-RestMethod http://localhost:3000/api/health
```

Expected minimums:

- Parser: HTTP 200 with an `ok` health status and model mode information.
- Matcher: `status: ok`, `service: matching-engine`, `version: 1.0.0`.
- Interview: `status: ok`, `service: ai-interview-engine`; health does not require the internal token.
- Express: `status: ok`; `firebaseAdmin` should say `configured` for real authenticated persistence tests.

Interactive Python API documentation is available on each Python service's `/docs` endpoint. The browser application must still call Express rather than those ports directly.

## Demo mode

- CV Parser: deterministic extraction with `MODEL_ENABLED=false`.
- Matching: deterministic rules engine.
- Interview: `mock` provider with `in_memory` repository and internal authentication enabled.
- Job creation: manual structured CanonicalJob path.
- Gemini: disabled and unnecessary; expected calls are zero.

## Deterministic parser mode

Deterministic mode is the default and recommended first validation mode:

```env
MODEL_ENABLED=false
```

It does not load Qwen, Transformers, or llama.cpp. Restart the parser after changing its `.env` or environment variables.

## Model-enabled parser mode

Model mode is optional. Configure it only after the deterministic end-to-end flow passes and the larger machine has the model files/dependencies available.

PyTorch/Transformers example using a model already available locally:

```env
MODEL_ENABLED=true
MODEL_PROVIDER=pytorch
MODEL_NAME=replace-with-the-tested-local-model-id-or-path
MODEL_LOCAL_FILES_ONLY=true
MODEL_DEVICE=auto
```

llama.cpp/GGUF example:

```env
MODEL_ENABLED=true
MODEL_PROVIDER=llama_cpp
MODEL_GGUF_PATH=C:\absolute\path\to\model.gguf
MODEL_LOCAL_FILES_ONLY=true
MODEL_N_THREADS=4
MODEL_CONTEXT_SIZE=1024
```

Do not point the service at a 7B model until the other machine's RAM/VRAM and local model path have been verified. Startup is lazy: model weights may load on the first parsing request rather than at health-check time.

## Optional Gemini configuration

`GEMINI_API_KEY` is optional. Without it, manual canonical Job creation remains usable. Only the Recruiter “Importer une description” extraction request becomes unavailable and returns a controlled service-unavailable response. Do not put the key in a `VITE_` variable.

## Stopping the services

Press `Ctrl+C` once in each of the four service terminals. Stop only the process owned by that terminal. No service should be launched with a reloader for the manual E2E run, so each terminal owns one application process (the parser may still use native library worker threads internally). Clear the temporary Interview token variables when finished.

Confirm shutdown:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000,8001,8002,8003 -ErrorAction SilentlyContinue
```

## Common errors

### Port already occupied

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000,8001,8002,8003 | Select-Object LocalPort,OwningProcess
```

Identify the process before stopping it. Do not kill every Node or Python process. The expected mapping is 3000 = Node, 8001 = parser, 8002 = matcher, 8003 = Interview.

### Firebase Admin unavailable

Confirm either the three `FIREBASE_*` Admin variables or the root `firebase-service-account.json` exists. Restart Node after changing credentials. `/api/health` must report Firebase Admin as configured.

### Invalid Firebase token

Confirm browser and Admin configuration target the same Firebase project, the user has a corresponding `users/{uid}` profile, the account is active, and the role matches the requested route.

### CV Parser unavailable

Check `http://127.0.0.1:8001/health`, `CV_PARSER_API_URL`, the parser terminal, and that the command was run from the parser directory. A 404 from the upstream usually means the wrong FastAPI application is running on the configured port.

### Matching Engine unavailable

Check `http://127.0.0.1:8002/health`, `MATCHING_ENGINE_URL`, and the matching terminal. Express calls `/api/v1/rank-candidates` once per matching request.

### Missing Firestore index

Use the index link from the controlled Firebase error or deploy `firestore.indexes.json` to the development project. Do not weaken the query or remove the canonical marker as a workaround.

### Python virtual environment missing

Re-run the relevant first-time `py -3.12 -m venv .venv` command in that service directory, then install its requirements. Do not reuse the parser environment for the matcher.

### Model disabled

This is normal in deterministic mode. The parser health response reports the model as disabled. Set `MODEL_ENABLED=true` only for a deliberate model-enabled test and restart the parser.

### Gemini key absent

Manual Job creation still works. Description import reports that the optional assistant is unavailable. Configure `GEMINI_API_KEY` in the root `.env` and restart Node if that feature is needed.
