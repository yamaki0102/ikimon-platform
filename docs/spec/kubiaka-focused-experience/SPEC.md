# ZUKAN クビアカツヤカミキリ Focused Experience — Product Specification

- Status: proposed active contract
- Date: 2026-07-29
- Strategy: `yamaki0102/ikimon-business-strategy#43`
- Parent product architecture: `docs/spec/zukan-product-architecture/SPEC.md`
- Current runtime: `platform_v2/`
- Public service name: `ZUKAN`
- Canonical path: `/kubiaka`
- Experience key: `kubiaka-watch`
- Taxon: `Aromia bungii`

## 0. Product statement

`クビアカツヤカミキリ見守り`は、別サービスではない。

ZUKAN共通の写真・Record・Place・AI・Review・権利・Account基盤を使いながら、入口、投稿、受付、確認待ち、フィードバック、再訪、地域状況をクビアカツヤカミキリ専用に見せる最初のFocused Experienceである。

利用者向けの約束:

> クビアカツヤカミキリかもしれない虫や木の変化を、写真1〜6枚で送れます。写真はすぐ保存され、確認結果は後から届きます。

P0で保証しないこと:

- 即時同定
- 専門家による全件確認
- 緊急通報
- 行政等への全件自動送信
- 写真に写らないことによる不在断定
- 受領・対応SLA

## 1. Experience architecture

```text
ZUKAN common runtime
├─ Account / Auth / Session
├─ Record / Visit / Observation
├─ Evidence assets / Media
├─ Place / Location privacy
├─ Taxon / Identification
├─ AI provenance
├─ Rights / Consent / Public projection
└─ Review / Correction / Suppression

Kubiaka Focused Experience
├─ Experience registry entry
├─ Dedicated shell and navigation
├─ Public landing and guide
├─ Shared composer with experience context
├─ Guest private receipt
├─ Member workspace
├─ Kubiaka evidence coverage
├─ Assessment and feedback editions
├─ Same-Place timeline
├─ Area coverage projection
└─ Operator review and routing
```

No duplicate image, duplicate Observation, duplicate Place, or separate account store is allowed.

## 2. Route map

### 2.1 Public and guest

| Route | Auth | Purpose |
|---|---|---|
| `/kubiaka` | public | acquisition, explanation, start |
| `/kubiaka/record` | public/session | shared 1–6 photo composer |
| `/kubiaka/receipt/:receiptId` | scoped guest/session | private saved state and feedback |
| `/kubiaka/guide` | public | identification and photo guidance |
| `/kubiaka/area` | public | privacy-safe monitoring coverage |
| `/kubiaka/about` | public | purpose, data use, governance |
| `/kubiaka/faq` | public | questions and safety |

### 2.2 Member

| Route | Auth | Purpose |
|---|---|---|
| `/kubiaka/me` | session | dedicated continuation Home |
| `/kubiaka/me/records` | session | all owned Kubiaka records |
| `/kubiaka/records/:recordId` | owner/session | dedicated Record detail |
| `/kubiaka/places/:placeId` | owner/session | private same-Place timeline |
| `/kubiaka/settings` | session | notification and visibility preferences |

### 2.3 Operations

| Route | Auth | Purpose |
|---|---|---|
| `/ops/kubiaka/inbox` | operator | triage and review queue |
| `/ops/kubiaka/records/:recordId` | operator | evidence, assessment, feedback editor |
| `/ops/kubiaka/cases` | operator | escalated Case and follow-up |
| `/ops/kubiaka/coverage` | operator | coverage, quality, audit |
| `/ops/kubiaka/config` | admin | protocol, recipients, seasonal content |

## 3. Dedicated shell

The dedicated shell preserves the official ZUKAN logo. It is not a second brand.

### 3.1 Header

Left:

- ZUKAN horizontal logo
- separator
- `クビアカツヤカミキリ見守り`

Right:

- help
- account or login
- overflow menu

Overflow:

- この取り組みについて
- 安全とプライバシー
- ZUKANへ戻る

### 3.2 Mobile navigation

```text
ホーム | 記録 | [写真を送る] | 地域 | 見分け方
```

`写真を送る` is a separate primary action, not an active navigation tab.

Guest `記録` resolves to guest receipt history on the current device when available. Member `記録` resolves to `/kubiaka/me/records`.

