# ZUKAN クビアカツヤカミキリ Focused Experience — Implementation Master Plan

- Status: review candidate / runtime implementation blocked pending external architecture review
- Date: 2026-07-29
- Product contract: `SPEC.md`
- Area coverage contract: `AREA_COVERAGE.md`
- Existing slice plan: `PLAN.md`
- Strategy dependency: `yamaki0102/ikimon-business-strategy#42` → `#43`
- Platform dependency: `yamaki0102/ikimon-platform#1489` → `#1491` → `#1492`
- Public service: `ZUKAN`
- Experience key: `kubiaka-watch`
- Canonical path: `/kubiaka`

## 0. Executive decision

本機能は、特設LP、投稿タグ、専用一覧の追加ではない。

ZUKAN共通のAccount、Record、Media、Place、AI provenance、Review、Rightsを再利用しながら、参加前、投稿、受付、確認待ち、フィードバック、再訪、地域coverage、運営確認までを、クビアカツヤカミキリ専用の一貫した体験として提供する最初の`Focused Experience`である。

実装は可能である。ただし、小規模な表層改修ではない。実用品として成立させるには、additive migration、ゲスト所有権、private receipt、非同期Assessment、versioned Feedback、専用read model、privacy-safe area projection、operator workflowが必要である。

次の順序を崩さない。

1. 正本と依存PRを整理する
2. 外部モデルによる計画レビューを行う
3. 指摘を正本へ反映する
4. 副作用なしのcontract実装をgreenにする
5. runtime表示を先行する
6. migrationと所有権をstagingで検証する
7. feedback運用を閉鎖pilotで成立させる
8. area mapを実データへ接続する
9. 外部共有は別承認で開始する

`#1492`は外部レビュー完了までDraftを維持する。

## 1. 利用者への約束

### 1.1 P0で約束する

- ゲストでもログイン済みでも、写真1〜6枚を同じ操作で送れる
- 写真はAI完了を待たず保存される
- ログイン前後でクビアカ専用体験へ戻れる
- ゲストにも非公開の受付・確認ページがある
- 写真の範囲で分かったこと、分からないこと、次に撮るとよいものが返る
- ログイン後はクビアカ専用Home、記録一覧、記録詳細、場所履歴を使える
- 地図では発見地点より、調査量、確認可能品質、再訪、鮮度を優先する
- exact location、未成年、自宅、学校、私有地に配慮する

### 1.2 P0では約束しない

- 即時同定
- 全件の人間・専門家確認
- クビアカツヤカミキリがいないという断定
- 緊急通報
- 行政・管理者への全件自動送信
- 受信、現地確認、対応のSLA
- 地域全体の網羅率（信頼できる分母がない場合）
- 発見候補の正確な公開位置

## 2. 設計不変条件

以下を破る実装は採用しない。

1. Accountを別管理しない
2. Record、Media、Placeを二重作成しない
3. 投稿器をforkしない
4. 保存成功とAI完了を混同しない
5. AI、trained reviewer、accountable specialist、approved recipientを同一の`confirmed`へ畳まない
6. 自由投稿の写真からscientific absenceを自動生成しない
7. Feedbackで原Recordを上書きしない
8. Caseや外部対応で元Record、Claimを上書きしない
9. public mapをRecordのlive queryにしない
10. 分母なしでcoverage percentageを表示しない
11. 投稿数だけで`current_target_met`にしない
12. exact locationをpublic projectionへ出さない
13. ゲストreceiptをURLだけのbearer tokenにしない
14. external sendをreview確定と同じ操作にしない
15. 夏休み企画名を恒常的なURL・データ識別子にしない

## 3. 正本・PR依存の正常化

### 3.1 現在の依存

```text
ikimon-business-strategy#42
  └─ ikimon-business-strategy#43

ikimon-platform#1489
  └─ ikimon-platform#1491
       └─ ikimon-platform#1492 (Draft)
```

`#1490`は別のvertical sliceであり、本機能のblockerにしない。

### 3.2 正規化順

1. strategy `#42`をレビュー・merge
2. strategy `#43`を最新mainへrebaseし、レビュー結果を反映してmerge
3. platform `#1489`をstrategy mainのexact SHAへ追従させ、typecheck・test後にmerge
4. platform `#1491`を新mainへrebaseし、docs-only差分として再確認
5. platform `#1492`を`#1491`の最終headへrebase
6. `#1492`はfocused tests、full Node tests、typecheck、buildがgreenになるまでDraft

