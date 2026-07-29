# ZUKAN クビアカツヤカミキリ見守り — Product Specification v2

- Status: second-review candidate / runtime blocked
- Date: 2026-07-29
- Strategy: `yamaki0102/ikimon-business-strategy#43`
- Parent architecture: `docs/spec/zukan-product-architecture/SPEC.md`
- Public service: `ZUKAN`
- Canonical path: `/kubiaka`
- Experience key: `kubiaka-watch`

## 0. Product statement

`クビアカツヤカミキリ見守り`は別サービスではない。

ZUKAN共通のAccount、Record、Media、Place、Rights、Reviewを使いながら、入口、投稿、private receipt、確認待ち、フィードバック、再訪、地域coverageをクビアカツヤカミキリ専用に見せる対象専用体験である。

利用者への約束:

> クビアカツヤカミキリかもしれない虫や木の変化を、写真1〜6枚で送れます。写真は先に保存され、実際に確認できた写真の範囲、分かったこと、分からなかったことを後から返します。

P0で保証しない:

- 即時同定
- 全件の人・専門家確認
- 生息不在の断定
- 緊急通報
- 行政・管理者への全件自動送信
- 受信・現地確認・対応SLA
- 分母のない地域の網羅率

## 1. Architecture boundary

### 1.1 Reuse

- Account / Auth / Session
- Record / Visit / Observation
- Media / Evidence asset
- Place / location privacy
- Taxon / Identification
- AI provenance
- Rights / Consent
- Review / Correction / Suppression
- Foundation v2 Survey / Detection / Coverage
- existing public-map aggregate snapshot
- existing invasive recipient / jurisdiction / delivery subsystem

### 1.2 Do not reuse by semantic abuse

- time-bounded Eventを恒常programとして扱う
- event participant tableを正本にする
- species privacyだけで未成年・自宅・学校privacyを解決する
- law statusやAI confidenceから自動deliveryを生成する
- AI、人、専門家、受信先回答を一つの`confirmed`へ畳む

### 1.3 Kubiaka-specific contracts

- evidence role vocabulary
- submitted / assessed asset accounting
- photo-scope feedback
- target protocol
- area coverage projection rules
- reviewer queue priorities

P0では汎用`focused_experience_*` DBプラットフォームを完成させない。TypeScript registryとRecord-context linkの骨格だけを共有し、クビアカ固有部分は`kubiaka_*`または既存Biodiversity / Foundationへ置く。

## 2. Routing interlock — prerequisite

クビアカRecordをruntimeへ接続する前に、既存invasive auto-routingをdeny-by-defaultにする。

experience linkを持つOccurrenceは、experience routing gate、approved recipient、受信同意、human Review、operator send approval、allowlisted fields、idempotencyが揃うまで既存alert / deliveryから除外する。

Record保存、private receipt、private feedbackは継続できる。外部送信だけをfail closedにする。

このinterlockのfailing→passing testが無い限り、P0 runtime実装へ進まない。

## 3. Canonical route map

### 3.1 Release Bまで

| Route | Auth | Purpose |
|---|---|---|
| `/kubiaka` | public | 対象理解・投稿開始 |
| `/kubiaka/record` | public/session | 共通composerによる1〜6枚投稿 |
| `/kubiaka/receipt/:receiptId` | scoped guest/owner | private受付・結果 |
| `/kubiaka/me` | session | 専用Home |
| `/kubiaka/me/records` | session | 自分のクビアカ記録 |
| `/kubiaka/records/:recordId` | owner | 専用Record detail |
| `/kubiaka/guide` | public | 見分け方・撮り方 |
| `/kubiaka/about` | public | AI・人・共有・privacy |
| `/kubiaka/faq` | public | FAQ |

### 3.2 Release C/D

| Route | Auth | Purpose |
|---|---|---|
| `/kubiaka/places/:placeId` | owner | 同じPlaceの比較 |
| `/kubiaka/area` | public | privacy-safe coverage |
| `/ops/kubiaka/inbox` | operator | Review queue |
| `/ops/kubiaka/records/:recordId` | operator | Evidence / Feedback編集 |
| `/ops/kubiaka/coverage` | operator | Coverage監査 |

