# Replacement Final Checklist — 本番 → staging 差し替え前 最終チェック表

更新日: 2026-04-23
正本ソース: [`docs/strategy/ikimon_public_surface_canonical_pack_2026-04-22.md`](./ikimon_public_surface_canonical_pack_2026-04-22.md)（以下 *canonical pack*）
自動チェック: `platform_v2/src/scripts/replacementReadinessReport.ts` の出力（`platform_v2/ops/reports/replacement-readiness-*.md`）

このチェック表は **人間が Go/No-Go を判断する最終決裁シート**。`MISSING_INTENT_UNCLEAR`
が 1 行でも残っていれば No-Go。Section E の `hard_stop=true` が 1 件でも `FAIL` でも No-Go。

---

## 0. 使い方

1. **Section A** で本番全ページの disposition と staging 対応先を確認
2. **Section B** で文言改名が UI に浸透してるかを grep ベースで検証
3. **Section C** で API family の差し替え戦略を確認
4. **Section D** で readiness レポート（自動）を読む
5. **Section E** を上から順に塗り、ハードストップ集計欄で最終判定

`MISSING_INTENT_UNCLEAR` 抽出: `grep MISSING_INTENT_UNCLEAR docs/strategy/replacement_final_checklist_2026-04-23.md`

---

## Section A: 機能マッピング表

カラム凡例:
- `disposition`: `keep` / `keep secondary` / `keep support` / `keep deep` / `keep backstage` / `keep internal` / `keep technical` / `merge` / `redirect` / `rename` / `demote` / `experimental` / `archive` / `MISSING_INTENT_UNCLEAR`
- `decision`: `GO` / `WATCH` / `BLOCK` / 空欄=未決
- `wording_check`: `verified` / `mismatch` / `not_yet_checked`

### A.1 公開ページ（top nav 候補）

| prod_route | prod_intent | staging_route | disposition | canonical_anchor | wording_check | owner | decision |
|---|---|---|---|---|---|---|---|
| `/index.php` | ホーム / ランディング | `/` | redirect → `/` (keep + rewrite) | §3.1, §7.2 | not_yet_checked | TBD | |
| `/post.php` | 投稿作成 | `/record` | redirect | §7.2 | not_yet_checked | TBD | |
| `/map.php` | マップ | `/map` | redirect | §7.2 | not_yet_checked | TBD | |
| `/explore.php` | 探索 | `/explore` | redirect | §7.2 | not_yet_checked | TBD | |
| `/profile.php` | マイプロフィール | `/profile` | redirect | §7.2 | not_yet_checked | TBD | |
| `/about.php` | サイトについて | `/about` | redirect + relabel `ikimonの考え方` | §3.2, §7.2, §4.7 | not_yet_checked | TBD | |
| `/faq.php` | よくある質問 | `/faq` | redirect | §3.2, §7.2 | not_yet_checked | TBD | |
| `/privacy.php` | プライバシーポリシー | `/privacy` | redirect | §3.2, §7.2 | not_yet_checked | TBD | |
| `/terms.php` | 利用規約 | `/terms` | redirect | §3.2, §7.2 | not_yet_checked | TBD | |
| `/contact.php` | お問い合わせ | `/contact` | redirect | §3.2, §7.2 | not_yet_checked | TBD | |
| `/methodology.php` | データ方針と評価手法 | `/learn/methodology` | redirect (Page B 統合) | §2.4, §7.2 | not_yet_checked | TBD | |
| `/guides.php` | ガイド一覧 | `/learn` | redirect | §3.2, §7.2 | not_yet_checked | TBD | |
| `/updates.php` | 更新履歴 | `/learn/updates` | redirect | §7.2 | not_yet_checked | TBD | |
| `/pricing.php` | 料金プラン | `/for-business/pricing` | redirect | §3.2, §7.2 | not_yet_checked | TBD | |
| `/livemap.php` | リアルタイムマップ | `/map` | redirect | §7.2 | not_yet_checked | TBD | |
| `/biodiversity_map.php` | 生物多様性マップ | `/map` | merge (map layers) | §7.2 | not_yet_checked | TBD | |
| `/zukan.php` | いきもん図鑑 | `/explore` | merge (deep catalog) | §3.1, §7.2 | not_yet_checked | TBD | |
| `/for-citizen.php` | 市民向け | `/` | redirect | §7.2 | not_yet_checked | TBD | |
| `/android-app.php` | Androidアプリ案内 | `/` or `/record` install section | merge | §7.2 | not_yet_checked | TBD | |
| `/observation_detail.php` | 観察詳細 | (legacy keep, alias `/observations/:id` 予定) | keep | §3.1, §7.1 | not_yet_checked | TBD | |
| `/species.php` | 種詳細 | (legacy keep deep) | keep deep | §3.1, §7.1 | not_yet_checked | TBD | |
| `/compare.php` | 種比較 | (legacy keep deep) | keep deep | §3.1, §7.1 | not_yet_checked | TBD | |
| `/id_wizard.php` | 同定ウィザード | (legacy keep support) | keep support | §3.1, §7.1 | not_yet_checked | TBD | |
| `/compass.php` | 方位計 | (legacy keep support) | keep support | §3.1, §7.1 | not_yet_checked | TBD | |
| `/wellness.php` | ネイチャーウェルネス | (legacy keep secondary) | keep secondary | §3.1, §7.1 | not_yet_checked | TBD | |
| `/guidelines.php` | コミュニティガイドライン | `/learn/methodology` + support detail | merge support | §3.2, §7.2 | not_yet_checked | TBD | |
| `/team.php` | チーム | `/about` | merge | §3.2, §7.2 | not_yet_checked | TBD | |
| `/sitemap.php` | XML sitemap | (technical) | keep technical | §3.2, §7.5 | not_yet_checked | TBD | |
| `/offline.php` | オフライン | (technical) | keep technical | §3.2, §7.5 | not_yet_checked | TBD | |
| `/manifest.php` | PWAマニフェスト | (technical) | keep technical | §3.4, §7.5 | not_yet_checked | TBD | |
| `/sw.php` | Service Worker | (technical) | keep technical | §3.4, §7.5 | not_yet_checked | TBD | |
| `/403.php` | アクセス拒否 | (technical) | keep support | §7.5 | not_yet_checked | TBD | |
| `/404.php` | ページなし | (technical) | keep support | §7.5 | not_yet_checked | TBD | |

