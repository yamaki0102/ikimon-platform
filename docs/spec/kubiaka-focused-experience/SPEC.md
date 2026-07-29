# ZUKAN クビアカツヤカミキリ見守り — Product Specification

- Status: final active contract
- Date: 2026-07-29
- Strategy: `yamaki0102/ikimon-business-strategy/decisions/2026-07-29-zukan-kubiaka-focused-experience.md`
- Parent architecture: `docs/spec/zukan-product-architecture/SPEC.md`
- Public service: `ZUKAN`
- Canonical path: `/kubiaka`
- Experience key: `kubiaka-watch`

## 0. Product statement

`クビアカツヤカミキリ見守り`は別アプリではない。

ZUKAN共通のAccount、Record、Media、Place、Rights、AI provenance、Reviewを使いながら、入口、投稿、private receipt、確認待ち、feedback、再訪を対象専用に見せる。

初期方針:

> Receipt-first, Map-later。返事を完成させてから地図を描く。

利用者向けの約束:

> クビアカツヤカミキリかもしれない虫や木の変化を、写真1〜6枚で送れます。写真は先に保存され、確認できた範囲と分からないことを後から返します。

## 1. P0 scope

### 1.1 Public / guest routes

| Route | Auth | Purpose |
|---|---|---|
| `/kubiaka` | public | 専用入口、価値、安全、投稿開始 |
| `/kubiaka/record` | public/session | 共通composerを使った1〜6枚投稿 |
| `/kubiaka/receipt/:receiptId` | scoped guest/owner | private受付、状態、feedback |
| `/kubiaka/guide` | public | 見分け方、撮り方、安全 |
| `/kubiaka/about` | public | データ利用、AI、人Review、privacy |
| `/kubiaka/faq` | public | 投稿、結果、共有、安全 |

### 1.2 Member routes

| Route | Auth | Purpose |
|---|---|---|
| `/kubiaka/me` | session | 専用Home、次の一つ |
| `/kubiaka/me/records` | session | 本人のクビアカ記録 |
| `/kubiaka/records/:recordId` | owner/session | 専用Record detail |
| `/kubiaka/places/:placeId` | owner/session | 同じPlaceの季節・年次履歴 |

### 1.3 Operator routes

| Route | Auth | Purpose |
|---|---|---|
| `/ops/kubiaka/inbox` | operator | 確認待ち、候補、低品質、追加写真 |
| `/ops/kubiaka/records/:recordId` | operator | evidence、assessment、feedback編集 |

### 1.4 Deferred routes

初期版では実装・公開しない。

- `/kubiaka/area`
- `/kubiaka/settings`
- `/ops/kubiaka/cases`
- `/ops/kubiaka/coverage`
- `/ops/kubiaka/config`

空ページ、fixture map、将来機能を示唆する未完成UIを公開しない。

## 2. Reuse and ownership boundaries

### 2.1 Reuse unchanged where possible

- current auth session
- Record / Visit / Observation
- Media / Evidence asset
- Place / location privacy
- Rights / Consent
- AI provenance
- Review / Correction / Suppression
- current 1–6 photo composer
- current upload / retry / MIME / EXIF handling after verification
- current immersive shell primitives

### 2.2 Reuse only after modification

`recordPhotoFeedback`はそのまま再利用しない。

Current limitation:

- asset IDを入出力へ持たない
- 最大3枚で無言切り捨てする
- submitted枚数とassessed枚数を区別できない

Release Cでasset-aware contractへ変更する。

### 2.3 Kubiaka-specific contract

P0では以下をクビアカ固有として実装する。

- taxon scopeと同義名集合
- Record context link / outbox
- guest participant / receipt / claim
- evidence role vocabulary
- submitted / assessed asset accounting
- FeedbackEdition
- member read models
- operator queue

汎用Focused Experience DB platformは2例目まで作らない。

## 3. Taxon scope and all-alert interlock

### 3.1 Taxon scope

P0では、正規化した`Aromia bungii`と承認済み同義名集合を単一のsource contractとして持つ。

存在しないopaque taxon IDを前提にしない。

### 3.2 Dispatcher interlock

Kubiaka runtimeより先に、通知dispatcher入口でinterlockを実装する。

管理対象taxonで、routing gateが明示的に有効でない場合は、各分岐へ入る前に外部通知をdenyする。

対象:

- taxon subscription / user taxon match
- novelty
- researcher trigger
- invasive reporting
- webhook
- mail
- municipality / land-manager delivery

### 3.3 Link-independent

