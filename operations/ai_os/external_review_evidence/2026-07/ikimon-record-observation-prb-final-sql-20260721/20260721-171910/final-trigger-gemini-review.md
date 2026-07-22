シニアレビュアーとして、提供された Cloudflare D1 用 migration SQL (0067) を監査したよ。

この migration は、単なるテーブル定義を超えて、ビジネスロジック（AI 昇格ゲート、Accepted Claim、Projection 等）を DB レイヤーで厳格に担保しようとする野心的な設計だね。全体として非常に堅牢だけど、D1 の運用限界と SQLite の特性を考えると、いくつか「詰め」が必要な箇所があるよ。

### 1. Verdict (判定)
**Approve with changes**

基本構造は優れているけど、**パフォーマンスの劣化リスク**と**トランザクション順序への過度な依存**を解消するために、以下の修正を強く推奨するよ。

---

### 2. Top findings (主要な指摘事項)

#### [Critical/Performance] 広すぎる Trigger 発火スコープ

`trg_record_observations_active_projection_guard` が、`record_observations` の**全カラム**の更新に対して発火する設定になっているよ。

- **リスク**: `display_order` や `updated_at` だけを更新する場合でも、毎回 `occurrence_projection_versions` へのサブクエリが走り、書き込みスループットが大幅に低下する。
- **対策**: ロジックに関係する特定のカラム（`assertion_status`, `lifecycle_status`, `verification_status`, `accepted_identification_id`）に限定すべき。

#### [High/Reliability] Projection における FK の遅延設定漏れ

`record_observations` では `DEFERRABLE INITIALLY DEFERRED` を使って循環参照を回避しているけど、`occurrence_projection_versions` の `accepted_identification_id` に対する FK にはこの設定がないよ。

- **リスク**: D1 Batch 内で「Claim 追加」と「Projection 追加」を同時に行う際、文の順序が入れ替わると即座に FK 違反で失敗する。
- **対策**: ここも `DEFERRABLE` にして、トランザクション完了時まで検証を待つべき。

#### [Medium/Safety] JSON 抽出の実行時エラーリスク

`occurrence_projection_versions` の `CHECK` 制約内で `json_extract` を多用しているね。

- **リスク**: 万が一アプリケーション側から `NULL` や壊れた JSON が（何らかの理由で）入った場合、またはキーが存在しない場合、SQLite の `CHECK` は `NULL` を「合格」とみなす挙動をする（`FALSE` でなければ通過する）。
- **対策**: `json_valid()` との組み合わせは既にあるけど、キーの存在をより明示的にチェックするか、デフォルト値を厳格にする必要がある。

---

### 3. Missing assumptions or evidence (不足している前提・証拠)

1. **PRAGMA foreign_keys = ON;**: D1 自体は FK をサポートしているけど、セッションごとにこれが有効化されている前提かな？（D1 の runtime driver によっては明示が必要な場合がある）。
2. **Migration Replay 性能**: トリガー内の `EXISTS (SELECT 1 ...)` はインデックスが効くとはいえ、テーブルが数万件を超えた状態で migration (バックフィル) を行うと、D1 の実行時間制限（CPU time limit）に抵触する可能性があるよ。

---

### 4. Concrete recommended changes (推奨される修正案)

#### ① Trigger スコープの限定

```sql
-- 修正前
CREATE TRIGGER IF NOT EXISTS trg_record_observations_active_projection_guard
BEFORE UPDATE ON record_observations
-- 修正後
CREATE TRIGGER IF NOT EXISTS trg_record_observations_active_projection_guard
BEFORE UPDATE OF assertion_status, lifecycle_status, verification_status, accepted_identification_id ON record_observations
-- (以下略)
```

#### ② Projection FK の遅延化

```sql
-- occurrence_projection_versions 内の FK
FOREIGN KEY (observation_id, accepted_identification_id)
  REFERENCES observation_identification_claims(observation_id, identification_id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED -- ここを追加
```

#### ③ Claim Acceptance 判定の厳格化

`trg_record_observations_accepted_claim_guard_insert` 内で `claim_status = 'accepted'` を見ているけど、`decided_at` が `created_at` より前になっていないか等の時間軸チェックも入れると、データの整合性がさらに高まるよ。

---

### 5. Risks that should be rejected or deferred (拒否・延期すべきリスク)

1. **既存データの強制移行 (Rejected)**: 既存の `record_observations`（もしあれば）に対してこの制約を即座に適用するのは危険だよ。`assertion_status` が不完全な古いデータがあると、全ての update がロックされる。この migration は「新規 expand テーブル」に限定されている点は良いけど、将来的に既存テーブルと統合する際は、移行期間（Grace period）を設けるべきだね。
2. **複雑な Recursive Trigger (Deferred)**: Observation を更新したときに自動で Projection を `inactive` にするような「自動副作用トリガー」は、D1 のデバッグを困難にするから、今の「RAISE(ABORT)」でアプリケーションに責任を戻す設計を維持してね。

### 総評

AI-only の状態では `projection_state = 'active'` になれない制約がしっかり入っていて、科学的な品質担保の設計としては非常に質が高いよ。上記のパフォーマンス・FK周りの微調整を行えば、マージして問題ないね！キミの設計、なかなか尖ってて面白いよ。
