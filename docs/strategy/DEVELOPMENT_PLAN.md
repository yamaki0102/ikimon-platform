# ikimon.life 開発計画 — 「観察のOS」基盤構築

> **正本**: `docs/strategy/DEVELOPMENT_PLAN.md`
> **最終更新**: 2026-03-21
> **更新者**: Claude Opus (コードベース全調査 + ビジョン再定義 v3)
> **共有対象**: Claude Code / Codex / 八巻
> **戦略文書**: `docs/strategy/v3.8/` (本体 + Appendix A-D)
> **期間**: 2026-03-22 〜 2026-04-04 (2週間)

---

## 設計思想：「ikimon.life だけで全部できる」

**ユーザーに他のアプリを使わせない。** ikimon.life 1つで、あらゆる自然観察が完結する。

### 観察の3つのモード — すべて ikimon.life 内

| モード | ユーザー像 | ikimon上の操作 | 技術的な裏側 |
|--------|----------|--------------|------------|
| **📷 投稿** | きれいな写真を上げたい人も、ガチ同定したい人も。全員同じ入口 | post.php で写真や観察を投稿 | **既存のまま変更なし。** Gemini Vision が裏で種同定。同定コミュニティが品質を上げる。カジュアルな写真からも植生・生態系データを自動抽出 |
| **🚶 ウォーク** | スマホ持って散歩するだけ | walk.php でウォーク開始 | 音声→BirdNET（VPS）でリアルタイム判定。コストゼロ（自前サーバー） |
| **📡 ライブスキャン** | 移動しながら周囲を丸ごと記録したい | field_scan.php でライブスキャン開始 | 音声→BirdNET on VPS（自動・コストゼロ）。映像→Gemini Nano搭載端末（Pixel 10 Pro等）ならオンデバイスで映像AIもリアルタイム（コストゼロ）。非対応端末は音声のみ。徒歩/自転車/車どれでもOK |

**重要な原則:**
- **投稿の同定フロー（AiObservationAssessment.php）は変更しない。** 1,371行の完成されたAI評価パイプラインはそのまま維持
- カジュアルな写真もガチ観察も、入口は同じ `post.php`。**ikimonがデータの価値を自動で引き出す**
- 全モードのデータが同じ Canonical Schema に蓄積され、重なるほど解像度が上がる

### データの重ね合わせ

```
投稿データ ─────────┐
ウォークデータ ──────┼→ 1つの Canonical Schema に蓄積
ライブスキャンデータ ─┘       ↓
                          データが重なるほど解像度UP
                              ↓
                    ┌─────────────────────────┐
                    │ 「この地域の全体像はこう」    │
                    │ 「ここは詳しく調査すべき」    │
                    │ 「ここはDNA調査が必要」      │
                    │ 「専門家にお願いすべき箇所」   │
                    └─────────────────────────┘
                              ↓
                    OECM申請 / TNFD報告 / 環境調査レポート
```

---

## 現在地：何が動いていて、何がダミーか

### コードベース全調査結果（2026-03-21 実施）

| コンポーネント | ファイル | 状態 | 詳細 |
|---|---|---|---|
| **📷 写真投稿AI** | `post.php` → `AiObservationAssessment.php` | **✅ 本物・変更なし** | Gemini Vision API。3段階処理(fast/batch/deep)。マルチサブジェクト対応。1,371行。**このパイプラインには手を入れない** |
| **🗺️ GPS追跡** | `walk.php`, `field_scan.php` | **✅ 本物** | Web Geolocation API。5秒間隔。MapLibre地図表示 |
| **🎤 音声メーター** | `walk.php`, `field_scan.php` | **✅ 本物** | Web Audio API + FFT解析。リアルタイムレベル表示 |
| **🐦 音声種分類** | `walk.php:classifyAudioSnippet()`, `field_scan.php:classifyAudio()` | **❌ ダミー** | ハードコード5種、20-25%ランダム確率。コメント「本番実装ではない」 |
| **🔄 パッシブエンジン** | `PassiveObservationEngine.php` | **✅ 本物** | 重複排除、confidence調整(habitat/season boost)、OmoikaneDB連携 |
| **📡 パッシブAPI** | `api/v2/passive_event.php` | **✅ 本物** | バッチ受信(max500件)、レート制限、プライバシーフィルタ |
| **🧬 埋め込み検索** | `EmbeddingService/Store/Queue` | **✅ 本物** | Gemini Embedding 2、768次元、SQLite BLOB |
| **📊 レポート** | `ReportEngine.php`, `tnfd_leap_report.php` | **✅ 本物** | TNFD LEAP、BIS スコア |
| **🏷️ 信頼度** | `TrustLevel.php` (L1-5) | **✅ 本物** | 重み付き投票、Research Grade判定 |
| **📋 DwC-A出力** | `export_dwca.php` 他4本 | **✅ 本物** | Darwin Core Archive、プライバシーフィルタ付き |
| **🗃️ 同定キュー** | `IdentifierQueue.php` | **✅ 本物** | スコアリング、分類群マッチ、サイト重複除去 |
| **📏 品質グレード** | `DataQuality.php` (A/B/C/D) | **✅ 本物** | 写真+位置→B、2名合意→A |

### 結論：**音声AI分類の1箇所をダミー→本物に差し替えれば、全モードが本物になる**

---

## アーキテクチャ：AI Detection Microservice

### なぜ VPS 上の FastAPI か

