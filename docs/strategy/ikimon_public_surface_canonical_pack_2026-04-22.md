# ikimon Public Surface Canonical Pack

更新日: 2026-04-22

この文書を、ikimon の `public IA / message / feature-role` の唯一正本として扱う。

対象:

- 公開面の哲学
- 公開メッセージ階層
- canonical sitemap
- page intent
- feature naming / feature role
- public / partner / trust の route disposition

補助参照:

- `docs/strategy/ikimon_renovation_master_plan_2026-04-11.md`
- `docs/strategy/ikimon_decision_sheet_2026-04-11.md`
- `docs/spec/ikimon_place_first_regional_os_implementation_spec_2026-04-11.md`
- `docs/spec/sitemap.md`
- `docs/review/ikimon_inaturalist_critique_response_boundary_2026-04-20.md`
- `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\notes\ikimon_identification_system_master_note.md`

重要:

- 入口の主語は `ENJOY NATURE`
- 深部の背骨は `place-first product / Place Intelligence OS`
- `フィールドループ` は公開主語にしない
- `フィールドガイド / フィールドスキャン` は現状のままでは意味が割れているため、名称と役割を再定義する
- staging / production の UI 変更は、この文書のレビュー完了後にのみ着手する

---

## 1. Product Philosophy

### 1.1 Public face

表の顔はこれで固定する。

- 一言: `ENJOY NATURE`
- 日本語の主約束: `自然が楽しい。世界の解像度が上がる。`
- 行動の入口: `歩く -> 見つける -> 残す`

公開面で最初に売るもの:

1. 今日の散歩が少し楽しくなる
2. 道ばたや旅先の自然が前より分かる
3. 気になったものを、場所つきで残せる

公開面で最初に売らないもの:

1. place-first の理論
2. observatory / regional OS の大きい構想
3. 研究用途の詳細
4. 専門家レビュー制度の詳細

### 1.2 Internal identity

内部定義は維持する。

- public product: `自然を楽しむ入口`
- internal product: `地元の人が、いつもの場所との関係を深めていく place-first product`
- system identity: `Place Intelligence OS`
- long-term framing: `Long-term Nature Observatory`

解釈:

- 公開面は `楽しい / 分かる / また歩きたくなる`
- 深部ではじめて `場所の記憶 / 再訪 / 研究接続` を語る

### 1.3 Actor priority

公開面の actor 優先順位はこれで固定する。

1. 一般ユーザー
2. 地元で繰り返し使う人
3. 旅先ユーザー
4. 学校・地域運営者
5. 研究 / 専門家
6. sponsor / partner

設計ルール:

- first view は 1-3 に最適化する
- 4-6 は deep page と backstage に下げる
- 企業向け都合で公開面の主語を汚さない

### 1.4 Benefit ladder

公開便益の順番はこれで固定する。

1. 楽しい
2. 世界の解像度が上がる
3. また歩きたくなる
4. 場所への愛着が育つ
5. 記録が研究と保全に役立つ

補足:

- 健康、地域愛、観光、教育、研究貢献は否定しない
- ただし hero ではなく `bridge benefit` または `deep benefit` に置く

### 1.5 Trust boundary

信頼境界はこれで固定する。

- AI は `候補提示 / 学習補助 / 次に見るべき点の提案`
- 市民は `発見 / 記録 / 暫定的な意味づけ`
- 詳しい人は `確定に寄与する review`
- 強い研究主張は `effort / evidence / review` 条件つき

言ってよい:

- AI が候補を出す
- 分からないまま残せる
- 詳しい人の確認で精度が上がる
- 記録は研究や保全に役立ちうる

言いすぎ:

- AI が正しい種名を確定する
- quick capture だけで増減や不在が分かる
- 健康効果を保証する
- 市民記録だけで研究主張が自動成立する

### 1.6 Entry / Deep / Do not say

| レイヤー | 何を言うか | 何を言わないか |
|---|---|---|
| 入口 | 自然が楽しい、世界の解像度が上がる、歩く理由が増える | regional OS、observatory、authority-backed review |
| bridge | 記録が残る、前より分かる、また行きたくなる | 強い研究主張、AI certainty |
| deep | AI と人の役割、review、effort、研究接続、place-first | hero に戻すべき重い制度文言 |
| forbidden | 医学的断定、研究断定、AI 確定、過度な使命感の押し付け | - |

---

## 2. Message Architecture

### 2.1 Canonical message ladder

メッセージの流れはこの順で固定する。

1. `自然が楽しい`
2. `名前や違いが少し分かる`
3. `見つけたことを場所つきで残せる`
4. `また歩きたくなる`
5. `場所との関係が育つ`
6. `記録が研究と保全に役立つ`

### 2.2 Home message system

Home の message system は次で固定する。

- eyebrow: `ENJOY NATURE` または `近くの自然を楽しむ`
- H1 の役割: 感情の起動
- lead の役割: `見つける / 残す / 分かる` を 1 文で接続
- proof strip の役割: `最近の発見 / 地域の記録 / 健康や地域への橋` を補助的に見せる

推奨 headline 系:

- `いつもの散歩が、冒険になる。`
- `見つけたものを、場所つきで残す。`
- `道端の花の名前がわかると、世界の解像度が変わる。`

hero で禁止するもの:

- methodology の長文
- sponsor の長文
- `フィールドループ` の用語説明
- `衛星から専門家の同定` のような deep system copy

### 2.3 Bridge benefits

bridge benefit に置くもの:

- 外に出る理由が増える
- 前より分かる
- 地域への愛着が育つ
- 旅先の 1 枚がまた来たい理由になる
- 記録が保全や研究につながる

bridge benefit に置き、hero に置かないもの:

- 認知症リスク低下
- ストレス軽減
- 地域観光の活性化
- 市民科学の制度論

### 2.4 Serious pages split

真面目な説明は 2 ページに分ける。

#### Page A. 思想ページ

- canonical route candidate: `/about`
- canonical public label: `ikimonの考え方`
- job:
  - なぜ自然を楽しむ入口から始めるのか
  - なぜ place-first が深部にあるのか
  - ikimon が世界をどう見ているか

このページで言うこと:

- ENJOY NATURE は軽さではなく入口設計である
- 深部では place-first / revisit / place memory が背骨になる
- ikimon は種名収集アプリではなく、場所との関係を厚くする道具である

このページで言わないこと:

- authority の運用細則
- API / data schema
- 研究プロトコルの詳細

#### Page B. 研究・データ・信頼性ページ

