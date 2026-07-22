# PR-F photo-first record detail — implementation review packet

## Goal and invariant

通常閲覧を写真・動画・音中心へ戻す。`record → 0..N observations`、observation-media多対多、AI provisional、human accepted identification、community policy、split/merge/exclude/restore/reassign、no-JS、権限・冪等性・位置保護は変更しない。

## Text wireframe

```text
mobile
  back / menu
  record-wide media gallery (deduplicated)
  title / observed time / safe public location / visibility
  basic actions
  one observation summary (only when observations exist, max 3 rows)
    existing AI visual evidence / shooting advice (only when present)
    all details (collapsed)
      accepted name / AI candidates / existing community proposals
      propose-name form (collapsed, policy controlled)
  environment summary (only when present)
  note (only when present)
  detailed edit (owner only, collapsed)
  capture information (collapsed)
  related records (only when present)

desktop
  left: adaptive media stage
  right 360–440px: the same information hierarchy
```

## Data use

- Existing: record photo/video/audio, accepted human claim, AI name and `rationale_json.visualEvidence` / `needsMoreEvidence`, community claims, latest privacy-safe observation environment record, note, observed time, safe public location, visibility, privacy-safe related records. Public photos are selected only from `public_derivative_key` rows with verified derivative metadata, `exif_scrub_state = 'scrubbed'`, and `public_ready_at`.
- Gallery deduplication uses stable `mediaId`, not URL text. A URL containing an exact-place locator is rejected before rendering.
- Summary source rules: accepted human identification wins; otherwise an AI name is shown only under the localized “What AI found” heading and localized “possibly” wording. Community proposals remain in the on-demand detail and are never used as the accepted name.
- For N observations, the summary lists the first three observations and “View all” opens every active observation; no observation row or management state duplicates record media.
- Not present in this read model: seasonality, ecology, similar-species comparison, regional learning context. The UI does not fabricate them.
- `place_environment_snapshots` is not used because this detail has no verified privacy-safe record link contract.

## Implementation locators

- `src/observationFirstRecordDetailHtml.ts`: media-first renderer and no-JS disclosures
- `src/observationFirstRecordDetailI18n.ts`: JA / EN / ES / PT-BR copy
- `src/cloudflareObservationReadModel.ts`: safe parsing of existing AI rationale
- `src/index.ts`: localized route presentation and localized no-JS return path
- `src/observationFirstRecordDetailHtml.test.ts`: 0 / 1 / N, owner/guest, i18n, privacy and media-dedup contracts
- `scripts/render-record-detail-visual-fixtures.mts`: deterministic visual states

## Defensive review questions

1. Does the hierarchy make media primary on mobile and desktop without removing observation-first capabilities?
2. Can AI suggestions, accepted human identification, and community proposals be confused?
3. Do collapsed no-JS controls retain meaningful keyboard and guest/owner paths?
4. Can any exact-place locator re-enter HTML, URL, media URL, or related/environment presentation?
5. Are there missing 0 / 1 / N, public / limited / private, owner / member / guest, pet / unknown / group, or media-type risks?
6. Is any recommendation outside this UI-only PR because it requires schema, new AI processing, migration, or backfill?
