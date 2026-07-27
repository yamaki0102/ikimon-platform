# ZUKAN 個人P0 Issue / PR Map

- 状態: `CURRENT_DEPENDENCY_MAP`
- 基準日: 2026-07-28
- implementation baseline: `3c6f3556c5319821601e6f62b971e8b041e1a31c`
- 親Issue: #1469
- 仕様: `SPEC.md`
- 実施計画: `ZUKAN_EXECUTION_PLAN.md`

## 1. 運用原則

- Issueのopen／closedだけで実装有無を判断しない。
- main、migration、route、service、test、release evidenceを確認する。
- source implemented、staging verified、production verifiedを分ける。
- 過去のstaging evidenceをlatest mainの証拠として再利用しない。
- PR本文の予定と実行済みを分ける。
- brand・domain変更とP0機能を分離する。

## 2. P0中核

| 対象 | 役割 | 現在地 | 次の処理 |
|---|---|---|---|
| #1296 | owner、edit、AI、state、retryの親問題 | 部分source・過去evidenceあり。integrated current runtime未確認 | P0 fresh E2Eで採否を更新 |
| #1365 | `/learn`、`/ja/contact` 404 | historical production blocker | current runtimeで解消確認またはcontractから安全に外す |
| #1442 | capture後detailとAI state | merged source asset | latest stagingで確認 |
| #1443 | Record detail photo-first compression | merged source asset | latest stagingで確認 |
| #1459 | Place Atlas・capture P0 runtime gate | Draft、old base、UTSUROU branch、staging未実施 | latest mainからfresh ZUKAN runtime QA PRへ再構築 |
| #1469 | P0 docs sync | 本PR | docs・dependency・handoffを採用 |

## 3. Place

| 対象 | 役割 | 現在地 | 次の処理 |
|---|---|---|---|
| #1421 | Universal Place Atlas parent | Issue表示よりsourceが進行 | merged PRとcurrent runtime evidenceを還流 |
| #1422 | domain contract / ADR / scorecard | #1427 merged | Place Graph contractとのadapterを明示 |
| #1423 | identity / discovery / hierarchy / search | #1428等のsourceあり | current audit、PlaceIdentity adapter |
| #1424 | membership / themes / privacy | #1429、#1434 merged | P0 fresh Recordでruntime確認 |
| #1425 | facilities / activities / memory / provenance | #1430 merged | public source・rights current確認 |
| #1426 | UI / media / E2E / staging | #1431、#1437 merged | latest runtime QAへ統合 |
| #1460 | Global Place Identity contract | merged docs、source pending | WP3 pure domain・fixtures |

主要merged PR:

- #1427 domain contract
- #1428 canonical registry・discovery候補
- #1429 membership backfill
- #1430 provenance-aware content
- #1431 responsive UI・runtime gates
- #1434 historical Record reuse
- #1437 search→profile handoff

## 4. AI

| 対象 | 役割 | 現在地 | P0/P1 |
|---|---|---|---|
| #1441 | 過去の浅いAI結果の品質backlog | Draft / source candidate | P1 |
| #1296 AI subset | new Record enqueue、state、retry、writeback | 部分実装 | P0 |

P0では新規RecordのAI状態とretryを優先する。過去全Recordの品質向上をP0 blockerにしない。

## 5. 組織・無料コア

| 対象 | 役割 | 現在地 | 次の処理 |
|---|---|---|---|
| #1462 | Program無料組織コアcontract | merged docs、source pending | WP4 current source audit・pure fixtures |

P0個人RecordはProgramに所属しなくても成立する。ProgramはP0 Recordを組織・年度・Questへ束ねる上位slice。

## 6. 無料・有償派生

| 対象 | 役割 | 現在地 | 次の処理 |
|---|---|---|---|
| #1464 | promotional outputs / coupons contract | merged docs | WP5 source contract |
| #1466 | Raw Record portability vs paid TaxonInventory correction | merged docs | current species/export surface audit |

P0で保存・owner・edit・Placeを有料状態へ依存させない。TaxonInventory、species list、aggregate、report outputはP0外。

## 7. 戦略・運用依存

- strategy service definition: `yamaki0102/ikimon-business-strategy#28`
- operations current ledger: `yamaki0102/all-projects-management#852`
- official site content rebuild: strategy adoption後に別Issue
- `zukan.earth`: domain readinessを別計画

## 8. runtime QA再構築

#1459から再利用候補:

- exact source/runtime identity
- materialization contract
- Place Atlas API/UI assertions
- capture P0 fixture
- provider retry fixture
- responsive/browser matrix

再利用しない:

- UTSUROU brand assertions
- old base SHA
- old branchを直接releaseする前提
- source validation未完了の予定記述

fresh PRの順序:

1. latest main
2. minimal cherry-pick/reimplementation
3. targeted tests
4. full tests
5. independent review
6. exact-SHA dry-run
7. staging
8. fresh Record write/read
9. device QA
10. evidence

## 9. 完了更新ルール

Issueへ記録する。

- exact source SHA
- merged SHA
- staging runtime SHA
- production runtime SHA（実施時のみ）
- migration・DB変更の有無
- fresh test Record IDは公開安全な範囲
- owner/edit/AI/retry/Place/public readback
- browser・device
- evidence locator
- cleanup状態
- known limits

## 10. 現時点判定

`NOT_READY_P0`

理由:

- strategy #28 adoption pending
- P0 docs sync pending
- #1459 fresh rebuild pending
- latest main exact-SHA staging pending
- current runtime write E2E pending
- route blockers unresolved evidence absent
