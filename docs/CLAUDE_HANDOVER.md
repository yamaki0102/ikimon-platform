# Claude への引き継ぎメッセージ

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

## 今日やってほしいこと

**`docs/UIUX_REFACTOR_PLAN.md` を読んで、Phase 1から順番に修正を実施してほしい。**

優先度が高い順に：

### Phase 1（まずここから）
1. `public_html/components/survey_panel.php` line 7 の PHP Warning 修正
2. `libs/ObserverRank.php` line 99-104 の PHP Warning 修正
3. `public_html/profile.php` の英語テキスト日本語化（Observer Rank Score, ORS）
4. `public_html/needs_id.php` の「The Missing Matrix」→「未同定リスト」、「コックピット起動」→「同定ツールを開く」
5. `public_html/login.php` の「Welcome to ikimon」→「ikimon へようこそ」
6. `public_html/ikimon_walk.php` の「FIELD NOTE」ラベル日本語化
7. `public_html/components/nav.php` の「The Missing Matrix」「IDセンター (同定)」を日本語化
8. `public_html/dashboard.php` の英語ラベルを日本語化（INSECTA→昆虫、AVES→鳥類、SCOPE→さがす、等）
9. メタタイトルのフォーマットを `{ページ名} | ikimon` に統一

### Phase 2（余裕があれば）
- nav.phpの「ランキング」→「コンパス」
- post.phpのXボタンを `history.back()` に変更
- for-businessにメインサイトへの戻りリンク追加
- events.phpに空ステートメッセージ追加
- explore.phpの「ストランドマップ」→「活動経路マップ」

## ローカル開発環境

前回ダウンロードしたコードがすでにある：
```
C:\Users\user\Documents\ikimon_review\
├── public_html/   ← Webルート
├── libs/
├── lang/
├── config/
└── data/
```

PHPサーバー起動（ポート8899がすでに動いているかもしれない）：
```bash
# すでに起動中か確認
curl -s -o /dev/null -w "%{http_code}" http://localhost:8899/

# 起動していなければ
php -S localhost:8899 -t /c/Users/user/Documents/ikimon_review/public_html
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
   （temp cloneで）
   ↓
4. /snapshot ワークフローで本番デプロイ
```

## 重要な注意事項

- **サーバーの真のWebルートは `~/public_html/ikimon.life/public_html/`**（二重構造）
- **SiteManager は全メソッドstatic** → `new SiteManager()` は誤り
- **DataStore::getAll() は存在しない** → `fetchAll($resource)` を使う
- `public_html/dev_admin_login.php` は本番に存在する（認証なし管理者ログイン）→ 将来的に保護が必要

## SSH接続情報

```
SSH alias: production
実際のコマンド: ssh r1522484@www1070.onamae.ne.jp -p 8022
キー: ~/.ssh/antigravity.pem
```

よろしく！
