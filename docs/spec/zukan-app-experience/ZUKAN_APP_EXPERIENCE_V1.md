# ZUKAN App Experience v1

Status: `CANONICAL PRODUCT EXPERIENCE`
Date: 2026-09-01
Design refinement: 2026-09-05 (§16; design adopted, implementation/runtime acceptance not asserted)
Product: ZUKAN
Upstream product architecture: `docs/spec/zukan-product-architecture/SPEC.md`
Broad profile horizon: `docs/spec/zukan-product-architecture/PROFILE_HORIZON.md`

## 1. Purpose

This contract fixes the user-facing information architecture, screen responsibilities, state priority, participation discovery and PWA brand migration for ZUKAN after M6 production verification.

LUNA is an implementation and verification executor for this contract. It must not redefine product value, navigation meaning, privacy semantics, profile roadmap, milestone scope or brand identity.

The experience must remain coherent as ZUKAN grows from the currently proven observation-event profile into photo contests, sketch/editorial activities, missions/town walks, tourism programs and other adopted Program profiles.

## 2. Non-negotiable product rules

- Reuse existing M1–M6 capabilities and routes. Do not create replacement Record, Place, Program/Event, Profile, auth, rights or publication foundations.
- Keep current privacy, consent, rights, Review, location-minimization, publication and free/paid semantics unchanged.
- UI terminology must be user-facing Japanese, not internal schema or infrastructure terms.
- Biodiversity is one Domain Pack, not the product boundary.
- `観察会` is one currently implemented Program profile, not the permanent name for every future participation experience.
- `撮る` is a global primary action, not a content area competing equally with navigation destinations.
- Home is not an archive and not an all-metrics dashboard.
- `/profile` is not a duplicate Home/Records/Places/Programs page.
- Do not create new brand artwork. Reuse the official ZUKAN symbol/wordmark assets.
- Product UI must not show old IKIMON identity except where IKIMON is intentionally shown as the operating company.
- Do not expose planned M9+ profiles as usable before they are implemented and verified.

## 3. Global information architecture

### 3.1 Desktop

Persistent primary destinations:

1. `ホーム`
2. `記録`
3. `場所`
4. `参加`
5. `自分`

Global primary action: `撮る`

`参加` is the stable user-facing responsibility for finding and returning to Programs. Today it may contain only the implemented observation-event profile. M9 may add other Program profiles behind the same responsibility without changing the primary IA.

### 3.2 Mobile

Bottom navigation is fixed to:

1. `ホーム`
2. `記録`
3. `撮る`
4. `場所`
5. `参加`

`自分` is reached from the persistent profile/avatar action in the header.

Do not add a sixth bottom-navigation item.

### 3.3 Existing route mapping

Preserve existing canonical route behavior unless an adopted route migration changes it:

- Home → existing localized home/root
- 記録 → `/records?view=mine`
- 場所 → `/map?tab=places`
- 参加 → current Program/Event discovery route, initially `/community/events`
- 自分 → `/profile`
- 撮る → existing global capture launcher / Record creation flow

Existing deep links and redirects must continue to work.

Internal `/community/events` routing does not make `community` or `観察会` the permanent product-level information architecture.

## 4. Public Home

### 4.1 Job

Within approximately five seconds, a first-time visitor should understand:

- ZUKAN records and connects regional moments/information to places and time.
- a photo is the easiest starting action.
- records can become rights-safe regional knowledge.
- people can participate in regional Programs.

### 4.2 Hero

Canonical Japanese H1:

`撮ると、まちの今が図鑑になる。`

未認証・投稿権限が未確立の初訪問者のPrimary CTA: `みんなの記録を見る`。Secondary CTA: `場所から探す`。共通の`撮る`入口は維持する。詳しい構成と状態条件は§16.3を正本とする。

Do not use `招待された方へ。見つけたことを、写真1枚から。` as the main H1.

Do not allow oversized typography or forced phrase splitting to turn Japanese copy into a vertical wall of characters.

### 4.3 Participation discovery

A `参加できる企画` / `参加` affordance must be visible in the first meaningful scroll region.

Until M9 broad profiles are implemented, show only current truthful capability, for example current/recruiting `観察会` plus a safe organizer entry. Do not render fake Photo Contest, Stamp Rally or tourism Program cards merely because they exist in the roadmap.

When later profiles become verified, they enter the same participation responsibility rather than creating new top-level navigation for each profile.

## 5. Logged-in Home

### 5.1 Job

Home answers one question:

