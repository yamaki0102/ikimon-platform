# Area Map Biodiversity Badges

Date: 2026-05-23

## Decision

The public map should show lightweight area-level biodiversity cues for registered areas such as parks, nature symbiosis sites, TSUNAG/OECM/protected areas, and user-defined fields.

Initial display is presence-only:

- Show area name plus taxon-group chips.
- Use records observed within the last 24 months.
- Do not show count, rank, density, "many/few", or strength on the map.
- Sensitive species may contribute only to coarse taxon-group aggregation. Species names and precise positions are not exposed through these badges.

This avoids implying ecological strength from uneven survey effort.

## Staging Check

Before this change, staging returned registered area polygons for some regions, but the Naha viewport returned no OSM park polygons from:

`/api/v1/map/area-polygons?bbox=127.65,26.19,127.72,26.24&zoom=14&limit=80&sources=osm_park,school,user_defined`

A direct Overpass query for the same area returned parks including Matsuyama Park and Fukushuen, so the issue was not map rendering. The likely failure mode was live OSM acquisition/cache: an empty successful tile cache could suppress re-fetching for too long.

## Fix

- Empty live OSM cache results are no longer treated as complete evidence.
- Empty live OSM cache TTL is short.
- Live OSM fetches can fall back across multiple Overpass endpoints.
- Area polygon API now attaches `biodiversity_groups` only for registered UUID fields that have qualifying recent records.

## Water Signal

`水辺` is not a taxon group. It should be added later as an environment signal, separate from biodiversity chips.

Recommended shape:

```json
{
  "environment_signals": [
    { "key": "water_edge", "label": "水辺", "source": "osm_waterway" }
  ]
}
```

Candidate signals:

- `water_edge`
- `woodland`
- `grassland`
- `flowerbed`
- `wetland`
- `night`
- `managed_green`

Initial sources can be OSM `waterway` / `natural=water`, area guide text, and future fixed-point snapshots. Display these as separate outline chips, not in the taxon chip row.

## Strength Unlock Rule

Future "strength" display should be unlocked only for areas with comparable survey effort. Until then, keep the map presence-only and use copy such as `記録の厚みを確認中` in detail views.

Proposed minimum gates:

- `totalVisits >= 20`
- `effortReportedRate >= 0.60`
- `observerCount >= 3`
- `topObserverShare <= 0.60`
- `monthsCovered >= 6`
- `seasonsCovered >= 3`
- `completeChecklistRate >= 0.20` or `nonDetectionRate >= 0.10`

If any gate fails, do not show strength.

