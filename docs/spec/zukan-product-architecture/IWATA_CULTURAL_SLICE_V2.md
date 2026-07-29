# ZUKAN 磐田文化財 Vertical Slice v2

- Status: stacked source implementation
- Parent: PR #1499 exact SHA `65ed29b922b1b76b3aef1b608e724b0329d82b9b`
- Runtime / remote DB / publication changes: none

## 目的

実在する磐田市文化財オープンデータ1件を、最新のgeneric Record persistence契約へ接続し、同じRecord・Claim選定から複数成果物を生成できることをshadow-onlyで確認する。

対象:

- SourceAsset: `source:iwata:cultural-properties-linkdata`
- SourceRecord: `BB00000003`
- source value: `旧見付学校附磐田文庫`
- identity candidate: `iwata:tourism:9`

## 経路

```text
SourceAsset / SourceEdition
  → immutable source Record
  → separate Claim candidates
  → generic Record persistence dry-run
  → human Review + Rights dependency
  → regional View candidate + review CSV candidate
```

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