`今、何をすればいいか。`

It is state-driven and action-oriented. It must not become a complete Record/Place/Program list.

### 5.2 Priority resolver

Use this product priority order. The first applicable state becomes the single primary action. At most two additional secondary actions may follow.

1. safety / consent / Review / rights action requiring the user
2. unsaved, draft, queued or recoverable Record work
3. active Program the user is participating in
4. organizer action required for an active Program
5. completely new user → first Record
6. upcoming Program relevant to the user
7. Place worth revisiting because another Record would create useful change-over-time context
8. recent own Record

For the current M6 runtime, Program states may be observation events. The resolver semantics must remain Program-generic so later profiles do not require a new Home architecture.

If multiple items exist in the same class, use deterministic current product truth. Do not invent AI ranking.

### 5.3 Primary/secondary limits

- exactly zero or one primary action
- zero to two secondary actions
- lower-priority material belongs in its dedicated hub

Do not render rows of empty-state cards such as `記録0件 / 場所0件 / 企画0件`.

### 5.4 New user

For a user with no meaningful state:

Primary: `最初の記録を残す`

Secondary candidates:

- `参加できる企画を見る`
- `場所を見る`

Do not display a large empty dashboard.

### 5.5 Mature user

As data grows, Home becomes more selective, not denser.

The full archive belongs in `記録`, the full Place set in `場所`, and the full participation/organizer history in `参加`.

## 6. Records Hub

### Job

`自分が残したもの`を探す・振り返る・続きを行う。

Use the existing Record truth. Support existing media kinds and states, including photo, video, audio, memo, draft/recoverable work, Review state and visibility state.

A Record item should prioritize media/thumbnail when safe, user-facing title/name, observed time, Place when safe, concise visibility state and concise Review/confirmation state when relevant.

Do not expose internal schema names. Avoid an admin-table presentation.

## 7. Places Hub

### Job

`自分と場所の関係`を返す。

Prioritize:

- recently recorded Places
- Places the user returns to
- Places where another visit would reveal change over time
- Records associated with a Place
- Programs associated with a Place

Map and list presentations use the same Place truth and must not create parallel Place identities.

## 8. Participation / Program Hub

### 8.1 Product position

M6 proved a self-serve observation-event Program profile. The stable user responsibility is broader: find, join, resume or host regional Programs.

Japanese primary-nav label: `参加`

Current observation-event UI may continue to label a concrete item or section `観察会`.

### 8.2 Current truthful structure

Before M9 profile implementation, the hub may expose:

#### 参加する
- 開催中の観察会
- 募集中の観察会
- relevant nearby observation events where current product truth permits
- invite-code/deep-link join flow

#### 自分の参加
- 参加予定
- 参加中
- 過去

#### 主催
- 主催中
- current safe draft concept if it exists
- 過去
- `もう一度開催`
- `新しい観察会を作る`

Participant and organizer actions must not be mixed into one ambiguous action cluster.

### 8.3 Future profile insertion

M9 may add `photo_contest`, `sketch_drawing_event`, `mission_town_walk`, `stamp_rally`, `children_citizen_editorial`, and `tourism_regional_engagement`.

Those profiles must enter the same `参加` responsibility and reuse the Program Core. They do not get a new global navigation item unless a future owner-adopted experience contract explicitly changes the IA.

### 8.4 Cross-surface discovery

At minimum:

- Public Home → participation discovery
- Member Home → active/upcoming/organizer Program when priority selects it
- Place detail → relevant Programs for that Place when available
- current Event recap → rehost using M6 contract
- invite/deep link → shortest safe join route

Do not create a new Program backend or participant model for M9 profiles.

## 9. Profile / `自分`

### Job

`本人・アカウント・安全・データ管理`

This surface is not a second Home.

Keep user/account management concerns such as:

- profile/display identity
- account/login state
- publication/visibility controls exposed by current product truth
- consent
- location/privacy
- guardian/minor controls where applicable
- notifications where currently supported
- language
- data and rights
- withdrawal/deletion/export entry points already supported
- help/legal
- logout

Do not reproduce the full Record archive, Place archive or Program archive. Link to dedicated hubs instead.

A future public person/profile Publication is not the same thing as the private `自分` account surface and must follow the rights boundary in `PROFILE_HORIZON.md`.

## 10. PWA and installed-app brand migration

Everything visible during install, launch, refresh, offline fallback, home-screen presence and shortcuts must present ZUKAN as the product.