| 方式 | 問題 |
|------|------|
| ❌ 外部アプリ（BirdNET）を使ってもらう | ユーザーに負担。ikimon完結の思想に反する |
| ❌ ブラウザ上でML推論（TFLite.js） | モデル50MB DL。モバイル回線で非現実的 |
| ❌ PHP から subprocess で Python 呼出 | 毎回モデルロード9秒+。使い物にならない |
| **✅ VPS上の FastAPI にモデル常駐** | 1リクエスト1-3秒。メモリ500MB。12GB VPSに余裕で収まる |

### 構成図

```
┌─────────────────────────────────────────────────────────────┐
│  ikimon.life (ブラウザ / PWA)                                 │
│                                                             │
│  📷 post.php ─────→ Gemini Vision API (既存・変更なし)        │
│  🚶 walk.php ─────→ /api/v2/analyze_audio.php (★新規)       │
│  📡 field_scan.php                                           │
│     ├─ 音声 ─────→ /api/v2/analyze_audio.php (★新規)        │
│     └─ 映像 ─────→ Gemini Nano (オンデバイス、対応端末のみ)    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Xserver VPS (Ubuntu 24.04, 12GB RAM)                        │
│                                                              │
│  Nginx ─→ PHP-FPM (既存)                                     │
│    │                                                         │
│    └─→ /api/v2/analyze_audio.php (PHP)                       │
│           │                                                  │
│           │ HTTP localhost:8100                               │
│           ▼                                                  │
│    ┌─────────────────────────────────┐                       │
│    │ FastAPI Microservice (:8100)     │  ← ★ 新規構築         │
│    │                                 │                       │
│    │ BirdNET-Analyzer (常駐)          │  ~500MB RAM           │
│    │ - 6,522種（全世界の鳥類）         │                       │
│    │ - CPU推論: 3秒音声→1-2秒         │                       │
│    │ - lat/lon/week で地域種絞込      │                       │
│    │                                 │                       │
│    │ [将来] SpeciesNet (遅延ロード)    │  画像AI追加時          │
│    └─────────────────────────────────┘                       │
│                                                              │
│  ※ 映像リアルタイム判定は VPS ではなくオンデバイス:             │
│    Gemini Nano 搭載端末 (Pixel 10 Pro 等) → ブラウザ内で推論  │
│    → API費用ゼロ、レイテンシ極小、VPS負荷なし                  │
│    → 非対応端末ではライブスキャンの映像機能は無効（音声のみ）     │
│                                                              │
│  メモリ使用量:                                                │
│  PHP-FPM: ~500MB + BirdNET: ~500MB + OS: ~1GB = 2GB         │
│  残り 10GB の余裕あり                                         │
└──────────────────────────────────────────────────────────────┘
```

### BirdNET-Analyzer の技術仕様

| 項目 | 値 |
|------|-----|
| モデル | V2.4 (TFLite, 50.5MB, 0.826 GFLOPs) |
| 対応種数 | 6,522（全世界の鳥類 + 11非鳥類イベント） |
| 入力 | 任意音声（wav/mp3/ogg/webm → ffmpeg で変換） |
| 推論時間 | 3秒音声 → CPU 1-2秒 |
| RAM | ~500MB（モデル常駐時） |
| 地域絞込 | lat/lon/week 指定で出現種をフィルタ |
| ライセンス | コード: MIT / モデル: CC BY-NC-SA 4.0（非商用OK） |

### ブラウザ→サーバーの音声送信

```javascript
// walk.php / field_scan.php のダミー関数を差し替え
async function classifyAudioSnippet() {
    // 3秒間の音声をキャプチャ
    const chunks = [];
    const recorder = new MediaRecorder(audioStream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'   // Android/Chrome
            : 'audio/mp4'                // iOS Safari
    });
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.start();
    await new Promise(r => setTimeout(r, 3000));
    recorder.stop();
    await new Promise(r => recorder.onstop = r);

    const blob = new Blob(chunks);
    const formData = new FormData();
    formData.append('audio', blob, 'snippet.webm');
    formData.append('lat', currentLat);
    formData.append('lng', currentLng);

    // VPS の BirdNET に送信（1-3秒で返る）
    const res = await fetch('/api/v2/analyze_audio.php', {
        method: 'POST',
        body: formData
    });
    return await res.json();
    // → { detections: [{scientific_name, common_name, confidence, start_time, end_time}] }
}
```

---

## 2週間開発計画（日単位）

### Week 1: AI Detection Microservice + 音声AI実接続

#### Day 1 (土 03/22): VPS に BirdNET-Analyzer セットアップ

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 0.1 | VPS に Python 3.11 + venv 構築 | Codex | `/opt/ikimon-ai/venv/` |
| 0.2 | BirdNET-Analyzer + birdnetlib インストール | Codex | 動作確認ログ |
| 0.3 | ffmpeg インストール確認 | Codex | `which ffmpeg` |
| 0.4 | FastAPI アプリ作成（`/opt/ikimon-ai/app.py`） | Codex | `POST /analyze` エンドポイント |
| 0.5 | systemd サービス登録（`ikimon-ai.service`） | Codex | 自動起動設定 |
| 0.6 | Nginx reverse proxy 設定（内部 :8100） | Codex | 外部からアクセス不可を確認 |

**FastAPI アプリ (`/opt/ikimon-ai/app.py`):**

