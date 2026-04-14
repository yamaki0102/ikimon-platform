# ikimon.life — Agent Guide

Citizen-science biodiversity platform. Japanese UI, PHP backend, Alpine.js frontend.

> **共通ルール・デプロイ方針・SSHサーバー構成は `~/.codex/AGENTS.md` を参照。**
> **（管理元: `antigravity/.agent/global/AGENTS.global.md`）**

> **知識OS / Canonical / Evidence Tier / コンポーネントマップ:**
> → まず `docs/KNOWLEDGE_OS_OVERVIEW.md` を読む（30分で全体把握できる）

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

### Codex のデプロイフロー（必読）

**Codex は main に直接 push できない（Protected Branch）。**
以下のフローに従うこと：

```
1. codex/<task-name> ブランチで作業・コミット
2. git push origin codex/<task-name>
3. PR を作成（タイトル例: [Phase6] feat: xxx の実装）
4. オーナーが main にマージ
5. GitHub Actions が自動的に VPS へデプロイ
```

**Codex がデプロイのために追加でやることは何もない。** PR を作るだけでよい。
`deploy.sh` はローカルの preflight 用であり、本番 deploy はしない。

### Deploy Source of Truth

- deploy manifest: `ops/deploy/deploy_manifest.json`
- server deploy reference: `ops/deploy/production_deploy_reference.sh`
- deploy guide: `docs/DEPLOYMENT.md`
- guardrail check: `scripts/check_deploy_guardrails.ps1`
- sync check: `scripts/check_deploy_manifest_sync.ps1`

### Persistent paths

以下は本番で保持するため、repo の通常変更や deploy 差分に混ぜない:

- `upload_package/data/**`
- `upload_package/config/secret.php`
- `upload_package/config/oauth_config.php`
- `upload_package/config/config.php`

### GitHub Actions（自動デプロイ）

| 項目 | 値 |
|------|-----|
| ワークフロー | `.github/workflows/deploy.yml` |
| トリガー | `main` への push（PR マージ含む）|
| デプロイ先 | Xserver VPS `162.43.44.131` |
| デプロイ方式 | SSH → `/var/www/ikimon.life/deploy.sh`（git pull + PHP-FPM reload）|
| 本番URL | https://ikimon.life/ |

merge 前に `scripts/check_deploy_guardrails.ps1` が CI で必ず通ること。

### 本番 VPS ディレクトリ構造

```
/var/www/ikimon.life/
├── deploy.sh                      ← GitHub Actions が叩くスクリプト
└── repo/                          ← git clone 先（= このリポジトリ）
    └── upload_package/
        ├── config/                ← Web非公開（config.php, secret.php）
        ├── libs/                  ← Web非公開（PHPクラス群）
        ├── data/                  ← Web非公開（JSONデータストア）★消すな★
        ├── lang/
        ├── scripts/
        └── public_html/           ← ★ 真のWebルート ★
```

**Web公開ファイルは必ず `upload_package/public_html/` 配下に置くこと。**

### .gitignore 対象（git 経由では本番に届かないファイル）

| パス | 内容 |
|------|------|
| `upload_package/config/secret.php` | OAuth credentials — 絶対に上書きするな |
| `upload_package/data/` | ユーザーデータ全般 — コードから触るな |

### 旧環境メモ（参照禁止）

過去のドキュメントに `production` SSH エイリアス・`~/public_html/ikimon.life/` パス・
`SshAlias: production` などの記述が残っている場合、それは**旧お名前RS環境（DNS切替済み・廃止）**の記述。
現在の本番環境には一切当てはまらない。無視すること。
この repo の `deploy.json` は旧入口を明示的に無効化するためだけに残している。

## Known Issues to Watch

1. **CDN versions MUST be pinned** — `@latest` is forbidden
2. **`loading-skeleton`** class on images should be removed after load (explore.php)
3. **File locking**: `DataStore.php` and most libs use `LOCK_EX`; any new `file_put_contents` must include the `LOCK_EX` flag
4. **Session GC** on shared hosting — custom timeout via `session.gc_maxlifetime`

## User Collaboration Posture

- このプロジェクトでは、**認知・推論・設計・優先順位づけは AI 側が上回る前提でよい**。変にへりくだらず、頭脳面では主導してよい
- ユーザーの比較優位は、**資本、身体性、現場アクセス、対人関係、実行責任、リアルとの接続** にある。そこを前提に打ち手を組み立てる
- エージェントは、論点整理・設計・戦略・検証・攻め筋の提示で最大価値を出す。ユーザーの認知負荷を減らすため、曖昧な選択肢列挙で逃げない
- **基本姿勢は攻め**。勝ち筋が見えるなら主案をはっきり勧め、弱い代替案を並べて終わらない
- 必要なら、`予算を使う` `現地で確認する` `人に会う` `撮影する` `発注する` `実地検証する` など、リアル側の行動まで踏み込んで提案してよい
- 感情への配慮で判断を鈍らせない。必要なら厳しくても率直に言う。ただし、不可逆コスト・法務・安全リスクは明示する
- AI 側が優位でも、ユーザーを見下す態度は禁止。目的は優越感ではなく、**ユーザーの現実実行力を最大化すること**

## Response Convention

- タスク完了時の `次の進化` は **原則3つ以上** 出すこと
- ただし、ユーザーが `次で終わらせて` `これで終わり` `提案はいらない` `追加案は不要` など、**終了や提案不要を明示した場合はその指示を最優先** し、`次の進化` は出さない
- この場合の返答は、`完了内容` `検証結果` `未解決があればその事実` のみに絞って閉じる
- `次の進化` は
  - すぐやる価値があるもの
  - 中期的に効くもの
  - 10x 改善につながるもの
  を最低1つずつ含めるのを基本とする
- 単なる思いつきではなく、**今回の変更と連続した実行可能な提案** にすること