- canonical route candidate: `/learn/methodology`
- canonical public label: `研究とデータの考え方`
- source pages to reorganize:
  - `/learn/methodology`
  - `/learn/authority-policy`

このページで言うこと:

- AI と人の役割
- 同定の信頼レーン
- quick capture と survey の違い
- 何を言いすぎないか
- 研究への接続

このページで言わないこと:

- hero 的な感情訴求の繰り返し
- 企業営業 copy

### 2.5 Field loop status

`フィールドループ` の扱いはこれで固定する。

- 公開主語: 不採用
- 補助概念: 採用
- 内部概念: 採用

公開で使う言い換え:

- `見つける -> 残す -> また歩く`
- `気づく -> 記録する -> また見に行く`

使わない理由:

- 初見で意味が立たない
- 研究寄りの深部概念を入口に出しすぎる
- ENJOY NATURE の軽やかさを損なう

---

## 3. Full Sitemap

### 3.1 公開主要面

| route | file-source | actor | moment | page role | what this page says | primary CTA | keep-merge-rename-archive | notes |
|---|---|---|---|---|---|---|---|---|
| `/` | `platform_v2/src/app.ts` | 一般ユーザー | first touch | Emotional landing | 自然が楽しい。世界の解像度が上がる。 | `記録する` / `マップを見る` | keep + rewrite copy | hero は ENJOY NATURE に固定 |
| `/home` | `platform_v2/src/routes/read.ts` | 既存ユーザー | return visit | Signed-in home | 今日の記録と再訪を始める | `記録する` | keep secondary | marketing top ではなく signed-in hub |
| `/record` | `platform_v2/src/routes/read.ts` | 一般ユーザー | capture start | Capture entry | 見つけたものを場所つきで残す | `保存する` | keep | `post.php` の canonical 後継 |
| `/notes` | `platform_v2/src/routes/read.ts` | 既存ユーザー | capture aftercare | Notebook home | 見つけたことを、あとで見返せる | `記録する` | keep | field note read surface |
| `/explore` | `platform_v2/src/routes/read.ts` | 一般 / 旅先 | where next | Discovery surface | 次に歩く場所を探す | `場所を見る` | keep | place discovery を主役にする |
| `/map` | `platform_v2/src/routes/read.ts` | 一般 / 地元 | where next | Place selection map | 今日どこを歩くかを決める | `場所を決める` | keep | public name は `探索マップ` |
| `/lens` | `platform_v2/src/routes/read.ts` | 一般 | in-field curiosity | Explainer for AI help | 気になったものをその場で確かめる | `記録する` | keep + rename concept | public feature name を再定義する |
| `/scan` | `platform_v2/src/routes/read.ts` | 一般 | pre-walk planning | Explainer for map/scan concept | 次に歩く場所を決める | `マップを見る` | merge into `/map` | 現行は explainer、実機能は `/map` |
| `/guide` | `platform_v2/src/routes/read.ts` | 実験利用者 | advanced session | Experimental live guide | カメラと音声で土地の文脈を読む | `ガイド開始` | rename + demote | primary public route にしない |
| `/profile` | `platform_v2/src/routes/read.ts` | 既存ユーザー | self review | My places hub | わたしの場所と記録を振り返る | `ノートを見る` | keep | `わたしの場所` を主役にする |
| `/events.php` | `upload_package/public_html/events.php` | コミュニティ参加者 | join community | Community hub | みんなで調べる入口 | `イベントを見る` | keep | v2 canonical 化対象 |
| `/event_detail.php` | `upload_package/public_html/event_detail.php` | コミュニティ参加者 | join event | Event detail | この観察会 / 調査に参加する | `参加する` | keep | event family deep layer |
| `/create_event.php` | `upload_package/public_html/create_event.php` | 主催者 | create event | Event create | 観察会を立てる | `作成する` | keep backstage | public top nav には出さない |
| `/edit_event.php` | `upload_package/public_html/edit_event.php` | 主催者 | update event | Event edit | 観察会を更新する | `保存する` | keep backstage | edit utility |
| `/survey.php` | `upload_package/public_html/survey.php` | 調査参加者 | structured participation | Survey join | テーマ付き調査に参加する | `参加する` | keep secondary | community/program lane |
| `/bingo.php` | `upload_package/public_html/bingo.php` | コミュニティ参加者 | challenge play | Community challenge | 観察会や企画をゲーム的に楽しむ | `参加する` | keep secondary | community support |
| `/observation_detail.php` | `upload_package/public_html/observation_detail.php` | 一般 / 専門家 | inspect evidence | Evidence detail | この記録の証拠と確認状況を見る | `同定を見る` | keep | 将来 `/observations/:id` へ alias |
| `/species.php` | `upload_package/public_html/species.php` | 深掘りユーザー | species deep dive | Species detail | 種の深掘りを読む | `比較する` | keep deep | top nav には出さない |
| `/compare.php` | `upload_package/public_html/compare.php` | 深掘りユーザー | compare species | Compare detail | よく似た種を見比べる | `種を見る` | keep deep | support tool |
| `/zukan.php` | `upload_package/public_html/zukan.php` | 深掘りユーザー | browse reference | Reference catalog | 図鑑として調べる | `探す` | merge into `/explore` | deep catalog に下げる |
| `/id_wizard.php` | `upload_package/public_html/id_wizard.php` | 初学者 | learn identification | Guided ID learning | 名前が分からないときの見分け方を学ぶ | `見分け方を見る` | keep support | learn lane に近い |
| `/compass.php` | `upload_package/public_html/compass.php` | フィールド利用者 | in-field utility | Direction helper | 現地での方向感覚を補助する | `現地で使う` | keep support | 主導線にしない |
| `/wellness.php` | `upload_package/public_html/wellness.php` | 既存ユーザー | habit support | Rhythm support | 外に出るリズムを支える | `記録を見る` | keep secondary | medical framing は禁止 |
| `/dashboard.php` | `upload_package/public_html/dashboard.php` | 既存ユーザー | stats review | Personal stats | 活動の数字を見る | `プロフィールへ` | merge into `/profile` | self stats は profile 配下へ |
| `/my_organisms.php` | `upload_package/public_html/my_organisms.php` | 既存ユーザー | list review | Life list | 見てきたものを一覧で見る | `プロフィールへ` | merge into `/profile` | standalone にしない |
| `/login.php` | `upload_package/public_html/login.php` | 未ログイン | auth entry | Login | ログインする | `ログイン` | keep support | support route |
| `/logout.php` | `upload_package/public_html/logout.php` | 既存ユーザー | auth exit | Logout | ログアウトする | `ログアウト` | keep support | support route |
| `/profile_edit.php` | `upload_package/public_html/profile_edit.php` | 既存ユーザー | edit self | Profile edit | 自分の表示情報を整える | `保存する` | keep support | utility route |
| `/edit_observation.php` | `upload_package/public_html/edit_observation.php` | 既存ユーザー | edit record | Record edit | 既存記録を修正する | `保存する` | keep support | utility route |
| `/id_form.php` | `upload_package/public_html/id_form.php` | specialist / logged-in user | add identification | Identification form | 観察に同定を付ける | `保存する` | keep support | deep action route |

