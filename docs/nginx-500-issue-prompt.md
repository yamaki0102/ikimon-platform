# ikimon.life 本番障害: POST /api/post_observation.php が 500 を返す

## 状況

お名前ドットコム RS プランで運営中の ikimon.life で、観察投稿 API (`POST /api/post_observation.php`) が HTTP 500（空ボディ）を返し、ユーザーが投稿できない。

## サーバー構成

- **フロント**: nginx/1.24.0 (リバースプロキシ、ユーザー管理不可)
- **バックエンド**: LiteSpeed + lsphp (PHP 8.3.30)
- **ホスティング**: お名前ドットコム RS Plan (共有ホスティング)
- **PHP**: lsphp バイナリ、opcache 有効 (`validate_timestamps=On`, `revalidate_freq=2`)

## 症状

1. `curl -X POST https://ikimon.life/api/post_observation.php` → **HTTP 500, ボディ 0バイト**
2. `curl -X POST http://localhost:8080/api/post_observation.php -H "Host: ikimon.life"` → **HTTP 200, 正常な JSON レスポンス** (Apache バックエンド直接)
3. `php -r "include 'post_observation.php';"` (CLI) → **正常動作**
4. 他のエンドポイント (`post_identification.php`, `get_observations.php`) は nginx 経由でも正常

## 調査結果

### nginx レイヤー
- `post_observation.php` への全リクエスト (GET/POST/PURGE/multipart) が同じ 500 を返す
- レスポンスヘッダーに `Content-Type: application/json; charset=utf-8` が含まれる（PHP が一度は実行された痕跡）
- コンパネの「高速化（キャッシュ）」からキャッシュ削除 → **効果なし**
- サーバーキャッシュ OFF → **効果なし**
- `Cache-Control: no-cache` リクエストヘッダー → **効果なし**
- クエリストリング付き (`?_t=timestamp`) → **効果なし**

### PHP/opcache レイヤー
- post.php をサーバーで書き換えても、レスポンスに反映されない（ファイルを1行に置き換えても旧HTML が返る）
- **ただし CSP nonce はリクエストごとに異なる** → PHP は実行されているが、opcache が古いバイトコードを返している
- `kill <lsphp_pid>` → **効果なし**（共有ホスティングのため opcache 共有メモリはクリアされない）
- `.user.ini` に `opcache.revalidate_freq=0` → **5分待っても効果なし**
- ファイル削除→再作成（inode 変更）→ **効果なし**

### コード検証
- `post_observation.php` の全依存ライブラリの構文チェック → **エラーなし**
- Apache バックエンド (port 8080) で有効な CSRF トークン付きの完全なフローテスト → **正常動作**（「写真がアップロードされていません」のバリデーションエラー）
- デプロイ前のバックアップ版を復元 → **同じ 500**（nginx レイヤーの問題）

## 確認済みの事実

| 項目 | 結果 |
|------|------|
| PHP コードに問題 | **なし** (Apache 直接で動作確認) |
| nginx キャッシュ | 500 がキャッシュされ、コンパネからクリア不可 |
| opcache | 古いバイトコードが固定、ファイル変更を無視 |
| PHP バージョン変更 | 効果なし |
| lsphp kill | 効果なし |
| .user.ini | 効果なし |

## 質問

1. お名前ドットコム RS プランで nginx リバースプロキシキャッシュをクリアする方法はあるか？
2. lsphp の opcache を強制的にリセットする方法はあるか？（共有ホスティング、root 権限なし）
3. nginx を経由せずにユーザーリクエストを直接 LiteSpeed/Apache に到達させる方法はあるか？
4. `.htaccess` レベルで nginx キャッシュをバイパスするテクニックはあるか？
5. 根本的にこの問題を解決するために、サーバー移行（VPS 等）を検討すべきか？

## 試したワークアラウンド（部分的に機能）

- `post_identification.php` に `?_route=observation` ルーティングを追加 → API レイヤーは動作する
- post.php にインライン fetch オーバーライドを追加 → **opcache が反映しないため機能せず**
- JS ファイルのバージョン変更 → **nginx 静的ファイルキャッシュで反映せず**

## 環境情報

- SSH: `r1522484@www1070.onamae.ne.jp -p 8022`
- サイトルート: `~/public_html/ikimon.life/`
- Web ルート: `~/public_html/ikimon.life/public_html/`
- PHP プロセス: lsphp (PID は自動再起動で変動)
- Xserver VPS (12GB, Ubuntu 24.04) を別途契約済み → 移行先候補
