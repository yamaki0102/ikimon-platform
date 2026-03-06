# ikimon.life — Agent Guide

Citizen-science biodiversity platform. Japanese UI, PHP backend, Alpine.js frontend.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | PHP 8.2 (vanilla, no framework) |
| Frontend | Alpine.js 3.14.9 + Tailwind CSS (CDN) + Lucide Icons 0.477.0 |
| Maps | MapLibre GL JS + OpenStreetMap tiles |
| Data | JSON file storage (partitioned: `data/observations/YYYY-MM.json`) |
| Auth | Session-based + UUID guest accounts |

## Directory Structure

```
upload_package/
├── config/config.php        # ROOT_DIR, DATA_DIR, PUBLIC_DIR constants
├── data/                    # JSON datastore (observations, users, sites)
├── libs/                    # PHP classes (55+ files)
│   ├── Auth.php             # Session auth
│   ├── CSRF.php             # CSRF token management
│   ├── CspNonce.php         # CSP nonce
│   ├── DataStore.php        # JSON file I/O (fetchAll/get/save/append)
│   ├── SiteManager.php      # GeoJSON boundaries (ALL METHODS STATIC)
│   ├── Taxon.php            # GBIF API integration
│   ├── TrustLevel.php       # User trust calculation
│   ├── Gamification.php     # Badges & ranks
│   ├── PrivacyFilter.php    # Rare species location masking
│   ├── RateLimiter.php      # API rate limiting
│   └── Services/            # Service layer classes
├── lang/                    # i18n (ja/en)
├── public_html/             # ★ Web document root ★
│   ├── index.php            # Feed (home)
│   ├── explore.php          # Species grid browser
│   ├── observation_detail.php # Observation detail + ID timeline
│   ├── id_workbench.php     # Identification workbench
│   ├── post.php             # Observation submission
│   ├── profile.php          # User profile + Life List
│   ├── dashboard.php        # User dashboard
│   ├── zukan.php            # Encyclopedia (Bio-Graph)
│   ├── compass.php          # Leaderboard
│   ├── wellness.php         # Gamification dashboard
│   ├── about.php            # About page
│   ├── for-researcher.php   # For researchers
│   ├── updates.php          # Changelog
│   ├── meta.php             # <head> include (CDN, CSP, GA4)
│   ├── nav.php              # Bottom navigation (5-tab)
│   ├── style.css            # Global styles + design tokens
│   ├── api/                 # REST API (50+ endpoints)
│   ├── admin/               # Admin panel
│   ├── components/          # PHP UI components
│   └── assets/              # Static files (CSS/JS/images)
└── scripts/                 # CLI maintenance scripts
tests/
├── Unit/                    # PHPUnit unit tests
├── Feature/                 # Feature/integration tests
└── bootstrap.php
```

## Do NOT modify (secrets / prod config)

- `upload_package/config/config.php` — Paths + secrets; change only when explicitly requested
- `upload_package/config/oauth_config.php` — OAuth credentials; never commit real secrets in PRs
- `upload_package/config/.htaccess` / `upload_package/public_html/.htaccess` — Access control rules
- `upload_package/data/` — Production datastore; never hand-edit data in code changes
- `.env` / `credentials.json` (if present) — Secrets
- `vendor/` (if present) — Managed dependencies

Rule: never log/echo secret values (tokens, API keys, OAuth client secrets).
## Critical Patterns

### SiteManager is ALL STATIC
```php
// ✅ Correct
SiteManager::load($siteId);
SiteManager::listAll();
// ❌ Wrong — never instantiate
$sm = new SiteManager();
```

### DataStore methods
```php
DataStore::fetchAll($resource)   // All records
DataStore::get($file)            // Read one file
DataStore::save($file, $data)    // Write
DataStore::append($resource, $item) // Append
// ⚠️ DataStore::getAll() does NOT exist
```

### Path constants (defined in config.php)
```php
ROOT_DIR   // → upload_package/
DATA_DIR   // → upload_package/data/
PUBLIC_DIR // → upload_package/public_html/
```

### Location data format
```php
// ✅ Correct — flat fields
$obs['municipality']  // e.g. "浜松市"
$obs['prefecture']    // e.g. "静岡県"
$obs['lat'], $obs['lng']

// ❌ Wrong — this nested structure does NOT exist
$obs['location']['name']
```

## Frontend Conventions

- **Alpine.js**: All state inline in `x-data` attributes on page elements
- **Tailwind**: CDN v4, utility-first. Custom design tokens in style.css:
  - `bg-base`, `bg-surface` — background colors
  - `text-text`, `text-faint` — text colors
  - `btn-primary` — primary button class
  - `border-border` — border color
- **Icons**: Lucide Icons via CDN (pinned to 0.477.0)
- **Layout**: `pt-14` on body (header overlap), `pb-20` (bottom nav overlap)
- **Touch targets**: 56px minimum height for mobile
- **Typography**: `line-height: 1.7` global, Japanese-optimized

## Security Implementation

