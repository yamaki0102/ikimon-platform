# School Boundary OSM / ODbL Policy

Status: pre-write gate
Updated: 2026-07-05

## Scope

This policy applies when ikimon persists OpenStreetMap school/campus boundary geometry into the school area readmodel. It does not apply to transient live map responses that are not stored.

## Source Identity

- MEXT/P29-backed school rows remain the source identity.
- Existing `field_id`, `certification_id`, and `entity_key` must not be replaced by OSM IDs.
- OSM IDs are boundary provenance, not ikimon field identities.

## Attribution

Every persisted OSM boundary update must record:

- `osm.type`
- `osm.id`
- `osm.url`
- `matched_name`
- `match_method`
- `distance_m`
- `name_score`
- `matched_at`
- `odbl.attribution = "© OpenStreetMap contributors"`
- `odbl.license = "ODbL-1.0"`

The public UI must continue to show OSM attribution wherever OSM-derived geometry is displayed.

## Persistence Gate

Before production persistence:

1. Save a dry-run match report.
2. Save rollback snapshots for every affected PostgreSQL and D1 row.
3. Confirm all automatic matches use point-in-polygon containment.
4. Keep distance fallback as manual review unless explicitly approved for a bounded case.
5. Confirm school access/safety copy still says permission is required.

## Rollout

The first production write is limited to:

- `fbe4dccc-83b9-4833-ac88-1b0a2cb68d90` / `静岡県立浜松西高等学校`
- `818da461-166c-4395-89ff-739ffe4c2951` / `静岡県立浜松西高等学校中等部`

Wider Hamamatsu, Shizuoka, or national rollout requires a separate dry-run report and approval.

## Legal Note

This is an engineering policy, not legal advice. Before broad rollout, confirm whether the combined MEXT/P29 + OSM derived database creates ODbL share-alike obligations beyond attribution.
