以下、埋め込みパッチ（`record_place_memberships` による確定Record再利用）のみを対象にレビューしました。所在地プライバシーと同意の fail-closed を最優先に評価しています。なお、いくつかの指摘はスキーマ不変条件に依存するため、diff だけでは確定できない旨を明記します。

## 1. 採用すべき点

- **列衛生（location privacy）**: 確定メンバーシップ用クエリが `exact_lat / exact_lng / user_id` を一切 SELECT せず、`public_precision = 'place'` 固定・`cell_1000 = ''`・`photo_url = NULL` に落としている。テストで SQL 形状（`assert.doesNotMatch(/exact_lat|exact_lng|user_id/)`）と出力（`assert.doesNotMatch(JSON.stringify(profile), /exact_lat|exact_lng|user_id/)`）の両面を検証しており堅い。
- **除外オーバーフローの fail-closed**: `excludedMemberships.complete` が false のとき `geometryScoped = []` にしてジオメトリ・フォールバックを抑止し、`complete` に伝播して `recordCount = null` / `publication.status = "partial"` を返す。5,001 件テストで名称（スズメ/アジサイ/サクラ）の非露出まで確認済み。方向性が正しい。
- **Record vs Occurrence の重複排除**: `mergeRecord` が `visit_id` 単位で畳み込み、同一Record内の別Occurrence（`historic-1-b`）を落として `recordCount` を Record 数に一致（=5）させている。候補フラグ・awaiting・asset_count を `Math.max` で保守的に統合するのも良い。
- **候補リーク抑止**: メンバーシップ行は `0 AS is_ai_candidate` 固定。マージも max なので候補フラグは消えない（fail-closed 側）。
- **堅牢性**: パラメータ束縛、`LIMIT n+1` によるオーバーフロー検知、`Promise.all` 並列化、optional-table の `isMissingOptionalTable` フォールバック、`record_place_memberships` の provenance 明示（透明性）。

## 2. 重大な懸念

- **同意判定が NOT EXISTS 型で fail-open になり得る**（最重要）: 確定クエリの同意ゲートが「`observation_data_rights` に失格行が**存在しない**こと」で通す設計。`observation_data_rights` に行が**無い**Record は無条件で公開に載る。`public_visibility='public'` が常に active な同意行の存在を含意するなら安全だが、そうでなければ「同意記録の無いRecordが公開Atlasに露出」する。ここは fail-closed（正の同意の EXISTS を要求）が原則。
- **統合後 500 件超の暗黙ドロップ**: `snapshot`・`membership`・`excluded` は各々個別 LIMIT で `complete` を出すが、`geometryScoped ∪ membership.confirmed` の **和集合が 500 を超える**と `.slice(0, 500)` で切り捨てるのに `complete` は各ソース true のまま true になり得る。結果 `recordCount` を「正確な 500」として過少報告（partial にならない）。人気Placeで現実的に起こる。

## 3. P0 で変更すべき仕様

- diff 単体で確定できる P0 は無し。ただし上記「同意 NOT EXISTS fail-open」は、**`public_visibility='public'` が active 同意行の存在を保証しない**ことがスキーマ上判明した時点で即 P0（公開前の同意欠落露出）。その場合は `NOT EXISTS(失格)` を `EXISTS(active かつ record_consent IN (...))` に反転すること。ステージング投入前にこの不変条件の確認を必須とする。

## 4. P1 以降で回すべき仕様

- **P1**: 統合オーバーフローの完全性伝播。`rowsByRecord.size > MAX_SNAPSHOT_ROWS` なら `complete = false` にして partial に落とす（暗黙の Record 欠落＋過少カウントの是正）。
- **P1**: 同意ゲートを EXISTS（正の同意）方式へ寄せる方針の確定（P0 化しない場合でもフォローとして残す）。
- **P2**: `asset_count` サブクエリの `production_import_evidence_assets` が `isMissingOptionalTable` の catch 対象に入っていない。同テーブルが optional なら欠落時にプロファイル全体が throw する。catch 対象へ追加を。
- **P2**: 除外セットを `membership.confirmed` に適用していない。`(place_id, record_id)` に対し「confirmed 行」と「removed 行」が同時に存在し得る場合、除外リストに載っていても confirmed 経由で復活する。`record_place_memberships` の `(place_id, record_id)` 一意性を確認、非一意なら confirmed 側にも除外フィルタを適用（defense-in-depth）。
- **P2**: `observed_at` をフル精度タイムスタンプで露出（時間的プライバシー）。既存 snapshot と一貫だが、`place` 粒度Recordでは日付丸め等の検討余地あり。

## 5. 最終推奨

**staging-block: 条件付きで NO（＝ブロックしない）。** テスト済みの除外 fail-closed・列衛生・Record 重複排除は本番投入に足る品質。ただし投入は次の 1 点確認を前提とする —「`public_visibility='public'` の Record は必ず active な `observation_data_rights` を伴う」不変条件がスキーマ／書き込み経路で保証されていること。**保証されない場合は §3 に従い staging-block: YES（同意ゲートの ExISTS 反転が先）** に切り替えてください。P1 2 件（統合オーバーフロー完全性、同意方式）は同一スプリント内のフォローで可。

> 注記: §2・§3 の同意判定と §4 の `(place_id, record_id)` 一意性は、埋め込み diff の範囲外のスキーマ不変条件に依存する評価であり、当該テーブル定義／書き込み経路の確認で確定します。
