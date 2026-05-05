# Git Recovery Candidates (2026-03-12)

未追跡ファイルを「Git に戻すべきコード」と「ローカル専用」に分けた。

## 1. Git に戻す第一優先

以下はローカル未追跡だが、本番に存在し、SHA256 も一致したアプリケーションコード。

- `upload_package/libs/AiAssessmentQueue.php`
- `upload_package/libs/AiBudgetGuard.php`
- `upload_package/libs/AiObservationAssessment.php`
- `upload_package/libs/Asset.php`
- `upload_package/libs/BusinessApplicationManager.php`
- `upload_package/libs/CorporateAccess.php`
- `upload_package/libs/CorporateInviteManager.php`
- `upload_package/libs/HabitEngine.php`
- `upload_package/libs/ManagedSiteRegistry.php`
- `upload_package/libs/ObservationMeta.php`
- `upload_package/libs/ObservationRecalcQueue.php`
- `upload_package/libs/SpeciesNarrative.php`
- `upload_package/libs/Taxonomy.php`
- `upload_package/public_html/admin/business_applications.php`
- `upload_package/public_html/api/business/submit_application.php`
- `upload_package/public_html/api/feedback.php`
- `upload_package/public_html/api/generate_30by30_report.php`
- `upload_package/public_html/api/get_event_leaderboard.php`
- `upload_package/public_html/api/get_observation_ai_status.php`
- `upload_package/public_html/api/log_reflection.php`
- `upload_package/public_html/api/propose_observation_metadata.php`
- `upload_package/public_html/api/review_observation_metadata.php`
- `upload_package/public_html/api/support_observation_metadata.php`
- `upload_package/public_html/api/update_observation.php`
- `upload_package/public_html/components/feedback_widget.php`
- `upload_package/public_html/corporate_invite.php`
- `upload_package/public_html/corporate_members.php`
- `upload_package/public_html/corporate_settings.php`
- `upload_package/public_html/edit_observation.php`
- `upload_package/public_html/for-business/status.php`
- `upload_package/public_html/guide/nature-positive.php`
- `upload_package/public_html/guide/satoyama-initiative.php`
- `upload_package/scripts/backfill_ai_assessments_for_year.php`
- `upload_package/scripts/backfill_taxonomy_consensus.php`
- `upload_package/scripts/check_ai_assessment_queue.php`
- `upload_package/scripts/check_taxonomy_updates.php`
- `upload_package/scripts/process_ai_assessment_queue.php`
- `upload_package/scripts/process_ai_batch_queue.php`
- `upload_package/scripts/process_ai_deep_queue.php`
- `upload_package/scripts/process_ai_fast_queue.php`
- `upload_package/scripts/process_observation_recalc_queue.php`
- `upload_package/scripts/repair_failed_ai_assessments.php`

## 2. まだ Git に戻さない

以下は本番に存在せず、ローカル専用と判断したもの。

- `upload_package/scripts/backfill_dryrun.php`
- `upload_package/scripts/inspect_obs.php`
- `upload_package/scripts/inspect_photos.php`
- `upload_package/tests/test_ai_assessment_fusion.php`
- `upload_package/tests/test_ai_assessment_queue.php`
- `upload_package/tests/test_corporate_workspace_flow.php`
- `upload_package/tests/test_datastore_getlatest_dedup.php`
- `upload_package/tests/test_managed_context.php`
- `upload_package/tests/test_taxonomy_consensus.php`

## 3. 運用判断

- 第一優先のコード群は、デプロイ対象というより「repo 管理へ復帰させる対象」
- ローカル専用ファイルは、必要になるまで未追跡のまま維持する
- runtime data と cache は今後も Git 管理へ戻さない

## 4. 再確認手順

以下で未追跡コードの分類を再実行できる。

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\classify_untracked_code.ps1
```
