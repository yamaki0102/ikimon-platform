# ikimon.life current app

`platform_v2/` は、ikimon.life の現行アプリを置く物理ディレクトリ。ディレクトリ名は deploy / CI / systemd との契約として残しているが、人間向けには「現行アプリ」または「current runtime」と呼ぶ。

## Role

- 本番・staging の通常ルートを担う Node.js / Fastify runtime
- PostgreSQL canonical schema と migration runner を保持する
- 公開ページ、API、login、record、map、admin/support routes の通常入口
- 旧PHP互換データの import / compatibility write / asset bridge を current app 側から制御する

## Entry Points

| Area | Path |
|---|---|
| Routes and pages | `src/routes/` |
| Domain services | `src/services/` |
| UI helpers | `src/ui/` |
| Public content | `src/content/` |
| Runtime config | `src/config.ts` |
| Compatibility boundary | `src/legacy/` |
| Database migrations | `db/migrations/` |
| Browser QA | `e2e/` |

## Commands

```bash
npm install
npm run typecheck
npm run test:node
npm run dev
```

Migration commands are intentionally guarded. Destructive SQL is blocked unless the caller explicitly opts in and has a rollback plan.

```bash
npm run migrate
npm run migrate -- --allow-destructive
```

## Legacy Boundary

Do not start normal work from `upload_package/`. Inspect it only when a task explicitly asks for legacy/PHP work, when current-app code proves a compatibility boundary, or when backup, rollback, deploy, or data-preservation work requires it.
