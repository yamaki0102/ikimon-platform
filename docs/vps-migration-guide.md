# ikimon.life VPS移行ガイド

最終更新: 2026-03-20

## 1. 移行背景

今回の移行は「性能改善」ではなく「共有ホスティング障害からの脱出」が主目的。
2026-03 時点で、お名前ドットコム RS Plan 本番では以下が確認されている。

- `POST /api/post_observation.php` が nginx 経由で `HTTP 500` を返す一方、Apache/LiteSpeed 直叩きでは正常
- `post_observation.php` 自体の PHP コードは構文・実行ともに正常
- `post.php` や一部 JS の更新が反映されず、opcache / 上流キャッシュの制御権が利用者側にない
- `post_identification.php?_route=observation` のような別パス経由では回避できるため、壊れているのは「コード」より「特定パスと共有ホストのキャッシュ層」
- write API を持つプロダクトを、reverse proxy purge / process restart / opcache reset を握れない共有ホストで運用し続けるのは危険

結論:

- 現行障害の根本原因はアプリ実装ではなく、共有環境のキャッシュ・実行基盤
- 応急処置は可能でも、再発防止には VPS へ移す方が筋がいい

---

## 2. VPS スペック・SSH 情報

### 移行先

| 項目 | 値 |
|---|---|
| プラン | Xserver VPS 8GB（メモリ増設で 12GB 運用） |
| vCPU | 6 コア |
| SSD | 400GB NVMe |
| OS | Ubuntu 24.04 LTS |
| IP | `162.43.44.131` |
| ホスト名 | `x162-43-44-131.static.xvps.ne.jp` |
| SSH | `ssh -i C:\Users\YAMAKI\Downloads\ikimon.pem root@162.43.44.131` |

### VPS 側の前提

- Web: nginx + PHP-FPM
- PHP: 8.2 系を前提
- 既に PostgreSQL / PostGIS / TimescaleDB は入っているが、今回の移行フェーズでは **JSON ストレージをそのまま持っていく**
- DB 切替は今回の必須条件ではない

---

## 3. 現行環境の構成・パス・ディレクトリ構造

### 現行本番

| 項目 | 値 |
|---|---|
| ホスティング | お名前ドットコム RS Plan |
| SSH | `ssh -i ~/.ssh/antigravity.pem r1522484@www1070.onamae.ne.jp -p 8022` |
| サイトルート | `~/public_html/ikimon.life/` |
| Web ルート | `~/public_html/ikimon.life/public_html/` |
| データ | `~/public_html/ikimon.life/data/` |
| 画像アップロード | `~/public_html/ikimon.life/public_html/uploads/photos/` |
| Web 構成 | nginx -> LiteSpeed / lsphp |
| PHP | 8.3.30 |

### 注意

- リポジトリ直下の `deploy.json` は `RemoteBase: "~/public_html/"` になっており、**現行本番の実パス `~/public_html/ikimon.life/` とズレている**
- 本ガイドでは **実運用パス** を正とする

### リポジトリ / デプロイ構造

```text
ikimon.life/
├── deploy.json
├── upload_package/
│   ├── .htaccess                 # 共有ホスト用: public_html/ へ振り分け
│   ├── config/
│   │   ├── config.php
│   │   └── oauth_config.php
│   ├── data/                     # JSON ストレージ
│   ├── lang/
│   ├── libs/
│   ├── public_html/              # 真の公開ルート
│   │   ├── .htaccess
│   │   ├── index.php
│   │   ├── post.php
│   │   ├── api/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── js/
│   │   ├── uploads/
│   │   ├── sw.js
│   │   └── manifest.json
│   └── scripts/
└── docs/
```

### `config/config.php` の実態

このプロジェクトはパスをハードコードしていない。

```php
define('ROOT_DIR', dirname(__DIR__));
define('DATA_DIR', ROOT_DIR . '/data');
define('LIBS_DIR', ROOT_DIR . '/libs');
define('PUBLIC_DIR', ROOT_DIR . '/public_html');
```

つまり VPS 側でも **ディレクトリ階層を維持すれば `config.php` のパス修正は不要**。

必要なのは:

- 現在の VPS 配信ルートは `/var/www/ikimon.life/repo/upload_package/`
- `upload_package/` の中身を **この配信ルート** にそのまま展開すること
- `config/secret.php` や環境変数を新サーバーで用意すること
- ドメイン / SSL / nginx / PHP-FPM を VPS 側で正しく張ること

---

## 4. 6フェーズの移行手順

### Phase 1: nginx / PHP-FPM 準備