### A.2 ユーザー機能（認証必須）

| prod_route | prod_intent | staging_route | disposition | canonical_anchor | wording_check | owner | decision |
|---|---|---|---|---|---|---|---|
| `/dashboard.php` | ユーザー統計 | `/profile` | merge (self stats を profile 配下) | §3.1, §7.2 | not_yet_checked | TBD | |
| `/my_organisms.php` | マイいきもの | `/profile` | merge (life list) | §3.1, §7.2 | not_yet_checked | TBD | |
| `/profile_edit.php` | プロフィール編集 | `/profile` (utility配下) | merge in IA | §3.1, §7.2 | not_yet_checked | TBD | |
| `/edit_observation.php` | 観察編集 | `/observation_detail.php` family | keep support | §3.1, §7.2 | not_yet_checked | TBD | |
| `/id_form.php` | 同定フォーム | (legacy keep support) | keep support | §3.1, §7.1 | not_yet_checked | TBD | |
| `/id_center.php` | 同定センター | `/specialist/id-workbench` | redirect | §7.2 | not_yet_checked | TBD | |
| `/needs_id.php` | 同定待ち一覧 | `/specialist/id-workbench` | redirect | §7.2 | not_yet_checked | TBD | |
| `/id_workbench.php` | 同定ワークベンチ | `/specialist/id-workbench` | redirect | §7.2 | not_yet_checked | TBD | |
| `/review_queue.php` | レビューキュー | `/specialist/review-queue` | redirect | §3.4, §7.2 | not_yet_checked | TBD | |
| `/scan.php` | スキャン (legacy) | `/field_research.php` | redirect (fieldscan family 一本化) | §7.3 | not_yet_checked | TBD | |
| `/field_scan.php` | フィールドスキャン | `/field_research.php` | redirect | §7.3 | not_yet_checked | TBD | |
| `/fieldscan.php` | FieldScan アプリ | `/field_research.php` | redirect | §7.3 | not_yet_checked | TBD | |
| `/bioscan.php` | バイオスキャン | `/field_research.php` | redirect | §7.3 | not_yet_checked | TBD | |
| `/walk.php` | ウォークモード | `/field_research.php` | redirect | §7.3 | not_yet_checked | TBD | |
| `/field_research.php` | フィールド研究 | (legacy experimental) | keep experimental/backstage | §7.3 | not_yet_checked | TBD | |
| `/ikimon_walk.php` | ikimonウォーク | `/profile` (walk history) | merge | §7.2 | not_yet_checked | TBD | |
| `/quests.php` | クエスト | (なし) | archive or merge into community later | §7.4 | not_yet_checked | TBD | |
| `/survey.php` | フィールド調査 | (legacy keep) | keep secondary | §3.1, §7.1 | not_yet_checked | TBD | |

### A.3 イベント / コミュニティ

| prod_route | prod_intent | staging_route | disposition | canonical_anchor | wording_check | owner | decision |
|---|---|---|---|---|---|---|---|
| `/events.php` | 観察会一覧 | (legacy keep) | keep | §3.1, §7.1 | not_yet_checked | TBD | |
| `/event_detail.php` | イベント詳細 | (legacy keep) | keep | §3.1, §7.1 | not_yet_checked | TBD | |
| `/create_event.php` | イベント作成 | (legacy backstage) | keep backstage (top nav 出さない) | §3.1, §7.3 | not_yet_checked | TBD | |
| `/edit_event.php` | イベント編集 | (legacy backstage) | keep backstage | §3.1, §7.3 | not_yet_checked | TBD | |
| `/event_dashboard.php` | イベントダッシュボード | (organizer utility) | keep internal/backstage | §3.4, §7.3 | not_yet_checked | TBD | |
| `/bingo.php` | ビンゴ (community challenge) | (legacy keep) | keep secondary | §3.1, §7.1 | not_yet_checked | TBD | |
| `/bioblitz_join.php` | BioBlitz QR参加 | `/events.php` (audit 後 merge) | merge into `/events.php` | §7.4 | not_yet_checked | TBD | |
| `/surveyors.php` | 調査員マッチング | (backstage) | keep internal/backstage | §3.4, §7.3 | not_yet_checked | TBD | |
| `/surveyor_profile.php` | 調査員プロフィール | (backstage) | keep internal/backstage | §3.4, §7.3 | not_yet_checked | TBD | |
| `/surveyor_profile_edit.php` | 調査員プロフィール編集 | (backstage) | keep internal/backstage | §3.4, §7.3 | not_yet_checked | TBD | |
| `/surveyor_records.php` | 調査員公式記録 | (backstage) | keep internal/backstage | §3.4, §7.3 | not_yet_checked | TBD | |
| `/request_survey.php` | 調査依頼 | (backstage) | keep backstage | §3.3, §7.3 | not_yet_checked | TBD | |

### A.4 ビジネス / パートナー