### 3.2 Learn / Trust

| route | file-source | actor | moment | page role | what this page says | primary CTA | keep-merge-rename-archive | notes |
|---|---|---|---|---|---|---|---|---|
| `/about` | `platform_v2/src/routes/marketing.ts` | 一般 / 深掘りユーザー | why this exists | Philosophy page | なぜ自然を楽しむ入口から始めるのか | `使い方を見る` | keep + rename label | public label は `ikimonの考え方` |
| `/learn` | `platform_v2/src/routes/marketing.ts` | 一般 / 深掘りユーザー | need explanation | Learn hub | 使い方と考え方の目次 | `各解説へ` | keep | trust hub |
| `/learn/identification-basics` | `platform_v2/src/routes/marketing.ts` | 初学者 | when name unknown | ID basics | 名前が分からないときの基本 | `記録する` | keep | beginner support |
| `/learn/methodology` | `platform_v2/src/routes/marketing.ts` | 深掘りユーザー / 研究者 | trust check | Research / data page | AI と人の役割、データ、言いすぎない線引き | `制度を見る` | keep + rewrite | Page B の主候補 |
| `/learn/authority-policy` | `platform_v2/src/routes/marketing.ts` | 深掘りユーザー / 専門家 | trust detail | Review policy detail | 誰がどう確認するか | `methodology へ戻る` | merge under `/learn/methodology` | 独立主役にしない |
| `/learn/glossary` | `platform_v2/src/routes/marketing.ts` | 初学者 | confusion relief | Glossary | 用語をやさしく引く | `解説へ戻る` | keep | support |
| `/learn/field-loop` | `platform_v2/src/routes/marketing.ts` | 深掘りユーザー | concept deep dive | Internal concept note | 見つける、残す、また歩くの背景 | `解説一覧へ戻る` | demote | public 主語にしない |
| `/learn/updates` | `platform_v2/src/routes/marketing.ts` | 既存ユーザー | product follow | Updates | 何が変わったかを見る | `更新を見る` | keep | release note lane |
| `/faq` | `platform_v2/src/routes/marketing.ts` | 一般 / 団体 | uncertainty relief | FAQ | よくある迷いを解く | `お問い合わせ` | keep | support |
| `/privacy` | `platform_v2/src/routes/marketing.ts` | 全員 | trust check | Privacy | 位置情報と公開範囲をどう扱うか | `方針を見る` | keep | trust |
| `/terms` | `platform_v2/src/routes/marketing.ts` | 全員 | trust check | Terms | 利用上の境界を示す | `方針を見る` | keep | trust |
| `/contact` | `platform_v2/src/routes/marketing.ts` | 全員 | ask for help | Contact | 個人利用と団体相談の窓口 | `送信する` | keep | trust + lead intake |
| `/guidelines.php` | `upload_package/public_html/guidelines.php` | 全員 | rule lookup | Community rules | コミュニティルールを確認する | `ルールを見る` | keep support | footer / support only |
| `/guides.php` | `upload_package/public_html/guides.php` | 一般 | old learn hub | Legacy guide hub | 旧ガイド一覧 | `解説へ` | redirect to `/learn` | legacy alias |
| `/team.php` | `upload_package/public_html/team.php` | 深掘りユーザー | who runs this | Team page | 誰が運営しているか | `about へ` | merge into `/about` | standalone 優先度は低い |
| `/pricing.php` | `upload_package/public_html/pricing.php` | 団体候補 | pricing lookup | Pricing alias | 団体向けの始め方を見る | `団体相談へ` | redirect to `/for-business/pricing` | 一般向け料金面は主導線に出さない |
| `/offline.php` | `upload_package/public_html/offline.php` | 全員 | technical fallback | Offline support | オフライン時の補助 | `ホームへ` | keep technical | public message surface ではない |
| `/sitemap.php` | `upload_package/public_html/sitemap.php` | 検索 / 技術 | machine-readable | XML sitemap | 検索向けサイトマップ | - | keep technical | no human copy duty |
| `/guide/*` | `upload_package/public_html/guide/*.php` | SEO / 深掘りユーザー | article read | Longform article family | 健康、自然共生、教育の長文解説 | `関連ページへ` | keep support | hero 主導線から外す |

### 3.3 Partner / Backstage

