本文（transport-encoded）を `<AT_SIGN>`→`@`、`\uXXXX`→対応UTF-16として復元し、対象行のみを判定しました。以下、指定フォーマットで報告します。

## 1. 採用すべき点

- **Record/Occurrence分離が一貫**。snapshot行を `visit_id`(=Record)でdedupし、`occurrence_id`は件数へ流用しない。`record-1` の2 Occurrence→1 Record計上、`summary.recordCount=3` が両runtime・contractテストで確認できる。
- **exact座標・contributor一覧を返さない**設計が徹底。`contributorCountAllowed:false` 固定で `contributorCount` は常に `null`、Node/Worker/routeの各テストが JSON に `exact_lat/lng・latitude/longitude・user-*` を含まないことを assert。
- **D1 bind ≤ 82 を実際に満たす**。`loadSnapshotRows` が `snapshot_key + ≤80 cells + limit = 82`、chunk境界テスト（169セル→3分割、全chunk≤82）で境界を保証。他クエリも全て ≤80。
- **OSMスコープ境界とholeが正しい**。`MAX_SCOPE_CELLS=256` 超過で `null`→無制限global scanに落ちず件数 `null`。inner ring除外・polygon hole除外が `pointInPolygon`/専用テストで検証済み。
- **media allowlist**（same-origin `/`・`*.ikimon.life` HTTPSのみ、`javascript:`・`//`拒否）、**Place Memory可視性**（private Record由来・viewer hidden・moderation除外）、**stale応答対策**（AbortController＋`seq`＋`refKey`再照合＋`version!==1`拒否）いずれも要件を満たす。
- **transient areaの座標漏洩を除去**。follow IDから `point:lat,lng` を排し `entity_key/field_id` 無ければ follow不可、locationラベルも県市名へ置換。
- **CSS `@media`/`@keyframes` は正当**。`@platform_v2` 参照は `doesNotMatch` 内の否定テストのみで、production styleには存在しない（reminder通り production source扱いしない）。
- **deploy安全性**：DB migration・secret変更なし、参照read modelは `isMissingOptionalTable` でgraceful fallback、rollbackはcodeのみ（`area-snapshot` UIへ復帰）。

## 2. 重大な懸念

- 再現可能なP0ブロッカーは検出できませんでした（BLOCK要件＝復元後の再現失敗＋該当encoded行の提示、を満たすものなし）。

## 3. P0で変更すべき仕様

- なし。

## 4. P1以降に回すべき仕様（非ブロッキング）

- **sensitive fieldのcontribution_cta抑止がNode/Workerで非対称**。Workerは `sensitive_precheck_failed` で `contribution_cta` を抑止するが、Node `placeAtlasProfile.ts` の `fieldPolicySuppression` は `confirmed_life` 等のみ抑止し `contribution_cta` を落とさない。表示RecordはNode側で公開snapshot経由の privacy gate済みのため位置漏洩には至らずP1だが、チェックリストの「sensitive を Node/Worker 同一token」を満たすため Node field にも sensitive→`contribution_cta` 分岐を追加推奨。
- **404のcache方針不一致**。Node 404=`no-store`、Worker 404=`public, max-age=60, stale-while-revalidate=300`。未生成プレイスの出現遅延を避けるため Worker 404 も `no-store` 寄せを推奨。
- **dedupe後のdisplayName/identificationStatus不整合**。`richerRecord` は名称を高スコア行（confirmed由来）から、statusは最大リスク（ai_candidate）から取るため「確定名＋AI候補バッジ」が併存し得る。過小主張側で安全だが表示は要調整。
- **`cell_1000` フォーマット依存**。public_cell/geometry経路が `cell_1000` を2桁小数 `lat,lng` 前提でIN句照合する。read model実スキーマが grid id 形式だと0件化するため、staging で `public_map_snapshot_records_v1.cell_1000` の実値一致を要確認（PLANのexact-SHA staging検証で吸収可能）。

## 5. 最終推奨

**APPROVE_WITH_NONBLOCKING_NOTES**

correctness / privacy / Record vs Occurrence / contribution_cta（school・private・no・restricted・customers・permit・OSM sensitive相当）/ D1 bind≤82 / Web Mercator cell / bounded OSM scope・hole / media allowlist / Place Memory可視性 / stale応答 / `@media`構文 / a11y・レスポンシブ / rollback・deploy安全性のいずれもproductionブロッカーなし。P4記載の非対称・cache・表示・スキーマ依存はstaging（exact-SHA）検証と後続コミットで解消可能で、マージ・staging投入を妨げません。
