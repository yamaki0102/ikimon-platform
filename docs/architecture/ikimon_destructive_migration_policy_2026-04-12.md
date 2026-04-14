# ikimon Destructive Migration Policy

更新日: 2026-04-12  
目的: `rollback 不能な migration は merge しない` を実務で曖昧にしない。

---

## 1. 結論

次を含む migration は `destructive migration` とみなす。

- `DROP TABLE`
- `DROP COLUMN`
- `ALTER TABLE ... DROP`
- `TRUNCATE`
- `DELETE FROM`
- `UPDATE`

これらは **既定で blocked**。  
`platform_v2/src/scripts/applyMigrations.ts` は `--allow-destructive` がない限り実行を止める。

---

## 2. Merge 条件

destructive migration を merge してよいのは、次を全部満たす時だけ。

1. rollback plan の文書がある
2. 影響テーブルと影響カラムが明記されている
3. backfill / snapshot / restore 手順が明記されている
4. staging で rehearsal 済み
5. cutover readiness checklist に明示追記されている

1つでも欠けたら merge しない。

---

## 3. Required Artifacts

最低限必要な artifact はこれ。

- rollback runbook
  - どの snapshot から、何分で、どこへ戻すか
- migration note
  - 何を消すか
  - なぜ消すか
  - 代替 canonical source は何か
- staging evidence
  - rehearsal 実行日時
  - 実行者
  - 成否

---

## 4. Review Checklist

reviewer は次だけ見ればよい。

1. SQL に destructive pattern があるか
2. `--allow-destructive` 前提の理由が書かれているか
3. rollback runbook がリンクされているか
4. staging rehearsal の証跡があるか
5. readiness checklist が更新されているか

1つでも `No` なら reject。

---

## 5. Default Decision

迷ったら `merge しない`。  
ikimon.life の現段階では、schema の速い変更より `rollback safety` の方が重要。

---

## 6. Related Files

- [canonical_migration_policy.md](/E:/Projects/Playground/docs/architecture/canonical_migration_policy.md)
- [canonical_rollback_runbook.md](/E:/Projects/Playground/docs/architecture/canonical_rollback_runbook.md)
- [ikimon_v2_cutover_readiness_checklist_2026-04-12.md](/E:/Projects/Playground/docs/architecture/ikimon_v2_cutover_readiness_checklist_2026-04-12.md)
- [applyMigrations.ts](/E:/Projects/Playground/platform_v2/src/scripts/applyMigrations.ts)
