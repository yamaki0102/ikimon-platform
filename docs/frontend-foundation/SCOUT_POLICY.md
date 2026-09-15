# Frontend Scout policy

## Automation boundary

The scout may discover, diff and prioritize. It must not install packages, change runtime dependencies, rewrite product UI, or merge/promote a candidate automatically.

## Candidate priority

`P1`: accessibility/keyboard regression or improvement, deprecation/security/license change, browser-native replacement that can delete custom code.

`P2`: repeated product-local implementation with measurable drift, mobile interaction improvement, material performance improvement, high-frequency async/state behavior.

`P3`: visual inspiration or low-frequency component variation. Keep as reference unless a current product need exists.

## Product routing

- NOCOSIL: chat/composer, async status, search, command/action, continuity states, responsive workspace surfaces.
- ZUKAN: capture, event/participation, map/sheet, upload, public discovery, mobile-first field interaction.
- iPortal: inherit NOCOSIL behavior first; add only organization-specific presentation where required.

## Evidence required for promotion

At least one of: repeated implementation in multiple files/surfaces, repeated cross-repository copying, a verified accessibility defect, a current product requirement, or deletion/simplification of existing custom code.
