PR 1419 をレビューしました。パッチ本文を通読し、Worker/Node の両アダプタ・contract・UI glue・テストを突き合わせています。以下、指定形式で報告します。

---

## 1. 採用すべき点

- **参照モデルの設計が堅実**。`normalizePlaceAtlasRef`（`placeAtlasContract.ts`）が raw lat/lng を拒否し、OSM の `entity_key !== 'osm:${type}:${id}'` を相互検証している。`mapApi.publicMap.routes.test.ts` の `?kind=point&lat=...` → 400 も網羅済み。座標を API 入力にしない方針が実装・テスト両面で守られている。
- **Record 単位 dedupe が Occurrence 混入を防いでいる**。`dedupePlaceAtlasRecords` が `recordId` で束ね、`richerRecord` の `identificationRisk`（confirmed 0 → ai_candidate 3、max を採用）で AI 候補を confirmed に昇格させない。`placeAtlasContract.test.ts` の record-1 が `ai_candidate` を維持する点で担保。
- **null / 0 / suppressed の三分岐が明確**。`buildPlaceAtlasProfile` の `belowThreshold`・`dedupedRecords === null`・`recordSetComplete` 分岐で「未取得=null」「検証済み0」「閾値未満=suppressed」を区別。
- **UI の stale-response 制御が正しい**。`requestPlaceAtlasForSelection`（`mapExplorer.ts`）で `++placeAtlasSeq`・`AbortController`・`placeAtlasRefKey(...) !== refKey` の三重ガード、8s タイムアウトと abort/timeout の区別（`controller.signal.aborted && !timedOut` で silent return）。
- **座標非露出の回帰テスト**が Node/Worker 双方に存在（`doesNotMatch(JSON.stringify(profile), /exact_lat|exact_lng|34\.9702/)`）。`openTransientAreaSheet` の followId から座標を除去（`String(props.entity_key || props.field_id || '')`）した privacy 修正も良い。
- OSM inner ring 除外（`osmGeometry` の `role === 'inner'` を穴として owner polygon に付与）と `pointInPolygon` の穴判定、`placeAtlasProfileNative.test.ts` の中抜きテストで recordCount 0 を確認済み。
- 認証時 `private, no-cache, no-store` / 匿名時 `public, max-age=60` + `Vary` の出し分け。`hasCredential` を「cookie/bearer の存在」で判定し、session 無効でも memories を読まない設計は安全側。

---

## 2. 重大な懸念

**D1 のバインドパラメータ上限（100）を超えるクエリが、中規模以上の field/OSM area で確実に 503 を起こす。** これが本 PR 最大の本番リスクです。詳細は P0-1。加えて **public_cell の cell-id 形式が Node と Worker で非互換**で、本番 Worker が実マップの cell 選択を 404 にし得る（P0-2）。この2点は「production gate」観点で見過ごせません。

---

## 3. P0で変更すべき仕様

**P0-1: `loadSnapshotRows` の cell IN 句が未チャンクで D1 の 100 パラメータ上限を超える**
`platform_v2/cloudflare_shadow/src/placeAtlasProfileNative.ts`
- 定数: `const MAX_SCOPE_CELLS = 256;` / `const MAX_QUERY_BINDINGS = 80;`
- `loadSnapshotRows` の `.bind(SNAPSHOT_KEY, ...cells, MAX_SNAPSHOT_ROWS)`

`loadVisitLocations`・`loadPhotoUrls` は `MAX_QUERY_BINDINGS = 80` で分割しているのに、`loadSnapshotRows` の cell IN 句だけ未分割で最大 257 セル（=約 259 バインド）を1クエリに渡す。D1 の1クエリ最大バインドは 100。`publicCellsForBbox` が 100〜256 セルを返す領域（bbox 約 0.08度≒9km 級の field 多角形／OSM area）で D1 が throw → `getPublicMapPlaceProfile` の catch → **503 place_profile_unavailable**。常磐公園（~25セル）は通るため MVP デモは緑になるが、大きめの公園・保護区・自治体系 field で本番が壊れる。cells も 80 件単位でチャンク集約するか、`MAX_SCOPE_CELLS` を安全上限（例: 80）に下げること。既存テストは常磐スケールしか通っておらず、100〜256 セル領域の回帰が欠落（テストギャップ）。