複数の親branchを長期間維持しない。親merge後は子PRをmain baseへ順に付け替える。

## 4. Release構成

12個の技術sliceを、利用価値と運用責任に基づく5 Releaseへ束ねる。

### Release A — Contract and static preview

目的:
- 正本、情報設計、専用shell、固定コンテンツを検証する

含む:
- contract docs
- Registry / pure read models
- `/kubiaka`
- `/kubiaka/guide`
- `/kubiaka/about`
- `/kubiaka/faq`
- privacy-safeなfixture area preview
- dedicated shell

含まない:
- 実Recordのexperience link
- guest receipt
- member workspace
- migration
- AI実行
- external send

Exit:
- 表現、導線、アクセシビリティ、ブランド、位置保護をstagingで検証できる

### Release B — Private contribution foundation

目的:
- ゲスト・会員の投稿を一つのRecordとして保存し、専用体験へ戻せる

含む:
- existing composerへのserver-side experience context
- additive migration
- experience Record link
- guest workspace credential
- private receipt
- transactional claim
- member dedicated Home / record list / detail

含まない:
- 自動feedback公開
- public area live data
- external send

Exit:
- guest/member 1〜6枚保存、retry、login return、claim、cross-user isolationがstagingでgreen

### Release C — Delayed feedback beta

目的:
- 投稿後に具体的で誠実なfeedbackを返す

含む:
- evidence coverage
- asynchronous Assessment
- feedback draft
- versioned feedback edition
- trained reviewer override
- `/ops/kubiaka/inbox`
- more-evidence request
- random audit sampling

含まない:
- specialist SLA
- recipient routing

Exit:
- 保存、AI、feedback、人確認の状態が分離され、閉鎖pilotで運用できる

### Release D — Monitoring coverage beta

目的:
- 全体地図から調査不足、進行、今季基準達成、再訪時期を見えるようにする

含む:
- immutable area projection edition
- quantity / quality / repeat / freshness / denominator
- public privacy suppression
- map-equivalent accessible list
- operator coverage QA

含まない:
- 生息不在推定
- exact detection map
- 分母なしの網羅率

Exit:
- sparse/dense、学校・自宅、stale、denominator-freeのfixtureと実データでprivacy/claim境界がgreen

### Release E — Approved partner routing

目的:
- 登録済みの受け手へ必要なRecordだけ安全に共有する

含む:
- recipient registry
- review-approved routing candidate
- separate send approval
- idempotent send
- acknowledged / failed / expired consent
- Case follow-up

含まない:
- 未登録先への自動送信
- 緊急通報保証

Exit:
- 実在する責任主体、受信同意、運用owner、acknowledgement methodが揃う地域のみ有効

## 5. 状態モデルの再設計

単一の線形`internal_state`では、保存済みだがAssessment失敗、feedback公開済みだが追加のspecialist review中、共有済みだが再訪期限到来等を正しく表現できない。

永続状態は4軸に分ける。

### 5.1 Persistence axis

```text
draft
saving
saved
save_failed
suppressed
erased_reference_only
```

Record本体の状態ではなく、Focused Experience linkと利用可否を表す。元Recordのcanonical状態を複製しない。

### 5.2 Assessment axis

```text
not_started
queued
running
completed
failed
stale
cancelled
```

Assessment resultはversioned objectとして別保存する。

### 5.3 Feedback axis

```text
none
draft
published
superseded
withheld
```

`published`はFeedbackEditionの存在を意味し、AI結果の確定を意味しない。

### 5.4 Action axis

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

外部送信を行わないReleaseでは`not_applicable`を維持する。

### 5.5 Contributor projection

4軸から、利用者向けに一つの簡潔な状態を投影する。

優先順位:

1. 保存失敗・利用不能
2. 新しいfeedback
3. 追加写真依頼
4. specialist checking
5. recipient acknowledged
6. recipient shared
7. checking
8. received
9. watching / revisit due

投影ロジックはpure functionとcontract testで固定する。

## 6. データモデル

### 6.1 再利用するcanonical data