| prod_route | prod_intent | staging_route | disposition | canonical_anchor | wording_check | owner | decision |
|---|---|---|---|---|---|---|---|
| `/for-business.php` | B2Bメイン | `/for-business` | redirect | §7.2 | not_yet_checked | TBD | |
| `/for-business/index.php` | B2Bトップ | `/for-business` | redirect | §7.2 | not_yet_checked | TBD | |
| `/for-business/pricing.php` | B2B料金 | `/for-business/pricing` | redirect | §7.2 | not_yet_checked | TBD | |
| `/for-business/demo.php` | B2Bデモ | `/for-business/demo` | redirect | §7.2 | not_yet_checked | TBD | |
| `/for-business/status.php` | B2B status | `/for-business/status` | redirect | §7.2 | not_yet_checked | TBD | |
| `/for-business/apply.php` | B2B申込 | `/for-business/apply` | redirect | §7.2 | not_yet_checked | TBD | |
| `/for-business/create.php` | B2Bアカウント作成 | `/for-business/apply` | redirect (intake 一本化) | §7.2 | not_yet_checked | TBD | |
| `/for-researcher.php` | 研究者向け | (rewrite support) | rewrite support (Page B との橋渡し) | §3.3, §7.3 | not_yet_checked | TBD | |
| `/showcase.php` | ショーケース | (backstage) | keep backstage | §3.3, §7.3 | not_yet_checked | TBD | |
| `/csr_showcase.php` | CSRショーケース | (backstage) | keep backstage | §3.3, §7.3 | not_yet_checked | TBD | |
| `/site_dashboard.php` | サイトダッシュボード | (backstage) | keep backstage (place workspace) | §3.3, §7.3 | not_yet_checked | TBD | |
| `/site_editor.php` | サイトエディタ | (backstage) | keep backstage | §3.3, §7.3 | not_yet_checked | TBD | |
| `/corporate_dashboard.php` | 企業ダッシュボード | (backstage) | keep backstage | §3.3, §7.3 | not_yet_checked | TBD | |
| `/corporate_members.php` | 企業メンバー管理 | (backstage) | keep backstage | §3.3, §7.3 | not_yet_checked | TBD | |
| `/corporate_settings.php` | 企業設定 | (backstage) | keep backstage | §3.3, §7.3 | not_yet_checked | TBD | |
| `/corporate_invite.php` | 企業招待 | (backstage) | keep backstage | §3.3, §7.3 | not_yet_checked | TBD | |
| `/dashboard_municipality.php` | 自治体ダッシュボード | (backstage) | keep backstage | §3.3, §7.3 | not_yet_checked | TBD | |
| `/dashboard_portfolio.php` | ポートフォリオ | (backstage) | keep backstage | §3.3, §7.3 | not_yet_checked | TBD | |
| `/demo/index.php` | デモトップ | (backstage) | keep backstage | §3.3, §7.3 | not_yet_checked | TBD | |
| `/demo/report.php` | デモレポート | (backstage) | keep backstage | §3.3, §7.3 | not_yet_checked | TBD | |
| `/showcase_embed.php` | ショーケース埋込 | (backstage) | keep backstage | §3.3, §7.3 | not_yet_checked | TBD | |
| `/widget.php` | Living Data Feed widget | (backstage) | keep backstage | §3.3, §7.3 | not_yet_checked | TBD | |

### A.5 レポート / 分析

| prod_route | prod_intent | staging_route | disposition | canonical_anchor | wording_check | owner | decision |
|---|---|---|---|---|---|---|---|
| `/generate_event_report.php` | イベントレポート生成 | (backstage utility) | keep internal/backstage | §3.4, §7.3 | not_yet_checked | TBD | |
| `/generate_grant_report.php` | 助成金レポート生成 | (backstage utility) | keep internal/backstage | §3.4, §7.3 | not_yet_checked | TBD | |
| `/analytics.php` | マイ統計 | (なし) | archive | §7.4 | not_yet_checked | TBD | |
| `/views/dashboard_overview.php` | ダッシュボード概要 | — | archive (orphaned partial) | 2026-04-23 調査 (grep 0 hit) | verified | TBD | GO |
| `/views/dashboard_events.php` | イベント・ミッション管理 | — | archive (orphaned partial) | 2026-04-23 調査 (grep 0 hit) | verified | TBD | GO |
| `/views/dashboard_map_3d.php` | 3Dマップビュー | — | archive (orphaned partial) | 2026-04-23 調査 (grep 0 hit) | verified | TBD | GO |
| `/views/dashboard_reports.php` | レポート出力 | — | archive (orphaned partial) | 2026-04-23 調査 (grep 0 hit) | verified | TBD | GO |
| `/views/dashboard_settings.php` | ダッシュボード設定 | — | archive (orphaned partial) | 2026-04-23 調査 (grep 0 hit) | verified | TBD | GO |
| `/views/dashboard_system.php` | デジタルツインアーキテクチャ | — | archive (orphaned partial) | 2026-04-23 調査 (grep 0 hit) | verified | TBD | GO |

### A.6 教育 / 学習 / 深掘り

| prod_route | prod_intent | staging_route | disposition | canonical_anchor | wording_check | owner | decision |
|---|---|---|---|---|---|---|---|
| `/century_archive.php` | 100年生態系アーカイブ | — | archive | §7.4 | not_yet_checked | TBD | |
| `/sound_archive.php` | サウンドアーカイブ | — | archive | §7.4 | not_yet_checked | TBD | |
| `/reference_layer.php` | 参考図層 | — | archive | §7.4 | not_yet_checked | TBD | |
| `/guide/nature-positive.php` | ネイチャーポジティブ | (longform) | keep support (SEO/longform) | §3.2, §7.5 | not_yet_checked | TBD | |
| `/guide/what-is-nature-positive.php` | ネイチャーポジティブ解説 | (longform) | keep support | §3.2, §7.5 | not_yet_checked | TBD | |
| `/guide/japan-biodiversity.php` | 日本の生物多様性 | (longform) | keep support | §3.2, §7.5 | not_yet_checked | TBD | |
| `/guide/regional-biodiversity.php` | 地域生物多様性 | (longform) | keep support | §3.2, §7.5 | not_yet_checked | TBD | |
| `/guide/satoyama-initiative.php` | 里山イニシアティブ | (longform) | keep support | §3.2, §7.5 | not_yet_checked | TBD | |
| `/guide/nature-coexistence-sites-analysis.php` | 自然共存サイト分析 | (longform) | keep support | §3.2, §7.5 | not_yet_checked | TBD | |
| `/guide/ikimon-approach.php` | ikimonアプローチ | (longform) | keep support | §3.2, §7.5 | not_yet_checked | TBD | |
| `/guide/corporate-walking-program.php` | 企業ウォーキング | (longform) | keep support | §3.2, §7.5 | not_yet_checked | TBD | |
| `/guide/walking-brain-science.php` | ウォーキング脳科学 | (longform) | keep support | §3.2, §7.5 | not_yet_checked | TBD | |
| `/guide/steps-dementia-prevention.php` | 認知症予防ステップ | (longform) | keep support | §3.2, §7.5 | not_yet_checked | TBD | |
| `/guide/species-id-brain-training.php` | 種同定脳トレ | (longform) | keep support | §3.2, §7.5 | not_yet_checked | TBD | |

