# FieldScan 10x 実装計画 2026-04-04

## 目的

FieldScan を「何種見つけたかのアプリ」から、**地域の自然データをためるOS** に変える。

1回の散歩の価値を次で返す。

- どれだけデータがたまったか
- どれだけ空白を埋めたか
- どれだけ再現性のある記録になったか
- どれだけ共同観測を前進させたか

希少種が出なくても、毎回ちゃんと「前進した」と感じられる設計にする。

---

## Root Cause

現状の FieldScan / さんぽ体験は、記録自体はもうかなり取れている。

- `passive_event.php` でセッション・観察・環境ログを保存できる
- `CanonicalStore.php` で event / occurrence / evidence を正規化できる
- `MeshAggregator.php` で空間集計ができる
- `get_fog_data.php` で探索カバレッジを返せる
- `session_recap.php` で振り返りUIを返せる

それでも 10x になっていない理由は、**データが「貢献」に変換される計算層がない**から。

今あるのは:

- 観察ログ
- 軌跡
- 環境ログ
- 種カード
- 断片的な contribution 文言

足りないのは:

- 何が新しく埋まったか
- 何が繰り返し確認されたか
- そのデータが地域全体にどう効いたか
- 個人の散歩が共同観測のどこを押し進めたか

根本解は、**検出結果の上に「貢献台帳」を作ること**。

---

## 10x レバー

### 1. 種数主義を捨てる

主KPIを `species_count` から外す。

置き換える主KPI:

- `active_minutes`
- `distance_m`
- `env_snapshots`
- `audio_segments`
- `visual_frames`
- `evidence_points`
- `new_meshes`
- `revisit_meshes`
- `new_coverage_slots`
- `repeat_coverage_slots`
- `archive_value_score`
- `community_coverage_gain`

### 2. Presence だけでなく Effort / Absence を資産化する

「見つかった」だけでなく、次も保存する。

- その時間帯に歩いた
- その天候で記録した
- その地点で何も見つからなかった
- どのモダリティでどれだけサンプリングした

不在データと努力量は、100年アーカイブでは Presence と同じくらい重要。

### 3. Coverage Cube を導入する

FieldScan の本当の収穫は「種」だけではない。  
空間・時間・環境・モダリティの多次元カバレッジを埋めること。

Coverage Cube の軸:

- 空間: `mesh3`, `mesh4`
- 時間帯: `dawn`, `morning`, `day`, `evening`, `night`
- 季節: `spring`, `summer`, `autumn`, `winter`
- モダリティ: `audio`, `visual`, `env`, `track`
- 天候: `clear`, `cloudy`, `rain`, `snow`, `fog`, `unknown`
- 移動モード: `walk`, `bike`, `vehicle`, `stationary`

1回の散歩は「species log」ではなく「coverage slots を何個埋めたか」で評価する。

### 4. セッションを「検出の束」ではなく「調査単位」にする

既に `events` の親子構造がある。これを調査設計の単位に格上げする。

- 1 session = 1 sampling event
- detections = session の一部
- env logs = session の一部
- route / speed / weather / gaps = session の一部

UI も API も session first に変える。

### 5. 個人スコアではなく「前進量」を返す

ランキングで強者が勝つ構造ではなく、以下を返す。

- 今日の前進
- 今週の前進
- 地域全体の前進に対する寄与
- 自分が埋めた空白

### 6. Community Frontier を出す

「どこが未観測か」「あと何が足りないか」が見えれば、記録はゲーム化ではなく共同作業になる。

Frontier の例:

- この公園の夜帯音声が未観測
- このメッシュは夏の雨天データが空白
- この川沿いは再訪が1回足りず比較可能性が弱い

### 7. Guaranteed Win を設計する

毎回の散歩で、最低1つは価値が返るようにする。

保証する勝ち筋:

- 軌跡データが増えた
- 環境ログが増えた
- 時間帯カバレッジが増えた
- 同じ地点の再訪価値が増えた
- 地域総努力時間が増えた

### 8. LLM は最後にだけ使う