| route | file-source | actor | moment | page role | what this page says | primary CTA | keep-merge-rename-archive | notes |
|---|---|---|---|---|---|---|---|---|
| `/for-business` | `platform_v2/src/routes/marketing.ts` | 学校 / 地域 / 企業 | considering group use | Partner entry | どこでどう始めるかを相談する | `相談する` | keep | public label は `団体相談` |
| `/for-business/pricing` | `platform_v2/src/routes/marketing.ts` | 団体候補 | compare start modes | Start mode page | 小さく始める方法を見る | `相談する` | keep | pricing より start mode を主語にする |
| `/for-business/demo` | `platform_v2/src/routes/marketing.ts` | 団体候補 | see screen | Demo explainer | 実際の画面で始め方を確認する | `画面を見る` | keep | sales deck 化しない |
| `/for-business/status` | `platform_v2/src/routes/marketing.ts` | 団体候補 | readiness check | Capability/status page | 今できることと、これから整えること | `相談する` | keep | expectation control |
| `/for-business/apply` | `platform_v2/src/routes/marketing.ts` | 団体候補 | contact intake | Partner apply | 導入相談を受け付ける | `送信する` | keep | lead capture |
| `/for-researcher.php` | `upload_package/public_html/for-researcher.php` | 研究者 | research entry | Research-facing page | 研究利用の入口 | `データ方針を見る` | rewrite support | Page B と矛盾させない |
| `/showcase.php` | `upload_package/public_html/showcase.php` | partner | showcase | Showcase | 組織利用の見せ方 | `相談する` | keep backstage | public hero から外す |
| `/csr_showcase.php` | `upload_package/public_html/csr_showcase.php` | partner | reporting | CSR showcase | CSR 的な見せ方 | `相談する` | keep backstage | CSR に閉じすぎない |
| `/site_dashboard.php?site=*` | `upload_package/public_html/site_dashboard.php` | partner / operator | monitor place | Place workspace | 拠点 / 場所の記録と変化を見る | `場所を見る` | keep | backstage product center |
| `/site_editor.php` | `upload_package/public_html/site_editor.php` | operator | setup site | Site setup | 対象場所を定義する | `保存する` | keep backstage | setup utility |
| `/corporate_dashboard.php` | `upload_package/public_html/corporate_dashboard.php` | partner | portfolio review | Corporate workspace | 組織単位で場所を追う | `サイトを見る` | keep backstage | public には出さない |
| `/corporate_members.php` | `upload_package/public_html/corporate_members.php` | partner | team admin | Member admin | 組織メンバーを管理する | `追加する` | keep backstage | admin utility |
| `/corporate_settings.php` | `upload_package/public_html/corporate_settings.php` | partner | workspace admin | Settings | 組織設定を管理する | `保存する` | keep backstage | admin utility |
| `/corporate_invite.php` | `upload_package/public_html/corporate_invite.php` | partner | invite join | Invite | 組織招待を受ける | `参加する` | keep backstage | support |
| `/dashboard_municipality.php` | `upload_package/public_html/dashboard_municipality.php` | municipality | regional review | Municipal dashboard | 自治体単位で場所を追う | `相談する` | keep backstage | public hero には出さない |
| `/dashboard_portfolio.php` | `upload_package/public_html/dashboard_portfolio.php` | enterprise | portfolio review | Portfolio dashboard | 複数サイトをまとめて追う | `サイトを見る` | keep backstage | enterprise support |
| `/demo/` | `upload_package/public_html/demo/index.php` | partner | guided demo | Demo landing | デモの入口 | `デモを見る` | keep backstage | sales support |
| `/demo/report.php` | `upload_package/public_html/demo/report.php` | partner | sample report | Demo report | レポートサンプルを見る | `相談する` | keep backstage | sample support |
| `/showcase_embed.php` | `upload_package/public_html/showcase_embed.php` | partner | embed showcase | Showcase embed | 外部掲載用の埋め込み表示 | `埋め込む` | keep backstage | embed support |
| `/widget.php` | `upload_package/public_html/widget.php` | partner | embed | Widget | 外部サイトへ埋め込む | `埋め込む` | keep backstage | embed utility |
| `/request_survey.php` | `upload_package/public_html/request_survey.php` | partner / organizer | ask for survey | Survey request | 調査支援を依頼する | `依頼する` | keep backstage | contact family |

### 3.4 Internal / Specialist / Technical

| route | file-source | actor | moment | page role | what this page says | primary CTA | keep-merge-rename-archive | notes |
|---|---|---|---|---|---|---|---|---|
| `/qa/site-map` | `platform_v2/src/app.ts` | QA | release check | QA sitemap | review lane を開く | `Open` | keep internal | human QA only |
| `/specialist/id-workbench` | `platform_v2/src/routes/read.ts` | specialist | confirm IDs | Specialist workbench | 任された範囲で同定を進める | `レビューする` | keep internal | public nav に出さない |
| `/specialist/review-queue` | `platform_v2/src/routes/read.ts` | specialist | review queue | Review queue | 確認待ち観察を処理する | `レビューする` | keep internal | internal lane |
| `/specialist/recommendations` | `platform_v2/src/routes/read.ts` | specialist/admin | authority recs | Recommendation queue | authority 候補を判断する | `確認する` | keep internal | internal lane |
| `/specialist/authority-audit` | `platform_v2/src/routes/read.ts` | admin | audit | Authority audit | 付与と取消しを追う | `監査する` | keep internal | internal lane |
| `/specialist/authority-admin` | `platform_v2/src/routes/read.ts` | admin | authority admin | Authority admin | 権限を管理する | `保存する` | keep internal | internal lane |
| `/authority/recommendations` | `platform_v2/src/routes/read.ts` | specialist | self authority | Authority application | 自分の推薦状況を見る | `確認する` | keep internal | internal lane |
| `/admin/*` | `upload_package/public_html/admin/*.php` | admin | operations | Admin family | 運営管理を行う | - | keep internal | public surface 対象外 |
| `/review_queue.php` | `upload_package/public_html/review_queue.php` | admin | legacy review | Legacy review queue | 自由入力レビューを処理する | `レビューする` | redirect to `/specialist/review-queue` | legacy alias |
| `/admin_dashboard.php` | `upload_package/public_html/admin_dashboard.php` | admin | old admin | Legacy admin home | 旧管理画面 | `admin へ` | redirect to `/admin/` | legacy alias |
| `/omoikane_dashboard.php` | `upload_package/public_html/omoikane_dashboard.php` | admin/analyst | model ops | Omoikane ops | 知識抽出コンソール | `確認する` | keep internal | public surface 対象外 |
| `/surveyors.php` | `upload_package/public_html/surveyors.php` | operator | surveyor management | Surveyor index | surveyor を見る | `一覧を見る` | keep internal/backstage | not public |
| `/surveyor_profile.php` | `upload_package/public_html/surveyor_profile.php` | surveyor | profile | Surveyor profile | surveyor 情報を見る | `編集する` | keep internal/backstage | support |
| `/surveyor_records.php` | `upload_package/public_html/surveyor_records.php` | surveyor | records | Surveyor records | surveyor 記録を見る | `確認する` | keep internal/backstage | support |
| `/surveyor_profile_edit.php` | `upload_package/public_html/surveyor_profile_edit.php` | surveyor | edit profile | Surveyor edit | surveyor 情報を編集する | `保存する` | keep internal/backstage | support |
| `/event_dashboard.php` | `upload_package/public_html/event_dashboard.php` | organizer | event ops | Event dashboard | 観察会の進行を見る | `管理する` | keep internal/backstage | not top nav |
| `/generate_event_report.php` | `upload_package/public_html/generate_event_report.php` | organizer/admin | reporting | Event report | 観察会レポートを出す | `生成する` | keep internal/backstage | utility |
| `/generate_grant_report.php` | `upload_package/public_html/generate_grant_report.php` | organizer/admin | grant reporting | Grant report | 助成金用レポートを出す | `生成する` | keep internal/backstage | utility |
| `/healthz` | `platform_v2/src/routes/health.ts` | ops | health check | Health | 生存確認 | - | keep technical | no copy duty |
| `/readyz` | `platform_v2/src/routes/health.ts` | ops | readiness check | Ready | readiness 確認 | - | keep technical | no copy duty |
| `/ops/readiness` | `platform_v2/src/routes/ops.ts` | ops | deploy check | Ops readiness | readiness を確認する | - | keep technical | no copy duty |
| `/manifest.php` | `upload_package/public_html/manifest.php` | browser | install | PWA manifest | app install 情報 | - | keep technical | no copy duty |
| `/sw.php` | `upload_package/public_html/sw.php` | browser | offline cache | Service worker | offline support | - | keep technical | no copy duty |