### A.7 認証 / OAuth / アプリ連携

| prod_route | prod_intent | staging_route | disposition | canonical_anchor | wording_check | owner | decision |
|---|---|---|---|---|---|---|---|
| `/login.php` | ログイン | (legacy keep support) | keep support | §3.1, §7.5 | not_yet_checked | TBD | |
| `/logout.php` | ログアウト | (legacy keep support) | keep support | §3.1, §7.5 | not_yet_checked | TBD | |
| `/oauth_login.php` | OAuthログイン | (legacy keep support) | keep support | §7.5 | not_yet_checked | TBD | |
| `/oauth_callback.php` | OAuthコールバック | (legacy keep support) | keep support | §7.5 | not_yet_checked | TBD | |
| `/app_oauth_start.php` | アプリOAuth開始 | (legacy keep support) | keep support | §7.5 | not_yet_checked | TBD | |
| `/app_auth_redeem.php` | アプリ認証トークン引継 | (legacy keep support) | keep support | §7.5 | not_yet_checked | TBD | |
| `/app_auth_complete.php` | アプリ認証完了 | (legacy keep support) | keep support | §7.5 | not_yet_checked | TBD | |
| `/invite.php` | 招待リンク処理 | (legacy keep support) | keep support | §7.5 | not_yet_checked | TBD | |
| `/admin_dashboard.php` | 旧管理画面 | `/admin/` | redirect | §3.4, §7.2 | not_yet_checked | TBD | |
| `/api_omoikane_search.php` | OMOIKANE 内部検索 | (internal API) | keep internal API | §7.5 | not_yet_checked | TBD | |
| `/api_omoikane_status.php` | OMOIKANE 内部ステータス | (internal API) | keep internal API | §7.5 | not_yet_checked | TBD | |
| `/omoikane_dashboard.php` | OMOIKANE 抽出コンソール | (internal) | keep internal | §3.4 | not_yet_checked | TBD | |

### A.8 admin/ サブディレクトリ（一括宣言）

`canonical pack §3.4` で `/admin/*` 全体に `keep internal` を一括宣言済み。public surface 対象外。
個別ページの存続/廃止は本チェック表の対象外（admin 系の独立レビューサイクルで管理）。
※ 念のため列挙だけしておく:

| prod_route | prod_intent | disposition |
|---|---|---|
| `/admin/index.php` | System Overview | keep internal |
| `/admin/observations.php` | 観察管理 | keep internal |
| `/admin/moderation.php` | モデレーション | keep internal |
| `/admin/users.php` | ユーザー管理 | keep internal |
| `/admin/surveyors.php` | 調査員管理 | keep internal |
| `/admin/verification.php` | Verification Queue | keep internal |
| `/admin/queues.php` | Job Monitor | keep internal |
| `/admin/omoikane_dashboard.php` | OMOIKANE 抽出コンソール | keep internal |
| `/admin/fieldscan_sessions.php` | FieldScan 解析 | keep internal |
| `/admin/business_applications.php` | B2B申込管理 | keep internal |
| `/admin/distill_review.php` | Review Distilled Papers | keep internal |
| `/admin/literature_review.php` | AI蒸留知識レビュー | keep internal |
| `/admin/significant_observations.php` | 重要観察アラート管理 | keep internal |
| `/admin/corporate.php` | 契約団体管理 | keep internal |

### A.9 staging 専用ルート（本番に対応物なし、新規追加）

| staging_route | intent | disposition | canonical_anchor | notes |
|---|---|---|---|---|
| `/home` | signed-in home | keep secondary | §3.1 | marketing top と分離 |
| `/record` | capture entry | keep | §3.1 | `/post.php` の canonical 後継 |
| `/notes` | notebook home | keep | §3.1 | field note 読み返し |
| `/explore` | discovery surface | keep | §3.1 | place discovery |
| `/lens` | AI help explainer | keep + rename concept | §3.1, §5.2 | `フィールドガイド` 名から rename |
| `/guide` | Live guide (experimental) | rename + demote `ライブガイド` | §3.1, §5.2, §7.3 | public primary にしない |
| `/learn` | learn hub | keep | §3.2 | trust hub |
| `/learn/identification-basics` | ID basics | keep | §3.2 | beginner support |
| `/learn/methodology` | Page B (research/data/trust) | keep + rewrite | §2.4, §3.2 | Page B 主候補 |
| `/learn/authority-policy` | review policy detail | merge under `/learn/methodology` | §3.2 | 独立主役にしない |
| `/learn/glossary` | 用語集 | keep | §3.2 | support |
| `/learn/field-loop` | field loop concept note | demote | §3.2 | public 主語にしない（内部概念ページとして残す） |
| `/learn/updates` | updates / release notes | keep | §3.2 | release note lane |
| `/qa/site-map` | QA sitemap | keep internal | §3.4 | human QA only |
| `/specialist/id-workbench` | specialist workbench | keep internal | §3.4 | public nav 非掲載 |
| `/specialist/review-queue` | review queue | keep internal | §3.4 | internal lane |
| `/specialist/recommendations` | authority recommendations | keep internal | §3.4 | internal lane |
| `/specialist/authority-audit` | authority audit | keep internal | §3.4 | internal lane |
| `/specialist/authority-admin` | authority admin | keep internal | §3.4 | internal lane |
| `/authority/recommendations` | self authority application | keep internal | §3.4 | internal lane |
| `/healthz` | health check | keep technical | §3.4 | ops |
| `/readyz` | readiness check | keep technical | §3.4 | ops |
| `/ops/readiness` | ops readiness | keep technical | §3.4 | ops |

