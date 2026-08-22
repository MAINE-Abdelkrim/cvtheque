# AI CV Parser

An AI-assisted, privacy-first Curriculum Vitae (CV) parsing engine with high-speed deterministic extraction and optional LLM-assisted completion layer.

## Overview

The CV Parser uses a hybrid architecture:
1. **Deterministic Layer (Primary Source of Truth)**: Regex pattern matching, rule-based field parsing, and Tesseract OCR for fast, zero-LLM extraction of text, contact identity, work experience, education, skills, and languages.
2. **LLM Completion Layer (Optional)**: Safe, hallucination-free missing field completion using the local **Qwen2.5-0.5B-Instruct** open-weights model. Protected deterministic values are strictly preserved and never overwritten.

---

## Model Configuration & Architecture

### Default Development Model: `Qwen/Qwen2.5-0.5B-Instruct`
- **Lightweight & Fast**: Tailored for local development on standard machines without requiring dedicated GPU acceleration.
- **Resource Efficient**: Requires ~1.0 GB VRAM / ~2.0 GB RAM for FP16 inference.
- **Structured Extraction**: Optimized for targeted JSON field completion without altering protected deterministic extraction results.

### Device Selection Strategy
- **Generic Repository Default**: `MODEL_DEVICE="auto"` (automatically uses CUDA if available, MPS on Apple Silicon, or falls back to CPU).
- **Windows Low VRAM Recommendation**: On machines with entry-level GPUs (such as NVIDIA MX330 with 2GB VRAM), set `MODEL_DEVICE="cpu"` in `.env` to prevent VRAM out-of-memory errors during model inference.

### Model Scalability
The underlying LLM client architecture (`QwenLLMClient` and `create_llm_client`) is entirely generic and configuration-driven. Changing the model from **0.5B** to **1.5B** or **3B** requires only updating the configuration parameter `MODEL_NAME`:

| Model Identifier | Parameters | Memory (FP16) | Recommended Hardware | Primary Target |
| :--- | :--- | :--- | :--- | :--- |
| `Qwen/Qwen2.5-0.5B-Instruct` | 0.49B | ~1.0 GB | CPU / Integrated / Entry GPU | **Local Development Default** |
| `Qwen/Qwen2.5-1.5B-Instruct` | 1.54B | ~3.0 GB | Apple Silicon / Mid GPU | Balanced Testing |
| `Qwen/Qwen2.5-3B-Instruct` | 3.09B | ~6.0 GB | Dedicated GPU (6GB+ VRAM) | High-Precision Production |

To switch models, set the `MODEL_NAME` environment variable in `.env`:
```bash
MODEL_NAME="Qwen/Qwen2.5-1.5B-Instruct"
```

---

## Prompt Bounding & Input Strategy

To handle long multi-page CVs safely without exceeding small model context limits:
- The system uses a **section-aware input selection strategy** instead of simple character slicing.
- Fields missing in deterministic output are mapped to priority section headers (e.g. skills, experience, personal summary).
- Repeated whitespace and duplicated section headers/footers are stripped.
- A warning is recorded whenever content is trimmed due to context bounds.

---

## Installation & Setup

Use **Python 3.12** on Windows. Do not create this project's environment with
Python 3.14. The commands below select Python 3.12 explicitly and create a new
environment alongside the existing `.venv-llm` so it can be validated before
the old environment is removed.

```powershell
# Verify that Python 3.12 is installed.
py -3.12 --version

# Create and verify a clean replacement environment.
py -3.12 -m venv .venv-new
& .\.venv-new\Scripts\python.exe --version
& .\.venv-new\Scripts\python.exe -m pip install --upgrade pip setuptools wheel
```

### 1. FastAPI, Deterministic Parser, PDF, and OCR

```powershell
& .\.venv-new\Scripts\python.exe -m pip install -r requirements.txt
```

This is the lightweight backend installation. It does not install Gradio,
PyTorch, Transformers, or local model tooling. Tesseract OCR is a separate
Windows application and must be installed independently; set `TESSERACT_CMD`
in `.env` if it is not available on `PATH`.

### 2. Development and Testing

```powershell
& .\.venv-new\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt
```

### 3. Optional Gradio Test Studio

```powershell
& .\.venv-new\Scripts\python.exe -m pip install -r requirements.txt -r requirements-ui.txt
```

### 4. Optional Local Qwen LLM

```powershell
& .\.venv-new\Scripts\python.exe -m pip install -r requirements.txt -r requirements-llm.txt
```

Install both optional modes when developing the complete local application:

```powershell
& .\.venv-new\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt -r requirements-ui.txt -r requirements-llm.txt
```

Before removing `.venv-llm`, verify the replacement environment:

```powershell
& .\.venv-new\Scripts\python.exe --version
& .\.venv-new\Scripts\python.exe -m pip check
& .\.venv-new\Scripts\python.exe -m pytest
```

Keep `.venv-llm` until these checks complete successfully.

---

## Configuration Settings (`.env`)

```env
# API Server Configuration
APP_NAME="AI CV Parser API"
APP_HOST="127.0.0.1"
APP_PORT=8000
LOG_LEVEL="INFO"

# LLM Configuration
MODEL_NAME="Qwen/Qwen2.5-0.5B-Instruct"
MODEL_ENABLED=false
MODEL_LOCAL_FILES_ONLY=true
MODEL_DEVICE="auto"
MODEL_TORCH_DTYPE="auto"
MODEL_MAX_NEW_TOKENS=512
MODEL_DO_SAMPLE=false
MODEL_TEMPERATURE=0.0
MODEL_TOP_P=0.9
MODEL_REPETITION_PENALTY=1.1
```

---

## Utility Scripts & Tools

### Windows LLM Setup Script
Sets up a dedicated virtual environment (`.venv-llm`) and installs base and optional LLM packages on Windows without modifying global environments:
```powershell
.\scripts\setup_llm_windows.ps1
```

### Model Weight Downloader
Downloads and caches tokenizer and model artifacts into local Hugging Face cache using `snapshot_download` without instantiating model weight tensors in RAM:
```bash
python scripts/download_model.py --model Qwen/Qwen2.5-0.5B-Instruct --force
```

### Local Validation Benchmark
Executes a real model loading, synthetic generation test, memory safety check, and CV extraction benchmark:
```bash
python scripts/validate_qwen_local.py --skip-cv
```

### LLM Evaluation Harness
Evaluates safety constraints (protecting deterministic identity data) and enrichment performance comparing deterministic vs LLM runs:
```bash
python scripts/eval_harness.py --use-mock-llm
```

---

## Running the Application

### FastAPI Backend
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Gradio UI
```bash
python -m app.ui.gradio_app
```
The UI will be accessible at `http://localhost:7860`.

## API and Next.js Integration

- Health check: `GET /health`
- Parse a CV: `POST /api/v1/cv/parse` with a multipart PDF field named `file`
- Interactive API documentation: `http://127.0.0.1:8000/docs`
- OpenAPI schema: `http://127.0.0.1:8000/openapi.json`

See [docs/nextjs-integration.md](docs/nextjs-integration.md) for a copy-paste
Next.js App Router proxy and upload component.

## Repository checks

Pull requests and pushes run the deterministic test suite on Python 3.12 through
GitHub Actions. Run the same checks locally before pushing:

```powershell
& .\.venv-new\Scripts\python.exe -m pip check
& .\.venv-new\Scripts\python.exe -m pytest -q
```

The complete suite includes Gradio UI tests, so install `requirements-ui.txt`
as shown in the complete local-development command above before running it.