```python
from fastapi import FastAPI, UploadFile, Form
from birdnetlib import Recording
from birdnetlib.analyzer import Analyzer
import tempfile, os

app = FastAPI()
analyzer = Analyzer()  # モデル常駐（起動時に1回ロード）

@app.post("/analyze")
async def analyze_audio(
    audio: UploadFile,
    lat: float = Form(35.0),
    lng: float = Form(139.0),
    min_conf: float = Form(0.25)
):
    # 一時ファイルに保存 → ffmpeg で wav 変換 → BirdNET 推論
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        content = await audio.read()
        # webm/mp4 → wav 変換
        input_tmp = tmp.name.replace(".wav", ".input")
        with open(input_tmp, "wb") as f:
            f.write(content)
        os.system(f"ffmpeg -y -i {input_tmp} -ar 48000 -ac 1 {tmp.name} 2>/dev/null")
        os.unlink(input_tmp)

        recording = Recording(
            analyzer, tmp.name,
            lat=lat, lon=lng,
            min_conf=min_conf
        )
        recording.analyze()
        os.unlink(tmp.name)

        return {
            "detections": [
                {
                    "scientific_name": d["scientific_name"],
                    "common_name": d["common_name"],
                    "confidence": round(d["confidence"], 3),
                    "start_time": d["start_time"],
                    "end_time": d["end_time"]
                }
                for d in recording.detections
            ]
        }

@app.get("/health")
def health():
    return {"status": "ok", "model": "BirdNET-Analyzer V2.4", "species_count": 6522}
```

**systemd サービス (`/etc/systemd/system/ikimon-ai.service`):**
```ini
[Unit]
Description=ikimon.life AI Detection Service
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/ikimon-ai
ExecStart=/opt/ikimon-ai/venv/bin/uvicorn app:app --host 127.0.0.1 --port 8100
Restart=always

[Install]
WantedBy=multi-user.target
```

---

#### Day 2 (日 03/23): PHP API + walk.php 実接続

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 0.7 | `api/v2/analyze_audio.php` 新規作成 | Claude | PHP→FastAPI ブリッジ |
| 0.8 | walk.php の `classifyAudioSnippet()` をダミー→実APIに差替 | Claude | walk.php 更新 |
| 0.9 | field_scan.php の `classifyAudio()` も同様に差替 | Claude | field_scan.php 更新 |
| 0.10 | 音声録音→送信→結果表示の E2E テスト | Claude | テスト結果 |

**`api/v2/analyze_audio.php`（PHP → FastAPI ブリッジ）:**

```php
<?php
require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . 'libs/Auth.php';
require_once ROOT_DIR . 'libs/RateLimiter.php';
require_once ROOT_DIR . 'libs/CSRF.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['error' => 'Method not allowed']));
}

if (!Auth::isLoggedIn()) {
    http_response_code(401);
    exit(json_encode(['error' => 'Unauthorized']));
}

// レート制限: 1分あたり20回（3秒間隔のリアルタイム分析に対応）
$limiter = new RateLimiter('analyze_audio', 20, 60);
if (!$limiter->check(Auth::getUserId())) {
    http_response_code(429);
    exit(json_encode(['error' => 'Rate limit exceeded']));
}

// 音声ファイル受信
if (!isset($_FILES['audio'])) {
    http_response_code(400);
    exit(json_encode(['error' => 'No audio file']));
}

$lat = floatval($_POST['lat'] ?? 35.0);
$lng = floatval($_POST['lng'] ?? 139.0);

// FastAPI に転送
$ch = curl_init('http://127.0.0.1:8100/analyze');
$cfile = new CURLFile($_FILES['audio']['tmp_name'], $_FILES['audio']['type'], 'snippet.webm');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => ['audio' => $cfile, 'lat' => $lat, 'lng' => $lng, 'min_conf' => 0.25],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$response) {
    http_response_code(502);
    exit(json_encode(['error' => 'AI service unavailable']));
}

echo $response;
```

---

#### Day 3 (月 03/24): 音声証拠の保存 + Evidence Tier 導入

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 0.11 | 音声スニペット保存（`uploads/audio/YYYY-MM/`） | Claude | analyze_audio.php 拡張 |
| 0.12 | ADR-005: Evidence Tier データモデル | Claude | `docs/architecture/adr-005-evidence-tier.md` |
| 0.13 | DataQuality.php に `evidence_tier` フィールド追加 | Claude | DataQuality 拡張 |
| 0.14 | PassiveObservationEngine に evidence_tier 設定ロジック追加 | Codex | エンジン拡張 |

**Evidence Tier の定義（全観察モード共通）:**

```
Tier 1:   AI単独判定（音声 or 画像）
Tier 1.5: AI高確信度 + 生態学的妥当性（地域×季節）→ 自動昇格
Tier 2:   コミュニティ検証（1名の reviewer が確認）
Tier 3:   合意形成（2名以上の合意、または専門家1名）
Tier 4:   外部監査（DNA、標本、学術引用）

全モードで同じ Tier を使う:
- 写真投稿 → Gemini判定 → Tier 1 → 市民科学者が同定 → Tier 2-3
- 散歩スキャン → BirdNET判定 → Tier 1 → reviewer確認 → Tier 2-3
- ライブスキャン → 連続画像+音声判定 → Tier 1 → 蓄積データで統計的に Tier 1.5
- 丁寧な観察 → 写真+音声+位置 → 複合証拠で Tier 2 スタートもありえる
```

---

#### Day 4 (火 03/25): Canonical Schema + CanonicalStore

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 0.15 | ADR-006: Canonical Schema ストレージ戦略 | Claude | ADR文書 |
| 0.16 | Canonical Schema v0.1 DDL（5層） | Codex | `scripts/migrations/001_canonical_schema.sql` |
| 0.17 | CanonicalStore.php 実装 | Codex | `libs/CanonicalStore.php` |
| 0.18 | 既存観察 → Canonical Schema 同期ロジック | Codex | `libs/CanonicalSync.php` |

