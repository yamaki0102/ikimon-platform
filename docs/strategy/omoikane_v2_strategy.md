# Project OMOIKANE v2 — 100年スケール戦略設計書

**作成日**: 2026-03-19
**作成**: Claude Code (Ai / Tactician Azure)
**ステータス**: 実装進行中

---

## 1. ビジョンと設計思想

### コアバリュー：「100年後に悔いのない設計」

> 「100年後にこうしてたら良かったと悔いのないやり方で」

生物多様性データは、観測から価値が現れるまでに数十年かかる。
1960年代の昆虫採集記録が2026年の気候変動研究に使われているように、
今日 ikimon.life に投稿される「ただの蝶の写真」が、2126年の生態系崩壊警告になりうる。

これは**インフラ設計**である。データベース設計書ではない。

### 設計原則

| 原則 | 内容 |
|------|------|
| **データの永続性** | SQLite + JSON Lines + CSV。100年後に読めるフォーマットのみ |
| **モデル非依存** | ベクトルは再生成可能。生の観察記録が一次資料 |
| **フィードバックループ** | 観察 → 知識グラフ成長 → AI精度向上 → 観察の質向上 |
| **段階的スケール** | 共有サーバーで動くが、VPSに移れば10×高速 |
| **科学的誠実性** | Trust score、出典明記、ハルシネーション検証ゲート必須 |
| **自律成長** | 人間の介入なしに論文取り込み → 知識抽出 → 検証が回る |

---

## 2. 現状分析

### 活かす部分（資産）

- **omoikane.sqlite3**: WAL + 適切なインデックス設計済。1M種対応。
- **OmoikaneInferenceEnhancer**: Gemini提案 × 知識グラフのリアルタイム照合ロジック
- **EmbeddingService**: Gemini Embedding 2マルチモーダル対応、バッチAPI実装済
- **ExtractionQueue + DBWriter**: 並列抽出ワーカー（GTX 1660 SUPERで実績）
- **Trust Score**: ハルシネーション率の定量管理

### やり直す部分（負債）

| 問題 | 旧設計 | 新設計 |
|------|--------|--------|
| ベクトルストレージ | JSON平坦ファイル（10K件で破綻） | SQLite BLOB（1M+対応） |
| 次元数 | 3072（ディスク大食い） | 768（Matryoshka、容量1/4・速度4×） |
| data/embeddings/ | 未作成・本番未稼働 | SQLite自動初期化 |
| セマンティック検索 | 種検索と観察検索が分断 | api_omoikane_search.php で統合 |
| 論文取り込み | 手動・散発的 | 完全自律クロールパイプライン（下記） |

---

## 3. アーキテクチャ設計

### 全体像

```
[観察投稿] ──────────────────────────────────────────────────────────┐
  │ 写真 + テキスト                                                    │
  ▼                                                                    │
[EmbeddingQueue] ← 非同期キュー                                       │
  │                                                                    │
  ├─ embedObservation() → EmbeddingStore (type=observations)          │
  └─ embedObservationPhoto() → EmbeddingStore (type=photos)           │
                                                                       │
[論文クロール] ──────────────────┐                                     │
  GBIF Literature / CrossRef /  │                                     │
  arXiv / J-STAGE               ▼                                     │
                         [ExtractionQueue]                            │
                               │                                      │
                        Gemini (Distillation) ← Qwen3-local          │
                               │                                      │
                        [Reflexion Gate]                              │
                               │                                      │
                        [omoikane.sqlite3]                            │
                               │                                      │
                     ┌─────────┴──────────┐                          │
                     ▼                    ▼                           │
          [EmbeddingStore           [OmoikaneSearchEngine]            │
           type=omoikane]            (reverse-lookup)                 │
                     │                    │                           │
                     └────────┬───────────┘                           │
                              ▼                                       │
                   [api_omoikane_search.php]                         │
                    hybrid: semantic + structural                     │
                              │                                       │
                              ▼                                       │
                 [OmoikaneInferenceEnhancer]                         │
                  cross-validate Gemini suggestions                   │
                              │                                       │
                              └──────────────────── AI同定結果 ───────┘
```