実ファイル:

- `ops/nginx/ikimon.life.conf`

1. 配置先を作る

```bash
mkdir -p /var/www/ikimon.life
mkdir -p /var/www/ikimon.life/repo/upload_package
mkdir -p /var/www/ikimon.life/repo/upload_package/{config,data,lang,libs,public_html,scripts}
mkdir -p /var/www/ikimon.life/repo/upload_package/public_html/uploads
```

2. PHP-FPM と nginx の前提を揃える

- `client_max_body_size 32m`
- `upload_max_filesize=32M`
- `post_max_size=32M`
- `memory_limit=256M`
- `opcache.validate_timestamps=1`
- `opcache.revalidate_freq=2`
- `display_errors=Off`

3. nginx の site 設定を作る

推奨: `/etc/nginx/sites-available/ikimon.life`

```nginx
server {
    listen 80;
    server_name ikimon.life www.ikimon.life;

    root /var/www/ikimon.life/repo/upload_package/public_html;
    index index.php index.html;

    client_max_body_size 32m;

    error_page 403 /403.php;
    error_page 404 /404.php;

    location = /favicon.ico {
        log_not_found off;
        access_log off;
    }

    location = /robots.txt {
        log_not_found off;
        access_log off;
    }

    location /api/ {
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        try_files $uri =404;
    }

    location ~ ^/(config|libs|data|lang|scripts)/ {
        deny all;
    }

    location ~ ^/(dev_admin_login|diag_profile|csrf_debug|test_concurrency)\.php$ {
        allow 127.0.0.1;
        allow ::1;
        deny all;
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    location ~* \.(js|css|png|jpg|jpeg|webp|gif|ico|svg|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ @ikimon_rewrites;
    }

    location @ikimon_rewrites {
        rewrite ^/species/([a-z0-9\-]+)/?$ /species.php?name=$1 last;
        rewrite ^/obs/([a-zA-Z0-9_\-]+)/?$ /observation_detail.php?id=$1 last;
        rewrite ^/site/([a-zA-Z0-9_\-]+)/?$ /site_dashboard.php?id=$1 last;
        rewrite ^/user/([a-zA-Z0-9_\-]+)/?$ /profile.php?id=$1 last;
        rewrite ^ /index.php?$query_string last;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
```

4. 反映

```bash
ln -s /etc/nginx/sites-available/ikimon.life /etc/nginx/sites-enabled/ikimon.life
nginx -t
systemctl reload nginx
systemctl reload php8.2-fpm
```

### Phase 2: コードデプロイ

原則:

- `upload_package/` の中身を `/var/www/ikimon.life/repo/upload_package/` にそのまま入れる
- `data/` は別フェーズで移すので、初回コード同期では除外してよい
- `config/secret.php` は Git 管理外で別途配置

例:

```bash
rsync -av --delete \
  --exclude '.git/' \
  --exclude 'tests/' \
  --exclude 'data/' \
  --exclude 'config/secret.php' \
  C:/Users/YAMAKI/ikimon/ikimon.life/upload_package/ \
  root@162.43.44.131:/var/www/ikimon.life/repo/upload_package/
```

PowerShell 実行物:

```powershell
pwsh -File .\tools\sync_to_vps.ps1 -Mode code
pwsh -File .\tools\sync_to_vps.ps1 -Mode code -DryRun
pwsh -File .\tools\sync_to_vps.ps1 -Mode code -VerifyOnly
```

権限:

```bash
chown -R www-data:www-data /var/www/ikimon.life/repo/upload_package
find /var/www/ikimon.life/repo/upload_package -type d -exec chmod 755 {} \;
find /var/www/ikimon.life/repo/upload_package -type f -exec chmod 644 {} \;
chmod -R 775 /var/www/ikimon.life/repo/upload_package/data
chmod -R 775 /var/www/ikimon.life/repo/upload_package/public_html/uploads
```

アプリ固有の確認:

- `config/config.php` はパス自動解決なので手修正しない
- `config/secret.php` または環境変数に OAuth / API キーを入れる
- `oauth_config.php` の redirect URI は `BASE_URL` 依存なので、ドメインが合っていればそのまま使える
- 配置テンプレートは `upload_package/config/secret.php.example`

### Phase 3: データ移行

このアプリは JSON ファイルストレージなので、**書き込み停止タイミング** が重要。

推奨手順:

1. 事前フルコピー
2. 短時間メンテナンスに入る
3. 差分同期
4. VPS 側で smoke test
5. DNS 切替

同期対象:

- `data/`
- `public_html/uploads/`

