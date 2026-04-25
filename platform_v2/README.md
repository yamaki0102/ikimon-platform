# ikimon platform v2

`platform_v2` は、ikimon のゼロベース再構築用アプリ層。

現時点の役割:

- PostgreSQL canonical schema を保持する
- legacy cutover 前提の migration runner を持つ
- v2 API の最小骨格を持つ

まだ本番ルーティングには入っていない。  
本番切替は [ikimon_v2_zero_base_cutover_master_plan_2026-04-11.md](/E:/Projects/Playground/docs/architecture/ikimon_v2_zero_base_cutover_master_plan_2026-04-11.md) の gate を満たしてから行う。

## Commands

```bash
npm install
npm run typecheck
npm run migrate
npm run dev
```

危険側の migration は既定で blocked される。

```bash
npm run migrate -- --allow-destructive
```

`DROP / TRUNCATE / ALTER TABLE ... DROP / DELETE / UPDATE` を含む SQL は、rollback plan が明示されるまで通常実行では通さない。

## Notes

- `DATABASE_URL` は PostgreSQL を向く
- migration は `db/migrations/*.sql` を昇順で実行する
- `schema_migrations` に実行済み履歴を保存する
