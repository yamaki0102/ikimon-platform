# NOAH_REFERENCE_COMPARISON_V1

This is a **reference-relative visual-grounding comparison**, not human taxonomic gold.

The `NOAH_MAX_READ_V1` reference was frozen from the fixed 7 posts / 21 images before opening the saved raw Gemini/GLM outputs. Aggregate benchmark metrics had already appeared earlier, so this is not a formally blind scientific control.

Dataset SHA: `db98e2a6bd16f0cb3cf9b856dd54472d22760771d970572a3dead7bd99cfbfff`

## Preliminary picture

- **Gemini 3.5 Flash-Lite:** reference-direction aligned on roughly 5/7 posts; one clear likely target miss (`record-1784430118720`) and one case where it stayed very broad (`record-1784430530197`). It is operationally fast and usually conservative, but the current structured baseline output is sparse, so detailed visual-grounding quality cannot be compared fairly from prose richness alone.
- **GLM-5.3-Flash:** reference-direction aligned on roughly 4/7 posts. It exposes much richer visual evidence and uncertainty, which is useful for audit, but it also creates more unsupported detail and over-specificity. Likely conflicts are Acalypha species choice, `record-1784430118720`, and the blurred bird `record-1784430530197`.
- **Accuracy winner:** none. Human community/authority gold remains absent, so the formal verdict stays `INSUFFICIENT_GOLD`.

## Post-level comparison

| Visit | Noah reference | Gemini | GLM |
|---|---|---|---|
| `record-1784366489892` | `Erigeron` genus, low-medium | Asteraceae family, low — conservative but aligned | `Erigeron` genus — strongest alignment, but noisy ancillary claims / vernacular-name issue |
| `record-1784430741938` | `Oxalis corniculata`, species high | `Oxalis` genus high — one rank coarser | Oxalis/corniculata direction — aligned |
| `record-1781252770584` | Scarabaeidae family high | Scarabaeidae family — aligned | Scarabaeidae + Melolontha candidate — family aligned, genus/size more speculative |
| `record-1784430374598` | dwarf `Acalypha reptans/chamaedrifolia` complex | Acalypha genus safe, but repeatedly leans `A. hispida` | `A. hispida` — likely over-specific relative to short-spike dwarf morphology |
| `record-1784430118720` | `Bidens` genus; B. frondosa leading | `Rubus` — likely target/evidence miss | `Ampelopsis`/vine direction — likely target/evidence miss |
| `record-1784431188621` | `Passer montanus`, species high | `Passer montanus` leading — aligned | `Passer montanus` — aligned |
| `record-1784430530197` | `Hypsipetes` genus; H. amaurotis leading | very broad Passeriformes/Passeridae-like uncertainty — missed useful bulbul-like cues | Turdidae — likely conflict, but image is genuinely poor |

## Important test case: `record-1784430118720`

This is the most useful discriminator in the current set. The Noah reference uses the third photograph's small developing Asteraceae-like head, hairy peduncle and elongated outer bract-like structures to reach `Bidens` at genus level. Gemini instead went toward `Rubus`; GLM toward `Ampelopsis`/vine. This case should remain in the fixed benchmark because it measures whether a model integrates a small but highly diagnostic feature across all three photographs rather than anchoring on leaf shape alone.

## How to use this for future models

Keep `NOAH_MAX_READ_V1` immutable. For every new saved model output, append a new comparison layer and score:

- visible feature recall
- unsupported/hallucinated features
- taxonomic stopping-rank appropriateness
- multi-image integration
- subject separation in mixed scenes
- usefulness of requested follow-up evidence

Do not revise the Noah reference after seeing new model outputs. Do not convert Noah-reference agreement into biological accuracy; community/authority human gold remains the only accuracy gate.