例:

```bash
# 事前コピー
rsync -avz -e "ssh -p 8022 -i ~/.ssh/antigravity.pem" \
  r1522484@www1070.onamae.ne.jp:~/public_html/ikimon.life/data/ \
  /var/www/ikimon.life/repo/upload_package/data/

rsync -avz -e "ssh -p 8022 -i ~/.ssh/antigravity.pem" \
  r1522484@www1070.onamae.ne.jp:~/public_html/ikimon.life/public_html/uploads/ \
  /var/www/ikimon.life/repo/upload_package/public_html/uploads/
```

切替直前の差分同期:

```bash
rsync -avz --delete -e "ssh -p 8022 -i ~/.ssh/antigravity.pem" \
  r1522484@www1070.onamae.ne.jp:~/public_html/ikimon.life/data/ \
  /var/www/ikimon.life/repo/upload_package/data/

rsync -avz --delete -e "ssh -p 8022 -i ~/.ssh/antigravity.pem" \
  r1522484@www1070.onamae.ne.jp:~/public_html/ikimon.life/public_html/uploads/ \
  /var/www/ikimon.life/repo/upload_package/public_html/uploads/
```

PowerShell 実行物:

```powershell
pwsh -File .\tools\sync_to_vps.ps1 -Mode data
pwsh -File .\tools\sync_to_vps.ps1 -Mode uploads
pwsh -File .\tools\sync_to_vps.ps1 -Mode finalize
pwsh -File .\tools\sync_to_vps.ps1 -Mode data -VerifyOnly
pwsh -File .\tools\sync_to_vps.ps1 -Mode uploads -VerifyOnly
```

注意:

- `data/observations/YYYY-MM.json` は月次パーティション
- コピー中に投稿されるとロストの可能性があるので、最終同期時は投稿停止か DNS 切替直前の短時間 freeze を入れる

### Phase 4: SSL

このフェーズは「先に SSL を用意したい」要件向けに 2 パターンある。

#### パターン A: DNS 切替前に確認だけしたい

- 手元の `hosts` で `ikimon.life -> 162.43.44.131` を一時的に向ける
- 一時的に自己署名証明書で nginx を立てる
- アプリ表示・投稿・OAuth 以外を先に確認する

#### パターン B: 本番 SSL をそのまま取る

Let's Encrypt の HTTP-01 は通常 DNS 切替後にやる。

```bash
apt-get update
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d ikimon.life -d www.ikimon.life
```

補足:

- DNS を動かす前に本番証明書まで取得したいなら DNS-01 が必要
- OAuth は最終ドメイン / HTTPS が確定してから確認する

### Phase 5: DNS 切替

やること:

- `ikimon.life` の A レコードを `162.43.44.131` に変更
- `www` も同じく変更
- `AAAA` が残っているなら整合を取る
- TTL は前日までに `300` へ下げておく

切替の順番:

1. 旧ホスト最終同期
2. VPS 最終確認
3. DNS 更新
4. アクセスログ / error log を監視

### Phase 6: 検証

最低限の確認:

- [ ] `/` が 200 で表示される
- [ ] `/post.php` が開く
- [ ] ゲスト投稿が成功する
- [ ] ログイン済み投稿が成功する
- [ ] `/api/post_observation.php` が正常応答する
- [ ] `post_identification.php` が正常応答する
- [ ] 画像アップロード後に `public_html/uploads/photos/` に保存される
- [ ] Service Worker がエラーなく登録される
- [ ] Google / X OAuth コールバックが成功する
- [ ] 403 / 404 ページが正しく出る
- [ ] HTTPS リダイレクトが効く

切替直後の監視:

```bash
tail -f /var/log/nginx/access.log /var/log/nginx/error.log
journalctl -u php8.2-fpm -f
```

補助スクリプト:

```powershell
pwsh -File .\tools\vps_smoke_test.ps1 -BaseUrl https://ikimon.life
pwsh -File .\tools\vps_smoke_test.ps1 -BaseUrl https://ikimon.life -ObservationId <existing-id> -SpeciesSlug <existing-slug>
```

---

## 5. `.htaccess` -> nginx 変換ルール

### まず前提

`upload_package/.htaccess` の役割は「共有ホストでルートアクセスを `public_html/` に転送すること」。
VPS では nginx の `root` を最初から `/var/www/ikimon.life/repo/upload_package/public_html` に置くので、**この catch-all rewrite は移植しない**。

### 変換表

