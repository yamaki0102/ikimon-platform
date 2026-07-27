# Latest main addendum: ZUKAN戦略・磐田View・Source Registry

- 観測日: 2026-07-28
- strategy main: `09fe199fbc4e42320d6595b9de9c2d1c9b3d98dd`
- implementation main: `a91861aa6f21cc206fd1cae387b06b75e68f2559`
- 本文書PR: #1470
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

main `a91861aa...`までに追加済み:

- `platform_v2/src/services/regionalSourceRegistry.ts`
- `platform_v2/src/services/regionalSourceRegistry.test.ts`
- `platform_v2/src/routes/regionalSources.ts`
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
2. latest mainからfresh個人P0 runtime gateを実装
3. exact-SHA stagingでRecord E2EとSource Registry readback
4. SourceRecord adapterとPlace / Entity / Claim candidate link
5. Program無料コア
6. rights-safe Review / View
7. TaxonInventory等の専門派生
8. Publication Builder
9. correction / external writeback
10. brand / domain release

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
