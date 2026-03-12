# ikimon.life イベントキット — 開発仕様書

## 概要

施設・団体が「QRコード1枚」で ikimon.life 上のいきもの観察イベントを即開催できる仕組み。
既存機能（Events, SiteManager, Bingo, Gamification）の薄いラッパーとして実装する。

### ゴール
- 動物園・水族館・自然公園・遊園地・学校・企業が、最小の手間でいきもの観察イベントを開催できる
- 参加者はQRコードを読むだけで参加（ゲストOK、登録不要）
- イベント終了後に成果を自動レポート化

### 設計原則
- **既存コードを最大限再利用**する。新しいlibsは作らない
- 既存の `events.php`, `create_event.php`, `event_detail.php`, `bingo.php` を拡張する
- データ構造は既存の events JSON にフィールド追加で対応

---

## 現行アーキテクチャ（参照）

```
public_html/
├── events.php              # イベント一覧
├── event_detail.php        # イベント詳細
├── create_event.php        # イベント作成
├── edit_event.php          # イベント編集
├── bingo.php               # ビンゴゲーム
├── api/
│   ├── get_events.php      # イベント一覧API
│   ├── save_event.php      # イベント保存API
│   ├── join_event.php      # イベント参加API
│   ├── get_event_log.php   # イベントログAPI
│   ├── get_event_live.php  # リアルタイムイベントAPI
│   └── generate_bingo_template.php  # ビンゴ生成API
├── libs/
│   ├── SiteManager.php     # GeoJSONサイト管理
│   ├── QuestManager.php    # クエスト管理
│   ├── BadgeManager.php    # バッジ管理
│   ├── Gamification.php    # ゲーミフィケーション統合
│   └── DataStore.php       # JSON I/O
└── data/
    ├── events/             # イベントデータ
    ├── observations/       # 観察データ（YYYY-MM.json）
    └── config/
        ├── quests.json     # クエスト定義
        └── badges.json     # バッジ定義
```

---

## 追加機能 4つ

### 機能1: イベントQRコード生成

#### 概要
イベント作成時に、参加用URLのQRコードを自動生成。印刷してポスター等に貼れる。

#### 実装方針
- QRコード生成はクライアントサイドJSライブラリを使用（`qrcode.js` or similar CDN）
- サーバーサイド変更は不要（URLを生成するだけ）

#### 変更ファイル
- `event_detail.php` — QRコード表示セクション追加

#### 詳細

```html
<!-- event_detail.php に追加 -->
<div id="event-qr" class="text-center p-6 bg-white rounded-xl border">
  <h3 class="text-lg font-bold mb-2">参加用QRコード</h3>
  <div id="qr-canvas"></div>
  <p class="text-sm text-gray-500 mt-2">このQRコードを印刷して掲示してください</p>
  <button onclick="downloadQR()" class="btn btn-secondary mt-3">QR画像をダウンロード</button>
</div>
```

QRが指すURL: `https://ikimon.life/event_detail.php?id={eventId}&action=join`

`action=join` パラメータがあるとき、ページ読み込み時に自動で参加ダイアログを表示する。
ゲストの場合はそのまま参加可能（既存のゲストUUID方式を利用）。

#### QRライブラリ
CDNで `qrcode.min.js`（MIT License）を読み込む。例:
```
https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js
```

---

### 機能2: イベント内リーダーボード

#### 概要
イベント参加者の投稿数・発見種数をリアルタイムでランキング表示。

#### 変更ファイル
- `event_detail.php` — リーダーボードセクション追加
- `api/get_event_leaderboard.php` — **新規作成**

#### API仕様: `GET /api/get_event_leaderboard.php`

**パラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| event_id | string | yes | イベントID |

**レスポンス:**
```json
{
  "success": true,
  "leaderboard": [
    {
      "user_id": "user_xxx",
      "user_name": "たろう",
      "avatar": "uploads/avatars/xxx.webp",
      "observation_count": 12,
      "species_count": 8,
      "latest_observation": "2026-03-12T14:30:00"
    }
  ],
  "event_stats": {
    "total_observations": 45,
    "total_species": 23,
    "total_participants": 15,
    "top_species": [
      { "name": "スズメ", "count": 5 },
      { "name": "シジュウカラ", "count": 3 }
    ]
  }
}
```

#### ロジック

```php
// api/get_event_leaderboard.php

// 1. イベントデータ取得
$event = DataStore::read('events', $eventId);

// 2. イベント参加者リスト取得
$participants = $event['participants'] ?? [];

// 3. イベント期間内の全観察を取得
//    - 期間: $event['start_date'] 〜 $event['end_date']
//    - エリア: $event['site_id'] がある場合はSiteManager::isPointInGeometry()で絞る
//    - 投稿者: $participants に含まれるユーザーのみ

// 4. ユーザーごとに集計
//    - observation_count: 観察数
//    - species_count: ユニークな taxon.key 数

// 5. observation_count desc → species_count desc でソート
```

