# ZUKAN Generic Record persistence rollout

- Date: 2026-07-29
- Status: source implemented / remote migration not authorized
- Parent product contract: `docs/spec/zukan-product-architecture/SPEC.md`
- Parent implementation plan: `docs/spec/zukan-product-architecture/PLAN.md`
- Base main observed: `a29c79051960bc80ac98f1bc822f9d49673d6033`

## 1. Purpose

Foundation v2のSource、Identity、Claim、Rights、Resolution、Publicationを維持したまま、非生物を含む不変Recordを第一級で保存できる最小構造を追加する。

このrolloutはObservation、Occurrence、Taxonを汎用Recordへ改名・移行しない。既存runtime writer/read path、公開API、D1 projection、PostgreSQL canonical readerを切り替えない。

## 2. Additive migrations

PostgreSQL:

- `0140_zukan_foundation_v2_records.sql`

D1 CORE_DB:

- `0015_zukan_foundation_v2_records.sql`

追加するもの:

- immutable `zukan_records`
- monotonic Record sequence
- Record payloadを参照する独立ValueArtifact
- append-only Record-to-Subject link
- append-only Record-to-SourceEdition link
- append-only ClaimRevision-to-Record link
- tenant/workspace scope guard
- mutation rejection trigger

追加しないもの:

- runtime callsite
- public reader
- Record status/suppression projection
- Publication shortcut
- existing biodiversity backfill
- automatic Place/Entity merge
- Action/Case writer

## 3. Semantic boundary

Recordは「何が提出、取得、観察、実行されたか」を保持する。

Claimは「そのRecordを根拠に対象について何を主張するか」を保持する。

Record payloadとClaim valueは別ValueArtifactとする。Claim訂正やReviewで元Recordを更新しない。

SourceEditionはRecordへ参照接続し、Source本文、画像、紙面をRecord payloadへ複製しない。Source内位置は`source_selector`へ保持する。

## 4. Predicate boundary

初期の地域共通Predicateは次の4件に限定する。

- `https://zukan.earth/predicate/name@1`
- `https://zukan.earth/predicate/address@1`
- `https://zukan.earth/predicate/summary@1`
- `https://zukan.earth/predicate/source-updated-at@1`

migrationはPredicate rowを自動seedしない。source contractとdry-run planで必要定義を出し、実DB登録はwriter rehearsalの同一change setで明示する。

未知のURI/versionはfail closedとする。

## 5. D1 parity boundary

PostgreSQLの`restricted` Claim visibilityに対し、既存D1 Claim schemaは`internal`を持つ。意味を暗黙変換しない。

当面のdry-run mapperは`restricted` ClaimをD1非対応としてblockする。共通visibility契約を別途修正するか、PostgreSQL単一writerを採用するDecisionが出るまで書き込まない。

この差異を理由にRecord schemaそのものを止めないが、dual-writeは許可しない。

## 6. Validation

Source verification:

```bash
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
npm --prefix platform_v2/cloudflare_shadow run check
```

Required evidence:

- PostgreSQL migrationに既存row rewrite、DROP TABLE、DROP COLUMNがない
- D1 0009〜0015がfresh scratch DBへ適用できる
- pinned Wrangler/workerdが0015をledger tailとして確認する
- Record graphをscratch D1へ挿入できる
- Record UPDATE/DELETEが拒否される
- cross-tenant Subject、SourceEdition、ClaimRevision linkが拒否される
- dry-run mapperがorder-invariantである
- Record payload artifactとClaim value artifactsが別である
- public candidateはReviewとRights dependencyなしに進まない

## 7. Activation order

1. source-only migrations、mapper、testsをreviewする
2. exact PR-head dry-runを通す
3. merge後、clean merged SHAでmigration source evidenceを再採取する
4. PostgreSQL/D1の実適用は別承認にする
5. 適用後もwriter/read modeはoffのままにする
6. shadow tenant writerはPostgreSQL scratchから開始する
7. Record status/suppressionとread projectionが完成するまでpublic readerを作らない
8. Iwata文化財1件を再構成し、Review前0 Publication、Review後2 outputを確認する

## 8. Rollback

merge前はbranch/PRを閉じる。

DB適用前はsource revertで戻す。

DB適用後はwriter/read pathを無効のまま維持し、tableと監査構造を保持する。実データが入った後にRecord tableをdropするreverse migrationは作らない。

## 9. Stop conditions

次のいずれかでwriter実装を停止する。

- RecordをSourceObjectまたはClaimとして偽装する必要が出る
- existing Occurrence/Taxon renameが必要になる
- tenant/workspace scopeをDBで検証できない
- Record payloadとClaim valueを分離できない
- rights dependencyを具体IDへ解決できない
- PostgreSQL/D1 visibility差異を暗黙変換しようとする
- suppression/withdrawalを反映しないpublic readerが先に作られる
