# ADR-001: Canonical Observation Schema

**ステータス**: 承認
**日付**: 2026-03-19
**影響範囲**: 全データ永続化層

## 背景

現在の観察データは JSON ファイルに50+フィールドで保存されているが、schema_version, provenance, taxon_concept_version, location_uncertainty_m が欠落している。100年後の再解釈が保証されない。

## 決定

### 観測イベントの最小スキーマ（v1.0）

```yaml
observation_event:
  # 識別
  stable_id: UUIDv4            # 不変。外部参照に使う
  schema_version: "1.0"        # このスキーマのバージョン

  # 時間
  observed_at: ISO8601          # 観察日時（観察者申告）
  recorded_at: ISO8601          # システム記録日時

  # 観察者
  observer_id: UUIDv4
  source_device: string         # "iPhone 13 Pro" / "Pixel 10 Pro" / "web" / "Eagle"

  # 位置（不確実性付き）
  location:
    lat: float
    lng: float
    alt: float?
    crs: "EPSG:4979"           # 座標参照系を明記
    horizontal_uncertainty_m: float  # 必須
    vertical_uncertainty_m: float?
    geometry_version_id: UUIDv4?     # Eagle スキャンの空間基盤バージョン

  # 分類（concept 追跡可能）
  taxon:
    taxon_id: integer?          # GBIF backbone key（あれば）
    taxon_name: string          # 和名
    scientific_name: string     # 学名
    taxon_concept_version: string  # "GBIF Backbone 2026-03" 等
    rank: string                # species / genus / family 等

  # 証拠
  evidence:
    media_refs: string[]        # 写真パス
    audio_snippet_hash: string? # 音声のハッシュ（音声自体は保存しない）

  # 検出方法
  detection:
    method: "human" | "ai_visual" | "ai_audio" | "sensor"
    model_id: string?           # "gemini-3.1-flash-lite" 等
    model_version: string?      # "observation_assessment_v3"
    confidence: float?          # 0.0 - 1.0

  # 処理段階
  processing:
    pipeline_version: string    # "ikimon_pipeline_v1.0"
    stage: "raw" | "validated" | "research_grade"
    verification_stage: string  # DataStageManager のステージ

  # 来歴
  provenance:
    created_by: string          # "user" / "passive_engine" / "import"
    created_at: ISO8601
    parent_event_id: UUIDv4?    # 派生元イベント

  # 権利
  license: "CC-BY" | "CC0" | "CC-BY-NC"
  consent_scope: "public" | "community" | "private"
```

### 保存戦略

| 層 | 性質 | 例 |
|---|---|---|
| **raw** | immutable、一度保存したら変更しない | 観測イベント、写真、音声ハッシュ |
| **derived** | raw から再生成可能 | organisms 集計、ヒートマップ、スコア |
| **archive** | 定期エクスポート、外部互換形式 | DwC-A、GeoPackage、KML |

### 移行パス

1. **現在**: 新規観察に schema_version, location_uncertainty_m, source_device を付与（済み）
2. **Phase 4**: PostgreSQL + PostGIS に canonical table を作成
3. **Phase 5**: 既存 JSON を PostgreSQL にバックフィル
4. **Phase 5完了後**: JSON は read-only アーカイブ化
