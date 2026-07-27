# Latest main addendum: 磐田View・Source Registry・Publication Pipeline

- 観測日: 2026-07-28
- latest implementation main: `19e4aa032ca902fb1ffa24d0560562f76f25d501`
- relevant merges:
  - #1468 / `c8ff06e177c6fa43b728fbf6ed9d7674f8abebe3`
  - Source Registry / Publication implementation contract / `19e4aa032ca902fb1ffa24d0560562f76f25d501`
- strategy latest main: `c26f39ed953bf5984d2c776bcc3a5ebc63f28d3f`
- 本文書PR: #1470
- 状態: `IWATA_VIEW_SOURCE_IMPLEMENTED / SOURCE_REGISTRY_CONTRACT_RECORDED / RUNTIME_NOT_VERIFIED`

## 1. 磐田市公開データView source

mainへ、磐田市の実公開オープンデータを読取専用の地域Viewとして表示するsourceが追加された。

- route: `/iwata`
- API: `/api/iwata/open-data`
- 59件
- 地図
- 全文検索
- 4カテゴリfilter
- 位置欠損・data接続候補の可視化
- 原典、取得日、原典更新日、利用条件
- source-only snapshotとtests

対象dataset:

- 観光施設
- 都市公園
- 交流センター
- 文化財

主なsource:

- `platform_v2/src/routes/iwataOpenData.ts`
- `platform_v2/src/services/iwataOpenDataSnapshot.ts`
- `platform_v2/src/services/iwataOpenDataSnapshot.test.ts`
- `platform_v2/e2e/iwata-open-data.staging.spec.ts`

## 2. Source Registry / Publication契約

latest mainへ、次のadopted implementation contractが追加された。

- `docs/spec/zukan_regional_source_registry_and_publication_pipeline_2026-07-28.md`

ZUKANを、磐田市専用viewerではなくsource-neutralな地域知識databaseとして扱う。

正規object:

- `Publisher`
- `SourceAsset`
- `SourceEdition`
- `SourceRecord`
- `Place / Entity / Claim`
- `Publication / PublicationEdition`

紙、PDF、Web、map layer、event page、report等は別databaseではなく、ZUKANから選定・編集されるPublicationである。

外部Publisherの公式正本をZUKANが置き換えない。source recordをcanonical Placeへ自動昇格させず、人のReviewまたはsource owner approvalを介する。

rights class:

- `OPEN_REUSE`
- `ATTRIBUTION_REUSE`
- `FACTS_ONLY`
- `INDEX_ONLY`
- `CONTRIBUTED_PRIVATE`
- `RESTRICTED`
- `UNKNOWN`

解析許可と再出版許可を分離する。

adapterは自治体ごとではなくformat / platformごとに作る。

- Japanese municipal standard open data
- CKAN
- LinkData / RDF
- ArcGIS REST / FeatureServer
- Socrata
- CSV / Excel / Google Sheets
- GeoJSON / KML
- HTML
- PDF
- publisher template

## 3. 現在の実装境界

実装済み:

- `/iwata`read-only View source
- Iwata snapshot・route・tests
- Source Registry / Publicationのdocs contract

未実装・未確認:

- `GET /api/regional-sources`
- `GET /api/regional-sources/:sourceAssetId`
- Publisher / SourceAsset runtime registry
- acquisition / preservation / extraction
- Place candidate link・human Review
- Publication manifest generation
- MIYAKODA listing extraction・公開
- staging deploy・verify・Visual QA
- production deploy・verify
- DB / migration
- 市公式dataへのwriteback
- canonical PlaceIdentityへの確定統合
- existing Observationとのmembership確定
- correction / WritebackReceipt
- 見付deep slice
- 市側責任者・正本担当・正式更新経路

名称・座標だけでsame-placeを自動確定しない。公開PDFの存在を、全文・画像の再掲載許可とみなさない。

## 4. 実施計画への反映

`ZUKAN_EXECUTION_PLAN.md`は、WP2〜WP8を次の依存で読む。

```text
individual P0 runtime gate
→ current source surface audit
→ Source Registry contract + read-only registry
→ SourceRecord adapter
→ Place / Entity / Claim candidate link
→ rights-safe View
→ Publication Builder
→ correction / writeback
→ brand / domain
```

Iwata work:

```text
Phase 1: public snapshot View source implemented
Phase 2: current main runtime QA pending
Phase 3: Publisher / Source Registry registration pending
Phase 4: PlaceIdentity candidate adapter pending
Phase 5: existing Record / Observation connection pending
Phase 6: deep culture / Mitsuke slice pending
Phase 7: correction / writeback pending
Phase 8: Publication generation pending
```

WP6をゼロから再実装しない。`iwataOpenDataSnapshot`と`/iwata`を再利用する。

MIYAKODA等の紙mapは、Publication Builderから始めない。Publisher、SourceEdition、rights、SourceRecord、Place candidate Reviewを先にする。

## 5. P0への影響

個人P0のREADY判定は変わらない。

- `/iwata`やSource Registry contractが存在しても、capture、owner、AI、edit、public safety、Place membershipのfresh E2Eがなければ`NOT_READY_P0`。
- P0 runtime QAはlatest main `19e4aa032...`以降から再構築する。
- Draft PR #1459の古いbaseをそのまま使わない。
- Publication Builder、TaxonInventory、coupon等を個人P0の依存にしない。

## 6. PR #1470のbase

PR #1470 branchは`3c6f355...`から作成された。以後mainに追加された変更は、Iwata sourceとSource Registry / Publication docs contractであり、本PRのP0 docs pathとの直接競合はない。

merge前にlatest main追従を確認し、次を失わない。

- `/iwata`source
- Source Registry / Publication contract
- Place Graph・free organizational core・paid output contracts

PR本文・台帳・後続runtime Issueではcurrent implementation mainを`19e4aa032...`として扱う。