収集・判定・保存・集計が先。  
LLM は最後に「何が前進したか」を自然文へ変換するだけ。

### 9. 集計は同期処理でやらない

書き込み経路は軽く保つ。

- ingestion は append / canonical insert のみ
- contribution / coverage / frontier は非同期集計
- UI はキャッシュ済み集計を見る

### 10. 「発見」より「比較可能性」を高く評価する

珍しい1件より、

- 同じ場所
- 同じ季節
- 違う季節
- 違う時間帯
- 違う天候

で繰り返し取れたデータの方を高く評価する。

---

## 実装の中心: Contribution Ledger

新設する中核は `ContributionLedger`。

役割:

- セッションが生んだデータ量を計算
- セッションが埋めた coverage slot を計算
- セッションが増やした再現性を計算
- セッションが共同観測に与えた前進量を計算
- UI 用の説明可能なメトリクスを返す

### 保存方針

一次データ:

- `events`
- `occurrences`
- `evidence`
- `passive_sessions`
- `environment_logs`
- `tracks`

二次集計:

- SQLite 集計テーブル
- JSON キャッシュ

推奨:

- **事実は SQLite**
- **地図用 / UI用キャッシュは JSON**

---

## 新規スキーマ

## 1. SQLite: `session_contributions`

目的:

- 1 session が何を前進させたかの確定値

カラム案:

```sql
session_id TEXT PRIMARY KEY,
canonical_event_id TEXT,
user_id TEXT NOT NULL,
started_at TEXT,
ended_at TEXT,
duration_sec INTEGER,
distance_m REAL,
scan_mode TEXT,
movement_mode TEXT,
mesh3_count INTEGER DEFAULT 0,
mesh4_count INTEGER DEFAULT 0,
env_snapshot_count INTEGER DEFAULT 0,
audio_segment_count INTEGER DEFAULT 0,
visual_detection_count INTEGER DEFAULT 0,
evidence_count INTEGER DEFAULT 0,
new_mesh_count INTEGER DEFAULT 0,
revisit_mesh_count INTEGER DEFAULT 0,
new_coverage_slot_count INTEGER DEFAULT 0,
repeat_coverage_slot_count INTEGER DEFAULT 0,
absence_slot_count INTEGER DEFAULT 0,
archive_value_score REAL DEFAULT 0,
community_coverage_gain REAL DEFAULT 0,
repeatability_score REAL DEFAULT 0,
effort_quality_score REAL DEFAULT 0,
guaranteed_win_count INTEGER DEFAULT 0,
summary_json TEXT,
created_at TEXT
```

## 2. SQLite: `coverage_slots`

目的:

- Coverage Cube の埋まり具合を永続化

主キー案:

```sql
slot_id TEXT PRIMARY KEY
```

slot_id の構成:

```text
mesh4|season|timeband|weather|modality|movement
```

カラム案:

```sql
slot_id TEXT PRIMARY KEY,
mesh3 TEXT,
mesh4 TEXT,
season TEXT,
timeband TEXT,
weather TEXT,
modality TEXT,
movement TEXT,
first_seen_at TEXT,
last_seen_at TEXT,
sample_count INTEGER DEFAULT 0,
session_count INTEGER DEFAULT 0,
user_count INTEGER DEFAULT 0,
best_evidence_tier REAL DEFAULT 0,
total_duration_sec INTEGER DEFAULT 0,
coverage_status TEXT DEFAULT 'partial'
```

## 3. SQLite: `community_frontiers`

目的:

- 「次に埋めるべき空白」を返すための軽量テーブル

カラム案:

```sql
frontier_id TEXT PRIMARY KEY,
mesh3 TEXT,
mesh4 TEXT,
season TEXT,
timeband TEXT,
weather TEXT,
modality TEXT,
priority REAL,
reason_codes TEXT,
current_sample_count INTEGER,
target_sample_count INTEGER,
last_computed_at TEXT
```

## 4. JSON Cache: `data/community_impact/current.json`

目的:

- ホーム・散歩終了画面・プロフィールで即時表示

