# OAuth APIキー設定ガイド（最短ルート）

## 1. Google OAuth（3分）

1. https://console.cloud.google.com/apis/credentials を開く
2. プロジェクトがなければ「新しいプロジェクト」→ 名前: `ikimon` → 作成
3. 左メニュー「OAuth 同意画面」→ **外部** → 作成
   - アプリ名: `ikimon`
   - サポートメール: 自分のGmail
   - デベロッパー連絡先: 同じGmail
   - → 保存して次へ（スコープ等は全部スキップ）
4. 左メニュー「認証情報」→ **＋認証情報を作成** → **OAuthクライアントID**
   - アプリの種類: **ウェブアプリケーション**
   - 名前: `ikimon web`
   - **承認済みリダイレクトURI に追加**:
     ```
     https://ikimon.life/oauth_callback.php?provider=google
     http://localhost:8899/oauth_callback.php?provider=google
     ```
   - → 作成
5. 表示された **クライアントID** と **クライアントシークレット** をコピー

## 2. X (Twitter) OAuth（3分）

1. https://developer.x.com/en/portal/dashboard を開く
2. 「Create Project」→ 名前: `ikimon` → Use Case: いずれか選択
3. 「Create App」→ 名前: `ikimon-web`
4. App Settings → **User authentication settings** → Set up
   - **OAuth 2.0**: ON
   - Type of App: **Web App**
   - Callback URI:
     ```
     https://ikimon.life/oauth_callback.php?provider=twitter
     http://localhost:8899/oauth_callback.php?provider=twitter
     ```
   - Website URL: `https://ikimon.life`
   - → Save
5. 表示された **Client ID** と **Client Secret** をコピー

## 3. 設定ファイルに貼り付け

`upload_package/config/oauth_config.php` を開いて:

```php
define('GOOGLE_CLIENT_ID', 'ここにGoogleのクライアントID');
define('GOOGLE_CLIENT_SECRET', 'ここにGoogleのシークレット');

define('TWITTER_CLIENT_ID', 'ここにXのClient ID');
define('TWITTER_CLIENT_SECRET', 'ここにXのClient Secret');
```

## 4. 完了確認

ログイン画面に「Googleでログイン」「Xでログイン」ボタンが出ればOK。
キーが空の場合はボタンが出ない（安全設計）。