### A.10 components/* と admin/components/* （部分テンプレ、ページではない）

`upload_package/public_html/components/*.php`（28個）と `upload_package/public_html/admin/components/*.php`（3個）は **ページではなく partials**。
disposition の対象外。public surface には登場しないため、本チェック表では追跡不要。
（必要なら別途「partial inventory」を作る）

---

## Section B: 紛らわしい文言ペア表

canonical pack §6 (Terminology Crosswalk) の **UI 浸透状況**。
`expected_hit_count` を超えていれば修正が必要。`pass=false` 行はすべて差し替え前に解消する。

検索範囲: `platform_v2/src/**/*`

| concept | current_in_prod | canonical_public_term | canonical_internal_term | verdict | grep query | hit_count | expected | pass | route_exclusion | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| AI ライブガイド系（混線元） | `フィールドガイド` | `その場で調べる` (`/lens`) / `ライブガイド` (`/guide`) | guide / live guide | retire as umbrella | `フィールドガイド` | 0 | 0 | ✅ | (なし) | 2026-04-23 修正済。public.json / guideFlow.ts / guideTts.ts を `ライブガイド` に統一 |
| 場所決定 vs センサー | `フィールドスキャン` | `探索マップ` (`/map`) / `センサースキャン` | scan / fieldscan | retire as umbrella | `フィールドスキャン` | 0 | 0 | ✅ | (なし) | OK — staging UI に残存なし |
| 概念名 | `フィールドループ` | `見つける -> 残す -> また歩く` | field loop | demote | `フィールドループ` | 6 | 6 | ✅ | `/learn/field-loop` (内部概念ページ) | OK — 全ヒットが `learn-field-loop.md` 系または demote 対象テスト/glossary。public hero には未出を grep で目視確認すること |
| ENJOY NATURE | `ENJOY NATURE` | `ENJOY NATURE` | — | keep | `ENJOY NATURE` | 6 | ≥1 | ✅ | (全公開面で歓迎) | OK — `/` hero で必須。i18n/ja.ts, content/short/ja/public.json で明示 |
| 内部哲学 (公開不可) | `place-first` | (公開で使わない) | `place-first` | keep internal only | `place-first` | 5 | 0 (公開UI) | ⚠ | `copy/jaPublic.ts` の `INTERNAL_TERMS` 配列, `routes/marketing.routes.test.ts` (テスト記述), `content/longform/*/learn-field-loop.md` (内部概念ページ) | 公開 UI 出力に出ていなければ OK。要目視: `learn-field-loop.md` で hero ではなく本文中での使用に留まっているか |
| 内部哲学 (公開不可) | `Place Intelligence OS` | (公開で使わない) | `Place Intelligence OS` | keep internal only | `Place Intelligence OS` | 0 | 0 | ✅ | (公開で使わない) | OK |
| Sponsor 用語 | `sponsor` / `スポンサー` | `団体相談` | sponsor / partner | rename public | `sponsor\|スポンサー` (大小区別なし) | 0 | 0 | ✅ | (なし) | OK |
| Authority | `authority policy` / `権限ポリシー` | `同定の信頼のしくみ` | authority policy | rename public | `authority policy\|権限ポリシー` | 0 | 0 | ✅ | (なし) | OK — public surface に直接表現なし。内部 review API 名に `authority` は許容 |
| Methodology (jp public) | `methodology` / `メソドロジー` | `研究とデータの考え方` | methodology | rename public | `methodology\|メソドロジー` | 8 | ≥1 | ⚠ | route key (`/learn/methodology`) はそのまま許容、test files も許容 | 要目視: 公開コピー側に `メソドロジー` のような英語直訳が UI 文字として残っていないか確認。route 名と内部識別子は許容 |
| Public claim | `public claim` / `公開請求` | `公開候補` | public claim | internalize | `public claim\|公開請求` | 3 | 0 (UI 文言) | ✅ | `copy/jaPublic.ts` の `INTERNAL_TERMS` 配列, `i18n/en.ts`, `content/short/ja/ops.json` (ops 内部) | OK — internal terms 配列宣言は許容（public UI に出さない仕組み）。`ops.json` は ops 面のため許容 |
| フィールドノート | `フィールドノート` | `フィールドノート` | field note | keep | `フィールドノート` | (要再 grep) | ≥1 | (要確認) | (全公開面で歓迎) | canonical pack §5.2 で keep。/notes hero やラベルで使われていることを確認 |
| 記録する (CTA) | `記録する` | `記録する` | record | keep | `記録する` | (要再 grep) | ≥1 | (要確認) | (CTA で歓迎) | canonical pack §4.1, §4.2, §5.2 で primary CTA。`/record` ページに必ず存在 |

### B 補足: 検証スクリプト雛形

```bash
# Bash 検証例
for term in 'フィールドガイド' 'フィールドスキャン' 'sponsor' 'スポンサー' 'authority policy'; do
  echo "=== $term ==="
  rg -l "$term" platform_v2/src
done
```

差し替え当日（T-1h）に再実行し、`hit_count` を更新する。

---

## Section C: API エンドポイント差分

本番 188 endpoint を 20 family に分類（2026-04-23 再分類完了、other=0）。
詳細内訳: [`api_family_reclassification_2026-04-23.md`](./api_family_reclassification_2026-04-23.md)

### C.1 Family レベル表

