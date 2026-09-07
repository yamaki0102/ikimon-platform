# ZUKAN Specialist Capability Routing — 2026-09-07

Status: `ADOPTED CANDIDATE / PRODUCT-LOCAL ROUTING / RUNTIME IMPLEMENTATION SEPARATE`
Extends: `PLAN.md`

## Decision

ZUKAN keeps its differentiated public product loop and does not become a general event platform, GIS product, CMS, commerce platform, survey product, media pipeline or workflow engine.

The existing PLAN rule remains authoritative:

`prove repeated real demand -> reuse the Program/Publication core -> build software only for repeated demand -> generalize last`

This document resolves which specialist capabilities should normally be reused when a ZUKAN journey needs them.

## ZUKAN-owned product meaning

Keep custom/product-owned:

- photo/video/audio contribution and Record identity;
- Place / Area / public commons discovery experience;
- AI candidate versus verified/human-reviewed truth;
- contributor feedback and return loop;
- publication consent, minor/guardian rules, correction and withdrawal;
- Program participation continuity only where it is genuinely ZUKAN-specific;
- public source provenance and trust presentation;
- ZUKAN-specific SEO/public knowledge projections;
- lightweight map experience needed for public discovery and field capture.

Do not outsource these semantics to a generic SaaS.

## Specialist capabilities to reuse

| Need | Default routing | ZUKAN delta |
|---|---|---|
| deep GIS editing / collaborative spatial analysis | Felt or CARTO | expose only the result/ref needed by ZUKAN; do not create a second public map product |
| 3D globe / large spatial/point-cloud view | Cesium/Potree when required | ZUKAN Record/Place linkage and rights only |
| organizer booking / capacity / waitlist | Cal.com when actual repeated demand requires it | Program/participant reference and return receipt; no custom booking engine |
| surveys / feedback | Formbricks | link responses to authorized Program/project context only |
| workflow / external SaaS automation | Activepieces MIT core or provider-native automation | bounded ZUKAN authority and receipt; no workflow builder |
| notifications | Novu/provider-native delivery | participant/organizer Attention semantics and consent |
| generic CMS/editorial admin | existing ZUKAN source/publication core first; Payload only if a distinct editor-facing CMS need is proven | publication rights/provenance remain ZUKAN-owned |
| commerce / paid programs / marketplace | Medusa/Mercur only after paid demand is proven | ZUKAN Program/reference continuity; do not build commerce primitives |
| credentials for participation/achievement | Open Badges 3.0 / W3C VC | evidence link, holder visibility, correction/revocation continuity |
| web operations where no API exists | Browser Use as fallback | explicit allowed domain/action and read-back; not primary architecture |

## Immediate roadmap interpretation

- No new general map/GIS editor or spatial-analysis engine.
- No custom complex booking/capacity/waitlist engine. Existing participant-first discovery/intake UX may remain; specialist scheduling is linked only when necessary.
- No custom survey builder, notification transport, commerce core or workflow builder.
- Public ZUKAN discovery/map/capture UI remains custom where it is part of the Core Loop; specialist engines must not impose their admin UX on contributors.
- M9-M12 profile expansion remains demand-first. A profile does not justify rebuilding the specialist software category behind it.
- Existing terminal Evidence and current Core Loop work are unaffected unless their scope explicitly recreates a specialist capability above.

## Runtime status

This is product routing only. It does not claim Felt, CARTO, Cal.com, Formbricks, Activepieces, Novu, Medusa, Open Badges or Browser Use are currently connected to ZUKAN.