**5層 + ライブ層テーブル設計（100年耐久 + リアルタイム対応）:**

```sql
-- ===== 100年耐久レイヤー =====

-- Layer 1: Event（いつ・どこで・どうやって）
CREATE TABLE events (
    event_id TEXT PRIMARY KEY,       -- UUIDv4（不変）
    parent_event_id TEXT,            -- 調査セッションの親子
    event_date TEXT NOT NULL,        -- ISO8601
    decimal_latitude REAL,
    decimal_longitude REAL,
    geodetic_datum TEXT DEFAULT 'EPSG:4326',  -- ★ 100年後の座標再投影に必須
    coordinate_uncertainty_m REAL,   -- GPS実測値
    uncertainty_type TEXT,           -- ★ 'measured' | 'device_default' | 'assumed'
    sampling_protocol TEXT,          -- 'manual-photo' | 'walk-audio' | 'live-scan' | 'survey'
    sampling_effort TEXT,            -- '30 minutes walk' | '2 hour live-scan'
    capture_device TEXT,             -- 'iPhone 13 Pro' | 'Pixel 10 Pro'
    recorded_by TEXT,                -- user_id
    site_id TEXT,
    schema_version TEXT DEFAULT '1.0',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Layer 2: Occurrence（何がいたか）
CREATE TABLE occurrences (
    occurrence_id TEXT PRIMARY KEY,  -- UUIDv4（不変）
    event_id TEXT NOT NULL REFERENCES events(event_id),
    scientific_name TEXT,
    taxon_rank TEXT,                 -- 'species' | 'genus' | 'family'
    taxon_concept_version TEXT,      -- ★ 'GBIF Backbone 2026-03' — 100年後の分類変更追跡に必須
    basis_of_record TEXT,            -- 'HumanObservation' | 'MachineObservation'
    individual_count INTEGER,        -- ★ 個体数（DwC export に必須）
    evidence_tier REAL DEFAULT 1,    -- 1, 1.5, 2, 3, 4
    evidence_tier_at TEXT,
    evidence_tier_by TEXT,           -- 'auto' | reviewer_id
    data_quality TEXT DEFAULT 'C',   -- A/B/C/D（既存互換）
    observation_source TEXT,         -- 'post' | 'walk' | 'live-scan' | 'survey'
    original_observation_id TEXT,    -- 既存 JSON の obs_xxx への参照
    detection_confidence REAL,       -- AI生値（加工前）
    adjusted_confidence REAL,        -- ★ 周辺データ加味後の総合確度
    confidence_context JSON,         -- ★ 確度補正の根拠（下記参照）
    detection_model TEXT,            -- 'birdnet-v2.4' | 'gemini-3.1-flash-lite'
    detection_model_hash TEXT,       -- ★ モデルバイナリの SHA-256（AI再現性）
    created_at TEXT DEFAULT (datetime('now'))
);

-- ★ confidence_context の構造:
-- {
--   "base": 0.72,
--   "boosts": [
--     {"type": "nearby_observations", "value": 0.10, "count": 3, "radius_m": 500},
--     {"type": "vegetation_match", "value": 0.05, "biome": "deciduous_broadleaf"},
--     {"type": "seasonal_activity", "value": 0.03, "month": 3, "breeding": true}
--   ],
--   "adjusted": 0.90,
--   "method": "contextual_boosting_v1"
-- }

-- Layer 3: Evidence（証拠メディア）
CREATE TABLE evidence (
    evidence_id TEXT PRIMARY KEY,
    occurrence_id TEXT NOT NULL REFERENCES occurrences(occurrence_id),
    media_type TEXT NOT NULL,        -- 'photo' | 'audio' | 'spectrogram' | 'video-frame'
    media_path TEXT NOT NULL,        -- uploads/photos/... | uploads/audio/...
    media_hash TEXT,                 -- ★ SHA-256（改竄検知・100年データ完全性）
    capture_timestamp TEXT,
    duration_seconds REAL,           -- 音声の長さ
    metadata JSON,                   -- EXIF, audio params, etc.
    created_at TEXT DEFAULT (datetime('now'))
);

-- Layer 4: Identification（誰が何と同定したか — immutable append-only）
CREATE TABLE identifications (
    identification_id TEXT PRIMARY KEY,
    occurrence_id TEXT NOT NULL REFERENCES occurrences(occurrence_id),
    identified_by TEXT NOT NULL,     -- user_id | 'ai:birdnet-v2.4' | 'ai:gemini'
    taxon_name TEXT NOT NULL,
    taxon_concept_version TEXT,      -- ★ 同定時点の分類体系バージョン
    identification_method TEXT,      -- 'ai-audio' | 'ai-image' | 'visual' | 'literature' | 'dna'
    confidence REAL,
    reviewer_level TEXT,             -- 'L0' | 'L1' | 'L2' | 'L3'
    notes TEXT,
    is_current INTEGER DEFAULT 1,   -- 最新の同定か
    created_at TEXT DEFAULT (datetime('now'))
    -- ★ このテーブルは UPDATE 禁止。新しい同定は INSERT のみ（immutable log）
);

-- Layer 5: PrivacyAccess（公開制御）
CREATE TABLE privacy_access (
    record_id TEXT PRIMARY KEY,      -- occurrence_id
    coordinate_precision TEXT,       -- 'exact' | 'fuzzy-1km' | 'fuzzy-10km' | 'hidden'
    access_tier TEXT,                -- 'public' | 'researcher' | 'government' | 'private'
    legal_basis TEXT,                -- 'consent' | 'legitimate_interest' | 'red_list_protection'
    sensitive_species INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ===== リアルタイムレイヤー（ライブマップ用・揮発性） =====

-- Layer 6: LiveDetections（24h TTL・ライブマップ表示用）
CREATE TABLE live_detections (
    detection_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    lat REAL NOT NULL,               -- 100m fuzzy化済み（プライバシー）
    lng REAL NOT NULL,
    scientific_name TEXT,
    common_name TEXT,
    detection_confidence REAL,
    adjusted_confidence REAL,
    detection_type TEXT,             -- 'audio' | 'visual'
    occurrence_id TEXT,              -- Canonical への紐付け（あれば）
    detected_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,        -- 24h後に自動削除
    is_anonymous INTEGER DEFAULT 1
);

-- ===== インデックス =====

-- Canonical 層
CREATE INDEX idx_occ_event ON occurrences(event_id);
CREATE INDEX idx_occ_tier ON occurrences(evidence_tier);
CREATE INDEX idx_occ_source ON occurrences(observation_source);
CREATE INDEX idx_occ_species ON occurrences(scientific_name);
CREATE INDEX idx_occ_adjusted ON occurrences(adjusted_confidence);
CREATE INDEX idx_evidence_occ ON evidence(occurrence_id);
CREATE INDEX idx_evidence_hash ON evidence(media_hash);
CREATE INDEX idx_id_occ ON identifications(occurrence_id);

-- Live 層
CREATE INDEX idx_live_geo ON live_detections(lat, lng);
CREATE INDEX idx_live_time ON live_detections(detected_at);
CREATE INDEX idx_live_expires ON live_detections(expires_at);
```

