# ikimon landing top tone map

Source reference: `output/ikimon-top-prototypes/index.html`
Implementation target: `platform_v2/src/ui/landingTop.ts`

## Final tone rule

The landing top uses two distinct tones:

- HTML copy priority: explain the service promise with stable conceptual language.
- Real data priority: show observations, photos, counts, and map cells only where the UI is explicitly about current activity.

Do not mix raw counts into concept-first panels. This is why the hero cards are `証拠 / 確認 / 安全`, while observation counts stay in the daily cards, recent observation rows, and map preview.

## Section classification

| Section | Priority | Rule |
|---|---|---|
| Hero copy | HTML copy priority | Use the submitted headline, lead, and promise language. Do not lead with counts. |
| Hero promise cards | HTML copy priority | Show `証拠 / 確認 / 安全`; never show `0` stats in the hero. |
| Hero visual recent observations | Real data priority | Use real observations only. If none exist, show the empty state and no dummy photos. |
| Link band | HTML copy priority | Keep the submitted reading-entry copy and stable CTA. |
| Daily observation section | Real data priority | Use real featured observations, real photos, text evidence cards, or the explicit 0件 empty state. |
| Daily action cards | Real data priority | Counts and metrics are allowed because these cards answer "what can I do today?" |
| Flow section | HTML copy priority | Use the submitted three-step explanation: 見つけたら撮る / 場所と環境を残す / 名前を確かめる. |
| Map section copy | HTML copy priority | Use the submitted "地図で変化を見る" explanation. |
| Map board | Real data priority | Use `MapMini` cells from current data. Empty map copy is allowed; fake map observations are not. |
| Library / trust / community / CTA | HTML copy priority | Keep stable explanatory copy from the submitted HTML. |
| Footer | HTML copy priority | Keep the submitted footer story and directory labels while preserving staging logo and site name. |

## Guardrails

- No `/uploads/sample_*.png`.
- No dummy organism names as live content.
- Hero cards must remain concept cards even when stats exist.
- Real photo rendering must continue through `toThumbnailUrl()`.
- 0件 states should explain the absence of real observations without filling the screen with fake data.