### 3.3 Chrome rules

- use `immersive` or an equivalent dedicated layout
- suppress the global record launcher inside the experience
- suppress the global footer on task surfaces
- do not display the full ZUKAN browse navigation
- always expose `ZUKANへ戻る` through the menu
- preserve language, accessibility, privacy, and account controls

## 4. Identity, guest access, and ownership

### 4.1 Guest access

A guest can submit without choosing between sign-in and guest mode.

On first experience mutation:

1. create an experience-scoped cryptographic credential
2. store only its digest server-side
3. use a secure `__Host-` HttpOnly cookie
4. bind the resulting participant identity to `kubiaka-watch`
5. create a private receipt after Record save

The existing event-scoped guest credential and transactional promotion implementation is the reference, but the new contract must not model a perpetual program as a fake event.

### 4.2 Private receipt

A receipt is not a public Record URL.

It may show:

- saved state
- safe location label
- submitted media
- assessment status
- feedback editions
- request for more evidence
- account claim action

It must not expose through unauthenticated metadata or link previews:

- exact coordinates
- full address
- contributor identity
- private note
- recipient routing details
- reviewer-only comments

### 4.3 Guest to account claim

Claim is one transaction:

- lock scoped guest identity
- attach authenticated user attribution
- migrate receipt ownership
- merge an existing member participant if necessary
- invalidate guest mutation access
- preserve original createdAt and evidence provenance
- do not duplicate the Record or assets

Cross-user, guest-to-guest, stale-cookie, replay, logout, and partial-failure tests are blocking.

### 4.4 Minor and shared-device defaults

Do not ask for or publicly expose:

- real name
- school name
- class or grade
- age or birthday
- face
- home address
- exact movement path

Unknown sensitivity defaults to private. Home-nearby, school/children, private land, rare species, and sensitive place are separate release contexts.

## 5. Record context

Every Record entered through this experience carries a durable context link.

Required fields:

```text
experience_key = kubiaka-watch
experience_version
entrypoint
protocol_profile
protocol_version
participant_kind = guest | account
created_at
```

Optional fields:

```text
seasonal_module
partner_code
school_or_group_code
campaign_source
return_to
```

The context is not stored only in a query string or analytics payload.

## 6. Evidence coverage

Normal posting remains free-form. Coverage is evaluated after save.

Controlled values:

- `surroundings`
- `whole_tree`
- `branches`
- `trunk`
- `base`
- `adult_insect`
- `adult_detail`
- `frass`
- `exit_hole`
- `damage_sign`
- `other_context`

For each value:

```text
status = visible | partial | not_visible | not_applicable | unknown
source_asset_ids[]
confidence
assessor = ai | reviewer
limitations[]
```

Record usability:

- `photo_record`
- `screenable_record`
- `survey_usable`
- `repeat_comparable`
- `insufficient_evidence`

`survey_non_detection` requires protocol-specific coverage and reported effort. A free-form photo upload does not automatically qualify.

## 7. Assessment, feedback, and Case separation

### 7.1 Assessment

Assessment reads stable Record and evidence references.

Candidate findings:

- adult candidate
- frass candidate
- exit-hole candidate
- tree damage candidate
- no clear sign in visible scope
- insufficient evidence
- unrelated subject

Assessment must retain:

- model or rule version
- inputs
- candidate confidence
- contradictory evidence
- missing evidence
- human override
- timestamp

### 7.2 Review

Review authority levels:

- automated assessment only
- trained reviewer
- accountable specialist
- approved recipient response

Do not collapse these into one `confirmed` flag.

### 7.3 Feedback edition

Feedback is a versioned projection for the contributor.

Required sections:

1. `確認できた写真`
2. `今回わかったこと`
3. `今回わからなかったこと`
4. `前回との違い`
5. `次に撮るなら`
6. `確認状態`
7. `共有・対応状況` when applicable

Publishing a new edition does not alter the original Record or delete earlier feedback.

### 7.4 Case

Open a Case only when action is needed. A Case references the Record, Assessment, and Evidence; it does not own or copy them.

Case results return as new Records.

## 8. State model

### 8.1 Internal

```text
saved
assessment_queued
assessment_in_progress
feedback_draft
feedback_ready
more_evidence_requested
specialist_review_requested
case_opened
recipient_shared
recipient_acknowledged
follow_up_due
closed
```