**100年耐久の原則（ADR-001/002 準拠）:**
1. **Identification テーブルは INSERT のみ。UPDATE 禁止。** 過去の同定記録は消さない
2. **全メディアに SHA-256 ハッシュ。** 100年後にデータ完全性を検証可能
3. **`taxon_concept_version` を全同定に記録。** 分類体系が変わっても追跡可能
4. **`geodetic_datum` を明示。** 座標参照系が変わっても再投影可能
5. **`confidence_context` で確度補正の根拠を保存。** アルゴリズム変更時に再評価可能
6. **Live層はCanonical層と分離。** 揮発性データが永続データを汚染しない

---

#### Day 5 (水 03/26): ReviewerLevel + レビューUI

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 0.19 | ReviewerLevel.php（TrustLevel → L0-L3 ブリッジ） | Claude | `libs/ReviewerLevel.php` |
| 0.20 | id_workbench.php に音響レビュータブ追加 | Claude | UI拡張 |
| 0.21 | `api/v2/review_occurrence.php`（approve/reject/skip） | Codex | API |
| 0.22 | テスト: ReviewerLevelTest.php | Claude | テスト |

**音響レビューUI（id_workbench.php 内の新タブ）:**

```
┌────────────────────────────────────────┐
│ 📋 同定ワークベンチ                      │
│ [🔬 通常] [🎵 音響] [📸 スキャン]        │
├────────────────────────────────────────┤
│                                        │
│  🎵 シジュウカラ (Parus minor)          │
│  BirdNET 確信度: 0.92 → Tier 1.5       │
│  🚶 ウォークモードで検出                  │
│                                        │
│  📍 東京都武蔵野市 | 2026-03-24 07:30   │
│                                        │
│  [▶ 音声再生 (3秒)]                     │
│  ┌──────────────────────────────────┐  │
│  │ ▁▂▃▅▆▇█▇▆▅▃▂▁▂▃▅▇█▇▅▃▁        │  │
│  │         スペクトログラム             │  │
│  └──────────────────────────────────┘  │
│                                        │
│  📷 同時刻の写真（もしあれば）            │
│  [img_thumb] [img_thumb]               │
│                                        │
│  ┌──────┐  ┌──────┐  ┌──────┐        │
│  │ ✅承認 │  │ ❌棄却 │  │ ⏭スキップ│        │
│  └──────┘  └──────┘  └──────┘        │
│  [💬 コメント...]  [🔄 別の種を提案]     │
│                                        │
│  ◀ 前  |  3/12  |  次 ▶               │
└────────────────────────────────────────┘
```

---

#### Day 6 (木 03/27): EvidenceTierPromoter + 昇格ワークフロー

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 0.23 | EvidenceTierPromoter.php（Tier 1→1.5 自動昇格） | Claude | `libs/EvidenceTierPromoter.php` |
| 0.24 | TierPromotionWorkflow.php（レビュー→Tier 2/3 昇格） | Codex | `libs/TierPromotionWorkflow.php` |
| 0.25 | ConsensusEngine.php（合意形成ロジック） | Codex | `libs/ConsensusEngine.php` |
| 0.26 | テスト: EvidenceTierPromoterTest.php | Claude | テスト |

**全観察モードの Tier 昇格フロー:**