**P0-2: public_cell の cell-id 形式が Worker native で解釈できない**
`platform_v2/cloudflare_shadow/src/placeAtlasProfileNative.ts` の `parsePublicCell`（`^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$`）と `loadPublicCellPlaceAtlasProfile`
- 対して `placeAtlasContract.ts` `isValidPublicCellId` は `^\d{2,6}:-?\d+:-?\d+$`（grid 形式）と `cell:lat,lng` の両方を許可。
- Node 側テストは `cell_id=1000:15396:4160`（grid）で 200 を期待、Worker 側テストは `cell:34.97,138.38`（decimal）で検証。

native の `parsePublicCell` は `1000:x:y` grid 形式を解釈できず null → 404。マップの cells API が grid 形式 `cellId` を発行している場合、**本番 Worker で cell 選択の place atlas が常時 404**。少なくとも「実マップが発行する cellId 形式」を1つに固定し、native `parsePublicCell` をその形式に合わせること。現状は Node/Worker が別形式を各々テストしており parity が担保されていない（SPEC 完了条件6「Node と Worker が同じ contract」に反する）。

---

## 4. P1以降に回すべき仕様

- **sensitive 抑制の Node/Worker 非対称**。native は `isSensitivePolicySuppression`（`display_suppression_reason === 'sensitive_precheck_failed'`）で `records: null` まで抑制するが、`platform_v2/src/services/placeAtlasProfile.ts` の `fieldPolicySuppression` は editorial セクションのみ抑制し公開 record は出す。本番は Worker 経路のため即時漏洩ではないが、`index.ts` の `fallbackRoutePattern` が place-profile を登録しており origin 経路が存在し得る。挙動を厳しい側（native）に揃えるべき。
- **media URL が任意 https を許可**。`placeAtlasContract.ts` `safeMediaUrl` は host allowlist を持たず全 `https://` を通す。SPEC 8.7「same-origin/public media path または許可済み HTTPS のみ」に対し実装は「許可済み」を満たさない。snapshot テーブルは内部由来で当面低リスクだが allowlist 化を推奨。
- **Overpass の本番到達性**。`placeAtlasProfileNative.ts` `DEFAULT_OVERPASS_URL = https://overpass-api.de/...`。CF Workers からの公開 Overpass はクラウド IP 遮断・レート制限を受けやすく、`resolveOsmPlace` 失敗 → 404 が常態化し得る。`OVERPASS_API_URL` を本番で明示設定（secret ではなく plain 環境変数）し、到達性を staging で実測すること。
- **memories の echoNote が per-entry visibility に非依存**。`loadUnlockedMemories` は `photo_echo_visibility='hidden_by_user'` でも `echoNote` を出す。unlock 済み閲覧者限定とはいえ、note 単体の可視性ポリシーを1つ確認。
- **キャッシュ断片化**。匿名 `public, max-age=60` + `Vary: Cookie`（Node）/`vary: cookie, authorization`（Worker）は cookie 値ごとにキャッシュ分裂。機能上は安全側だが CDN 効率は低い。
- **SPEC のクエリ表記が snake_case、実 UI は camelCase**（`fieldId`/`osmType`/`cellId`）。`normalizePlaceAtlasRef` が両対応のため動作はするが、SPEC.md「Place Atlas 参照」節を実装に合わせ更新。

---

## 5. 最終推奨

**Block（本番リリースは P0-1・P0-2 解消まで保留）。**

MVP/staging の常磐公園デモ経路は correctness・privacy・UX ともに完成度が高く、設計（versioned Read Model、Record dedupe、stale-guard、座標非露出）は承認水準です。しかし本 API は全 field/OSM area/public cell に公開されるため、
- P0-1 により 100〜256 セル規模の場所で本番が 503、
- P0-2 により cell 選択が本番 Worker で 404 になり得る、

という「常磐以外で壊れる」欠陥が残っており、production gate としては通せません。この2点（いずれも DB migration や secret 変更を要さず、チャンク化と cell-id 形式統一のコード修正のみで対応可）を修正し、100〜256 セル領域と実マップ cell-id 形式の回帰テストを追加した上で、staging exact-SHA で再検証すれば **approve with changes** に移行可能です。ロールバックは DB 変更が無くコード戻しのみで旧 area-snapshot UI に復帰できる点は妥当で、リリース設計自体に異論はありません。