| family | prod_count | prod_examples | staging_module | disposition | cutover_strategy | owner | decision |
|---|---|---|---|---|---|---|---|
| contact | 2 | feedback.php, report_content.php | `marketing.ts`, `write.ts` (`/api/v1/contact/*`) | migrated | staging_only | TBD | |
| auth | 4 | login_ajax.php, app_login.php, verify.php | `write.ts` (`/api/v1/auth/*`) | migrated + legacy_continued (app OAuth) | dual_write | TBD | |
| map | 10 | get_site_geojson.php, heatmap_data.php, geo_context.php | `mapApi.ts` (`/api/v1/map/*`) | migrated + legacy_continued | proxy_to_legacy | TBD | |
| walk | 12 | save_track.php, live_detections.php, passive_event.php | `walkApi.ts` (`/api/v1/walk/*`) | migrated (advanced capture support) + legacy_continued | proxy_to_legacy | TBD | |
| guide | 5 | site_guide.php, voice_guide.php, get_learning_hint.php | `guideApi.ts` (`/api/v1/guide/*`) | migrated experimental | staging_only | TBD | |
| fieldscan | 10 | env_scan.php, fieldscan_debug.php, scan_draft_save.php | `fieldscanApi.ts` (`/api/v1/fieldscan/*`) | migrated experimental | staging_only | TBD | |
| research | 6 | export_dwc.php, export_dwca.php, gbif_publish.php | `researchApi.ts` (`/api/v1/research/*`) | migrated (Tier 3+ filter) | staging_only | TBD | |
| ui-kpi | 12 | save_analytics.php, click.php, submit_nps.php | `uiKpi.ts` (`/api/v1/ui-kpi/*`) | migrated internal + legacy_continued | proxy_to_legacy | TBD | |
| specialist | 4 | freetext_review.php, review_observation_metadata.php, post_dispute.php | `read.ts` / `write.ts` (`/api/v1/specialist/*`) | migrated internal | staging_only | TBD | |
| observation | 15 | post_observation.php, add_observation_photo.php, quick_post.php | (legacy continues; v2 migration target) | legacy_continued | proxy_to_legacy | TBD | |
| identification | 23 | post_identification.php, ai_suggest.php, predict_species.php | (legacy continues; specialist lane と整合) | legacy_continued | proxy_to_legacy | TBD | |
| site-report | 16 | generate_report.php, plot_report.php, tnfd_leap_report.php | (backstage; partner reporting) | legacy_continued backstage | proxy_to_legacy | TBD | |
| event-community | 25 | get_events.php, get_daily_quests.php, log_reflection.php | (legacy keep) | legacy_continued | proxy_to_legacy | TBD | |
| user-auth | 13 | update_profile.php, toggle_follow.php, update_role.php | (legacy keep, auth/profile/notification) | legacy_continued | proxy_to_legacy | TBD | |
| region-stats | 20 | mesh_aggregates.php, nature_score.php, bio-index.php | (legacy keep, map/stats discover support) | legacy_continued | proxy_to_legacy | TBD | |
| export | 7 | export_observations.php, export_site_csv.php, export_event_species_xlsx.php | (legacy keep backstage; research/partner) | legacy_continued backstage | proxy_to_legacy | TBD | |
| dev-debug | 6 | csrf_debug.php, verify_config.php, test_concurrency.php | — | archive_from_public_deploy | **block_at_edge** | TBD | |
| **audio** (新設 2026-04-23) | 9 | analyze_audio.php, audio_batch_submit.php, sound_archive_*.php | — | legacy_continued | proxy_to_legacy | TBD | |
| **notification** (新設 2026-04-23) | 5 | push_subscribe.php, get_notifications.php, csp_report.php | — | legacy_continued | proxy_to_legacy | TBD | |
| **misc/utility** (新設 2026-04-23) | 9 | bootstrap.php, health.php, admin.php, admin_action.php | — | mixed (block_at_edge for admin, staging_only for health) | mixed | TBD | WATCH (bootstrap.php 要精査) |

合計: 188（20 family、other=0 達成）

### C.2 例外テーブル（family 単位の disposition を上書きする個別 endpoint）

差し替え当日に「特定 1 endpoint だけ挙動が違う」場合の上書き表。空テンプレ。

| endpoint | parent_family | exception_disposition | reason | owner |
|---|---|---|---|---|
| (空) | | | | |

### C.3 重要な注意

1. ~~**`other` カテゴリ 62 件は要再分類**~~ → ✅ 2026-04-23 解決。`api_family_reclassification_2026-04-23.md` で 20 family 体系に整理完了、other=0
2. **`dev-debug` family は edge で必ず 404/403 を返すこと**。本番に dev エンドポイントを露出させない（CDN/WAF ルール確認）。
3. **`misc/utility` の `admin.php` / `admin_action.php` も edge block**（/api/ 経由で admin 機能に触らせない）
4. **`misc/utility` の `bootstrap.php` は要精査**（dev-only 疑い、該当なら dev-debug 家族に移す）
5. **`legacy_continued` family の暗黙前提**: PHP origin が稼働中であること。Section E の T-1h C2 でヘルスチェック必須。
6. **`/api/post_observation.php` 系は v2 migration target**。canonical pack §3.5 で「keep while legacy lives」と明記。

---

## Section D: 自動チェック項目

`platform_v2/src/scripts/replacementReadinessReport.ts` の出力レポートから読む値。
`platform_v2/ops/reports/replacement-readiness-{stamp}.md` を開いて値を転記する。

### D.1 readiness gates（`readiness.ts:218-232` 由来）

| signal_id | source | meaning | green | red | last_value | judgment | mitigation |
|---|---|---|---|---|---|---|---|
| `gates.parityVerified` | readiness snapshot | drift report が succeeded + fresh + parityClean=true + verifyFresh=true | true | false | | | drift report 再実行 → mismatch を `migration_runs.details.mismatches` で確認 |
| `gates.deltaSyncHealthy` | readiness snapshot | drift が succeeded + fresh + deltaHealthy/deltaFresh/cursorFresh が全 true | true | false | | | delta_sync を再実行、cursor を進める |
| `gates.driftReportHealthy` | readiness snapshot | drift report が succeeded + fresh + summary.status=`healthy` | true | false | | | legacy_drift_report ジョブを起動、summary.status を確認 |
| `gates.compatibilityWriteWorking` | readiness snapshot | `compatibility_write_ledger` 最新行が `succeeded` | true | failed/empty | | | dual write ledger エラー追跡 |
| `gates.audioArchiveReady` | readiness snapshot | migration 0020 適用 + `private_uploads` 書込可 + `V2_PRIVILEGED_WRITE_API_KEY` 設定済 | true | false | | | `audioArchive.privateUploadsError` を確認 → 権限/パス修正 |
| `gates.rollbackSafetyWindowReady` | readiness snapshot | 上記 4 ゲート（parity / delta / drift / compatibility）が全 true | true | false | | | 上記いずれかの mitigation を順に解消 |

