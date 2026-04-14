# ikimon.life Master Status and Development Plan

更新日: 2026-04-12

目的:

- 前セッションの handover を含め、ikimon.life の全体像を 1 枚で引き継げる形にする
- `改装`, `多言語`, `staging`, `canonical`, `v2 cutover` を同じ地図に乗せる
- 次に何をやるべきかを、短期 / 中期 / 長期で固定する
- `自分が学ぶ + みんなの AI を育てる + 生物多様性理解に寄与する` を改装の中心動機として固定する

---

## 1. 現在地

ikimon.life はいま、次の 3 レイヤーが並走している。

### Layer A. 現行プロダクト改装

- 正本:
  - `docs/strategy/ikimon_renovation_master_plan_2026-04-11.md`
- 主語:
  - `地元の人`
  - `近い場所`
  - `再訪`
- 目標:
  - `近くの自然が、ちょっとおもしろくなる`
  - その先で `Place Intelligence OS` へ伸ばす

### Layer B. 現行 PHP の canonical 改善

- 正本:
  - `docs/architecture/ADR-001-canonical-source-of-truth.md`
  - `docs/architecture/canonical_migration_policy.md`
- 現状:
  - 本番正本はまだ JSON / file store
  - `ikimon.db` canonical は staging / 実験層に寄っている
- 目標:
  - JSON を広げず、canonical state を DB 側へ寄せる

### Layer C. 将来の v2 全面切替

- 正本:
  - `docs/architecture/ikimon_v2_zero_base_cutover_master_plan_2026-04-11.md`
  - `docs/architecture/ikimon_v2_cutover_readiness_checklist_2026-04-12.md`
- 方針:
  - same VPS parallel rebuild
  - `Next.js + Fastify + PostgreSQL/PostGIS/Timescale`
  - legacy を残したまま dual-write / rollback 前提で切り替える

重要:

- この 3 レイヤーは競合ではない
- ただし、同じタスクの中で混同すると判断を誤る

---

## 2. いまのプロダクト定義

### renewal 定義

- `place-based learning system with collective AI growth`

### 表の顔

- `近くの自然が、ちょっとおもしろくなる`

### 内部定義

- `地元の人が、いつもの場所との関係を深めていく place-first product`
- `観察者が学び、改善された観察がみんなの AI を育てる product`

### 長期定義

- `Place Intelligence OS`
- `Long-term Nature Observatory`

### 最重要 actor

1. local resident
2. traveler
3. student / teacher
4. sponsor
5. municipality

### North Star

- `月内に、地元ユーザーによる再訪記録が2回以上成立した active places 数`

### 継続動機

- `自分が賢くなる`
- `前回よりうまく観察できる`
- `今回の改善がみんなの AI を育てる`
- `自分の観察がまだ十分に知られていない生物多様性理解に寄与する`

---

## 3. いまのコード / 実行環境の状態

### リポジトリ

- 正本 workspace:
  - `E:\Projects\Playground`
- 入口 workspace:
  - `E:\Projects\03_ikimon.life_Product`

### staging

- URL:
  - `https://staging.162-43-44-131.sslip.io/`
- 実体:
  - `/var/www/ikimon.life-staging`
- 状態:
  - basic auth 有効
  - `noindex` 有効
  - internal health check は通る
  - staging repo の `HEAD` は local と一致

### 実測済み

- `php tools/lint.php`
  - OK
- `php composer.phar test`
  - OK
- staging health:
  - `index.php`, `explore.php`, `post.php`, `api/get_events.php` は 200

### 注意

- staging の working tree は dirty
- runtime 由来か、未整理差分かを切り分ける必要がある

---

## 4. 直近セッションで終わっていること

詳細 handover:

- `docs/CLAUDE_HANDOVER_2026-04-12_MULTILINGUAL_STAGING_UI.md`

完了済みの要点:

1. `Lang` が構造化配列を返せるようになった
2. `BrandMessaging` が `Lang` 優先で返るようになった
3. `for-business/index.php` が 4 言語のデータ駆動描画に寄った
4. `public_html` 配下の `__('key', '日本語fallback')` 型の日本語 fallback は実質ゼロ化
5. header / CTA / 一部高密度ページの折り返し崩れを軽減
6. `MULTILINGUAL_PARITY_AUDIT_2026-04-12.md` を作成し、主要公開面の `ja / en / es / pt-BR` parity を監査済み

残件:

- 多言語そのものより、`place-first` の情報設計と page completion が本筋
- 切替 readiness は別途 `ikimon_v2_cutover_readiness_checklist_2026-04-12.md` で追う

---

## 5. 正本 docs の読み順

### 直近の続き作業

1. `docs/CLAUDE_HANDOVER_2026-04-12_MULTILINGUAL_STAGING_UI.md`
2. `docs/MULTILINGUAL_PARITY_AUDIT_2026-04-12.md`
3. `docs/strategy/ikimon_staging_ui_cleanup_plan_2026-04-12.md`
4. `docs/STAGING_RUNBOOK.md`

### 改装判断