IKIMON may remain only as intentional operator/company attribution, never as the installed-app identity.

Required visible brand state:

- manifest `name` = `ZUKAN`
- manifest `short_name` = `ZUKAN`
- app icon = official ZUKAN symbol
- maskable icon = official ZUKAN symbol
- Apple touch icon = official ZUKAN symbol
- favicon = ZUKAN
- Android/standalone launch appearance = ZUKAN
- offline view = ZUKAN
- install UI = ZUKAN
- app-refresh view = ZUKAN symbol, never generic/legacy `i`

Do not change manifest app `id` merely to force refresh. Existing installed apps remain the same app identity.

Use versioned ZUKAN icon asset URLs or another deterministic browser-safe cache-busting mechanism so existing devices do not remain stuck on old icon bytes.

New Service Worker cache namespace: `zukan-app-*`.

During migration, clean stale caches matching both old `ikimon-app-*` and obsolete `zukan-app-*`.

Do not delete IndexedDB, Record drafts, outbox data, auth state, user-generated media or other user data.

Installed-app shortcuts prioritize:

1. `撮る`
2. `参加`
3. `場所`
4. `記録`

Use existing routes and official ZUKAN assets.

Do not trust filenames alone. Verify actual icon bytes/visuals so a `zukan-*` file cannot silently contain the old IKIMON mark.

No new logo design is authorized.

## 11. Visual system

Public Home, logged-in Home, Records, Places, Participation, Profile and PWA must feel like one product.

Direction:

- photography and real records first
- clean editorial composition
- ZUKAN green
- white
- warm neutral backgrounds where useful
- restrained borders/cards
- strong hierarchy
- mobile-first interaction

Avoid generic SaaS dashboard appearance, dense card grids, excessive rounded rectangles, decorative gradients, old IKIMON product branding, internal architecture vocabulary and multiple equal primary actions on one state.

## 12. State fixtures

Verify at least:

1. guest
2. completely new logged-in user
3. one Record
4. many Records
5. draft/recoverable Record
6. private-only user
7. mixed public/private Records
8. active observation-event participant
9. upcoming observation-event participant
10. active observation-event organizer
11. Review/consent/safety action required
12. zero current Programs
13. offline installed PWA
14. degraded/error state

M9+ fixtures are added only when those profiles become implementation candidates; current UI must not fake them.

## 13. Responsive contract

Required widths:

- 375
- 768
- 1280
- 1440

For each relevant fixture:

- no horizontal overflow
- no broken header/bottom navigation
- primary action visible and understandable
- touch targets safe on mobile
- photo/media aspect ratios stable
- public/private information does not cross boundaries
- navigation meaning remains consistent

## 14. Acceptance

A normal user can answer without explanation:

- `今やることはどこ？` → Home
- `自分の写真や記録は？` → 記録
- `場所ごとに見たい` → 場所
- `参加できる企画を探す / 自分の参加を見る / 開催する` → 参加
- `公開範囲やアカウントを変えたい` → 自分
- `今すぐ残したい` → 撮る

Additional acceptance:

- M1–M6 semantics remain intact
- current observation-event discovery is no longer hidden
- the IA does not lock the future product to observation events
- Profile no longer duplicates major content hubs
- PWA shows only ZUKAN product identity at user-visible brand surfaces
- planned M9+ profiles are not presented as runtime-active
- P0/P1 UX defects = 0
- staging exact-source verification completes before production promotion

## 15. Implementation boundary

This document authorizes design-conforming source implementation only when referenced from an executor instruction against current source.

Production mutation is not authorized by this document.

If implementation uncovers a true product-choice conflict, privacy/rights ambiguity, irreversible migration, external-send, permission, secret, billing or production boundary, park only that boundary and continue deterministic reversible work.


## 16. UI/UX設計の確定事項（2026-09-05）

この節は画面・文言・状態の設計を定める。実装の割当、開発キューの昇格、運用指示、追加デプロイは含まない。設計の採用と、画面の実装・実利用の確認は別である。判断理由は [ADR-0001](decisions/ADR-0001-read-first-and-explicit-state-design.md) に置く。

### 16.1 共通の構成