### 3.5 API family

詳細 endpoint inventory は `docs/spec/sitemap.md` を参照する。  
この文書では public surface 設計に必要な family role だけを固定する。

| route family | source | role | disposition | notes |
|---|---|---|---|---|
| `/api/v1/contact/*` | `platform_v2/src/routes/marketing.ts`, `write.ts` | contact intake | keep | public form backend |
| `/api/v1/auth/*` | `platform_v2/src/routes/write.ts` | session/auth | keep | support |
| `/api/v1/map/*` | `platform_v2/src/routes/mapApi.ts` | place discovery API | keep | `/map` の backend |
| `/api/v1/walk/*` | `platform_v2/src/routes/walkApi.ts` | walk/session API | keep | advanced capture support |
| `/api/v1/guide/*` | `platform_v2/src/routes/guideApi.ts` | live guide API | keep experimental | `/guide` family |
| `/api/v1/fieldscan/*` | `platform_v2/src/routes/fieldscanApi.ts` | sensor scan API | keep experimental | overloaded public copy には出さない |
| `/api/v1/research/*` | `platform_v2/src/routes/researchApi.ts` | research export | keep backstage | partner/research support |
| `/api/v1/ui-kpi/*` | `platform_v2/src/routes/uiKpi.ts` | UI KPI | keep internal | no public copy duty |
| `/api/v1/specialist/*` | `platform_v2/src/routes/read.ts` | authority / specialist | keep internal | no public copy duty |
| `/api/post_observation.php` ほか observation family | `upload_package/public_html/api/*.php` | legacy observation API | keep while legacy lives | v2 migration target |
| `identification family` | `upload_package/public_html/api/*.php` | legacy ID API | keep while legacy lives | specialist lane と整合させる |
| `site/report family` | `upload_package/public_html/api/*.php` | partner reporting | keep backstage | public surface から分離 |
| `event/community family` | `upload_package/public_html/api/*.php` | events/community | keep | community support |
| `user/auth family` | `upload_package/public_html/api/*.php` | auth/profile/notification | keep | support |
| `region/stats family` | `upload_package/public_html/api/*.php` | map/stats | keep | discover support |
| `export family` | `upload_package/public_html/api/*.php` | export/report | keep backstage | research/partner |
| `dev/debug family` | `upload_package/public_html/api/dev_*`, `*debug*`, `verify_*` | diagnostics | archive from public deploy | no public surface role |

---

## 4. Page Intent Matrix

セクション別コピー案は `public / trust / partner` の canonical pages にだけ持たせる。  
`admin / internal / api` は role と disposition の定義に留める。

### 4.1 Home `/`

- hero:
  - eyebrow: `ENJOY NATURE`
  - heading: `いつもの散歩が、冒険になる。`
  - lead: `見つけたものを、場所つきで残す。道端の花の名前がわかると、世界の解像度が変わる。`
- supporting sections:
  - `3ステップではじめる`
  - `最近の発見`
  - `次に歩く場所を探す`
  - `団体で使いたい方へ` は footer 直前の軽い bridge に留める
- proof:
  - 最近の記録
  - 地域 / 市区町村の広がり
  - 健康 / 地域 / 研究の橋は補助ストリップに留める
- bridge:
  - 自然が楽しい -> また歩く -> 記録が残る -> 研究に役立つ
- CTA:
  - primary: `記録する`
  - secondary: `探索マップを見る`
- disallowed content:
  - field loop の制度説明
  - sponsor 長文
  - research-only hero

### 4.2 Record `/record`

- hero:
  - heading: `今日の 1 ページを書く`
  - lead: `見つけたものを、場所つきで残す。名前は曖昧でもいい。`
- supporting sections:
  - `何を残せばよいか`
  - `名前が分からないとき`
  - `保存後に何が返るか`
- proof:
  - GPS / 日時 / 写真が残る
  - unknown でも成立する
- bridge:
  - quick capture でも future revisit に効く
- CTA:
  - primary: `保存する`
  - secondary: `名前が分からないときの基本を見る`
- disallowed content:
  - AI が確定するような copy
  - heavy methodology

### 4.3 Notes `/notes`

- hero:
  - heading: `見つけたことを、あとで見返せる`
  - lead: `散歩でも旅先でも、残した記録がここにまとまる。`
- supporting sections:
  - `あなたのノート`
  - `よく歩く場所`
  - `近くの記録`
- proof:
  - 自分の記録
  - 場所単位の読み返し
- bridge:
  - 記録が place memory に変わる
- CTA:
  - primary: `記録する`
  - secondary: `マップを見る`
- disallowed content:
  - leaderboard 主役
  - 企業向け導線の割り込み

### 4.4 Explore `/explore`

- hero:
  - heading: `次に歩く場所を探す`
  - lead: `近くの再訪候補も、旅先の寄り道先も、場所ごとの積み重なりから探せる。`
- supporting sections:
  - `また歩きたくなる場所`
  - `この場所で見つかっているもの`
  - `最近の記録`
- proof:
  - place clusters
  - recent observations
- bridge:
  - species browse より place discovery を上に置く
- CTA:
  - primary: `マップを見る`
  - secondary: `記録する`
- disallowed content:
  - taxonomy-first hero
  - report-only tone

### 4.5 Map `/map`

- hero:
  - hero wall は置かない
  - top strip で `今日はどこを見るかを決める地図` を言う
- supporting sections:
  - map itself
  - `なぜここか`
  - `なぜ今か`
  - frontier / effort summary
- proof:
  - coverage
  - place context
- bridge:
  - `場所を決める -> 歩く -> 記録する`
- CTA:
  - primary: `この場所で記録する`
  - secondary: `ノートを見る`
- disallowed content:
  - 種名確定を匂わせる copy
  - 企業 reporting copy

### 4.6 Lens `/lens`

