# 基本体験 P0 Issue Map

- 状態: proposed / Draft PR review
- 基準日: 2026-07-26
- 親Issue: #1444
- 仕様: `docs/spec/core-experience-p0/SPEC.md`

## 1. 運用原則

- Issueのopen／closedだけで実装有無を判断しない。
- merged source、current main、staging evidence、production evidenceを別々に記録する。
- 一つのPRでP0全体を実装しない。縦方向の小さなsliceに分ける。
- P0完了は、子Issueのclose数ではなく、同一RecordのE2E受入で判定する。
- production、migration、backfillは別承認・別gateにする。

## 2. 既存Issue・PRの位置づけ

| ID | 主題 | Source | Staging | Production | P0判定 | 次の処理 |
|---|---|---|---|---|---|---|
| #1296 | owner、編集、AI、状態、retry、backfill | 部分実装。#1442/#1443等がmainへmerge | latest mainのterminal evidence未確認 | 一続きE2E未確認 | P0 parent dependency | 本Issueの完了条件をP0仕様へmappingし、残項目だけに更新する |
| #1365 | `/learn`、`/ja/contact` 404 | 原因候補はmaterialization scope | 修復SHA未確認 | 404継続記録 | P0 blocker | source修復→route contract test→staging→production smoke |
| #1421 | Universal Place Atlas parent | 主要stack merge済み | 一部staging evidenceあり | current state未整理 | P0はPlace所属・public projection部分のみ | 子Issueへ実装証拠を還流し、P0残件とP1拡張を分離 |
| #1422 | domain contract / ADR | #1427 merge済み | n/a docs | n/a docs | P0 support complete candidate | acceptance mapping後close判定 |
| #1423 | identity / OSM / hierarchy / search | #1428等merge済み | evidence再整理 | production状態未確認 | Place resolveに必要 | canary実データとcurrent runtimeを確認 |
| #1424 | membership / themes / privacy | #1429、#1434 merge済み | dry-run/apply evidenceあり | production状態未確認 | P0必須 | current Record createとの接続E2Eを追加 |
| #1425 | content / public memory / provenance | #1430 merge済み | evidenceあり | production状態未確認 | P0はpublic projection gateのみ | P1のrich contentと分離 |
| #1426 | UI / media / E2E / staging | #1431、#1437 merge済み |過去evidenceあり | production状態未確認 | P0 Place UIに必要 | current mainの撮影後Recordからprofileまで再検証 |
| #1441 | 過去AI品質backlog | Draft open / main外 | 未確認 | 未反映 | P1原則 | 新規投稿P0を阻害する依存がないかだけ確認し、別laneで進める |
| #1442 | 投稿後詳細・AI状態・Place導線 | merge済み | 最終main単位の完了証拠未確認 | current反映未確定 | P0部分完了 | current SHA E2Eへ組み込む |
| #1443 | 記録詳細圧縮 | merge済み、main `298bfa...` | #786 queued | current反映未確定 | P0 UI部分完了 | terminal staging evidenceとVisual QAを取得 |
| #1444 | P0統合仕様 | 本Draft PR | 未実施 | 未実施 | 管理親 | P0残Issueと受入証拠の入口にする |

## 3. 推奨する実装slice

### Slice A: current state read-only audit

目的:

- 実装を始める前に、current mainとstaging／productionの差を確定する。

作業:

- `main` exact SHAを再確認。
- central registry、`resolveProject`、runtime identity、active command／leaseを確認。
- #786／#792のterminal stateを確認。
- current route smokeで`/learn`、`/ja/contact`を確認。
- P0 APIs、migrations、owner policy、AI request、Place membershipのsource pathを索引化。

完了条件:

- Desired / Observed / Delta / Blocker / Next actionが一枚で確認できる。
- runtime identity不明のままコード変更へ進まない。

### Slice B: support route materialization

対象: #1365

目的:

- `/learn`、`/ja/contact`をcurrent materialization contractへ含める。

作業:

- renderer、materializer、R2 manifest、Worker route lookup、locale aliasを追跡。
- route listを複数箇所で手動重複しないsingle sourceへ寄せる。
- build artifactに両routeが含まれるtestを追加。
- missing artifact時にproductionだけ404となる経路を再現する。

完了条件:

- local／stagingで200または意図したredirect。
- current exact SHAのproduction read-only smokeで成立。
- 問い合わせ送信経路、secret、送信先を変更しない。

### Slice C: owner policy and edit vertical slice

対象: #1296

目的:

- login userの新規Recordを、一覧・詳細・編集・status・retryで同じowner policyへ収束させる。

作業:

