# PR #1514 外部レビュー採用判断

## 判定

レビューは `partial` として扱う。Claude Opus lane は対象worktreeの実ソースを読めず、PRの説明文だけを根拠にしたレビュー不能報告だった。Gemini lane は `gemini-3.5-flash` と `gemini-3-flash-preview` がタイムアウトし、`gemini-2.5-flash`で完了した。

## 採用

- 複数の永続primary identityを一つに潰さず、managed identityが一つでもあればGate 0を閉じる。現行 `notificationEligibility` と focused testで確認済み。
- 通知gate/read/writeの失敗がcaller-owned reassessment transactionを壊さないようsavepointで復旧する。現行 `notificationEligibility` / `areaWatchNotifications` と失敗後クエリの回帰テストで確認済み。
- area_watch再評価は既存のdedup unique indexと `ON CONFLICT DO NOTHING` により再実行を冪等化する。現行migration、SQL、replay testで確認済み。
- client/transient identityをGate 0のallow sourceにしない。現行のserver-side canonical readとmanaged-taxon testで確認済み。

## 不採用・保留

- `area_watch_dispatches`、`observation_assessments`、`taxon_code`など、現行repositoryのschema・実装に存在することを確認できない名前を使った指摘は不採用。
- 現行テストで既に確認しているtransaction rollback、複数identity、replay idempotencyを、未確認のP0として再起票することはしない。
- 外部レビューが要求した追加のproduction/DB操作、migration、外部通知は実施しない。

## ローカル検証

- `npm ci`: PASS（既存audit advisoryあり、dependency file変更なし）
- `npm run typecheck`: PASS
- `npm run test:node`: PASS（1658/1658）
- `npm run build`: PASS
- `git diff --check`: PASS
- `npm run wrangler:check:staging`: PASS
- Cloudflare Shadow全体testは、PR差分外の既存D1境界テスト3件が現行main由来でFAIL。これはPR #1514のNode gateとは分離して記録する。
