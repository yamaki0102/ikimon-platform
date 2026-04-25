# ikimon.life Place-First Regional OS Execution Plan

更新日: 2026-04-11

> Superseded by `docs/strategy/ikimon_renovation_master_plan_2026-04-11.md`

参照:

- `docs/strategy/ikimon_decision_sheet_2026-04-11.md`
- `docs/strategy/ikimon_place_first_regional_os_master_plan_2026-04-11.md`
- `docs/spec/ikimon_long_term_observatory_data_principles_2026-04-11.md`

目的:

- 新しい master plan を実装可能な開発順へ落とす
- `計画 -> 実装 -> 検証` の順で迷いを消す

---

## 0. 開発の基本姿勢

この計画は、全画面を一気に綺麗にする計画ではない。

やるべきことは 4 つ。

1. place を正本概念にする
2. traveler と local steward の導線を分ける
3. place page を product core に上げる
4. sponsor / regional / government layer を後ろで接続する

---

## 1. 今回の固定決定

### 1.1 正本概念

- `place`
- `visit`
- `observation`
- `condition`
- `follow`
- `program`

### 1.2 訪問種別

- `incidental`
- `follow_up`
- `fixed_point`
- `field_scan`
- `event_bioblitz`

### 1.3 主要ハブ

- Public hub: `index.php`
- Capture hub: `field_research.php` と `post.php`
- Personal hub: `profile.php`
- Place hub: `site_dashboard.php`
- Sponsor hub: `for-business/index.php`
- Regional hub: `dashboard_municipality.php`

### 1.5 主要 actor 優先順位

1. local resident
2. traveler
3. student / teacher
4. sponsor
5. municipality

### 1.6 KPI 固定

North Star:

- `月内に、地元ユーザーによる再訪記録が2回以上成立した active places 数`

### 1.4 役割変更

- `wellness.php`: Primary から Secondary へ下げ、`My Rhythm` として縮退
- `dashboard.php`: 個人統計ページとして Secondary
- `fieldscan.php`: advanced capture layer として Place hub の下に位置付ける
- `for-citizen.php`, `for-researcher.php`: Support / Archive

---

## 2. フェーズ構成

## Phase 0. Canonical Freeze

期間目安:

- 2-3日

対象:

- ルート正本
- 命名
- event / visit / place の契約
- 旧計画の凍結

やること:

- route matrix を fix
- place-first の message ladder を fix
- visit type を fix
- analytics event naming を fix
- 旧 BtoBtoC 文書を superseded 扱いにする

完了条件:

- どの画面が何の役割かが 1 文で言える
- `place / visit / observation / condition` の違いが固定される

## Phase 1. Public Message Rewrite

期間目安:

- 4-6日

対象ファイル:

- `upload_package/public_html/index.php`
- `upload_package/public_html/components/nav.php`
- `upload_package/public_html/about.php`
- `upload_package/public_html/for-business/index.php`

やること:

- Home を `today + place + revisit` に変える
- top nav を `Home / Record / Discover / My Places / Teams` に整理
- about を `自然 x 文化 x 地域OS` に引き直す
- sponsor page を `福利厚生LP` から `place stewardship / regional partner page` に変える

完了条件:

- 初見で `今日は何がいた?` が伝わる
- `この場所をまた見に来る` 導線が見える
- 企業向け価値が公開面を食わない

## Phase 2. Visit-First Capture

期間目安:

- 6-9日

対象ファイル:

- `upload_package/public_html/post.php`
- `upload_package/public_html/field_research.php`
- `upload_package/public_html/bioblitz_join.php`
- `upload_package/public_html/walk.php`
- `upload_package/public_html/field_scan.php`
- `upload_package/public_html/bioscan.php`

やること:

- quick capture を `incidental visit` として再定義
- field walk を `place visit` として再定義
- `walk`, `field_scan`, `bioscan` の役割を整理し redirect 戦略を fix
- visit type と condition logging の UI を追加
- traveler と local steward の保存導線を分ける

完了条件:

- `撮るだけ` でも `見守るための再訪` でも迷わない
- visit 保存時に effort / confidence / place context を失わない

## Phase 3. Place Page and Memory

期間目安:

- 7-10日

対象ファイル:

- `upload_package/public_html/site_dashboard.php`
- `upload_package/public_html/explore.php`
- `upload_package/public_html/profile.php`
- `upload_package/public_html/dashboard.php`
- `upload_package/public_html/wellness.php`
- `upload_package/public_html/century_archive.php`

やること:

