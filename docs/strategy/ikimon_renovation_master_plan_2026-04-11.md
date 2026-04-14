# ikimon.life 全体改装・実装マスタープラン

更新日: 2026-04-11

この文書を、ikimon.life 改装の**唯一の正本計画**として扱う。  
旧来の BtoBtoC 計画、place-first 計画、個別 UI 仕様は、この文書に従って読み替える。

---

## 0. 一言で何を作るか

ikimon.life は、当面こう作り直す。

**`近くの自然が、ちょっとおもしろくなる。`**

ただしこれは表の顔で、内部定義は次とする。

**`地元の人が、いつもの場所との関係を深めていく place-first product`**

長期の背骨は `Place Intelligence OS` だが、最初の wedge は広げすぎない。  
まずは `地元の人 x 近い場所 x 再訪` に絞る。

---

## 1. 今回固定する意思決定

### 1.1 最上位の正体

- public product: `近くの自然がちょっとおもしろくなる place product`
- system identity: `Place Intelligence OS`

### 1.2 最初の主役

- primary actor: `地元の人`
- default scenario: `一人で散歩しながら使う`
- secondary scenarios:
  - `家族で使う`
  - `親子で使う`
  - `シニアが日々の外出理由として使う`
  - `旅先で偶発記録を残す`

### 1.3 探求授業

- core workflow にはしない
- important use case として想定する
- 後から `question / hypothesis / reflection` を掛けられる設計にする

### 1.4 企業向け

- `必要十分`
- front-stage の主役にはしない
- sponsor / place provider / regional partner として設計する

### 1.5 同定

- `正しい種名至上主義` は採らない
- `将来、自然共生サイト等にポジティブに使える evidence base` を目標にする
- 初回投稿では `species / species group / native-exotic / hybrid suspected / unknown` を許す

### 1.6 North Star

- `月内に、地元ユーザーによる再訪記録が2回以上成立した active places 数`

### 1.7 メインナビ

メインナビは次の 5 本に固定する。

1. `Home`
2. `Record`
3. `Discover`
4. `My Places`
5. `Community`

企業・自治体・研究・価格はメインナビに出さない。

---

## 2. 今回の戦略修正

旧計画から、次を明確に修正する。

### 修正 1. front copy を `見守る` から `楽しい / 成長` に寄せる

- `見守り続ける` は内部思想としては良い
- ただし hero copy としては重い
- front は `楽しい`, `少しわかる`, `外に出る理由になる` に寄せる

### 修正 2. `家族` を主語にしすぎない

- 家族は強いユースケース
- ただし独身、一人散歩、シニア、地元の大人を取りこぼすと弱い
- 上位便益は `FUN x 成長 x self-relevance`

### 修正 3. `場所の長期価値` は mission layer に下げる

- 入口で売るのは `今日の楽しさ`
- 継続で返すのは `前よりわかる`
- 深部で積み上げるのは `この場所の変化が残る`

---

## 3. 心理設計ルール

この計画は、次の心理原則を制約条件にする。

### 3.1 First touch は `今日 / ここ / 自分`

- 近い便益を先に出す
- 未来公益は bridge message に下げる

### 3.2 初回成功は 90 秒以内

- 投稿完了
- 場所への紐づけ
- 「できた」が返る

### 3.3 継続は `他人比較` ではなく `過去の自分比較`

- 前回の自分
- 先月の自分
- 去年の今ごろ

### 3.4 便益は複線化する

- 一人でも楽しい
- 家族でも思い出になる
- 子どもの発見力を育てる
- 外に出る理由になる
- いつもの場所が少しずつわかる

### 3.5 place attachment は結果として育てる

- 最初から stewardship を要求しない
- 小さな発見の積み重ねで、後から場所への意味が立ち上がる

---

## 4. メッセージ階層

### 4.1 Hero

第一候補:

**`近くの自然、ちょっとおもしろくなる`**

補助コピー:

- `ひとりでも、家族でも。見つけるたび、少しわかる。`
- `今日は何がいた? その記録が、いつもの場所の変化を残していく。`

### 4.2 Benefit ladder

1. `楽しい`
2. `前より少しわかる`
3. `自分の場所が気になってくる`
4. `記録が季節や年の変化を残す`

### 4.3 Segment lines

- solo:
  - `一人の散歩が、ちょっと深くなる`
