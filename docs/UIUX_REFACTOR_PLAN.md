# ikimon.life UI/UX 改善計画

> **作成日:** 2026-03-04
> **調査方法:** 本番サーバーから最新コードをダウンロード → ローカルPHPサーバーで全ページを実ブラウザ確認 + ソースコード詳細分析
> **対象ブランチ:** `main` → 本番デプロイ (`/snapshot` ワークフロー)

---

## 現状の問題サマリー

| 重大度 | 件数 | 代表的な問題 |
|--------|------|-------------|
| 🔴 致命的 | 3件 | dashboard.phpがサイトと別世界、PHP Warning表示、ナビ用語不統一 |
| 🟠 高 | 6件 | 英語テキスト混在、post.phpにナビなし、for-businessが別サイト |
| 🟡 中 | 7件 | レイアウト幅バラバラ、フッター有無不統一、メタタイトル不統一 |
| 🟢 低 | 4件 | ダークモード不整合、CDN版指定、アイコン混在 |

---

## Phase 1 — 用語・テキスト統一（推定工数: 2〜3時間）

### 1-1. ページ内テキストの統一

**対象ファイル・変更内容：**

#### `public_html/profile.php`
- `Observer Rank Score:` → `観察者スコア:`
- `次: XX ORS` → `次のランクまで: XX ポイント`
- `Lv.1` → そのまま可（数値として許容）
- `ikimonWalk` リンクのラベル → `さんぽ記録`

#### `public_html/ikimon_walk.php`
- ページ上部ラベル `FIELD NOTE` → 削除 or `さんぽ記録` に変更
- `距離 (km)` → `距離 (km)` はそのままでOK（単位は国際標準）
- `ウォークを開始` → `さんぽを始める`（任意）

#### `public_html/needs_id.php`
- `The Missing Matrix` → `未同定リスト`（h1タグ）
- `PRIORITY ACTION` バッジ → `要対応` or 削除
- `コックピット起動` ボタン → `同定ツールを開く`

#### `public_html/login.php`
- `Welcome to ikimon` → `ikimon へようこそ`

#### `public_html/components/nav.php`
- ドロップダウン内 `The Missing Matrix` → `未同定リスト`
- `IDセンター (同定)` → `同定センター`

#### `public_html/dashboard.php`
- ボトムナビ `SCOPE` → `さがす`
- ボトムナビ `ZUKAN` → `図鑑`
- ボトムナビ `CAPTURE` → `記録する`
- カードラベル `INSECTA` → `昆虫` 、`AVES` → `鳥類`、`FLORA` → `植物`、`HERPS` → `両爬`
- ヘッダー `FIELD LOG` → `フィールドログ`
- `NEXT GRADE (XX ORS)` → `次のランク (XX pt)`
- `EXPLORERS` → `近くの観察者`
- `GAP XX%` → `記録率 XX%`
- `SEASON: SUMMER` → `季節: 夏` （翻訳マップで対応）
- `TARGETS:` → `目標種数:`
- `AREA 1` → そのまま（ゾーン番号）

#### `public_html/explore.php`
- `ストランドマップ` → `活動経路マップ` (または `足跡マップ`)

---

### 1-2. PHP Warning の修正

#### `public_html/components/survey_panel.php` line 7
```php
// 修正前
if ($activeSurvey) {

// 修正後
if (!empty($activeSurvey)) {
```
または呼び出し元でデフォルト値を設定：
```php
$activeSurvey = $activeSurvey ?? null;
```

#### `libs/ObserverRank.php` line 99-104
```php
// 修正前
$fieldwork = $stats['fieldwork'];

// 修正後
$fieldwork = $stats['fieldwork'] ?? [];
```
→ `$fieldwork` を参照している各行に `?? 0` or `?? []` を追加

---

### 1-3. メタタイトルのフォーマット統一

**現状のバラつき:**
- `みつける | ikimon` (explore)
- `投稿する — ikimon.life | ikimon` (post、二重)
- `ネイチャーウェルネス — ikimon | ikimon` (wellness、二重)
- `ikimon - みんなでつくる 生き物図鑑` (dashboard、旧形式)

**統一フォーマット:** `{ページ名} | ikimon`