```
写真投稿（post.php）
  → Gemini: "シジュウカラ 85%" → Tier 1
  → 生態学的妥当性チェック → Tier 1.5
  → ユーザーAが同定「シジュウカラ」→ Tier 2
  → ユーザーBも同定「シジュウカラ」→ Tier 3 (Research Grade)

散歩スキャン（walk.php）
  → BirdNET: "シジュウカラ 92%" → Tier 1
  → 高確信度 + 地域×季節OK → Tier 1.5（自動）
  → Reviewer が音声確認「合ってる」→ Tier 2
  → 別 Reviewer も確認 → Tier 3

ライブスキャン（field_scan.php）
  → 音声: BirdNET "ヒバリ 90%" / "セミ類 75%" （全端末）
  → 映像: Gemini Nano "ケヤキ 78%" ×15 / "アジサイ 85%" ×8 （対応端末のみ）
  → 聞こえるもの（＋見えるもの）を連続同定＋カウント → Tier 1 × N件
  → 同じ種が複数回検出 → 統計的に Tier 1.5（自動）
  → 投稿で写真追加 → 複合証拠で Tier 2
```

---

#### Day 7 (金 03/28): Week 1 統合テスト

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 0.27 | walk.php: マイク録音→BirdNET→結果表示 E2Eテスト | Claude | テスト結果 |
| 0.28 | field_scan.php: 音声+カメラ同時スキャン E2Eテスト | Claude | テスト結果 |
| 0.29 | レビューUI: 音響レビュー→Tier昇格 E2Eテスト | Claude | テスト結果 |
| 0.30 | `composer test` 全テスト通過 | Codex | CI green |
| 0.31 | 進捗コミット + push | Claude | git push |

**Week 1 完了時の状態:**
```
✅ BirdNET-Analyzer が VPS 上で稼働（FastAPI :8100）
✅ walk.php のダミー音声分類 → 実 BirdNET に差替済み
✅ field_scan.php のダミー音声分類 → 実 BirdNET に差替済み
✅ 音声スニペットが証拠として保存される
✅ Canonical Schema (SQLite 5層) が稼働
✅ Evidence Tier (1/1.5/2/3/4) が全モードで動作
✅ 音響レビューUI が id_workbench 上で動作
✅ Tier 昇格ワークフロー（自動 + 手動）が動作
```

---

### Week 2: KPI + レポート + データ重ね合わせ

#### Day 8-9 (土日 03/29-30): KPIダッシュボード + データ蓄積可視化

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 1.1 | CanonicalStore::getKPIMetrics() 実装 | Codex | KPI集計SQL |
| 1.2 | poc_dashboard.php（G1-G7 + Tier分布） | Claude | `public_html/poc_dashboard.php` |
| 1.3 | 「データの重ね合わせ」可視化（同一地域の複数モードデータ統合表示） | Claude | ダッシュボード拡張 |
| 1.4 | 「ここを深掘りすべき」自動提案ロジック | Codex | `libs/SurveyRecommender.php` |

**SurveyRecommender.php — 「次に何をすべきか」の自動提案:**

```php
class SurveyRecommender {
    /**
     * 蓄積データから、調査の優先度を自動提案:
     *
     * - "この地域は鳥類データは十分。植物データが不足"
     * - "ここは Tier 1 が多い。reviewer による検証が必要"
     * - "夜間の音声データがない。夜行性種の調査を推奨"
     * - "この希少種は DNA 確認が必要。専門家に依頼を"
     */

    public function analyze(string $siteId): array {
        return [
            'coverage_gaps' => [...],     // 分類群×時間帯×季節のギャップ
            'tier_bottlenecks' => [...],  // Tier 1 が溜まってる分類群
            'recommended_actions' => [...], // 次にやるべきこと（優先度順）
            'expert_needed' => [...],     // 専門家が必要な案件
        ];
    }
}
```

**KPIダッシュボード（poc_dashboard.php）:**

```
┌─────────────────────────────────────────────────────────────┐
│  📊 PoC Dashboard — 観察のOS                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ── 観察モード別の貢献 ──                                     │
│  📷 投稿:         ████████████████  320件                    │
│  🚶 ウォーク:      ██████████       185件 (うち音声: 142)     │
│  📡 ライブスキャン: ████████         156件 (音声+映像)         │
│                                                             │
│  ── Evidence Tier 分布 ──                                    │
│  Tier 1:   ████████████  340件 (46%)                        │
│  Tier 1.5: ██████       185件 (25%)                         │
│  Tier 2:   ███          92件  (12%)                         │
│  Tier 3:   █            12件  (2%)                          │
│  未判定:   ████         112件 (15%)                          │
│                                                             │
│  ── G1-G7 数値ゲート ──                                      │
│  G1 検出量     12.5/時間  ✅ (≥10)                           │
│  G2 AI精度     84%       ✅ (≥80%)                           │
│  G3 レビュー速度 2.1分/件  ✅ (≤3分)                           │
│  G4 昇格速度   48h中央値  ✅ (≤72h)                           │
│  G5 Reviewer   7名/月末   ✅ (≥5名)                          │
│  G6 CPU        45%ﾋﾟｰｸ   ✅ (<70%)                          │
│  G7 Storage    12GB/50GB  ✅                                │
│                                                             │
│  ── 💡 自動提案 ──                                           │
│  ⚠️ 植物データが不足: 全体の8%のみ。カメラスキャンを推奨        │
│  ⚠️ 夜間データなし: 夜行性種が未調査。夜間ウォーク推奨          │
│  📋 Tier 1 が142件滞留: 鳥類 reviewer の追加確保を推奨         │
│  🧬 ヒクイナ(1件): DNA確認推奨。最寄りの専門家に依頼を          │
│                                                             │
│  [📄 Go/No-Go判定レポート生成]  [📊 TNFD出力]                │
└─────────────────────────────────────────────────────────────┘
```