- `users` / auth session
- Record / Visit / Observation
- Evidence assets / media
- Place / safe location projection
- Taxon / Identification
- AI provenance
- Rights / Consent
- Review / Correction / Suppression
- Foundation v2 Survey / Detection / Coverage（条件を満たす場合のみ）

### 6.2 新規additive entities

#### `focused_experiences`

- opaque `experience_id`
- `experience_key` unique
- version
- active state
- protocol profile/version
- seasonal content version
- privacy policy version

Registry fileを正本とし、DB rowはruntime activationとversion evidenceを保持する。

#### `focused_experience_record_links`

- experience
- canonical Record reference
- entrypoint
- participant reference
- protocol profile/version
- seasonal module
- partner/group code（optional、公開しない）
- immutable created_at
- suppression state

Recordを複製しない。

#### `focused_experience_participants`

- experience-scoped participant
- account user ID nullable
- guest workspace credential digest nullable
- created / last active / claimed / disabled
- shared-device reset support

#### `focused_experience_receipts`

- receipt ID
- participant
- Record link
- private access policy
- current FeedbackEdition pointer
- claim state
- expiry of guest access
- metadata privacy state

receipt IDだけでは閲覧できない。HttpOnly guest credentialまたはowner sessionが必要。

#### `focused_experience_receipt_claims`

perpetual programでは、guest participant全体を暗黙にアカウントへ移譲しない。

- receipt単位または明示選択したreceipt群をclaim
- `claim all on this device`は明示確認
- transaction内でownershipを更新
- duplicate Record / asset作成禁止
- replay receiptを記録

この設計は共有端末で別人の過去Recordを誤claimする危険を下げる。

#### `focused_experience_assessments`

- assessment ID
- Record / Evidence references
- model/rule ID and version
- input asset IDs
- coverage items
- findings
- confidence
- contradictions / missing evidence
- authority=`automated`
- completed_at
- stale reason

Assessmentはappend-onlyまたはimmutable editionとし、再判定で上書きしない。

#### `focused_experience_evidence_coverage_items`

area queryとfeedback生成に使うため、coverageを巨大な自由JSONだけに閉じない。

- assessment edition
- controlled role
- visibility state
- source asset references
- confidence
- assessor
- limitations codes

説明文はFeedbackEdition側で生成し、controlled dataと分離する。

#### `focused_experience_feedback_editions`

- immutable edition
- source assessment / reviews
- authority label
- known / unknown / comparison / next actions
- localized rendered content or structured fields
- published_at / supersedes
- safety filter version

#### `focused_experience_area_projection_editions`

- immutable snapshot edition
- source watermark
- protocol target version
- geographic cell scheme/version
- privacy policy version
- generated_at
- aggregate cell rows or object reference
- digest

public APIはこのeditionだけを読み、sensitive Recordをlive集計しない。

#### `focused_experience_routing_events`

Release Eまでwriterを無効にする。

- candidate / approved / sent / acknowledged / failed / expired
- approved recipient
- allowed data profile
- operator
- idempotency key
- timestamps
- response evidence reference

## 7. ゲスト所有権と共有端末

### 7.1 基本

- 32-byte以上のCSPRNG credential
- `__Host-` HttpOnly / Secure / SameSite=Lax
- serverはdigestだけ保存
- credentialをURL、analytics、HTML metadataへ出さない
- private responseは`no-store`

### 7.2 永続program特有の問題

イベント用の「guest participantを丸ごとaccountへpromotion」は、家族・学校の共有端末では別人のRecordを誤移譲し得る。

採用案:

- browser guest workspaceは一覧表示のため維持
- account claimはreceipt単位が既定
- 複数claimは利用者が明示選択
- 全件claimは対象数と日付を表示して確認
- `新しいゲストとして使う`でworkspace credentialをrotation
- logout後はaccount dataをguestへ露出しない
- expired guest accessでもRecordは保持し、公開範囲は変えない

### 7.3 回復性

cookieを失ったゲストの復旧はP0で保証しない。メール等のPIIを投稿前必須にしないためである。

受付直後に次を明示する。

> この端末で確認結果を見られます。端末やブラウザを変える前に、記録をアカウントへ保存できます。

## 8. 投稿フロー

### 8.1 Route

