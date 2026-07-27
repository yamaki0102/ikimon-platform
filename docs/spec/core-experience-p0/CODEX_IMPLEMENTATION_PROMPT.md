# Codex実装指示: ZUKAN 個人P0 runtime gate

## 推奨設定

- モデル: GPT-5.6 Sol
- 推論: high
- 複数runtime・E2E・migration判断が必要な場合のみultra
- fresh worktree / latest `origin/main`

## 目的

最新mainから、ZUKAN個人P0のruntime検証PRを作る。

`撮る → 保存 → owner → AI候補 → edit → public safety → Place → revisit`

旧Draft PR #1459の有効なruntime identity・materialization・Place Atlas・retry fixtureを再利用する。ただし、旧branchをbase・release候補にせず、UTSUROU brand assertionを持ち込まない。

## 最初に読む

1. root `AGENTS.md`
2. `docs/spec/core-experience-p0/SPEC.md`
3. `docs/spec/core-experience-p0/ZUKAN_EXECUTION_PLAN.md`
4. `docs/spec/core-experience-p0/ISSUE_MAP.md`
5. `docs/spec/place-graph/GLOBAL_PLACE_IDENTITY_CONTRACT.md`
6. PR #1459 diff・review・未完了事項
7. current deploy registry / project-local deploy docs

一般ルールを本指示から推測せず、repository正本を優先する。

## 実装範囲

- latest mainからshort-lived branch
- #1459差分を監査し、必要最小限だけ再実装
- exact source / tree / materialized UI identity assertion
- fresh capture P0 fixture
- owner edit・another-user deny
- AI provider failure→retry→success fixture
- Place membership・public profile一回反映
- private / limited / public-ready / public precision assertion
- `/learn`、`/ja/contact` contractの解消または安全な除外
- Android / iPhone / desktop向けQA runner・evidence contract

## 成功条件

- targeted tests green
- full typecheck / build / tests green
- idempotent retryでduplicateなし
- owner、media、Record、AI request、Place membershipが孤立しない
- exact coordinate・private note・contributor identityがpublicへ出ない
- AI suggestionをverifiedと誤表示しない
- current Home、Records、detail、Placeが同じ状態を読む
- source-only PRを作成
- exact head SHA、changed files、tests、remaining runtime stepsをPRへ記録

## 禁止

- main direct push
- old #1459 branchをそのままrelease
- UTSUROU service branding
- brand理由のinternal ID・DB・API一斉改名
- DB / migration / production / secret / DNS / permission / billing / customer send
- existing dirty worktree・unrelated changeの破棄
- `保存済み = AI完了`
- exact location public exposure

## 検証後の状態

source PRでは`CODE_IMPLEMENTED / SOURCE_VALIDATED / STAGING_NOT_RUN`までを正確に記録する。

stagingは別の明示依頼・中央command busで、exact SHAを使って行う。productionは別承認。

## 提出物

- Draft PR
- source audit summary
- changed-file map
- test result
- runtime QA command/evidence plan
- unresolved P0/P1
- rollback・cleanup境界
