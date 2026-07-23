# Wレビュー最終採用判断

- 対象: PR #1419 / runtime head `f34bfdb5`
- 原本packet SHA-256: `08ADB56B47AC6E8B174EB8F50DCE9683FF5936BEAC92041BAA39EBF10374B6AB`
- transport-safe packet SHA-256: `4C2F1B12EA6F2A9C8F2FDB3E592C4BBB221EDD42D298AFCE90E790F52A4A9848`
- 原本格納: `review-packet.original.zip`（展開後SHA-256を照合済み）
- review投入packet格納: `review-packet.transport-safe.zip`（展開後SHA-256を照合済み）
- Claude: `claude-opus-4-8` / `APPROVE_WITH_NONBLOCKING_NOTES`
- Gemini: `gemini-3.5-flash` / `APPROVE_WITH_NONBLOCKING_NOTES`
- Codex判定: `APPROVED_FOR_STAGING_FIRST_PRODUCTION_PROMOTION`

## Wレビュー結論

両reviewともproduction blockerなし。次の中核条件をgreenと判定した。

- RecordとOccurrenceの分離、Record単位重複排除、AI候補の暫定維持
- exact座標、個人一覧、private/hidden Recordの非公開
- school / private / no / restricted / customers / permit / sensitiveの記録CTA抑制
- D1 bind最大82、OSM scope最大256 cell、oversize時の安全なnull
- Web Mercator public cell互換、multipolygon hole除外
- media URL allowlist、Place Memory可視性、stale response防止
- CSS media query、a11y、mobile/desktop responsive contract
- migration・secret変更なし、code rollback可能

## 採用済み

過去reviewで判明した次の指摘は最終headへ反映済み。

- D1 query chunking
- canonical public cell変換
- media allowlist
- school/sensitive/OSM school/restricted contribution CTA抑制
- Node/Workerの`contribution_cta` tokenとaccess集合統一

## 非ブロッキングとして保留

Claude:

- Node側はWorkerの`display_suppression_reason`と同じsensitive理由を常に取得できるわけではない。
  production runtimeはWorkerであり、Node公開snapshotは既存privacy gateを通るため本MVPの
  production blockerにはしない。
- 404 cache、dedupe後の名称表示、readmodel cell形式の監視はstaging/production smokeで確認する。

Gemini:

- 3件の日本語誤字指摘は原本とtransport-safe packetのcodepointに存在しないため不採用。
  実値は`正確な位置`、`公開セルより細かい位置`、`現地ルール`。

## transport判断

Gemini CLIはliteral U+0040をfile referenceとして展開するため、通常packetではCSS
at-ruleを別ファイルpathへ誤変換した。最終reviewではU+0040を`<AT_SIGN>`、非ASCII
UTF-16 code unitを`\uXXXX`へ一対一変換した。原本とsafe packetの両方を証跡に保持する。

## 実行済み検証

- Node typecheck: green
- Node test: 1365/1365
- Worker typecheck: green
- Worker test: 391/391
- Playwright Visual QA: 7/7
- Worker staging dry-run: green
- W review: complete / both providers ok / no failed candidates / no Flash-Lite fallback

次のgateは中央deploy registryに従うstaging-first promotion。
