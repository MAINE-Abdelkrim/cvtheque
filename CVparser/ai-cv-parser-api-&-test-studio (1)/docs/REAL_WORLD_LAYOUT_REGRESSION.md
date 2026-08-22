# Real-world independent-column regression

## Context

A private external, native-text CV exposed a layout family that the original six synthetic fixtures did not exercise. The document uses two asymmetric columns with independent vertical flows: left-side contact, education, skills, and languages coexist with a taller right-side profile, experience, and certification flow. The private PDF remains diagnostic input only and is not stored in fixtures or documentation.

## Root cause

Geometry reconstruction correctly kept each column contiguous. Information first became incorrect after reconstruction:

- a canonical experience heading wrapped over two lines, leaving its second line in the section body;
- narrow-column line wrapping divided logical skills and certification records;
- identity fallback treated two display-name lines made of spaced capitals as name plus job title;
- residence extraction scanned flattened downstream content when an explicit contact section contained no location;
- an explicit language outside the finite normalization map was discarded;
- a structural experience title preceding a date was not accepted when the present marker used a typographic apostrophe.

The problem was therefore not missing PDF text and not global left/right ordering. It was loss of logical ownership at controlled heading and field boundaries after a valid independent-column reconstruction.

## Anonymous synthetic geometry

`cv_07_independent_columns.pdf` reproduces the layout with fictional data. Its left and right sections start and end independently, its experience heading wraps naturally, and selected skill and certification values wrap in narrow columns. The expected JSON is generated from the same fictional candidate dictionary as the PDF.

Before the parser fix, the new fixture had four failing structured categories: identity location, skills, experiences, and certifications. After the general changes, all nine staged checks for the case pass.

## General rules

- Consecutive heading lines are consumed together only when their exact combined normalized text is an existing controlled alias for the same canonical section.
- Explicit skill-section continuations are joined only with grammatical continuation signals.
- Certification lines are joined when the continuation has a strong separator or begins as a lowercase continuation.
- An explicit contact section is authoritative for candidate residence, preventing education or employer cities from being inferred.
- Two leading display-name lines made solely of spaced capital letters are reconstructed before identity fallback.
- Explicit language entries with a recognized proficiency can be retained even when the language is outside the finite translation map.
- Structural experience titles can precede a single precise date, and typographic apostrophes are accepted in present markers.

These rules use geometry, controlled aliases, punctuation, and line structure. They do not inspect filenames, candidate names, employers, schools, or fixture-specific values.

## Results

| Suite | Before | After |
| --- | ---: | ---: |
| Synthetic staged expectations | 59 passed (6 cases) | 68 passed (7 cases) |
| Full suite | 521 passed | 538 passed |

The increase includes the nine permanent checks for the new fixture and focused unit regressions.

## Remaining limitations

The suite does not prove universal CV support. Ambiguous free-form lists without bullets or grammatical continuation signals may still be impossible to reconstruct perfectly after PDF flattening. Candidate location remains null when no explicit residence is written; school and employer locations are intentionally not inferred. Image-only documents remain governed by the existing OCR policy.