### 8.2 Contributor-facing

```text
受付済み
確認中
結果が届きました
追加写真があると詳しく確認できます
専門確認中
確認先へ共有しました
確認先が受け取りました
経過を見守っています
```

`recipient_shared` and `recipient_acknowledged` are distinct.

## 9. Page specification

# 9.1 `/kubiaka` — Public landing

## Purpose

A visitor understands what to photograph, why to submit, what happens after submission, and how safety/privacy are handled, then starts in one action.

## Wire

```text
[seasonal status strip]
[ZUKAN + experience header]

[hero image / species and tree context]
[H1]
[lead]
[primary CTA]
[trust line]

[what to look for: adult / frass]
[how to photograph: wide + detail]
[what happens after sending]
[feedback example]
[monitoring coverage preview]
[safety]
[about / partners]
[compact footer]
```

## Final copy

Seasonal strip, summer:

> 今は成虫と木の根元の手がかりを確認しやすい時期です。

H1:

> クビアカツヤカミキリを見つけたかも？

Lead:

> 赤い首の黒い虫や、サクラ・ウメなどの根元にある木くずを見つけたら、写真を送ってください。写真は1〜6枚。木全体と気になる部分の両方があると、より詳しく確認できます。

Primary CTA:

> 写真を送る

Trust line:

> ログイン不要。写真はすぐ保存され、確認結果は後から届きます。

Section title:

> こんな手がかりを探しています

Adult:

> 黒い体と、赤く見える首の部分。触角が長いカミキリムシです。

Frass:

> 木の根元や幹から出る、木くずとふんが混じったようなものです。

Photo guidance:

> 広い写真と近い写真、どちらも大切です。

Cards:

- 木と周りが分かる写真
- 木全体
- 根元や幹
- 虫や木くずの拡大

After sending:

> 写真は最初に保存します。その後、写っている範囲、手がかり、まだ分からない部分を確認し、結果を返します。

Non-detection:

> 明確な手がかりが写っていない写真も、その場所・その時期の記録になります。

Safety:

> 虫には触れず、生きたまま持ち運ばないでください。私有地や車道など、危険な場所には入らないでください。

## Rules

- one dominant CTA above the fold
- no sign-in interstitial
- no discovery leaderboard
- no unverified detection pins
- show the actual feedback model, not a vague AI promise

# 9.2 `/kubiaka/record` — Shared composer

## Purpose

Save one Record with 1–6 photos using the current ZUKAN composer while maintaining the dedicated context.

## Wire

```text
[compact dedicated header]
[title + one-line guidance]
[photo grid 1–6]
[add photo]
[time and place summary]
[optional note]
[progressive disclosure: detail / visibility]
[save button]
[guest/member reassurance]
```

## Final copy

Title:

> 写真を送る

Guidance:

> 最大6枚まで送れます。木全体と気になる部分の両方があると、より詳しく確認できます。

Photo empty state:

> 虫、木全体、根元、幹、木くずなど、気になったものから選んでください。

Optional note label:

> 気になったこと

Placeholder:

> 例：木の下に木くずがあった／前に見たときと様子が違う

Guest line:

> ログインしなくても送れます。ログインすると、確認結果や過去の記録をまとめて見られます。

Save CTA:

> この写真を送る

Saving:

> 写真を保存しています。この画面を閉じないでください。

Saved:

> 写真を保存しました。

## Rules

- reuse current upload, draft, retry, media validation, EXIF, location privacy
- save before AI completion
- retain draft after recoverable failure
- do not require all six photo roles
- hide global launcher
- preserve return path through login

# 9.3 `/kubiaka/receipt/:receiptId` — Guest receipt

## Purpose

Give a guest a durable private return point without forcing account creation.

## Wire

```text
[status]
[submitted photo strip]
[safe place + date]
[current feedback or waiting state]
[claim account CTA]
[receipt recovery guidance]
[next actions]
```

## Final copy

Saved title:

> 受け付けました

Saved body:

> 写真は保存されています。写っている範囲を確認し、分かったことをこのページに返します。

Waiting:

> 確認しています

Waiting body:

> すぐに結果を断定せず、写真ごとの手がかりと確認できない部分を分けて見ています。

Claim CTA:

> ログインして自分の記録に残す

Claim helper:

> ログイン後も、この記録と確認結果を同じ画面で見られます。

No forced account modal is allowed before the receipt is fully visible.

# 9.4 `/kubiaka/me` — Member Home

## Purpose

A member continues from the most important current state without seeing the common ZUKAN Home.

## Priority hero

1. unread feedback
2. request for more evidence
3. assessment in progress
4. comparable Place revisit
5. first submission

## Wire

```text
[dedicated header]
[one priority continuation card]
[primary action]

[recent records]
[same Place changes]
[my recorded places]
[area monitoring status]
```

## Final copy

Page title:

> クビアカ見守り記録

Unread feedback eyebrow:

> 確認結果が届きました

Pending eyebrow:

> 写真を確認しています

More evidence eyebrow:

> もう少し分かるかもしれません

First state:

> 最初の写真を送る

First body:

> 気になった虫や木の変化を、1枚から残せます。

Section titles:

- 最近の記録
- 同じ場所の変化
- 記録した場所
- 地域の調査状況

## Rules

- one primary continuation only
- no generic Program, Quest, organization KPI, or unrelated records
- no discovery ranking
- do not repeat the same Record across sections
- unknown-sensitive Records stay out of hero media

# 9.5 `/kubiaka/me/records` — Member record list

## Wire

```text
[title]
[filters: all / result ready / checking / more photos / shared]
[photo-first compact cards]
[date, safe place, state]
[load more]
```

Title:

> 自分のクビアカ記録

Empty:

> まだ記録はありません。気になったものを1枚から送れます。

Card states must use contributor-facing vocabulary only.

# 9.6 `/kubiaka/records/:recordId` — Dedicated Record detail

## Order

1. media 1–6
2. current state
3. feedback edition
4. evidence coverage
5. previous comparison
6. next choices
7. sharing and response
8. detailed provenance, rights, time, place

## Wire

```text
[photo viewer]
[state banner]
[feedback]
  [確認できた写真]
  [今回わかったこと]
  [今回わからなかったこと]
  [前回との違い]
  [次に撮るなら]
[coverage visual]
[Place timeline]
[next actions]
[details disclosure]
```

## Feedback examples

No clear sign:

> 写真5枚を確認しました。木全体、幹、根元の状態を確認できます。今回の写真の範囲では、成虫、フラス、脱出孔と考えられる明確な特徴は確認されませんでした。枝の上部と木の反対側は確認できていません。

Candidate:

> 3枚目の根元付近に、フラスの可能性がある部分があります。写真だけでは確定できないため、追加確認を進めています。

Insufficient:

> 木全体は確認できました。根元が写っていないため、フラスの有無までは確認できませんでした。

Next choices:

- 同じ場所でもう一度撮る
- 写真を追加する
- 別の場所を記録する
- 今回はここで終える

`今回はここで終える` is a valid non-dark-pattern action.

# 9.7 `/kubiaka/places/:placeId` — Same-Place timeline

## Purpose

Show temporal change without claiming that every visit photographed the same individual tree.

## Wire

```text
[private safe Place title]
[identity confidence]
[timeline]
[side-by-side comparison]
[coverage changes]
[next revisit suggestion]
```

Copy:

> この場所の記録

Identity warning:

> 同じ木かどうかを確認中です。位置と写真の特徴が近い記録を並べています。

Comparison:

> 前回の写真では確認されず、今回初めて候補が写りました。

Do not say `前はいなかった` unless a qualified survey supports that claim.

# 9.8 `/kubiaka/area` — Public area monitoring

## Default layers

1. monitoring coverage
2. repeat coverage
3. feedback status
4. confirmed or approved aggregate findings

## Wire

```text
[title + explanation]
[privacy-safe aggregate map]
[layer controls]
[summary counters]
[what the map does not show]
[record CTA]
```

Title:

> 地域の見守り状況

Lead:

> 発見地点だけでなく、どこで写真が残り、どこを繰り返し確認できたかを表示します。

Privacy notice:

> 子ども、自宅、学校、私有地などを守るため、正確な撮影地点は表示しません。

Allowed counters:

- records
- photos
- aggregate areas with records
- repeat areas
- feedback-ready records
- reviewed candidates

A percentage is shown only when its denominator is explicit and trustworthy.

# 9.9 `/kubiaka/guide` — Identification and photo guide

