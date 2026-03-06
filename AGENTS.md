# ikimon.life — Agent Guide

Citizen-science biodiversity platform. Japanese UI, PHP backend, Alpine.js frontend.

> **共通ルール・デプロイ方針・SSHサーバー構成は `~/.codex/AGENTS.md` を参照。**
> **（管理元: `antigravity/.agent/global/AGENTS.global.md`）**

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

## Deployment (ikimon固有設定)

共通デプロイ方針: `~/.codex/AGENTS.md` → Deploy Protocol を参照。

### 接続情報

| 項目 | 値 |
|------|-----|
| SSHエイリアス | `production`（~/.ssh/config に定義済み） |
| リモートベース | `~/public_html/ikimon.life/` |
| 本番URL | https://ikimon.life/ |

### リモートディレクトリ構造

```
~/public_html/ikimon.life/        ← サイトルート
├── config/                        ← Web非公開（config.php等）
├── libs/                          ← Web非公開（PHPクラス群）
├── data/                          ← Web非公開（JSONデータストア）
├── lang/
├── scripts/
└── public_html/                   ← ★ 真のWebルート ★
```

**Web公開ファイルは必ず `public_html/` 配下にアップロードすること。**

### deploy.json

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
