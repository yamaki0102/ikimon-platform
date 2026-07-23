# Place Atlas MVP — PR 1419 第2次防衛リリースゲート レビュー

対象パッチ（作業成果物）を全文精読しました。以下、指定形式で報告します。所見は推測せず、パッチ本文の該当箇所に基づいて記述します。

---

## 1. 採用すべき点

- **Record/Occurrence の分離が一貫**。`public_map_snapshot_records_v1` の複数 `occurrence_id` を `visit_id`(=Record) で dedupe し、`richerRecord` で「いずれかが AI 候補なら Record 全体を `ai_candidate` 扱い」に倒す設計（`placeAtlasContract.ts` の `dedupePlaceAtlasRecords`/`richerRecord`）は、AI 候補を確定種に昇格させない要件を満たしている。テスト `field atlas ... counts Records once` / `keeps AI candidates provisional` で担保。
- **D1 bind 上限（100）を確実に下回る**。`MAX_QUERY_BINDINGS = 80`、snapshot は `bind(SNAPSHOT_KEY, ...chunk(≤80), perChunkLimit)` で最大 82 に固定（`placeAtlasProfileNative.ts:loadSnapshotRows`）。`medium OSM geometry chunks ...` テストが `count <= 82` かつ複数チャンクを検証。前回想定ブロッカーの一つが閉じている。
- **無制限グローバルスキャンの遮断**。`publicCellsForBbox` が `MAX_SCOPE_CELLS(256)` 超過で `null` を返し、`loadSnapshotRows(null)` が空集合＋`complete:false` を返すため、巨大 OSM ポリゴンで `recordCount:null`（`oversized OSM geometry ...` テスト）。前回ブロッカー解消を確認。
- **OSM マルチポリゴンの穴（inner ring）除外**が正しい。`pointInPolygon` が outer 内かつ全 inner 外のみ true。`pointInPlaceAtlasGeometry`(2,2)=true /(5,5 穴内)=false テスト、relation 987656 の recordCount 0 テストで担保。
- **メディア URL 許可リストの最終ゲートが contract 側にある**。native adapter が https を緩く通しても、`safeMediaUrl`（`/`始まりの非`//` か `ikimon.life`/`*.ikimon.life` のみ）で再フィルタ。`rejects unsafe media URLs` テストが `cdn.example` を落とし `media.ikimon.life` のみ通す。レンダラも `atlasSafeImageUrl` で二重化。
- **Place Memory の可視性**。公開 visit 由来かつ `place_memory_hidden_entries` 非該当のみ返す SQL（`loadUnlockedMemories`）と、private Record 由来・閲覧者非表示を除外する `excludes hidden entries and memories attached to private Records` テスト。
- **stale-response 制御**が堅い。`placeAtlasSeq` の単調増加 + `AbortController` + 8s タイムアウト + 応答適用前の refKey 再照合（`mapExplorer.ts:requestPlaceAtlasForSelection`）。テストで seq/abort/version 検証済み。
- **privacy 出力の健全性**。`doesNotMatch(JSON.stringify(profile), /exact_lat|exact_lng|user-.../)` を各 adapter テストで実施。contributor は全 adapter で `contributorCountAllowed:false` により常に `null`。exact 座標・GeoJSON を profile API が受け取らない ref 正規化（`normalizePlaceAtlasRef`）も `kind:'point'` を拒否。
- **アクセシビリティ/UX**。loading=`aria-live=polite`、error=`role=status`、close/grip を 44px 化（`.me-bottom-close` を 44×44）、`:focus-visible`・`prefers-reduced-motion` 対応。E2E がタッチ標的 ≥44px と横スクロール ≤1px を検証。

---

## 2. 重大な懸念

**（BLOCK に至る再現失敗は検出できませんでした。）** 以下は本番安全性に関わるが、パッチ内テストとして再現失敗を確定できないため BLOCK 根拠にはしません。

