# Latest main addendum: ZUKAN戦略・磐田View・Source Registry

- 観測日: 2026-07-30
- strategy main: `03285f66b706cc07a9efd5cfae2b1eb8e4420874`
- implementation main: `10c1c89c296430baa0b39b818cc71af956dc3696`
- 本文書の採用元: #1470
- 個人P0部分runtime gate: #1473
- Source Registry拡張: #1474
- Foundation現行経路: #1478、#1482、#1484、#1485
- brand / Home current source: #1488
- 状態: `STRATEGY_ADOPTED / IWATA_VIEW_SOURCE_IMPLEMENTED / SOURCE_REGISTRY_SOURCE_IMPLEMENTED / RUNTIME_NOT_VERIFIED`

## 1. 戦略採用

IKIMON株式会社とZUKANの事業・サービス定義はstrategy PR #32でmainへ採用済み。

- 公開サービス: ZUKAN
- future domain: `zukan.earth`
- current URL・runtime・technical identity: `ikimon.life`
- UTSUROU: service nameとしてsuperseded
- `この場所のうつろい`: feature nameとして維持可能
- ZUKAN: Publisher、SourceEdition、Rights、Place、Time、Evidence、Review付きのsource-neutralな地域知識database
- paper、PDF、Web、map、event page、guide、report: Publication
- eligible biodiversity Record: rights・consent・quality・safety確認後にGBIFへ接続可能

## 2. 磐田View source

実装済み:

- `/iwata`
- `/api/iwata/open-data`
- 59 records
- 観光施設、都市公園、交流センター、文化財
- map、全文search、4 category filter
- missing location・data connection candidate
- source、retrieved date、source updated date、terms

未確認:

- staging / production runtime
- PlaceIdentity確定接続
- existing Record / Observation membership
- Review / correction / writeback

## 3. Source Registry source

implementation main `10c1c89c...`で参照する現行経路:

- `platform_v2/src/services/regionalSourceRegistry.ts`
- `platform_v2/src/services/regionalSourceRegistry.test.ts`
- `platform_v2/src/routes/regionalSources.ts`
- `platform_v2/src/services/zukanFoundationV2SourceRegistryImport.ts`
- `platform_v2/src/scripts/planZukanFoundationV2SourceRegistryImport.ts`
- site map route registration

実装済みの契約:

- Publisher
- SourceAsset
- SourceEdition
- SourceRecord envelope
- rights class
- acquisition state
- read-only registry service
- read API route
- Iwata open-data sourceとの接続
- municipal / non-municipal source共存
- PDF等のrights fail-closed

状態は`SOURCE_IMPLEMENTED`。本監査ではfull test、staging、productionのterminal evidenceを確認していないため`RUNTIME_VERIFIED`とはしない。

## 4. P0との依存分離

個人P0:

`撮る → 保存 → owner → AI候補 → edit → public safety → Place → revisit`

Source Registry:

`Publisher → SourceAsset → SourceEdition → SourceRecord → candidate link → human Review → rights-safe View`

Publication:

`rights-safe View → selected Claim / SourceEdition → editorial decision → PublicationEdition → manifest`

Source Registry sourceが存在しても、個人P0のfresh runtime E2Eがなければ`NOT_READY_P0`。Publication Builder、Program、TaxonInventory、couponを個人P0の依存にしない。

## 5. 後続順

1. 本P0 docsをmainへ採用
2. #1473をlatest mainから部分runtime gateとして再構築
3. exact-SHA stagingでRecord E2EとSource Registry readback
4. #1474の有効差分を現行Foundation import / apply経路へ再構築
5. SourceRecord adapterとPlace / Entity / Claim candidate link
6. Program無料コア
7. rights-safe Review / View
8. TaxonInventory等の専門派生
9. Publication Builder
10. correction / external writeback
11. brand / domain release

## 6. READY境界

個人P0 READYには次を要求する。

- latest exact-SHA staging identity
- fresh Record作成
- owner / another-user deny
- AI state / retry / safe error
- edit
- private / limited / public precision
- Place membership・public profile一回反映
- Home / Records / detail / Place整合
- Android / iPhone / desktop QA
- `/learn`・`/ja/contact`のblocker解消または安全なcontract変更
- evidenceとrollback locator

Source Registry READYは別判定とし、read API、rights fail-closed、source identity、Iwata source link、staging readbackを要求する。