- **XSS**: `JSON_HEX_TAG` + `htmlspecialchars()` on all output
- **CSRF**: Token validation on all forms via `CSRF.php`
- **CSP**: Nonce-based via `CspNonce.php`
- **Rate Limiting**: Applied on login API
- **File Upload**: `finfo` MIME check + extension validation
- **Rare Species**: Location masking via `PrivacyFilter.php`
- **Dev endpoints**: `dev_*.php` moved to `dev_tools/` (not deployed); removed from production

## Testing

```bash
composer test            # All tests
composer test:unit       # Unit tests only
composer test:feature    # Feature/integration tests
php tools/lint.php       # Full syntax check
php -S localhost:8899 -t upload_package/public_html  # Dev server
```

## Deployment

### 接続情報

| 項目 | 値 |
|------|-----|
| ホスト | www1070.onamae.ne.jp |
| ユーザー | r1522484 |
| ポート | 8022 |
| SSH鍵 | ~/.ssh/production.pem |
| SSHエイリアス | `production`（~/.ssh/config に定義済み） |
| リモートベース | ~/public_html/ikimon.life/ |
| 本番URL | https://ikimon.life/ |

### リモートディレクトリ構造

```
~/public_html/ikimon.life/        ← サイトルート
├── config/                        ← Web非公開（config.php等）
├── libs/                          ← Web非公開（PHPクラス群）
├── data/                          ← Web非公開（JSONデータストア）
├── lang/                          ← 多言語ファイル
├── scripts/                       ← CLIスクリプト
└── public_html/                   ← ★ 真のWebルート ★
    ├── index.php
    ├── api/
    ├── assets/
    └── ...
```

### デプロイ方法（差分SCP転送）

deploy.sh は WSL パス依存で使用不可。以下の手動手順を使う。

#### Step 1: 差分確認

```bash
# 前回デプロイコミットからの変更ファイル一覧を取得
git diff --name-only <前回コミットハッシュ> HEAD -- upload_package/
```

#### Step 2: SCP転送

```bash
# 個別ファイル転送（パスの upload_package/ を除いてリモートに送る）
scp -P 8022 -i ~/.ssh/production.pem \
  upload_package/public_html/index.php \
  r1522484@www1070.onamae.ne.jp:~/public_html/ikimon.life/public_html/index.php

# ディレクトリ一括転送
scp -rP 8022 -i ~/.ssh/production.pem \
  upload_package/libs/ \
  r1522484@www1070.onamae.ne.jp:~/public_html/ikimon.life/libs/
```

SSHエイリアスが使える場合:
```bash
scp upload_package/public_html/index.php production:~/public_html/ikimon.life/public_html/index.php
```

#### Step 3: 検証

```bash
# SSH接続して確認
ssh -p 8022 -i ~/.ssh/production.pem r1522484@www1070.onamae.ne.jp

# またはブラウザで https://ikimon.life/ を確認
```

### 大量ファイルデプロイ（Zip方式）

変更ファイルが多い場合:

```bash
# 1. upload_package をZip化（除外対象を除く）
cd upload_package
zip -r ../deploy.zip . -x ".git/*" "*/tests/*" "*/debug_*.php" "*/test_*.php"
cd ..

# 2. SCP転送
scp -P 8022 -i ~/.ssh/production.pem deploy.zip \
  r1522484@www1070.onamae.ne.jp:~/public_html/ikimon.life/

# 3. SSH接続して展開
ssh -p 8022 -i ~/.ssh/production.pem r1522484@www1070.onamae.ne.jp
cd ~/public_html/ikimon.life/
unzip -o deploy.zip
rm deploy.zip
```

### 除外対象（本番に送らない）

- `.git/` — Gitメタデータ
- `tests/` — PHPUnitテスト
- `debug_*.php` — デバッグ用ファイル
- `test_*.php` — テスト用ファイル
- `dev_tools/` — 開発ツール
- `vendor/` — Composerパッケージ（本番にあれば触らない）
- `credentials.json` / `.env` — ローカル専用シークレット

### デプロイ前チェックリスト

1. `php tools/lint.php` — 構文エラーがないこと
2. `composer test` — テストがパスすること
3. `git diff --name-only` — 変更ファイルを目視確認
4. `config/config.php` を **変更していないこと** を確認（パス定数・シークレット）
5. CDNバージョンが固定されていること（`@latest` 禁止）

### deploy.json（参考）

```json
{
    "TargetName": "ikimon.life",
    "LocalDir": "upload_package",
    "SshAlias": "production",
    "RemoteBase": "~/public_html/ikimon.life/",
    "Url": "https://ikimon.life/"
}
```

## Known Issues to Watch

1. **CDN versions MUST be pinned** — `@latest` is forbidden
2. **`loading-skeleton`** class on images should be removed after load (explore.php)
3. **File locking**: `DataStore.php` and most libs use `LOCK_EX`; any new `file_put_contents` must include the `LOCK_EX` flag
4. **Session GC** on shared hosting — custom timeout via `session.gc_maxlifetime`