- **Node と Worker の contract 分岐（本番は Worker native）**。両者は `PlaceAtlasProfile` 型こそ共有するが、`suppressedSections` の語彙が実装ごとに異なる。特に **学校 field の記録 CTA 抑制**が Node にはあるが Worker native の field 経路には無い：
  - Node: `placeAtlasProfile.ts:buildFieldProfile` が `((field.adminLevel||field.source)==='school') → 'direct_record_cta'` を付与。
  - Worker native: `placeAtlasProfileNative.ts:loadFieldPlaceAtlasProfile` の `suppressedSections` は `field_profile_narrative` と sensitive 系のみで、学校 CTA 抑制が無い。
  - レンダラ `renderAtlasActions` は `contribution_cta`/`direct_record_cta` のいずれかで primary CTA を隠す。したがって**本番（Worker）では学校 field に「この場所で記録する」CTA が出続ける**。SPEC「学校・私有地は安全案内を強める」と非対称で、Node が意図的に抑制している挙動に本番が追随していない。
  - native 側に学校 field の suppression テストが無く、私の手元で Worker を実行できないため「再現失敗」として確定できず、P1 として扱う（§4）。QA 開始地点が常磐公園（park）のため MVP デモでは顕在化しない見込み。

---

## 3. P0 で変更すべき仕様

**なし。** 列挙観点（privacy/security、Record vs Occurrence、field 抑制、D1 bind、Web Mercator public-cell、OSM 穴、media 許可、Place Memory、stale 制御、a11y、rollback）について、パッチ本文から再現するブロッカーは確認できませんでした。前回ブロッカー（bind 上限・無制限スキャン・穴・grid cell 互換・memory 可視性・stale 制御・44px）は各テストで閉じています。

---

## 4. P1 以降に回すべき仕様

1. **Node/Worker の `suppressedSections` 語彙統一と学校 CTA 抑制の本番反映（最優先）**。`placeAtlasProfileNative.ts:loadFieldPlaceAtlasProfile` に学校（`source/admin_level==='school'`）・`access` 制限時の `contribution_cta`（または `direct_record_cta`）付与を追加し、native に学校 field テストを新設。両実装の suppressedSections を共有定数化することを推奨。park 限定 QA を越えて field 全体へ広げる前に閉じるべき。
2. **`/derived-transform/w{360,680}/...` 変換エンドポイントの実在確認**。`mapPlaceAtlasProfile.ts:atlasSafeImageUrl` が `/derived/` を書き換える。未提供なら hero/facet/record 画像が 404→`onerror` で図版のみ非表示（フォールバックは健全）だが、代表写真が常に消える回帰になりうる。ルート存在を release smoke で確認。
3. **public_cell 経路の cell 形式差**。Node は `cellId` を素通しで `getMapObservations` に渡し、Worker は grid `1000:x:y` を bbox→小数セルへ変換して `cell_1000 IN (...)`。同一 cell に対する集計範囲が runtime 間で微差を生む可能性。件数一致を staging で突き合わせる。
4. **public_cell 経路の visit-visibility 再チェック不在**。field/osm は `isPublicVisit` で二重防御するが、public_cell は snapshot 純度に依存（設計通り）。snapshot 整合の前提を明記し、監視項目に残す。
5. **sensitive 抑制時も記録 CTA が出る**。sensitive_precheck_failed でも `renderAtlasActions` は `contribution_cta` 不在のため primary CTA を表示。座標露出は無いが、希少種周辺での記録誘導を避けるなら sensitive 時の CTA 抑制を検討。

---

## 5. 最終推奨

## APPROVE_WITH_NONBLOCKING_NOTES

理由：列挙された全観点（特に privacy の中核＝exact 座標非返却・private/hidden 除外・contributor 抑制・sensitive 抑制・field 公開 profile 抑制）は Node/Worker 双方で担保され、前回ブロッカー（D1 bind 上限、無制限スキャン、OSM 穴、Web Mercator grid cell 互換、Place Memory 可視性、stale-response 制御、44px タッチ標的）はいずれも対応テスト付きで閉じています。パッチ本文から**再現可能な失敗を確定できず**、BLOCK 根拠（正確な file:line ＋再現失敗）を満たしません。DB migration・secret 変更も不要（本 MVP 方針通り）。

ただし §2/§4-1 の **Node↔Worker parity（本番 Worker の学校 CTA 抑制欠落）** は、park 限定 QA を越えて field 全体へ本番展開する前に必ず解消してください。rollback は DB 変更が無くコード revert のみで旧 area-snapshot UI へ戻せる点も確認済みです。