- hero:
  - heading: `気になったものを、その場で確かめる`
  - lead: `AI は候補と見分けるヒントを返す。決めきらなくていい。`
- supporting sections:
  - `まず写真かメモを残す`
  - `次に何を見ればいいか`
  - `記録へつなぐ`
- proof:
  - current best rank ではなく next check point
- bridge:
  - AI は learning aid
- CTA:
  - primary: `記録する`
  - secondary: `ノートを見る`
- disallowed content:
  - `AI判定`
  - species certainty machine copy

### 4.7 About `/about`

- hero:
  - public label: `ikimonの考え方`
  - heading: `自然を楽しむ入口から始める理由`
- supporting sections:
  - `なぜ ENJOY NATURE なのか`
  - `なぜ place-first を深部に置くのか`
  - `ikimon が見ている循環`
- proof:
  - 記録が place memory と research に橋をかける
- bridge:
  - 楽しさと研究の連続性
- CTA:
  - primary: `使い方を見る`
  - secondary: `研究とデータの考え方を見る`
- disallowed content:
  - authority の運用細則
  - pricing / sponsor sales copy

### 4.8 Learn hub `/learn`

- hero:
  - heading: `使い方と考え方`
  - lead: `必要な深さだけ読めるようにする。`
- supporting sections:
  - `はじめて使う人へ`
  - `名前が分からないとき`
  - `研究とデータの考え方`
  - `更新`
- proof:
  - 入口別の導線
- bridge:
  - enjoy -> trust
- CTA:
  - primary: `名前が分からないときの基本`
- disallowed content:
  - obsolete jargon の羅列

### 4.9 Research / Data `/learn/methodology`

- hero:
  - public label: `研究とデータの考え方`
  - heading: `AI と人と記録を、どう信頼につなぐか`
- supporting sections:
  - `AI と人の役割`
  - `同定の信頼レーン`
  - `quick capture と survey`
  - `言いすぎない線引き`
  - `研究への接続`
- proof:
  - evidence / effort / review
- bridge:
  - 気軽な入口と慎重な研究利用は両立する
- CTA:
  - primary: `名前が分からないときの基本`
  - secondary: `お問い合わせ`
- disallowed content:
  - hero 的な enjoy copy の反復
  - heavy admin implementation detail

### 4.10 FAQ `/faq`

- hero:
  - heading: `よくある質問`
- supporting sections:
  - `名前が分からない`
  - `位置情報`
  - `団体で使いたい`
  - `AI と専門家`
- proof:
  - short answers
- bridge:
  - 不安を減らし、次の行動へ戻す
- CTA:
  - primary: `お問い合わせ`
- disallowed content:
  - 長すぎる制度説明

### 4.11 Contact `/contact`

- hero:
  - heading: `お問い合わせ`
- supporting sections:
  - `個人の質問`
  - `団体相談`
  - `データ削除 / trust`
- proof:
  - reply expectation
- bridge:
  - individual and partner intake in one place
- CTA:
  - primary: `送信する`
- disallowed content:
  - sales-first framing

### 4.12 For Business `/for-business`

- hero:
  - public label: `団体相談`
  - heading: `学校や地域で始めたいときの相談窓口`
- supporting sections:
  - `まず場所を決める`
  - `小さく始める`
  - `今できること / これから整えること`
- proof:
  - actual screens
  - site quickstart
  - start small
- bridge:
  - 個人の楽しさを壊さず、団体利用を支える
- CTA:
  - primary: `相談する`
  - secondary: `実際の画面を見る`
- disallowed content:
  - enterprise vanity copy
  - public hero の乗っ取り

---

## 5. Feature Map

### 5.1 Canonical naming rule

命名ルール:

- 3 秒で `誰が / いつ / 何のために使うか` が分からない名称は不採用
- public label と internal label は分けてよい
- route はすぐ変えなくても、canonical name は先に fix する

### 5.2 Feature definitions

| current feature | rename verdict | recommended public name | subtitle | actor | trigger | purpose | input | output | trust level | what it is not | related pages |
|---|---|---|---|---|---|---|---|---|---|---|---|
| フィールドノート | keep | フィールドノート | 見つけたものを、場所つきで残す | 一般ユーザー | 何かを見つけた直後 | 記録を残す | 写真、場所、時刻、メモ | 1件の記録 | citizen record | SNS 投稿、species certainty | `/record`, `/notes`, `/observation_detail.php` |
| 記録する | keep CTA | 記録する | 今日の 1 ページを書く | 一般ユーザー | home / map / lens から | capture を開始する | 写真、場所、気づき | 保存完了 | citizen record | 詳細な研究入力フォーム | `/record`, `/post.php` |
| フィールドノート閲覧 | keep | あなたのノート | 残した記録を、あとで見返せる | 既存ユーザー | 後で振り返るとき | place memory を読む | 記録済みデータ | ノート一覧 / 場所一覧 | citizen memory | leaderboard | `/notes`, `/profile` |
| フィールドガイド | rename | その場で調べる | AI が候補と見分けるヒントを返す | 一般ユーザー | その場で気になったとき | 気づきを深める | カメラ、観察 | 候補、見分けるヒント、次に見る点 | AI assist | AI判定、正式記録そのもの | `/lens`, `/record` |
| `/guide` のライブガイド | rename + demote | ライブガイド | 映像と音声で土地の文脈を読む 実験機能 | 実験利用者 | 長めの現地セッション | その場の環境理解を補助する | カメラ、音声、位置 | シーン要約、音声ガイド、発見記録 | experimental assist | public の primary feature | `/guide`, `/api/v1/guide/*` |
| フィールドスキャン | split | 探索マップ | 今日どこを歩くかを決める | 一般ユーザー | 出発前 | 次の場所を選ぶ | map, coverage, frontier | 行き先の仮説 | planning support | 受動センサー収集 | `/map`, `/explore`, `/scan` |
| fieldscan family のセンサースキャン | rename + demote | センサースキャン | カメラや音声で環境を広く拾う 実験機能 | 実験利用者 | 長めの現地計測 | センサー的に記録を拾う | 音声、映像、環境ログ | session recap, draft detections | experimental evidence | public main map concept | `/field_research.php`, `/fieldscan.php`, `/api/v1/fieldscan/*` |
| Map | keep + relabel | 探索マップ | なぜここか、なぜ今かを地図で読む | 一般 / 地元 | 行き先を決めたいとき | place discovery | place data, frontier, traces | 行く理由 | planning support | species certainty UI | `/map`, `/explore` |
| Explore | keep | みつける | 次に歩く場所と、そこで見つかっているものを見る | 一般 / 旅先 | browse したいとき | discover する | places, recent observations | browse / next step | browse support | taxonomy-only hub | `/explore`, `/map` |
| Community | keep | みんなで調べる | 観察会やテーマ調査に参加する | community participant | 1人でなくやりたいとき | shared action | event data | join / participate | community record | public hero main promise | `/events.php`, `/survey.php`, `/bingo.php` |
| Identification lane | keep internal | 同定ワークベンチ | 任された人が確認する | specialist | review 時 | 確定に寄与する | observation, evidence | review decision | authority-backed | general public flow | `/specialist/id-workbench`, `/specialist/review-queue` |
| Partner tools | keep backstage | 団体相談 / site workspace | 場所単位で始める | school / municipality / partner | group use 検討時 | group rollout | site, member, place config | workspace / report | operator trust | public hero surface | `/for-business*`, `/site_dashboard.php` |
| Research export | keep backstage | 研究利用 | 条件を満たした記録を扱う | researcher | export / analysis 時 | research use | evidence, effort, review | exports / reports | conditional claim | mass public feature | `/for-researcher.php`, `/api/v1/research/*` |

