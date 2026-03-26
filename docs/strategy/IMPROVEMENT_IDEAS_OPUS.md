# ikimon.life 改善提案 — Opus 4.6 フィールドテスト分析

> **作成**: 2026-03-21 Claude Opus 4.6
> **ベース**: Phase 6 PoC 初日のフィールドテスト（若林町周辺、夜間）
> **対象**: Codex による拡張・批判・新規提案のインプット

---

## 実装済みアーキテクチャ（前提知識）

```
ikimon.life
├── 📷 投稿 (post.php) → Gemini Vision → フィード + Canonical Schema
├── 🚶 ウォーク (walk.php) → BirdNET on VPS → フィード + Canonical Schema
├── 📡 ライブスキャン (field_scan.php)
│   ├── 徒歩モード: カメラ2秒 + 音声3秒 + GPS + 撮影ボタン
│   ├── 自転車モード: カメラ3秒 + 音声3秒 + GPS
│   └── 車モード: カメラ5秒 + GPS（音声OFF）
│   → Canonical Schema のみ（フィードには活動サマリーだけ）
├── 🌍 ライブマップ (livemap.php) → 公開・ログイン不要
│   ├── ヒートマップ + ポイントマーカー
│   ├── 網羅度グリッド（100m セル）
│   └── サイト境界 + 🚻トイレ
├── Canonical Schema (SQLite 7テーブル)
│   └── events / occurrences / evidence / identifications / privacy_access / live_detections / audit_log
└── BirdNET-Analyzer (VPS FastAPI, 6,522種, CPU推論)
```

---

## Opus の10提案（要約）

### 1. 不在データ（Absence Data）の記録
検出ゼロのウォーク/スキャンも調査データとして保存。「30分歩いて鳥ゼロ」は科学的に価値がある。

### 2. 音声スペクトログラムの自動生成
BirdNET 検出の3秒音声からスペクトログラム画像を生成し、証拠写真の代替にする。レビュアーが視覚的に確認可能に。

### 3. カメラ×マイクのクロスモーダル検証
同時刻にカメラとBirdNETが同じ種を検出 → 確信度を大幅ブースト。どの市民科学アプリも未実装。

### 4. 歩行速度 = ハビタット指標
GPS speed データから「人が減速する場所 = 生態学的に豊かな場所」を推定。コストゼロの環境指標。

### 5. 音風景生態学（Soundscape Ecology）
Biophony / Anthrophony / Geophony 比率を FFT データから自動計算。BirdNET 不要で「自然度スコア」を算出。

### 6. 全フレームを学習データとして保存
Gemini API へのリクエスト/レスポンスペアを保存 → 将来のオンデバイスモデル訓練データに。

### 7. 「いつ行けば会える」予測
時刻 × 気温 × 湿度 × 種 の相関から、種ごとの出現確率を予測。天気 API は組み込み済み。

### 8. 調査努力量の正規化（最重要技術課題）
`種数 ÷ 調査時間` で正規化しないと「人が多い場所 = 生物多様性が高い」という嘘のマップになる。

### 9. ハビタット連続性マッピング
スキャンルート沿いの植生/コンクリートパターンから、グリーンコリドーの断絶ポイントを自動特定。

### 10. 検出パターンから個体数推定
同種の検出回数・時間間隔・方向から N-mixture model で個体数を統計推定。

---

## フィールドテストで判明した技術的問題

| 問題 | 原因 | 対応状況 |
|------|------|---------|
| CSP が inline JS をブロック | meta.php が nonce 付き CSP を送信 | nonce 追加 + addEventListener 化 |
| Alpine.js がページ全体を壊す | nav.php 等との競合、x-show/x-cloak の問題 | walk.php / field_scan.php を vanilla JS に完全書き直し |
| BirdNET の感度が低い | min_conf=0.25 がデフォルト | 0.10 に変更済み |
| Gemini モデルが 404 | gemini-2.0-flash-lite 廃止 | gemini-3.1-flash-lite-preview に変更 |
| 人工物を生物として検出 | プロンプトが貪欲すぎた | 除外リスト追加（人間、レンガ、地面等） |
| 「雑草」という命名 | プロンプトに敬意ルールがなかった | 科・属・形態での命名を指示 |
| ウォークデータがフィードに出ない | index.php が写真必須でフィルタ | 音声検出・スキャンサマリーを許可 |
| passive_event.php が 500 | Auth::getUserId() が存在しない | Auth::user()['id'] に修正 |
| ユーザー名がゲスト扱い | user_name/user_avatar 未付与 | passive_event.php で付与 |

---

## 100年後視点で気をつけるべきポイント

1. **座標参照系の明示**: GPS は WGS84 だが、100年後に別の測地系が標準になる可能性。`geodetic_datum` フィールドは実装済みだが、全レコードに確実に記録すること。

2. **AIモデルのバージョニング**: BirdNET v2.4 と Gemini 3.1 の判定結果は、将来のモデルで再評価される。`detection_model` + `detection_model_hash` で再現性を担保。

3. **音声の非可逆圧縮**: WebM/Opus は不可逆圧縮。100年後に再分析したいとき、圧縮アーティファクトが問題になる可能性。重要な検出の原音は WAV で保存するオプションを検討。

4. **分類体系の変動**: 「シジュウカラ (Parus minor)」が将来「Poecile minor」に再分類される可能性。`taxon_concept_version` で分類体系のバージョンを記録（実装済み）。

5. **プライバシー法の変遷**: 音声データに会話が含まれる可能性。現在の個人情報保護法で合法でも、将来の法改正で問題になりうる。音声の自動匿名化（会話帯域フィルタ）を検討。

6. **データフォーマットの陳腐化**: SQLite + JSON は現在最も安定だが、100年後のソフトウェアで読める保証はない。定期的な DwC-A (CSV) エクスポートとテキスト形式でのバックアップが重要。

---

## 現在のデータフロー図

```
[ユーザーのスマホ]
    │
    ├── 📷 post.php ──────→ Gemini Vision API
    │                         ↓
    │                    DataStore (JSON) ←── フィード表示
    │                         ↓
    │                    Canonical Schema ←── ライブマップ
    │
    ├── 🚶 walk.php
    │   ├── 🎤 3秒音声 ──→ analyze_audio.php ──→ BirdNET (VPS :8100)
    │   ├── 📍 GPS ──────→ routePoints[]
    │   └── 🌤️ 天気 ─────→ Open-Meteo API
    │         ↓ (終了時)
    │     passive_event.php ──→ DataStore + Canonical Schema
    │
    ├── 📡 field_scan.php
    │   ├── 📷 2-5秒 ────→ scan_classify.php ──→ Gemini 3.1 Flash Lite
    │   ├── 🎤 3秒音声 ──→ analyze_audio.php ──→ BirdNET
    │   ├── 🌳 10秒環境 ─→ env_scan.php ──────→ Gemini 3.1 Flash Lite
    │   ├── 📸 撮影ボタン → quick_post.php ────→ DataStore (観察投稿)
    │   └── 検出ごと ────→ passive_event.php ──→ Canonical Schema のみ
    │         ↓ (終了時)
    │     scan_summary.php ──→ DataStore (活動サマリー1件)
    │
    └── 🌍 livemap.php ──→ map_observations.php ──→ Canonical Schema (読み取り)
```
