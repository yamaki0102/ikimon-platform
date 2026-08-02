# 外部レビュー採用ログ

## 対象

- PR: `yamaki0102/ikimon-platform#1519`
- review packet: `E:\Projects\_agent_scratch\yamaki0102-all-projects-management\pr1519-production-release-20260802\release-review-packet.md`
- review時点のsource head: `c35d9dafc62ddd7d34a6194aea470b2cac31ea25`
- Claude: `claude-opus-4-8`
- Gemini: `gemini-3.5-flash`
- raw review: 同ディレクトリの `claude-review.md` / `gemini-review.md`

## 採用

- Command Bus #998の `repository_execution` 証拠生成失敗は、ローカルPASSで代替しない。current-head validationのterminal PASS、merged SHA再検証、staging runtime read-back、Visual QA、rollback locatorが揃うまでReady/merge/productionへ進めない。
- fallback markerはallowlistだけで十分と断定せず、originのネットワーク到達性と、marker値がOAuth/CSRF/callbackのsecurity判定へ流入しないことを別証拠で確認する。
- guest Homeのeligibility/gate判定で例外・欠損が発生した場合も非表示へ倒れることを、source/testとstagingで確認する。
- staging/production判定がforwarded headerではなくtrusted runtime bindingと公開Hostの契約に依存することを確認する。

## 実装反映

- full-diff review #459/#461の指摘を採用し、Worker独自OAuthの `requestPublicOrigin` が inbound `X-Forwarded-Host` / `X-Forwarded-Proto` / fallback markerを使わず、共有 `resolveTrustedPublicOrigin` に公開Hostだけを渡す修正を `c35d9daf` に反映した。
- 回帰テスト `worker oauth origin ignores inbound forwarded headers and fallback markers` を追加し、Worker全体 `438/438 PASS`、Worker typecheck PASS、Platform origin/OAuth `9/9 PASS`を確認した。

## 保留

- fallback markerのHMAC化は、既存secret変更を伴うため今回のPRへ追加しない。ネットワーク境界の実証ができない場合はproduction gateとして保留し、別の承認済みhardening変更に分離する。
- SVG CSPの実値、baseline #1524の期待値変更と3件のP1 PostgreSQL runtime blockerの対応関係は、canonical validation/staging evidenceで再確認する。

## 不採用

- Claude reviewの「on-disk packetが0バイト」という前提は、同一pathのread-backで本文が存在したため不採用。内容を捏造せず、packetの実体とsource evidenceを正本とする。
- Gemini reviewの「P1 PostgreSQL blockerが直ちに本番停止を起こす」という断定は、immutable ledgerの正確なstack/impact証拠がないため不採用。blockerを可視のまま残し、baseline修復を未解決として扱う。

## 最終判断

外部レビューは設計方向とc35のWorker OAuth修正を支持したが、#998の外部validation失敗、staging/Visual QA/rollback未取得、fallback marker境界未実証が残るため、現時点のrelease verdictは `BLOCKED_EXTERNAL_EVIDENCE` とする。