- family:
  - `近くの自然が、家族の思い出になる`
- child:
  - `見つけるたび、発見力が育つ`
- senior:
  - `外に出る、話す、気づくきっかけになる`
- local resident:
  - `いつもの場所の小さな変化が見えてくる`

### 4.4 Claim policy

言ってよい:

- `外に出るきっかけになる`
- `近くの自然が楽しくなる`
- `子どもの発見や観察のきっかけになる`
- `前より少しわかる`

言いすぎ:

- `認知症予防できる`
- `健康改善を保証する`
- `AI が正しい種を確定する`

---

## 5. 情報設計の原則

### 5.1 主語は `投稿` ではなく `場所への visit`

- 投稿 UI は残す
- ただし product center は `site_dashboard.php`

### 5.2 public IA では `種` を deep layer に下げる

- species page は重要
- ただしトップレベル IA の中心には置かない

### 5.3 同じ機能を複数ルートに散らさない

- map 系は `explore.php` に統合
- walk / fieldscan / bioscan 系は `field_research.php` に統合
- personal stats 系は `profile.php` に統合

### 5.4 sponsor は backstage に置く

- sponsor 導線は footer と secondary CTA
- 個人向け public nav を汚さない

### 5.5 guide は集約し、深掘り層に下げる

- 読みものは必要
- ただし public first-view を食わない

---

## 6. 新しいサイトマップ

このサイトマップは **人間向け公開ルート** を対象にする。  
API、OAuth callback、manifest、service worker、admin 内部ページは別管理とする。

### 6.1 Main rails

| Rail | Primary route | Role |
|---|---|---|
| Home | `/` | 感情起点の入口 |
| Record | `/field_research.php` | 記録方法のハブ |
| Discover | `/explore.php` | 近くの場所と季節の発見 |
| My Places | `/profile.php` | 自分の場所・再訪・履歴 |
| Community | `/events.php` | 観察会、企画、調査参加 |

### 6.2 Deep product routes

| Route | File | New role |
|---|---|---|
| `/post.php` | `post.php` | Quick incidental capture |
| `/site_dashboard.php?site=*` | `site_dashboard.php` | Place page / place memory center |
| `/observation_detail.php?id=*` | `observation_detail.php` | Evidence detail |
| `/species.php?name=*` | `species.php` | Species deep layer |
| `/zukan.php` | `zukan.php` | Reference catalog |
| `/id_workbench.php` | `id_workbench.php` | Advanced identification workspace |
| `/id_wizard.php` | `id_wizard.php` | Guided learning / visual ID |
| `/survey.php` | `survey.php` | Program participation |
| `/event_detail.php?id=*` | `event_detail.php` | Event detail |

### 6.3 Trust and support

| Route | File | New role |
|---|---|---|
| `/about.php` | `about.php` | Philosophy / trust / why it matters |
| `/faq.php` | `faq.php` | FAQ |
| `/contact.php` | `contact.php` | Contact |
| `/guidelines.php` | `guidelines.php` | Community rules |
| `/guides.php` | `guides.php` | Reading hub |
| `/privacy.php` | `privacy.php` | Privacy |
| `/terms.php` | `terms.php` | Terms |
| `/updates.php` | `updates.php` | Updates |

### 6.4 Backstage partner routes

| Route | File | New role |
|---|---|---|
| `/for-business/` | `for-business/index.php` | Sponsor / regional partner landing |
| `/for-business/apply.php` | `for-business/apply.php` | Partner apply |
| `/for-business/pricing.php` | `for-business/pricing.php` | Partner pricing |
| `/for-business/demo.php` | `for-business/demo.php` | Demo entry |
| `/corporate_dashboard.php` | `corporate_dashboard.php` | Sponsor workspace |
| `/corporate_members.php` | `corporate_members.php` | Sponsor member management |
| `/corporate_settings.php` | `corporate_settings.php` | Sponsor settings |
| `/corporate_invite.php` | `corporate_invite.php` | Invite flow |
| `/dashboard_municipality.php` | `dashboard_municipality.php` | Regional portfolio |
| `/dashboard_portfolio.php` | `dashboard_portfolio.php` | Multi-site portfolio |
| `/csr_showcase.php` | `csr_showcase.php` | External showcase |
| `/generate_grant_report.php` | `generate_grant_report.php` | Grant/report helper |
| `/site_editor.php` | `site_editor.php` | Site editor |
| `/demo/` | `demo/index.php` | Demo shell |
| `/demo/report.php` | `demo/report.php` | Demo report |