## Sections

- adult characteristics
- frass
- exit holes and tree changes
- similar insects and lookalikes
- photo examples
- seasonal hints
- safety
- official sources and credits

Title:

> 見分け方と撮り方

Lead:

> 分からなくても投稿できます。見分けるときに役立つ特徴と、確認しやすい写真を紹介します。

Photo guidance:

> 近い写真だけでなく、木全体や根元が分かる写真もあると、状況を判断しやすくなります。

Use only rights-cleared images with required attribution. Do not copy restricted manual images.

# 9.10 `/kubiaka/about` — Purpose and governance

## Sections

- why this exists
- what is saved
- how AI and people are used
- what may be shared
- public location policy
- correction and deletion
- partner and recipient policy
- research and publication boundary

Key copy:

> ZUKANは、投稿された写真をすぐに公開したり、AIだけで事実を確定したりしません。原写真、確認結果、公開範囲、共有状態を分けて管理します。

# 9.11 `/kubiaka/faq`

Required questions:

### クビアカツヤカミキリか分かりません。

> 分からなくても投稿できます。虫の写真だけでなく、木全体、根元、木くずなども送ってください。

### 見つからなかった写真にも意味がありますか。

> あります。写真の範囲で確認できたことと確認できなかったことを分け、その場所・時期の記録として残します。

### すぐに結果が分かりますか。

> 写真はすぐ保存されます。確認結果は後から届きます。写真だけで判断できない場合は、追加写真や専門確認が必要になることがあります。

### 投稿すると行政へ送られますか。

> すべての投稿を自動送信するわけではありません。対象地域、確認状態、受信同意などの条件がそろい、共有が必要な場合に限って登録済みの確認先へ共有します。

### 捕まえた方がよいですか。

> 生きたまま持ち運ばず、地域の公式案内に従ってください。危険な場所や私有地には入らないでください。

### 子どもだけで使えますか。

> 写真の投稿はできますが、道路、私有地、高い場所などでは無理をせず、できるだけ大人と一緒に観察してください。本名や学校名を公開する必要はありません。

# 9.12 `/kubiaka/settings`

Controls:

- feedback notifications
- more-evidence request notifications
- follow-up reminders
- default visibility
- exact location owner display
- claimed guest records
- leave focused experience without deleting Records

No setting may imply that public visibility changes the canonical or private original Record.

# 9.13 `/ops/kubiaka/inbox`

## Queue groups

- potential adult
- potential frass / exit hole
- insufficient evidence
- feedback draft ready
- specialist escalation
- routing candidate
- overdue follow-up

## Filters

- area
- age of queue item
- evidence coverage
- AI confidence
- reviewer state
- sensitivity
- recipient availability

No raw exact location is shown until operator authorization and task need are satisfied.

# 9.14 `/ops/kubiaka/records/:recordId`

## Workbench order

1. sensitivity and authority gate
2. original evidence
3. evidence coverage
4. AI candidates and contradictions
5. previous Place records
6. feedback editor
7. specialist escalation
8. routing decision
9. immutable audit

Reviewer actions:

- accept assessment
- edit feedback
- request more evidence
- reject Kubiaka candidate
- request specialist review
- open Case
- propose recipient sharing

No single button may both confirm a biological claim and send externally.

# 9.15 `/ops/kubiaka/cases`

Show:

- Case state
- accountable owner
- recipient
- sent / acknowledged distinction
- due date
- follow-up
- result Record status

Do not expose Case data in public or ordinary contributor Views unless explicitly projected.

# 9.16 `/ops/kubiaka/coverage`

Show:

- Record count
- media count
- evidence coverage distribution
- feedback turnaround distribution
- repeat Place rate
- survey-usable rate
- reviewed positive candidates
- random audit of no-clear-sign assessments
- false-positive / false-negative evidence
- denominator quality

Do not label casual photo coverage as complete regional survey coverage.

# 9.17 `/ops/kubiaka/config`

Managed config:

- experience status
- seasonal module
- protocol version
- feedback template version
- model / rule version allowlist
- approved recipients
- geographic scope
- recipient consent and expiry
- routing gates
- public aggregation precision
- retention and suppression policy

All config changes require audit history. Recipient consent expiry must fail closed.

## 10. Public content tone

Use:

- direct species name
- concrete objects: red neck, black insect, tree base, wood debris
- factual confirmation scope
- calm safety guidance
- clear delayed feedback promise

Avoid:

- `AIが判定します` as the sole value
- `地域を救おう`
- `君は名調査員`
- `絶対に見つけよう`
- discovery competition
- fear-based copy
- responsibility pressure on children
- claims of expert or government confirmation without evidence

## 11. Seasonal modules

The route and product name never change.

Examples:

Spring:

> 木の根元に、新しい木くずが出ていないか確認しやすい時期です。

Summer:

> 成虫と木の根元の手がかりを確認しやすい時期です。

Autumn:

> 根元や幹の変化を残すと、夏の記録と比べられます。

Winter:

> 木全体や枝の状態を残すと、次の季節の基準になります。

Seasonal claims must reference an approved source and content version.

## 12. Notifications

P0:

- in-product receipt and member workspace
- no notification channel required for submission success

P1:

- optional account notification
- optional verified email notification
- no child-directed email collection by default

Notification content must not reveal exact location or candidate details in lock-screen previews.

## 13. Routing policy

A routing candidate requires:

- experience and taxon match
- supported geography
- approved and unexpired recipient consent
- allowed data purpose
- sensitivity review
- required Assessment or human Review
- explicit operation and idempotency key

States:

```text
not_applicable
candidate
approved_to_send
sent
acknowledged
rejected
failed
cancelled
```

`sent` is not `acknowledged`.

## 14. Data publication and external standards

The original system retains all photo-level scope and non-detection limitations.

Exports may map qualified survey Events and Occurrences to Darwin Core Event / Humboldt-compatible structures, including protocol and effort. Casual photo Records remain distinguishable from sampling-event data.

Do not make GBIF or any external index the sole store of non-detection or evidence coverage.

## 15. Analytics

Allowed funnel:

```text
landing_viewed
record_started
photo_selected
record_save_started
record_saved
receipt_viewed
account_claim_started
account_claim_succeeded
feedback_ready
feedback_viewed
more_evidence_opened
more_evidence_saved
place_revisited
```

Never send:

- exact coordinates
- image content or filename
- free-text note
- receipt token
- user or child identity
- recipient routing payload

Primary product metrics:

- save success
- feedback ready and read
- guest claim
- repeat Place
- comparable repeat
- assessment audit quality

## 16. Responsive and accessibility requirements

Required viewports:

- 320
- 375 / iPhone SE2 height
- 390
- 412
- 768
- 1024
- 1280
- 1440
- 1536

Requirements:

- no horizontal overflow
- 200% text zoom
- keyboard operation
- screen-reader semantic order
- visible focus
- reduced motion
- no color-only status
- large photo actions
- persistent save recovery
- touch targets suitable for children and older adults

## 17. Security and privacy blocking tests

- guest A cannot read guest B receipt
- user A cannot claim or read user B / guest B Record
- guest credential is CSPRNG and scoped
- stale guest cookie cannot mutate after claim
- claim is atomic and idempotent
- logout does not expose owned draft or receipt to the next guest
- link preview exposes no private data
- unknown sensitivity is private
- public area view contains no record-level location identifier
- school / child / home / private land release contexts fail closed
- exact location is owner/operator only
- feedback cannot claim a higher authority than its Review
- external routing requires approved recipient and consent

## 18. P0 acceptance criteria

P0 is complete only when:

1. `/kubiaka` has one dominant submission action and final copy
2. guest and member use the same 1–6 photo save path
3. save succeeds before AI completion
4. guest receives a private receipt
5. login returns to the dedicated experience
6. guest Record can be transactionally claimed without duplication
7. member sees `/kubiaka/me`, not common Home, after scoped actions
8. dedicated Record detail renders feedback sections and limitations
9. common ZUKAN ownership, rights, privacy, and suppression remain effective
10. no exact location appears in public or receipt metadata
11. security and ownership tests are green
12. mobile visual QA is green across the required viewports
13. no DB, runtime, or external routing change is declared complete without evidence

## 19. Non-goals

- separate account system
- separate image storage
- generic campaign builder before Kubiaka proves the contract
- mandatory six-photo protocol
- real-time guaranteed result
- all-record human review
- automatic government reporting for every submission
- public exact detection map
- discovery leaderboard
- summer-only campaign lifecycle
