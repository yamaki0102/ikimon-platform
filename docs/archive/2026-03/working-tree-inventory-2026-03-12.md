# Working Tree Inventory (2026-03-12)

## 目的

ローカル差分のうち、今後のデプロイ判断で混乱しやすいものを分類する。

## 現状の整理方針

1. `upload_package/data/` の差分は原則デプロイ対象外
2. `tmp_*` / `*.bak` / `upload_package/data/sessions/` は実行ゴミとして扱う
3. 本番反映は、毎回「対象ファイルだけ」を個別に転送する
4. 大きな機能群は、イベントキット / for-business / AI・taxonomy / corporate を分けて扱う

## 2026-03-12 時点の状態

- tracked data 差分: 9 件
- tracked `public_html` 差分: 83 件
- tracked `libs` 差分: 11 件
- untracked code 差分: 56 件

## デプロイ対象外として扱うもの

- `upload_package/data/observations.json`
- `upload_package/data/observations/`
- `upload_package/data/notifications.json`
- `upload_package/data/library/*.sqlite3`
- `upload_package/data/indexes/`
- `upload_package/data/sessions/`
- `tmp_*.php`
- `tmp_*.html`
- `tmp_ai_review/`
- `upload_package/public_html/*.bak`

## 直近で本番反映済み

- `upload_package/public_html/for-business/index.php`
- `docs/deployment-parity-2026-03-12.md` に主要ファイルの parity を記録
- `docs/undeployed-management-notes-2026-03-12.md` に「未追跡だが本番にあるコード」を記録
- `docs/tracked-modified-classification-2026-03-12.md` に tracked modified の機能分類を記録

## 今回の整理で反映したこと

- `.gitignore` に temp / session / sqlite sidecar / `.bak` / local helper を追加
- 以下の runtime data を Git index から除外
  - `upload_package/data/notifications.json`
  - `upload_package/data/observations.json`
  - `upload_package/data/observations/2025-12.json`
  - `upload_package/data/library/omoikane.sqlite3`
  - `upload_package/data/library/omoikane.sqlite3-shm`
  - `upload_package/data/library/omoikane.sqlite3-wal`
  - `upload_package/data/indexes/user_guest_772c7937_observations.json`
  - `upload_package/data/indexes/user_guest_7839bc1b_observations.json`
- 以下の未参照残骸を削除
  - `upload_package/public_html/for-business/aikan_proposal.html`
  - `upload_package/public_html/for-business/sample_report.php`
  - `tmp_*.php`
  - `upload_package/tmp_home.html`
  - `upload_package/public_html/map.php.bak`
- `upload_package/.gitignore` は root `.gitignore` に統合して削除
- `upload_package/data/taxonomy/` は runtime cache として ignore 対象へ追加

## 次に整理する単位

### A. event kit

- `upload_package/public_html/create_event.php`
- `upload_package/public_html/edit_event.php`
- `upload_package/public_html/event_detail.php`
- `upload_package/public_html/bingo.php`
- `upload_package/public_html/api/join_event.php`
- `upload_package/public_html/api/save_event.php`
- `upload_package/public_html/api/generate_bingo_template.php`
- `upload_package/public_html/api/get_event_leaderboard.php`
- `upload_package/libs/CorporateManager.php`

### B. for-business

- `upload_package/public_html/for-business/index.php`
- `upload_package/public_html/for-business/apply.php`
- `upload_package/public_html/for-business/demo.php`
- `upload_package/public_html/for-business/status.php`

### C. AI / taxonomy / metadata

- `upload_package/libs/Ai*`
- `upload_package/libs/Taxonomy.php`
- `upload_package/public_html/api/get_observation_ai_status.php`
- `upload_package/public_html/api/propose_observation_metadata.php`
- `upload_package/public_html/api/review_observation_metadata.php`
- `upload_package/public_html/api/support_observation_metadata.php`
- `upload_package/scripts/process_ai_*`

### D. corporate workspace

- `upload_package/libs/BusinessApplicationManager.php`
- `upload_package/libs/CorporateAccess.php`
- `upload_package/libs/CorporateInviteManager.php`
- `upload_package/public_html/admin/business_applications.php`
- `upload_package/public_html/api/business/submit_application.php`
- `upload_package/public_html/corporate_*.php`

### E. tracked modified の既存差分

- `docs/tracked-modified-classification-2026-03-12.md` を基準に、`event kit / for-business / admin-analytics / observation-core / domain-libs` を別々に扱う
- 今回の staged 整理には混ぜず、機能単位で次に切る

## 補足

今回 `.gitignore` には以下を追加済み:

- `tmp_*.php`
- `tmp_*.html`
- `tmp_ai_review/`
- `upload_package/data/sessions/`
- `upload_package/data/*.sqlite3-shm`
- `upload_package/data/*.sqlite3-wal`
- `upload_package/.claude/`
- `upload_package/public_html/*.bak`
- `upload_package/tmp_*.html`
