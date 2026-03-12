# Deployment Parity (2026-03-12)

2026-03-12 時点で、以下のファイルはローカルと本番の SHA256 が一致している。

## for-business

- `upload_package/public_html/for-business/index.php`
- `upload_package/public_html/for-business/apply.php`
- `upload_package/public_html/for-business/demo.php`
- `upload_package/public_html/for-business/pricing.php`
- `upload_package/public_html/for-business/status.php`

## event kit

- `upload_package/public_html/create_event.php`
- `upload_package/public_html/edit_event.php`
- `upload_package/public_html/event_detail.php`
- `upload_package/public_html/events.php`
- `upload_package/public_html/bingo.php`
- `upload_package/public_html/api/join_event.php`
- `upload_package/public_html/api/save_event.php`
- `upload_package/public_html/api/generate_bingo_template.php`
- `upload_package/public_html/api/get_event_leaderboard.php`
- `upload_package/libs/CorporateManager.php`

## 意味

- この範囲は「すでに本番反映済みの安定単位」として扱える
- 今後この範囲に差分が出たら、再度デプロイ対象として見る
- ワークツリーの他差分は、この範囲と切り離して判断してよい
