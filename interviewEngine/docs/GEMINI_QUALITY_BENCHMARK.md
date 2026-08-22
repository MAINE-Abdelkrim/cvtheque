# Gemini quality benchmark

This harness measures the configured Gemini provider against the Interview Engine's existing
quality contracts. It is not production traffic, a load test, or a candidate assessment. Every CV,
job, answer, question, and report used by the benchmark must be fictional.

Live calls require explicit authorization for each run and an agreed call budget. The configuration
gate and two-operation preflight must pass before a multi-scenario run. The harness never changes
the configured model, timeout, retry, fallback, planner, scoring, grounding, or safety policy.

## Execution and call ceiling

The default suite contains five existing synthetic quality fixtures. A future authorized run can
select exactly one fixture with:

```text
python scripts/benchmark_gemini_quality.py --scenario junior_python_mixed_answers
```

Preflight remains available through `--preflight`. The physical provider-attempt ceiling defaults
to 45 and can be lowered for a controlled, explicitly authorized experiment. For example:

```text
python scripts/benchmark_gemini_quality.py --scenario junior_python_mixed_answers --attempt-ceiling 12 --output evaluation/gemini_quality/recovery_junior_python.json
```

The accepted range is 1 through 45. Retries consume this budget. With `--attempt-ceiling 12`,
attempt 12 may run; the next requested attempt is checkpointed as blocked before provider invocation
and does not increment `attempts_sent`. Preflight uses the same option, for example
`--preflight --attempt-ceiling 4`.

A separately authorized one-question diagnostic can use
`--single-question-diagnostic --attempt-ceiling 2`. This mode creates its artifact before provider
construction, generates exactly one planner-backed synthetic question, never evaluates an answer or
generates a report, and refuses to overwrite or resume its artifact.

The benchmark instruments the existing provider boundary without changing production application
behavior. It records primary attempt starts and successes, timeouts, unavailability, invalid raw
responses, application validation failures, explicit retries, fallback activation/success/failure,
and accepted post-validation operations.

`provider_unavailable` remains the safe public classification. Internally, future artifacts can add
one allow-listed `provider_failure_cause`: `RATE_LIMIT`, `AUTHENTICATION`, `PERMISSION`,
`MODEL_OR_REQUEST`, `SERVER`, `TRANSPORT`, `TIMEOUT`, or `UNKNOWN`. These values come only from
structured SDK status codes or recognized transport exception types. `UNKNOWN` means the retained
evidence is insufficient. Raw SDK messages and response objects are never persisted. Retries are
physical attempts, so one logical operation can produce multiple unavailable events.

Application validation events can similarly add an allow-listed `validation_reason`:
`INVALID_STRUCTURE`, `CATEGORY_MISMATCH`, `DIFFICULTY_MISMATCH`,
`SOURCE_REFERENCE_MISMATCH`, `DUPLICATE_QUESTION`, `UNSUPPORTED_HISTORY_PREMISE`,
`PROHIBITED_INFERENCE`, `AGGREGATE_MISMATCH`, or `UNKNOWN`. Public provider error codes and safe
messages remain unchanged. Rejection is evidence that validation worked; it is not evidence that
the rejected output was acceptable. Accepted mock fallback output demonstrates fallback workflow
behavior, not real Gemini quality.

Artifacts written before these fields were introduced cannot be retroactively classified. A future
live run should use the structured causes to decide whether retrying is useful, and should occur only
when the retained diagnostic evidence and runtime conditions justify it.

## Checkpoints and resume

The portable artifact is `evaluation/gemini_quality/benchmark.json`. It has an opaque run ID and an
artifact version, and records the model, synthetic-data flag, selected/completed/current scenarios,
status, exact counters, sanitized operation events, accepted structured outputs, completed scenario
results, and a safe failure type/message.

Every event and accepted operation is checkpointed. Scenario start and completion and controlled or
unexpected termination are also checkpointed. Writes use a same-directory temporary file, flush and
close it, and atomically replace the target.

The actual per-run ceiling is persisted in the artifact. `--resume` validates the artifact version,
structure, attempt ceiling, mode, and configured model. It preserves the artifact's original ceiling
when the option is omitted; explicitly supplying a different ceiling fails safely. Resume also
preserves cumulative accounting and completed results, skips completed scenarios, and reruns only
incomplete scenarios. A corrupt/incompatible artifact or model mismatch fails without making calls.

A partial artifact is evidence only for the operations and completed scenarios it contains. It must
not be interpreted as a complete quality result. The earlier run that reached 45 attempts lost its
in-memory detail because the old harness wrote only after total completion; that runtime outcome was
not evidence that the production Interview Engine itself was defective.

## Security boundary

The artifact may contain generated synthetic questions, evaluations, and reports. It never contains
the API key, authorization headers, serialized settings or environment variables, credential paths,
full prompts, host/user/network identity, or real candidate data. The live-only client builder reads
the configured secret internally only after an explicitly invoked live command. Offline tests inject
fake providers and never construct that client.