- canonical owner fieldとsession user ID mappingをsourceで特定。
- owner判定共通関数／policyを一覧、詳細、編集、processing status、AI retryへ適用。
- owner本人のP0編集項目を統一。
- optimistic concurrency、CSRF、validation、authorization testsを追加。

完了条件:

- 本人Recordは本人が編集できる。
- 他人Recordは編集、status、retry不可。
- 「自分の記録」表示とedit permissionが同じ判定を使う。

### Slice D: atomic save and outbox

対象: #1296

目的:

- media、Record、owner、AI requestの孤立を防止する。

作業:

- capture session、idempotency key、media token、Record IDを一つのledgerへ結ぶ。
- transaction可能範囲を明示し、外部storage／queue境界はoutboxで補う。
- orphan read-only diagnosisを先に実装する。
- retryで重複Record／jobを作らないtestを追加。

完了条件:

- API response loss後の再送で同じRecord IDを返す。
- media-only、record-without-owner、record-without-jobを分類できる。
- public-readyになる前にowner／rightsをread-backする。

### Slice E: AI state and recovery

対象: #1296

目的:

- AI成功より、状態の正確さと復旧可能性を保証する。

作業:

- request state、attempt、error code、input version、rule versionを保存。
- queued、analyzing、needs_review、identified、failed_retryable、failed_terminalをAPI/UIで共通化。
- owner再解析を冪等化し、連打・active request重複を防ぐ。
- provider timeout、schema failure、writeback failureのtest doubleを作る。

完了条件:

- 「保存済み」と「AI完了」を混同しない。
- provider failure→retry→成功をE2Eで通す。
- terminal failureでも手動編集で記録を完成できる。

### Slice F: Record-to-Place handoff

対象: #1424、#1426、#1296

目的:

- 新規Recordを既存Universal Place Atlasへ安全につなぐ。

作業:

- Record save後のmembership resolver起動点を統一。
- exact internal point、GPS uncertainty、boundary、hierarchyを使用。
- candidate／confirmed／no_location／no_safe_matchを保存。
- Record detailにPlace statusと訂正導線を出す。
- public-ready confirmed RecordだけをPlace profileへ投影する。

完了条件:

- Place内部→confirmed。
- 境界付近／overlap→candidate。
- 位置拒否→保存成功、後からPlace追加。
- privateへ変更→public profileから除外。
- exact coordinate／identity非公開。

### Slice G: offline and interrupted upload

目的:

- 通信・画面遷移による記録消失を防ぐ。

作業:

- pending local、uploading、server savedを区別。
- user-scoped IndexedDB／outboxを使用。
- login境界のrekeyを原子的にする。
- storage eviction、期限、破棄UIを定義する。

完了条件:

- offline→online再送で重複なし。
- 別ユーザーへdraftが漏れない。
- 破棄されるまで利用者が状態を確認できる。

### Slice H: P0 integrated staging E2E

目的:

- Slice単位の成功を一つの利用体験として統合する。

作業:

- Android、iPhone、PCのauthenticated P0 E2E。
- failure/retry、Place candidate、private withdrawal、route smoke。
- Visual QAとpublic privacy negative assertion。
- test Record／asset／jobのcleanup計画。

完了条件:

- `SPEC.md`の`READY_P0`条件を満たす。
- exact SHA、artifact、runtime、evidence checksumを記録する。

## 4. Dependency graph

```text
A current audit
├─ B support routes
├─ C owner/edit
│  └─ D atomic save/outbox
│     ├─ E AI state/recovery
│     ├─ F Place handoff
│     └─ G offline/interrupted upload
└──────────────┬──────────────
               H integrated staging E2E
```

Bは他sliceと並行可能。CとDはE/F/Gの前提。Hはすべての統合gate。

## 5. Issue更新ルール

各Issue commentに最低限次を残す。

```text
Observed source SHA:
Observed runtime SHA:
Implemented:
Not implemented:
Tests:
Staging:
Production:
P0/P1 classification:
Blocker:
Next exact action:
Protected mutations:
```

Issue本文の古い期待SHA、branch、runtimeを現行値と混同しない。close時は、完了条件ごとの証拠pathを示す。

## 6. close候補の判断

- #1422〜#1426は、対応PRがmerge済みでも自動closeしない。完了条件とcurrent runtime evidenceをmappingする。
- #1296は、部分実装だけでcloseしない。P0 E2E、retry、edit、owner、backfill境界を確認する。
- #1365は、production read-only route smokeがgreenになるまでcloseしない。
- #1441は、P0から分離できる場合はP1品質Issueとして維持する。
- #1444は、`READY_P0`または明示された`READY_WITH_LIMITS`の証拠が揃うまでcloseしない。