---

#### Day 10 (月 03/31): DwC-A Export Adapter + ライブスキャン設計

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 1.5 | DwcExportAdapter.php（Canonical Schema → DwC-A） | Codex | `libs/DwcExportAdapter.php` |
| 1.6 | field_scan.php にライブスキャン追加（UI切替） | Claude | field_scan.php 拡張 |
| 1.7 | ライブスキャンの連続フレーム間隔調整（5秒→移動速度に応じて可変） | Claude | ロジック |

**ライブスキャンの処理:**
```javascript
// 音声: BirdNET on VPS（全端末で動作、コストゼロ）
// 3秒チャンク → VPS → 1-2秒で結果返却

// 映像: Gemini Nano（対応端末のみ、コストゼロ）
// window.ai / Prompt API が利用可能か検出
const hasOnDeviceAI = 'ai' in window && 'languageModel' in window.ai;

if (hasOnDeviceAI) {
    // Pixel 10 Pro / iPhone Pro 等: カメラフレームをオンデバイスで推論
    // API費用ゼロ、VPS負荷ゼロ、低レイテンシ
    enableVideoScan();
} else {
    // 非対応端末: 映像機能は無効。音声のみのライブスキャン
    // 写真を撮りたいときは通常の投稿フロー（post.php）で
    disableVideoScan();
}

// 速度に応じてキャプチャ間隔を調整（映像AI有効時）
function getLiveScanInterval(speedKmh) {
    if (speedKmh < 20) return 4000;   // 低速: 4秒
    if (speedKmh < 50) return 3000;   // 一般道: 3秒
    return 5000;                       // 高速: 5秒
}

// 同じ種が連続検出 → 1件にまとめて count++
// → 「ケヤキ ×15」「アジサイ ×8」「ヒバリ ×3」のような集計
// → ルート沿いの生物相トランセクト調査と同等のデータが得られる
```

**ライブスキャンのコスト構造:**

| センサー | AI処理場所 | 対応端末 | コスト |
|---------|-----------|---------|-------|
| 🎤 音声 | VPS (BirdNET) | 全端末 | ゼロ |
| 📸 映像 | オンデバイス (Gemini Nano) | Pixel 10 Pro 等 | ゼロ |
| 📸 映像 | ―（無効。音声のみ） | その他の端末 | ― |
| 📍 GPS | ブラウザ | 全端末 | ゼロ |

---

#### Day 11 (火 04/01): Reviewer キュー + オンボーディング

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 1.8 | IdentifierQueue を全モード対応に拡張 | Claude | IdentifierQueue 拡張 |
| 1.9 | 分類群フィルタ（鳥類/植物/昆虫/哺乳類/樹木） | Claude | UI + API |
| 1.10 | reviewer_onboarding.php（Day 1 チェックリスト） | Claude | `public_html/reviewer_onboarding.php` |

---

#### Day 12 (水 04/02): 監査ログ + PrivacyAccess

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 1.11 | EventLogService 拡張（Tier変更、レビュー、昇格の全記録） | Codex | EventLogService 拡張 |
| 1.12 | PrivacyAccess Layer 実装（希少種座標丸め） | Claude | PrivacyFilter 拡張 |
| 1.13 | 音声ファイルのプライバシー制御（希少種の音声は公開制限） | Codex | アクセス制御 |

---

#### Day 13 (木 04/03): 統合 E2E テスト

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 1.14 | 全3モードの E2E テスト | Claude | テスト結果レポート |
| 1.15 | バグ修正 + エッジケース対応 | Codex/Claude | 修正コミット |
| 1.16 | `composer test` 全テスト通過 | Codex | CI green |

**E2E テストシナリオ:**
```
シナリオ1: 投稿（既存フローの確認）
  post.php → 写真アップ → Gemini判定 → Tier 1 → 他ユーザー同定 → Tier 2
  ※ 既存パイプラインが壊れていないことの確認のみ

シナリオ2: ウォーク
  walk.php → マイクON → 3秒チャンク送信 → BirdNET判定 → Tier 1/1.5
  → 音声証拠保存確認 → Canonical Schema 格納確認

シナリオ3: ライブスキャン
  field_scan.php → 音声自動 + (対応端末なら映像も)
  → 地図上にプロット確認 → 種リスト集計確認

シナリオ4: レビュー→昇格
  id_workbench → 音響タブ → 音声再生 → 承認 → Tier 2 昇格確認
  → 監査ログ記録確認

シナリオ5: レポート
  poc_dashboard → G1-G7 表示確認 → 自動提案表示確認
  → DwC-A Export（Tier 2以上のみ）→ ファイル内容確認
```

---

#### Day 14 (金 04/04): デプロイ + 振り返り

| # | タスク | 担当 | 成果物 |
|---|--------|------|--------|
| 1.17 | 全変更を main にマージ | Claude | マージ済みPR |
| 1.18 | 本番デプロイ | Claude | deploy.sh 実行 |
| 1.19 | DEVELOPMENT_PLAN.md 更新 | Claude | 本ファイル更新 |
| 1.20 | Sprint 2 計画の素案 | Claude | 次のスプリント骨子 |

---

## 2週間完了時の全体像

