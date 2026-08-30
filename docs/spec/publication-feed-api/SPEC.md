# ZUKAN Publication Feed API v1

Status: `IMPLEMENTED / SOURCE-ONLY`

## Purpose

Provide one stable, privacy-safe public API for reusing ZUKAN records on external websites such as area sites, facilities, municipalities, schools, tourism sites, and partner media.

The first consumer is `lenrinokinoshitade-renewal`, but the API MUST NOT contain LENRI-specific semantics.

This API is a Publication/Experience projection. Consumers render it; consumers do not re-run biodiversity classification, privacy decisions, rights checks, sensitive-location masking, or AI truth decisions.

## Design principles

1. ZUKAN owns eligibility, rights, privacy, masking, classification provenance, and public projection.
2. External consumers receive only publishable fields.
3. Place/Entity/Publication are the stable axes; `observation_field` is an implementation source, not the external identity contract.
4. AI output is always labeled as a candidate and never silently promoted to verified truth.
5. Feed configuration is reusable across areas, facilities, municipalities, schools, campaigns, and partner sites.
6. API v1 is additive and read-only. No external write authority is introduced.
7. Exact sensitive coordinates, private records, face-blocked media, and non-republishable assets must never enter the public response.

## Resource model

### Publication Feed

A feed is a named public projection owned by ZUKAN.

- `feed_id`: immutable internal id
- `feed_key`: stable public slug, e.g. `miyakoda-renri-area`
- `scope`: one or more Place/Entity references
- `channels`: configured output channels
- `publication_policy_version`: policy used for selection
- `status`: `draft | active | archived`
- `updated_at`

A feed may aggregate records from one field, multiple fields, a facility, municipality boundary, event, school, or other Place/Entity scope without changing the consumer contract.

## Endpoint

`GET /api/v1/publication-feeds/:feedKey`

Optional query parameters:

- `channel=living|community_photo|...`
- `limit=1..24` (default 12; server cap 24)
- `cursor=<opaque>`
- `locale=ja|en` (default feed locale)

Unknown query parameters are ignored only when harmless; malformed supported parameters return `400`.

## Response

```json
{
  "api_version": "1",
  "feed": {
    "feed_key": "miyakoda-renri-area",
    "title": "この場所で見つけたもの",
    "scope_label": "浜松・都田",
    "updated_at": "2026-08-28T00:00:00Z",
    "publication_policy_version": "public-feed-v1"
  },
  "channels": [
    {
      "key": "living",
      "label": "この場所の生きもの",
      "items": []
    },
    {
      "key": "community_photo",
      "label": "みんなのフォト",
      "items": []
    }
  ],
  "next_cursor": null
}
```

## Item contract

Every item has the same envelope so consumers do not need domain-specific joins.

```json
{
  "id": "pubitem_...",
  "record_id": "...",
  "channel": "living",
  "media": {
    "url": "https://...",
    "alt": "ナミアゲハ",
    "width": null,
    "height": null
  },
  "title": "ナミアゲハ",
  "subtitle": null,
  "observed_at": "2026-08-28",
  "place_label": "浜松・都田",
  "detail_url": "https://zukan.earth/...",
  "subject": {
    "kind": "taxon",
    "label": "ナミアゲハ"
  },
  "classification": {
    "state": "verified",
    "source": "human_review",
    "confidence": null
  },
  "rights": {
    "republication_allowed": true,
    "attribution": null
  }
}
```

Public response MUST NOT include uploader email/user id, raw EXIF GPS, exact coordinates, private notes, reviewer-only fields, internal risk reasons, storage credentials, or unpublished source payload.

## Default channels

### `living`

Purpose: biological records with a defensible subject candidate.

Eligibility order:

1. reviewed/verified taxon claim -> include as `classification.state=verified`;
2. accepted non-final identification -> include with its explicit review state;
3. latest AI `recommended_taxon_name` -> include only when the public publication policy permits AI candidates and label `classification.state=candidate`, `source=ai`;
4. no biological subject -> do not place in `living`.

An AI candidate MUST NOT be rendered as verified. Consumers must be able to distinguish it from verified identification without interpreting free text.

### `community_photo`

Purpose: place/environment/community photography, including non-biological visual records.

Initial eligibility may reuse observation evidence assets whose role indicates environmental context, including `habitat_wide`, `substrate`, or `scale_reference`, provided the asset is independently publishable.

As generic non-biological Record publication becomes runtime-active, those Records may enter this channel without changing the API contract.

A photo can appear in only one default channel per feed response unless a feed explicitly opts into multi-channel publication.

## Extensible channels

