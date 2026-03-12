# Remaining Untracked Decisions (2026-03-12)

未追跡 14 件の扱いを決めた。

## Git に戻す

### 資料

- `docs/strategy/habit_system_global_plan_2026-03-07.md`
- `upload_package/EVENT_KIT_SPEC.md`
- `upload_package/docs/ONAMAE_AI_CRON_RUNBOOK.md`

### テスト

- `tests/Unit/HabitEngineTest.php`
- `upload_package/tests/test_ai_assessment_fusion.php`
- `upload_package/tests/test_ai_assessment_queue.php`
- `upload_package/tests/test_corporate_workspace_flow.php`
- `upload_package/tests/test_datastore_getlatest_dedup.php`
- `upload_package/tests/test_managed_context.php`
- `upload_package/tests/test_taxonomy_consensus.php`

## まだ Git に戻さない

### ローカル補助スクリプト

- `upload_package/scripts/backfill_dryrun.php`
- `upload_package/scripts/inspect_obs.php`
- `upload_package/scripts/inspect_photos.php`

理由:

- 本番には存在しない
- 一時的な inspection / dry-run 用で、通常運用コードとは切り分けた方が安全
- root `.gitignore` に追加して、今後は未追跡ノイズとして出さない

### Git に戻す運用 helper

- `upload_package/verify_delete.php`

理由:

- 本番には存在する
- root 直下の CLI helper で、web 公開物ではない
- 現状の repo から隠れているより、Git 管理下に戻して存在を明示した方が安全
- 次の段階では「残す」ではなく「退役させるか」を判断する

## 補足

- この判断は `2026-03-12` 時点の cleanup 用
- 本番デプロイ判断とは別に扱う
