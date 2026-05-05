# ikimon.life プロダクト完成プラン — 実行結果

**作成日**: 2026-03-04
**実行日**: 2026-03-04
**対象**: yamaki0102/ikimon-platform
**方針**: ユーザー投稿データは一切削除しない

---

## 実行済み

### Phase A: 衛生改善 ✅
- [x] A1: explore.php フィルターチップバグ修正（taxon_group パラメータ未送信 + 名前不一致を修正）
- [x] A2: テストユーザー（E2E_*）とサンプル画像をフィードから除外（API + index.php 両方）
- [x] A3: omoikane_dashboard.php / admin/distill_review.php の Auth 修正
- [x] A4: dev専用ファイル15個に .htaccess アクセス制限（public_html/.htaccess + api/.htaccess）
- [x] A5: updates.php に v0.3.0 として Phase 1〜9 の改善成果を追記

### Phase B: ページ整理 ✅
- [x] B1: 廃止ファイル8個を削除（heatmap.php, ranking.php, for-business.php, api/post_identification_v2.php, 3 deprecated components, tactical.css）
- [x] B2: 5ページを301リダイレクト化（id_center→workbench, needs_id→workbench, for-citizen→index, admin_dashboard→admin/, corporate_dashboard→showcase）
- [x] B3: 2ページにnoindex追加（dashboard_municipality, dashboard_portfolio）
- [x] B4: manifest.json ショートカット更新（ranking→compass）

### Phase C: ナビゲーション刷新 ✅
- [x] C1: デスクトップユーザーメニューに3ページ追加（ダッシュボード、わたしの発見、ウェルネス）
- [x] C2: デスクトップ/モバイルメニューからアーカイブページ（municipality, portfolio）のリンクを除去
- [x] C3: モバイルボトムナビ変更（検索→探索, さんぽ→図鑑, メニュー→マイページ）
- [x] C4: フッターから for-citizen.php リンクを除去

### Phase D: ランディングページ改善 ✅
- [x] D1: index.php「脳科学メカニズム」セクションを「数字で見るikimon」（動的統計）に置換
- [x] D2: for-researcher.php の統計4項目をハードコード→DataStore連動に
- [x] D3: about.php チームセクション修正（募集中3枠削除、創業者名表示、採用CTA追加）
- [ ] D4: Google Analytics 設定 — **ユーザーから GA4 測定ID が必要**

### Phase E: 品質仕上げ ✅
- [x] E2: docs/spec/sitemap.md + spec.md を更新
- [x] E3: PRODUCT_COMPLETION_PLAN.md 最終版
- [ ] E1: guide/ ディレクトリ作成 — **将来タスク**

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `public_html/explore.php` | フィルターチップ→taxon_group API連携追加 |
| `public_html/api/get_observations.php` | E2E_ユーザー/sample画像除外フィルタ追加 |
| `public_html/index.php` | テストデータ除外 + 脳科学→動的統計セクション置換 |
| `public_html/omoikane_dashboard.php` | Auth::requireRole('Admin') 有効化 |
| `public_html/admin/distill_review.php` | Auth.php追加 + Auth::requireRole('Admin') 有効化 |
| `public_html/.htaccess` | dev専用ファイルのアクセス制限追加 |
| `public_html/api/.htaccess` | **新規作成** — dev_*ファイルのアクセス制限 |
| `public_html/updates.php` | v0.3.0 エントリ追加 |
| `public_html/manifest.json` | ranking→compass ショートカット修正 |
| `public_html/components/nav.php` | デスクトップメニュー3ページ追加、アーカイブリンク除去、ボトムナビ刷新 |
| `public_html/components/footer.php` | for-citizen.php リンク除去 |
| `public_html/for-researcher.php` | 統計4項目を動的化 |
| `public_html/about.php` | チームセクション修正 |
| `public_html/dashboard_municipality.php` | noindex追加 |
| `public_html/dashboard_portfolio.php` | noindex追加 |
| `public_html/id_center.php` | 301→id_workbench.php |
| `public_html/needs_id.php` | 301→id_workbench.php |
| `public_html/for-citizen.php` | 301→index.php |
| `public_html/admin_dashboard.php` | 301→admin/index.php |
| `public_html/corporate_dashboard.php` | 301→showcase.php |
| `docs/spec/sitemap.md` | 削除/統合/アーカイブ反映 |
| `docs/spec/spec.md` | 統計値更新 |

### 削除済みファイル
- `public_html/heatmap.php`
- `public_html/ranking.php`
- `public_html/for-business.php`
- `public_html/api/post_identification_v2.php`
- `public_html/components/bento_grid.php`
- `public_html/components/bg_radar.php`
- `public_html/components/dopamine_widgets.php`
- `public_html/assets/css/tactical.css`

---

## 残タスク

| タスク | ブロッカー |
|--------|-----------|
| GA4設定 | ユーザーのGA4測定IDが必要 |
| guide/ディレクトリ | 将来タスク（記事が8本仕様にあるが未実装） |