**対象ファイルと修正箇所：**

| ファイル | 現在のtitle | 修正後 |
|----------|------------|--------|
| `post.php` | `投稿する — ikimon.life` | `記録する \| ikimon` |
| `wellness.php` | `ネイチャーウェルネス — ikimon` | `ネイチャーウェルネス \| ikimon` |
| `dashboard.php` | (未設定 or 旧形式) | `ダッシュボード \| ikimon` |
| `compass.php` | (旧形式) | `生態地図コンパス \| ikimon` |
| `ikimon_walk.php` | `さんぽ記録 ---- ikimon` | `さんぽ記録 \| ikimon` |

---

## Phase 2 — ナビゲーション・構造改善（推定工数: 3〜4時間）

### 2-1. 「コンパス」と「ランキング」の名称を統一

**問題:** `compass.php` が「生態地図コンパス」「ランキング」「コンパス」の3名称で呼ばれている。

**統一方針:** 全て `コンパス` に統一（ページタイトルも「生態地図コンパス」のまま可）

**修正対象：**
- `public_html/components/nav.php`: ドロップダウン内 `ランキング` → `コンパス`
- `public_html/index.php`: Quick Nav の `コンパス` → そのままOK

---

### 2-2. post.php にミニナビを追加

**問題:** post.php はグローバルナビなし。×ボタンでindex.phpに戻るだけ。

**修正内容:** post.phpのヘッダーに最低限のナビ（戻る + サービス名）を追加、またはXボタンのリンク先をブラウザ履歴（`history.back()`）に変更。

```html
<!-- post.phpのヘッダー修正案 -->
<header class="fixed top-0 left-0 w-full z-50 bg-white/95 backdrop-blur border-b border-gray-100">
  <div class="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
    <!-- 修正前: onclick="location.href='index.php'" -->
    <!-- 修正後: -->
    <button onclick="history.length > 1 ? history.back() : location.href='index.php'"
            class="p-2 text-gray-500 hover:text-gray-800">
      <i data-lucide="x" class="w-5 h-5"></i>
    </button>
    <h1 class="text-sm font-black text-gray-800">記録する</h1>
    <a href="index.php" class="text-xs text-primary font-bold">ホーム</a>
  </div>
</header>
```

---

### 2-3. for-business にメインサイトへの戻り導線を追加

**修正対象:** `public_html/for-business/index.php`（および `for-business.php`）

**修正内容:** フッターに追加：
```html
<a href="/" class="text-sm text-gray-400 hover:text-white">← ikimon一般サイトへ</a>
```

ナビの `ikimon Business` ロゴにもリンクを追加（現在はメインサイトへのリンクなし）。

---

### 2-4. フッターの統一

**現状:** footer.phpを使っているのは zukan / wellness / ikimon_walk のみ。

**修正対象（フッター追加）:**
- `explore.php` — `<?php include __DIR__ . '/components/footer.php'; ?>` を追加
- `events.php` — 同上
- `profile.php` — 同上

**注意:** post.php / dashboard.php は独自レイアウトのため個別判断。

---

### 2-5. events.php の空ステート追加

**問題:** イベントが0件のとき真っ白（空ステートメッセージなし）。

**修正内容:**
```php
// イベント0件の場合の表示（events.phpのリスト表示部分に追加）
<?php if (empty($events)): ?>
  <div class="text-center py-16">
    <div class="text-5xl mb-4">🌿</div>
    <h3 class="text-lg font-black text-gray-700 mb-2">まだ観察会がありません</h3>
    <p class="text-sm text-gray-400 mb-6">最初の観察会を企画しましょう！</p>
    <a href="create_event.php" class="btn-primary px-6 py-2.5 inline-flex items-center gap-2">
      <i data-lucide="plus" class="w-4 h-4"></i> 観察会を作る
    </a>
  </div>
<?php endif; ?>
```

---

## Phase 3 — デザイン統一（推定工数: 5〜8時間）

### 3-1. bodyクラスの標準化

**統一方針:** 全コンテンツページで `class="js-loading bg-base text-text font-body pb-24 md:pb-0"` を標準とする。

**修正対象:**

