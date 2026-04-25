# Claude への引き継ぎメッセージ

> 注意: このファイルは 2026-03 系の handover。直近の続きは `docs/CLAUDE_HANDOVER_2026-04-12_MULTILINGUAL_STAGING_UI.md` を優先してください。

> このファイルの内容をそのままClaude Codeに貼り付けて会話を始めてください。

---

こんにちは。ikimon.life（生物多様性市民参加プラットフォーム）のUI/UX改善作業を引き継いでほしい。

## プロジェクト概要

- **サービス:** https://ikimon.life
- **GitHubリポジトリ:** `yamaki0102/ikimon-platform`
- **技術スタック:** PHP 8.2 / Alpine.js / Tailwind CSS (CDN) / Lucide Icons / MapLibre GL JS
- **本番サーバー:** お名前.com RS Plan（SSH alias: `production`）
- **デプロイ方法:** `/snapshot` ワークフローでGitHubにpush → 本番に zip+SCP でデプロイ

## 前回セッションでやったこと

1. **UI/UX監査を実施済み**
   - 本番サーバーから最新コードをダウンロードしてローカルPHPサーバーで全ページを実ブラウザ確認
   - ソースコード（9主要ページ）を詳細分析
   - 問題点を優先度別にリスト化

2. **修正計画を作成してGitHubにプッシュ済み**
   - 詳細計画: `docs/UIUX_REFACTOR_PLAN.md`（このファイルと同じフォルダ）

3. **Phase 1〜3 の UI/UX 修正を完了・本番デプロイ済み（2026-03-04）**
   - **Phase 1（コミット: a100843）:** 英語テキスト日本語化 + PHP Warning 修正
     - profile.php, needs_id.php, login.php, ikimon_walk.php, nav.php, dashboard.php の日本語化
     - survey_panel.php / ObserverRank.php のPHP Warning修正
     - メタタイトル統一（post.php, wellness.php, dashboard.php, compass.php, ikimon_walk.php）
   - **Phase 2 + 3（コミット: 2c5597a）:** ナビ・構造・デザイン改善（20ファイル変更）
     - nav.php 「ランキング」→「コンパス」
     - post.php のXボタン → `history.back()` + ホームリンク
     - for-business に一般サイト戻りリンク追加
     - explore.php / events.php / profile.php にフッター追加
     - events.php に空ステートメッセージ追加
     - explore.php 「ストランドマップ」→「活動経路マップ」
     - bodyクラス・レイアウト幅の標準化（zukan, events, ikimon_walk）
     - ダークモード対応修正（post.php, events.php, ikimon_walk.php）
     - wellness.php の CDN バージョン固定（@latest 解消）

## 今日やってほしいこと

**`docs/UIUX_REFACTOR_PLAN.md` で未完了の項目と、新たに発見されたモバイルUI課題を対応してほしい。**

### 優先度: 🔴 セキュリティ
1. `public_html/dev_admin_login.php` — 本番環境に認証なしadminログインが残存
   - 最低限: IP制限 or Basic認証でアクセス制御
   - 理想: ファイル削除 or ステージング環境のみ有効化
2. `@latest` CDN が残り3ファイルに存在（wellness.phpは対応済み）
   - 対象: `explore.php`, `events.php`, `compass.php` など（ソースで `@latest` を検索）
   - 全て特定バージョンに固定する（lucide@0.477.0, alpinejs@3.14.9）

### 優先度: 🟠 品質
3. **Quick Navアイコン配色の差別化（3-3）** — `public_html/index.php`
   - 詳細は `UIUX_REFACTOR_PLAN.md` の 3-3 セクション参照
4. **メタタイトル残り統一** — `UIUX_REFACTOR_PLAN.md` で未対応のファイルを確認して修正

### 優先度: 🟡 モバイルUI（新規発見）
5. **ボトムナビのタップ領域** — アイコン+ラベルが小さくタップしにくい
   - 各ナビアイテムの min-height を 56px 以上に設定
6. **ヘッダーオーバーラップ** — fixed ヘッダーがコンテンツの先頭を隠す
   - `body` または最初の main 要素に `pt-14`（ヘッダー高さ分）を付与
7. **行間修正** — 一部ページで日本語テキストの行間が詰まりすぎ
   - `leading-relaxed`（1.625）を基本に統一

### 優先度: ⚪ 大規模（別途計画推奨）
8. **dashboard.php 刷新（3-8）** — SFゲームHUD風デザインを ikimon 標準に全面刷新
   - 工数が大きいため、別セッションで計画を立ててから実施推奨
   - 方針は `UIUX_REFACTOR_PLAN.md` の 3-4「選択肢A」参照

## ローカル開発環境

```
C:\Users\YAMAKI\Documents\ikimon_review\
├── public_html/   ← Webルート
├── libs/
├── lang/
├── config/
└── data/
```

PHPサーバー起動（ポート8899）：
```bash
# すでに起動中か確認
curl -s -o /dev/null -w "%{http_code}" http://localhost:8899/

# 起動していなければ
php -S localhost:8899 -t /c/Users/YAMAKI/Documents/ikimon_review/public_html
```

管理者ログイン：
```
http://localhost:8899/dev_admin_login.php
```

## 修正→反映のワークフロー

```
1. ローカルでファイルを修正
   ↓
2. ブラウザで http://localhost:8899/ を確認
   ↓
3. 問題なければ、修正ファイルをGitHubのikimon-platformリポジトリにコピーしてpush
   （/tmp/ikimon-platform-push で作業）
   ↓
4. /snapshot ワークフローで本番デプロイ
```

## 重要な注意事項

- **サーバーの真のWebルートは `~/public_html/ikimon.life/public_html/`**（二重構造）
- **SiteManager は全メソッドstatic** → `new SiteManager()` は誤り
- **DataStore::getAll() は存在しない** → `fetchAll($resource)` を使う
- `public_html/dev_admin_login.php` は本番に存在する（認証なし管理者ログイン）→ **要対応**

## SSH接続情報

```
SSH alias: production
実際のコマンド: ssh r1522484@www1070.onamae.ne.jp -p 8022
キー: ~/.ssh/antigravity.pem
```

よろしく！
