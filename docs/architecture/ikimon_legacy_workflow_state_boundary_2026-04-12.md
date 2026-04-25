# ikimon Legacy Workflow State Boundary

更新日: 2026-04-12  
目的: `canonical に入れるべき観察意味データ` と `legacy JSON に残す workflow state` を分ける。  
Gate 3 で importer / ledger を作る前に、`何を運ぶか` を固定するための文書。

---

## 1. 結論

canonical に入れるのは、`100年後も観察意味として読む値` だけ。  
canonical に入れないのは、`現行 PHP の運用フローを回すための状態` だけ。

言い換えるとこう。

- `meaning state` → canonical
- `workflow state` → legacy JSON のまま

---

## 2. Canonical に入れるもの

### 2.1 Observation meaning

- `observed_at`
- `lat / lng`
- `coordinate_accuracy`
- `taxon / scientific_name / vernacular_name / taxon_rank`
- `individual_count`
- `data_quality`
- `location_granularity`
- `photos / audio などの evidence`

### 2.2 Place / condition meaning

- `biome`
- `cultivation`
- `organism_origin`
- `managed_context.type`
- `managed_context.site_name`
- `note` のうち locality / condition を説明する部分

### 2.3 Review meaning

- identification append
- consensus による tier/data_quality 変化
- accepted metadata change により観察意味が変わった結果

---

## 3. Legacy JSON に残す workflow state

### 3.1 Metadata proposal workflow

保存先:

- observation 内 `metadata_proposals[]`

含まれる状態:

- `proposal id`
- `status: pending / accepted / rejected`
- `actor_id / actor_name / actor_role`
- `supporters[]`
- `resolved_at / resolved_by / resolution_note`
- `needed_people / needed_weight` の計算前提

理由:

- これは「観察そのもの」ではなく `現行 UI の合意形成フロー`
- canonical に同じ構造を持ち込むと、v2 で workflow を作り直す自由を失う

扱い:

- `direct`
- `accept`
- `auto_accepted`
だけ canonical に反映する

### 3.2 Edit / moderation history

保存先:

- observation 内 `edit_log[]`
- proposal の `changes`

理由:

- いまの JSON edit log は UI 向けの差分履歴
- canonical 側では `audit_log` があるので、完全複写は不要

扱い:

- importer は `edit_log` を canonical 主系へ移さない
- 必要なら archive として legacy snapshot に残す

### 3.3 UI / queue state

保存先:

- `ai_requeued`
- `ObservationRecalcQueue`
- `AiAssessmentQueue`
- proposal support の中間集計

理由:

- 再計算や審査キューは実行状態であり、観察意味ではない
- cutover 後は v2 runtime で再定義すべき

### 3.4 Denormalized feed convenience state

例:

- observation 内 `user_name`
- observation 内 `user_avatar`
- 一部 counts cache
- 一部 feed 用フラグ

理由:

- 表示都合の複製値
- canonical primary state ではない

---

## 4. Current implementation boundary

2026-04-12 時点で、コード上の境界はこう。

- [update_observation.php](/E:/Projects/Playground/upload_package/public_html/api/update_observation.php)
  - meaning state を canonical sync
- [post_identification.php](/E:/Projects/Playground/upload_package/public_html/api/post_identification.php)
  - identification meaning を canonical sync
- [propose_observation_metadata.php](/E:/Projects/Playground/upload_package/public_html/api/propose_observation_metadata.php)
  - `mode=direct` の時だけ canonical sync
- [review_observation_metadata.php](/E:/Projects/Playground/upload_package/public_html/api/review_observation_metadata.php)
  - `action=accept` の時だけ canonical sync
- [support_observation_metadata.php](/E:/Projects/Playground/upload_package/public_html/api/support_observation_metadata.php)
  - `auto_accepted` の時だけ canonical sync

つまり、

- `proposal pending`
- `proposal rejected`
- `supporter bookkeeping`
- `edit_log`

は intentional に JSON only。

---

## 5. Gate 3 に持ち込むルール

importer / ledger は次を守る。

### 5.1 Import するもの

- observation meaning state
- accepted metadata の結果状態
- identification history
- evidence
- privacy
- place condition

### 5.2 Import しないもの

- `metadata_proposals` の workflow 自体
- `edit_log`
- queue 実行状態
- `ai_requeued`
- denormalized convenience fields

### 5.3 別保全するもの

- legacy JSON snapshot
- audit / rollback 用 archive

---

## 6. Importer skeleton に必要な ledger 項目

最低限これだけ要る。

- `entity_type`
  - `observation_meaning`
  - `identification`
  - `evidence`
  - `place_condition`
- `legacy_observation_id`
- `canonical_occurrence_id`
- `canonical_event_id`
- `imported_at`
- `import_version`
- `source_checksum`
- `skipped_reason`
  - `workflow_only`
  - `test_residue`
  - `missing_required_fields`

---

## 7. 禁止事項

- `metadata_proposals` をそのまま canonical schema に移す
- `edit_log` を domain truth として importer する
- queue state を parity 対象に数える
- denormalized user fields を canonical 正本として扱う

---

## 8. 次に接続する文書

- [ikimon_canonical_contract_table_2026-04-12.md](/E:/Projects/Playground/docs/architecture/ikimon_canonical_contract_table_2026-04-12.md)
- [ikimon_canonical_enforcement_surface_map_2026-04-12.md](/E:/Projects/Playground/docs/architecture/ikimon_canonical_enforcement_surface_map_2026-04-12.md)
- [ikimon_v2_cutover_readiness_checklist_2026-04-12.md](/E:/Projects/Playground/docs/architecture/ikimon_v2_cutover_readiness_checklist_2026-04-12.md)

この境界を固定してから、Gate 3 の importer / ledger skeleton に入る。
