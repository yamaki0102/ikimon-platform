# 審査結果レポート (Review Report)

- **対象コミット**: `02d77f558c39452dd69b676578b3cc36758cae2a`
- **判定 (Verdict)**: **承認 (Approve)**
- **Staging Block**: **No (ステージング移行をブロックする要因なし)**

---

## 質問に対する回答 (Answers to Specific Questions)

### 1. プライベート、同意撤回、候補、削除済み、または内部専用レコードが漏洩する可能性はあるか？
**ありません。**
- **プライベート/同意撤回レコード**: `loadPlaceMembershipRows` にて `COALESCE(v.public_visibility, 'private') = 'public'` かつ `observation_data_rights` の有効な同意ステータス（`withdrawal_status = 'active'` かつ `record_consent IN ('public_summary', 'external_export')`）を厳格に要求しています。ジオメトリフォールバック時も `loadVisitLocations` で同様のライブジョインとチェックが行われます。
- **候補/削除済みレコード**: メンバーシップの有効条件として `m.membership_state = 'confirmed'` かつ `m.removed_at IS NULL` を要求しています。この条件を満たさないレコードは `loadExcludedPlaceMembershipRecordIds` で除外リスト（`excludedMemberships.recordIds`）に集約され、`.has(row.visit_id)` チェックによってマージ処理から完全に排除されます。
- **内部専用データ (座標・個人情報)**: 最終的な出力スキーマを構築する `sourceRecords` では、ユーザー識別子（`user_id`）や正確な緯度経度（`exact_lat`, `exact_lng`）を一切含めず、メッシュ（1000mセル）またはパブリック識別子のみを露出するため、リーク経路はありません。

### 2. 単一レコード内に複数の出現 (Occurrence) がある場合、公開レコード数が水増しされるか？
**されません。**
- `buildRecordsForGeometry` 内で、レコードIDである `row.visit_id` をキーとする `rowsByRecord: Map<string, PublicSnapshotRow>` を用いてユニークマージを行っています。
- 同一レコード内の複数出現は `mergeRecord` 関数内で最も厳格な同定ステータスに集約され、1つのレコードエントリとして統合されます。
- 500件の上限（`MAX_SNAPSHOT_ROWS`）はこのマージ後のユニークレコード数に対して適用されるため、カウントの水増しやバッファ消費の偏りは発生しません。

### 3. ジオメトリフォールバックにより、候補レコードや削除済みレコードが再混入する可能性はあるか？
**ありません。**
- ジオメトリフォールバック処理（`geometryScoped`）のループにおいて、プレースに関連付けられた除外メンバーシップレコード ID（`excludedMemberships.recordIds`）に該当するものはすべて除外されます。
- 万が一除外判定クエリが上限（`5,000` 件）を超過してオーバーフローした場合、`excludedMemberships.complete` が `false` となり、ジオメトリフォールバックそのものが完全に抑制されます（`geometryScoped` を `[]` に設定）。これにより、不完全な除外リストによる漏洩を徹底的に防いでいます。

### 4. オプションテーブルのフォールバックは、プライバシー保護の観点から十分に Fail-Closed（安全側に倒れる）か？
**極めて十分に Fail-Closed です。**
- プライバシー保護の根幹を担うテーブル（`production_import_visits` または `observation_data_rights`）が消失している場合、`loadExcludedPlaceMembershipRecordIds` 内の例外キャッチにより `complete: false` とマークされ、ジオメトリフォールバックは完全に抑制されて出力は 0 件になります。
- メンバーシップ管理の `record_place_memberships` テーブルのみが欠落している場合のみ、通常のジオメトリフォールバックへ移行します。その際も、`loadVisitLocations` 内で `production_import_visits` と `observation_data_rights` に対するライブセキュリティゲートが直接実行されるため、無認可レコードが露出することはありません。

### 5. 500行の上限値および部分状態 (Partial) の挙動は誠実か？
**誠実です。**
- 全体的なデータ整合性の検証結果は、 snapshot・membership・excludedMemberships 各クエリの `complete` フラグ、およびマージ後の `mergedComplete` の論理積（AND）で算出されます。
- いずれかのリミットを超過、あるいはエラーによる部分出力となった場合は、プロファイル全体の公開ステータスが明示的に `publication.status = 'partial'` になり、さらに合計カウント（`summary.recordCount`）は誤解を避けるため `null` に設定されます。不完全なデータを完全なものとして提示しない設計となっており、非常に誠実です。