#### UI（event_detail.php）

```html
<div id="leaderboard" class="mt-6" x-data="leaderboard()" x-init="load()">
  <h3 class="text-lg font-bold mb-3">🏆 ランキング</h3>

  <!-- イベント全体統計 -->
  <div class="grid grid-cols-3 gap-3 mb-4">
    <div class="stat-card">
      <div class="stat-value" x-text="stats.total_observations">0</div>
      <div class="stat-label">観察数</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" x-text="stats.total_species">0</div>
      <div class="stat-label">発見種数</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" x-text="stats.total_participants">0</div>
      <div class="stat-label">参加者</div>
    </div>
  </div>

  <!-- 個人ランキング -->
  <div class="space-y-2">
    <template x-for="(entry, i) in leaderboard" :key="entry.user_id">
      <div class="flex items-center gap-3 p-3 bg-white rounded-lg border">
        <span class="rank-badge" x-text="i + 1"></span>
        <img :src="entry.avatar || '/assets/default-avatar.svg'" class="w-8 h-8 rounded-full">
        <div class="flex-1">
          <div class="font-medium" x-text="entry.user_name"></div>
          <div class="text-xs text-gray-500">
            <span x-text="entry.observation_count"></span>件 ・
            <span x-text="entry.species_count"></span>種
          </div>
        </div>
      </div>
    </template>
  </div>
</div>
```

30秒ごとにポーリングで更新（`setInterval`）。

---

### 機能3: エリア連動ビンゴ自動生成

#### 概要
イベントのエリア（SiteManager）内で過去に記録された種から、自動でビンゴカードを生成。

#### 変更ファイル
- `api/generate_bingo_template.php` — 既存を拡張（`event_id` パラメータ追加）
- `create_event.php` — ビンゴ有効化チェックボックス追加

#### ロジック拡張

```php
// generate_bingo_template.php に追加

if (isset($_GET['event_id'])) {
    $event = DataStore::read('events', $eventId);

    if (!empty($event['site_id'])) {
        // エリア内の過去の観察から種リストを取得
        $observations = SiteManager::getObservationsInSite($event['site_id']);
        $speciesList = [];
        foreach ($observations as $obs) {
            if (!empty($obs['taxon']['name'])) {
                $key = $obs['taxon']['key'] ?? $obs['taxon']['name'];
                if (!isset($speciesList[$key])) {
                    $speciesList[$key] = [
                        'name' => $obs['taxon']['name'],
                        'count' => 0
                    ];
                }
                $speciesList[$key]['count']++;
            }
        }

        // 出現頻度でソート → 上位25種でビンゴ生成
        // 難易度バランス: 頻出種（簡単）と稀少種（難しい）を混ぜる
        usort($speciesList, fn($a, $b) => $b['count'] - $a['count']);

        // 上位50%から12種 + 下位50%から12種 + FREE = 25マス
        $easy = array_slice($speciesList, 0, ceil(count($speciesList) / 2));
        $hard = array_slice($speciesList, ceil(count($speciesList) / 2));

        $selected = array_merge(
            array_slice($easy, 0, min(12, count($easy))),
            array_slice($hard, 0, min(12, count($hard)))
        );
        shuffle($selected);

        // 25マスに足りない場合は分類群カテゴリで補完
        // 例: 「鳥類」「昆虫」「植物」などの大カテゴリ
    }
}
```

#### イベント作成時のUI追加

```html
<!-- create_event.php に追加 -->
<div class="form-group">
  <label>
    <input type="checkbox" name="enable_bingo" value="1">
    ビンゴカードを自動生成する
  </label>
  <p class="text-xs text-gray-500">
    エリア内で過去に記録された種からビンゴカードを作ります
  </p>
</div>
```

#### イベントデータへの追加フィールド

```json
{
  "id": "evt_xxx",
  "name": "浜名湖いきもの探検",
  "enable_bingo": true,
  "bingo_species": ["スズメ", "シジュウカラ", ...],
  "...existing fields..."
}
```

---

### 機能4: イベント結果サマリーページ

#### 概要
イベント終了後、成果をまとめたページを自動生成。参加者・施設・SNSでシェア可能。

#### 変更ファイル
- `event_detail.php` — 終了後モードの表示切り替え

#### 表示条件
- `$event['end_date'] < now()` のとき、通常表示→サマリー表示に切り替え

#### サマリー内容