### D.2 endpoint parity（`replacementReadinessReport.ts:17-35` 由来）

| signal_id | meaning | green | red |
|---|---|---|---|
| `endpoints.checked` / `endpoints.matches` | チェック済み 17 endpoint のうち match 数（status code 一致 or 双方 2xx-3xx） | mismatches==0 | 任意 mismatch |
| `endpoint:/` | ランディング HTTP status | 200 | 5xx / error |
| `endpoint:/map` | マップ HTTP status | 200 | 5xx / error |
| `endpoint:/learn` | learn hub | 200 | 5xx / error |
| `endpoint:/learn/methodology?lang=ja` | Page B | 200 | 5xx / error |
| `endpoint:/learn/glossary?lang=ja` | 用語集 | 200 | 5xx / error |
| `endpoint:/learn/field-loop?lang=ja` | field-loop 内部概念ページ | 200 | 5xx / error |
| `endpoint:/faq?lang=ja` | FAQ | 200 | 5xx / error |
| `endpoint:/about?lang=ja` | About / Page A | 200 | 5xx / error |
| `endpoint:/for-business?lang=ja` | 団体相談 | 200 | 5xx / error |
| `endpoint:/for-business/pricing?lang=ja` | 料金 | 200 | 5xx / error |
| `endpoint:/privacy` | プライバシー | 200 | 5xx / error |
| `endpoint:/terms` | 利用規約 | 200 | 5xx / error |
| `endpoint:/contact` | お問い合わせ | 200 | 5xx / error |
| `endpoint:/health` | health | 200 | 5xx / error |
| `endpoint:/sitemap.xml` | sitemap | 200 | 5xx / error |
| `endpoint:/robots.txt` | robots | 200 | 5xx / error |

注: ENDPOINTS 配列に `/learn/methodology?lang=ja` が **2 回登場している**（`replacementReadinessReport.ts:21,24`）。重複の意図確認、または重複削除が必要。

### D.3 corpus / authority indicators

| signal_id | meaning | green | red | mitigation |
|---|---|---|---|---|
| `authorityFill.percentWithRank` | `specialist_authorities.scope_taxon_rank` 充填率 | ≥ 90% | < 80% | scope_taxon_rank backfill ジョブを実行 |
| `corpus.occurrences` | 観察件数 | 増加 or 平常域 | 急減 | sync ログを確認、source 死活 |
| `corpus.identificationsWithAcceptedRank` | accepted_rank 付き同定件数 | > 0 単調増 | 0 / 急減 | review pipeline 死活確認 |
| `corpus.distinctSpeciesKeys` | distinct GBIF species key | 平常域 | 半減 | ingestion 死活確認 |
| `corpus.photoAssets` | observation_photo asset 件数 | 増加 | 減少 | upload pipeline 確認 |
| `latestDriftReport.summary.staleHours` | drift report 鮮度 | ≤ 24h | > 24h | drift report 再実行 |

### D.4 recent runs (last 5)

`recentRuns[]` の最新 5 件を確認。1 件でも `failed` があれば赤。
`recentCompatibilityWrites[]` 最新 1 件が `succeeded` であること。

---

## Section E: 当日 Go/No-Go チェックリスト

**ハードストップルール**: `hard_stop=true` 行が 1 件でも `FAIL` で **No-Go**（rollback runbook へ）。

### E.1 T-24h（前日チェック）

| check_id | description | linked | pass_condition | hard_stop | owner | result | evidence_link |
|---|---|---|---|---|---|---|---|
| A1 | Section A に `MISSING_INTENT_UNCLEAR` が 0 行 | A | `grep -c MISSING_INTENT_UNCLEAR` == 0 | true | TBD | | |
| A2 | Section A の全 `decision` 欄が埋まっている（空欄なし） | A | 空 decision == 0 | true | TBD | | |
| A3 | Section A に `BLOCK` decision が 0 行 | A | `BLOCK` count == 0 | true | TBD | | |
| B1 | Section B の全 concept が `pass=true`（`route_exclusion` 内除く） | B | 全行 ✅ | true | TBD | | |
| B2 | `フィールドガイド` の残存 3 件が修正済（public.json 含む） | B | hit == 0 | true | TBD | | |
| C1 | Section C の `other` 62 件が再分類完了 | C | other 行 = 0 | true | TBD | | |
| C2 | Section C の `to_migrate_pre_cutover` 行が 0 | C | count == 0 | true | TBD | | |
| D1 | replacement readiness report が前日中に走った | D | timestamp < 24h | true | TBD | | |
| D2 | `gates.rollbackSafetyWindowReady == true` | D | true | true | TBD | | |
| D3 | `authorityFill.percentWithRank >= 90` | D | ≥ 90 | true | TBD | | |
| D4 | `gates.audioArchiveReady == true` | D | true | true | TBD | | |
| E0 | rollback runbook の場所が共有済 | — | URL 提示 | true | TBD | | |

### E.2 T-1h（直前チェック）

| check_id | description | linked | pass_condition | hard_stop | owner | result | evidence_link |
|---|---|---|---|---|---|---|---|
| F0 | readiness report 直近実行（最新 60 分以内） | D | timestamp < 60min | true | TBD | | |
| F1 | endpoint parity 主要 6 路線（`/`, `/map`, `/lens` 相当: `/learn` で代用, `/learn/methodology`, `/for-business`, `/contact`）全 GREEN | D | 全 match | true | TBD | | |
| F2 | `gates.compatibilityWriteWorking == true`（直近 30 分内 ledger） | D | true | true | TBD | | |
| F3 | レガシー PHP origin 稼働中（`legacy_continued` family の依存先） | C | health 200 | true | TBD | | |
| F4 | `dev-debug` family の edge ブロック設定確認 | C | 404/403 を返す | true | TBD | | |
| F5 | DNS / ロードバランサー切替計画レビュー済 | — | reviewed | true | TBD | | |
| F6 | Section B 全行を再 grep し `フィールドガイド`/`フィールドスキャン` hit==0 | B | 0 hit | true | TBD | | |

