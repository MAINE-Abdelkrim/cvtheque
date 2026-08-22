# Geometry-aware section ownership

## Previous architecture

The native deterministic pipeline previously followed this path:

```text
PDFService.validate_and_open_pdf
  → PyMuPDF native page text
  → LayoutService.analyze_page_layout(page.get_text("blocks"))
  → LayoutAnalysisResult.ordered_text
  → PageExtractionResult.final_text
  → concatenate pages
  → clean_raw_resume_text
  → SectionService.detect_and_segment_sections(flat text)
  → Dict[str, str]
  → deterministic field extractors
```

`LayoutService` used geometry to select reading order, but geometry was discarded when blocks became `ordered_text`. `SectionService` therefore received one global line stream and could not distinguish independent column flows.

## Failure mechanism

The flattened representation caused three general failure classes:

- a heading in one column could terminate or contaminate ownership in another column;
- detached date rails could be separated from the record they described;
- an unknown but visually clear heading did not stop the preceding canonical section.

The final unseen validation also showed that later-page unheaded continuation text could contaminate candidate identity if treated as another document header.

## New internal architecture

Native PDFs now retain positioned lines until section ownership is complete:

```text
PDF native page
  → LayoutService (compatible final_text diagnostics)
  → GeometrySectionService
       PositionedTextLine[]
       → page-local left-edge flow clustering
       → canonical/structural heading classification
       → same-flow ownership
       → page-local canonical buffers
  → controlled multi-page combination
  → Dict[str, str]
  → existing deterministic extractors
```

`final_text`, pipeline page diagnostics, and the public CV JSON schema remain unchanged. OCR and low-confidence fallback paths retain the existing flat `SectionService` behavior.

## Positioned line model

The internal `PositionedTextLine` records:

- text;
- page number;
- bounding box (`x0`, `y0`, `x1`, `y1`);
- maximum font size;
- bold style;
- page-local flow identifier.

It is intentionally internal and is not exposed through API models.

## Flow ownership

Each page calculates its own left-edge clusters. This supports single columns, asymmetric sidebar/main columns, and three parallel groups without carrying page-one coordinates onto later pages.

Within a flow, a canonical heading owns following lines until the next heading in that flow. Headings from another flow do not terminate it. Detached date tokens sharing a narrow rail are kept together before neighboring record prose.

## Heading classification

Three line roles are distinguished:

1. canonical heading — exact controlled alias mapped to a public/internal canonical section;
2. structural boundary — visually heading-like text or a small controlled set of common non-public boundaries;
3. body text.

Unknown visual headings require conservative evidence: short form, no sentence punctuation, heading-scale typography, and uppercase or emphasized/isolated presentation. Bullets are explicitly excluded.

The controlled title-case structural boundaries are limited to common document divisions such as achievements, accomplishments, volunteering, publications, training, and personal information. They stop ownership but do not add fields to the public schema.

## Canonical aliases

The education aliases now include common “education and professional training” variants. These map to the existing `EDUCATION` section and do not change the public schema.

## Multi-page behavior

Flow geometry is recalculated independently per page. The first page alone contributes identity `HEADER` content. Unheaded text at the beginning of a later page continues the previous page's last canonical section, preventing both record loss and false identity promotion.

## Downstream safety changes

After upstream ownership was stabilized:

- identity extraction restricts name inference to the owned header and prefers null when a lone title is confirmed by experience structure;
- company-first free-form experience records can use a following short title line;
- explicit language lists can retain standalone languages without mandatory levels;
- `College`/`Collège` is recognized as a general institution keyword.

These rules prefer null over arbitrary prose when evidence is insufficient.

## Privacy and generalization

The external validation PDFs remain outside the repository. No candidate name, contact, employer, institution, filename, or exact private text was introduced into production code, fixtures, tests, or documentation.

Five fictional regression families reproduce geometry and structural behavior only: detached date rail, unknown boundary, education/training alias, title without name, and company-first free-form experiences.

## Limitations

Geometry-aware ownership prevents major cross-section contamination but does not solve every record parser ambiguity. Compact education histories, institution-free education lines, certification wrapping without separators, and long free-form experience records can still produce partial fields. Image-only input remains governed by the existing selectable-text/OCR policy.