### 5.3 Explicit split decisions

#### `フィールドノート`

- verdict: 残す
- reason:
  - user mental model が立っている
  - `見つけたものを、場所つきで残す` の器として強い

#### `フィールドガイド`

- verdict: 公開面の主名称としては不採用
- reason:
  - `図鑑 / ガイド本 / AIライブガイド` の意味が混線する
- replacement:
  - public feature name: `その場で調べる`
  - experimental implementation name: `ライブガイド`

#### `フィールドスキャン`

- verdict: 単一名称としては不採用
- reason:
  - `次の場所を探す地図` と `受動センサー収集` が同じ名前に入っている
- replacement:
  - public planning feature: `探索マップ`
  - experimental sensor feature: `センサースキャン`

---

## 6. Terminology Crosswalk

| current term | canonical status | public term (ja) | public term (en) | internal term | verdict | notes |
|---|---|---|---|---|---|---|
| ENJOY NATURE | primary | ENJOY NATURE / 自然を楽しむ | ENJOY NATURE | - | keep | public top message |
| place-first | internal only | 使わない | do not use | place-first | keep internal | deep philosophy only |
| Place Intelligence OS | internal only | 使わない | do not use | Place Intelligence OS | keep internal | partner / strategy only |
| フィールドループ | demote | `見つける -> 残す -> また歩く` | `find -> keep -> walk again` | field loop | demote | public headline に使わない |
| フィールドノート | public primary | フィールドノート | Field Note | field note | keep | note system |
| 記録する | public CTA | 記録する | Record | record | keep | action label |
| フィールドガイド | overloaded | `その場で調べる` / `ライブガイド` | `Lens` / `Live Guide` | guide / live guide | retire as umbrella | split: `/lens` = `Lens`, `/guide` = `Live Guide` |
| フィールドスキャン | overloaded | `探索マップ` / `センサースキャン` | `Explore Map` / `Sensor Scan` | scan / fieldscan | retire as umbrella | split: `/map` = `Explore Map`, experimental sensor = `Sensor Scan` |
| methodology | public label 差し替え | `研究とデータの考え方` | `Research & Data` | methodology | rename public | jargon 回避 |
| authority policy | public label 差し替え | `同定の信頼のしくみ` | `How identification is trusted` | authority policy | rename public | trust page |
| public claim | internal/trust only | `公開候補` | `public candidate` | public claim | internalize | general users に出しすぎない |
| sponsor | backstage | `団体相談` | `For Organizations` | sponsor / partner | rename public | partner-facing only |

---

## 7. Route Disposition

### 7.1 Public canonical routes to keep

| current route | target role | disposition | rationale |
|---|---|---|---|
| `/` | public landing | keep + rewrite copy | ENJOY NATURE の主舞台 |
| `/home` | signed-in home | keep secondary | return visit の起点 |
| `/record` | capture entry | keep | 記録の canonical 入口 |
| `/notes` | notebook home | keep | field note の読み返し中心 |
| `/explore` | discovery | keep | place discovery の起点 |
| `/map` | map tool | keep | 行き先決定の主導線 |
| `/lens` | AI help explainer | keep + rename concept | `フィールドガイド` の混線をほどく |
| `/about` | philosophy page | keep + relabel | Page A |
| `/learn` | learn hub | keep | trust hub |
| `/learn/identification-basics` | ID basics | keep | beginner support |
| `/learn/methodology` | research/data/trust | keep + rewrite | Page B |
| `/faq` | FAQ | keep | uncertainty relief |
| `/privacy` | privacy | keep | trust |
| `/terms` | terms | keep | trust |
| `/contact` | contact | keep | support / lead intake |
| `/for-business*` | partner entry | keep | backstage partner lane |
| `/events.php` | community hub | keep | community lane |
| `/event_detail.php` | event detail | keep | community deep layer |
| `/survey.php` | themed survey | keep secondary | structured participation |
| `/bingo.php` | community challenge | keep secondary | campaign / event support |
| `/observation_detail.php` | evidence detail | keep | reviewable evidence |
| `/species.php` | species deep layer | keep | deep layer |
| `/compare.php` | compare deep layer | keep | support tool |
| `/id_wizard.php` | guided ID | keep support | learning support |
| `/wellness.php` | rhythm support | keep secondary | habit support |

### 7.2 Merge or redirect