- PCは既存の1161px境界以上で、ロゴ → ホーム・記録・場所・参加 → 右側の「撮る」・自分を一つのヘッダーに収める。同じ主ナビをサイドバーにも出さない。
- 1160px以下はロゴと自分を上部、ホーム・記録・撮る・場所・参加を下部へ集約する。タブレットもリンクを無理に詰め込まず同じ構成にする。
- 地図のサイドパネルは検索結果と文脈だけを担う。旧「ホーム／記録を見る／マップ／ガイド」の別系統ナビは併設しない。
- 「自分」は常に本人向けのアカウント入口。PCは右端のアカウント操作、スマホは右上から辿る。公開人物紹介の入口と混同しない。
- 一つの画面・状態で主操作は一つ。永続的な「撮る」は共通操作であり、空カードごとに同じCTAを増やさない。
- 戻ったときは、元の検索語、絞り込み、選択していた場所とスクロール位置を保つ。記録詳細から毎回地図の初期位置へ戻さない。

### 16.2 見た目と文字組み

| 対象 | 確定した設計 |
|---|---|
| 色 | 既存brand.zukan-v1の緑 #143f2e、本文 #17211b、副文 #55615a、白、淡い面 #f7f7f3を使用。ページごとに青緑のグラデーションや別テーマを作らない |
| フォント | 現行の日本語ゴシック系統を維持。本文16px、短い補助情報13–14px。状態や操作理由を小さな注釈へ押し込まない |
| 見出し | PC H1は40–52px、スマホは30–34pxを基準。H2は22–26px。長さによって調整し、本文の情報量を見出しの巨大さで補わない |
| 行間 | 本文1.7–1.8、見出し1.3–1.45。日本語の意味のまとまりを保ち、助詞始まり・語中の切断・末尾1文字を実幅で確認 |
| 幅と余白 | 内容幅は最大1200px。PC左右40px、タブレット28px、スマホ20pxを基準。既存4/8/12/16/24/32/40/56pxの間隔を使う |
| 面と境界 | 白を基本にし、下書き・説明・注意など意味のあるまとまりだけ淡い面で囲う。カードの重ねすぎ、大きな空カード、すべてをpillにする処理を避ける |
| 写真 | 一覧は安全な派生画像を4:3程度で見渡し、詳細は画像を欠落なく見られる表示を優先。保護対象を見せるために切り抜き・原画像取得を迂回しない |
| 操作 | タップ領域44px以上。選択状態は色だけでなく線・文字・aria-current等で分かる。focus-visibleを消さない |
| 動き | 操作に必要な短い状態変化だけ。自動カルーセル、装飾的な常時アニメーション、スクロールの乗っ取りは使わない |

情報密度は一律にしない。公開ホームは価値を理解する余白、記録一覧は見渡しやすさ、記録詳細は内容と根拠、撮影中は一つの作業への集中を優先する。

### 16.3 公開ホーム

- H1は「撮ると、まちの今が図鑑になる。」を維持する。写真で始めやすいことと、自然・文化・暮らしの広さを本文と入口で両立させる。
- 投稿権限を持たない初訪問者の主CTAは「みんなの記録を見る」、副CTAは「場所から探す」。共通の「撮る」から投稿開始はいつでも選べる。
- 投稿時のログインや招待条件は、その操作の近くで説明する。初訪問の最初の価値を認証手続きだけで終わらせない。
- 紹介条件を満たす写真がある場合は、写真・短い文脈・その記録へのリンクを一つのまとまりにする。公開一覧に載ることを、ホーム紹介への同意と読み替えない。
- 紹介写真がない場合は写真枠そのものを外す。白い四角、巨大な空の写真カード、「ホーム用データ準備中」の内部都合を主役にしない。「記録を探す／場所をたどる／企画を見る」への具体的な入口を置く。
- 写真の代わりに架空の地域記録、生成写真、仮の件数を事実として表示しない。画面案の参考写真は実際の掲載許可と別に扱う。
- 一つの写真を、同じページのhero・最近の記録・場所紹介へ機械的に繰り返さない。現在の主役として選んだ記録は直下の一覧で重複させない。
- 初回の価値はCTAクリックだけではなく、公開記録の詳細に辿り着き内容を理解できたこと。既存のdetail-view等を利用し、新しい計測基盤や科学的効果実証を画面改善の前提にしない。

### 16.4 自分のホーム・記録一覧

ホームは「前の記録を続ける」「参加案内を見る」など、その人の現在の一つの行動を示す。権利上の注意は対象の操作に限定し、別の非公開保存や閲覧を全面停止する理由にしない。

記録一覧は次を優先する。

