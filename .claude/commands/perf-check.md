---
description: パフォーマンスボトルネック検出
---

# /perf-check — パフォーマンス検査

ikimon.life の PHP コードでパフォーマンス上の問題を検出する。

## チェック項目

### JSON ストレージ
- パーティションファイル (YYYY-MM.json) の全件読み込み箇所
- `DataStore::fetchAll()` 結果のフィルタリング効率
- 大規模データの `json_decode` / `json_encode` コスト

### N+1 パターン
- ループ内での `DataStore::get()` / `DataStore::fetchAll()` 呼び出し
- ループ内での `SiteManager::load()` 呼び出し
- ループ内での外部 API (GBIF等) 呼び出し

### フロントエンド
- 画像の WebP 変換・リサイズ状況
- Tailwind CSS CDN のパフォーマンス影響
- MapLibre GL JS の初期ロードコスト
- Alpine.js の `x-init` での重い処理

### API レスポンス
- 不要なフィールドの返却
- ページネーション未実装の一覧 API
- キャッシュヘッダーの設定状況

## 出力
各問題を影響度 (High/Medium/Low) で分類し、改善案を提示。
