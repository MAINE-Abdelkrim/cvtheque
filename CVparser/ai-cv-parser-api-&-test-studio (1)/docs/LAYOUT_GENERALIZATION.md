# Layout generalization

## Diagnosed structural problems

The former native-PDF layout path divided the entire page at one midpoint. Full-width anchors were then applied globally. This worked for simple equal columns but could interleave a heading from one column with the body from another. It also could not represent an asymmetric sidebar or three parallel groups.

- The traditional two-column fixture placed `PROFIL` before the left skills body and `CERTIFICATIONS` before the right summary body.
- The sidebar fell back to global y/x order, inserting `CONTACT` between the main name and title.
- The dense lower band collapsed three x-groups into a binary split, mixing skills, education, and languages.
- The English page reconstructed correctly, but controlled section aliases lacked singular `EXPERIENCE`.

## Geometry algorithm

The native block path now locates the first pair of vertically overlapping blocks separated by a meaningful horizontal gutter. Blocks ending above that boundary remain a top-to-bottom prefix, usually the full-width identity area.

Blocks in the parallel area are clustered by stable left edge. This does not assume equal widths and therefore supports narrow sidebars. Each cluster is kept internally top-to-bottom, and clusters are ordered by their first vertical position and then left edge. Three or more groups use the same rule without adding a public layout enum.

Pages containing a later block spanning at least 65% of page width continue through the established mixed-layout anchor algorithm. This preserves full-width transitions and existing mixed-layout behavior rather than treating every wide block as a separator.

The algorithm is geometric. It does not inspect candidate names, employers, professions, fixture filenames, or section semantics.

## Section boundaries

Controlled exact aliases now include:

- `EXPERIENCE`
- `PROFESSIONAL EXPERIENCE`
- `PROFESSIONAL EXPERIENCES`

They map to the existing `EXPERIENCES` canonical section. `CONTACT`, `CONTACT INFORMATION`, and `COORDONNÉES` map to an internal segmented `CONTACT` section so sidebar contact details cannot become another section's body. No public schema changed.

## Regression coverage

Focused geometry tests cover equal columns, asymmetric sidebar/main content, full-width/column/full-width transitions, three parallel groups, unequal column heights, and certification dates staying in their own column. Synthetic section-content checks verify bodies, not only heading detection.

## Remaining limitations

This phase intentionally does not change skill, date, identity-location, experience-title, or education-institution extractors. Known field-level limitations include UX catalog/title coverage, multi-word location handling, generic institution-token parsing, Terraform recognition, and preservation of month components in dates. OCR logic, API routes, PDF validation, schemas, and optional model behavior are unchanged.
