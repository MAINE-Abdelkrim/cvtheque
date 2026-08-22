# Candidate ranking

The ranking layer compares one backend-supplied job with every backend-selected CV by calling the existing `MatchingService.match()` once per valid unique candidate. It does not contain a second scoring algorithm. All valid candidates are evaluated; only the strongest three are returned by default.

## Ranking order

Candidates are ordered by eligibility first, then overall score, required-skills score, experience score, fewer missing required skills, education score, language score, preferred-skills score, non-null candidate ID ascending, and original input index. Thus an eligible score of 88 ranks above an ineligible score of 92. Scores are never altered. Stable IDs make ties independent of input order; null-ID ties retain input order.

## Invalid and duplicate candidates

The default `skip` policy records malformed CVs safely and continues. `fail_fast` raises the first candidate validation/version error. An invalid job always rejects the whole request. If every CV is invalid under `skip`, the response is 200 with zero evaluated and no Top candidates.

For duplicate non-null candidate IDs, the first valid occurrence is evaluated and later occurrences are reported as duplicates. Null IDs are not duplicates.

## Limits and output

- Input batch: 1–5,000 candidates.
- Default Top K: 3; allowed range: 1–100.
- Ranking HTTP body: 20 MiB using `Content-Length`; production ingress must enforce the same limit for chunked bodies.
- Single-match HTTP body remains 1 MiB.

Default output contains recruiter-readable summaries only, with at most three strengths and gaps and no weights. `include_technical_details=true` attaches the unchanged `MatchResult` only to returned Top-K candidates. Processing time is metadata and never affects ordering.

V1 is sequential and in-process. Several thousand simple profiles are appropriate for an MVP, subject to deployment resources and payload complexity. Future evidence may justify bounded concurrency, streaming/heap Top-K selection, asynchronous batch jobs, or distributed workers; none are added now.