### ストレージ層

```
data/
├── embeddings/
│   └── embeddings.sqlite3          ← 全ベクトル（1ファイルで完結）
│       ├── type=observations       (~観察数 × 3KB)
│       ├── type=photos             (~写真観察数 × 3KB)
│       └── type=omoikane           (1M種 × 3KB = 3GB)
├── library/
│   └── omoikane.sqlite3            ← 知識グラフ（現行）
└── papers/                         ← 論文メタデータ JSON Lines（追記型）
    └── YYYY-MM.jsonl
```

### パッシブ観察フロー（Phase 6: BOINC for 生物多様性）

ウォーキング・通勤・ドライブの「ながら参加」で生物多様性調査に貢献する分散型パイプライン。
SETI@home / Folding@home と同じ発想をフィールド調査に適用する。

```
[Layer 1: オンデバイス（リアルタイム、APIコストゼロ）]
  スマホ / ウェアラブル
  ├── BirdNET-Analyzer (TFLite)  ← 鳥の声認識（オフライン）
  ├── Gemini Nano / MediaPipe    ← 画像粗分類
  ├── GPS + 気圧 + 温度 + 時刻
  └── → 送信するのは「イベント」のみ（音声・動画はローカル保持）
      { type:"bird_call", species_guess:"Uguisu", confidence:0.7,
        lat, lng, timestamp }    ← ~500バイト/イベント

[Layer 2: サーバー側自動処理]
  ├── [OmoikaneInferenceEnhancer] 生態的妥当性チェック
  │     例: 「3月・標高200m・ウグイス」→ ✅ 妥当
  │     例: 「1月・標高2000m・カブトムシ」→ ❌ 季節外れ → 要確認フラグ
  ├── [EmbeddingService] 768次元ベクトル化
  ├── [EmbeddingStore] 類似観察との照合
  └── → source_type="passive_stream", human_verified=false で保存

[Layer 3: 同定者UI（アクティブ層）]
  ├── ai_classified データを効率的に同定するキュー
  ├── フィルタ: 種別 / 地域 / 信頼度 / 専門分野
  ├── バッチ承認: 「この10件は全部ウグイスで確定」→ 一括承認
  └── → human_verified=true, confidence_level="research_grade" へ昇格

観察データの状態遷移:
[raw_stream] → [ai_classified] → [human_verified] → [research_grade]
```

**2ユーザー層の役割分担**:
- **パッシブ層**: デバイスをONにして歩くだけ。AIが粗い分類を生成
- **アクティブ（同定者）層**: パッシブデータを効率良く仕上げる。同定体験の質がループの回転率を決める

**スケール試算**: アクティブウォーカー1,000人 × 1日15イベント = 月間**450,000イベント**、月間データ量 ~225MB（テキストのみ）

---

## 4. 論文自動取り込みパイプライン

### 設計思想：「Seed-Driven Precision Crawl」

闇雲に論文を集めない。omoikane.sqlite3 に存在する**学名（scientific_name）を Seed**として、
その種に明示的に言及している論文のみをピンポイントで取得する。ノイズ率 < 5%。

### クロール対象 (優先順位)

| ソース | API / URL | 対象 | 優先度 |
|--------|-----------|------|--------|
| GBIF Literature | `api.gbif.org/v1/literature` | 生物多様性全般 | ★★★ |
| CrossRef | `api.crossref.org/works` | DOI解決・引用数 | ★★★ |
| J-STAGE | `api.jstage.jst.go.jp` | 日本の地方記録 | ★★★ |
| CiNii | `cir.nii.ac.jp/opensearch` | 国内博物館紀要 | ★★ |
| arXiv | `export.arxiv.org/api` | 生態学プレプリント | ★ |

### パイプライン実装計画