---

## 7. 全公開ルートの処遇表

### 7.1 Promote as core

| Current route | Treatment | Reason |
|---|---|---|
| `/` | Keep and rebuild | Front message reset |
| `/field_research.php` | Promote to Record hub | 記録方法のハブに最適 |
| `/post.php` | Keep as quick path | 90 秒 capture |
| `/explore.php` | Promote | map・季節・近場 discovery の受け皿 |
| `/profile.php` | Promote and redefine as My Places | personal center を統合 |
| `/site_dashboard.php` | Promote to product center | place memory の本丸 |
| `/events.php` | Promote | Community rail の中心 |
| `/event_detail.php` | Keep | events deep page |
| `/survey.php` | Keep | program participation |
| `/about.php` | Keep and rewrite | philosophy / trust |

### 7.2 Merge into a stronger destination

| Current route(s) | Destination | Why |
|---|---|---|
| `/fieldscan.php`, `/field_scan.php`, `/bioscan.php`, `/scan.php`, `/walk.php`, `/ikimon_walk.php` | `/field_research.php` | capture 系が散りすぎている |
| `/map.php`, `/biodiversity_map.php`, `/livemap.php` | `/explore.php` | discover は 1 route に統一する |
| `/dashboard.php`, `/wellness.php`, `/my_organisms.php`, `/quests.php` | `/profile.php` | personal center を一箇所に集約する |
| `/id_center.php`, `/needs_id.php` | `/id_workbench.php` | 同定入口を分散させない |
| `/for-business.php` | `/for-business/` | 旧 LP の残骸を消す |
| `/for-citizen.php` | `/about.php` or `/` | citizen 導線を専用 LP にしない |

### 7.3 Keep as secondary deep tools

| Route | Role | Exposure |
|---|---|---|
| `/species.php` | species deep layer | search / obs detail から |
| `/zukan.php` | reference catalog | secondary nav / footer |
| `/compare.php` | comparison tool | species deep layer |
| `/id_wizard.php` | learning-oriented ID | deep tool |
| `/id_form.php` | manual ID submission | logged-in deep action |
| `/edit_observation.php` | post-edit utility | logged-in utility |
| `/create_event.php`, `/edit_event.php`, `/event_dashboard.php` | event management | Community deep action |
| `/bioblitz_join.php` | event capture | event CTA から |
| `/surveyors.php`, `/surveyor_records.php`, `/surveyor_profile.php`, `/surveyor_profile_edit.php`, `/request_survey.php` | niche program layer | hidden / support exposure |
| `/widget.php`, `/showcase_embed.php` | embed utility | no nav |
| `/showcase.php` | public showcase | partner proof layer |
| `/century_archive.php`, `/sound_archive.php` | archive / mission layer | no main nav |

### 7.4 Keep as trust / reading layer only

| Route | Treatment |
|---|---|
| `/guides.php` | Reading hub |
| `/guide/*` | Keep, but all traffic flows through guides hub |
| `/methodology.php` | Deep methodology only |
| `/faq.php` | Keep |
| `/contact.php` | Keep |
| `/guidelines.php` | Keep |
| `/privacy.php` | Keep |
| `/terms.php` | Keep |
| `/updates.php` | Keep |
| `/team.php` | Keep but footer only |

### 7.5 Backstage only

| Route | Treatment |
|---|---|
| `/for-business/` subtree | no public nav, footer / CTA only |
| `/corporate_dashboard.php` and corporate_* | auth-gated backstage |
| `/dashboard_municipality.php` | partner layer only |
| `/dashboard_portfolio.php` | partner layer only |
| `/csr_showcase.php` | partner proof |
| `/generate_grant_report.php` | backstage utility |
| `/site_editor.php` | backstage utility |

### 7.6 Hide, archive, or retire

| Route | Treatment | Reason |
|---|---|---|
| `/pricing.php` | Redirect to `/for-business/pricing.php` | public top-level pricing をやめる |
| `/for-researcher.php` | Archive / noindex | public primary flow から外す |
| `/reference_layer.php` | Archive / noindex | deep reference layer |
| `/bingo.php` | event-only access or archive | 主導線から外す |
| `/compass.php` | merge into explore or archive | 独立価値が弱い |
| `/admin_dashboard.php` | redirect to admin index | 旧 route |

