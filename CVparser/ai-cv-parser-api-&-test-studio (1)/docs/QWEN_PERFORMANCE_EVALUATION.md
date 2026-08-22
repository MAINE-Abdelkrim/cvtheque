# Qwen local performance and quality evaluation

## Hardware and runtime

- CPU: Intel Core i5-1135G7, 4 physical / 8 logical cores.
- RAM: 7.7 GB total; approximately 1.66 GB available after benchmarking and normal development services.
- GPU: NVIDIA GeForce MX330 (2 GB VRAM) plus Intel Iris Xe.
- CUDA: unavailable to the installed PyTorch build (`torch.version.cuda=None`, `torch.cuda.is_available()=False`). `nvidia-smi` was unavailable.
- Python: 3.12.10, `.venv-llm`.
- Packages: torch 2.3.1, transformers 4.44.2, accelerate 1.14.0, safetensors 0.8.0, NumPy 2.5.1; bitsandbytes absent.
- CPU libraries: MKL and MKLDNN available. PyTorch used 4 compute and 8 inter-op threads.

Torch 2.3.1 emitted a NumPy ABI warning with NumPy 2.5.1. Generation completed, but the environment should be rebuilt with compatible pinned dependencies before relying on model mode.

## Current model configuration

`Qwen/Qwen2.5-0.5B-Instruct` was loaded from the existing local cache only. The cache occupied about 953 MB. Device resolution selected CPU and float32. The model was in evaluation mode. Greedy generation was used (`do_sample=false`) with a configured ceiling of 512 new tokens.

The section prompts contained 144–233 input tokens across the fictional benchmark. They contained one canonical section only, with no whole CV, deterministic JSON, or unrelated context. The global 512-token ceiling was excessive but was not the primary measured bottleneck: the skills output stopped naturally after 48 tokens.

## Root cause and latency decomposition

The original delay was not repeated model loading. The client is retained by `CVProcessingService` and the Qwen client loads once under a lock.

| Measurement | Result |
| --- | ---: |
| Client construction | <0.01 s |
| Tokenizer + model load | 18.9–24.4 s |
| Prompt tokenization | 0.16–0.92 s |
| First forward/generation after load | 161.9 s |
| Warm generation 2 | 18.1 s |
| Warm generation 3 | 14.6 s |
| Warm output speed | 2.65–3.29 tokens/s |
| First-touch output speed | 0.30 tokens/s |

Weights are memory-mapped/lazily materialized: reported RSS was only ~137 MB immediately after load, then rose to about 1.92 GB during the first forward pass. With only 7.7 GB system RAM and other development services active, first-touch paging dominates cold latency.

Before optimization, repeated calls degraded from 20.3 seconds to 55.0 and 212.2 seconds while RSS oscillated, consistent with memory pressure/paging and avoidable inference bookkeeping. `model.generate()` was not executed under inference/no-grad mode.

## Optimization tested

The Qwen generation call is now wrapped in `torch.inference_mode()`. This is a general inference correction, not a model or parser change. With inference mode, repeated warm RSS stabilized around 1.91 GB and later calls stabilized at 14.6–18.1 seconds rather than degrading to minutes.

Reducing the benchmark ceiling from 512 to 64 did not shorten the 48-token output itself; it only bounded pathological long responses. Section-specific limits remain desirable as a safety control, but cannot make this CPU meet the synchronous target.

No packages, runtimes, models, or weights were installed or downloaded. The CPU thread count was already aligned with the four physical cores, so it was not changed.

## Fictional semantic quality

Ten anonymous French/English section cases covered ambiguous experiences, reordered headers, education, skills, languages, certification, abbreviated dates, missing fields, and task-only ambiguity.

| Mode | Correct | Missing | Incorrect | Hallucinated | Total fields |
| --- | ---: | ---: | ---: | ---: | ---: |
| Deterministic | 37 | 4 | 9 | 0 | 51 |
| Final hybrid | 38 | 10 | 2 | 0 | 51 |

Hybrid mode materially reduced confident errors but improved only one net correct field because malformed output, timeout, model omissions, and grounding converted several errors to null. Skills improved from 2/4 to 4/4. One English experience improved from three incorrect fields to zero incorrect fields, with two fields conservatively null. French experience and education examples fell back.

Warm per-case semantic latency ranged from 14.3 to 96.5 seconds. None of the behavior is suitable for a multi-section synchronous upload on this machine.

## Grounding evaluation

Literal, case, whitespace, punctuation, and apostrophe variants were supported. Audit found safe false rejections for accents/status/date representation. Grounding now additionally accepts:

- accent folding (`Fevrier` / `Février`);
- equivalent present-status terms (`Present` / `Présent`);
- `YYYY-MM` / `MM/YYYY` numeric date equivalence.

It still rejects values absent from the section. No fuzzy semantic similarity or outside knowledge was introduced.

## Timeout limitation

`ThreadPoolExecutor` timeout returns deterministic fallback but cannot terminate a running PyTorch generation. The generation thread retains the client's lock, so subsequent calls queue behind it. A timed-out cold call can therefore poison later request latency. A production local-model deployment needs process-level isolation/cancellation or an inference server, not only a thread timeout.

## Decision matrix

| Option | Expected latency here | Memory | Quality | Complexity / risk | Offline |
| --- | --- | --- | --- | --- | --- |
| Current Qwen + current CPU | 15–96 s warm per section; ~180 s cold | ~1.9 GB RSS plus runtime | Modest, safer but incomplete | Low / unacceptable latency | Yes |
| Current Qwen + inference-mode/config bounds | 14–18 s for tiny warm skill call; longer structured sections | ~1.9 GB stabilized | Same model quality | Low / still too slow for 6 calls | Yes |
| Current Qwen + GPU | Not immediately usable; installed torch is CPU-only and MX330 has only 2 GB VRAM | 2 GB VRAM is marginal | Same | Medium/high; environment rebuild, likely memory pressure | Yes |
| Current Qwen + quantized CPU runtime (GGUF/llama.cpp or equivalent) | Must be benchmarked; plausibly materially faster and lower RAM | Potentially <1 GB model memory | Quantization may reduce quality slightly | Medium; new runtime/artifact and integration | Yes |
| Another small model | Unknown; not justified before runtime benchmark | Model-dependent | 0.5B quality is only marginal | High; download/evaluation/integration | Usually |
| Deterministic-only production | Existing parser latency | Existing parser memory | Stable documented behavior | Lowest | Yes |

## Recommendation

Keep `MODEL_ENABLED=false` for V1 production on this machine. Qwen2.5-0.5B is semantically useful in selected cases but is not sufficiently reliable or fast to justify six synchronous PyTorch CPU calls. Do not move to a larger model: RAM, CPU throughput, and GPU VRAM make that unrealistic.

The next bounded experiment, if semantic mode remains a priority, should compare the same 0.5B model in one quantized process-isolated local runtime using these exact fictional cases. It must demonstrate both <15-second total multi-section latency and better field accuracy before integration. Until then deterministic-only production is the professional configuration.