### E.3 T-0（差し替え瞬間）

| check_id | description | hard_stop | owner | result | evidence_link |
|---|---|---|---|---|---|
| G1 | DNS / ロードバランサー切替実行 | true | TBD | | |
| G2 | edge で `archive_from_public_deploy` family が 404/403 | true | TBD | | |
| G3 | `/healthz` `/readyz` `/ops/readiness` が 200 | true | TBD | | |

### E.4 T+15m（カナリア観測）

| check_id | description | pass_condition | hard_stop | owner | result | evidence_link |
|---|---|---|---|---|---|---|
| H1 | エラーレート < 平常 +0.5%pt | true | true | TBD | | |
| H2 | 主要 10 ページ手動 smoke 全 PASS（`/`, `/home`, `/record`, `/notes`, `/explore`, `/map`, `/lens`, `/learn`, `/about`, `/for-business`） | true | true | TBD | | |
| H3 | `/record` POST 1 件成功 | true | true | TBD | | |
| H4 | `/specialist/review-queue` で 1 件 review 操作可能 | true | false (WATCH) | TBD | | |
| H5 | レガシー proxy（`/post.php` 等）が `/record` に 301 リダイレクト | true | true | TBD | | |

### E.5 T+1h（安定化判定）

| check_id | description | pass_condition | hard_stop | owner | result | evidence_link |
|---|---|---|---|---|---|---|
| I1 | エラーレート平常域に収束 | true | true | TBD | | |
| I2 | レガシー API への proxy が想定 family のみ | true | true | TBD | | |
| I3 | ユーザー致命フィードバック 0 | true | false (WATCH) | TBD | | |
| I4 | rollback 不要を最終宣言 | — | — | TBD | | |

### E.6 ハードストップ集計

```
Total hard_stop checks: 25
Passed:                 ___
Failed:                 ___
Waived:                 ___

GO 判定: Failed == 0 かつ Passed == (25 - Waived)
```

---

## 未決項目サマリ（差し替え前に必ず解消）

T-24h までに以下を解消すること。

### ✅ 解決済: views/dashboard_*.php 6件 (2026-04-23)

6件とも **dead code (orphaned partial)**。リポジトリ全体で grep したがどこからも include/require されていない。
`dashboard_overview.php` 冒頭コメントに「showcase.php から $site を受ける partial」と書かれているが、
`showcase.php` を含め全ファイルに include 記述なし。過去に showcase.php の書き換えで参照が外れ、partial のみ残った
と推定。差し替え対象外（そのまま本番 legacy に残して archive、もしくは削除）。

### ✅ 解決済: フィールドガイド文言修正 (2026-04-23)

以下 4箇所を `ライブガイド` に書き換え済（canonical pack §5.2 準拠）:
- `platform_v2/src/content/short/ja/public.json:401-402` (title, activeNav)
- `platform_v2/src/ui/guideFlow.ts:27` (title)
- `platform_v2/src/services/guideTts.ts:88` (system prompt の role)

grep 再実行で `フィールドガイド` 残存 0 を確認済（`docs/strategy/*` 参照除く）。

### ✅ 解決済: API 再分類 62件 (2026-04-23)

全 62 件を 17 既存 family + 3 新設 family (audio / notification / misc/utility) に再分類完了。
詳細: [`api_family_reclassification_2026-04-23.md`](./api_family_reclassification_2026-04-23.md)。

残る要精査: `misc/utility.bootstrap.php` (dev-only 疑い、30分程度の目視確認で dev-debug 移行か判定)。

### ✅ 解決済: ENDPOINTS 重複削除 (2026-04-23)

`replacementReadinessReport.ts:24` の `/learn/methodology?lang=ja` 重複を
`/learn/identification-basics?lang=ja` に置換。チェック endpoint 数はそのまま 17。

---

## 付録

### 付録 1: 用語ショートカット

詳細は canonical pack §6 (Terminology Crosswalk) を参照。
- ENJOY NATURE / 自然を楽しむ → 公開 top message
- place-first, Place Intelligence OS → 内部のみ
- フィールドノート, 記録する → 公開 keep
- フィールドガイド → `その場で調べる` (`/lens`) と `ライブガイド` (`/guide`) に split
- フィールドスキャン → `探索マップ` (`/map`) と `センサースキャン` に split
- フィールドループ → demote（公開 hero に出さない）
- methodology → `研究とデータの考え方`
- authority policy → `同定の信頼のしくみ`
- public claim → `公開候補`
- sponsor → `団体相談`

### 付録 2: 関連スクリプト

```bash
# readiness レポート実行（出力先: platform_v2/ops/reports/）
cd platform_v2
STAGING_BASE_URL=https://staging.ikimon.life \
PRODUCTION_BASE_URL=https://ikimon.life \
node --loader tsx src/scripts/replacementReadinessReport.ts

# Section B 用語 grep（差し替え当日 T-1h で再実行）
for term in 'フィールドガイド' 'フィールドスキャン' 'sponsor' 'authority policy'; do
  echo "=== $term ==="; rg -l "$term" platform_v2/src
done
```

### 付録 3: rollback runbook

TBD — 整備時にリンク追記。

### 付録 4: 改訂履歴

| date | author | change |
|---|---|---|
| 2026-04-23 | 愛 (Claude) | 初版。canonical pack 2026-04-22 を起点に Section A-E をプリフィル。`MISSING_INTENT_UNCLEAR` 6件、`フィールドガイド` 残存 1件、API `other` 62件を残課題として顕在化 |