---

## 8. 主要画面の完成像

### 8.1 Home (`index.php`)

役割:

- `近くの自然、ちょっとおもしろくなる` を一発で伝える
- solo, family, senior, traveler を同時に飲み込む

必須:

- hero copy
- CTA1: `1枚のこす`
- CTA2: `近くの場所をみる`
- 便益 3 本:
  - `一人でも楽しい`
  - `見つけるたび少しわかる`
  - `その記録が場所の変化を残す`
- nearby places
- seasonal prompt
- `ひとり / 家族 / 地元` の 3 シーン
- sponsor proof は薄く

禁止:

- feed 主役
- 種数・総投稿数の数字主役
- B2B LP 化
- 医療 claim 前面

### 8.2 Record Hub (`field_research.php`)

役割:

- 記録方法の入り口を 1 画面に集約する

必須:

- `ひとりで1枚`
- `いつもの場所を再訪`
- `イベントに参加`
- `あとで詳しく整える`

禁止:

- fieldscan 系 route の並立
- GPS ありきの強制

### 8.3 Quick Capture (`post.php`)

役割:

- 90 秒で casual / place_evidence を残す

必須:

- photo
- rough place
- rough label
- note optional
- `不明でも保存`

### 8.4 Discover (`explore.php`)

役割:

- 近場の場所を見つける
- map / list / season を 1 route に統合する

必須:

- nearby places
- map tab
- season tab
- event / project overlay

### 8.5 My Places (`profile.php`)

役割:

- 自分の場所と再訪履歴を見る personal center

必須:

- followed places
- revisit nudges
- last visit / this season / last year
- personal stats は place に従属

### 8.6 Place Page (`site_dashboard.php`)

役割:

- product center
- `この場所はどう変わったか` を読む

必須:

- latest visits
- seasonal comparison
- notable changes
- observations
- condition notes
- follow / revisit CTA

### 8.7 Community (`events.php`)

役割:

- solo だけでなく community participation を受ける

必須:

- events
- surveys
- school/community programs
- bioblitz entry

### 8.8 Partner (`for-business/index.php`)

役割:

- sponsor / regional partner に説明する
- public nav の主役にしない

必須:

- `人に使わせるアプリ` ではなく `場所との関係を支える基盤`
- sponsor types:
  - company
  - school
  - municipality
  - community group

---

## 9. データ原則

### 9.1 Record model

最小単位は `visit` とし、次を持つ。

- `place_id`
- `visit_type`
- `observed_at`
- `location_precision`
- `evidence`
- `label_granularity`
- `confidence`
- `condition_note`
- `season_bucket`
- `follow_state`

### 9.2 Quality ladder

- `joy_capture`
  - 楽しさ優先
  - 不明可
- `place_evidence`
  - 後から比較に使える
- `review_ready`
  - 再同定や review 可能
- `application_ready`
  - 将来の申請や説明に使える

### 9.3 Reserved fields

- `question`
- `hypothesis`
- `protocol`
- `reflection`
- `review_trail`

---

## 10. KPI

### 10.1 North Star

- `月内に、地元ユーザーによる再訪記録が2回以上成立した active places 数`

### 10.2 Acquisition

- home CTA click rate
- first record completion rate
- first place follow rate
- first revisit intent rate

### 10.3 Retention

- 7日 place return rate
- 30日 revisit completion rate
- My Places 継続率
- season-over-season revisit rate

### 10.4 Quality

- place_id 付与率
- evidence 付与率
- label_granularity 記録率
- application_ready 候補率

### 10.5 Regional / sponsor

- traveler vs local contribution ratio
- supported active places
- partner-backed programs count
- positive-list 候補の蓄積件数

---

## 11. 実装フェーズ

## Phase 0. Canonical freeze

対象:

- message ladder
- nav 5 rails
- route disposition
- visit taxonomy
- claim policy

完了条件:

- public IA が 1 枚で説明できる
- legacy route の行き先が決まる

## Phase 1. Front surface

対象:

- `index.php`
- `components/nav.php`
- `about.php`
- `guides.php`

完了条件:

- `楽しい / 成長 / place` の順で伝わる
- 5 秒で何のサービスかわかる