### 3.3 P0から除外

- `/kubiaka/settings`
- `/ops/kubiaka/config`
- `/ops/kubiaka/cases`
- external routing UI

## 4. Dedicated shell

ZUKANの正式ロゴを維持し、別ブランド化しない。

Header:

```text
ZUKAN | クビアカツヤカミキリ見守り             ヘルプ / ログイン・アカウント
```

Mobile:

```text
ホーム | 記録 | [写真を送る] | 地域 | 見分け方
```

- `写真を送る`は独立primary action
- 専用画面ではglobal record launcherを隠す
- task surfaceではglobal footerを隠す
- menuに`ZUKANへ戻る`を常設
- language、accessibility、privacy、account controlは維持

Guestの`記録`は端末全履歴を自動表示しない。既定は直近receiptのみ。

## 5. Guest, receipt, shared device

### 5.1 Credential

first mutation時にexperience-scoped CSPRNG credentialを発行する。

- serverはdigestのみ保存
- `__Host-` HttpOnly / Secure / SameSite cookie
- experience scope
- replay / stale cookie / logout test必須

### 5.2 Private receipt

receipt URLだけでは閲覧できない。scoped guest credentialまたはowner sessionを必要とする。

表示可能:

- 保存状態
- submitted media
- safe location label
- Assessment状態
- FeedbackEdition
- 追加写真依頼
- claim action

表示禁止:

- exact coordinates / full address
- contributor identity
- private note
- reviewer-only comment
- recipient routing detail
- credential / token

`no-store`、link preview-safe metadata、enumeration resistanceを必須とする。

### 5.3 Shared device viewing

既定:

- 投稿後は直近receiptだけ表示
- 過去receipt一覧は明示操作後だけ
- `別の人が使う` / `この端末の記録を閉じる`を常設
- guest Aのreceiptをguest Bへ表示しない

### 5.4 Claim

receipt単位claimを既定とする。全件claimは明示確認がある場合だけ。

transaction:

1. guest receipt / participantをlock
2. authenticated userへownershipを付与
3. existing account participantがあればmerge
4. guest mutation accessを失効
5. original createdAt / provenanceを維持
6. Record / assetを複製しない
7. partial failureはrollback

## 6. Record context and link recovery

投稿は既存composerをforkしない。

Recordへquery stringだけでなくdurable context linkを持つ。

```text
experience_key = kubiaka-watch
experience_version
entrypoint
protocol_profile
protocol_version
participant_ref
created_at
```

Record保存成功後にlink保存が失敗した場合を表現するため、`link_pending`を持つ。

実装は次のいずれか:

- Record保存transaction内でlink / outboxを書き込む
- durable outboxからidempotentにlink / receiptを回復

利用者にはRecord消失と表示しない。receipt復旧中として安全に表示する。

## 7. Orthogonal state model

単一workflow enumは禁止する。

### 7.1 Persistence

```text
draft
saving
link_pending
saved
save_failed
suppressed
erased_reference_only
```

### 7.2 Assessment

```text
not_started
queued
running
completed
failed
stale
cancelled
```

### 7.3 Feedback

```text
none
draft
published
superseded
withheld
```

### 7.4 Action

```text
not_applicable
candidate
operator_approved
sent
acknowledged
failed
expired
follow_up_due
closed
```

### 7.5 Review authority

stateから推論しない。FeedbackEdition / Review attributeとして持つ。

```text
automated
trained_reviewer
accountable_specialist
approved_recipient
```

必須contract scenarios:

- `saved + assessment.failed + feedback.none`
- `saved + assessment.stale + feedback.published`
- `saved + assessment.running + feedback.published`
- `saved + feedback.published + action.sent`
- `saved + action.follow_up_due`
- `link_pending + assessment.not_started`

Contributor projectionは4軸・authority・unread / more-evidenceからpure functionで一つを返す。

`case_opened`だけで`専門確認中`と表示してはならない。

## 8. Evidence and photo accounting

Normal post remains free-form. 写真1枚にもRecord価値がある。

Evidence roles:

```text
surroundings
whole_tree
branches
trunk
base
adult_insect
adult_detail
frass
exit_hole
damage_sign
other_context
```

各item:

```text
role
visibility = visible | partial | not_visible | not_applicable | unknown
source_asset_ids[]
confidence
assessor = automated | reviewer
limitations[]
```

枚数:

- `submittedPhotoCount`: 保存された提出asset数
- `assessedPhotoCount`: Assessmentが実際に参照したdistinct asset数

`assessedPhotoCount`はcaller数字でなくasset IDsから導出する。

全件未確認時のコピー:

> 6枚のうち3枚を確認しました。

`6枚を確認しました`とは表示しない。

Usabilityは排他enumにしない。

```text
isPhotoRecord
isScreenable
isSurveyUsable
isRepeatComparable
hasInsufficientEvidence
```

## 9. Survey non-detection

クビアカcoverage itemは写真範囲の投影であり、scientific non-detectionの正本ではない。

`survey_non_detection`はFoundation v2へ一本化する。

Required:

- SurveyEvent ID
- protocol ID / version
- method
- effort
- startedAt / endedAt
- subject scope
- DetectionOutcome=`not_detected`
- required evidence roles=`visible`

`partial`だけではsurvey usableにしない。

`protocolSatisfied: true`のcaller booleanだけでは成立させない。

自由投稿で許される表現:

> 今回確認した写真の範囲では、明確な手がかりは確認されませんでした。

## 10. FeedbackEdition

Feedbackはversioned immutable edition。元Record・Assessment・過去Feedbackを上書きしない。

表示順:

1. 提出枚数 / 実確認枚数
2. 確認できた写真・範囲
3. 今回分かったこと
4. 今回分からなかったこと
5. 前回との違い
6. 次の任意選択
7. 確認主体
8. 共有・対応状況（実在時のみ）

次の選択:

- 写真を追加する
- 同じ場所でもう一度撮る
- 別の場所を記録する
- 専門確認を待つ
- 今回はここで終える

自動feedbackを基本とする。人Review対象:

- adult / frass / exit-hole candidate
- low confidence / conflicting evidence
- external routing candidate
- random no-clear-sign audit
- appeal / correction

capacity超過時もRecord保存・receiptを止めない。Assessment / Review / routingを縮退する。

## 11. Page specifications and final copy

### 11.1 `/kubiaka`

Wire:

```text
[seasonal strip]
[focused header]
[hero / H1 / lead / primary CTA / trust]
[adult and frass cues]
[wide + detail photo guide]
[after-submit flow]
[feedback example]
[coverage preview]
[safety / privacy]
```

H1:

> クビアカツヤカミキリを見つけたかも？

Lead:

> 赤い首の黒い虫や、サクラ・ウメなどの根元にある木くずを見つけたら、写真を送ってください。写真は1〜6枚。木全体と気になる部分の両方があると、より詳しく確認できます。

CTA:

> 写真を送る

Trust:

> ログイン不要。写真は先に保存され、確認結果は後から届きます。

Safety:

> 虫には触れず、生きたまま持ち運ばないでください。私有地や車道など、危険な場所には入らないでください。

### 11.2 `/kubiaka/record`

Title:

> 写真を送る

Guide:

> 最大6枚まで送れます。木全体、根元、幹、虫や木くずなど、撮れるものを自由に選んでください。

Save CTA:

> この写真を保存する

Save reassurance:

> 写真を先に保存します。確認は保存後に行います。

### 11.3 `/kubiaka/receipt/:receiptId`

Saved:

> 写真を保存しました

> 確認結果はこのページに届きます。このまま閉じても記録は残ります。

Link pending:

> 写真は保存されています。クビアカ見守りへの反映を復旧しています。

Checking:

> 写真から確認できる範囲を調べています。

Claim:

> ログインすると、この記録を自分のクビアカ記録へ引き継げます。

### 11.4 `/kubiaka/me`

H1:

> クビアカ見守り

One continuation priority:

1. unread feedback
2. more evidence request
3. Assessment running
4. revisit due
5. first record

Sections:

- 最近の記録
- 同じ場所の変化
- 記録した場所
- 地域の見守り状況

### 11.5 `/kubiaka/me/records`

