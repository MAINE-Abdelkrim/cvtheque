# Hybrid semantic extraction

## Existing infrastructure

The project already provided an optional lazy-loaded `Qwen/Qwen2.5-0.5B-Instruct` client, a client factory controlled by `MODEL_ENABLED`, bounded prompt construction, JSON extraction and conservative syntax repair, Pydantic CV models, source-grounding checks, and deterministic fallback. The model object is created once with the FastAPI service and loads its weights on first generation.

The former enrichment path made one whole-document call and filled only fields that deterministic extraction left empty. It could not correct an existing but semantically wrong record.

## Hybrid architecture

```text
PDF extraction and validation
  -> geometry-aware layout and canonical section ownership
  -> deterministic field extraction
  -> optional semantic call for each nonempty canonical section
  -> strict Pydantic section envelope
  -> source-evidence validation
  -> validated section replacement or deterministic fallback
  -> unchanged public CVData JSON
```

Identity and contact remain deterministic-first. Semantic calls support `SUMMARY`, `SKILLS`, `EXPERIENCES`, `EDUCATION`, `LANGUAGES`, and `CERTIFICATIONS`. Empty and absent sections cause no model call. When canonical section input exists, the model receives only that section. A legacy completion fallback is retained solely for documents where no reliable canonical semantic section exists.

## Prompt strategy

Prompts are centralized in `app/llm/cv_semantic_prompts.py`. Every prompt contains one section, one required JSON shape, general no-invention/null-over-guess rules, and section-specific rules. Prompts and raw model output are never logged.

## Validation and evidence

Each response passes through existing JSON extraction/repair and then a strict Pydantic envelope with extra fields forbidden. Every scalar output is classified as:

- `SUPPORTED`: literal source occurrence;
- `NORMALIZED_SUPPORTED`: occurrence after case/punctuation/whitespace normalization;
- `UNSUPPORTED`: absent from the section.

Unsupported fields are nulled. Required records that become invalid are discarded. Supported sibling fields survive. The semantic result replaces a deterministic section only when at least one validated grounded record (or grounded summary) contributes. Otherwise deterministic output remains untouched.

`llm_available` means the configured client and dependencies are available. `llm_used` means at least one validated semantic/completion value actually contributed, not merely that generation was attempted.

## Failure handling

Malformed JSON, Pydantic failure, timeout, unavailable dependencies, model-load failure, generation error, and unexpected exceptions all preserve deterministic output. A safe warning indicates semantic fallback without exposing prompts, text, model output, paths, or private values.

`MODEL_TIMEOUT_SECONDS` controls the per-section waiting limit and defaults to 30 seconds. Python cannot safely terminate an already executing model thread; a timed-out CPU generation may finish in the background while its result is ignored. This is one reason CPU semantic mode is not recommended as the default request path.

## Tests

Anonymous mocked tests cover semantic role correction, per-section prompt isolation, hallucination rejection, malformed JSON, extra schema fields, client exceptions, timeouts, empty-section call suppression, and all supported schemas. The existing deterministic suite remains authoritative with `MODEL_ENABLED=false`.

The manual command below uses only locally cached weights and fictional skills:

```powershell
$env:MODEL_ENABLED='true'
$env:MODEL_LOCAL_FILES_ONLY='true'
$env:MODEL_DEVICE='cpu'
& .\.venv-llm\Scripts\python.exe -B scripts\validate_semantic_qwen.py
```

## Local model observation

The cached 0.5B model occupied approximately 953 MB on disk. A CPU smoke call exceeded the 120-second semantic timeout and fell back safely; the underlying generation thread completed after approximately 157 seconds. It produced no validated contribution within the service deadline. No model was downloaded.

## Manual private-CV comparison

Deterministic mode retains the previously validated category-level result. A full six-section private-CV hybrid run was not executed after the fictional one-section smoke call exceeded its 120-second deadline. Under the implemented policy, the measured hybrid outcome on this hardware is deterministic fallback with no claimed semantic improvement. Private text was not logged or added to tests or documentation.

## Recommendation

Keep `MODEL_ENABLED=false` as the default production configuration for this machine. The hybrid architecture is safe and ready for controlled evaluation, but Qwen CPU latency is not acceptable for the synchronous upload path. Enable it only on suitable hardware or for explicit evaluation after latency and semantic-quality benchmarks pass. Restart FastAPI after Python or model configuration changes; use uvicorn reload only in development, never as an implicit production default.
