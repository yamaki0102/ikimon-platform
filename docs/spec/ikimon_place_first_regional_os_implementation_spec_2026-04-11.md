# ikimon.life Place-First Regional OS Implementation Spec

更新日: 2026-04-11

参照:

- `docs/strategy/ikimon_place_first_regional_os_master_plan_2026-04-11.md`
- `docs/strategy/ikimon_place_first_regional_os_execution_plan_2026-04-11.md`
- `docs/spec/ikimon_long_term_observatory_data_principles_2026-04-11.md`

---

## 0. この仕様の目的

各ファイルで

- 役割
- 残すもの
- 消すもの
- 受け入れ条件

を fix する。

---

## 1. Route Matrix

| Route | File | New role | Treatment |
|---|---|---|---|
| `/` | `index.php` | Home | Primary |
| `/explore.php` | `explore.php` | Place discovery | Primary |
| `/field_research.php` | `field_research.php` | Place walk / revisit capture | Primary |
| `/post.php` | `post.php` | Quick incidental capture | Primary |
| `/profile.php` | `profile.php` | My Places | Primary |
| `/site_dashboard.php?site=*` | `site_dashboard.php` | Place page / workspace | Primary |
| `/for-business/` | `for-business/index.php` | Sponsor / regional operator page | Primary |
| `/corporate_dashboard.php` | `corporate_dashboard.php` | Sponsor workspace | Primary |
| `/dashboard_municipality.php` | `dashboard_municipality.php` | Regional portfolio | Primary |
| `/wellness.php` | `wellness.php` | My Rhythm | Secondary |
| `/dashboard.php` | `dashboard.php` | Personal stats | Secondary |
| `/fieldscan.php` | `fieldscan.php` | Advanced capture | Secondary |
| `/century_archive.php` | `century_archive.php` | Mission / archive | Support |
| `/for-citizen.php` | `for-citizen.php` | Support archive | Support |
| `/for-researcher.php` | `for-researcher.php` | Support archive | Support |
| `/walk.php` | `walk.php` | Legacy | Redirect |
| `/field_scan.php` | `field_scan.php` | Legacy | Redirect |
| `/bioscan.php` | `bioscan.php` | Legacy | Redirect |

---

## 2. Global Nav (`components/nav.php`)

### 役割

- 主導線を 5 本に固定
- route matrix をそのまま反映

### 主導線

- Home
- Record
- Discover
- My Places
- Teams

### 2階層目に下げる

- map
- biodiversity_map
- compass
- zukan
- methodology
- century_archive
- deep guides

### 受け入れ条件

- desktop / mobile ともに主導線は 5 本以内
- `さがす / 参加する / その他` の大量リンク構造を廃止
- user menu に `dashboard`, `profile`, `my_organisms`, `wellness` が並立しない

---

## 3. Home (`index.php`)

### 役割

- `今日の自分` に近い入口
- traveler / local steward の両方へ橋をかける

### 必須ブロック

- Hero
  - 見出しは `今日は何がいた?`
  - CTA1: `近くの場所を見にいく`
  - CTA2: `旅先で1枚残す`
- Today prompt
  - `花 / 鳥 / 水辺 / 木陰 / まかせる`
- Place starter
  - 近くの places
  - `見守る place を選ぶ`
- Small win
  - 小さな発見
- Why revisit
  - `去年の今ごろ`
  - `この春の変化`
- Proof strip
  - `旅`, `地元`, `学校`, `企業`, `地域` を薄く見せる

### 消す

- feed 主役 hero
- stats 主役 hero
- 企業LPの長文差し込み

### 受け入れ条件

- 5秒以内に value が言える
- `今日` と `place` が見える
- 企業要素が個人導線を食わない

---

## 4. Quick Incidental Capture (`post.php`)

### 役割

- traveler / casual user の最短入口

### 必須

- capture type: `incidental`
- photo or note-only
- rough place
- rough taxon or unknown
- confidence
- optional condition memo

### 返すもの

- `保存できた`
- `この place をフォロー`
- `別の季節にまた見る`

### 受け入れ条件

- 90秒以内で保存できる
- species 不明でも成立する
- `place` との結びつきが失われない

---

## 5. Place Walk (`field_research.php`)

### 役割

- local steward / repeat visitor の主導線

### 必須

- visit type
- site context
- route / duration
- observations
- condition log
- follow-up intent

### モード

- walk
- scan
- quiet

### legacy 整理

- `walk.php`, `field_scan.php`, `bioscan.php` はここへ統合する

### 受け入れ条件

- `この場所を見守る` 行為として理解できる
- walk と scan の違いが明確
- revisit 価値が保存後に返る

---

## 6. Explore (`explore.php`)

### 役割

- species browse から place discovery へ寄せる

### 必須

- nearby places
- season filters
- place tags
- `旅先で見つけた場所`
- `また見に行く場所`

### Secondary

- species / map / biodiversity layers

### 受け入れ条件

- place が主役
- species browse は残しても従属

---

## 7. My Places (`profile.php`)

### 役割

- 個人の place memory hub

### 必須

- followed places
- recent visits
- same season last year
- traveler saves
- local steward streak

### 受け入れ条件

- `わたしの発見` より `わたしの場所` が前に来る
- other-comparison ではなく self-comparison が主

---

## 8. My Rhythm (`wellness.php`)

### 役割

- Secondary
- well-being の押し出しを弱め、habit support にする

### 必須

- outdoor rhythm
- small wins
- revisit suggestion

### 禁止

- health score 主役
- medical sounding copy

---

## 9. Place Page (`site_dashboard.php`)

### 役割

- product center

### 必須

- place identity
- seasonal state
- observation continuity
- native / exotic / uncertain signals
- site condition history
- culture / food / history interpretation
- next revisit prompt

### 受け入れ条件

- `何がいたか` だけでなく `この場所がどう変わっているか` が読める
- traveler にも local にも意味がある

---

## 10. Sponsor Page (`for-business/index.php`)

### 役割

- 福利厚生LPではなく、place stewardship / regional operator page

### 必須

- `人を集める` より `場所と関係を育てる`
- use cases
  - enterprise place
  - school / campus
  - tourism / cultural area
  - municipality / regional coalition
- output
  - repeat visits
  - active places
  - place evidence
  - regional program support

### 受け入れ条件

- wellness-only に見えない
- 地域 / 文化 / 企業が同じ器に入る

---

## 11. Sponsor Workspace (`corporate_dashboard.php`)

### 役割

- member management でなく place support workspace

### 必須

- active places
- participation spread
- revisit continuity
- program prompts
- place risk / opportunity notes

### 禁止

- surveillance tone
- leaderboard 主役

---

## 12. Regional Portfolio (`dashboard_municipality.php`)

### 役割

- place portfolio, partner map, program layer

### 必須

- places overview
- repeat visitors
- partner organizations
- cultural / tourism programs
- grant / policy fit outputs

### 受け入れ条件

- `観光 x 文化 x 自然 x 地域事業` のポートフォリオに見える

---

## 13. Analytics

### 新規で主に取るイベント

- `home_place_start`
- `home_travel_capture_start`
- `place_followed`
- `visit_started`
- `visit_completed`
- `visit_type_selected`
- `place_revisit_prompt_clicked`
- `place_page_viewed`
- `place_condition_logged`
- `sponsor_consult_started`
- `regional_program_viewed`

### 必須 payload

- `place_id`
- `visit_type`
- `user_role`
- `season_bucket`
- `is_followed_place`

---

## 14. 実装前の最終確認

- route matrix が fix している
- copy ladder が fix している
- visit taxonomy が fix している
- analytics payload が fix している