構造案:

```json
{
  "region": {
    "total_sessions": 0,
    "total_effort_hours": 0,
    "total_coverage_slots": 0,
    "filled_slots_this_month": 0,
    "frontier_slots_remaining": 0
  },
  "users": {
    "user_id": {
      "total_contribution_score": 0,
      "coverage_slots_filled": 0,
      "revisits_completed": 0,
      "effort_hours": 0
    }
  }
}
```

---

## 新規ライブラリ

## 1. `upload_package/libs/CoverageCube.php`

責務:

- session / env / route / detections から slot を算出
- slot_id を作る
- 新規 slot / 再訪 slot を判定

主メソッド:

- `buildSlotsForSession(array $sessionLog, array $envLog, array $observations): array`
- `upsertSlots(array $slots): array`
- `computeCoverageGain(array $before, array $after): array`

## 2. `upload_package/libs/SessionContributionScorer.php`

責務:

- session ごとの前進量を数値化

返すメトリクス:

- `archive_value_score`
- `community_coverage_gain`
- `repeatability_score`
- `effort_quality_score`
- `guaranteed_win_count`

## 3. `upload_package/libs/ContributionLedger.php`

責務:

- 各集計を束ねて `session_contributions` に書く

主メソッド:

- `recordSessionContribution(string $sessionId): array`
- `getSessionContribution(string $sessionId): array`
- `getUserContributionSnapshot(string $userId): array`
- `getCommunityImpactSnapshot(array $filters = []): array`

## 4. `upload_package/libs/CommunityFrontier.php`

責務:

- Frontier を計算して配る

主メソッド:

- `rebuildFrontiers(?string $mesh3 = null): int`
- `getTopFrontiers(array $filters = []): array`

## 5. `upload_package/libs/EffortProtocol.php`

責務:

- 散歩を「調査努力」として評価

例:

- GPS 連続性
- 速度の妥当性
- env sampling gap
- audio sampling gap
- stationary / drive の混入

---

## 既存ファイルの変更計画

## 1. `upload_package/public_html/api/v2/passive_event.php`

変更内容:

- ingestion 完了後に `session_contributions` 再計算キューを積む
- final batch 時だけ `ContributionLedger::recordSessionContribution()` を呼ぶ
- `summary` を species 중심から session data 中心へ拡張

追加フィールド案:

```php
'summary' => [
  'species_count' => ...,
  'total_detections' => ...,
  'env_snapshot_count' => ...,
  'audio_segment_count' => ...,
  'mesh3_count' => ...,
  'mesh4_count' => ...,
  'evidence_count' => ...,
  'coverage_slot_count' => ...,
]
```

## 2. `upload_package/libs/PassiveObservationEngine.php`

変更内容:

- `buildSummary()` を species-centric から session-centric へ拡張
- 不在セッションや低 confidence セグメントも effort summary に残す

追加指標:

- `active_minutes`
- `data_points`
- `modalities_used`
- `absence_segments`

## 3. `upload_package/public_html/api/v2/session_recap.php`

変更内容:

- species cards を secondary 扱いに下げる
- `contribution` を台帳ベースで返す
- `guaranteed wins` を返す
- narrative の入力を「種名一覧」ではなく「前進量」に変える

新レスポンス案:

```json
{
  "headline": {
    "active_minutes": 42,
    "distance_m": 1800,
    "data_points": 96,
    "new_coverage_slots": 7
  },
  "data_collected": [...],
  "contribution_impact": [...],
  "community_progress": [...],
  "species_cards": [...]
}
```

## 4. `upload_package/public_html/field_research.php`

変更内容:

- レポート画面の主役を差し替える
- `出会った生きもの` を secondary section に落とす
- `今回たまったデータ`
- `今回の前進`
- `みんなの前進`
- `次に埋めたい空白`
  を main sections にする

## 5. `upload_package/public_html/js/fog_overlay.js`

変更内容:

- 単純な `coverage_percent` 表示をやめる
- 以下を切替表示
  - 探索率
  - 観測率
  - 再訪率
  - frontier 残数

