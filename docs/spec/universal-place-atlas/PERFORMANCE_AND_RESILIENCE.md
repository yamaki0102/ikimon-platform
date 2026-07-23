# Universal Place Atlas performance and resilience report

Generated: 2026-07-23 JST

## Implemented controls

- generic OSM discovery is contextual: high zoom, explicit search, selected
  Place, or Record-near discovery;
- map movement does not issue an unbounded Overpass request per pan;
- OSM resolver uses TTL cache, negative cache, bounded endpoint attempts, and
  timeout;
- selected Place profile is fetched lazily;
- UI retains `AbortController` cancellation and sequence guards;
- registered canonical boundaries keep a profile available when Overpass is
  unavailable;
- relation inner rings remain holes;
- request-time geometry scans stop at 1,000 vertices and return `partial`
  instead of simplifying into a false membership;
- snapshot reads stop at 500 rows and return `partial` with unknown totals
  instead of treating the capped set as complete;
- medium geometry is chunked below D1 bind limits;
- public-cell fallback remains available when no named Place resolves;
- Node and Worker expose the same profile/search version and cache contract.

## Observability

The following signals are implemented:

- `Server-Timing: place_profile;dur=...`;
- `Server-Timing: place_search;dur=...`;
- `X-Ikimon-Latency-Ms`;
- OSM resolution success/error/cache/latency structured logs;
- Place profile open;
- theme-card open;
- Place recording CTA;
- membership correction;
- image error;
- empty-profile contradiction.

Anonymous KPI payloads contain Place kind/state and bounded UI context, not
exact coordinates or contributor identity.

## Failure-mode evidence

- Overpass outage with a registered canonical boundary: profile remains
  available;
- external profile error: UI renders an explicit error while the map remains
  usable;
- stale response: earlier requests cannot overwrite the latest selection;
- invalid/huge geometry: no unbounded global snapshot scan;
- media failure: visible fallback is rendered;
- Worker bundle staging dry-run: 2,053.67 KiB raw / 437.57 KiB gzip.

## Latency status

Local unit and fixture E2E timings are not used as production-like p95 proof.
Staging must collect multiple uncached and cached samples for Place search and
profile API, record p50/p95/error rate, and preserve response timing headers.
Until that run is complete, latency is **implemented but not staging-verified**.

## Rollout

The rollout table supports place-kind and explicit canary controls. Initial
canaries are:

1. 常磐公園;
2. JUNGLIA OKINAWA;
3. イオンモール浜松市野;
4. イオンモール浜松志都呂.

The forward rollback disables rollout and enabled kinds without deleting
Place, boundary, membership, source, or audit evidence.
