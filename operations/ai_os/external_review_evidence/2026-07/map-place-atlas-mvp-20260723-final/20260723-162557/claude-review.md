以下、パッチ本文のみを対象に、既存行を引用して独立審査しました（画像添付はなく、`evidence/README.md` がPNGを参照しているのみでバイナリはパッチに含まれないため、コード・contractの静的検証で判定しています）。

---

## 1. 採用すべき点

- **Record/Occurrence分離が正しい。** Worker native の `sourceRecords()` が `recordId: row.visit_id` でdedupeし、`richerRecord()` の `identificationRisk`（`ai_candidate: 3`, `confirmed: 0`）で「より未確定側」に丸めるため、同一Recordの複数Occurrenceを重複計上せず、AI候補を確定種へ昇格させない。テスト `field atlas intersects public snapshots ... counts Records once`（recordCount=3、record-1 が `ai_candidate`）で担保。
- **公開閾値k-anonymityが両経路で強制。** `publicPolicyMinimum()`＝`Math.max(3, …)`、public_cell/OSMは `minimumPublicRecords: 3`。contract側 `belowThreshold` で `recordCount=null`・`recentRecords=[]`・`representativeMedia=[]` に落ちる（`distinguishes unknown counts, verified zero, and threshold suppression` で担保）。null/0/suppressedの区別も明確。
- **本番Worker runtimeでのCTA抑制が機能。** `contributionRestricted = fieldType(field) === "school" || sensitiveSuppression` と `osmSuppressedSections()`（school + `["private","no","customers","permit"]`）で学校・私有地・センシティブを抑制。`field atlas suppresses direct contribution for schools` / `generic OSM schools suppress direct contribution` で担保。
- **D1 bind数が100未満。** `MAX_QUERY_BINDINGS = 80`、snapshotは `bind(SNAPSHOT_KEY, ...chunk, perChunkLimit)` で最大82。`medium OSM geometry ... every((count) => count <= 82)` で担保。
- **正準Web Mercatorセル互換。** `resolvePublicCellScope()` が `cell:`/decimal/`parsePublicCellId`（grid）を受理。`public cell atlas accepts the canonical Web Mercator grid cell id`（`1000:15404:4159`）で担保。
- **OSM scope有界化。** `publicCellsForBbox()` が `MAX_SCOPE_CELLS`(256)超で `null`→`loadSnapshotRows` が空集合返却。`oversized OSM geometry does not fall back to an unbounded global snapshot scan`（recordCount=null）で担保。
- **multipolygon holes除外。** `osmGeometry()` の inner ring割当と `pointInPolygon()` の穴判定（`if (pointInRing(...rings[index])) return false`）。`OSM relation inner rings stay excluded` / `polygon holes stay excluded`(点(5,5)=false) で担保。
- **media URL allowlist。** contract `safeMediaUrl()` が `/`（`//`除外）または `ikimon.life`/`*.ikimon.life` https のみ。`rejects unsafe media URLs` で `javascript:`・`//evil`・`https://cdn.example` を排除。UI `atlasSafeImageUrl()` も同等 + `/derived-transform/` 変換。native の緩い `safeSnapshotPhoto` も contract再検証で二重防御。
- **Place Memory可視性。** `loadUnlockedMemories()` の unlock gate（`SELECT EXISTS ... user_id=? AND cell_id=?`）+ `EXISTS(...public_visibility='public')` + `NOT EXISTS(place_memory_hidden_entries)`。`Place Memory excludes hidden entries and memories attached to private Records` で厳密担保。未ログイン(`viewerUserId` null)は空。
- **stale-response保護。** `requestPlaceAtlasForSelection` の `var seq = ++placeAtlasSeq;` / `if (seq !== placeAtlasSeq) return;` / `placeAtlasRefKey(...) !== refKey` / `payload.profile.version !== 1` / `AbortController` + 8秒timeout。
- **@media・アクセシビリティ。** `@media (min-width: 1280px)` `@media (max-width: 900px)` `@media (prefers-reduced-motion: reduce)` は正当な構文。loading `aria-live="polite"`、error `role="status"`、`.me-bottom-close { width:44px; height:44px }`、actions `min-height:46px`、`:focus-visible`。
- **ロールバック安全。** マイグレーション・secret追加なし。読取のみ、`isMissingOptionalTable()` で欠損テーブルを安全劣化。code rollbackのみで旧area-snapshot UIへ戻せる（PLAN「停止条件」/ SPEC「Rollout / rollback」）。

## 2. 重大な懸念

なし（再現可能な機能・privacy欠陥は検出できませんでした）。「field」locationModeが公開Recordをpolygon精度まで絞る点は懸念になり得ますが、`isPublicVisit()` で public のみ・かつ閾値3で保護されており、Recordの公開設定を超える露出はないため許容です。

## 3. P0で変更すべき仕様

なし。

## 4. P1以降に回すべき仕様（非ブロッキング）

- **P1-1: Node/Worker で `suppressedSections` のトークン語彙が不一致。** SPEC「NodeとCloudflare Workerが同じcontractを返す」に対し、形は同じだが値が異なる。
  - Worker: `placeAtlasProfileNative.ts` `...(contributionRestricted ? ["contribution_cta"] : [])`
  - Node: `placeAtlasProfile.ts` `... === "school" ? ["direct_record_cta"] : []` / `...(restricted ? ["direct_record_cta"] : [])`
  UIは両方を判定するため実害はないが、下流consumerのためトークン正規化を推奨。
- **P1-2: OSMアクセス制限値の集合が両経路で食い違う。**
  - Worker: `["private", "no", "customers", "permit"].includes(access)`（`restricted` 欠落）
  - Node: `["private", "no", "restricted"].includes(area.access)`（`customers`/`permit` 欠落）
  本番はWorker経路のため `access=restricted` のOSM areaでCTA抑制が漏れる。安全側に集合を統一。
- **P1-3: `contributorCountAllowed: false` が両経路で固定。** SPEC/Highlight契約は安全時のcontributor集計を許すが、常にnull。安全ではあるが機能未達として追跡。

## 5. 最終推奨

**APPROVE_WITH_NONBLOCKING_NOTES**

再現可能な失敗（BLOCK要件）は特定できず、correctness・privacy・Record/Occurrence semantics・本番Worker runtimeでのCTA抑制・D1 bind<100・Web Mercatorセル互換・OSM有界化・穴除外・media allowlist・Place Memory可視性・stale保護・@media・a11y・rollback・リリース安全（migration/secret変更なし）はいずれもパッチ内テストで担保されています。P1-1〜P1-3の contract トークン/アクセス集合の両runtime不一致のみ、後続で正規化することを条件に本番承認とします。
