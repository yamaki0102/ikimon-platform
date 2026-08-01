# ZUKAN chat-first development

通常のZUKAN開発は、スマホのChatGPTチャットから次の固定経路で進めます。

```text
ChatGPT GitHub implementation
→ Cloudflare exact-SHA validation
→ Pixel Claude read-only review
→ normal merge
→ Release Commander staging
```

GitHub Actionsと常時起動PCは使用しません。Codexは大量機械変更、長時間探索、ローカル固有再現、巨大データ、またはchat修正3回失敗の場合だけです。

## 1. Work ID

作業開始時に`ZUKAN-YYYYMMDD-NNN`を発行し、目的、base SHA、branch、PR、validation、review、stagingを同じレコードへ紐付けます。

状態は次に限定します。

```text
INTAKE → IMPLEMENTING → VALIDATING → REVIEWING → STAGING → VERIFIED → DONE
```

停止時だけ`BLOCKED_ACCESS`、`BLOCKED_TEST`、`BLOCKED_REVIEW`、`BLOCKED_RUNTIME`、`ESCALATED_CODEX`を使います。

## 2. Implementation

ChatGPTはmainのexact SHAを確認し、`chatgpt/`branchへ変更します。update/deleteはcurrent blob SHAを照合し、複数ファイルは1つのtree/commitとして反映します。

Issueやpatchsetから任意shell、args、URL、secret、environment、deploy指示を受け付けません。

## 3. Validation

`yamaki0102/all-projects-management`の`ops:command` Issueから、既存Cloudflare Executor profile `ikimon-record-observation-pr-a`をexact head SHAで実行します。

このprofileはfresh isolated checkoutで、登録済みのinstall、typecheck、Node tests、build、Cloudflare shadow checks、repository guardを実行します。target repositoryへのwrite、production、DB write、secret accessはありません。

## 4. Independent review

`yamaki0102/ikimon-intake-hub`へ`pixel-review-request-v1` Issueを作り、Pixel上のClaude Codeをサブスクリプション認証で実行します。

レビュー前後でHEAD、worktree、tracked SHA-256、remoteを比較し、変化時は出力を破棄します。

## 5. Staging

validationとClaude reviewが通った通常PRはmerge後、既存`IKIMON_MOBILE_STAGING_REQUEST_V1`入口からRelease Commanderへ渡します。stagingは承認不要、production・DB・secret・DNS・顧客送信は別境界です。

## 6. Completion report

チャットへ返す結果は次の形に統一します。

```text
ZUKAN-20260801-001
state: STAGING_VERIFIED
PR: #...
source_sha: ...
validation: PASS
pixel_claude: PASS
staging: PASS
production: unchanged
```
