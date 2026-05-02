# ikimon landing top design gap checklist

Source reference: `output/ikimon-top-prototypes/index.html`
Implementation target: `platform_v2/src/ui/landingTop.ts` and shared shell `platform_v2/src/ui/siteShell.ts`

## Current alignment

| Section | Status | Notes |
|---|---|---|
| Header | Mostly aligned | Existing staging logo and site name are preserved. Header spacing and pills are close enough for current pass. |
| Hero | Aligned with product constraints | Prototype composition and concept cards are kept. Dummy photo fallback is intentionally removed. Empty state uses abstract grid instead of sample images. |
| Daily dashboard | Aligned with data constraints | Card system and photo tiles follow prototype direction. This section is intentionally real-data-first because dummy observations are forbidden. |
| Link band | Aligned | Uses the prototype white pill/card treatment and stable CTA. |
| Flow / how-it-works | Aligned | Desktop uses three cards. Mobile uses the prototype timeline layout with numbered circles and right-side cards. |
| Map section | Aligned for mobile spacing | Mobile margin, heading size, and board height are tightened to the prototype proportions. |
| Library cards | Mostly aligned | Four-card structure and icon pills match the prototype. Copy remains implementation-specific. |
| Trust section | Mostly aligned | Card density and safety framing match the prototype. |
| Community section | Mostly aligned | Dark panel treatment matches the prototype direction. |
| Final CTA | Mostly aligned | Gradient CTA matches prototype; can still tune vertical crop against footer after staging screenshots. |
| Footer | Aligned | Shared footer now uses prototype structure: brand panel, mini-map, directory, and bottom bar. Existing logo/site name are preserved. |

## Remaining design debt

- Normalize fixed Japanese copy in `landingTop.ts` and `siteShell.ts` into i18n strings before expanding non-Japanese landing traffic.
- Re-run screenshots after staging deploy with real observations, because local no-DB mode only validates the empty-state branch.
- Decide whether the prototype's purely illustrative mini-map should replace, supplement, or stay separate from the real `MapMini` component on the landing map section.
- Add KPI keys to footer CTAs if footer navigation needs attribution beyond the first top CTA.
- Keep `docs/LANDING_TOP_TONE_MAP_2026-04-25.md` as the source for whether a section should prioritize HTML copy or real data.

## Verification target

- Desktop viewport: `1440x1200`
- Mobile viewport: `390x844`
- Required invariants:
  - No horizontal scroll.
  - No `/uploads/sample_*.png` or `sample_` strings.
  - Empty state shows no fake organism photos.
  - Real observation state uses `toThumbnailUrl()` outputs.
  - Flow section mobile renders as timeline.
  - Map section mobile uses compact prototype spacing.
  - Footer renders brand panel, mini-map, directory, and bottom bar.
