# ikimon.life production QA remediation plan

## Goal

2026-07-10 の本番徹底QAで再現した P0/P1 を、失敗テスト先行・一変数・根因修正で解消する。Cloudflare Worker/D1/R2 の現行runtimeへ staging-first で反映し、本番回帰、データ整合性、fixture残存0、runtime SHA追跡まで確認して閉じる。

## Completion criteria

- Place Memory は未解錠ユーザーへ同セルの他人の記憶を返さず、操作APIも同じ権限契約を守る。
- sitemap/robots/LLM文書、logout、プロフィール設定、外来種導線、capsule応答が本番契約を満たす。
- モバイル地図、主要フォーム、ランドマーク、404 security headers がUI/アクセシビリティgateを通る。
- legacy public observation の権利行と auth timestamp を、アクセス権を広げない明示的 migration で補完する。
- production smoke は D1/R2 fixture をprefix限定で生成・消去でき、共有既存データを変更しない。
- release artifact と `/health` の `gitSha` が production commit SHA と一致する。
- local suites、Worker suites、staging-release、production E2E、主要viewport visual QA、D1/R2 cleanup監査がgreen。

## Work units (Red -> Green)

1. **P0 Place Memory contract**
   - Files: `platform_v2/cloudflare_shadow/src/index.ts`, `platform_v2/cloudflare_shadow/src/index.test.ts`.
   - Red: 未解錠一覧、権限なしlike/hide/report、owner self-likeの失敗ケースを追加する。
   - Green: Fastify正本の `viewerHasCellAccess` と同等の認可を全read/actionへ適用する。
   - Verify: targeted Vitest; expected 0 failures and no cross-user payload.

2. **Worker route/session parity**
   - Files: 同上。
   - Red: `/logout`, localized logout, editable profile settings/save, capsule top-level visibility, auth timestamps, native 404 headersを契約化する。
   - Green: 既存APIを再利用し、互換応答を追加する。未知routeのCSP/XCTO/XFOを補う。
   - Verify: targeted Vitest; expected all new route contracts pass.

3. **Static discovery and runtime traceability**
   - Files: `platform_v2/cloudflare_shadow/scripts/materialize-original-ui-html.mjs`, deploy guard and their tests.
   - Red: canonical origin、`llms.txt` materialization、dry-run gate表示、exact SHA smokeの失敗テストを追加する。
   - Green: inject host/protoを公開originへ固定し、deployへ `IKIMON_GIT_SHA` を注入する。
   - Verify: materialize/build tests and `wrangler deploy --env production --dry-run`; generated sitemap contains no localhost.

4. **Safe production smoke/cleanup**
   - Files: `platform_v2/e2e/production-smoke.spec.ts`, cleanup scripts/tests.
   - Red: shared data mutation禁止、D1/R2 prefix cleanup、zero-residue assertionsを追加する。
   - Green: smoke-owned fixtureのみを作り、finally cleanupでD1/R2/VPSを消去する。
   - Verify: production-safe scopes pass; prefix count and R2 objects both zero.

5. **UI/accessibility**
   - Files: `platform_v2/src/ui/mapExplorer.ts`, `platform_v2/src/routes/read.ts`, `platform_v2/src/ui/observationFieldList.ts` and tests.
   - Red: attribution/launcher overlap、nested main、unlabelled search controlsをテスト化する。
   - Green: mobile safe-area offset、単一main、明示label/aria-labelへ修正する。
   - Verify: targeted tests plus 375/768/1280 screenshots, horizontal overflow 0, focus and fixed-overlap checks pass.

6. **Non-broadening data repair**
   - Files: next numbered D1 migrations under `platform_v2/cloudflare_shadow/migrations/` and migration tests.
   - Red: public legacy rows missing rights and auth users missing timestampsをfixture SQLで検出する。
   - Green: rights=`public_summary`, research/enterprise=`none`, export=false, active withdrawal, null licenses, provenance markerを付ける。null timestampsだけをbackfillし、新規登録もtimestampを設定する。
   - Verify: local migration test; staging D1 counts; production before/after counts; unsafe/export-enabled rows remain zero.

7. **Integration and promotion**
   - Commands: project typecheck/build/tests; Worker typecheck/tests/build/dry-run; production-safe E2E; dependency audit.
   - Expected: 0 failures, 0 high/critical dependency findings, no localhost discovery URLs, no fixture residue.
   - Commit only scoped files, run `git diff --cached --check`, secret scan, exact staged-file review, push branch, open production-impact draft PR.
   - Run staging-release and qualitative UI gate. Promote only after green, then merge through GitHub Actions and monitor production deploy.
   - Postdeploy: exact SHA health check, full safe production smoke, D1/R2 integrity queries, public route/media checks, cleanup zero check.

## Risks and rollback

- **Authorization regression:** deny-by-default; rollback Worker deployment to previous version if targeted cross-user tests fail.
- **Migration semantics:** inserts/updates only missing rows; provenance marker identifies this backfill. Rollback deletes only marker-owned rights rows and never changes existing explicit consent.
- **Production fixture leakage:** unique `qa-20260710-*` prefix and finally cleanup; stop promotion if residue count is nonzero.
- **Static canonical regression:** generated artifacts are inspected before deploy; rollback to previous Worker asset bundle.
- **User-visible regression:** staging 375/768/1280 gate precedes production; Cloudflare version rollback is the production escape hatch.

## Records

- QA source report: `E:\Projects\00_all_projects_management\operations\ikimon_life_production_full_qa_2026-07-10.md`
- Evidence: `E:\Projects\_agent_scratch\yamaki0102-ikimon-platform\qa-20260710\evidence`
- Final remediation result is appended to the QA report with commit SHA, workflow URLs, test totals, migration counts and cleanup counts.