| ファイル | 現在のbodyクラス | 修正後 |
|----------|----------------|--------|
| `zukan.php` | `app-body` | `js-loading bg-base text-text font-body pb-24 md:pb-0` |
| `events.php` | `bg-[var(--color-bg-base)] text-[var(--color-text)] font-sans` | 標準クラスに統一 |
| `ikimon_walk.php` | `bg-base text-text` | `font-body` を追加 |

---

### 3-2. レイアウト幅の標準化

**統一方針:** コンテンツページは `max-w-5xl`（64rem）を標準とする。

**修正対象:**

| ファイル | 現在 | 修正後 |
|----------|------|--------|
| `events.php` | `max-w-3xl` | `max-w-5xl` |
| `wellness.php` | `max-w-4xl` | `max-w-5xl` |

（explore.php / profile.php の `max-w-7xl` は情報量が多いため現状維持可）

---

### 3-3. Quick Nav アイコン配色の差別化

**問題:** 「図鑑」「コンパス」「さんぽ記録」が全て同じオレンジ系（`bg-accent-surface / text-accent`）。

**修正対象:** `public_html/index.php` のQuick Navセクション

```html
<!-- 現在: 3つとも bg-accent-surface -->
<!-- 修正案: 機能別に色分け -->
図鑑     → bg-accent-surface / text-accent    (オレンジ: そのまま)
探索マップ → bg-secondary-surface / text-secondary (青: そのまま)
観察会   → bg-primary-surface / text-primary   (緑: そのまま)
コンパス  → bg-purple-50 / text-purple-600     (紫: 新規)
さんぽ記録 → bg-emerald-50 / text-emerald-600  (エメラルド: 新規)
```

---

### 3-4. dashboard.php のデザイン方針（要検討・大規模）

**現状:** SFゲームHUD風、英語UI、Material Icons、スクロール不可、独自CSS。

**選択肢A（推奨）:** ikimon標準デザインに全面刷新
- `tactical.css` を廃止し `tokens.css` / `style.css` に統合
- Material Symbols → Lucide Icons に差し替え
- `overflow-hidden h-screen` → 通常スクロールレイアウトに変更
- 共通 `nav.php` を使用

**選択肢B（暫定）:** 英語テキストだけ日本語化してリリース、デザイン刷新は後回し
→ 本計画のPhase 1で対応済み

---

### 3-5. ダークモード対応の修正

**問題箇所と修正方法:**

#### `public_html/post.php`
```css
/* 修正前 */
:root { color-scheme: light only; }

/* 修正後 — ダークモード強制を解除 */
/* この行を削除 */
```

#### `public_html/events.php`（インラインCSS）
```css
/* 修正前 */
.event-card { background: white; ... }

/* 修正後 */
.event-card { background: var(--color-bg-elevated); ... }
```

#### `public_html/ikimon_walk.php`
```html
<!-- 修正前 -->
<div class="bg-blue-50 ...">
<div class="bg-emerald-50 ...">

<!-- 修正後 -->
<div class="bg-primary-surface ...">
<div class="bg-accent-surface ...">
```

---

### 3-6. 地図ライブラリの統一（長期）

**問題:** `post.php` が Leaflet を使用、他ページは MapLibre GL JS。

**方針:** `post.php` の位置選択マップを MapLibre GL JS に移行。
- ただし実装コストが高いため、Phase 3 の最後に対応。
- 暫定策: Leafletのバージョンを固定 (`leaflet@1.9.4`) して安定性を確保。

---

### 3-7. wellness.php のCDNバージョン固定

```html
<!-- 修正前（危険: 常に最新版を取得） -->
<script src="https://unpkg.com/lucide@latest"></script>
<script src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>

<!-- 修正後（バージョン固定） -->
<script src="https://unpkg.com/lucide@0.477.0/dist/umd/lucide.js"></script>
<script src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.9/dist/cdn.min.js"></script>
```
※ バージョン番号は他ページの `meta.php` の読み込みに合わせること。

---

## 実行順序チェックリスト

