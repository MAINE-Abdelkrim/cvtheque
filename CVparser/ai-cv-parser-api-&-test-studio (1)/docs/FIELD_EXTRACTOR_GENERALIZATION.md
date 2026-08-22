# Field extractor generalization

## Scope

This phase addressed the nine field-level limitations remaining after layout ownership was corrected. It did not change layout reconstruction, OCR, API behavior, schemas, PDF validation, or optional model logic.

## General rules introduced

### Locations

Identity extraction now searches an explicitly segmented `CONTACT` section before the visual header. A known city may be followed by a comma and a multi-word alphabetic country or region. The matched location is bounded to that field, so email, phone, and pipe-separated contact values are not included.

### Explicit skills

Catalog matching still supplies canonical names and categories. In addition, an explicit `SKILLS` section may preserve unknown short list-like entries. Candidates are split on lines and controlled separators, limited by word and character count, and rejected when they resemble prose, headings, contacts, dates, institutions, or bare vendor names. Catalog aliases are not duplicated.

### Experience titles and companies

A short first line in the form `title | company` or `title - company` is accepted as structural evidence. This complements rather than removes the existing title taxonomy. It also participates in multi-entry segmentation, so unfamiliar professions are not merged merely because they are absent from a catalog.

### Institutions

When an institution keyword is a suffix inside a standalone organization line, meaningful words before the keyword are retained. When a degree and institution share one compact line, extraction still begins at the institution keyword. This supports both prefix forms such as `Université ...` and suffix forms such as `... University` or `... School`.

### Dates

Experience date tokens now prefer the most precise explicitly written representation. Controlled tokens cover abbreviated/full English and French months, `YYYY-MM`, `MM/YYYY`, and year-only values. Present-style values retain the project's existing normalization to `Présent`.

## Why the rules are general

No rule checks candidate names, fixture filenames, employers, or synthetic institution names. Each rule relies on section provenance, list structure, visual separators, organization-keyword position, or deterministic date grammar.

## Synthetic results

| Stage | Passed | Strict xfailed |
| ----- | -----: | -------------: |
| Initial synthetic baseline | 42 | 13 |
| After layout generalization | 50 | 9 |
| After field generalization | 59 | 0 |

## Limitations

The deterministic parser still cannot guarantee correct interpretation of every free-form resume. Explicit skills written as long prose remain intentionally conservative. Location extraction still depends on known-city evidence. Unseparated title/company prose may still need taxonomy support. Date grammar is controlled rather than natural-language complete. Passing six synthetic CVs is regression evidence, not universal CV support.