## Phase 2. Record architecture

対象:

- `field_research.php`
- `post.php`
- `bioblitz_join.php`
- `edit_observation.php`
- fieldscan / walk / bioscan 系 redirect

完了条件:

- 記録入口が迷わない
- 90 秒 quick capture が成立

## Phase 3. Place layer

対象:

- `explore.php`
- `profile.php`
- `site_dashboard.php`
- `observation_detail.php`

完了条件:

- place が product center に上がる
- revisit の意味が visible になる

## Phase 4. Community layer

対象:

- `events.php`
- `event_detail.php`
- `create_event.php`
- `edit_event.php`
- `survey.php`
- surveyor / request_survey 系

完了条件:

- Community rail が成立する
- school/community overlay を掛けられる

## Phase 5. Knowledge and deep tools

対象:

- `species.php`
- `zukan.php`
- `compare.php`
- `id_wizard.php`
- `id_workbench.php`
- `methodology.php`
- guide 群

完了条件:

- deep tools が public IA を壊さない
- 同定と知識が growth に接続する

## Phase 6. Partner backstage

対象:

- `for-business/` subtree
- `corporate_dashboard.php`
- corporate_* routes
- `dashboard_municipality.php`
- `dashboard_portfolio.php`
- `csr_showcase.php`
- `generate_grant_report.php`
- `site_editor.php`

完了条件:

- partner value は立つ
- public nav は汚れない

## Phase 7. Analytics and cleanup

対象:

- analytics events
- redirects
- archive / noindex
- leftover routes

完了条件:

- KPI が計測できる
- route proliferation が止まる

---

## 12. 実装順

実装順は次に固定する。

1. `index.php`
2. `components/nav.php`
3. `about.php`
4. `field_research.php`
5. `post.php`
6. `explore.php`
7. `profile.php`
8. `site_dashboard.php`
9. `events.php`
10. `event_detail.php`
11. `survey.php`
12. `species.php`
13. `zukan.php`
14. `id_wizard.php`
15. `id_workbench.php`
16. `for-business/index.php`
17. `corporate_dashboard.php`
18. `dashboard_municipality.php`
19. analytics / redirects / cleanup

---

## 13. 受け入れゲート

## Gate A. Message

- solo user が 5 秒で価値を言える
- `家族向けに見えすぎる` 失敗を避ける
- `企業向けに見えすぎる` 失敗を避ける

## Gate B. Record

- 入口で 3 モード以内に絞られている
- quick capture が 90 秒以内
- 不明でも保存できる

## Gate C. Place

- profile と site page が `投稿一覧` に見えない
- revisit と season comparison が見える

## Gate D. Community

- events / survey / school/community use case が破綻しない

## Gate E. Partner

- sponsor value は説明できる
- public IA を汚していない

## Gate F. Data

- future-meaningful data が残る
- positive-list 候補を後から抽出できる

---

## 14. リスクと対策

## Risk 1. `楽しい` に寄せすぎて浅く見える

対策:

- mission layer で place memory を接続する
- site page で深さを返す

## Risk 2. `家族` に寄せすぎて独身を取りこぼす

対策:

- solo を default scenario にする
- family は代表シーンの一つに留める

## Risk 3. `場所` に寄せすぎて種好きに弱く見える

対策:

- species deep layer を磨く
- ただし IA の中心には戻さない

## Risk 4. sponsor 価値が薄く見える

対策:

- backstage を別 layer で磨く
- 地域連携、拠点運用、申請補助に寄せる

## Risk 5. 既存 guide に強すぎる claim が残る

対策:

- guide を guides hub 配下に集約
- 医療 claim を段階的にレビューする

---

## 15. 実装開始条件

次が揃うまでコードに入らない。

1. この文書への GO
2. hero copy を `FUN / 成長 / place` にする方針への GO
3. メインナビ 5 rails への GO
4. `field_research.php` を Record hub にする方針への GO
5. merge / redirect 対象 route の処遇への GO

---

## 16. この計画の読み方

キミがまず見るべき箇所は次だけでよい。

- `1. 今回固定する意思決定`
- `6. 新しいサイトマップ`
- `7. 全公開ルートの処遇表`
- `11. 実装フェーズ`
- `15. 実装開始条件`

これで GO が出れば、次は Phase 1 の実装に入る。
