# Opus review request — Kubiaka focused experience

## Current status

The original cherry-tree-only proposal and revision 1 are **superseded as the current product framing**.

A second review correctly closed the prior safety P0s but identified remaining packet and copy issues. Before those mechanical fixes were finalized, current official research and July 2026 orchard detections confirmed that the experience must not be bounded to cherry trees.

Start with:

`revision-2/ECOLOGY_AND_PRODUCT_SCOPE.md`

Revision 2 will be reviewed only after complete replacement source files and a complete self-contained visual preview are committed. Do not review patch fragments as the current proposal.

## Product decision

The experience covers Rosaceae street trees and fruit trees, especially cherry, ume, peach, sumomo, and apricot. It must support both public-tree and orchard contexts without requiring the contributor to identify the tree.

The entry will start from observable evidence:

- whole tree / trunk / branches
- possible frass
- possible adult beetle
- hole or bark damage
- unknown

One photo is enough to start. Additional photography is optional, never required before save. No photo alone is represented as species confirmation or damage diagnosis.

## Safety boundary retained

- no public map in this phase
- no automatic external reporting or send
- no AI candidate presented as confirmed
- no live-specimen transport guidance that conflicts with the Invasive Alien Species Act
- conditional official guidance when an adult candidate or strong damage sign is selected
- existing composer reuse only through a dedicated Kubiaka entry context

## Canonical context

- Strategy: **Receipt-first, Map-later**
- Parent safety PR: `yamaki0102/ikimon-platform#1498`
- Parent exact head: `fb47e198a828ab37f5935e84c17c30c757b6f186`
- Superseded implementation PR `#1492` must not be used.

## Next review gate

Revision 2 must contain:

1. complete current source files
2. complete current HTML preview
3. ecology/source note
4. measured visual and accessibility QA
5. route and safety tests
6. no patch reconstruction dependency

The requested verdict will again be `APPROVE`, `APPROVE_WITH_CHANGES`, or `REQUEST_CHANGES`, with findings ordered P0 → P1 → P2.
