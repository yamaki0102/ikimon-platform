## 1. 判定 (Verdict)
**approve with changes**

本パケットで提示された実装は、プライバシー保護および権利撤回の反映において極めて堅牢な「fail-closed」アプローチを採用しており、ステージング環境への適用は妥当である。ただし、D1のクエリパフォーマンスおよび移行ロジックの同意根拠に関して、以下の修正・確認を求める。

## 2. 主要な指摘事項 (Top findings)

### P1: D1 クエリパフォーマンスとタイムアウトのリスク
除外リスト（exclusion query）において、最大5,000件のRecord IDを対象に `observation_data_rights` と `production_import_visits` をJOINする設計は、Cloudflare WorkerのCPU時間制限およびD1のクエリ実行制限に抵触する可能性がある。
- **詳細**: 特にインデックスが不十分な場合、またはコールドスタート時のレイテンシにおいて、ジオメトリフォールバックを完全に抑制する「不完全な除外セット」判定が頻発し、ユーザー体験を損なう恐れがある。

### P1: 移行スクリプト `0069` における同意の正当性
`public_visibility = 'public'` であるインポートデータを一律に `public_summary` 権利エンベロープに変換しているが、元データのインポート時のライセンス（例：CC-BY-NC等）が現在の `public_summary` 定義と完全に合致しているかの再検証が必要。
- **詳細**: `external_export` を許可しない設計は評価できるが、将来的に権利範囲を拡張する際の「負の遺産」にならないよう、ソースごとの権利属性（provenance-marked）を厳密に記録すべきである。

### P2: AI由来判定（Provenance）のヒューリスティックによる誤検知
`quality_grade` が `research_grade` または `verified` 以外をすべて `ai_candidate` とマークする手法は、安全性（fail-closed）の観点では正しいが、人間が同定した未検証データ（Needs ID）を「AI候補」と偽陽性判定する。
- **詳細**: ステージングでは許容されるが、ユーザーに「AIが間違えた」と誤解させるリスクがある。ラベル名を `unverified_or_ai_candidate` 等、より実態に近いものに検討する余地がある。

## 3. 不足している前提条件・エビデンス (Missing assumptions or evidence)
- **D1 EXPLAIN 実行計画**: 5,000件規模の除外クエリがJOINを含めてD1の計算コスト予算（10ms〜50ms）内に収まることを示すデータ。
- **権利撤回レースコンディションの具体的な期間**: スナップショット `public_map_snapshot_records_v1` が更新されるまでのラグの想定値と、除外リストによる抑制が機能する実効時間。

## 4. 具体的な推奨変更 (Concrete recommended changes)
- **[P1対策]** 除外リストのバッチ処理または、特定Place IDに関連するRecordのみをJOIN対象にする最適化の徹底。
- **[P1対策]** 移行スクリプト `0069` において、`observation_data_rights` 挿入時に `source_identity` (例: 'legacy_import_gbif') をメタデータとして付与し、後から同意根拠を追跡可能にする。
- **[P2対策]** `ai_candidate` フラグのフロントエンド表示において、`quality_grade` 由来であることを区別できる内部プロパティ（例：`provenance_reason: 'low_quality_grade'`）の追加。

## 5. 却下または延期すべきリスク (Risks that should be rejected or deferred)
- **Occurrenceレベルの権利管理**: 本設計で示された「Visit/Record単位の権利管理（PK: `visit_id`）」はスキーマの整合性を維持するために不可欠である。Occurrence単位での独立した撤回要求は、データモデルを複雑化させ整合性を破壊するため、本フェーズでは却下すべきである。
- **座標・ユーザーIDの露出**: デバッグ目的であっても、ステージング環境でこれらを出力する変更は、本パケットの守秘義務違反に当たるため、一切の提案を却下する。

## ステージング展開の可否
**Staging-block: NO** (パフォーマンス計測を目的とした展開を推奨する)