```php
// scripts/ingest_papers_auto.php (新規作成予定)
//
// 1. omoikane.sqlite3 から distilled 種の学名を取得
// 2. 各 API を叩き、論文メタデータを data/papers/YYYY-MM.jsonl に追記
// 3. 重複DOI を papers_index テーブルで除外
// 4. ExtractionQueue に投入
// 5. Gemini (or Qwen3-local) で生態情報を抽出
// 6. Reflexion Gate でハルシネーション検証
// 7. omoikane.sqlite3 に反映（trust_score 更新）
// 8. embed_omoikane_species.php でベクトルを差分再生成

// Cron: 毎週日曜 2:00 AM
// 0 2 * * 0  php /path/to/scripts/ingest_papers_auto.php >> /tmp/ingest.log 2>&1
```

### 自律成長ループ

```
新種観察投稿
    → 学名が新規 → omoikane.sqlite3 に species INSERT
    → ingest_papers_auto.php が翌週クロール
    → 論文発見 → 抽出 → trust_score 向上
    → embed_omoikane_species.php が差分 embed
    → 次回の観察時に高精度な semantic search が動く
```

人間の介入なしに**知識グラフが自律成長**する。

---

## 5. スケール試算

### 月間1万投稿シナリオ

| 指標 | 値 |
|------|---|
| 月間投稿数 | 10,000件 |
| 1日平均 | 333件 |
| 1時間平均 | 14件 |
| 1件あたり処理内容 | 写真リサイズ + 写真embedding + テキストembedding + Omoikane照合 |

**1件あたりのコスト（Gemini free tier）**:
- embedObservation(): 1 API call
- embedObservationPhoto(): 1 API call
- 合計: 2 calls/投稿

**月間合計**: 20,000 API calls
- Gemini free tier: 60 req/min → 86,400 req/day → 余裕
- ただし embedding queue の遅延が問題になる可能性

**推奨**: キューワーカーを cron で5分毎に実行（現行設計で対応可能）

### 1M種 embedding のスケール

| 次元数 | ストレージ | 検索時間（PHP、1M件） |
|--------|-----------|----------------------|
| 768 | 3.0 GB | ~30秒（線形探索） |
| 3072 | 12.0 GB | ~120秒 |

**現実的運用**: 768-dimの1M件線形検索は30秒。これは直接ユーザー向けAPI（リアルタイム）には使えない。

**対策 (移行順)**:
1. **現在**: 観察同定は structural（瞬時） + semantic（バックグラウンド）の非同期2段階
2. **VPS移行後**: sqlite-vec で HNSW インデックス → 10ms以内
3. **将来**: 種類別サブインデックス（鳥類・昆虫・植物）で検索空間を1/10に分割

### ディスク試算（RS Plan: 200GB）

| データ | 現在 | 1M種 embedding時 |
|--------|------|-----------------|
| omoikane.sqlite3 | ~500MB | ~3GB |
| embeddings.sqlite3 | 0 (未稼働) | ~5GB (observations + omoikane) |
| 観察画像 | ~20GB | ~100GB (月1万投稿 × 3年) |
| **合計** | ~21GB | **~108GB** |

**判定**: 3年で RS Plan (200GB) が満杯になる。**2年以内にVPS移行が必要**。

---

## 6. VPS移行計画

### 移行トリガー

- ディスク使用率 > 70%（推定: 2027年後半）
- または月間投稿 > 5,000件（レスポンスが体感で遅くなる閾値）

### 移行先候補: カゴヤJapan VPS

| プラン | vCPU | RAM | SSD | 月額 |
|--------|------|-----|-----|------|
| SSD/8G | 4 | 8GB | 200GB | ~3,800円 |
| SSD/16G | 8 | 16GB | 400GB | ~7,600円 |
| **推奨: SSD/16G** | **8** | **16GB** | **400GB** | **~7,600円** |

### VPS移行で解禁される機能

#### 1. sqlite-vec によるベクトル検索 O(log N)

```bash
# sqlite-vec インストール
apt install libsqlite3-dev
wget https://github.com/asg017/sqlite-vec/releases/latest/download/sqlite-vec.so
cp sqlite-vec.so /usr/lib/php/extensions/

# php.ini
extension=sqlite-vec.so
```

