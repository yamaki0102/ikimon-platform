# ZUKAN chat-first development

この文書は運用ガイドです。機械判定の正本は [`.ikimon/development-contract.json`](../.ikimon/development-contract.json) であり、内容が食い違う場合はJSON contractを優先します。

通常のZUKAN開発は、スマホのChatGPTチャットから次の固定経路で進めます。

```text
ChatGPT GitHub implementation
→ Cloudflare exact-SHA validation
→ ChatGPT exact-head / full-diff self-review
→ normal merge
→ Release Commander staging
```

Pixel Reviewは既定では使用しません。リポジトリ所有者がその作業について明示的に指示した場合だけ、補助的なread-only reviewとして起票できます。Pixelの結果は明示指定がない限りrelease gateにしません。

GitHub Actionsと常時起動PCは使用しません。Codexは大量機械変更、長時間探索、ローカル固有再現、巨大データ、またはchat修正3回失敗の場合だけです。

## 1. Work ID

作業開始時に`ZUKAN-YYYYMMDD-NNN`を発行し、目的、base SHA、branch、PR、validation、self-review、stagingを同じレコードへ紐付けます。

状態は次に限定します。

```text
INTAKE → IMPLEMENTING → VALIDATING → REVIEWING → STAGING → VERIFIED → DONE
```

停止時だけ`BLOCKED_ACCESS`、`BLOCKED_TEST`、`BLOCKED_REVIEW`、`BLOCKED_RUNTIME`、`ESCALATED_CODEX`を使います。

## 2. Implementation

ChatGPTはmainのexact SHAを確認し、`chatgpt/`branchへ変更します。update/deleteはcurrent blob SHAを照合し、複数ファイルは1つのtree/commitとして反映します。

1 patchsetの上限は、JSON contractどおり**30ファイル、content合計1,000,000 bytes**です。上限を超える場合は作業を意味のある単位へ分割し、Codexへ自動移行しません。

Issueやpatchsetから任意shell、args、URL、secret、environment、deploy指示を受け付けません。

## 3. Validation

`yamaki0102/all-projects-management`の`ops:command` Issueから、既存Cloudflare Executor profile `ikimon-record-observation-pr-a`をexact head SHAで実行します。

このprofileはfresh isolated checkoutで、登録済みのinstall、typecheck、Node tests、build、Cloudflare shadow checks、repository guardを実行します。target repositoryへのwrite、production、DB write、secret accessはありません。

## 4. Self-review

ChatGPTがexact headとbaseの全差分をread-onlyで確認し、PRへ次を記録します。

- exact base/head SHA
- 全変更ファイルとscope drift
- P0/P1/P2 findingと採否
- セキュリティ・プライバシー・異常系・rollback境界
- 未解決finding数
- mutation ledger

source修正が入った場合はheadを更新し、最新headで再度full-diff self-reviewを行います。Pixel Reviewは所有者の明示指示がある場合だけ別レーンで実施します。

## 5. Staging

validationとself-reviewが通った通常PRはmerge後、既存`IKIMON_MOBILE_STAGING_REQUEST_V1`入口からRelease Commanderへ渡します。stagingは承認不要、production・DB・secret・DNS・顧客送信は別境界です。

## 6. Completion report

チャットへ返す結果は次の形に統一します。

```text
ZUKAN-20260801-001
state: STAGING_VERIFIED
PR: #...
source_sha: ...
validation: PASS
self_review: PASS
staging: PASS
production: unchanged
```
