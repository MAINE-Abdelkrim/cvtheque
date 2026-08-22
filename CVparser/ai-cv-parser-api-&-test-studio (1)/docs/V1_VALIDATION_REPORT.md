# CV Parser V1 validation report

## 1. Objective

This final validation measures deterministic parser generalization without tuning it to known documents. It verifies the automated baseline and evaluates previously unused local CVs through native extraction, layout reconstruction, sectioning, field extraction, and final structured output.

No private CV was copied into the repository. Candidate names, contacts, employers, schools, and raw parser output are intentionally omitted.

## 2. Existing validation baseline

The seventh independent-column synthetic fixture and its general fixes are present. With `MODEL_ENABLED=false`, the unchanged baseline is:

```text
538 passed, 0 failed, 0 skipped, 0 xfailed, 53 warnings
```

The warnings are dependency deprecations from Starlette, Gradio, and FastAPI. The seven synthetic CV cases remain represented by 68 staged passing expectations.

## 3. Unseen CV validation methodology

PDFs were searched read-only under the workspace, Desktop, Documents, and Downloads. Generated fixtures, known development CVs, the previously investigated private CV, byte-identical duplicates, and an unfilled image-only template were excluded.

Three distinct, previously unused native-text CVs were selected. Each was visually compared with:

1. PyMuPDF native extraction;
2. extraction method and page layout classification;
3. reconstructed page text;
4. canonical section ownership;
5. deterministic extractor output;
6. final structured JSON.

No private values were persisted during this inspection.

## 4. Anonymous validation matrix

`PASS` means the category remained materially faithful to visible source content. `PARTIAL` means useful data was produced but important visible information was omitted, fragmented, polluted, or assigned to the wrong field.

| CV | PDF extraction | Layout | Sections | Identity | Skills | Experience | Education | Languages | Certifications | Overall |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CV-A | PASS | FAIL | FAIL | PARTIAL | FAIL | FAIL | PARTIAL | FAIL | PARTIAL | FAIL |
| CV-B | PASS | PASS | FAIL | FAIL | FAIL | PARTIAL | FAIL | FAIL | PARTIAL | FAIL |
| CV-C | PASS | PASS | FAIL | FAIL | PASS | FAIL | FAIL | PARTIAL | N/A | FAIL |

All three documents were native-text PDFs. The parser generated valid JSON for each, but valid JSON did not imply correct extraction.

## 5. Problems discovered

### CV-A

- A mixed sidebar/main document was flattened with main content followed by sidebar content and detached date blocks.
- Project content entered the skills section because its heading did not establish a canonical boundary after reconstruction.
- Contact content entered certifications, while later sidebar content entered languages.
- The visible location was not returned.
- Experience records had incorrect title/company roles despite the visible lines being present.
- Education dates and one record were incomplete.
- Concatenated native language labels were not parsed.
- Correct certifications were returned together with unrelated contact records.

### CV-B

- The source intentionally contains no candidate contact identity, but prose was incorrectly promoted to a full name.
- A common education heading variant was not recognized; visible education became experience fragments.
- An accomplishments section remained owned by skills, producing many non-skill entries.
- Experience counts and dates were mostly useful, but company fields absorbed description text.
- A language statement embedded in a skills list was not safely recoverable as structured languages.

### CV-C

- The source contains a professional title but no candidate name; the title was incorrectly returned as the name.
- A common education/training heading variant was not recognized, so education was lost and later content remained attached to experience.
- Long experience blocks were over-segmented and title/company assignments were unreliable.
- Only one of four explicitly listed languages was recognized.
- The source has no certification section, so an empty certification list is correct.

## 6. Root causes and first failing stages

| CV | Problem | Classification | First failing stage |
| --- | --- | --- | --- |
| CV-A | Detached dates and sidebar/main contamination | C — layout reconstruction | LayoutService ordering |
| CV-A | Project/contact/sidebar bodies assigned to neighboring sections | D — section detection | Section boundaries after reconstruction |
| CV-A | Experience title/company assignments | E — field extraction | ExperienceExtractor |
| CV-A | Concatenated language labels | B/E — native extraction plus field extraction | Native word boundaries, then LanguagesExtractor |
| CV-B | Missing education and accomplishments boundary | D — section detection | Controlled heading aliases |
| CV-B | Prose promoted to candidate name | E — field extraction | IdentityExtractor fallback |
| CV-B | Description text promoted to skills/company | D/E — sectioning and field extraction | Section ownership first |
| CV-B | Embedded language statement | F — ambiguous information | No explicit language-record structure |
| CV-C | Missing education/training section | D — section detection | Controlled heading aliases |
| CV-C | Professional title promoted to candidate name | E — field extraction | IdentityExtractor fallback |
| CV-C | Experience fragmentation | E — field extraction | ExperienceExtractor segmentation |
| CV-C | Unlevelled languages outside normalization map omitted | E/F — field extraction and ambiguity | LanguagesExtractor |

Missing email, phone, location, or certifications were not counted as parser failures where those values were absent from the source. Candidate location was never inferred from school or employer locations.

## 7. Changes made

No production code was changed. No new parser rule or synthetic fixture was introduced because this phase was intended to measure generalization, and the discovered failures span multiple architectures rather than one small, safely isolated correction.

This report is the only permanent project change from final validation.

## 8. Regression results

Baseline command:

```powershell
$env:MODEL_ENABLED='false'
& .\.venv-llm\Scripts\python.exe -B -m pytest -p no:cacheprovider --basetemp '.pytest-v1-baseline' -q
```

Result:

```text
538 passed, 0 failed, 0 skipped, 0 xfailed, 53 warnings
```

Because production code was not modified after that run, there is no post-change test delta.

## 9. Supported V1 scope

