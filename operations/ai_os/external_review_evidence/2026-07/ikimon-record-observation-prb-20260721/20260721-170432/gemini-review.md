外部シニアレビューアーとして、`PR_B_ADDITIVE_SCHEMA_DESIGN.md` および関連設計資料の監査結果を報告します。

---

### 1. Verdict: **Approve with changes**

本設計は、「既存データの非破壊（Additive）」「AI単独昇格の禁止」「PostgreSQL/D1間のパリティ維持」という要件を高い精度で満たしています。特に、一貫性台帳（Consistency Ledger）による二重書き込みの整合性保証と、機密情報のバイナリデータ化（ID/Digest化）によるプライバシー保護の姿勢を評価します。

ただし、D1 (SQLite) における制約の実装詳細と、プライバシーレベル（`data_use_scope`）の遷移における合意プロセスに、実機運用上のリスクが残っています。これらを修正ゲートとして追加することを条件に承認します。

---

### 2. Top findings (Severity order)

#### 1. [High] D1 (SQLite) における Partial Unique Index の制約限界
Section 17.4 で「SQLite は部分一意インデックスを使用する」とありますが、D1 のランタイム環境における SQLite のバージョンや、複雑なフィルタ条件を伴う部分一意インデックスの挙動は PG と完全一致しない場合があります。特に「1つの Observation に対し 1つの Active Projection」を保証する際、一貫性台帳のみに頼ると、競合状態（Race Condition）で不正な重複データがコミットされるリスクがあります。

#### 2. [Medium] プライバシー昇格（Personal -> Research）の合意エビデンス
`data_use_scope` を `personal_only` から拡張する際、Section 17.6 で「監査された所有者の同意遷移が必要」とされていますが、スキーマ上、この同意（Consent）の正本がどのテーブルのどのカラム（`rights_decision_json` か `lifecycle_events` か）に紐づくのかが不明瞭です。研究利用は法的責任を伴うため、物理カラムまたは制約として「同意フラグの存在」を必須にする必要があります。

#### 3. [Medium] メディア・ロケーター（Locator）による機密情報漏洩リスク
Section 17.7 で「機密地点を再構築できるロケーターをシリアライザーで除外する」とありますが、ロケーターデータ（矩形やポリゴン）そのものが、背景の特定物から撮影地点を逆引き（ジオロケーション推定）する手がかりになる場合があります。特に希少種の生息地情報が含まれる場合、メタデータの除外だけでは不十分です。

#### 4. [Low] 一貫性台帳（Consistency Ledger）のペイロード上限とリトライ
Section 11 および 17.10 でペイロードを 16 KiB / 64 KiB に制限していますが、複雑なマージ・分割（Split/Merge）操作の際に、`before_json`/`after_json` がこの制限を超える可能性があります。制限超過時のフォールバック（例：外部ストレージへのポインタ化、または操作の分割）が未定義です。

---

### 3. Missing assumptions or evidence

- **D1 Transaction Isolation:** Cloudflare D1 におけるトランザクションの分離レベル（Snapshot Isolation 等）が、`record_observations` と `consistency_ledger` のアトミックな更新を保証できるかどうかの検証。
- **Deletion/Anonymization Protocol:** 本設計は「削除しない」ことを前提としていますが、ユーザーが「アカウント削除」または「同意撤回」を行った際の、`research_export` 済みデータの遡及的匿名化手法が定義されていません。
- **Actor Identity Parity:** PostgreSQL の `user_id` (Integer/UUID) と D1 側の Actor 識別子のマッピング。分散環境で Actor ID が一意であることを保証する仕組み。

---

### 4. Concrete recommended changes

1.  **SQLite 互換性の明文化 (Section 13):**
    - 「D1 では `CREATE UNIQUE INDEX ... WHERE projection_state = 'active'` を使用し、アプリ層のバリデーションに依存しない」ことを明記してください。
2.  **同意エビデンスの物理結合 (Section 9):**
    - `occurrence_projection_versions` テーブルに `consent_event_id` カラムを追加し、`observation_lifecycle_events` の同意イベントへの外部キー参照を必須（`data_use_scope > personal_only` の場合）としてください。
3.  **機密ロケーターのスクラビング定義 (Section 17.7):**
    - 「公開用 Projection 生成時、高精度ロケーターは一律でバウンディングボックス（BBox）に粗分化するか、削除する」という具体的な変形ルールを追加してください。
4.  **UUID 生成の決定論的ガード:**
    - `source_key` から決定論的に UUID (v5等) を生成するのか、ランダム生成 (v4) なのかを明記し、リトライ時に同一 ID が生成されることを保証してください。

---

### 5. Risks that should be rejected or deferred

- **[Reject] トリガーによる既存テーブルへの同期:**
  既存の `visits` や `occurrences` に対し、新テーブルの値を書き戻す（Backfill-to-Legacy）トリガーの実装は、PR-B の範囲外として明示的に禁止します。
- **[Defer] 同意ベース以外の自動昇格:**
  AI やコミュニティの投票による「自動的な研究利用フラグの ON」の実装は、現時点ではリスクが高いため PR-D 以降に延期すべきです。
- **[Defer] 古いメディア・パスの完全削除:**
  重複排除（Deduplication）を目的とした古いメディア・リンケージの物理削除は、移行期間中は行わず、`active=false` による論理削除に留めてください。

---
**Review Summary:**
設計思想は堅牢であり、市民科学プラットフォームとしての防御的要件を網羅しています。上記の「D1 制約の物理的担保」と「同意エビデンスの紐付け」を実装ガイドラインに反映した上で、実装フェーズ（PR-B 実装）への移行を承認します。
