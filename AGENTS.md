# ikimon.life — Agent Guide

Citizen-science biodiversity platform. The current app is the Node runtime under `platform_v2/`; the old PHP tree is retained only for compatibility, rollback, and data-preservation work.

> **共通ルール・デプロイ方針・SSHサーバー構成は `~/.codex/AGENTS.md` を参照。**
> **（管理元: `antigravity/.agent/global/AGENTS.global.md`）**

> **知識OS / Canonical / Evidence Tier / コンポーネントマップ:**
> → `docs/IKIMON_KNOWLEDGE_MAP_2026-04-12.md` → `docs/IKIMON_MASTER_STATUS_AND_PLAN_2026-04-12.md` → `docs/KNOWLEDGE_OS_OVERVIEW.md` の順で読む
> → overview 更新要否は `powershell -ExecutionPolicy Bypass -File .\scripts\check_knowledge_os_overview_sync.ps1` で確認する

## Current App Fast Path

- **Default is always the current app at `platform_v2/`.** Do not ask whether to use the old PHP tree for normal ikimon.life work.
- For production or staging investigation of `/`, login, record, map, public pages, or APIs, start in `platform_v2/`.
- Treat older docs, handovers, and catch-up notes that point to PHP files as historical unless this guide explicitly says otherwise.
- Default `rg` searches intentionally skip `upload_package/` and `docs/archive/` through root `.ignore`; use `rg -uuu` only when compatibility or historical evidence is explicitly needed.
- `staging` by itself means the staging deployment of the current app.
- Use `ops/CUTOVER_RUNBOOK.md` and `ops/deploy/staging_ikimon_life_tls_reference.conf` for staging/runtime deployment facts.
- The physical directory name `platform_v2/` is a deployment contract. Human-facing guidance should call it the current app/current runtime, not a separate product generation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Current runtime | Node.js (`platform_v2`) |
| Compatibility archive | PHP 8.2 (`upload_package`, explicit legacy work only) |
| Frontend | Alpine.js + Tailwind CSS (CDN) + Lucide Icons |
| Maps | MapLibre GL JS + OpenStreetMap tiles |
| Data | PostgreSQL canonical store + compatibility data bridge |
| Auth | Session-based + UUID guest accounts |

## Current App Entry Points

- Routes and pages: `platform_v2/src/routes/`
- Domain services: `platform_v2/src/services/`
- UI and rendering helpers: `platform_v2/src/ui/`
- Public copy/content: `platform_v2/src/content/`
- Database migrations: `platform_v2/db/migrations/`
- Runtime config: `platform_v2/src/config.ts`
- Tests: `platform_v2/src/**/*.test.ts` and `platform_v2/e2e/`

## Legacy Compatibility Boundary

- The old PHP tree is `upload_package/`. It is not the normal development entry point.
- You may inspect or edit it only when the user explicitly says `legacy`, `PHP`, or `upload_package`; when the current app imports, writes, or serves compatibility data and the exact boundary is proven from current-app code; or when deployment, rollback, backup, or production data preservation requires it.
- Keep secrets, persistent data, OAuth config, and production data stores out of normal edits. Never log or echo secret values.
- If a normal feature seems to require old PHP edits, first prove why the current app cannot own it, then make the smallest compatibility change.

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

- **XSS**: escape all HTML output and keep JSON serialization safe
- **CSRF**: token validation on state-changing forms/routes
- **CSP**: nonce-based where inline scripts are unavoidable
- **Rate Limiting**: Applied on login API
- **File Upload**: `finfo` MIME check + extension validation
- **Rare Species**: Location masking via `PrivacyFilter.php`
- **Dev endpoints**: `dev_*.php` moved to `dev_tools/` (not deployed); removed from production

## Testing

```bash
npm --prefix platform_v2 run typecheck      # Default verification for normal work
npm --prefix platform_v2 run test:node      # Current app unit / integration tests
npm --prefix platform_v2 run dev            # Local current-app dev server
powershell -ExecutionPolicy Bypass -File .\scripts\check_legacy_entrypoint_reason.ps1

# Legacy PHP only when the user explicitly asks for legacy/PHP/upload_package work:
composer test
php tools/lint.php
```

## Deployment

### Codex のデプロイフロー（必読）

**Codex は main に直接 push できない（Protected Branch）。**
以下のフローに従うこと：

```
0. deploy 判断前に必ず `powershell -ExecutionPolicy Bypass -File .\scripts\local_deploy_preflight.ps1 -RequireCodexBranch -RequireUpstreamSync` を実行し、ローカル未コミットが残っていないことを確認
1. codex/<task-name> ブランチで作業・コミット
2. git push origin codex/<task-name>
3. PR を作成（タイトル例: [Phase6] feat: xxx の実装）
4. オーナーが main にマージ
5. GitHub Actions が自動的に VPS へデプロイ
```

### GitHub 管理者権限の扱い

- ユーザーが「反映して」「マージして」「本番へ進めて」と明示した場合、Codex は GitHub 管理者権限で進める前提でよい
- PR が `MERGEABLE` かつ required checks が通過済みで、止まっている理由が `REVIEW_REQUIRED` のみなら、`gh pr merge --admin` で owner review 待ちを bypass してよい
- ただし、失敗中の CI / deploy guardrail / migration guardrail / production smoke を管理者権限で無視してはいけない
- `main` への直接 push は引き続き禁止。管理者権限を使う場合も、`codex/<task-name>` → PR → admin merge → GitHub Actions deploy の順序を守る

**Codex がデプロイのために手動SSHで追加作業することは原則ない。** PR を作り、必要なら admin merge し、GitHub Actions の結果を確認する。
本番反映をユーザーが依頼した場合は、PR 作成や merge で止めず、該当する GitHub Actions deploy workflow が `success` / `failure` などの最終状態になるまで監視し、失敗時はログ確認と止血まで継続する。
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
| デプロイ方式 | GitHub Actions → blue/green current-runtime deploy |
| 本番URL | https://ikimon.life/ |

merge 前に `scripts/check_deploy_guardrails.ps1` が CI で必ず通ること。

### 本番 VPS ディレクトリ構造

```
/var/www/ikimon.life/
├── deploy.sh                      ← GitHub Actions が叩くスクリプト
└── repo/                          ← git clone 先（= このリポジトリ）
    ├── platform_v2/               ← current runtime
    └── upload_package/            ← compatibility archive and persistent data bridge
```

通常の公開面は current runtime で扱う。旧PHP互換配下を編集するのは、上の Legacy Compatibility Boundary に該当する場合だけ。

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
2. Current-app changes should keep `npm --prefix platform_v2 run typecheck` green
3. Compatibility writes must preserve production data and use the existing compatibility writer patterns
4. Session, upload, and rare-species handling are security-sensitive and require targeted tests

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