Current automated coverage supports:

- native-text PDF input;
- deterministic extraction with the optional model disabled;
- single-column, traditional two-column, sidebar, mixed, dense parallel-group, English, and independent asymmetric-column synthetic layouts;
- French and English controlled section headings covered by the alias map;
- identity/contact, summary, explicit skill lists, structured experience and education records, languages, and certifications when section boundaries and record structures match covered patterns;
- explicit candidate location only, without inference from employers or education;
- controlled rejection of image-only PDFs under the current OCR policy.

This scope is accurately described as “validated against the currently covered CV layout families,” not universal CV support.

## 10. Known limitations

- Mixed sidebar/main pages can still detach dates or contaminate later sidebar sections.
- Common but uncovered section headings can cause downstream section ownership failures.
- Header prose or a professional title can be promoted to a candidate name when no name is present.
- Experience parsing remains unreliable for company-first, single-date, or long free-form records.
- Skills extraction can absorb accomplishments or project prose when section ownership is wrong.
- Narrow or concatenated language labels and unlevelled languages outside the known map may be missed.
- Multi-line education records and detached dates can be fragmented.
- Image-only PDFs without supported OCR remain outside reliable V1 parsing.
- Passing seven synthetic fixtures does not establish support for arbitrary PDF geometry or typography.

## 11. Final V1 decision

**NOT READY — GENERALIZATION PROBLEM REMAINS**

The automated baseline and previously known real-CV validation are strong, but all three genuinely unseen native-text CVs had material correctness failures. Two failed primarily at section detection and field extraction; one also failed at mixed-layout reconstruction. Freezing the current behavior as a generally reliable V1 would therefore overstate the evidence.

The next engineering phase should prioritize architecture-level section ownership and conservative identity/record extraction. Any correction should first be reproduced anonymously and tested without using private candidate content.

## 12. Post-architecture validation

The historical failure matrix above is retained unchanged. A geometry-aware ownership layer was subsequently implemented using five anonymous synthetic failure families. The external CVs remained holdouts throughout development.

### Automated results

| Metric | Before | After |
| --- | ---: | ---: |
| Synthetic CV families | 7 | 12 |
| Synthetic/geometry staged checks | 68 | 120 |
| Full pytest suite | 538 passed | 595 passed |
| Failed / skipped / xfailed | 0 / 0 / 0 | 0 / 0 / 0 |
| Dependency warnings | 53 | 53 |

### Anonymous holdout matrix after architecture change

| CV | PDF | Layout | Sections | Identity | Skills | Experience | Education | Languages | Certifications | Overall |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CV-A | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | PASS | PARTIAL | PARTIAL |
| CV-B | PASS | PASS | PASS | PASS | PASS | PASS | PASS | N/A/AMBIGUOUS | PARTIAL | PASS WITH LIMITATIONS |
| CV-C | PASS | PASS | PASS | PASS | PASS | PARTIAL | PARTIAL | PASS | N/A | PARTIAL |

### Improvements demonstrated

- Canonical section ownership no longer crosses independent flows.
- Projects and accomplishments no longer contaminate explicit skills.
- Personal-information content no longer contaminates languages.
- Title-only documents return a null candidate name instead of a fabricated identity.
- Later-page continuation text remains with the previous business section rather than candidate identity.
- Common education/training headings establish education ownership.
- CV-B materially recovers all visible experience and education records.
- Explicit unlevelled language lists are retained in strong language-section context.

### Remaining holdout limitations

- CV-A contains partial education institution/degree details and a minor certification artifact.
- CV-B has an ambiguous inline language statement and certification wrapping remains partial.
- CV-C still has incomplete fields in two experience records and merges/partially parses compact education history.
- An unheaded introductory paragraph is not always promoted to summary; this is intentionally conservative.

### Updated V1 decision

**READY WITH DOCUMENTED LIMITATIONS**

The architecture-level contamination and false-identity failures are resolved on the holdouts, and previously covered behavior remains green. Record-level completeness is still imperfect, especially for compact education and long free-form experience formats. V1 can be frozen only with the documented native-text/layout scope and without claiming universal or perfectly complete CV parsing.

## 13. Post-record-parsing validation

The previous matrices remain as historical evidence. Record-level changes were developed from anonymous failing tests only; the external documents remained private holdouts.

### Automated results

| Metric | Before | After |
| --- | ---: | ---: |
| Full pytest suite | 595 passed | 602 passed |
| Failed / skipped / xfailed | 0 / 0 / 0 | 0 / 0 / 0 |
| Dependency warnings | 53 | 53 |

All 12 existing synthetic CV families, geometry/section ownership tests, extractor tests, pipeline tests, and API tests remain green.

### Anonymous record-level holdout matrix

| CV | Sections | Experience | Education | Certifications | Overall |
| --- | --- | --- | --- | --- | --- |
| CV-A | PASS | PASS | PARTIAL | PASS | PASS WITH LIMITATIONS |
| CV-B | PASS | PASS | PASS | PARTIAL/AMBIGUOUS | PASS WITH LIMITATIONS |
| CV-C | PASS | PASS | PASS | N/A | PASS |

Identity, skills, and languages did not regress. CV-A retains incomplete institution evidence for compact acronym-based education. CV-B contains a wrapped comma-only certification/course list whose logical boundaries cannot be recovered confidently from the visible structure. The parser deliberately leaves ambiguous fields unresolved instead of assigning prose.

### Final V1 decision

**READY WITH DOCUMENTED LIMITATIONS**

The deterministic architecture is maintainable at the current scope: native-text PDFs across the validated layout families, conservative identity, geometry-aware section ownership, and evidence-based record grouping. It is not universal CV parsing, and ambiguous free-form records may remain partial.