遮断をexperience linkの存在に依存させない。

Record linkが無い、`link_pending`、outbox retry中でも、管理対象taxonなら外部通知をdenyする。

`link_pending`中はKubiaka Assessmentとfeedback公開も開始しない。

## 4. Dedicated shell

Official ZUKAN brandingを維持し、第二ブランドを作らない。

Header:

- ZUKAN logo
- `クビアカツヤカミキリ見守り`
- help
- account / login
- `ZUKANへ戻る`

Mobile navigation:

```text
ホーム | 記録 | [写真を送る] | 見分け方
```

- `写真を送る`は独立した主行動
- global record launcherを専用体験内では隠す
- task surfaceではglobal footerを隠す
- language、accessibility、privacy、account controlsは維持する
- public area tabはP0に置かない

## 5. Guest, receipt, shared device, claim

### 5.1 Guest credential

初回mutation時にexperience-scoped credentialを作る。

- CSPRNG
- serverにはdigestのみ
- `__Host-` HttpOnly / Secure / SameSite cookie
- receipt IDだけでは閲覧不可

### 5.2 Default display on shared devices

- 投稿前: 過去guest receiptを表示しない
- 投稿後: 現在のbrowser sessionで作成した直近receiptだけ表示
- 別session・過去利用者のreceipt一覧を表示しない
- `別の人が使う`でcredentialをrotationし、現在session表示を閉じる

### 5.3 Private receipt

Receipt may show:

- saved / link state
- submitted media
- safe location label
- assessment state
- FeedbackEdition
- more-evidence request
- receipt-scoped account claim

Receipt must not expose:

- exact coordinates
- full address
- contributor identity
- private note
- recipient routing
- reviewer-only comments
- public metadata / link preview details

### 5.4 Claim

- receipt単位claim
- one transaction
- no duplicate Record / media
- preserve original timestamps and provenance
- invalidate guest mutation after success
- rollback on partial failure
- no implicit claim-all in P0

## 6. Record context and outbox

Every saved Record from this experience requires a durable context link.

Required context:

```text
experience_key = kubiaka-watch
entrypoint
participant_kind = guest | account
protocol_profile
protocol_version
seasonal_module optional
created_at
```

Record saveとlink作成を同一transactionにできない場合はdurable outboxを使用する。

Persistence axis:

```text
draft
saving
link_pending
ready
failed
suppressed
erased_reference_only
```

Rules:

- Record保存成功後にlinkが失敗してもRecordを失わない
- `link_pending`を利用者へ安全に表示する
- retryはidempotent
- link準備前にAssessment・feedback公開・外部通知を開始しない

## 7. Orthogonal state model

### Assessment

```text
not_started
queued
running
completed
failed
stale
cancelled
```

### Feedback

```text
none
draft
published
superseded
withheld
```

### Action

P0:

```text
not_applicable
```

Future:

```text
candidate
operator_approved
sent
acknowledged
failed
expired
follow_up_due
closed
```

### Review authority

FeedbackEdition attribute:

```text
automated
trained_reviewer
accountable_specialist
approved_recipient_response
```

Do not derive authority from Case or workflow position.

Required representable combinations:

- persistence ready + assessment failed + feedback none
- persistence link_pending + assessment not_started
- feedback published + assessment stale
- feedback published + specialist review in progress outside state axes
- action sent + acknowledgement pending
- feedback published + annual revisit due

## 8. Asset accounting

Store and distinguish:

```text
submittedAssetIds[]
assessedAssetIds[]
unassessedAssetIds[]
```

Counts are derived from unique asset IDs.

Copy rules:

- all assessed: `写真6枚を受け取り、6枚を確認しました。`
- partial: `写真6枚を受け取りました。今回は3枚を確認しました。`
- none: `写真6枚を受け取りました。確認はこれからです。`

A feedback finding may reference only `assessedAssetIds`.

If not all submitted assets are assessed, do not make a whole-Record no-clear-sign statement.

## 9. Evidence model

Kubiaka evidence roles:

- surroundings
- whole_tree
- branches
- trunk
- base
- adult_insect
- adult_detail
- frass
- exit_hole
- damage_sign
- other_context

For each item:

```text
role
visibility = visible | partial | not_visible | not_applicable | unknown
sourceAssetIds[]
confidence optional
assessor
limitations[]
```

Usability is represented by orthogonal booleans, not one exclusive enum.

```text
isPhotoRecord
isScreenable
isRepeatComparable
```

`isSurveyUsable` is not calculated in P0.

## 10. Non-detection boundary

