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
- Use `docs/DEPLOYMENT.md` and the central deploy registry for current staging/runtime deployment facts. `ops/CUTOVER_RUNBOOK.md` is a retired VPS cutover archive.
- The physical directory name `platform_v2/` is a deployment contract. Human-facing guidance should call it the current app/current runtime, not a separate product generation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Current runtime | Node.js (`platform_v2`) |
| Compatibility archive | PHP 8.2 (`upload_package`, explicit legacy work only) |
| Frontend | Alpine.js + Tailwind CSS (CDN) + Lucide Icons |
| Maps | MapLibre GL JS + OpenStreetMap tiles |
| Data | Cloudflare D1/R2/Queues canonical runtime (legacy PostgreSQL compatibility only) |
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

## ikimon Design Thinking

- ユーザーを信じる。説明文で先回りしすぎず、写真・動画・カード・反応・導線で意味が立ち上がる画面を優先する。
- 任天堂リスペクト。Goodpatch UI Crunch #13 の任天堂UI思想を参照し、`教える事より体験してもらう事`、`触っているうちに機能が発見される構造`、`わかりやすさと新鮮さのバランス` を ikimon のUI判断に翻訳する。
- トップや記録導線では、文章でサービス定義を説明しない。ユーザーが見て、触って、記録の流れを理解できる密度にする。
- メディア、HP、ヘルプ、業務資料では文章が必要な場面もある。ただし本文は目的を持つ場所に置き、主要体験のファーストビューを説明書にしない。
- 面倒な行為は、説明で納得させるより、軽い反応・発見・次の一手で進める。分類、AI、地図、公開安全は裏で支え、主役にしすぎない。
- デザインレビュー時は、`この文章がなくてもユーザーは進めるか`、`文章より状態・配置・反応で伝えられないか`、`ユーザーを信用せずに説明していないか` を確認する。

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

### Real Data Browser QA

- 実データ、ログイン済みアカウント、OAuth、投稿、管理者操作を確認するときは、可能な限りユーザーの実ログイン状態を持つ実ブラウザ / Chrome 拡張経由の操作を優先する。
- Codex の in-app browser だけで代替した場合は、実アカウント確認済みとは報告しない。
- パスワード、2FA、OAuth 同意、保存済みアカウント選択などの本人認証操作はユーザーが行い、その後の画面遷移、クリック、入力、状態確認、スクリーンショット確認を Codex が引き継ぐ。
- 新機能ブランチが本番や staging に未反映の場合、本番実アカウントで確認できるのは既存機能だけである。新機能の実データ確認には、該当ブランチを反映した staging か、ローカル DB つき環境を使う。

## Deployment

### Cloudflare command bus（通常経路）

- 通常の `status / dry_run / setup / migrate / deploy / verify / visual_qa / rollback` は、`yamaki0102/all-projects-management` の `ops:command` Issueから既存Cloudflare Queue / Sandbox Executorを使う。
- Issueは `ikimon.ops-command/v1` の厳格JSONと40文字commit SHAを使い、任意shell、URL、args、SSH host、secret、pathを渡さない。
- productionのmigrate/deploy/rollback/setup-writeは、同一Issue・同一job・同一SHAの30分nonce承認とgreen stagingを必須にする。
- GitHub Actionsはbuild、test、deploy、verify、Visual QA、rollbackの実行backendに使わない。GitHubはsource、PR、immutable SHA、Issue command、監査証跡に限定する。
- manual emergencyも同じportable release/verification scriptを再利用するが、通常のCloudflare command busを管理PCやActionsへ迂回させない。

### VPS retirement boundary（2026-08-07）

- 現行 production 正本は Cloudflare Worker `ikimon-life-cloudflare-prod`、staging 正本は Cloudflare Worker `ikimon-life-cloudflare-staging`。
- `ikimon-vps` / `162.43.44.131` は legacy / retirement 対象であり、通常のrelease、fallback、origin、stagingとして扱わない。
- 愛管・LENRI等の共有サーバー `i-kan-xserver` / `sv1102.xserver.jp` は別資産であり、このVPS退役作業の停止・削除・解約対象ではない。
- 以下に残る GitHub Actions、blue/green、VPSディレクトリ、SSH deploy の記述は、rollback/restoreに必要な退役アーカイブとして保存するだけで、現行操作手順ではない。

### Codex のデプロイフロー（必読）

**Codex は main に直接 pushできない（Protected Branch）。**
以下のフローに従うこと：

