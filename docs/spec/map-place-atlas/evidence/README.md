# Map Place Atlas Visual QA Evidence

Captured: 2026-07-23
Fixture: registered field equivalent to 常磐公園
Route: local `/ja/map`
Source test: `platform_v2/e2e/map-place-atlas.staging.spec.ts`

| File | Viewport | Contract checked |
| --- | ---: | --- |
| `visual-375.png` | 375 × 672 | mobile bottom sheet, close/grip 44px, safe-area, no horizontal overflow |
| `visual-390.png` | 390 × 849 | mobile full profile, summary/highlights/theme order, launcher clearance |
| `visual-768.png` | 768 × 1025 | tablet sheet, representative media, summary and navigation clearance |
| `visual-1024.png` | 1024 × 769 | desktop side panel, map remains operable |
| `visual-1280.png` | 1280 × 801 | desktop side panel and map balance |
| `visual-1536.png` | 1536 × 961 | wide desktop, scrollable profile and selected-place context |

The fixture intentionally uses generic media artwork rather than a production photograph. It verifies layout and
state contracts without copying user media. The same E2E run checks that three fixture Records are not rendered as
an empty place, CTA href/KPI attributes are retained, and no raw latitude/longitude is sent to the profile API.