H1:

> 自分のクビアカ記録

Filters:

- すべて
- 結果あり
- 確認中
- 写真追加
- 共有・対応

Empty:

> まだ記録はありません。気になったものを1枚から送れます。

### 11.6 `/kubiaka/records/:recordId`

Order:

1. media 1–6
2. persistence status
3. FeedbackEdition
4. assessed coverage
5. Place comparison
6. next choices
7. action state
8. provenance / rights / place disclosure

No-clear-sign example:

> 5枚のうち5枚を確認しました。木全体、幹、根元が写っています。今回確認した写真の範囲では、成虫、フラス、脱出孔と考えられる明確な特徴は確認されませんでした。枝の上部と木の反対側は確認できていません。

Partial assessment example:

> 6枚のうち3枚を確認しました。残りの写真はまだ確認中です。

Candidate example:

> 根元付近にフラスの可能性がある部分があります。写真だけでは確定できないため、追加確認を進めています。

### 11.7 `/kubiaka/guide`

H1:

> 見分け方と撮り方

Lead:

> 分からなくても投稿できます。確認に役立つ特徴と写真を紹介します。

Sections:

- 成虫
- フラス
- 脱出孔・木の変化
- 似た虫
- 木全体と細部の撮り方
- 季節
- 安全
- Source / credits

### 11.8 `/kubiaka/about`

Key copy:

> ZUKANは、投稿写真をすぐ公開したり、AIだけで事実を確定したりしません。原写真、確認結果、公開範囲、共有状態を分けて管理します。

### 11.9 `/kubiaka/faq`

`クビアカか分かりません。`

> 分からなくても投稿できます。虫だけでなく、木全体、根元、木くずも役立ちます。

`見つからなかった写真にも意味がありますか。`

> あります。写真で確認できた範囲と確認できなかった範囲を分け、その場所・時期のRecordとして残します。

`投稿すると行政へ送られますか。`

> すべてを自動送信しません。確認、受信同意、operator承認等の条件が揃い、共有が必要な場合だけ登録済みの確認先へ共有します。

## 12. Place comparison

Same-Place候補はAIが提案できるが、自動mergeしない。

Copy:

> 同じ木かどうかを確認中です。位置と写真の特徴が近い記録を並べています。

禁止:

> 前はいなかった

許容:

> 前回の写真では同じ特徴は確認されず、今回初めて候補が写りました。

## 13. Public area map

詳細は`AREA_COVERAGE.md`。

Public states:

```text
no_public_data
more_observation_useful
observation_progressing
current_target_met
revisit_due
```

空セルとprivacy抑制セルを公開上区別しない。生日時・Record IDs・exact coordinates・suppression reasonを公開しない。

## 14. Security and privacy blocking tests

- guest A/B receipt viewing isolation
- account A/B isolation
- stale cookie / replay / logout
- receipt enumeration
- link preview has no private metadata
- record save success + link failure → `link_pending`
- claim partial failure rollback
- auto-routing interlock deny
- one participant with many Records remains suppressed
- empty and suppressed cells are publicly indistinguishable
- adjacent-cell differencing
- school/home/private land default deny
- submitted / assessed photo mismatch copy
- `partial` cannot create survey non-detection
- workflow cannot infer specialist authority
- suppression propagates to receipt, feedback, map snapshot

## 15. Accessibility and visual QA

Viewports:

- 320, 375, 390, 412
- 768, 1024
- 1280, 1440, 1536

Required:

- 200% text
- keyboard
- screen reader
- no horizontal overflow
- map/list parity
- no color-only status
- no fixed CTA overlap
- 1–6 photo retry
- login return and focus return

## 16. Stop conditions

Runtime / migrationへ進まない条件:

- strategy #42/#43と本SPECの矛盾
- routing interlock未実装
- single workflow enumが残る
- `link_pending` / outbox契約なし
- submitted / assessed数の未分離
- Foundation v2を通らないsurvey non-detection
- `privacy_suppressed`のpublic露出
- participant thresholdなし
- degenerate target fail-open
- shared-device viewing isolationなし
- authorityをworkflowから推論
- second architecture review未完了