1. `docs/strategy/ikimon_renovation_master_plan_2026-04-11.md`
2. `docs/strategy/ikimon_decision_sheet_2026-04-11.md`
3. `docs/spec/ikimon_place_first_regional_os_implementation_spec_2026-04-11.md`
4. `docs/spec/ikimon_long_term_observatory_data_principles_2026-04-11.md`
5. `docs/strategy/ikimon_nature_site_monitoring_acceleration_plan_2026-04-12.md`
6. `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\notes\ikimon_identification_system_master_note.md`
7. `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\domains\ikimon_product_strategy.md`
8. `docs/strategy/ikimon_renewal_gate_framework_2026-04-12.md`

### canonical / migration

1. `docs/architecture/ADR-001-canonical-source-of-truth.md`
2. `docs/architecture/canonical_migration_policy.md`
3. `docs/architecture/legacy_write_inventory_2026-04-11.md`

### v2 cutover

1. `docs/architecture/ikimon_v2_zero_base_cutover_master_plan_2026-04-11.md`
2. `docs/architecture/ikimon_v2_cutover_readiness_checklist_2026-04-12.md`

---

## 6. いまの重要課題

### P0. 引き継ぎ漏れと正本混同

症状:

- 重要 docs が増え、どれが正本か分かりにくい
- superseded 文書が強いまま残っている

対策:

- `docs/IKIMON_KNOWLEDGE_MAP_2026-04-12.md`
- 本ファイルを入口にする

### P0. front surface completion 未完

症状:

- 多言語 parity は主要公開面で閉じた
- ただし `place-first` の IA と page completion はまだ途中
- `PHP でどこまで進めるか` と `v2 に送るもの` の境界が曖昧だと再作業が増える

対策:

- front surface は PHP で閉じる
- v2 への切替条件は `ikimon_v2_cutover_readiness_checklist_2026-04-12.md` で管理する

### P0. public copy は進んだが page ごとの整合が未完

症状:

- Home / Explore / Profile / For Business は整理が進みつつある
- About / apply / high-density pages はまだ思想統一が弱い

### P0. 企業導線は `見える化` ではなく `自然共生サイトの高速起動` に寄せ切る必要がある

症状:

- `for-business` は多言語 parity は閉じたが、収益導線の本当の価値がまだ画面で弱い
- `site quickstart`, `初回観察会2件`, `無料で始められる` の product fact を導線に落とし切れていない

対策:

- `docs/strategy/ikimon_nature_site_monitoring_acceleration_plan_2026-04-12.md` を Phase 4 の補助正本として扱う
- 企業向け copy / CTA / wizard / workspace は `monitoring acceleration` の語彙で揃える

### P0. 同定システムの stance を capture / review / public claim に実装で反映し切る必要がある

症状:

- place-first は固まってきたが、`species certainty machine` に戻る UI 圧がまだ残りうる
- 投稿 UI, review queue, public claim で `属止め / unknown / expert review` の扱いを明示しないと、改装後に思想が逆流する

対策:

- `ikimon_identification_system_master_note.md` を capture / review / public claim の補助正本として扱う
- `evidence-supported level`, `coarse rank 正式許容`, `AI = 候補提示` を画面要件へ落とす

### P1. canonical は構想先行、運用実体が弱い

症状:

- JSON 依存が強い
- `ikimon.db` は本番正本になっていない
- route / UI 改装と data model の間にズレがある

### P1. Omoikane / queue 系が止まり気味

実測:

- pending queue が大きく、処理速度は 0

意味:

- Web は生きているが、バックグラウンド知識基盤が死んでいる可能性が高い

---

## 7. 今後の開発計画

## Phase 0. Knowledge and Guardrail Fix

期間目安:

- 1-2日

目的:

- もう docs 迷子にならない状態を作る

やること:

- `IKIMON_KNOWLEDGE_MAP_2026-04-12.md` を入口として固定
- superseded docs に読み替え先を明記
- `CATCHUP_GUIDE` から master status へもリンク
- staging / deploy / shared-root の運用 docs を current 状態に揃える

完了条件:

- 新セッション開始時に、10分以内で正本へ戻れる

## Phase 1. Multilingual Staging Close

期間目安:

- 2-4日

目的:

- 4 言語対応を staging 実画面まで閉じる

対象:

- `for-business/index.php`
- `for-business/apply.php`
- `about.php`
- `components/footer.php`
- `components/cookie_consent.php`
- `components/feedback_widget.php`

やること:

- staging deploy
- `ja / en / es / pt-BR`
- `guest / signed-in`
- `390 / 768 / 1280 / 1536`
  の QA を回す
- 直書き本文と `BrandMessaging` 依存を翻訳層へ寄せる

完了条件:

- 英日混在が主要公開面で解消
- staging で 4 言語 parity が取れる

状態:

- `DONE`

## Phase 2. Front Surface Completion

期間目安:

- 4-7日

目的:

- 改装の表面 5 rails を形にする

対象:

- `index.php`
- `components/nav.php`
- `field_research.php`
- `explore.php`
- `profile.php`

