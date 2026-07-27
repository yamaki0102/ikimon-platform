# ZUKAN 実装実施計画

- 作成日: 2026-07-28
- 状態: `SOURCE_PLAN / STAGING_NOT_AUTHORIZED / PRODUCTION_NOT_AUTHORIZED`
- strategy main: `yamaki0102/ikimon-business-strategy@f21a67cabdf91f7007a9c66d1c44b708e478f34c`
- strategy candidate: `ikimon-business-strategy#28`
- implementation baseline: `yamaki0102/ikimon-platform@3c6f3556c5319821601e6f62b971e8b041e1a31c`
- operations candidate: `all-projects-management#852`
- P0仕様: `SPEC.md`
- 関連Issue: #1469

## 1. 実装判断

ZUKANは、current `ikimon.life` appをゼロから作り直す計画ではない。既存のRecord、camera、AI、public safety、Place Atlas、Home、Selfを再利用し、個人P0のruntime evidenceを先に確定する。

ブランド、Place Graph、組織無料コア、有償商品を同時にUI実装しない。依存順を守る。

## 2. work package

### WP0 正本・ブランド境界

目的:

- IKIMON株式会社、ZUKAN、`zukan.earth`、`ikimon.life`、`ikimon.co.jp`を分離する。
- UTSUROU service planをsupersedeする。
- P0、demo、Issue Map、runtime QAをlatest mainへ同期する。

完了条件:

- strategy #28の採否を追跡できる。
- public serviceはZUKAN、current technical identityは`ikimon.life`と明記される。
- `この場所のうつろい`をfeature nameとして維持できる。
- brand変更でinternal IDを改名しない。

### WP1 個人P0 runtime gate

目的:

latest mainのexact SHAで、次を一周確認する。

`撮る → 保存 → owner → AI候補 → edit → public safety → Place → revisit`

実施:

1. Draft PR #1459を直接releaseせず、latest mainからfresh branchを作る。
2. #1459の有効なruntime identity、materialization、Place Atlas、retry fixtureだけを移植する。
3. targeted/full testsを実行する。
4. exact-SHA dry-run、staging deploy、runtime identityを確認する。
5. fresh test Recordを作る。
6. owner、AI state、edit、retry、Place、public projectionをreadbackする。
7. Android、iPhone、desktopでQAする。
8. test data cleanupは対象を限定し、DB/R2削除は別承認にする。

完了条件:

- `SPEC.md`のREADY条件を満たす。
- `/learn`、`/ja/contact`を解消またはcontractから安全に外す。
- rollback locatorとevidenceがある。

### WP2 current surface監査

目的:

後続contractを既存sourceへ接続し、重複実装を避ける。

検索対象:

- Record / Observation / Occurrence
- Place / observation_fields / Place Atlas ref
- group、event、route、guide、rally
- moderation、consent、rights、export
- species list、taxon aggregate、CSV、report
- campaign、coupon、promotion

成果:

- current type・table・route・service map
- reuse / adapter / missing / legacy分類
- source-only fixture plan
- migration不要の最初のslice

### WP3 Place Graph source-only

目的:

世界対応identity contractをpure domain codeとtestsへ落とす。

最小対象:

- `PlaceIdentity`
- `PlaceAssertion`
- `PlaceRelation`
- `PlaceViewDefinition`
- name、geometry、external identifier assertions
- valid time / recorded time

fixtures:

- 改称
- 境界変更
- 新設合併
- 編入・法的継続
- 分割
- 同名・近接の別Place
- 行政区域と文化圏の重複
- 多言語・複数script・旧称
- 複数の境界・所属主張
- 住所のない自然Place
- 移築建造物と敷地
- View間のRecord非複製
- private Geometry非公開
- external ID変更

このWPでDB、migration、URL、UI、productionを変更しない。

### WP4 Program無料組織コア source-only

最小対象:

- `Program`
- `Participant`
- `Team`
- `Quest`
- `Consent`
- `Review`
- `Handover`
- `OperationalSummary`
- `ViewPublicationCandidate`

fixtures:

- 学校の保護者同意撤回
- 自治体職員Review
- 企業private→一部public
- 年度・担当者引継ぎ
- payment状態に依存しないaccess
- taxon countを含まない無料summary

このWPでbilling、payment、DB、UIを変更しない。

### WP5 有償派生物 source-only

目的:

無料原記録と有償成果物を構造的に分離する。

最小対象:

- `RawRecordPortabilityArchive`
- `TaxonInventory`
- `ProfessionalReport`
- `PromotionalPublication`
- `CouponCampaign`
- commercial / reporting rights
- sponsor / advertisement disclosure

fixtures:

- raw archiveがspecies listを出力しない
- operational summaryへtaxon countを混入させない
- TaxonInventoryのscreen/download/APIが同じpaid boundary
- owner raw exportはpayment不要
- promotional outputはcommercial-use rights必須
- couponがknowledge ranking・Reviewを変更しない

このWPでpayment、settlement、productionを変更しない。

### WP6 磐田公開データadapter

対象:

- 文化財
- 観光施設
- 公共施設
- 公園
- 交流センター
- 磐田市の声・既存資料inventory

実施:

- source取得・license・取得時点を記録
- source record keyとPlace candidateを分離
- name、alias、location、time、missing、conflictを正規化
- same-placeを自動確定しない
- 市全域のthin View fixtureを生成
- 文化財・見付をdeep sliceにする
- current Observationを重複なしで接続する

最初はfixture・dry-run・local read modelまで。DB apply、staging、productionは別判断。

### WP7 correction / writeback

flow:

`Missing/Conflict → Quest → Record/Evidence → Review → CorrectionProposal → WritebackReceipt → Publication`

必要条件:

- source owner、reviewer、正式受付経路
- accepted / held / rejected / reflected
- Evidenceと理由
- public-ready再出力
- participantへ結果を返す
- AIが公式化しない

### WP8 brand・presentation・domain

P0とdata loopが成立した後に行う。

- ZUKAN source preview
- current `ikimon.life`内の表示変更
- official site content rebuild
- 3分demo・A4・pitch・相手別proposal
- `zukan.earth`read-only inventory
- domain migration plan

`zukan.earth`gate:

- owner・registrar・更新・権限
- DNS・certificate
- auth callback・cookie・CORS
- canonical・redirect・search
- analytics・runtime identity
- rollback

domain、DNS、production変更は明示承認後の別job。

## 3. 優先順位

```text
WP0
→ WP1
→ WP2
→ WP3 / WP4 / WP5（source-onlyで並行可能）
→ WP6
→ WP7
→ WP8
```

個人P0より先にbrand UI、Program UI、billing、coupon UIを作らない。

## 4. Issue・PR処理

- #1459: closeまたはsupersede候補。latest mainからfresh runtime QA PRを作る。
- #1296: parent problemとして維持。P0 E2E証拠で完了判定する。
- #1365: route解消証拠までblocker。
- #1421〜#1426: source実装済み部分をIssueへ還流し、current runtime QAを追加する。
- #1460: Place Graph contractからWP3へ。
- #1462: free organization contractからWP4へ。
- #1466: paid boundary contractからWP5へ。
- #1469: WP0文書同期。

## 5. 検証

各source PR:

- latest mainからfresh branch
- `AGENTS.md`と該当contractを読む
- changed scopeを限定
- targeted tests
- full typecheck/build/tests
- diff/secret/security checks
- no DB/production mutation
- evidence pathと未確認をPRへ記録

runtime PR:

- exact-SHA
- fresh staging
- source/runtime/materialization identity
- fresh Record write/read E2E
- Android/iPhone/desktop
- rollback locator

## 6. 完了判定

本計画全体の最初のmilestoneは`READY_P0`である。ZUKAN logoやdomainではない。

`READY_P0`後、WP3〜WP7を通じて、磐田市で一件の正本還流と次年度Program引継ぎを目指す。

## 7. 承認境界

本計画で自動承認しない。

- merge
- staging / production deploy
- DB / migration
- secret / DNS / permission
- billing / payment / settlement
- customer / municipality send
- formal announcement
- deletion / cleanup
