# Production-Parity Modified Groups (2026-03-12)

tracked modified のうち、ローカルと本番の SHA256 が一致している群を記録する。

## 1. event kit

以下は `tools/check_deploy_parity.ps1 -Group event-kit` で `MATCH` を確認した。

- `upload_package/libs/CorporateManager.php`
- `upload_package/public_html/api/generate_bingo_template.php`
- `upload_package/public_html/api/get_event_leaderboard.php`
- `upload_package/public_html/api/join_event.php`
- `upload_package/public_html/api/save_event.php`
- `upload_package/public_html/bingo.php`
- `upload_package/public_html/create_event.php`
- `upload_package/public_html/edit_event.php`
- `upload_package/public_html/event_detail.php`
- `upload_package/public_html/events.php`

## 2. for-business

以下は `tools/check_deploy_parity.ps1 -Group for-business` で `MATCH` を確認した。

- `upload_package/libs/CorporateManager.php`
- `upload_package/public_html/for-business/apply.php`
- `upload_package/public_html/for-business/demo.php`
- `upload_package/public_html/for-business/index.php`
- `upload_package/public_html/for-business/pricing.php`
- `upload_package/public_html/for-business/status.php`

追加確認:

- `upload_package/public_html/pricing.php` も `MATCH`

## 3. corporate

追加確認:

- `upload_package/public_html/corporate_dashboard.php` も `MATCH`

## 解釈

- これらは `git status` 上では modified だが、`本番未反映` ではない
- 今後の差分整理では「要デプロイ候補」ではなく「Git 履歴への回収候補」として扱う
- 次に parity を取る優先順は `admin-analytics` → `observation-core` → `domain-libs`