やること:

- Home を `today / fun / growth / place` に寄せて最終整理
- Record hub と quick capture の役割を切り分ける
- Explore を place discovery に寄せる
- Profile を `My Places` ハブへ寄せる
- capture / quick identify / observation detail は `evidence-supported level` を正本にし、species 強制を避ける
- `わからない`, `属までが安全`, `review で育つ` を失敗扱いしない

完了条件:

- 5秒で value が伝わる
- 入口が散らない
- `place` が画面上で主語になっている

## Phase 3. Place Layer Completion

期間目安:

- 5-8日

目的:

- `site_dashboard.php` を product center に引き上げる

対象:

- `site_dashboard.php`
- `observation_detail.php`
- `wellness.php`
- `dashboard.php`

やること:

- `site_dashboard.php` を season / continuity / condition / next revisit に寄せる
- `wellness.php` を `My Rhythm` として縮退整理
- `dashboard.php` を二軍化

完了条件:

- `何がいたか` だけでなく `この場所がどう変わったか` が読める

## Phase 4. Sponsor / Regional Layer Cleanup

期間目安:

- 4-6日

目的:

- sponsor を public 主役にせず、価値は立てる
- 企業向け価値を `見える化` ではなく `自然共生サイトモニタリングの高速起動` に固定する

対象:

- `for-business/`
- `corporate_dashboard.php`
- `dashboard_municipality.php`
- `csr_showcase.php`

やること:

- sponsor page を place stewardship / regional operator page として閉じる
- workspace を surveillance tone から外す
- municipality layer を portfolio 化する
- `for-business` は `site quickstart -> area candidate -> auto event bootstrap -> first summary` の順で product fact を立てる
- 無料枠は `1拠点 + 初回観察会2件 + 初回サマリー` を基準に整理する

完了条件:

- sponsor value は伝わる
- public IA は汚れない

## Phase 5. Analytics and Route Cleanup

期間目安:

- 3-5日

目的:

- product 改装を計測できる状態にする

対象:

- `assets/js/analytics.js`
- 関連 API
- legacy routes / redirect

やること:

- `place_id`, `visit_type`, `season_bucket`, `is_followed_place` を基軸に event 設計
- legacy scan/map/personal routes を整理

完了条件:

- new IA と KPI が一致する

## Phase 6. Canonical Stabilization

期間目安:

- 1-2週間

目的:

- 改装後の product が data 側で破綻しない状態にする

やること:

- `place / visit / observation / condition / follow` の canonical 契約を固定
- dual-write / divergence check の対象を明確化
- `legacy_write_inventory` ベースで write surface を整理

完了条件:

- UI 改装の主語と保存構造の主語が一致する

## Phase 7. Queue / Omoikane Recovery

期間目安:

- 2-4日

目的:

- 止まっている知識・queue 系を復旧する

やること:

- pending queue の根本原因調査
- worker / cron / db lock / config drift の確認
- status page と実処理の整合確認

完了条件:

- queue backlog が再び減り始める

## Phase 8. v2 Pre-Migration Preparation

期間目安:

- 別トラックで継続

目的:

- 将来の zero-base cutover の前提だけ先に揃える

やること:

- import ledger 設計
- asset ledger 設計
- legacy sync ledger 設計
- `place / visit / evidence` モデルの canonical 化

完了条件:

- v2 に移る時に、今の改装成果をそのまま捨てずに移植できる

運用ルール:

- cutover readiness は `ikimon_v2_cutover_readiness_checklist_2026-04-12.md` を更新して管理する

---

## 8. 次セッションで最初にやること

1. `docs/architecture/ikimon_v2_cutover_readiness_checklist_2026-04-12.md` を読む
2. `docs/CLAUDE_HANDOVER_2026-04-12_MULTILINGUAL_STAGING_UI.md` を読む
3. `docs/strategy/ikimon_nature_site_monitoring_acceleration_plan_2026-04-12.md` と `ikimon_identification_system_master_note.md` を前提に、front surface の次の PHP 改装対象を 1 ページ選ぶ
4. `legacy_write_inventory_2026-04-11.md` とコード差分を照合する
5. canonical 契約表の初版を作る

---

## 9. いまの優先順位

### 最優先

- front surface の改装を `place-first` の正本どおりに進める
- `PHP でやること` と `v2 まで待つこと` の境界を崩さない

### 次点

- canonical 契約を、UI 改装の主語に合わせて整理する
- queue / Omoikane の停止原因を潰す

### 後ろだが重要

- v2 cutover のための import / dual-write / rollback 前提づくり

---

## 10. 引き継ぎの結論

ikimon.life はいま、

- 表では `place-first` の公開改装
- 中では `多言語 + staging + UI hardening`
- 足元では `canonical source の再定義`
- 将来では `v2 zero-base cutover`

を同時に進めている。

次の実務は、広げることではなく、まず `multilingual staging parity` と `front surface completion` を閉じること。
そのうえで、改装の主語を data / canonical 側にも揃えていく。
