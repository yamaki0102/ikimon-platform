### 1. Verdict (判定)
**Verdict**: approve with changes
**Staging Block**: yes

---

### 2. Top findings ordered by severity (最優先指摘事項)

#### 【P0】個別の Occurrence レベルの同意撤回・プライバシー設定のバイパスリスク (Privacy / Compliance)
- **詳細**: `loadPlaceMembershipRows` の SQL クエリにおいて、`observation_data_rights` の `EXISTS` 条件が `rights.visit_id = v.visit_id` のみで結合されています。
- **影響**: 同一の Record (Visit) 内に複数の Occurrence が存在し、ユーザーが特定の Occurrence に対してのみ明示的な同意撤回（`withdrawal_status = 'withdrawn'`）やプライバシー制限を行っていた場合、Visit レベルの別レコードに引きずられて、撤回済みの Occurrence がマップやプロファイル上に露出してしまう深刻なプライバシー漏洩リスクがあります。

#### 【P1】`is_ai_candidate` のハードコード（`0 AS is_ai_candidate`）による AI 候補検知の不具合 (Correctness / Quality)
- **詳細**: `loadPlaceMembershipRows` 内のプロジェクションで `0 AS is_ai_candidate` と固定値が設定されています。
- **影響**: インポートされた `production_import_occurrences` 側に AI 候補フラグ（`is_ai_candidate` 等）が存在する場合、その状態を無視して全て人間が同定したレコードとして扱ってしまいます。これにより、不正確な自動同定データが「確認済み」として一般公開される恐れがあります。

#### 【P2】`COALESCE` を用いたソートによる D1 クエリパフォーマンスの低下 (Performance)
- **詳細**: クエリ末尾の `ORDER BY COALESCE(v.observed_at, o.created_at, '') DESC` は、SQLite / Cloudflare D1 においてインデックス走査（Index Scan）を無効化し、メモリ上での一時テーブルソート（Filesort）を強制します。
- **影響**: 特定の `place_id` に属する確認済みメンバーシップ数が多い場合、リクエストのたびに高負荷なソートが発生し、D1 データベースの CPU スパイクやタイムアウトを引き起こす懸念があります。

---

### 3. Missing assumptions or evidence (不足している前提・エビデンス)
- **Occurrence レベルのオプトアウトの挙動定義**:
  同一 visit 内の特定 occurrence がオプトアウトされた際に、レコード全体を非表示にするのか、該当 occurrence のみを除外して他を維持するのかの設計要件が不明確です。
- **`record_place_memberships` インデックス構成のエビデンス**:
  `place_id`、`public_precision`、`membership_state`、`removed_at` に対する適切な複合インデックスがスキーマ側に定義されているかどうかのエビデンスが不足しています。これがない場合、`loadPlaceMembershipRows` 自体がフルテーブルスキャンになります。

---

### 4. Concrete recommended changes (具体的な推奨改善内容)

#### P0 に対する修正案:
`loadPlaceMembershipRows` の `EXISTS` 句を修正し、個別の Occurrence レベルでの撤回状況を正確に評価するようにします。

```sql
        WHERE m.place_id = ?
          AND m.public_precision = 'place'
          AND m.membership_state = 'confirmed'
          AND m.removed_at IS NULL
          AND COALESCE(v.public_visibility, 'private') = 'public'
          -- Visit/Record レベルまたは該当 Occurrence レベルでアクティブな同意があることを担保
          AND EXISTS (
            SELECT 1
              FROM observation_data_rights rights
             WHERE rights.visit_id = v.visit_id
               AND (rights.occurrence_id IS NULL OR rights.occurrence_id = o.occurrence_id)
               AND rights.withdrawal_status = 'active'
               AND rights.record_consent IN (
                 'public_summary',
                 'external_export'
               )
          )
          -- 該当 Occurrence レベルで明示的な撤回(withdrawn)が存在しないことを担保 (Fail-Closed)
          AND NOT EXISTS (
            SELECT 1
              FROM observation_data_rights rights
             WHERE rights.visit_id = v.visit_id
               AND rights.occurrence_id = o.occurrence_id
               AND rights.withdrawal_status = 'withdrawn'
          )
```

#### P1 に対する修正案:
`production_import_occurrences` の実際のカラムを参照するようにマッピングを修正します。

```sql
              -- 0 AS is_ai_candidate,
              COALESCE(o.is_ai_candidate, 0) AS is_ai_candidate,
```

#### P2 に対する修正案:
`v.observed_at` のみを基準にソート可能なよう、データ投入時に `observed_at` が NULL にならないようバックfill、または `v.observed_at` にインデックスを付与した上で以下のように並び替えます。

```sql
        ORDER BY v.observed_at DESC, o.occurrence_id ASC
```

---

### 5. Risks that should be rejected or deferred (却下・延期すべきリスク)
- **外部エクスポート権限（`external_export_allowed = 1`）の一括付与**:
  プレイスアトラスでのデータ再利用にあたり、レガシーインポートデータに対してユーザーの個別同意なしに外部データセットやメディアライセンス、外部エクスポート許可（`external_export_allowed`）を付与するようなマイグレーション変更の導入は、プライバシーポリシー違反を招くため完全に却下すべきです（今回のマイグレーション `0069` で `external_export_allowed = 0` / `NULL` 制限を厳格に維持している点は極めて適切です）。
