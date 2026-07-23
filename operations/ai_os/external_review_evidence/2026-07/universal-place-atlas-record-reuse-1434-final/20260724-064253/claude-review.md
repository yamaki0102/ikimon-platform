以下、対象 SHA `a1841c38` の埋め込み差分のみに基づく防御的（プライバシー／可用性）レビューです。ファイル参照・ツール呼び出しは行っていません。

## 1. 採用すべき点

- **移行 0069 は完全にフェイルクローズド**: `INSERT OR IGNORE` で明示的既存権利が常に優先、`public_visibility = 'public'` の legacy のみ対象。`record_consent='public_summary'` 以外は `research/enterprise='none'`、`dataset/media_license=NULL`、`external_export_allowed=0`。テストで `UPDATE|DELETE|DROP|TRUNCATE` 不在・withdrawn 行の不改変を検証済み。エクスポート／データセット／メディア権は一切付与しない。
- **実行時クエリの権利ゲートが堅牢**: `COALESCE(v.public_visibility,'private')='public'`（既定 private）、`EXISTS(observation_data_rights … withdrawal_status='active' AND record_consent IN ('public_summary','external_export'))`。権利行が無い／withdrawn／private は EXISTS 不成立で確実に除外。`external_export` は `public_summary` の上位集合なので公開表示可否として正しい。
- **秘匿列を投影しない**: 射影に `exact_lat/exact_lng/user_id` なし、`photo_url` は NULL 固定。テストが `doesNotMatch /exact_lat|exact_lng|user_id/` を保証。
- **Record 単位のデデュープが正しい**: `rowsByRecord`（key=`visit_id`）で 1 Occurrence/行を Record 単位に集約し、`asset_count` は max、observed_at で primary 選択。同一 Record 内の別 Occurrence が recordCount を水増ししないことをテストで実証（recordCount=5、別 Occurrence 非表示）。
- **オーバーフロー時の partial 化と geometry フォールバック抑止**: `membership`/`excluded`/`merged` の各 complete を AND して `complete` を決定 → 超過時 `recordCount=null`／`publication.status='partial'` を返し、プロファイル自体は可用。特に**除外集合が不完全（>5000）なら geometry 由来行を丸ごと捨てる**（`excludedMemberships.complete && visits.size>0` ガード）のは除去済み Record 漏洩に対する正しいフェイルクローズド。
- **クエリ境界と劣化耐性**: 両クエリとも `LIMIT MAX+1` で完了判定、4 テーブルの `isMissingOptionalTable` を握って空・available=false に劣化（可用性維持）。provenance へ `record_place_memberships` を条件付き付与。

## 2. 重大な懸念

P0 相当（staging を止める）に達する privacy 漏洩・可用性破綻は**検出せず**。以下は P1／P2。

## 3. P0 で変更すべき仕様

- **なし。**

## 4. P1 以降に回すべき仕様

**P1**
1. **`is_ai_candidate` を 0 ハードコードしている点（候補フェイルクローズドの穴）**: 射影で全 Occurrence を `0 AS is_ai_candidate` としているため、`production_import_occurrences` に未確定（AI 候補）同定行が含まれる場合、名前付き場所に「確定種」として提示されうる。プライバシー漏洩ではない（既に public_visibility+public_summary の公開データ）が、レビュー要件「candidate fail-closed」に直接抵触。Occurrence レベルの同定ステータス列があれば gate すること。無いなら「確定メンバーシップの公開 Record の全 Occurrence を表示安全」とみなす根拠を明文化。→ staging はブロックしないが GA 前に解消推奨。
2. **除外集合の過剰抑止（可用性）**: `SELECT DISTINCT record_id … WHERE state<>'confirmed' OR removed_at IS NOT NULL` は、同一 (place, record) に確定行と削除行が併存する場合、確定 Record まで両経路から除外する。`record_place_memberships` が (place, record) 1:1 であることを確認するか、共存する confirmed 行を考慮した除外に修正。フェイルクローズド側なので P1 に留める。

**P2**
1. **`asset_count` 相関サブクエリの D1 コスト**: 出力候補行ごとに `production_import_evidence_assets` を走査。a1841c38 の Record 索引が `(visit_id, asset_role)` を実際にカバーし、500 行上限内で有界であることを確認。
2. **`loadPhotoUrls` の consent 検証**: membership 経路は photo_url=NULL 初期化後に visit_id/occurrence_id で `loadPhotoUrls` を呼ぶ。同関数自身が非公開アセットを返さないことを別途保証（本差分外だが要確認）。
3. **移行の consent 推定根拠**: `"basis":"preexisting_public_visibility"` で public_summary 再利用同意を推定。プロダクト／法務の承認記録が残っていること。
4. **タイブレークの経路差**: JS 側マージソートは observed_at 同値で 0（挿入順）＝ geometry 優先、SQL は `observed_at DESC, occurrence_id ASC`。表示順が僅かに非一致。無害だが統一が望ましい。

## 5. 最終推奨

**Staging ブロック: NO（承認）。**

移行・実行時クエリともプライバシーはフェイルクローズド（既定 private、active 権利必須、withdrawn/removed/candidate-membership 除外、秘匿列非投影、no-export）、Record 単位デデュープと union/exclusion オーバーフローの partial 化・geometry 抑止が可用性を維持したまま正しく機能しており、テストで裏取りされています。P0 なし。P1（候補ハードコード検証・除外過剰抑止）は staging 後・GA 前に解消してください。
