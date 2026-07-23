# Universal Place Atlas — staging search handoff review packet

## Review identity

- Repository: `yamaki0102/ikimon-platform`
- Pull request: `#1437`
- Code SHA under review: `1edc429ce0dca78158cbab0f66293f97777d3ebc`
- Review-remediated code SHA: `870b6b5b0dfabef90899c52b6326b9499747031d`
- Base SHA: `cbce91df57a34d098dcd55a9ac1a798d9e5a76a4`
- Previously deployed staging SHA: `e1f05f9603a8662803d6c79688ad1e7252c080c8`
- Review scope: canonical Place search → profile handoff only

## Observed staging failure

At the previously deployed staging SHA, the canonical search API returned correct
results for `常盤公園`, `常磐公園`, `ジャングリア`, `JUNGLIA OKINAWA`, and
`イオンモール`. Clicking a result moved the map but did not open
`[data-place-atlas-profile]`.

The UI waited for the selected canonical Place to reappear in a separate
`/api/v1/map/area-polygons` response. The real response for the Tokiwa Park
search bbox returned zero features, so no profile request was sent.

## Root cause and implementation

`mapExplorerBootScript` is emitted inside a TypeScript template literal.
The previous runtime regex used `\d`:

```js
var osmMatch = /^(node|way|relation)[:/](\d+)$/.exec(sourceId);
```

The template-literal layer did not preserve that escape in the emitted browser
script. `osm_type` and `osm_id` were therefore empty even though the public
search result contained `osmSourceId: "way:1281984233"`.

The fix:

1. Uses `[0-9]+` so the emitted browser regex is stable.
2. Builds a transient canonical selection only for public canonical results
   with a valid OSM `way` or `relation` reference.
3. Uses the existing public search contract's safe bbox projection, never exact
   Record coordinates.
4. Opens the existing Place Atlas profile loader immediately with
   `kind=osm_area`, while normal map movement and area discovery continue.
5. Keeps the old delayed `area-polygons` matching path for noncanonical or
   unresolved search candidates.

The transient projection is labelled `boundary_projection: "safe_bbox"`. A
canonical result without a valid bbox does not use a generated radius and stays
on the existing delayed discovery path. The projection is a UI selection
context; it is not persisted as a Place boundary.

## Verification performed

- `npm run typecheck`: pass.
- `npm run build:server`: pass.
- Focused canonical alias E2E: pass.
  - `ジャングリア` resolves to `JUNGLIA OKINAWA`.
  - profile request contains `osm:way:1281984233`.
  - restricted Place has no record-here CTA.
- Full local Place Atlas E2E:
  - initial run: 26 pass, 2 declared skip, 2 isolated marker-click timeouts.
  - targeted rerun: WebKit 1024 pass; Firefox 1536 pass.
- Node regression: no failure marker; stderr empty.
- No DB, migration, secret, production, or exact-coordinate change in this PR.

## First independent review adoption

Claude Opus 4.8 identified two conditional P0 concerns from the compact packet:
an unspecified generated-radius centre and a possible immediate/delayed
selection race. The implementation and tests were tightened before staging:

- `generated_radius` was removed from canonical handoff. A valid public bbox is
  now mandatory.
- Immediate canonical handoff sets `pendingPlaceSearchRef` to null, so the
  delayed `area-polygons` matcher cannot reopen or replace that selection.
- Existing `placeAtlasSeq` and `AbortController` guards keep the latest user
  selection authoritative for profile responses.
- A negative browser regression now proves an OSM node result does not request
  a Place profile.
- A boot-script regression now verifies the emitted `[0-9]+` regex and rejects
  the previously emitted `d+` form.
- The two isolated timeouts were in the pre-existing nearby-marker fixture
  selection path, not the new search-result handoff; both exact cases passed
  their single diagnostic rerun.

## Questions for independent review

1. Is there any P0/P1 privacy leak in converting a public bbox search result
   into a transient selection context?
2. Can the immediate profile open race with normal `area-polygons` discovery or
   leave stale selection state?
3. Does the fix remain fail-closed when the canonical result lacks a valid OSM
   `way`/`relation` reference?
4. Are the regression tests sufficient to prevent the search UI from appearing
   successful while profile handoff is broken?
5. Is there any reason this change should block a staging-only deploy?
