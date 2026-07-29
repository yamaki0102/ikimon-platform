# Kubiaka private-pilot UI — Visual QA evidence

## Reviewed surfaces

- self-contained reference: `visual-preview.html`
- proposed runtime source: `proposed/platform_v2/src/ui/kubiakaExperience.ts.part00` through `part03`
- proposed route/copy/tests under `proposed/platform_v2/src/`

## Responsive checks

| Viewport width | Horizontal overflow | Primary CTA height | Hero line control | Reduced-motion behavior |
|---:|---|---:|---|---|
| 320 px | PASS | 60 px | PASS | PASS |
| 375 px | PASS | 60 px | PASS | PASS |
| 390 px | PASS | 60 px | PASS | PASS |
| 412 px | PASS | 60 px | PASS | PASS |
| 768 px | PASS | 58 px | PASS | PASS |
| 1024 px | PASS | 58 px | PASS | PASS |
| 1440 px | PASS | 58 px | PASS | PASS |

## Static contract checks

- one primary CTA: PASS
- CTA appears before explanatory sections on mobile: PASS
- duplicate HTML IDs: 0
- public `/map` link: 0
- `/kubiaka/area` route/link: 0
- external URLs or fetches: 0
- database access: 0
- inline artwork only; no generated lifestyle photo or rights-unknown asset: PASS
- all core anchors (`how-to`, `receipt`, `about`, `promise`, `faq`): PASS
- `prefers-reduced-motion` disables the floating animation: PASS

## Known limits

This packet is a source and visual review before runtime application. Repository-native full typecheck, Node tests, build, browser runtime screenshots, authentication return-path verification, and staging Visual QA must be completed after review findings are resolved and the proposal is applied to a successor implementation branch.