- `site_dashboard.php` を正式な Place page に昇格
- `explore.php` を species browse でなく place discovery に寄せる
- `profile.php` を `My Places` ハブにする
- `dashboard.php`, `wellness.php` を Secondary に整理
- `century_archive.php` を mission page に限定する

完了条件:

- place を follow できる
- 自分の revisit が見える
- seasonal / last year compare の足場ができる

## Phase 4. Regional Program and Sponsor Layer

期間目安:

- 6-9日

対象ファイル:

- `upload_package/public_html/corporate_dashboard.php`
- `upload_package/public_html/dashboard_municipality.php`
- `upload_package/public_html/csr_showcase.php`
- `upload_package/public_html/generate_grant_report.php`
- `upload_package/public_html/for-citizen.php`
- `upload_package/public_html/for-researcher.php`

やること:

- sponsor workspace を `place stewardship` ベースに変更
- municipality layer を `regional program / partner / place portfolio` に変更
- CSR showcase を `place evidence showcase` に再定義
- grant report を place / program / repeat visit で出せる方向へ整理

完了条件:

- sponsor は `人を管理する画面` でなく `場所と参加を支える画面` になる
- regional layer で `観光 x 文化 x 学び x 地域事業` が説明できる

## Phase 5. Data, Analytics, and Reporting

期間目安:

- 4-6日

対象ファイル:

- `upload_package/public_html/assets/js/analytics.js`
- `upload_package/public_html/api/save_analytics.php`
- 必要な export / report 導線

やること:

- event schema を visit / place / follow / revisit 基準に整理
- whitelist を更新
- place-based KPI を取る
- regional / sponsor / product の3系統で見る

完了条件:

- `今日の行動` と `地域への効果` を同時に追える
- 旧 BtoBtoC event naming との整合が取れる

## Phase 6. Exposure Cleanup and Redirects

期間目安:

- 3-4日

対象:

- ナビ
- 深い紹介ページ
- legacy routes

やること:

- old LP / old mode の露出を削減
- redirect を設定
- archive/noindex を仕分け

完了条件:

- 主導線は 5 本を超えない
- legacy page が product understanding を壊さない

---

## 3. 実装順

実装順は次以外を採らない。

1. `index.php`
2. `components/nav.php`
3. `for-business/index.php`
4. `field_research.php`
5. `post.php`
6. `site_dashboard.php`
7. `explore.php`
8. `profile.php`
9. `corporate_dashboard.php`
10. `dashboard_municipality.php`
11. `analytics.js`
12. `save_analytics.php`
13. cleanup routes

理由:

- message を先に変えないと下層の意味が定まらない
- capture と place hub を先に作らないと sponsor layer が空虚になる

---

## 4. 受け入れゲート

## Gate A. Message Gate

- Home で `何のサービスか` が 5 秒で言える
- `今日`, `place`, `revisit` が見える

## Gate B. Capture Gate

- quick incidental capture が 90秒以内
- place walk が 迷わず開始できる
- visit type と confidence を落とさない

## Gate C. Place Gate

- `site_dashboard.php` が product center に見える
- same place revisit の価値が可視化される

## Gate D. Regional Gate

- sponsor page が `福利厚生説明` で終わらない
- municipality layer が `観光 x 文化 x place evidence` を束ねる

## Gate E. Data Gate

- place-based KPI が取れる
- traveler と local steward の記録を区別して分析できる

---

## 5. リスクと対策

## Risk 1. Place-first に振ると広がりが弱く見える

対策:

- place page に `自然 x 文化 x 食 x 学び` の接続を持たせる
- traveler loop を必ず残す

## Risk 2. 種名UIが弱く見える

対策:

- species は捨てない
- ただし `place interpretation` の一部へ降ろす

## Risk 3. sponsor page が弱く見える

対策:

- welfare でなく `place stewardship`, `regional partnership`, `natural capital practice` を出す

## Risk 4. データ契約が曖昧で実装が散る

対策:

- Phase 0 で visit taxonomy を fix
- `docs/spec/ikimon_long_term_observatory_data_principles_2026-04-11.md` を正本にする

---

## 6. まだやらないこと

- 本格的な研究者向け解析UI
- 完全な DwC-A export
- eDNA / 音声 / 高密度センサーの全面統合
- 有料プラン体系の全面刷新
- 旅行商品販売システムの内製

---

## 7. この計画での GO 条件

GO 条件は次の 6 つ。

- place が product core になっている
- traveler と local steward の両方が入口を持つ
- relationship population への橋がある
- regional operator の導線がある
- sponsor / government に説明できる
- analytics が place-first になっている