1. 投稿者が付けた題名。なければ許可された記録種別と記録日による「9月2日の写真」等。
2. 写真・音・動画・文書等の種類と、その記録の内容を見分けるサムネイル。
3. 記録した日。投稿日しか分からなければ「投稿日」と明記する。
4. 公開可能な場所名。公開できない精度を補ったり、座標0や推定の地名を埋めたりしない。
5. 確認状態が必要なときだけ短い補助表示。

「名前待ち」をすべての記録の主題名にしない。生物名の確認が対象である場合も「名前は未確認」を補助表示にし、本人の題名や文化・暮らしの記録を生物同定の状態で上書きしない。

- PCは3列を基本とし、写真だけで初画面を使い切らず題名・日時が一緒に見える。
- タブレットは2列、スマホは104px前後のサムネイル＋本文の横並びを基本とする。詳細画面では写真を十分大きく見せる。
- サブナビは「自分の記録／みんなの記録」の対象切替に限定する。「場所」「活動」は共通ナビと重複させない。
- 写真・メモ等の少数の絞り込みを先に出し、細かな条件は「条件を絞る」へ。未対応のメディア種を実装済みのfilterとして表示しない。
- 正常な検索0件、取得不能、一部取得を分ける。条件を外す・明示的な再読込・取得済み結果の保持を、それぞれの状態に合わせる。

### 16.5 記録詳細と確認・公開の意味

PCは写真と本文を広い側、日時・場所・確認状態を補助側に置く。スマホは題名 → 写真 → 本文 → 記録の情報 → AI候補 → 出典・利用条件・変更履歴の順に読む。本人向けの公開操作は別のまとまりにし、閲覧者向け本文へ混ぜない。

一つのRecordに複数のObservationやClaimがある場合、名前の確認状態は対象ごとに表示する。一つの名前が確認されたことを、写真全体や記録のすべてが確認済みであることにしない。

| 表示する意味 | 根拠と表示の原則 | 誤って結び付けないもの |
|---|---|---|
| 保存 | 端末の下書き、送信中、一部の媒体だけ保存、サーバー保存を区別 | AIの完了、公開、外部配信 |
| AIの候補 | suggestionの候補・根拠・不確かさ・失敗を表示 | 人による決定、内容Review、確定した事実 |
| 名前の確認 | 対象Observationの現在有効なClaimと人の確認。本人確認・共同確認・意見の不一致を区別 | Record全体の承認や公開権利 |
| 内容のReview | 対応するProgram等に正式なReviewがある場合だけ表示 | 生物名のaccepted ClaimやAI理由から作った架空のReview |
| 公開範囲 | 現在のRecord/Rightsが示す自分のみ・実際に許可された限定範囲・全体公開 | 外部利用への同意、ホーム掲載、転載許可 |
| 公開・配信の条件 | 同意・ライセンス・撤回・位置精度等を目的と掲載先ごとに確認 | 「条件を満たす」だけで掲載済みとすること |
| 実際の掲載 | PublicationEditionやconsumerの受取・読戻しで確認できた掲載先だけ表示 | ZUKAN自身のRecord URLを外部サイトの掲載実績とすること |

確定する解釈：

- disputedはpendingやunknownへ潰さず「確認に意見があります」。有効なClaimが一意に定まらない場合も、自動で最新・高スコアを選ばず不一致を明示する。
- 理由は現在有効な対象Claimの人の決定に結び付いたものだけ。AIのreview_reasons、別のClaim、取り下げ済みの理由を流用しない。
- owner_confirmedを「専門家確認済み」や「コミュニティ確認済み」と呼ばない。
- 拒否・撤回等の理由を現在のread modelが持っていなければ復元しない。「理由を確認できません」とし、実装済みの履歴参照がある場合だけ案内する。
- rights/context/mappingが欠ければ公開・配信の判定は「未確認」。ただし既存の公開範囲自体が確認できるならその値を別に表示し、未知の判定から「非公開になった」とも推測しない。
- 自分の公開Recordへのリンクは「ZUKANの公開ページ」。外部サイトの受取証拠がなければ「外部サイトの掲載状況は未確認」。
- ownerだけの理由・限定先・未公開媒体・詳細位置は、public/別ユーザーのHTML・API・共有カードへ出さない。
- 「出典・利用条件・変更履歴」は一つの展開入口にまとめるが、出典、ライセンス、変更履歴の意味や原Recordを統合しない。
- その場所への正式な関係が不明な記録に、推定の「場所の図鑑へ」リンクを作らない。記録一覧への復帰を残す。

### 16.6 撮影・記録・復旧

