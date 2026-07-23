# Wレビュー採用判断（第2回）

- 対象: PR #1419 の全実装差分
- Claude: `claude-opus-4-8` / `APPROVE_WITH_NONBLOCKING_NOTES`
- Gemini: `gemini-3.5-flash` / `BLOCK`
- Codex判定: 指摘を再現確認し、実在する公開安全差を修正。GeminiのCSS破損指摘は証拠と一致しないため棄却。最終差分を再レビューする。

## 採用

1. Worker native の学校fieldで記録CTAが抑制されない
   - `fieldType(field) === "school"` を `contribution_cta` 抑制へ接続した。
   - Worker nativeの学校fieldテストを追加した。
2. sensitive policy抑制中も記録CTAが表示されうる
   - `sensitive_precheck_failed` を `contribution_cta` 抑制へ接続した。
   - 既存sensitiveテストへCTA抑制の検証を追加した。
3. transient OSM schoolの記録CTA抑制
   - `ResolvedOsmPlace.type === "school"` を既存access制限と同じ抑制へ接続した。
   - 常磐公園固有分岐を使わないOSM schoolテストを追加した。
4. CSS media queryの明示的な回帰防止
   - 実コードは正常だったが、`@media`の主要2条件と未解決path文字列の不在をunit testへ追加した。

## 棄却

### Gemini: CSSの`@media`がWindows pathへ置換されている

再現しないため棄却した。

- 実ファイル `platform_v2/src/ui/mapPlaceAtlasProfile.ts` の該当箇所は、行760、770、801、810ですべて正しい `@media`。
- Geminiが引用した `@platform_v2\src\ui\observationMedia.ts` は実ファイルにもreview packetにも存在しない。
- review packetでは行5897、5907、5938、5947に正しい `@media` がある。
- Playwrightの6 viewport＋failure caseは7/7 greenで、モバイルpeek、44px操作領域、横overflowなしを実ブラウザで確認済み。

## 確認済み・追加変更なし

- `/derived-transform/w{width}/...` はWorker route、route test、UI testが存在する。
- public cellはNode/Workerの用途が異なるが、公開API contractとWorkerのcanonical Web Mercator変換をテストしている。
- public cellのRecord集合は公開snapshotを正本とし、source visitのexact座標をAPIへ返さない。
- DB migration、secret変更、データ更新はない。

## 検証

- Worker Place Atlas対象: 12/12
- Worker全件: 390/390
- Worker typecheck: green
- UI Place Atlas対象: 6/6
- CSS query: 実ファイル・review packetとも正しい`@media`を確認

最終状態は `fixes_applied_pending_final_rereview` とし、修正後の全差分をWレビューへ再投入する。