`/kubiaka/record`は新しいupload実装ではなく、既存composerのscoped controllerである。

server側で固定:

```text
experience_key=kubiaka-watch
experience_version
entrypoint
protocol_profile=casual-photo
protocol_version
return_to
```

client query parameterだけを信頼しない。

### 8.2 保存順

1. guest credentialまたはaccount sessionを解決
2. existing composerでdraft / photo 1〜6 / place / time / noteを処理
3. canonical Recordを保存
4. transactionまたはdurable outboxでexperience linkを保存
5. receiptを作成
6. receiptへredirect
7. Assessmentをqueue

Record保存後にexperience linkが失敗した場合、Recordを消さない。reconciliation jobでlinkを回復し、利用者には「記録は保存済み、専用ページへの反映を再試行中」と表示する。

## 9. AssessmentとFeedback運用

### 9.1 全件処理の層

- media integrity / quality check
- evidence role coverage
- candidate finding
- limitations
- safe automated feedback draft

### 9.2 人間Reviewの優先順位

1. adult / frass / exit-hole candidate
2. contributorから追加確認依頼
3. high-impact first record in new area
4. low-confidence / contradictory result
5. no-clear-signのrandom audit sample
6. routine quality sample

全投稿を人間が確認する前提にしない。人間確認の有無とauthorityを明示する。

### 9.3 Feedback publication

自動公開可能なfeedbackは、次に限定する。

- 保存・写真範囲の説明
- 写真から確認できた部位
- limitations
- `明確な手がかりは写真範囲で確認されなかった`という限定表現
- 次に撮る選択肢

candidate、専門結論、外部共有判断は人間gateを要求する。

### 9.4 Backpressure

- queue ageを計測
- reviewer capacityを超えた場合、新規受付は継続するが期待時間を誇張しない
- feedbackの公開目標時間はpilotで実測してから外部表示する
- queue overflowでRecord保存を止めない
- assessment unavailable時もreceiptは利用可能

## 10. Area coverage

### 10.1 地理単位

世界展開を考慮し、canonical aggregate cellはglobal grid schemeを採用する。日本の標準地域メッシュ等はcrosswalk/viewとして扱う。

解像度はprivacy、都市密度、対象木台帳、表示zoomに応じてpolicy versionで変更可能にする。cell IDをRecordのpublic itemへ出さない。

### 10.2 一つのscoreへ潰さない

各cellは最低限、次の独立指標を持つ。

- Record量
- screenable quality
- survey-usable quality
- unique days
- repeat observed units
- freshness
- known denominator status
- privacy suppression
- review / projection freshness

### 10.3 Public state

```text
no_observations
privacy_suppressed
more_observation_useful
observation_progressing
current_target_met
revisit_due
```

`current_target_met`はprotocol targetを満たした意味であり、不在、安全、調査完了を意味しない。

### 10.4 Denominator classes

```text
known_tree_inventory
known_site_inventory
known_eligible_place_inventory
opportunistic_no_denominator
```

割合を表示できるのは、source、edition、scope、updated_atが明示された前三者のみ。

### 10.5 Projection

- live Record APIから描画しない
- immutable projection editionを生成
- small count suppression
- adjacent-cell merge / coarsening
- school/home/private land sensitivity
- source watermarkとageを表示
- operator viewとpublic viewを分離

## 11. 画面とデータ責務

| Route | Release | Auth | Primary source | Mutation |
|---|---|---|---|---|
| `/kubiaka` | A | public | Registry/content | none |
| `/kubiaka/guide` | A | public | versioned content | none |
| `/kubiaka/about` | A | public | contract/content | none |
| `/kubiaka/faq` | A | public | content | none |
| `/kubiaka/record` | B | public/session | existing composer | Record save |
| `/kubiaka/receipt/:id` | B | scoped guest/owner | receipt read model | claim/add photo |
| `/kubiaka/me` | B | session | dedicated read model | none |
| `/kubiaka/me/records` | B | session | record links | none |
| `/kubiaka/records/:id` | B/C | owner | media + feedback | add photo/choices |
| `/kubiaka/places/:id` | B/C | owner | safe Place timeline | revisit |
| `/kubiaka/area` | A fixture / D live | public | projection edition | none |
| `/ops/kubiaka/inbox` | C | operator | assessment queue | review action |
| `/ops/kubiaka/coverage` | D | operator | raw + projection QA | publish edition |
| `/ops/kubiaka/cases` | E | operator | Case/routing | approved actions |