## 6. `upload_package/public_html/api/get_fog_data.php`

変更内容:

- `coverage_percent` に加えて以下を返す
  - `observed_cell_percent`
  - `revisit_cell_percent`
  - `frontier_cells`
  - `community_overlap_score`

## 7. `upload_package/libs/MeshAggregator.php`

変更内容:

- species 集計だけでなく effort 集計を追加

新フィールド案:

```json
{
  "effort_hours": 0,
  "session_count": 0,
  "user_count": 0,
  "env_count": 0,
  "audio_count": 0,
  "revisit_count": 0,
  "timebands": {"morning": 3, "evening": 1}
}
```

## 8. `upload_package/libs/CanonicalStore.php`

変更内容:

- global stats に coverage / contribution 指標を追加
- `getGlobalStats()` を Contribution Ledger ベースに拡張

---

## 指標の定義

## 1. `archive_value_score`

1回の散歩がアーカイブとしてどれだけ価値があるか。

```text
archive_value_score =
  0.25 * normalized(active_minutes)
  + 0.20 * normalized(env_snapshot_count)
  + 0.20 * normalized(evidence_count)
  + 0.20 * normalized(new_coverage_slot_count)
  + 0.15 * normalized(repeat_coverage_slot_count)
```

特徴:

- 種の珍しさでなく、後で比較可能なデータを重くする

## 2. `community_coverage_gain`

共同観測全体にどれだけ寄与したか。

```text
community_coverage_gain =
  (new_coverage_slot_count * 1.0)
  + (frontier_slots_filled * 1.5)
  + (under-sampled_slots_filled * 1.2)
  + (weather_rare_slots_filled * 1.3)
```

## 3. `repeatability_score`

再訪可能性・比較可能性。

```text
repeatability_score =
  revisited_mesh_count
  + paired_season_slots
  + paired_timeband_slots
  + paired_weather_slots
```

## 4. `effort_quality_score`

散歩がどれだけ「使える調査」だったか。

加点:

- GPS gap が少ない
- env sampling interval が安定
- audio / visual / env が継続
- vehicle 混入が少ない

減点:

- 速度異常
- 断続的な位置飛び
- 0分相当の短セッション

## 5. `guaranteed_win_count`

そのセッションで確実に返せる成果数。

例:

- 新しい mesh を埋めた
- 新しい timeband を埋めた
- 新しい weather slot を埋めた
- 再訪比較可能な地点を増やした
- 地域 effort hours を積み増した

---

## UX 再設計

## セッション終了画面

今の問題:

- 種カードが主役
- contribution が文章の補足
- 「検出なし」が弱い

新設計:

### 1段目: 今日たまったデータ

- `42分`
- `1.8km`
- `96データ点`
- `環境ログ 24件`
- `音声窓 18件`

### 2段目: 今日の前進

- `新しい観測枠を 7 個埋めた`
- `このメッシュの夕方データが初めて追加された`
- `春の再訪記録が 2 回目になった`

### 3段目: みんなの前進の中での位置

- `今月この地域のデータ蓄積 412 → 508`
- `未観測 frontier が 3 つ減った`
- `キミの寄与でこの公園の朝帯カバレッジが 68% に到達`

### 4段目: 種カード

- secondary
- なくても成立する

### 5段目: 次に埋める空白

- `次は雨の日の朝帯が空白`
- `この池の夜間音声が不足`

## 検出ゼロ時のメッセージ

現状:

- 「今回は検出なし」

変更後:

- `今回は検出0件`
- `でも、環境ログ 21件と軌跡 1.4km が追加され、この地点の夕方データ密度が上がった`

ここは絶対に「ハズレ」に見せない。

---

## API 設計

## 新規: `POST /api/v2/session_contribution.php`

用途:

- session ID を渡すと contribution summary を返す

レスポンス:

