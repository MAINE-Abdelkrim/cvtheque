# Interview quality boundary

This document defines the offline-verifiable quality policy for the standalone Interview Engine.
It does not claim that the mock provider predicts job performance or that any score is valid for an
automated hiring decision.

## Responsibilities

The deterministic planner owns category, topic, objective, grounding, source references,
difficulty, coverage, clarification limits, and the total question count. A provider may phrase the
planned question and assess observable answer content, but it cannot change planner metadata.

Question validation requires non-empty text, at most 500 characters, one main question mark,
planner-compatible metadata, unchanged grounding references, no obvious unsupported candidate
history premise, and no normalized exact repetition of an earlier question. The planner prefers
unused categories and topics. A single clarification may revisit a topic after a low, insufficiently
supported answer; it uses a distinct objective and cannot create an unlimited follow-up chain.

Difficulty starts at easy and normally progresses by interview position. Technical interviews can
reach hard earlier. A response below 50 prevents escalation on the next turn; a response of at least
85 may deepen a technical interview one step earlier after the opening turns. The deterministic
planner remains authoritative and `max_questions` is never extended.

## Score and classification policy

Numeric response-quality scores are bounded from 0 through 100. The shared classification policy
is:

- 85–100: `excellent`
- 70–84: `good`
- 50–69: `fair`
- 0–49: `needs_improvement`

The numeric score is authoritative. Provider classifications are normalized from it. Final overall
and category scores are deterministic rounded means of evaluated turns; counts and category keys
must exactly match those turns. Provider reports with contradictory aggregate values are rejected.

The mock evaluator uses deterministic lexical relevance, response development, reasoning markers,
and concrete evidence/result markers. Fluent unrelated text is capped below 50. This heuristic is
for workflow, regression, and policy validation only; it is not a technical-correctness oracle, a
knowledge benchmark, or a model of candidate suitability. A sparse controlled contradiction can be
kept below the fair threshold because it lacks support, but the mock does not claim to recognize the
underlying factual error. Technical correctness requires separate real-provider evaluation.

## Grounding and safety invariants

Questions distinguish documented CV facts, listed skills, job-only requirements, and generic
fallbacks. A listed skill does not establish a project or production decision. Job-only topics are
asked as knowledge or hypothetical experience and cannot be stated as candidate history.

Evaluations and reports may discuss only observable response relevance, specificity, completeness,
reasoning, examples, and supportable technical correctness. They must not infer intelligence,
honesty, deception, personality, emotion, health, protected traits, or private characteristics.
Scores measure response quality inside this workflow—not human worth, general employability, or a
hiring recommendation. No hiring decision should be made automatically from them.

## Offline scenario suite

`tests/fixtures/interview_quality/scenarios.json` contains 15 fictional scenarios spanning junior
Python, backend, analytics, data science, frontend, DevOps, recent-graduate, skills-only,
documented-experience, missing-job-skill, minimal-CV, similar-skill, strong, mixed, and irrelevant
answer cases. `tests/quality/test_offline_scenarios.py` runs each through the planner, mock provider,
service, and in-memory repository.

The harness checks broad topic coverage and score bands, unique question IDs/text, exact completion
counts, bounded evaluations, deterministic classification, and category aggregation. Assertions are
deliberately broad and do not require exact generated sentences.

## Known limitations

- Deterministic keyword checks cannot prove semantic relevance, correctness, or entailment.
- The mock evaluator has no technical knowledge base and cannot reliably identify arbitrary false
  claims.
- Near-duplicate prevention uses planner topic/objective coverage and exact normalized question
  text; it is not embedding-based semantic deduplication.
- Free-form CV/job descriptions are not semantically mined beyond the existing narrow fields.
- Real Gemini question and evaluation quality requires a separate, explicitly authorized evaluation
  with a reviewed rubric and synthetic inputs.