```html
<div class="event-summary" x-show="isEnded">
  <div class="text-center py-8">
    <h2 class="text-2xl font-bold">🎉 イベント結果</h2>
    <p class="text-gray-600" x-text="event.name"></p>
  </div>

  <!-- 成果カード -->
  <div class="grid grid-cols-2 gap-4 mb-6">
    <div class="result-card bg-green-50">
      <div class="text-3xl font-bold text-green-700" x-text="stats.total_observations">0</div>
      <div>観察記録</div>
    </div>
    <div class="result-card bg-blue-50">
      <div class="text-3xl font-bold text-blue-700" x-text="stats.total_species">0</div>
      <div>発見された種</div>
    </div>
    <div class="result-card bg-purple-50">
      <div class="text-3xl font-bold text-purple-700" x-text="stats.total_participants">0</div>
      <div>参加者</div>
    </div>
    <div class="result-card bg-amber-50">
      <div class="text-3xl font-bold text-amber-700" x-text="stats.event_days">0</div>
      <div>開催日数</div>
    </div>
  </div>

  <!-- 写真ハイライト（いいね数上位6枚） -->
  <h3 class="font-bold mb-3">📸 ベストショット</h3>
  <div class="grid grid-cols-3 gap-2 mb-6">
    <template x-for="photo in topPhotos" :key="photo.id">
      <img :src="photo.url" class="rounded-lg aspect-square object-cover">
    </template>
  </div>

  <!-- 最終ランキング（上位5名） -->
  <h3 class="font-bold mb-3">🏆 トップ観察者</h3>
  <!-- リーダーボードと同じUIで上位5名表示 -->

  <!-- SNSシェアボタン -->
  <div class="flex gap-3 justify-center mt-8">
    <button onclick="shareTwitter()" class="btn">Xでシェア</button>
    <button onclick="shareLine()" class="btn">LINEでシェア</button>
    <button onclick="copyLink()" class="btn">リンクをコピー</button>
  </div>
</div>
```

#### シェアテキストテンプレート

```
🌿 {イベント名} の結果！
📊 {観察数}件の記録 / {種数}種を発見 / {参加者数}人が参加
🔗 {URL}
#ikimonlife #いきもの観察
```

---

## イベントデータ構造（拡張後）

既存の events データに以下のフィールドを追加:

```json
{
  "id": "evt_20260315_hamanakowl",
  "name": "浜名湖いきもの探検隊",
  "description": "浜名湖周辺の生き物を探して記録しよう！",
  "organizer_id": "user_xxx",
  "organizer_name": "浜名湖ワンダーレイク",
  "start_date": "2026-04-01T09:00:00",
  "end_date": "2026-04-30T18:00:00",
  "participants": ["user_xxx", "guest_yyy"],
  "created_at": "2026-03-15T10:00:00",

  "site_id": "site_hamanako_area",
  "enable_bingo": true,
  "bingo_species": ["スズメ", "カワセミ", "アマモ", "..."],
  "enable_leaderboard": true,
  "event_type": "open",
  "cover_image": "uploads/events/hamanakowl.webp"
}
```

新規フィールド:
- `site_id` (string|null) — SiteManagerのサイトIDと紐付け。エリア限定する場合に設定
- `enable_bingo` (bool) — ビンゴカード生成を有効化
- `bingo_species` (array) — ビンゴに使用する種リスト（自動生成 or 手動設定）
- `enable_leaderboard` (bool) — リーダーボード表示を有効化
- `event_type` (string) — "open"（誰でも参加）/ "invite"（招待制）
- `cover_image` (string|null) — カバー画像パス

---

## 実装優先順

| 順番 | 機能 | 工数 | 依存 |
|---|---|---|---|
| 1 | イベントQRコード生成 | 0.5日 | なし |
| 2 | イベント内リーダーボード | 2日 | API新規作成 |
| 3 | イベント結果サマリー | 1日 | リーダーボードAPI |
| 4 | エリア連動ビンゴ自動生成 | 1.5日 | SiteManager既存データ |

合計: 約5日

---

## テスト計画

### 手動テスト
1. イベント作成 → QRコード表示 → QRスキャンで参加URL到達
2. ゲストユーザーがQRから参加 → 投稿 → リーダーボードに反映
3. 複数ユーザーで投稿 → ランキング順序確認
4. イベント終了日を過ぎた後 → サマリーページ表示
5. site_id 設定済みイベント → ビンゴカード自動生成 → 種リスト確認

### エッジケース
- 参加者0人のイベントのリーダーボード
- site_id なし（エリア制限なし）のイベント
- 過去の観察データがないエリアのビンゴ生成（フォールバック: 汎用カテゴリ）
- ゲストユーザーのアバター表示（デフォルト画像）

---

## 注意事項

- `DataStore` の `LOCK_EX` を必ず使用（同時参加対策）
- 観察データのパーティションは `created_at`（投稿月）ベース。期間フィルタ時に複数月を跨ぐ場合は全月読み込み
- QRコードライブラリはCDN利用。`components/meta.php` の外部スクリプト読み込みに追加
- CSP nonce を忘れずに適用
- ゲストユーザーの `user_name` は「ゲスト」表示。リーダーボードでは区別がつくよう `guest_` prefix で判定
