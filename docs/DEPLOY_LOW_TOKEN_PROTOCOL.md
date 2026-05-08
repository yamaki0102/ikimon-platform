# ikimon.life Low-Token Deploy Protocol

目的: ikimon.life の deploy 相談で、エージェントに巨大な戦略文書・過去 handover・全体 catch-up を読ませない。

この文書は「デプロイ作業だけ」を短く閉じるための入口。プロダクト判断、v2移行判断、UI戦略判断には使わない。

## Root Cause

トークン消費の主因は deploy そのものではなく、毎回のエージェント起動で次を読ませていること。

- 長い `AGENTS.md`
- private repo 側の戦略・移行文書
- 過去の handover / catch-up 系ドキュメント
- deploy 成否判定に不要な product / architecture 文脈

deploy は本来、差分確認、guardrail、CI/Actions、必要最小限の smoke で閉じる。

## Use This Prompt

次回以降、deploy だけ頼むときはこのまま貼る。

```text
ikimon.life の low-token deploy check をして。

読むファイルは原則この2つだけ:
1. docs/DEPLOY_LOW_TOKEN_PROTOCOL.md
2. docs/DEPLOYMENT.md

禁止:
- private repo 側の docs/strategy/**, docs/architecture/**, docs/CLAUDE_HANDOVER*, docs/CATCHUP* を読まない
- 変更がないファイルを広く読まない
- 長い背景説明を出さない
- production direct SSH deploy をしない
- data/config/secret を deploy 対象にしない

実行:
1. git status --short --branch
2. git diff --name-only origin/main...HEAD
3. 変更ファイルだけ確認
4. php tools/lint.php
5. composer test（存在する場合）
6. powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_guardrails.ps1
7. powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_manifest_sync.ps1
8. staging なら powershell -ExecutionPolicy Bypass -File .\scripts\check_staging_manifest_sync.ps1
9. PR/Actions監視は powershell -ExecutionPolicy Bypass -File .\scripts\deploy_status_summary.ps1 -Pr <番号> を使う

出力は次だけ:
- deploy 可否
- 変更ファイル
- 実行したコマンドと結果
- blocker があれば blocker
- 次の1手
```

## Agent Rules

- まず command evidence を取る。推測で deploy 可否を言わない。
- 失敗ログは全文を読まない。最初は該当 job の failure 周辺、または先頭200行/末尾100行だけ読む。
- 追加読解は、失敗した command または changed file から辿れる範囲に限定する。
- `git diff --name-only` に出ていない領域の設計文書は読まない。
- production deploy は `main` merge 起点の GitHub Actions のみ。ローカル SSH deploy はしない。
- production に入る操作は、ユーザー承認後に進める。

## Security / Overwrite Gate

セキュリティ対策と上書き防止は、長文読解ではなく次の固定ゲートで扱う。

### Always Run

```powershell
php tools/lint.php
composer test
powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_guardrails.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_manifest_sync.ps1
```

staging の場合:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check_staging_manifest_sync.ps1
```

### What These Gates Protect

- `check_deploy_guardrails.ps1`
  - `strategy = github_actions_only` 以外を拒否
  - `deploy.json` の旧 direct deploy route を拒否
  - `upload_package/data/**` など persistent path の変更を拒否
  - `*.sqlite`, `*.db`, `.env`, `credentials.json`, `debug_*.php`, `test_*.php`, `*.bak` などを拒否
- `check_deploy_manifest_sync.ps1`
  - deploy workflow が production host / deploy script / health check URL / guardrail を参照しているか確認
- `check_staging_manifest_sync.ps1`
  - staging workflow と staging manifest の同期を確認
- `composer test`
  - アプリ側 regression を確認
- `php tools/lint.php`
  - PHP syntax break を確認

### Security-Sensitive Change Triggers

次のファイルに差分がある場合だけ、追加で該当ファイル周辺を監査する。

- `platform_v2/src/routes/**`
- `platform_v2/src/services/auth*`
- `platform_v2/src/services/writeGuards*`
- `platform_v2/src/services/contactSubmit*`
- `platform_v2/src/app.ts`
- `platform_v2/src/db.ts`
- `upload_package/public_html/api/**`
- `upload_package/libs/Auth.php`
- `upload_package/libs/CSRF.php`
- upload / auth / session / invite / admin / export / webhook を含むファイル

追加確認の原則:

- 小変更: changed file だけレビュー
- auth / upload / admin / export / session の変更: CSRF、認可、rate limit、secret露出、CSV injection、file upload validation を確認
- 月次監査や大改修: private repo 側の security playbook / Clearwing を使う
- 通常deployごとに Clearwing 全面監査はしない

## Token Budget

deploy相談の初期文脈は、目標 3,000 tokens 以下にする。

読むもの:

- この文書
- `docs/DEPLOYMENT.md`
- changed files
- 失敗した command の関連ログ

読まないもの:

- product strategy
- v2 cutover architecture
- historical handover
- monthly security playbook 全文

## Actions Summary Command

`gh run watch` は使わない。成功runのログは読まない。

```powershell
# PR番号から production / staging run をまとめて確認
powershell -ExecutionPolicy Bypass -File .\scripts\deploy_status_summary.ps1 -Pr 341

# run id から単体確認
powershell -ExecutionPolicy Bypass -File .\scripts\deploy_status_summary.ps1 -RunId 25525758875

# 失敗ログ量をさらに絞る
powershell -ExecutionPolicy Bypass -File .\scripts\deploy_status_summary.ps1 -Pr 341 -LogTail 40
```

このコマンドは次だけ出す。

- PR / SHA
- production run の状態
- staging run の状態
- 失敗job / 失敗step
- 失敗時だけ最小ログ

## Minimal Decision Tree

1. `git status` が clean か?
   - clean: deploy 対象なし。Actions の再実行か状態確認だけ。
   - dirty: 変更ファイルを分類する。
2. 変更が docs-only か?
   - docs-only: 通常 production deploy 不要。
   - app / workflow / deploy script 変更あり: guardrail へ進む。
3. guardrail / lint / test は通ったか?
   - pass: PR / Actions へ進む。
   - fail: 失敗箇所だけ読む。
4. staging が必要か?
   - UI大変更、データ境界、deploy script 変更: staging first。
   - 小さな文言/静的修正: PR -> main merge の通常ルートでよい。

## Short Report Template

```text
deploy可否: YES/NO
対象: staging/production/none
変更: <files>
検証:
- <command>: pass/fail
- <command>: pass/fail
blocker: <none or issue>
次の1手: <one action>
```
