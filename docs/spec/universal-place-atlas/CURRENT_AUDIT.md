# Universal Place Atlas current-state audit

Date: 2026-07-23

Base SHA: `e0f424c6424e04c27c662899f170e54a4a00b1cf`

## Source-of-truth checks

- repository: `yamaki0102/ikimon-platform`
- predecessor PRs: #1419 and #1420
- central deploy method: `orchestrator-release`
- execution entrypoint:
  `yamaki0102/ikimon-platform:scripts/run_cloudflare_staging_release.sh`
- normal execution layer: Cloudflare command bus/executor
- GitHub Actions: reference-only, not a deploy backend
- production approval boundaries: production deploy, D1 migration, secret
  update, rollback

The central project-state packet was stale and was not used as runtime truth.
The latest `origin/main`, central deploy registry, repository deploy manifest,
live health endpoints, and live UI were used instead.

## Reproduced baseline

| Target | Result before change |
| --- | --- |
| production health/ready | 200; D1 and R2 bindings ready |
| staging health/ready | 200; D1 and R2 bindings ready |
| 常磐公園 | production profile shows 23 public Records |
| 常盤公園 alias | does not resolve to the Shizuoka 常磐公園; Nominatim returns unrelated same-name parks |
| JUNGLIA OKINAWA | current area API returns no named area |
| イオンモール浜松市野 | current area API returns no named area |
| イオンモール浜松志都呂 | only nearby parks are returned; the mall is absent |
| recording CTA | present on the OSM park profile despite no verified photography/public-posting rule |
| staging live OSM | sampled area responses returned no live OSM features, showing external/cache degradation must remain partial |

Baseline screenshots are stored outside the repository in:

`E:\Projects\_agent_scratch\yamaki0102-ikimon-platform\universal-place-atlas-20260723\baseline`

## Current OSM evidence

OSM objects were discovered at run time and are evidence, not application
constants.

| Place | Current OSM evidence | Relevant tags |
| --- | --- | --- |
| 常磐公園, Shizuoka | way `125727939` | `leisure=park`, `name=常磐公園`, `name:en=Tokiwa Park` |
| JUNGLIA OKINAWA | way `1281984233` | `tourism=theme_park`, Japanese/English/Chinese names, operator and official website |
| イオンモール浜松市野 | way `189307274` | `shop=mall`, `building=retail`, formal `name`, generic brand/localized tags, official website |
| イオンモール浜松志都呂 | way `189307792` | named `landuse=retail`, official website |

Raw Nominatim and OSM map responses are stored under:

`E:\Projects\_agent_scratch\yamaki0102-ikimon-platform\universal-place-atlas-20260723\osm`

## Root causes

1. `areaPolygons.ts` discovers only park/garden/nature/playground/education
   families and exposes live sources as park or school.
2. Worker `supportedOsmType` adds only a few farm/community/nature tags and
   cannot profile theme parks or malls.
3. v1 references external OSM entity keys directly and has no canonical
   identity, alias, hierarchy, source history, or merge audit.
4. Node relation geometry does not assign inner rings; Worker does. This is a
   Node/Worker GIS parity defect.
5. UI `areaAccessStatus` maps OSM access or high source confidence to
   `public_access`, and `canSuggestDirectAreaRecord` uses that to show a Record
   CTA. Entry evidence and publication permission are conflated.
6. Search calls Nominatim directly and does not search a canonical alias index.
7. Theme cards are mostly request-time derivations. Persistent assertions,
   corrections, and provenance are absent.
8. Place Memory has private/tag/photo controls but no explicit moderated public
   place-atlas opt-in.
9. Imported display derivatives are bypassed in the UI hotfix; responsive
   resolver ownership and a visible image-error fallback are not unified.

## Official-source decisions for QA

- Static display name for the Shizuoka park is `常磐公園`, backed by the Shizuoka
  City facility page. `常盤公園` is a search alias only.
- The official facility name is `JUNGLIA OKINAWA`; Japanese search alias
  `ジャングリア沖縄` is retained.
- JUNGLIA terms limit guest media use and contain attraction/privacy
  restrictions. Public contribution must be `permission_required` or
  suppressed unless an applicable public-posting permission is verified.
- AEON Mall official pages are the display-name/official-link authority when
  OSM localized tags contain only the generic brand.
