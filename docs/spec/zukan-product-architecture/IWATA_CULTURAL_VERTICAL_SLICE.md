# ZUKAN 磐田文化財 Vertical Slice

- Status: implementation slice
- Parent contract: `SPEC.md`
- Parent plan: `PLAN.md`
- Dependency: PR #1489 exact SHA `a7cbdb51d5390c28b61e9e7caa17ec8793e952a4`
- Runtime / DB / deployment changes: none

## 目的

既存の磐田市文化財オープンデータ1件を使い、非生物の地域情報を次の境界で最後まで通せることをsource-onlyで証明する。

```text
SourceAsset / SourceEdition
  → SourceRecord由来の不変Record
  → 訂正可能なClaim候補
  → Iwata Placeと文化財Entity
  → 人間Review
  → 同じRecord・Claim選択から地域ViewとCSVの2出力
```

## 最初の対象

- SourceAsset: `source:iwata:cultural-properties-linkdata`
- Dataset: 磐田市 文化財一覧
- SourceRecord: `BB00000003`
- 表示名: `旧見付学校附磐田文庫`
- 既存接続候補: `iwata:tourism:9`

このRecordは実公開データ由来だが、本sliceのReview、RightsBasis、Publication ownerはfixtureであり、公開・公式確認済みとは扱わない。

## 実装境界

`zukanIwataCulturalVerticalSlice.ts`は以下だけを行う。

- Source Registryから対象SourceAssetを解決する
- 既存Foundation Source import contractでopaque SourceEdition IDを導出する
- Iwata Placeと文化財Entityのopaque subject IDを導出する
- Source値をRecord payloadとして固定する
- name / summary / address / source_updated_atを個別Claim候補にする
- Review前はworkspace候補のまま保持する
- 明示ReviewとRightsBasisがある場合だけPublication候補を作る
- 同じ選定からregional Viewとreview CSVのmanifest候補を作る
- `samePlaceCandidate`をidentity candidateとして残し、自動mergeしない
- Sourceに座標がない場合、観光施設側の座標を推測転記しない

## Foundation v2との対応

現在のFoundation v2で利用できるもの:

- `zukan_subject_identities`
- `zukan_source_works`
- `zukan_source_editions`
- `zukan_value_artifacts`
- `zukan_claims`
- `zukan_claim_revisions`
- `zukan_projection_snapshots`
- `zukan_publication_editions`

writerを作る前に不足している契約:

1. first-class generic Record
2. RecordとSourceEdition / Evidenceを結ぶappend-only link
3. 磐田文化財field用Predicate Registry entry
4. 実体化したRightsBasis
5. shadow tenant限定writer allowlist

RecordをSourceObjectやClaimへ偽装して不足を回避しない。次段は上記不足を最小追加する設計レビューであり、現行OccurrenceやTaxonを流用しない。

## Review gate

Reviewなし:

- RecordとClaim候補は生成する
- Publicationは生成しない
- `human_review_pending`
- `rights_basis_materialization_pending`

Reviewあり:

- reviewer、reviewed_at、approved fields、RightsBasis、Publication ownerが必須
- approved Claimだけを`public_candidate`にする
- 2つのshadow Publication manifestを生成する
- runtime公開、DB書込み、外部正本writebackは行わない

## 安全・権利

- オープンデータのライセンス表示を保持する
- Sourceの文章、画像、レイアウトを権利範囲を超えて再掲載しない
- 位置欠損を名称一致や別datasetの座標で自動補完しない
- ZUKANを公式正本と表現しない
- identity linkは人間確認までcandidate

## 完了条件

- 実SourceRecordからdeterministic planが生成される
- RecordとClaimが別IDである
- Review前はPublication 0件
- Review後は同じRecord・Claim選択から2出力
- 位置欠損が維持される
- same-place候補が自動mergeされない
- Foundation writer / runtime readerがfalseのまま
- typecheckとnode testsがPASS