| 現行 | nginx での扱い |
|---|---|
| `upload_package/.htaccess` の `RewriteRule ^(.*)$ public_html/$1 [L]` | 不要。`root /var/www/ikimon.life/repo/upload_package/public_html;` で吸収 |
| `public_html/.htaccess` の `ErrorDocument 403 /403.php` / `404` | `error_page 403 /403.php;` / `error_page 404 /404.php;` |
| `mod_deflate` | `gzip on; gzip_types ...;` |
| `mod_expires` | `location ~* \.(js|css|png...)$ { expires ...; }` |
| `Header set X-Content-Type-Options` など | `add_header ... always;` |
| `FilesMatch ^(dev_admin_login|diag_profile|csrf_debug|test_concurrency)\.php$` | `location ~ ^/(dev_admin_login|diag_profile|csrf_debug|test_concurrency)\.php$ { allow 127.0.0.1; deny all; }` |
| `/species/{slug}` | `rewrite ^/species/... /species.php?... last;` |
| `/obs/{id}` | `rewrite ^/obs/... /observation_detail.php?... last;` |
| `/site/{id}` | `rewrite ^/site/... /site_dashboard.php?... last;` |
| `/user/{id}` | `rewrite ^/user/... /profile.php?... last;` |

### 変換時の注意

- `config/`, `libs/`, `data/`, `lang/`, `scripts/` は **document root の外** にいるので、本来は URL から見えない
- それでも防御を厚くするなら deny location を置いてよい
- `try_files $uri $uri/ @ikimon_rewrites;` を使うと静的ファイルを壊しにくい
- API の no-cache は nginx で統一し、アプリ側の緊急ヘッダーは移行後に削除する

---

## 6. 技術的制約

### SiteManager は static 専用

```php
// 正しい
SiteManager::load($siteId);
SiteManager::listAll();

// 間違い
$siteManager = new SiteManager();
```

### DataStore のメソッド名は固定

```php
DataStore::fetchAll($resource);
DataStore::get($file);
DataStore::save($file, $data);
DataStore::append($resource, $item);

// ない
DataStore::getAll();
```

### 追加で意識すべきこと

- データは JSON ベース。今回の VPS 移行では PostgreSQL へ切り替えない
- `data/observations/YYYY-MM.json` の月次パーティション前提を壊さない
- 位置情報はネストではなくフラット:

```php
$obs['prefecture'];
$obs['municipality'];
$obs['lat'];
$obs['lng'];
```

- 新しい書き込みコードを追加するなら `LOCK_EX` を忘れない

---

## 7. 移行後に削除すべき緊急コード一覧

VPS 側で `POST /api/post_observation.php` が素直に動いたら、共有ホスト障害向けの暫定コードは消す。

1. `upload_package/public_html/api/post_identification.php`
   内容: `?_route=observation` の緊急ルーティング

2. `upload_package/public_html/js/post-uploader.js`
   内容: 投稿先を `api/post_identification.php?_route=observation` に向けている応急処置

3. `upload_package/public_html/js/OfflineManager.js`
   内容: オフライン再送先を `api/post_identification.php?_route=observation` に向けている応急処置

4. `upload_package/public_html/sw.js`
   内容: `POST /api/post_observation.php` を `post_identification.php?_route=observation` に振り替えるロジック

5. `upload_package/public_html/api/post_observation.php`
   内容: 共有ホスト対策として付けた no-cache header

削除しないもの:

- `config/config.php` の動的パス解決
- `oauth_config.php`
- JSON ストレージ構造そのもの

---

## 8. 切替後の実行メモ

### ローカル確認

```bash
php -S localhost:8899 -t upload_package/public_html
php composer.phar test
php tools/lint.php
```

### 切替後に優先して叩く URL

- `https://ikimon.life/`
- `https://ikimon.life/post.php`
- `https://ikimon.life/api/post_observation.php`
- `https://ikimon.life/obs/<既存ID>`
- `https://ikimon.life/species/<既存slug>`

### ロールバック条件

以下のどれかが通らないなら DNS を戻す判断をする。

- 新規投稿不可
- ログイン不可
- 画像アップロード不可
- 403 / 404 / 500 が急増

---

## 9. 重要な判断

今回の移行では「アプリ改修」より「基盤の正常化」が主目的。
優先順位は次の通り。

1. `post_observation.php` を VPS で素直に動かす
2. JSON データとアップロード画像を欠損なく持っていく
3. DNS 切替後の投稿・ログイン・アップロードを確認する
4. その後で共有ホスト用の緊急コードを削除する

PostgreSQL 移行、構成管理、CI/CD の整備は次フェーズ。