撮影中は戻る／状態／保存に集中する。種名・分類・必須のGPS入力を、すべての記録の共通必須項目にしない。現在使える写真・メモ等の入口を再利用し、選んだ媒体に必要な入力だけ見せる。

| 状態 | 主な表示 | 操作と復帰 |
|---|---|---|
| 保存前 | 「公開範囲：自分のみ」 | 写真・メモ・任意の場所を確認し「非公開で保存」 |
| 端末だけの下書き | 「この端末に下書き保存しています」 | サーバー保存とは分ける。同じ端末で続きへ戻れる |
| 接続待ち | 「接続が戻ると保存します」 | 永続化された送信意図がある場合だけ表示。意図がなければ自動送信しない |
| 写真送信中 | 「写真を送信しています」 | まだ保存完了と表示しない。中断時は下書きと同じ記録へ復帰 |
| 一部だけ保存 | 何が保存され、何が残っているか | 未完了部分だけ再試行。重複Recordを作らない |
| サーバー保存済み | 「非公開で保存しました」 | 同じRecord詳細へ。AI待ち・失敗を保存失敗へ戻さない |

閉じる確認は実際に失う変更がある場合に限る。端末へ保存済みなら、戻るだけで毎回警告しない。何も入力していない画面の離脱を妨げない。保存後は勝手に公開せず、公開範囲は独立して本人が選ぶ。

位置は任意。現在地の許可は「現在地を使う」を押した場面で求める。拒否や圏外でも記録を残せる。表示する公開位置の精度と端末・本人用の精度を混ぜない。

### 16.7 場所・参加・自分

**場所**

- 一覧と地図は同じPlaceと公開記録への入口。スマホでは一覧で内容を読めることを先に保証する。
- 最初に出すのは場所・記録の探索。雨雲、ヒートマップ、専門layer、地図設定は必要時に開く補助操作とする。
- 登録されたPlaceと外部の地名候補を別に表示。field ID、OSM ID、近傍の候補を、正式なPlace identityへ無言で読み替えない。
- 場所の図鑑は名前・場所の説明・出典 → 記録 → 時間の変化 → 関係する現在の企画の順。0件のグラフ、空のSite Intelligence、使えない編集ボタンは出さない。
- 最初の記録があればその記録を見せる。周辺の記録は「周辺」として別枠にし、その場所の件数や実績へ加算しない。

**参加**

- 「募集中／自分の参加」を先に分け、主催者の操作は別の入口に置く。申込み済み、当日の参加確認、記録、結果の確認を一つの「参加済み」にしない。
- 企画詳細は主催者、日時、場所、安全上の注意、参加条件、記録の公開範囲、申込み後の案内を先に示す。科学的効果や採択・協力関係は未確認のまま宣伝しない。
- 募集0件なら「いま募集中の企画はありません」。招待の入力と公開記録を見る道を残し、架空の企画や将来profileのカードを並べない。
- 応援・寄付・購入等は、受付主体とその先の運用・結果が成立する場合だけ表示する。見た目のためにCTAを足さない。

**自分**

- 本人だけのアカウントと公開範囲・同意・位置・通知・言語・データ・ヘルプを整理する。個人の記録一覧、場所一覧、活動一覧を繰り返さない。
- 一つのRecordの公開取り下げ、データ削除、アカウント全体の削除は対象と影響を分けて説明する。
- 未対応の設定を空の管理画面として増やさない。公開される情報と本人だけの設定は、同じ見た目のページで曖昧にしない。

### 16.8 アクセシビリティと状態の完成条件

- ページのH1は一つ。主ナビ、ページ内の対象切替、補助filterの役割を区別する。
- キーボードだけで主要導線、結果、展開情報、戻る操作へ辿れる。dialog/sheetを閉じると開始した操作へfocusを戻す。
- 375/768/1280を基本に、狭い320pxと既存の1160/1161px境界で、文字・主CTA・固定ナビが欠けない。
- 下部固定ナビや保存barにはsafe-areaと本文末尾の余白を確保する。入力・エラー理由・最後の操作を隠さない。
- 読込中、正常な0件、一部取得、失敗、権限不足、未確認を別の文章と操作で示す。spinnerを永久に出すだけにしない。
- 色、アイコン、写真が見えなくても意味が分かる。写真の代替文にAI推定の種名を断定して入れない。
- 長い地名、題名、理由、多言語を実寸で確認する。省略時も主題や確認理由を読む手段を残す。
- 静的な画面案の確認は設計の視覚検証であり、認証・下書き永続化・本番での利用完了を証明しない。
