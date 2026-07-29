# ZUKAN 磐田文化財 Vertical Slice v3

- Status: stacked source implementation
- Parent: PR #1499 exact SHA `12c91f2871be457c9950cdb145d85abff413c5bd`
- Runtime / remote DB / publication changes: none

## 目的

磐田市文化財オープンデータ1件を、最新のgeneric Record persistence契約へ接続し、SourceEditionのprovenanceと地域EntityのClaimを混同せず、同じRecord・Claim選定から複数成果物を生成できることをshadow-onlyで確認する。

対象:

- SourceAsset: `source:iwata:cultural-properties-linkdata`
- SourceRecord: `BB00000003`
- source value: `旧見付学校附磐田文庫`
- identity candidate: `iwata:tourism:9`

## 経路

```text
SourceAsset / SourceEdition
  → immutable source Record
  → name / address / summary Claim candidates
  → generic Record persistence dry-run
  → human Review + Rights dependency
  → regional View candidate + review CSV candidate
```

## ProvenanceとClaimの分離

Sourceの取得日・発行日・更新日は、SourceEditionまたはRecord provenanceである。

これらを文化財EntityのClaimとして登録しない。

Record payloadには次を保持できる。

- `sourceUpdatedAt`
- `retrievedAt`
- source locator
- source row values

Entity Claimは初期段階では次だけとする。

- name
- address（Sourceに存在する場合のみ）
- summary（Sourceに存在する場合のみ）

## Review前

- RecordとClaim候補を生成する
- visibilityはworkspace
- Publicationは0件
- `human_review_pending`
- `rights_basis_materialization_pending`
- writerはfalse

## Review後

明示的に次を要求する。

- canonical UUIDのreviewer Subject
- reviewed time
- approved fields
- canonical UUIDのRights dependency
- canonical UUIDのPublication owner

条件を満たす場合のみClaimを`public_candidate`にし、同じRecord／Claim選定から次の2 manifest候補を生成する。

- regional View
- review CSV

PublicationEditionの永続化はResolutionRun／ProjectionSnapshot後であり、本sliceでは行わない。

## Identity・位置境界

- Sourceに住所・座標がなければ欠損のまま保持する
- 観光施設datasetの座標を自動転記しない
- `samePlaceCandidate`は候補であり、自動mergeしない
- Place／Entity canonical IDは名称・住所・座標を埋め込まない

## Persistence境界

親PR #1499のdry-run mapperを使用する。

- Record payloadとClaim valueを別ValueArtifactにする
- payload artifact scope bindingを生成する
- Subject／SourceEdition／Rights／Predicate dependencyを明示する
- `writeEnabled=false`
- unknown Predicate、non-canonical ID、Review／Rights不足をblockする
- runtime readerとpublic publicationを作らない

## 検証

- 実SourceRecord解決
- Source timestampのprovenance保持
- Source timestampをEntity Claimへ格納しない
- Review前Publication 0件
- Review後2 output
- deterministic digest
- missing location保持
- automatic merge 0件
- generic persistence planのRecord 1件
- payload scope 1件
- writer false
- biodiversity model非流用

## 次段

親PR #1499がexact-head greenになった後にのみ、このstackをfresh SHAでdry-runする。親PRのmigration適用やwriter有効化は、このsliceの前提ではない。