```json
{
  "session_id": "ps_xxx",
  "headline": {
    "active_minutes": 42,
    "distance_m": 1800,
    "data_points": 96,
    "guaranteed_wins": 4
  },
  "data_collected": [
    {"label": "環境ログ", "value": 24},
    {"label": "音声窓", "value": 18}
  ],
  "contribution_impact": [
    {"icon": "🧩", "text": "新しい観測枠を7個埋めた"}
  ],
  "community_progress": [
    {"icon": "🌍", "text": "地域 frontier を2つ縮小"}
  ],
  "next_frontiers": [
    {"mesh4": "5237...", "reason": "夜間音声が不足"}
  ]
}
```

## 新規: `GET /api/v2/community_impact.php`

用途:

- ホーム / ダッシュボード / profile で community impact を返す

## 新規: `GET /api/v2/frontier_map.php`

用途:

- map 上に frontier slot を重ねる

## 既存拡張: `GET /api/v2/mesh_aggregates.php`

用途:

- species mesh から effort / revisit / frontier mesh へ拡張

---

## バックグラウンド処理

## 原則

- ingestion request で重い集計を完結させない

## 方法

### A. 同期で最低限

- session log 保存
- canonical insert
- env log 保存

### B. 非同期で集計

- coverage slot 更新
- frontier 再計算
- session contribution 計算
- user / community cache 更新

## 実装案

`scripts/` に CLI を追加:

- `php scripts/rebuild_coverage_cube.php`
- `php scripts/rebuild_session_contributions.php`
- `php scripts/rebuild_frontiers.php`
- `php scripts/rebuild_community_impact.php`

日次または cron:

- frontier 再計算
- cache 再生成

session finalization 時:

- 該当 session のみインクリメンタル更新

---

## ロールアウト

## Sprint 1: データ基盤

目的:

- 収集量と前進量を計算できるようにする

実装:

- `CoverageCube.php`
- `ContributionLedger.php`
- `session_contributions` テーブル
- `coverage_slots` テーブル
- `passive_event.php` final batch hook

完了条件:

- 1 session に対して contribution summary が返る

## Sprint 2: UI 置換

目的:

- 「種の当たり外れ」から脱却

実装:

- `session_recap.php` 返却形式変更
- `field_research.php` report redesign
- `get_fog_data.php` stats 拡張

完了条件:

- 検出ゼロでも session report が価値ある内容になる

## Sprint 3: Community Frontier

目的:

- 集団効力感を可視化

実装:

- `CommunityFrontier.php`
- `frontier_map.php`
- 地図 overlay
- profile / dashboard impact card

完了条件:

- 「次にどこを埋めると全体に効くか」が見える

## Sprint 4: 研究・アーカイブ価値の強化

目的:

- FieldScan を長期データ基盤にする

実装:

- 前年比較 / 同地点比較
- weather / season pair completeness
- archive value dashboard

完了条件:

- 1回の散歩が比較可能データの蓄積として可視化される

---

## 成功指標

プロダクト指標:

- session completion rate
- 週次継続率
- session restart rate
- sync success rate

データ指標:

- session あたり data points
- new coverage slots / session
- repeat coverage slots / session
- frontier reduction / week
- env log density / mesh

心理指標:

- 「今日は無駄ではなかった」と感じた率
- 「地域の記録に貢献できた」と感じた率
- 検出ゼロ session 後の再開率

社会指標:

- contributor count
- effort hours
- revisited meshes
- comparable seasonal slots

---

## やらないこと

1. rare species jackpot を主報酬にすること
2. 1回の session の価値を種数だけで表すこと
3. 収集経路に重い LLM 処理を入れること
4. 画面ごとに別のメトリクスを使って一貫性を壊すこと

---

## 最初の一手

実装順はこれで固定するのが最も堅い。

1. `session_contributions` と `coverage_slots` を追加
2. `passive_event.php` final batch で ledger 計算
3. `session_recap.php` を ledger ベースへ切替
4. `field_research.php` の report UI を差し替え
5. `get_fog_data.php` / `MeshAggregator.php` を effort / frontier 対応

この順番なら、既存コードを壊さず、1変数ずつ価値検証できる。