## 12. API境界

代表的なAPI。実装時にcurrent API conventionsへ合わせる。

```text
GET  /api/focused-experiences/kubiaka-watch
POST /api/focused-experiences/kubiaka-watch/records
GET  /api/focused-experiences/kubiaka-watch/receipts/:id
POST /api/focused-experiences/kubiaka-watch/receipts/:id/claim
GET  /api/focused-experiences/kubiaka-watch/me
GET  /api/focused-experiences/kubiaka-watch/records/:id
GET  /api/focused-experiences/kubiaka-watch/area-projection/current
```

POST saveがexisting Record endpointを利用する場合も、experience contextはserver-authoritativeで永続化する。

## 13. Migration計画

### 13.1 原則

- additive only
- current Record/Observation schemaを置換しない
- PostgreSQL canonicalと、必要なD1 runtimeのsemantic parity
- dialect共通fixture
- idempotent apply ledger
- backup / rollback rehearsal
- production applyは明示承認まで禁止

### 13.2 分割

Migration 1:
- experience registry
- participant
- Record link
- receipt / claim

Migration 2:
- Assessment
- evidence coverage items
- FeedbackEdition

Migration 3:
- area projection edition

Migration 4:
- routing events（Release E直前まで作成しない選択も可）

一つの巨大migrationにしない。

### 13.3 Rollback

schema rollbackよりfeature flag offを第一手段とする。

- focused routesをdisable
- canonical Recordsを維持
- new writers停止
- private receiptsをread-only化
- projection generation停止
- additive tablesは証跡として保持

データ削除rollbackは行わない。

## 14. Security / Privacy threat model

Blocking threats:

- receipt ID enumeration
- guest credential theft / replay
- shared-device cross-person claim
- account A/B Record leakage
- CSRF on claim / add-photo
- receipt metadata or link preview leak
- EXIF / exact coordinate public leak
- sparse-cell re-identification
- public map differencing attack across editions
- free-text XSS
- model output HTML injection
- operator over-broad exact-location access
- recipient consent expiry bypass
- external send duplicate
- suppression not propagating to projection

Required controls:

- unguessable IDs + authenticated scoped access
- same-origin mutation / CSRF control
- no-store private pages
- explicit operator permission and task need
- output escaping
- projection k-threshold / coarsening
- privacy budget or differencing review for frequent editions
- suppression watermark and republish
- idempotency
- audit trail

## 15. Accessibility and child-safe UX

- 320 / 375 / 390 / 412 / 768 / 1024 / 1280 / 1440 / 1536
- text 200%
- keyboard complete
- screen-reader meaningful order
- map-equivalent list
- color以外でcoverage stateを表現
- 44px相当のtouch target
- photo add/remove後のfocus return
- slow network / image failure / AI unavailable
- 本名、学校名、学年、年齢の入力を求めない
- exact movement pathを保存・表示しない
- 道路、私有地、高所へ誘導しない
- `今回はここで終える`を正当な選択として維持

自己効力感・自律性・関係性は内部評価原則とし、露骨な教育語や過剰称賛を表示しない。

## 16. Observability

PIIを含めず次を計測する。

- landing → composer start
- photo selected count bucket
- save success / failure
- experience link reconciliation
- receipt view
- claim success / failure / rollback
- Assessment queue age / failure
- feedback publish age
- feedback read
- more-evidence response
- revisit
- area state distribution
- projection age
- privacy suppression count
- routing candidate / sent / acknowledged（Release E）

analyticsへ入れない:

- exact location
- Record ID / receipt ID / guest token
- filename
- media content
- free text
- child identity
- raw user ID

## 17. Test strategy

### 17.1 Unit / contract

- Registry
- route resolution
- four-axis state projection
- evidence coverage
- no-clear-sign scope
- authority separation
- area state
- freshness
- denominator boundary
- privacy suppression
- seasonal content expiry

### 17.2 Persistence

- all migrations
- PostgreSQL / D1 semantic fixtures
- Record link idempotency
- receipt access
- receipt claim transaction
- per-receipt vs multi-select claim
- append-only Assessment / Feedback
- projection edition immutability
- tenant isolation
- suppression propagation

