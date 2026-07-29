# Kubiaka UI revision 1 — Visual QA

## Method

The self-contained `visual-preview-revision-1.html` was loaded with Playwright using system Chromium. Each viewport was measured from the rendered DOM. Reduced motion was tested in a separate browser context with `reduced_motion="reduce"`.

## Results

| Width | Horizontal overflow | Pending-entry height | Pilot badge visible | Normal-motion animation | Reduced-motion animation | Public-map links | Active `/kubiaka/record` links |
|---:|---|---:|---|---|---|---:|---:|
| 320 | PASS | 60 px | PASS | none (mobile contract) | none | 0 | 0 |
| 375 | PASS | 60 px | PASS | none (mobile contract) | none | 0 | 0 |
| 390 | PASS | 60 px | PASS | none (mobile contract) | none | 0 | 0 |
| 412 | PASS | 60 px | PASS | none (mobile contract) | none | 0 | 0 |
| 768 | PASS | 58 px | PASS | none (mobile/tablet contract) | none | 0 | 0 |
| 1024 | PASS | 58 px | PASS | `kubiaka-float` | none | 0 | 0 |
| 1440 | PASS | 58 px | PASS | `kubiaka-float` | none | 0 | 0 |

## Structural checks

- `<main>` landmarks in the standalone preview: 1
- receipt represented as `<figure>` with visible `<figcaption>`: PASS
- caption text explicitly says the receipt is an example and is not available yet: PASS
- `kubiaka-visual-wrap` is not `aria-hidden`: PASS
- decorative SVG/corner elements remain hidden from assistive technology: PASS
- mobile pilot badge computed display: `flex`
- active camera-entry link: 0
- public-map link: 0
- minimum supported width: 320 px

## Scope of evidence

This validates the self-contained review preview and source-level contracts. Repository-native typecheck, Node tests, build, authenticated route recovery, and runtime Visual QA remain required after the proposal is applied to a fresh implementation branch.
