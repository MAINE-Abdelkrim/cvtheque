# Synthetic CV regression suite

## Purpose

This suite broadens deterministic parser coverage across professional CV structures without collecting private resumes. Every identity, organization, institution, contact detail, and achievement in the fixtures is fictional. The fixtures are regression data, not training data, and are never sent to an external service.

Passing these six cases does **not** prove universal CV support. The suite provides controlled structural coverage and prevents already-observed behavior from changing silently.

## Layouts

1. `cv_01_single_column.pdf` — sequential French baseline.
2. `cv_02_two_columns.pdf` — full-width header with traditional left and right columns.
3. `cv_03_sidebar.pdf` — narrow contact/skills/languages sidebar and wide main body.
4. `cv_04_dense_experience.pdf` — three compact experience records and a split bottom region.
5. `cv_05_english.pdf` — English headings, values, and date vocabulary.
6. `cv_06_mixed_layout.pdf` — full-width header/profile/education with parallel middle and bottom regions.

All PDFs are one-page, text-native documents. They contain no photographs or rasterized CV text and do not require OCR.

## Reproduction

Use the supported parser environment with the optional model disabled:

```powershell
$env:MODEL_ENABLED = 'false'
& .\.venv-llm\Scripts\python.exe -B scripts\generate_synthetic_cvs.py
```

The generator owns both the PDFs and their `_expected.json` files. Candidate dictionaries are separated from reusable drawing helpers and six layout functions. Expected JSON is projected from the same structured source dictionaries using the field names in `app/models/cv_models.py`, avoiding duplicated manually maintained truth.

The generator is deterministic at the logical-content level. PDF binary metadata or object ordering may vary between PyMuPDF versions, so tests validate visible text and structure rather than hashes.

## Tests

Run the synthetic suite:

```powershell
$env:MODEL_ENABLED = 'false'
& .\.venv-llm\Scripts\python.exe -B -m pytest -p no:cacheprovider -q tests\test_synthetic_cv_regression.py
```

The tests diagnose these stages independently:

1. the PDF opens as exactly one page;
2. selectable native text and expected headings exist;
3. blocks remain inside page bounds and no images are needed;
4. the extraction pipeline reconstructs nonempty final text;
5. the section service detects required canonical sections;
6. deterministic structured fields match visible ground truth.

Known baseline defects are represented by strict `xfail` parameters with stage-specific reasons. `strict=True` means a parser improvement becomes an actionable XPASS until the baseline declaration is removed. New failures remain ordinary test failures.

Skills are compared as normalized, unordered sets and report missing and unexpected names. Experiences, education, languages, and certifications retain strict logical record counts and explicit fields. Free-text summaries and descriptions use accent-insensitive whitespace normalization and containment, not fuzzy or semantic matching.

## Scope limits

This phase does not cover scanned PDFs, OCR, photographs, tables, more than one page, malformed dates, DOC/DOCX, unusual embedded fonts, right-to-left layout reconstruction, every language or profession, or every PDF-producing application. It does not measure semantic equivalence and must not be used as a claim of universal parsing accuracy.