### 17.3 Security

- guest A/B
- account A/B
- guest→account A/B
- stale cookie
- replay
- shared device reset
- logout
- CSRF
- cache headers
- metadata / OpenGraph
- sparse map cells
- differencing between projection editions
- exact location operator authorization

### 17.4 Browser E2E

- guest landing → 1 photo → save → receipt
- guest 6 photos → retry → save
- receipt → login → selected claim → member detail
- member direct save → dedicated Home
- Assessment delayed
- Assessment failed
- feedback published
- additional photo request
- Place revisit
- area selected cell → missing reason → record CTA
- accessible list parity

### 17.5 Model evaluation

- adult candidate precision / recall
- frass candidate precision / recall
- exit-hole candidate
- image role classification
- insufficient evidence
- false negative audit sample
- region / season / device quality stratification
- model version regression

AI評価が基準未達でもRecord保存とmanual reviewは動く。

## 18. Staging rollout

1. parent PRsを順番にmainへ統合
2. exact source SHA固定
3. source gates
4. staging backup
5. Migration 1 apply
6. guest/member ownership fixture
7. real 1〜6 photo upload
8. retry / offline draft / login return
9. claim rollback rehearsal
10. Migration 2 apply
11. Assessment simulation and real provider sandbox
12. FeedbackEdition publish
13. operator queue rehearsal
14. Migration 3 apply
15. sparse/dense/sensitive area projection
16. mobile / accessibility / security review
17. runtime identity evidence
18. pilot GO/NO-GO

Production、DB、secret、external sendは別々の明示承認とする。

## 19. Pilot design

最初から全国一般公開しない。

### Closed pilot

- 対象地域を限定
- 参加者上限またはinvite / QR
- reviewer capacityを設定
- public area mapはfixtureまたは十分なaggregation後のみ
- external sendなし
- feedback latency、false positive/negative、claim UXを測定

### Public beta

GO条件:

- save success target達成
- cross-user / receipt security green
- feedback queueが持続可能
- AI authority copyに誤認なし
- no-clear-sign audit acceptable
- public map privacy green
- operator runbook rehearsal済み
- correction / suppressionが投影へ伝播

## 20. Production approval boundaries

明示承認が必要:

- production migration
- production deploy
- new secrets
- recipient registration
- external send
- live public area projection
- partner / municipality naming
- public dataset / GBIF publication
- billing
- permission changes

## 21. Stop conditions

次の一つでも未解決なら、次Releaseへ進まない。

- current upload regression
- duplicate Record / asset risk
- guest receipt enumeration
- shared-device誤claim
- cross-user exposure
- exact location leak
- AIが専門確認として表示される
- free-form photoがabsenceへ昇格する
- feedback queueが無期限滞留する
- public mapが分母なしで十分性を示す
- raw volumeだけでarea targetを満たす
- stale surveyをcasual photoが更新する
- suppressionがpublic projectionへ反映されない
- external sendがoperator approvalなしで可能
- recipient consentが不明または期限切れ
- rollback rehearsalなし

## 22. 外部レビューで確定したい論点

1. `Focused Experience`抽象化は適切か、クビアカ固有実装から始めるべきか
2. 4軸状態モデルは過剰か、不足か
3. guest workspace + receipt単位claimは安全性とUXの最良バランスか
4. 新規table群は最小か。Foundation v2と重複していないか
5. evidence coverage itemsを正規化する必要性
6. Assessment / Feedbackをimmutable editionにする粒度
7. automated feedbackをどこまで自動公開可能にするか
8. area targetの定義が科学的主張とUXの境界を守れているか
9. projection editionによるprivacy対策は十分か
10. Release A〜Eの順序と切り方
11. ops負荷と持続可能性
12. 現在のPR依存stackに潜む長期保守リスク

## 23. Review後の処理

外部レビューを受けたら、指摘ごとに以下を記録する。

```text
finding_id
severity
accepted / partially_accepted / rejected
reason
strategy change required?
spec change
plan change
code change
migration impact
release impact
verification
```

方針変更はstrategy `#43`へ先に反映し、その後platform `#1491`、`#1492`を更新する。
