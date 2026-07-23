# Wレビュー採用判断（第3回）

- 対象: PR #1419 最終候補差分
- Claude: `claude-opus-4-8` / `APPROVE_WITH_NONBLOCKING_NOTES`
- Gemini: `gemini-3.5-flash` / `BLOCK`
- Codex判定: Claudeの実在するruntime parity指摘を採用。GeminiのCSS/文字化け指摘はreview packetと一致せず、CLI transport不具合として棄却。transport-safe packetで再レビューする。

## 採用

1. OSM `access=restricted` のWorker抑制漏れ
   - Workerの制限集合へ`restricted`を追加した。
   - Worker nativeのrestricted OSMテストを追加した。
2. Node/WorkerのCTA抑制token差
   - 新規responseは両runtimeとも`contribution_cta`へ統一した。
   - UIは既存response互換のため`direct_record_cta`も引き続き受理する。
   - Nodeのfield/OSMテストを追加した。
3. OSM access集合差
   - 両runtimeを`private / no / restricted / customers / permit`へ統一した。
4. contract明記
   - SPECへ正本token、制限集合、legacy aliasの責務を追記した。

## 棄却

### Gemini: `@media`がpathへ置換されている

review packetに引用行が存在しないため棄却した。

- packet行5961、5971、6002、6011はすべて正しい`@media`。
- packet行5192、5193は正しい`@media`を要求するassertion。
- `@platform_v2`はpacket行5194の`doesNotMatch`（禁止文字列を検出するnegative assertion）にだけ存在する。
- Node全1363件、UI対象6件、Playwright 7件はgreenで、Geminiが主張した正規表現syntax errorは再現しない。

Gemini CLIは`@name`をfile referenceとして展開するため、patch内のCSS `@media`を
`observationMedia.ts`への参照として誤展開したと判断する。次回は全U+0040を
`<AT_SIGN>`へ一対一変換し、mappingと原本SHA-256を付けたtransport-safe packetを使う。

### Gemini: PLAN/SPECが文字化けしている

原本、Git diff、PowerShell UTF-8読取では日本語が正常で、引用された文字列はpacketに存在しない。
CLI側の表示encodingに起因するため棄却した。

## 確認済み

- Claudeはprivacy、Record/Occurrence、D1 bind最大82、Web Mercator cell、OSM有界化、
  multipolygon hole、media allowlist、Place Memory、stale response、CSS、a11y、
  rollbackについて再現可能な重大懸念なしと判定した。
- DB migration、secret変更、production data変更はない。

最終状態は`transport_issue_and_parity_fixes_pending_rereview`。