### 6. 実装によって許容できない D1 遅延やクエリファンアウトが発生するか？
**発生しません。**
- メインのプレース検索および除外インデックス走査は、カエナリ環境でそれぞれ `0.330 ms` および `0.288 ms` というサブミリ秒の極めて高速な実行時間を実証しています。
- 関連レコード情報（ロケーション、写真、テーマ）の取得は `MAX_QUERY_BINDINGS = 80` でチャンク化され、並行処理されます。500件制限に対して最大でも `ceil(500/80) = 7` 回のインデックス主キーによるバインドクエリに限定されており、SQLite/D1 のバインド変数上限エラーを回避しつつ、低遅延を維持しています。

### 7. ステージング移行をブロックすべき P0/P1 バグは存在するか？
**存在しません。**
- 設計、境界値のバリデーション、Fail-Closedなエラー処理、テストコードによる網羅性、および非破壊的な移行スクリプト（`0069_place_atlas_legacy_import_public_rights.sql` の `INSERT OR IGNORE` 構造）のすべてが極めて高い完成度を示しています。

---

## 検出事項 (Top Findings by Severity)

### P0 / P1: 重大な問題
- **該当なし** (ゼロリーク、例外防御、境界値制限が完全に実装されています)。

### P2: 軽微な懸念・推奨の指摘
1. **除外リスト上限（5,000件）到達時のジオメトリフォールバック全面抑制に伴う可用性の影響**:
   - 同意撤回や無効メンバーシップが5,000件を超える極端なプレースにおいて、ジオメトリフォールバックが完全抑制されて部分プロファイル（空データ）になります。
   - **評価**: これはプライバシー安全性を最優先した正しいトレードオフ（Fail-Closed）であり、実装を変更する必要はありませんが、監視やデータ管理上の運用仕様として認識しておくべきです。

2. **D1データベースにおける各種インデックスの維持**:
   - `loadPlaceMembershipRows` と `loadExcludedPlaceMembershipRecordIds` は `m.place_id`, `m.record_id`, `v.visit_id`, `o.visit_id` のジョインに大きく依存しています。
   - **評価**: テストおよび検証においてクエリプランが最適化されていることを確認済み（0.3ms未満）ですが、本番・ステージングDB側でこれらのカラムに対するインデックス（特に `record_place_memberships(place_id)` と `production_import_occurrences(visit_id)`）が確実に維持されている必要があります。

---

## 不足している前提条件またはエビデンス (Missing Assumptions/Evidence)

- **特になし**:
  - `observation_data_rights.visit_id` がテーブルの主キー（`visit_id TEXT PRIMARY KEY`）であるというスキーマ上の不変条件、および Occurrence レベルではなく Record/Visit レベルでの権利管理が設計前提であることをコードレベルで確認しました。

---

## 具体的な推奨変更内容 (Concrete Recommended Changes)

- **なし**: 現行の実装は、テスト網羅性、データ完全性、および機密性のバランスが完璧にとれており、これ以上の修正は不要です。

---

## 却下または保留すべきリスク (Risks to be Rejected or Deferred)

- **却下すべき提案 (極めて重要)**:
  1. **公開件数制限（500件）や除外リスト制限（5,000件）の緩和要求**:
     - Cloudflare Worker のメモリ制約（CPU時間制限）やD1のペイロード制限、さらには過度なファンアウトの発生原因となるため、これらの上限値緩和を求めてはいけません。
  2. **Occurrenceレベルでの個別同意管理機能の追加**:
     - 既存の `observation_data_rights` スキーマの主キー制約（`visit_id PRIMARY KEY`）に直接反し、重大なDB再設計リスクを招くため、これらをロードパス内でアドホックに解決しようとする要求は却下すべきです。
  3. **部分表示（Partial）時における概算レコードカウントの返却**:
     - 概算値を出すために追加の `COUNT(*)` クエリを発行することは、D1リソースを浪費するだけでなく、開示を制限したレコード数に関する情報漏洩リスク（サイドチャネル）に繋がるため、行うべきではありません。