通常の入口は、最新 `origin/main` から専用レーンを作る
`scripts/new_release_worktree.ps1 -TaskName <task-name>` と、明示パスだけを扱う
`scripts/release_autopilot.ps1`。GitHub CLI / Git Credential Manager は非対話利用し、
認証切れは変更前に検出する。`-PromoteProduction` は本番反映が現依頼に含まれる場合だけ使う。

```
0. deploy 判断前に必ず `powershell -ExecutionPolicy Bypass -File .\scripts\local_deploy_preflight.ps1 -RequireCodexBranch -RequireUpstreamSync` を実行し、ローカル未コミットが残っていないことを確認
1. codex/<task-name> ブランチで作業・コミット
2. git push origin codex/<task-name>
3. PR を作成（タイトル例: [Phase6] feat: xxx の実装）
4. オーナーが main にマージ
5. Cloudflare command busへ対象SHAを渡す。GitHub Actions fallbackは存在しない
```

### GitHub 管理者権限の扱い

- ユーザーが「反映して」「マージして」「本番へ進めて」と明示した場合、Codex は GitHub 管理者権限で進める前提でよい
- PR が `MERGEABLE` かつ required checks が通過済みで、止まっている理由が `REVIEW_REQUIRED` のみなら、`gh pr merge --admin` で owner review 待ちを bypass してよい
- ただし、失敗中の CI / deploy guardrail / migration guardrail / production smoke を管理者権限で無視してはいけない
- `main` への直接 push は引き続き禁止。管理者権限を使う場合も、`codex/<task-name>` → PR → admin merge → Cloudflare command bus の順序を守る

**Codex がデプロイのために手動SSHで追加作業することは原則ない。** PR を作り、必要なら admin merge し、Cloudflare command bus / Release Commander の exact-SHA 結果を確認する。
本番反映をユーザーが依頼した場合は、PR 作成や merge で止めず、同じSHAの Cloudflare staging、required checks、production command-bus gate が最終状態になるまで監視する。GitHub Actions の旧VPS deploy workflowを復活させない。
`deploy.sh` はローカルの preflight 用であり、本番 deploy はしない。

### Deploy Source of Truth

- low-token deploy entry: `docs/DEPLOY_LOW_TOKEN_PROTOCOL.md`
- deploy manifest: `ops/deploy/deploy_manifest.json`
- retired VPS deploy reference (archive only): `ops/deploy/production_deploy_reference.sh`
- deploy guide: `docs/DEPLOYMENT.md`
- guardrail check: `scripts/check_deploy_guardrails.ps1`
- sync check: `scripts/check_deploy_manifest_sync.ps1`
- deploy status summary: `scripts/deploy_status_summary.ps1`
- branch hygiene audit: `scripts/branch_hygiene_audit.ps1`

### Branch Hygiene

- GitHub repository setting `delete_branch_on_merge` must stay enabled.
- GitHub repository setting `allow_auto_merge` must stay enabled. Autopilot may request auto-merge only after staging and required checks pass.
- Merge policy is squash-only: squash merge enabled, merge commit disabled, rebase merge disabled.
- `main` branch protection requires linear history.
- `main` is the only active long-lived release branch.
- Cloudflare staging deploys the verified PR commit SHA directly; it does not read from the legacy `staging` branch.
- The legacy `staging` branch is retained only until separately approved history maintenance. Do not force-update or delete it during a normal release.
- Feature/rescue work uses short-lived `codex/<task-name>` branches and PRs to `main`.
- Weekly stale branch / open PR / deploy status audit runs via `.github/workflows/branch-hygiene-audit.yml`.

### Persistent paths

以下は本番で保持するため、repo の通常変更や deploy 差分に混ぜない:

- `upload_package/data/**`
- `upload_package/config/secret.php`
- `upload_package/config/oauth_config.php`
- `upload_package/config/config.php`

### GitHub Actions / VPS lane（退役アーカイブ・現行操作禁止）

この節は、`ikimon-vps` の過去の復旧・証拠確認に必要な記録を保持するためのもの。
現行 production/staging の deploy backend ではなく、通常releaseから参照しない。

| 項目 | 値 |
|------|-----|
| ワークフロー | `.github/workflows/deploy.yml` |
| トリガー | `main` への push（PR マージ含む）|
| デプロイ先 | Xserver VPS `162.43.44.131` |
| デプロイ方式 | GitHub Actions → blue/green current-runtime deploy |
| 本番URL | https://ikimon.life/ |

merge 前に `scripts/check_deploy_guardrails.ps1` が CI で必ず通ること。

### 旧VPSディレクトリ構造（退役・復旧証拠専用）

この構造を現役origin、fallback、staging、deploy先として再利用してはならない。

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
