# ikimon v2 Public Surface Replacement Plan

最終更新: 2026-04-13

---

## 1. 目的

PHP 完全離脱の残件を `public surface replacement` に限定し、公開導線を v2 or 静的配信へ順番に置き換える。

---

## 2. 置換対象の切り方

### A. Public trust / learn / entry

- `/`
- `/about`
- `/faq`
- `/privacy`
- `/terms`
- `/contact`

### B. Business public

- `/for-business`
- `/for-business/pricing`
- `/for-business/demo`
- `/for-business/status`
- `/for-business/apply`
- 旧 flat URL: `/for-business.php`, `/pricing.php`, `/contact.php`

### C. Product public

- `/explore`
- `/record`
- `/home`
- `/observations/:id`
- `/profile/:userId`

### D. Logged-in / specialist PHP surfaces

- `/dashboard.php`
- `/id_workbench.php`
- `/review_queue.php`
- `/site_dashboard.php`
- `/corporate_dashboard.php`
- `/survey*.php`

### E. Legacy archive / exceptional

- `404.php`, `403.php`
- OAuth callback / special compatibility pages
- old embed / widget / showcase 系

---

## 3. 2026-04-13 時点の置換状況

### Green

- `/`
- `/explore`
- `/record`
- `/home`
- `/observations/:id`
- `/profile/:userId`
- `/ops/readiness`
- `/healthz`
- `/about`
- `/faq`
- `/privacy`
- `/terms`
- `/contact`
- `/for-business`
- `/for-business/pricing`
- `/for-business/demo`
- `/for-business/status`
- `/for-business/apply`
- `/about.php -> /about`
- `/faq.php -> /faq`
- `/privacy.php -> /privacy`
- `/terms.php -> /terms`
- `/contact.php -> /contact`
- `/for-business.php -> /for-business`
- `/pricing.php -> /for-business/pricing`
- `/for-business/index.php -> /for-business`
- `/for-business/pricing.php -> /for-business/pricing`
- `/for-business/demo.php -> /for-business/demo`
- `/for-business/status.php -> /for-business/status`
- `/for-business/apply.php -> /for-business/apply`
- `/for-business/create.php -> /for-business/apply`
- `/specialist/id-workbench`
- `/specialist/review-queue`
- `/id_workbench.php -> /specialist/id-workbench`
- `/id_center.php -> /specialist/id-workbench`
- `/needs_id.php -> /specialist/id-workbench`
- `/review_queue.php -> /specialist/review-queue`

### Yellow

- footer / header の最終 IA は未固定
- public 文言は thin parity で、旧 PHP の本文完全移植ではない
- specialist は最小 action までで、full workflow UI は未移植

### Red

- archive/rollback mode 定義
- specialist / logged-in PHP full workflow surface

---

## 4. 置換順

1. header / footer / CTA を v2 側で統一する
2. PHP runtime を archive mode に落とす
3. specialist full workflow surface を段階的に置換する

---

## 5. 今回の意味

- browser で確認すべき public 入口の大半を v2 側で返せるようになった
- public cutover 前でも staging で website 風の遷移確認がしやすくなった
- PHP 離脱の残りは「archive mode と specialist full workflow」に絞れた

---

## 6. 次の進化

archive mode を定義し、PHP runtime を `required` から `fallback only` に下げる。
