# CV Parser Dependency & Runtime Documentation

This document describes the validated Python runtime, dependency files, installation instructions, server configurations, and reproducibility guarantees for the CV Parser project.

## Supported Python Version
- **Python Version**: `3.11.x` (validated on Python `3.11.2`)

## Dependency Strategy & Architecture
The repository separates dependencies into distinct functional files for security, lightweight default setups, and developer isolation:

1. **`requirements.txt`**: Standard production dependencies with compatible version bounds. Does not contain any heavy machine learning models, test-only utilities, or platform-specific package locks.
2. **`requirements-dev.txt`**: Test, linting, formatting, and static analysis libraries.
3. **`requirements-llm.txt`**: Optional dependencies required for running real Qwen2.5 model weights (Qwen2.5-0.5B-Instruct default, with CPU/GPU acceleration and quantization).
4. **`requirements-lock.txt`**: Complete, transitive package locks captured directly from the validated, green container environment for absolute reproducibility.

---

## Installation Commands

### 1. Default (Lightweight Deterministic Application)
To install only the core document parsing, OCR, web framework, and UI utilities:
```bash
pip install -r requirements.txt
```
This is the recommended default setup. It is lightweight, contains no heavy deep-learning frameworks (such as `torch` or `transformers`), and supports fully deterministic, high-speed resume processing.

### 2. Development Setup (With Testing Tools)
To install the core requirements along with unit testing and formatting engines:
```bash
pip install -r requirements.txt -r requirements-dev.txt
```

### 3. Optional LLM Execution Setup (Qwen2.5)
To enable optional GPU-accelerated local Qwen inference (requires compatible hardware):
```bash
pip install -r requirements.txt -r requirements-llm.txt
```

---

## Runtime Configurations

### Default Execution Mode
- **`MODEL_ENABLED`**: Defaults to `False`. The application operates in high-performance, deterministic mode using regular expressions, native text extractions, and Tesseract OCR.
- **Lazy Loading**: If `MODEL_ENABLED` is set to `True`, the `QwenLLMClient` lazily imports `torch` and `transformers` only upon the first `load()` or `generate()` call. No eager memory allocations or remote downloads occur during application startup.

### LLM Architecture & Model Selection
The default model is configured as **`Qwen/Qwen2.5-0.5B-Instruct`**.

#### Why 0.5B is the Recommended Development Default:
- **Low Memory & Low Latency**: Runs seamlessly on standard developer laptops and CPU/small GPU sandbox environments without VRAM overflow or system stalls.
- **Structured Information Extraction**: Perfectly suited for targeted field enrichment (filling missing CV fields) without requiring excessive compute.
- **Generic Architecture**: The underlying `QwenLLMClient` and factory are fully model-agnostic. Upgrading or switching models requires zero code refactoring—simply set `MODEL_NAME`.

#### Hardware Requirements Matrix:
| Model Variant | Parameters | Recommended Context | Memory (FP16/BF16) | Recommended Hardware | Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Qwen/Qwen2.5-0.5B-Instruct** | 0.49 Billion | 512–1024 tokens | ~1.0 GB VRAM / ~2 GB RAM | CPU / Integrated / Entry GPU | **Local Development Default** |
| **Qwen/Qwen2.5-1.5B-Instruct** | 1.54 Billion | 512–2048 tokens | ~3.0 GB VRAM / ~4 GB RAM | Mid-range GPU / Apple Silicon | Balanced Dev & Testing |
| **Qwen/Qwen2.5-3B-Instruct** | 3.09 Billion | 512–4096 tokens | ~6.0 GB VRAM / ~8 GB RAM | Dedicated GPU (6GB+ VRAM) | High-accuracy Production |

#### How to Switch Models via Configuration:
To change models, update `MODEL_NAME` in `.env` or set environment variables:
```bash
# Example: Upgrade to 1.5B
export MODEL_NAME="Qwen/Qwen2.5-1.5B-Instruct"

# Example: Upgrade to 3B for production deployment
export MODEL_NAME="Qwen/Qwen2.5-3B-Instruct"
```
No code modifications, imports, or client refactoring are required.

### Gradio Server Configuration
The Gradio demonstration interface (`app/ui/gradio_app.py`) can be customized via standard environment variables:
- **`GRADIO_SERVER_NAME`**: The host address to bind the server to (defaults to `0.0.0.0`).
- **`GRADIO_SERVER_PORT`**: The port to listen on (defaults to `7860`). This prevents conflicts with the planned Next.js development server on port `3000`.
- **`GRADIO_SHARE`**: Boolean (`True`/`False`) to enable Gradio public link sharing (defaults to `False`). Only valid boolean strings (true/false, 1/0, t/f, yes/no) are accepted.

#### Standalone Launch Command
To start the Gradio interface:
```bash
python3 -m app.ui.gradio_app
```

### FastAPI API Server Configuration
To start the production FastAPI backend:
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

---

## Gradio & Hugging Face Hub Pinning
To resolve known import regressions with newer versions of `huggingface-hub` (which removed `HfFolder` expected by Gradio `4.39.0`), the dependency is strictly bounded in `requirements.txt` to:
```text
huggingface-hub>=0.23.0,<0.25.0
```
This guarantees Gradio imports correctly without any runtime package mutations or startup crashes.

---

## Running Tests
To run the complete test suite containing all 329 unit, regression, integration, and import safety checks:
```bash
python3 -m pytest tests/ -v -W default
```

---

## Known Third-Party Warnings
When executing tests or launching servers, you may see minor third-party warnings from dependency libraries (such as Starlette, FastAPI, or Gradio):
- **FastAPI / Starlette test client**: Warning about `httpx` and `starlette.testclient` deprecation is safe to ignore (originating from fastapi's core client wrappers).
- **Gradio Multipart / Event loop**: Minor deprecation warnings related to `python-multipart` or FastAPI lifespan events inside Gradio’s internal routing middleware.
These are benign third-party warnings and do not affect application safety or functionality.
