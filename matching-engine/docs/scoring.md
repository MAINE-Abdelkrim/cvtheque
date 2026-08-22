# Scoring model

For each active criterion `i`, its scorer returns `sᵢ` from 0 to 100. Given configured weight `wᵢ`, inactive job criteria are excluded and effective weights are:

`Wᵢ = 100 × wᵢ / Σ(active weights)`

The overall score is `Σ(sᵢ × Wᵢ / 100)`. Calculations retain full precision; public scores, weights, and contributions round to two decimals. If the job specifies no criteria, overall score is 0 and all criteria are inactive.

Default weights: required skills 40%, experience 25%, education 10%, languages 10%, preferred skills 5%, location/work mode 5%, contract 5%. Custom weights must include supported keys only, be non-negative, and total exactly 1.0 or 100.

## Rules

- Skills: canonical exact or configured alias = 1.0; explicitly approved partial = 0.5 by default; missing = 0. No substring or semantic matching.
- Experience: `min(candidate years / required years, 1) × 100`; zero required years = 100. Dated intervals use the union of calendar months. Overqualification is not penalized.
- Education: equal/higher level = full level credit; one level below = 60%; farther below = 0. Preferred fields use normalized exact equality and comprise 20 points when specified.
- Languages: equal/higher = 1.0; one normalized level below = 0.7; otherwise 0, averaged per required language.
- Location/work mode: exact general-city and explicit work-mode compatibility only. Remote preference is compatible when remote is allowed. Missing candidate information receives neutral 50.
- Contract: normalized explicit match = 100, mismatch = 0, absent candidate preference = neutral 50.

Classification boundaries are 85 excellent, 70 strong, 50 moderate, 30 weak, otherwise low. These are compatibility labels, not acceptance decisions.

Only explicit mandatory requirements affect `eligible`. A missing mandatory skill, insufficient mandatory language/education, or explicit requirement supplied as `satisfied: false` adds a detailed hard failure. Numeric score and classification remain available.

Ranking does not modify any formula or score. It calls this exact scoring process for each valid CV and orders results eligibility-first using the deterministic tie-break sequence documented in `docs/ranking.md`. Candidate names never influence scoring or ordering; non-null IDs participate only as a stable late tie-breaker.