| current route | target route / family | disposition | rationale |
|---|---|---|---|
| `/index.php` | `/` | redirect | legacy root alias |
| `/post.php` | `/record` | redirect | capture entry を一本化 |
| `/map.php` | `/map` | redirect | canonical path 統一 |
| `/explore.php` | `/explore` | redirect | canonical path 統一 |
| `/profile.php` | `/profile` | redirect later | canonical path 統一 |
| `/about.php` | `/about` | redirect | canonical path 統一 |
| `/faq.php` | `/faq` | redirect | canonical path 統一 |
| `/privacy.php` | `/privacy` | redirect | canonical path 統一 |
| `/terms.php` | `/terms` | redirect | canonical path 統一 |
| `/contact.php` | `/contact` | redirect | canonical path 統一 |
| `/methodology.php` | `/learn/methodology` | redirect | Page B へ統一 |
| `/guides.php` | `/learn` | redirect | learn hub へ統一 |
| `/updates.php` | `/learn/updates` | redirect | learn hub 配下へ |
| `/pricing.php` | `/for-business/pricing` | redirect | 一般料金面を作らない |
| `/for-business.php` | `/for-business` | redirect | partner lane 統一 |
| `/for-business/index.php` | `/for-business` | redirect | partner lane 統一 |
| `/for-business/pricing.php` | `/for-business/pricing` | redirect | partner lane 統一 |
| `/for-business/demo.php` | `/for-business/demo` | redirect | partner lane 統一 |
| `/for-business/status.php` | `/for-business/status` | redirect | partner lane 統一 |
| `/for-business/apply.php` | `/for-business/apply` | redirect | partner lane 統一 |
| `/for-business/create.php` | `/for-business/apply` | redirect | intake 一本化 |
| `/dashboard.php` | `/profile` | merge | self stats を profile に統合 |
| `/my_organisms.php` | `/profile` | merge | list は profile 配下へ |
| `/profile_edit.php` | `/profile` | merge in IA | edit utility は profile 配下で扱う |
| `/edit_observation.php` | `/observation_detail.php` family | keep support | evidence detail から辿る utility とする |
| `/zukan.php` | `/explore` | merge | 図鑑を deep catalog に下げる |
| `/team.php` | `/about` | merge | standalone 優先度が低い |
| `/scan` | `/map` | merge | public planning 機能は map が本体 |
| `/guidelines.php` | `/learn/methodology` + support detail | merge support | trust docs を集約 |
| `/for-citizen.php` | `/` | redirect | citizen LP を重ねない |
| `/id_center.php` | `/specialist/id-workbench` | redirect | specialist lane 統一 |
| `/needs_id.php` | `/specialist/id-workbench` | redirect | specialist lane 統一 |
| `/id_workbench.php` | `/specialist/id-workbench` | redirect | specialist lane 統一 |
| `/review_queue.php` | `/specialist/review-queue` | redirect | specialist lane 統一 |
| `/admin_dashboard.php` | `/admin/` | redirect | legacy admin alias |
| `/livemap.php` | `/map` | redirect | legacy map alias |
| `/biodiversity_map.php` | `/map` | merge | map layers に吸収 |
| `/ikimon_walk.php` | `/profile` | merge | walk history は profile / notes へ |
| `/android-app.php` | `/record` or `/` install section | merge | app install 情報は public landing に統合 |

### 7.3 Experimental or backstage only

| current route | disposition | rationale |
|---|---|---|
| `/guide` | keep experimental | live guide は public primary にしない |
| `/field_research.php` | keep experimental/backstage | advanced capture / sensor lane |
| `/fieldscan.php` | redirect to `/field_research.php` | fieldscan family の一本化 |
| `/field_scan.php` | redirect to `/field_research.php` | fieldscan family の一本化 |
| `/bioscan.php` | redirect to `/field_research.php` | fieldscan family の一本化 |
| `/walk.php` | redirect to `/field_research.php` | field capture family の一本化 |
| `/scan.php` | redirect to `/field_research.php` | legacy scan flow |
| `/showcase.php` | keep backstage | partner showcase |
| `/csr_showcase.php` | keep backstage | partner showcase |
| `/site_dashboard.php` | keep backstage | partner workspace |
| `/site_editor.php` | keep backstage | partner setup |
| `/corporate_dashboard.php` | keep backstage | partner workspace |
| `/corporate_members.php` | keep backstage | partner admin |
| `/corporate_settings.php` | keep backstage | partner admin |
| `/corporate_invite.php` | keep backstage | partner support |
| `/dashboard_municipality.php` | keep backstage | regional operator |
| `/dashboard_portfolio.php` | keep backstage | enterprise portfolio |
| `/demo/` | keep backstage | partner demo |
| `/demo/report.php` | keep backstage | partner demo report |
| `/showcase_embed.php` | keep backstage | embed showcase |
| `/widget.php` | keep backstage | embed utility |
| `/request_survey.php` | keep backstage | partner intake |
| `/for-researcher.php` | rewrite support | Page B と research export の橋渡しに限定 |
| `/surveyors.php` ほか surveyor family | keep backstage | public surface から分離 |
| `/event_dashboard.php` | keep backstage | organizer utility |
| `/generate_event_report.php` | keep backstage | organizer utility |
| `/generate_grant_report.php` | keep backstage | organizer utility |

### 7.4 Archive candidates

| current route | disposition | rationale |
|---|---|---|
| `/analytics.php` | archive | public surface role が弱い |
| `/reference_layer.php` | archive | deep reference として分離しすぎ |
| `/century_archive.php` | archive | 現行 wedge に対して遠い |
| `/sound_archive.php` | archive | public benefit が弱い |
| `/quests.php` | archive or merge into community later | 現状の public promise と接続が弱い |
| `/bioblitz_join.php` | merge into `/events.php` after audit | standalone page を増やさない |

### 7.5 Technical support routes

| current route | disposition | rationale |
|---|---|---|
| `/403.php`, `/404.php` | keep support | error handling |
| `/login.php`, `/logout.php`, `/oauth_*` | keep support | auth utility |
| `/oauth_login.php`, `/oauth_callback.php` | keep support | OAuth utility |
| `/app_oauth_start.php`, `/app_auth_complete.php`, `/app_auth_redeem.php` | keep support | app auth utility |
| `/invite.php` | keep support | invite utility |
| `/api_omoikane_search.php`, `/api_omoikane_status.php` | keep internal API | model ops utility |
| `/manifest.php`, `/sw.php`, `/offline.php` | keep technical | PWA support |
| `/healthz`, `/readyz`, `/ops/readiness` | keep technical | operations |
| `/api/*`, `/api/v1/*` | keep by family | UI ではなく backend contract |

---

## Acceptance Checklist

- ENJOY NATURE が public top message として明文化されている
- place-first / Place Intelligence OS が internal spine として隔離されている
- Page A と Page B の役割が分かれている
- `フィールドノート / フィールドガイド / フィールドスキャン / フィールドループ` の関係が混線なく説明されている
- canonical routes と legacy aliases の disposition が決まっている
- partner/backstage が public hero を乗っ取らない構造になっている
- AI / citizen / specialist / public claim の trust boundary が明文化されている

---

## Default implementation order after review

1. Home / record / notes / map の copy と nav をこの正本に合わせる
2. `/about` と `/learn/methodology` を Page A / Page B として再編集する
3. `field guide / field scan` の表記を public copy から整理する
4. legacy redirects を実装する
5. specialist / partner / technical routes の表ラベルを整える
