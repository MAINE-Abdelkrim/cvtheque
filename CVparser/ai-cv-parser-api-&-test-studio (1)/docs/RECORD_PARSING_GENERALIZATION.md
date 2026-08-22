# Record parsing generalization

## Problem class

Geometry-aware ownership determines which text belongs to experience, education, and certifications. The remaining failures occurred inside correct sections: physical lines were split at weak signals, wrapped headers were attached to adjacent records, and short prose could be promoted to a title or company.

No private holdout content is stored in this repository. All committed regressions use fictional organizations and education providers.

## Experience grouping

Experience boundaries now require combinations of date, an existing header, and description evidence. A catalog match inside long prose is not a boundary. Short title-like headers, date-first records, title/company separators, and conservative organization suffixes provide field evidence. Structural title/company pairs can occur after a leading date. A company-like line without a title or date is rejected as too ambiguous.

The extractor follows a null-over-guess policy: long sentences cannot become titles or companies merely to populate a field.

## Education grouping

Education segmentation recognizes controlled, common degree forms in addition to the existing French and English forms. Boundaries account for degree-first, institution-first, compact, wrapped, and detached-date records. An institution starts a new record only when the preceding record already has degree, institution, and date evidence. Institution extraction preserves the complete comma-delimited organization segment around an institution keyword.

## Certification grouping

Wrapped certification names are grouped with issuer/date terminal evidence. Standalone date lines and issuer-like lines can complete a pending record, while ordinary one-certification-per-line lists remain separate. Separator-based issuer parsing is preserved, and punctuation-only PDF artifacts are discarded.

Comma-only free-form course lists without issuer, date, bullet, or record separators remain ambiguous. The parser does not invent boundaries for them.

## Anonymous regressions

Focused tests cover mixed title-first/company-first/date-first experience records, long wrapped descriptions, missing title/company fields, compact and wrapped education, institution-only and degree-only education, wrapped certification names, issuer/date lines, multiple certifications, and extraction artifacts.

## Results

Before this phase, the full suite contained 595 passing tests. After the record-level changes it contains 602 passing tests, with no failures, skips, or xfails. Existing synthetic layout and geometry ownership cases remain green.

## Remaining limitations

- Organization and job-title evidence is intentionally conservative; uncertain fields may be null.
- Acronym-only institutions without a recognizable institution signal can remain unresolved.
- Free-form comma-separated certification/course lists have no deterministic record boundary.
- Dates provide useful boundary evidence, but a date alone does not prove a complete record.

These constraints are deliberate: an omitted uncertain value is safer than confident prose contamination.