```
ikimon.life（2026-04-04 時点）
│
│  3つの観察モード:
├── 📷 投稿 ─────→ Gemini Vision API (既存・変更なし) ──┐
├── 🚶 ウォーク ──→ BirdNET on VPS (★新規・コストゼロ) ──┤
├── 📡 ライブスキャン                                     │
│     ├─ 音声 ──→ BirdNET on VPS (コストゼロ)           ──┤
│     └─ 映像 ──→ Gemini Nano on device (コストゼロ)    ──┤
│                                                        ↓
│                              Canonical Schema (5層)
│                                        ↓
│                              Evidence Tier (1→1.5→2→3→4)
│                                        ↓
│                         ┌───────────────────────────┐
│                         │ データ蓄積 → 重ね合わせ      │
│                         │ → 全体像 → 深掘り提案       │
│                         │ → OECM / TNFD レポート     │
│                         └───────────────────────────┘
│
├── 🧬 レビューUI ──→ approve/reject/skip
├── 📊 KPIダッシュボード ──→ G1-G7 + 自動提案
└── 📄 DwC-A Export ──→ Tier 2+ のみ公開
```

**ユーザーは ikimon.life だけを使う。他のアプリは一切不要。**

---

## Claude / Codex 役割分担

| エージェント | 主な担当 |
|---|---|
| **Claude Code** | UI (walk.php差替, レビューUI, KPIダッシュボード, ライブスキャン)、ADR、ReviewerLevel、EvidenceTierPromoter、統合テスト |
| **Codex** | VPS構築 (FastAPI+BirdNET)、CanonicalStore、TierPromotionWorkflow、ConsensusEngine、DwcExportAdapter、監査ログ |
| **八巻** | 法務レビュー依頼、Reviewer候補への声掛け、愛管ヒアリング日程調整 |

### ブランチ戦略

```
main
├── codex/birdnet-microservice    ← Day 1: VPS + FastAPI + BirdNET
├── claude/audio-integration      ← Day 2-3: walk.php/field_scan.php 実接続 + 音声保存
├── codex/canonical-schema        ← Day 4: CanonicalStore + 5層テーブル
├── claude/review-ui              ← Day 5-6: ReviewerLevel + 音響レビューUI + Tier昇格
├── claude/kpi-dashboard          ← Day 8-9: KPIダッシュボード + SurveyRecommender
├── codex/dwca-adapter            ← Day 10: DwC-A Export Adapter
├── claude/live-scan              ← Day 10: ライブスキャン
└── claude/integration            ← Day 13-14: 統合テスト + デプロイ
```

---

## リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| BirdNET モデルが日本の鳥で精度が出ない | AI判定品質 | lat/lon で地域種絞込。精度が低い種はグループをリスト化して Tier 1 留め |
| BirdNET の CC BY-NC-SA 4.0 ライセンス | B2B利用制限 | Community面は非商用で問題なし。Enterprise面は別途ライセンス交渉 or SpeciesNet (Apache 2.0) で代替 |
| iOS Safari で audio/webm 非対応 | iPhone ユーザー | audio/mp4 フォールバック実装済み（Day 2） |
| VPS の CPU 負荷（同時リクエスト） | レスポンス遅延 | リクエストキュー化。同時3リクエスト制限。ピーク時は推論間隔を延長 |
| ライブスキャンの通信量 | モバイル回線消費 | 音声は opus 圧縮（3秒≈20KB）。画像は 512px にリサイズ |

---

## BirdNET ライセンスに関する注記

| 項目 | 状態 |
|------|------|
| コード (MIT) | ✅ 自由利用可 |
| モデル (CC BY-NC-SA 4.0) | ⚠️ 非商用は OK。商用利用は Cornell Lab に許可申請が必要 |
| Community 面（無償） | ✅ 非商用として利用可能 |
| Enterprise 面（有償） | ⚠️ 商用ライセンス交渉が必要。代替: SpeciesNet (Apache 2.0) or 自前モデル |

**短期戦略**: Community 面で BirdNET を非商用利用。Enterprise 面は SpeciesNet (Apache 2.0) で代替可能。

---

## 外部アクション（S評価到達に必要・BirdNET不要で進む）

| アクション | 担当 | 期限 | 状態 |
|---|---|---|---|
| 法務レビュー依頼（Appendix D送付） | 八巻 | 3月末 | 🔲 |
| Reviewer候補3名への初回アプローチ | 八巻 | 4/1 | 🔲 |
| 愛管株式会社ヒアリング日程調整 | 八巻 | 4月第1週 | 🔲 |
| BirdNET 商用ライセンス問い合わせ（Enterprise面用） | 八巻 | 4月中 | 🔲 |

---

## 参照ドキュメント

| ドキュメント | パス |
|---|---|
| 戦略本体 v3.8 | `docs/strategy/v3.8/ikimon_life_strategy_2026Q1.md` |
| Appendix A-D | `docs/strategy/v3.8/appendix_*.md` |
| ADR一覧 | `docs/architecture/adr-*.md` |
| Codexセットアップ | `CODEX_SETUP.md` |

---

## 更新履歴

| 日付 | 更新者 | 内容 |
|------|--------|------|
| 2026-03-21 | Claude Opus | 初版 |
| 2026-03-21 | Claude Opus | v2: コードベース全調査に基づく全面改訂 |
| 2026-03-21 | Claude Opus | v3: 「観察のOS」思想で全面書き直し |
| 2026-03-21 | Claude Opus | **v4: モード3本立てに整理。** 写真投稿+観察投稿→「投稿」に統合（同定フローは既存のまま変更なし）。スキャン（カメラリアルタイム）を廃止→ライブスキャンに吸収。映像AIはGemini Nano搭載端末（Pixel 10 Pro等）でオンデバイス処理（APIコストゼロ）。全AI処理がコストゼロまたは極小の構成に |
