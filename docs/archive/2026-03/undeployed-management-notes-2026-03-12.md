# Untracked But Deployed Notes (2026-03-12)

以下のファイルは、ローカルでは Git 未追跡だが、本番には存在し、SHA256 も一致している。

## AI / taxonomy

- `upload_package/libs/AiAssessmentQueue.php`
- `upload_package/libs/AiBudgetGuard.php`
- `upload_package/libs/AiObservationAssessment.php`
- `upload_package/libs/ObservationMeta.php`
- `upload_package/libs/ObservationRecalcQueue.php`
- `upload_package/libs/SpeciesNarrative.php`
- `upload_package/libs/Taxonomy.php`
- `upload_package/public_html/api/get_observation_ai_status.php`
- `upload_package/public_html/api/propose_observation_metadata.php`
- `upload_package/public_html/api/review_observation_metadata.php`
- `upload_package/public_html/api/support_observation_metadata.php`
- `upload_package/public_html/api/update_observation.php`

## corporate / business workflow

- `upload_package/libs/BusinessApplicationManager.php`
- `upload_package/libs/CorporateAccess.php`
- `upload_package/libs/CorporateInviteManager.php`
- `upload_package/public_html/admin/business_applications.php`
- `upload_package/public_html/api/business/submit_application.php`
- `upload_package/public_html/corporate_invite.php`
- `upload_package/public_html/corporate_members.php`
- `upload_package/public_html/corporate_settings.php`

## 解釈

- これは「ローカル未追跡」ではあるが「未反映」ではない
- すでに手動配備されたコードが、repo 管理だけ外れている状態
- 次の整理では、この単位を Git 管理に乗せるか、別 repo / 別配布物として切り離すかを決める必要がある

## 今回の判断

- まだ `git add` はしていない
- まずは「本番未反映の差分」と誤認しないように、事実だけ記録した

## 次の推奨判断

- この 2 群は runtime data ではなく、通常のアプリケーションコードとして Git 管理へ戻す価値が高い
- 先に `AI / taxonomy` 群を 1 単位で追加し、その後 `corporate / business workflow` 群を追加する方が安全
- 逆に `upload_package/data/taxonomy/` のような cache は今後も Git 管理へ戻さない

## 別扱いにしたもの

- `upload_package/data/taxonomy/` は未追跡だが runtime cache と判断し、ignore 対象へ追加
- `upload_package/.gitignore` はローカル root の `.gitignore` に統合した
