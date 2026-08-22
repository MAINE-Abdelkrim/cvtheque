# llama.cpp development runtime

## Purpose

This experiment keeps `Qwen2.5-0.5B-Instruct` and the existing hybrid CV
pipeline, but evaluates a Q4_K_M GGUF through `llama-cpp-python` on CPU. The
existing Transformers/PyTorch provider remains available and semantic mode
remains disabled by default.

## Architecture

`SemanticExtractionService` depends on `BaseLLMClient.generate()` and continues
to own JSON parsing, Pydantic validation, grounding, timeout fallback, and final
merging. `LlamaCppLLMClient` is a provider-only adapter: it lazily loads one
local GGUF, applies its embedded Qwen chat template, serializes generation, and
returns completion text.

Provider selection is connected through `MODEL_PROVIDER`. The factory caches
one lazy client per effective configuration in each Python process, so repeated
FastAPI service construction reuses the loaded model.

## Artifact and runtime

- Source: `Qwen/Qwen2.5-0.5B-Instruct-GGUF`
- File: `qwen2.5-0.5b-instruct-q4_k_m.gguf`
- Quantization: Q4_K_M
- File size: 491,400,032 bytes (468.6 MiB)
- Runtime: `llama-cpp-python==0.3.34`, official prebuilt Windows CPU wheel
- Local path convention: `models/qwen2.5-0.5b-instruct-gguf/`
- Git safety: `models/` and `*.gguf` are ignored

## Initial CPU configuration

- `n_threads=4` for the four physical i5-1135G7 cores
- `n_gpu_layers=0`
- `n_ctx=1024`
- `temperature=0.0`
- `max_tokens=256`
- one generation at a time

The fictional EXPERIENCE prompt is 928 characters, 224 raw Qwen tokens, and
253 tokens after the Qwen chat template. A 1024-token context leaves sufficient
room for its bounded JSON response without allocating the full model context.

## Smoke-test result

The safety gate passed with 2.796 GiB available RAM. One model load and exactly
two serialized generations were run on the fictional EXPERIENCE section.

| Measurement | Cold | Warm |
| --- | ---: | ---: |
| Model load | 0.592 s | reused |
| Generation | 8.385 s | 7.181 s |
| Input tokens | 224 | 224 |
| Output tokens | 82 | 82 |
| Output speed | 9.779 tokens/s | 11.419 tokens/s |
| Process RSS | 551.4 MiB | 558.4 MiB |

RSS before loading was 37.7 MiB. The generated company (`Atlas Services`) and
description were correct and grounded. The model returned null for job title
and location, so it missed `Internship` and `Oujda`. It also rewrote month-only
dates as `2024-06-30` and `2024-07-31`; existing grounding rejects those
unsupported day-specific values. No invented value is allowed into final JSON.

The manual script performs exactly two generations, cold then warm, using one
fictional EXPERIENCE section:

```powershell
.venv-llm\Scripts\python.exe scripts\benchmark_llama_cpp_smoke.py `
  models\qwen2.5-0.5b-instruct-gguf\qwen2.5-0.5b-instruct-q4_k_m.gguf
```

Do not run it with private CV data or alongside another model generation.

## Decision gates

- Warm under 10 seconds: continue provider integration.
- Warm 10–20 seconds: continue only if the grounded semantic result is good.
- Warm over 20 seconds: reject this runtime on this machine and keep
  `MODEL_ENABLED=false`.

Existing PyTorch baseline: 14.6–18.1 seconds for small warm generations and
2.65–3.29 output tokens/second. No PyTorch rerun is required.

## Switching providers

Semantic mode remains disabled by default. For the accepted local GGUF runtime:

```dotenv
MODEL_ENABLED=true
MODEL_PROVIDER="llama_cpp"
MODEL_GGUF_PATH="models/qwen2.5-0.5b-instruct-gguf/qwen2.5-0.5b-instruct-q4_k_m.gguf"
MODEL_N_THREADS=4
MODEL_CONTEXT_SIZE=1024
MODEL_MAX_NEW_TOKENS=256
```

To retain the existing implementation, set `MODEL_PROVIDER="pytorch"`.

## Decision

**A. ACCEPT LLAMA.CPP FOR LOCAL DEVELOPMENT.** Warm latency was below the
10-second acceptance threshold and throughput was roughly 3.5 times the
documented PyTorch warm throughput. This accepts the execution runtime, not the
quality of every field: deterministic extraction and grounding remain required
because this 0.5B quantization missed role/location in the smoke case.

## Qwen 1.5B evaluation

The official `Qwen/Qwen2.5-1.5B-Instruct-GGUF` Q4_K_M artifact was evaluated
without changing the prompt, grounding, schemas, provider defaults, or parser.
The exact file was `qwen2.5-1.5b-instruct-q4_k_m.gguf`, 1,117,320,736 bytes
(1065.6 MiB / 1.041 GiB).

The initial RAM gate passed with 3.214 GiB available; the immediate pre-load
gate passed with 3.219 GiB. During the benchmark, system available RAM changed
from 3263.2 MiB before load to 1639.7 MiB after the warm generation. It remained
well above the 500 MiB emergency threshold, and no paging or instability was
observed.

Exactly one model load and two serialized generations used the same fictional
EXPERIENCE section as the 0.5B test.

| Metric | 0.5B Q4_K_M | 1.5B Q4_K_M |
|---|---:|---:|
| GGUF size | 468.6 MiB | 1065.6 MiB |
| Load time | 0.592 s | 1.470 s |
| Cold | 8.385 s | 11.941 s |
| Warm | 7.181 s | 9.555 s |
| Warm tokens/s | 11.419 | 8.163 |
| Warm RSS | ~558 MiB | ~1716 MiB |
| Job title | Missing | Missing |
| Company | Correct | Correct |
| Location | Missing | Correct |
| Dates | Incorrect precision | Correct |
| Description | Correct | Correct |

The 1.5B output preserved `ATLAS SERVICES`, `OUJDA`, `June 2024`, `July 2024`,
and the task description. `job_title` remained null, so deterministic extraction
is still necessary. All returned non-null values were supported by the source;
grounding was not weakened.

### 1.5B decision

**A. USE 1.5B FOR LOCAL DEVELOPMENT.** Warm latency was under 12 seconds,
memory remained within the safety margin, and semantic quality materially
improved in three fields (location and both dates) compared with 0.5B. No larger
model or alternate quantization should be tested on this machine as part of
this experiment.

The production/default environment remains unchanged. To enable the selected
local model manually later:

```dotenv
MODEL_ENABLED=true
MODEL_PROVIDER="llama_cpp"
MODEL_GGUF_PATH="models/qwen2.5-1.5b-instruct-gguf/qwen2.5-1.5b-instruct-q4_k_m.gguf"
MODEL_N_THREADS=4
MODEL_CONTEXT_SIZE=1024
MODEL_MAX_NEW_TOKENS=256
```