P0 allows only photo-scope wording.

> 今回確認した写真の範囲では、明確な手がかりは確認されませんでした。

Forbidden in P0:

- this Place is absent
- this tree is safe
- survey non-detection
- current area target met

Foundation v2 SurveyEvent / DetectionOutcomeを使うのは、実在partner、versioned protocol、effort、対象範囲、review authorityが揃った後だけとする。

## 11. FeedbackEdition

Versioned、append-only projection for contributor.

Required sections:

1. `受け取った写真と確認した写真`
2. `確認できた範囲`
3. `今回わかったこと`
4. `今回わからなかったこと`
5. `前回との違い`
6. `次に撮るなら`
7. `確認状態`

P0では共有・対応状況セクションを表示しない。

Feedback publishing gate:

- persistence=`ready`
- assessed asset accounting valid
- finding references assessed assets only
- limitations rendered
- authority label correct
- sensitive content filtered
- higher authority not claimed

## 12. Page copy contract

### 12.1 `/kubiaka`

H1:

> クビアカツヤカミキリを見つけたかも？

Lead:

> 赤い首の黒い虫や、サクラ・ウメなどの根元にある木くずを見つけたら、写真を送ってください。写真は1〜6枚。木全体と気になる部分の両方があると、より詳しく確認できます。

CTA:

> 写真を送る

Trust line:

> ログイン不要。写真は先に保存し、確認できた範囲を後から返します。

Safety:

> 虫には触れず、生きたまま持ち運ばないでください。私有地や車道など、危険な場所には入らないでください。

### 12.2 `/kubiaka/record`

Title:

> 写真を送る

Guidance:

> 最大6枚まで送れます。木全体と気になる部分の両方があると、より詳しく確認できます。

Primary action:

> この内容で保存する

Saving:

> 写真を保存しています。この画面を閉じないでください。

Success:

> 写真を保存しました。確認結果はこの受付ページへ返します。

### 12.3 Receipt states

`link_pending`:

> 写真は保存されています。クビアカ見守り記録への反映を続けています。

Assessment queued/running:

> 写真を確認しています。保存は完了しています。

Assessment failed:

> 写真は保存されています。確認処理をもう一度行います。

Feedback ready:

> 確認結果が届きました。

### 12.4 `/kubiaka/me`

Title:

> クビアカ見守り記録

Continuation priority:

1. unread feedback
2. more evidence request
3. checking Record
4. annual / seasonal revisit
5. first submission

No ranking, streak, capture competition, generic quest, or unrelated ZUKAN content.

### 12.5 Record detail feedback example

> 写真6枚を受け取りました。今回は3枚を確認しました。確認した写真では木全体、幹、根元の状態が分かります。今回確認した写真の範囲では、成虫、フラス、脱出孔と考えられる明確な特徴は確認されませんでした。残りの写真と枝の上部はまだ確認できていません。

## 13. P0 non-goals

- public coverage map
- public detection pins
- public aggregate counts
- survey non-detection
- specialist SLA
- municipality routing
- external send
- generic Focused Experience database platform
- weekly engagement optimization

## 14. Accessibility and privacy

- 320 / 375 / 390 / 412 / 768 / 1024 / 1280 / 1440 / 1536
- text 200%
- keyboard navigation
- screen reader names and status
- no horizontal overflow
- no exact location in public or receipt metadata
- unknown sensitivity defaults private
- school / child / home-nearby / private land contexts are independent
- logout and shared-device isolation tests are blocking

## 15. Runtime release gates

### Gate 0

All-alert dispatcher interlock is merged and verified before Kubiaka runtime routes.

### Release B

Private contribution, receipt, claim, dedicated member workspace.

### Release C

Asset-aware feedback and operator inbox after closed pilot B1.

### Release D

Operator-only coverage after pilot evidence. Public map requires a separate future Decision.

### Release E

Approved routing requires explicit approval and real recipient contracts.

## 16. Blocking tests

- all managed-taxon notification paths denied at dispatcher entry
- interlock works with missing link and `link_pending`
- unmanaged taxon existing behavior preserved
- guest A/B isolation
- account A/B isolation
- pre-submit shared-device view empty
- only current-session receipt visible after submit
- stale cookie / replay / logout
- receipt enumeration denied
- Record save + link failure recovered through outbox
- claim partial failure rollback
- submitted / assessed asset mismatch copy correct
- finding cannot reference unassessed asset
- Assessment failed while Record remains saved
- published feedback while newer Assessment is stale
- no survey non-detection generated
- no external send