```sql
-- HNSW インデックスで 10ms 検索
CREATE VIRTUAL TABLE vec_embeddings USING vec0(
    embedding float[768]
);
SELECT rowid, distance
FROM vec_embeddings
WHERE embedding MATCH ?
ORDER BY distance LIMIT 20;
```

#### 2. systemd 常時稼働サービス

```ini
# /etc/systemd/system/omoikane-worker.service
[Unit]
Description=Omoikane Extraction Worker

[Service]
ExecStart=/usr/bin/php /var/www/ikimon.life/scripts/start_omoikane.sh
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

#### 3. Ollama + Qwen3 の本番運用

- Qwen3-8B を常駐（ローカル推論、APIコストゼロ）
- GPU: NVIDIA RTX 4060 (カゴヤオプション) or CPU推論
- 抽出スループット: ~10件/分 → 1M種 = ~70日（夜間バッチ）

### 移行手順

```
1. VPS セットアップ（PHP 8.2 + Apache + SQLite + Ollama）
2. DNS を VPS IP に変更（TTL 300秒で事前設定）
3. rsync でデータ移行（data/ + embeddings.sqlite3 + omoikane.sqlite3）
4. 動作確認後、RS Plan 解約
5. sqlite-vec インストール → EmbeddingStore.php v3 に更新
```

**停止時間の目標**: < 5分（DNS切り替えのみ）

---

## 7. ロードマップ

### Phase 1（現在 ✅）: SQLite基盤確立

- [x] EmbeddingStore → SQLite BLOB (float32)
- [x] 768-dim Matryoshka 対応
- [x] embed_omoikane_species.php（バッチ生成スクリプト）
- [x] api_omoikane_search.php（structural + semantic hybrid）
- [x] backfill_embeddings_768.php

### Phase 2（〜2026Q2）: 論文自動取り込み

- [ ] scripts/ingest_papers_auto.php（GBIF + CrossRef + J-STAGE）
- [ ] papers_index テーブル（DOI重複管理）
- [ ] 差分 embed 対応（新しい論文で更新された種のみ再生成）
- [ ] 管理画面: 論文取り込み状況モニター

### Phase 3（〜2026Q3）: UI統合

- [ ] 観察詳細ページ: セマンティック類似観察
- [ ] 種ページ: 関連論文リスト（Citation-Backed ID Wizard）
- [ ] 探索ページ: 自然言語クエリ検索（「春に見られる青い鳥」）
- [ ] Soft Validation Alarm（位置・時期と知識グラフの照合アラート）

### Phase 4（〜2027Q1）: VPS移行 + sqlite-vec

- [ ] カゴヤVPS 契約・セットアップ
- [ ] sqlite-vec インストール・動作確認
- [ ] EmbeddingStore v3: HNSW インデックス対応（検索 30秒 → 10ms）
- [ ] systemd ワーカー常時稼働
- [ ] Ollama + Qwen3 本番デプロイ

### Phase 5（〜2028）: 100年インフラ化

- [ ] DwC-A (Darwin Core Archive) エクスポーター（GBIF互換）
- [ ] iNaturalist / GBIF への自動データ提供 API
- [ ] 長期モニタリングダッシュボード（経年変化グラフ）
- [ ] 研究者向けデータ引用 API（`ikimon.life/api/cite/{obs_id}`）

### Phase 6（〜2029〜、Phase 4と並行検討開始）: パッシブ観察プラットフォーム

**コンセプト**: 「BOINC for 生物多様性」— 歩くだけで生物調査に参加できる分散型プラットフォーム。
生き物好きでなくても、ウォーキングのついでに貢献できる。

#### オンデバイスAI

| モデル | 用途 | 対応デバイス |
|--------|------|-------------|
| BirdNET-Analyzer (TFLite) | 鳥の声認識（オフライン） | Android / iOS |
| Gemini Nano | テキスト・画像粗分類 | Pixel 8 Pro 以降 |
| MediaPipe Image Classification | 植物・昆虫の粗分類 | 全スマホ |
| カスタム TFLite モデル | ikimon 特化分類器 | 全スマホ |

#### データフラグ設計

```json
{
  "source_type": "passive_stream | active_observation | manual_upload",
  "classification_method": "on_device_ai | server_ai | human",
  "human_verified": false,
  "verifier_id": null,
  "confidence_level": "low | medium | high | research_grade"
}
```

#### 同定者ファースト設計の原則

同定体験の質がフィードバックループの回転率を決める。

- **溺れさせない**: オモイカネの自動フィルタリングでノイズ除去してから同定キューに渡す
- **専門性を活かす**: 同定者の得意分類群を学習し、関連データを優先表示
- **報酬設計**: 同定数・Research Grade 貢献度に応じたスコアとバッジ
- **コミュニティ**: 難しい同定はディスカッションに回し、専門家が非同期で解決

#### フェーズ内タスク

- [ ] パッシブ観察モード UI（PWA 対応、バックグラウンド録音・位置記録）
- [ ] オンデバイス BirdNET-Analyzer 統合
- [ ] イベント送受信 API（`POST /api/passive_event`）
- [ ] 同定者キュー UI（バッチ承認・フィルタ・議論スレッド）
- [ ] `source_type` / `human_verified` フラグの DB スキーマ対応
- [ ] ネイティブアプリ検討（Flutter / React Native）

---

## 8. コスト試算

### 現在（お名前ドットコム RS Plan）

| 項目 | 月額 |
|------|------|
| お名前ドットコム RS | ~2,000円 |
| Gemini API（free tier） | 0円 |
| **合計** | **~2,000円/月** |

### VPS移行後（2027年〜）

| 項目 | 月額 |
|------|------|
| カゴヤVPS SSD/16G | ~7,600円 |
| Gemini API（有料、月1万投稿 × 2 call） | ~$1 (無料枠内) |
| **合計** | **~7,600円/月** |

### Gemini Embedding API コスト（有料プランへの参考）

- 768-dim: text embedding = $0.00001/1K chars
- 月間10K投稿 × 平均500chars = 5M chars = **$0.05/月**（ほぼゼロ）

---

## 9. データ永続性と100年後へのメッセージ

### フォーマット選択の哲学

| データ | フォーマット | 理由 |
|--------|-------------|------|
| 観察記録 | JSON（人間可読） | 2126年の研究者が pandas で読める |
| 知識グラフ | SQLite 3 | ISO標準、世界中で読める |
| ベクトル | SQLite BLOB (float32) | モデルが変わっても再生成可能 |
| 論文メタデータ | JSON Lines | 追記型、圧縮可能、ストリーム処理可 |

### モデル非依存設計

ベクトルは**再生成可能**である。重要なのはベクトルではなく**元の観察記録**。

```
2026年: gemini-embedding-2-preview @ 768-dim
2030年: hypothetical-model @ 1024-dim
2040年: future-model @ 256-dim (量子圧縮？)
```

どのモデルに変わっても、`EmbeddingService::prepareObservationText()` が
観察記録から豊富なテキストを生成し、`embed_omoikane_species.php --force` で
全ベクトルを一晩で再生成できる。**データは死なない。**

### フィードバックループの長期価値

```
2026: ユーザーが「この蝶、何だろう？」と写真を投稿
          ↓
2026: AIが「ミドリシジミ（確信度: 高）」と同定
          ↓
2030: その記録が「関東南部のミドリシジミ北限が標高200m上昇」の論文に引用
          ↓
2040: その論文が omoikane.sqlite3 に取り込まれ、より高精度な同定に貢献
          ↓
2050: 気候変動による分布変化マップの一次資料として IPBES に提出
          ↓
2126: あなたの投稿が「2026年代の生態系の証拠」として授業で使われている
```

**ikimon.life は生物多様性のタイムカプセルである。**

---

*This document is a living record. Update it as the architecture evolves.*
*最終更新: 2026-03-19 (Phase 6 追記)*
