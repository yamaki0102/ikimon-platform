# Record detail visual QA

## Before / after evidence

- `before-production-390x844.png`: current production multiple-observation record before this change
- `before-production-1280x900.png`: same record on desktop before this change
- `after-fixture-390x844.png`: exact changed renderer, multiple observations and multiple media on mobile
- `after-fixture-1280x900.png`: exact changed renderer on desktop

The after fixture uses the existing public EXIF-scrubbed derivatives from the same public record. It does not include private media or exact-location data.

## Browser matrix

| Width | Result |
|---:|---|
| 320 × 760 | pass |
| 375 × 812 | pass |
| 390 × 844 | pass |
| 768 × 1024 | pass |
| 1280 × 900 | pass |

States rendered: guest zero observations with photo/audio; authenticated non-owner multiple AI/community observations with photo/video; owner accepted identification with environment and related record; private owner pet record without media. The multi-observation fixture also covers group and unknown subjects.

Automated browser findings across eight cases:

- horizontal overflow: 0
- visible interactive targets below 44px: 0
- missing visible focus after keyboard Tab: 0
- details unexpectedly open on initial load: 0
- duplicate record media IDs: 0
- forbidden empty-state copy: 0
- exact-location key findings: 0
- zero-observation summary findings: 0

Staging and production screenshots are attached to their exact-SHA release evidence after deployment; these local fixtures are the pre-deploy comparison baseline.
