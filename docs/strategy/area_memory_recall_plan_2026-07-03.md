# Area Memory Recall Plan 2026-07-03

## Decision

ikimon.life should treat dense photo posting in a real area as a personal "field memory" signal, not as a generic map statistic. The immediate product gap is that heavy users can create many observations in a park, tourist site, restaurant-adjacent walk, or trip area, but the app mainly returns individual records and public area summaries. It does not reliably say: "you spent time here; this place now has a shape in your own record."

There is a second, related gap: when a public area page already exists, the user expects their accepted non-sensitive records inside that park or certified area to appear as part of that area. If the area page is registered but the user's records look unlinked, the product reads as broken even if the underlying privacy model is technically cautious.

## Competitive Framing

Google Maps Timeline is strong at passive visit and route recall. Google Photos is strong at automatically grouping photos into meaningful moments. ikimon should not compete by storing broad passive location history. Its sharper lane is active biodiversity recall: a place becomes memorable because the user photographed organisms, habitat, seasons, and repeated views there.

## Issue Tree

- Recall trigger: when and where should the app remind the user of a place they worked hard in?
- Area grouping: how do individual observations become one meaningful area without exposing precise private locations?
- Emotional value: what should the user feel when returning to that area?
- Scientific value: how does the same surface also improve revisit, season, and effort quality?
- Safety boundary: how do we avoid leaking exact coordinates, sensitive species, school/child context, faces, or private places?
- Public area boundary: which registered areas can safely receive public record association, and which should remain restricted or viewer-only?
- Layer integrity: are schools, nature symbiosis sites, TSUNAG, protected areas, OECM, parks, and user-defined fields all still discoverable on the map at the expected zooms?
- Measurement: how do we know this is better than a static record list?

## Adopted P0

### P0-A: Private Dense Area Recall

Add a private "dense area recall" layer to the map home.

- Extend the existing signed-in-only `/api/v1/map/my-observations` response with `clusters`.
- Build clusters from the user's own exact observations server-side from existing rows; no DB migration.
- Group nearby records into rough 1 km field-memory clusters and rank by density, recency, and photo count.
- Expose only to the signed-in user and reuse the existing exact-owner map privacy boundary.
- In the existing "自分の記録へすぐ戻る" panel, show up to three dense places with representative photo, locality/place label, record count, date span, and a one-tap focus action.
- On click, fly the map to the cluster and open the existing own-observation stack for records in that cluster.

### P0-B: Public Park / Certified Area Association

Make registered public-area pages feel linked to the user's real records without weakening sensitive-location policy.

- Public parks, protected areas, OECM, nature symbiosis sites, TSUNAG areas, and user-defined public fields can show accepted non-sensitive public records that were photographed inside the area.
- Roadsides, residential-adjacent points, home-area clues, school routes, faces, and rare-sensitive species must stay masked or excluded by the existing quality and risk gates.
- Area matching should tolerate small GPS edge drift for public/open areas, because park boundary polygons and phone GPS commonly disagree near entrances, paths, and edges.
- The tolerance must not apply to schools. School polygons can be discoverable as map context, but recording guidance remains restricted and public exact association should not encourage searching or photographing around the site.

### P0-C: Registered Area Layer Recovery

Restore the intended map layer behavior for registered area polygons.

- Parks should not be the only human-scale polygons users can discover.
- Nature symbiosis sites, TSUNAG, protected areas, OECM, schools with concrete boundaries, and user-defined fields should be queryable and rendered when their source is enabled or when the default zoom policy includes them.
- Approximate school point buffers should remain safety-restricted, but concrete named school polygons from OSM live or enriched stored boundaries should not disappear.

## P1 Later

- Dedicated "Field Album" page per personal cluster with seasonal timeline and best-of photos.
- Post-save feedback that says whether the new record strengthened an existing area memory.
- Return prompts that are seasonal or trip-based, not generic "revisit" nags.
- Optional user-named field memories such as "ホテル近くの公園" or "Junglia の森".
- Public exact pins for non-sensitive park records, only after a separate policy review. P0 is area association and private owner exact display, not broad public exact coordinate release.

## Non-Goals For P0

- No passive background location history.
- No new production DB tables.
- No public exposure of exact personal clusters.
- No notification or push reminder.
- No auto-generated "memory story" claims that imply the app knows the user's feelings.

## Acceptance Criteria

- Signed-out users receive no personal clusters.
- Signed-in users can see dense personal areas from their own observations on `/ja/map`.
- The feature still works if no clusters exist.
- The UI does not replace community area summaries or public map safety rules.
- Public/open area pages can include records that are just inside or just outside a trusted public-area polygon by a small GPS tolerance.
- School area pages and school polygons keep restricted guidance and do not use public/open-area tolerance.
- Area polygon API and boot script continue to support schools, nature symbiosis sites, TSUNAG, protected areas, OECM, parks, and user-defined fields.
- Tests cover the private API contract, cluster generation, area matching tolerance, area polygon source behavior, and map boot script wiring.

## Metrics

- `map:personal_memory_cluster_open` click rate.
- Return from map cluster to own record stack.
- Repeat map visits among users with 10+ records.
- Later: records added to a previously clustered area within 30 days.

## Open Review Questions

- Is "dense personal area recall" the right P0, or should the first move be post-save feedback instead?
- Is a 1 km rough cluster too broad or too narrow for parks, resorts, and restaurant-side walks?
- Does the UI risk feeling like generic Google-style memory instead of ikimon's field-observation identity?
- Should public park records ever expose exact public pins, or should P0 stop at area-page association?
- Is a small GPS edge tolerance enough, or do we need a backfill/repair path for historical `resolved_field_ids`?
- What should not be implemented before stronger evidence?

## Fable5 Review Reconciliation

Review: `E:\Projects\_agent_scratch\fable5-premium-review\ikimon-area-memory-recall-20260703\ikimon-area-memory-recall-20260703\claude-review-20260703-083759.md`

Verdict: adopt with changes.

Adopted:

- P0-A private dense clusters stay in scope because they reuse the signed-in owner boundary and do not add passive location history.
- P0-C map layer recovery moves ahead with diagnosis first. The concrete root cause found in code is that the map polygon API requires `polygon IS NOT NULL`, while TSUNAG and many nature symbiosis seed rows are registered as center + radius only.
- Concrete named school polygons remain visible as restricted context.

Changed:

- P0-B does not add public outside-polygon GPS tolerance in this pass. The first production-safe move is area association for strict polygon/radius scope and better registered area visibility.
- Non-school certified areas without polygons render as approximate radius areas. School point-buffer fallbacks remain hidden.
- `/api/v1/map/my-observations` remains private/no-store and returns clusters only from the signed-in user's exact observations.

Deferred:

- Public exact pins for park records.
- Outside-polygon tolerance for public park pages.
- Production DB backfill for `resolved_field_ids`.
- Personalized field-memory story pages.
