# Synthetic CV baseline

Baseline captured with `MODEL_ENABLED=false` before any parser production change. The six generated PDFs opened successfully, contained selectable native text, remained within one A4 page, and passed the fixture-integrity stage.

Status meanings:

- **PASS** — all explicit ground-truth assertions for the category passed.
- **PARTIAL** — useful data was extracted, but one or more explicit values or record boundaries were wrong.
- **FAIL** — the expected category was missing or assigned to the wrong section.

| Case | Identity | Sections | Skills | Experience | Education | Languages | Certifications |
| ---- | -------- | -------- | ------ | ---------- | --------- | --------- | -------------- |
| 01 Single column | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 02 Two columns | PASS | PASS | PASS | PARTIAL | PASS | PASS | FAIL |
| 03 Sidebar | PARTIAL | PASS | FAIL | PARTIAL | PASS | PASS | PASS |
| 04 Dense experience | PASS | PASS | PASS | PASS | FAIL | PASS | PASS |
| 05 English | PARTIAL | FAIL | PASS | FAIL | PARTIAL | PASS | PASS |
| 06 Mixed layout | PASS | PASS | PARTIAL | PARTIAL | PASS | PASS | PASS |

## Case analysis

### 01 — single column

All required fields and record boundaries passed. No failing pipeline stage was observed.

### 02 — traditional two columns

The parser detected all canonical headings and all skills, education, and languages. The reconstructed order assigned the skills body to `SUMMARY`, assigned the real summary to `CERTIFICATIONS`, and treated the certification year as a second experience. The first suspected failing stage is **layout reconstruction**, before field-specific extraction.

### 03 — sidebar

Native extraction and canonical heading detection succeeded. Layout detection classified the asymmetric page as single-column, promoted `CONTACT` to the identity job title, lost the skills body, and separated the experience title/company from its date block. Education, all three languages, and the single logical certification passed. The first suspected failing stage is **layout reconstruction**.

### 04 — dense experience

Identity, summary, six skills, all three experience boundaries, and all three languages passed. The split bottom region was classified as two columns even though it contains three parallel groups; the education heading was detected but its structured record was lost. The first suspected failing stage is **layout reconstruction**.

### 05 — English

Native extraction and the single-column reading order succeeded. `PROFILE`, `SKILLS`, `EDUCATION`, `LANGUAGES`, and `CERTIFICATIONS` were detected, but singular `EXPERIENCE` was not an alias, so no experience was extracted. The multi-word country was truncated and the institution was reduced to the generic `University` token. The first failure for experience is **section detection**; identity and education also expose field-extractor limitations.

### 06 — mixed layout

Layout and all canonical sections were detected. Identity, summary, education, four languages, and two certification record boundaries passed. `Terraform` was absent from extracted skills, and `2025-02` / `2025-07` were reduced to years. The first suspected failing stage is **field-specific extraction** (skill catalog and date parsing).

## Baseline test result

```text
42 passed, 13 xfailed
```

The 13 strict expected failures correspond to the specific limitations above. No parser production logic was changed while creating or recording this baseline.

## Post-layout-generalization results

The region-aware geometry phase reduced the strict baseline from 13 to 9 expected field-level failures. It corrected section ownership without weakening ground-truth assertions.

| Case | Before | After |
| ---- | ------ | ----- |
| Single column | PASS | PASS |
| Two columns | PARTIAL | PASS |
| Sidebar | PARTIAL | PARTIAL — structural ownership passes; UX catalog/title and country extraction remain |
| Dense experience | PARTIAL | PARTIAL — education record preserved; institution token remains partial |
| English sectioning | FAIL | PASS — singular `EXPERIENCE` detected and record extracted |
| Mixed layout | PARTIAL | PARTIAL — Terraform and month-preserving dates remain out of scope |

Post-change synthetic result:

```text
50 passed, 9 xfailed
```

The remaining strict xfails are field-extractor limitations: sidebar country extraction, UX skill catalog coverage, UX experience-title recognition, generic `School` / `University` institution parsing, English month normalization, Terraform recognition, and `YYYY-MM` date preservation.

## Post-field-generalization results

All nine retained field-level expectations now pass without weakening assertions or adding fixture-specific rules.

| Case | Post-layout | Post-field |
| ---- | ----------- | ---------- |
| Single column | PASS | PASS |
| Two columns | PASS | PASS |
| Sidebar | PARTIAL | PASS |
| Dense experience | PARTIAL | PASS |
| English | PARTIAL | PASS |
| Mixed layout | PARTIAL | PASS |

Final synthetic result:

```text
59 passed
```

This means the six controlled fixtures match their visible ground truth. It does not establish universal CV compatibility.

## Post-real-world independent-column regression

A seventh anonymous fixture now covers asymmetric left/right columns whose sections have independent vertical heights, including natural heading and body wrapping in narrow columns.

| Case | Before new regression | After general fix |
| ---- | --------------------- | ----------------- |
| 07 Independent columns | 4 structured categories failed | PASS |
| Existing cases 01–06 | PASS | PASS |

Current synthetic result:

```text
68 passed
```

The private external document that motivated this case is not part of the repository. The seven synthetic cases improve structural coverage but still do not establish universal CV compatibility.