The external contract MUST allow feed configuration to add channels without endpoint changes, for example:

- `living`
- `community_photo`
- `seasonal`
- `history`
- `activity`
- `facility`
- `event`
- `staff_pick`

Consumers should render known channels and safely ignore unknown channels.

## Selection and ranking

Default ranking for a public feed:

1. publication eligibility and rights
2. privacy/sensitive-location safety
3. channel fit
4. recency
5. media quality/availability
6. diversity (avoid repeated subject/record/author dominance where feasible)
7. deterministic tie-breaker by stable id

The exact scoring algorithm is internal and versioned by `publication_policy_version`.

## Scope resolution

A feed config resolves to stable Place/Entity identities. Existing `observation_field` / area snapshot machinery may be used internally as a source adapter.

Examples:

- area site: one Place + related fields
- facility: one Entity + containing Place
- municipality: municipality Place + child Places/approved programs
- school: school Entity + campus Place
- campaign: explicit Publication selection across scopes

External consumers never pass arbitrary coordinates to widen a feed. Scope is server-owned configuration.

## Safety and privacy gates

Before an item can enter a public feed, all must pass:

- public visibility
- media asset validity
- face/privacy policy
- sensitive-species/location masking policy
- republication rights for the target publication class
- no restricted/private source payload exposure
- no exact-coordinate leakage via response fields or image metadata handled by the publication pipeline

Failure of any gate excludes the item; the API does not expose exclusion reasons publicly.

## Rights

`publicly viewable` and `republishable on partner/external sites` are different rights.

The feed projection MUST require an explicit republication-allowed state or a policy-derived equivalent that is auditable. Existing public observations without sufficient republication rights remain excluded until rights are resolved.

This is a hard boundary because the API is designed for third-party reuse.

## Caching and delivery

Recommended HTTP behavior:

- `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- `ETag` based on deterministic projection digest
- conditional `If-None-Match` -> `304`
- JSON UTF-8
- CORS allowlist per active feed consumer domain, with an optional explicitly-approved wildcard mode only for feeds intended for open syndication

Consumers should keep the last successful payload for transient failures when practical. API failure must not break the host page layout.

## Versioning

- URL major version remains `/api/v1/...`.
- Additive fields/channels are allowed within v1.
- Removing or changing field meaning requires a new major contract.
- Each response includes `api_version` and `publication_policy_version`.
- Feed keys remain stable across internal database/schema migrations.

## Observability

Server metrics should distinguish at least:

- requests by feed key and consumer origin
- 2xx / 304 / 4xx / 5xx
- projection latency
- cache hit/miss where available
- item counts per channel
- exclusion counts by internal safety/right gate (not exposed publicly)
- last successful projection timestamp

No personal identifier is required for ordinary public feed analytics.

## Abuse controls

- bounded `limit`
- cursor pagination
- rate limiting by feed/origin/IP according to platform policy
- no arbitrary SQL-like filtering
- no arbitrary radius/coordinate expansion
- no hidden/private record selectors

## Consumer integration contract

External sites should:

1. fetch one configured feed key;
2. render returned channels/items;
3. show candidate state when `classification.state=candidate`;
4. link back to `detail_url` when provided;
5. not infer private coordinates or reclassify records;
6. degrade to a static/empty-state block if the feed is unavailable.

The first LENRI consumer should use exactly this public contract and must not receive a private shortcut endpoint.

## Initial implementation slice

1. Introduce feed configuration and projection types/service in `platform_v2`.
2. Add `GET /api/v1/publication-feeds/:feedKey`.
3. Implement one configured feed for the Miyakoda/RENRI area using existing area/observation data as an adapter.
4. Produce `living` and `community_photo` channels.
5. Reuse existing public observation quality, media, face/privacy, and sensitive masking controls; add an explicit republication-right gate before external syndication.
6. Add contract tests for privacy leakage, AI candidate labeling, deterministic ordering, limits/cursors, unknown channels, and empty feeds.
7. Keep all writes, production activation, DNS, credentials, and external customer communication out of this PR unless separately authorized.

## Acceptance criteria

- Same API can represent RENRI, another facility, a school, or a municipality without schema/route changes.
- Consumer does not need to understand `occurrences`, `observation_fields`, AI assessment tables, or privacy internals.
- AI candidates are machine-distinguishable from verified identifications.
- Sensitive/private/non-republishable assets cannot appear in a public response in tests.
- Scope cannot be widened through consumer query parameters.
- Response ordering is deterministic for the same source state and policy version.
- One failing or empty channel does not invalidate other safe channels.
- No production/runtime mutation is required to merge the source-only contract.
