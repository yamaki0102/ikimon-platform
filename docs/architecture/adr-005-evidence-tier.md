# ADR-005: Evidence Tier データモデル

## ステータス

**Accepted** — 2026-03-21

## コンテキスト

ikimon.life は写真投稿、ウォーク（音声）、ライブスキャン（音声+映像）の3つの観察モードを持つ。
各モードで生成されるデータの「証拠の強さ」は異なる。
既存の DataQuality (A/B/C/D) は写真投稿に最適化されており、音声やマルチモーダルデータの品質を十分に表現できない。

## 決定

**全観察モード共通の Evidence Tier (1 → 1.5 → 2 → 3 → 4) を導入する。**

### Tier 定義

| Tier | 条件 | 例 |
|------|------|-----|
| **1** | AI単独判定（音声 or 画像） | BirdNET 検出、Gemini Vision 判定 |
| **1.5** | AI高確信度 + 生態学的妥当性（地域×季節）→ 自動昇格 | BirdNET 92% + 地域×季節マッチ |
| **2** | コミュニティ検証（1名の reviewer が確認） | 音声を聴いて「シジュウカラで合っている」 |
| **3** | 合意形成（2名以上の合意、または専門家1名） | Research Grade 相当 |
| **4** | 外部監査（DNA、標本、学術引用） | DNA バーコーディング結果 |

### DataQuality (A/B/C/D) との関係

Evidence Tier と DataQuality は **並行して存在** する。

- **DataQuality**: 既存の写真ベース品質。互換性維持のため変更しない
- **Evidence Tier**: 全モード横断の証拠品質。新規フィールドとして追加

```
DataQuality A ≈ Evidence Tier 3 (Research Grade)
DataQuality B ≈ Evidence Tier 1.5-2
DataQuality C ≈ Evidence Tier 1
DataQuality D = 証拠不十分
```

### Tier 1 → 1.5 自動昇格条件

以下の **全て** を満たす場合に自動昇格:

1. AI 確信度 ≥ 0.80
2. 地域に当該種の過去の記録あり（500m圏内、過去3年）
3. 季節的に妥当（繁殖期・越冬期などの活動パターンと一致）

### 複合証拠によるTier評価

同一イベント内で複数のエビデンスがある場合:
- 音声 + 写真 → Tier 2 スタートもありえる（複合証拠）
- 同種が5回以上検出 → 統計的に Tier 1.5

## 影響

- `occurrences` テーブルに `evidence_tier`, `evidence_tier_at`, `evidence_tier_by` を追加
- `EvidenceTierPromoter.php` クラスを新規作成（自動昇格ロジック）
- `TierPromotionWorkflow.php` クラスを新規作成（レビュー→昇格フロー）
- DwC-A Export は Tier 2 以上のみ公開をデフォルトとする
- 既存の DataQuality.php は変更しない

## 参照

- ADR-001: Canonical Schema
- ADR-002: 100年耐久設計
- DEVELOPMENT_PLAN.md: Phase 6 PoC