### Phase 1（2〜3時間）✅ 最優先
- [ ] 1-1. survey_panel.php の PHP Warning 修正
- [ ] 1-2. ObserverRank.php の PHP Warning 修正
- [ ] 1-3. profile.php の英語テキスト日本語化
- [ ] 1-4. needs_id.php の「The Missing Matrix」→「未同定リスト」
- [ ] 1-5. needs_id.php の「コックピット起動」→「同定ツールを開く」
- [ ] 1-6. login.php の「Welcome to ikimon」→「ikimon へようこそ」
- [ ] 1-7. ikimon_walk.php の「FIELD NOTE」ラベル日本語化
- [ ] 1-8. nav.php の「The Missing Matrix」「IDセンター (同定)」を日本語化
- [ ] 1-9. dashboard.php の英語ラベル日本語化（Phase 3-4の「選択肢B」）
- [ ] 1-10. メタタイトルのフォーマット統一（5ファイル）

### Phase 2（3〜4時間）
- [ ] 2-1. nav.php の「ランキング」→「コンパス」
- [ ] 2-2. post.php のXボタンを `history.back()` に変更 + ホームリンク追加
- [ ] 2-3. for-business に「← ikimon一般サイトへ」リンク追加
- [ ] 2-4. explore.php / events.php / profile.php にフッター追加
- [ ] 2-5. events.php に空ステートメッセージ追加
- [ ] 2-6. explore.php の「ストランドマップ」→「活動経路マップ」

### Phase 3（5〜8時間）
- [ ] 3-1. bodyクラスの標準化（zukan, events, ikimon_walk）
- [ ] 3-2. レイアウト幅の統一（events → max-w-5xl、wellness → max-w-5xl）
- [ ] 3-3. Quick Nav アイコン配色の差別化
- [ ] 3-4. post.php のダークモード強制を解除
- [ ] 3-5. events.php のハードコードカラーをCSS変数化
- [ ] 3-6. ikimon_walk.php のハードコードカラーをCSS変数化
- [ ] 3-7. wellness.php のCDNバージョン固定
- [ ] 3-8. dashboard.php のデザイン刷新（大規模・別途計画化推奨）

---

## ローカル開発環境の起動方法

```bash
# 1. サーバーから最新コードを取得（Windowsのbashから）
ssh production "cd ~/public_html/ikimon.life && zip -r /tmp/ikimon_full.zip libs/ lang/ config/ public_html/ -x 'public_html/uploads/photos/*'"
scp production:/tmp/ikimon_full.zip /c/Users/user/Documents/ikimon_review/ikimon_full.zip
cd /c/Users/user/Documents/ikimon_review && unzip -o ikimon_full.zip

# 2. データも取得（観察記録・ユーザーデータ）
ssh production "zip -r /tmp/ikimon_data.zip ~/public_html/ikimon.life/data/ -x '*/cache/*' '*/rate_limit/*' '*/papers/*'"
scp production:/tmp/ikimon_data.zip /c/Users/user/Documents/ikimon_review/ikimon_data.zip
cd /c/Users/user/Documents/ikimon_review && unzip -o ikimon_data.zip

# 3. config.php をローカル用に変更（初回のみ）
# session.cookie_secure = 0
# display_errors = 1

# 4. PHPサーバー起動
php -S localhost:8899 -t /c/Users/user/Documents/ikimon_review/public_html

# 5. 管理者ログイン
# http://localhost:8899/dev_admin_login.php にアクセス → 自動ログイン
```

---

## デプロイ

修正完了後は `/snapshot` ワークフローで GitHub にプッシュ → 本番自動デプロイ。

```
/snapshot
```

---

## 参考: 調査で発見した追加の問題（将来対応）

- `public_html/guide/guide/` — `guide/guide/` という二重パスが存在（意図的？）
- `public_html/ikimon.life_temp/` — tempディレクトリがpublic_html内に残存（要削除）
- `public_html/api/ai_suggest.php.bak_20260227` — .bakファイルが公開ディレクトリに存在（セキュリティリスク）
- `public_html/dev_admin_login.php` — 本番環境に残っている（認証なしでadminログイン可能、要削除か保護）
- `wellness.php` の「← 戻る」が `profile.php` 固定 → `history.back()` に変更推奨
- `profile.php` のアバタークリックメニューがモバイルで気づきにくい（ホバー頼り）
