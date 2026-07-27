# ZUKAN 個人基本体験 P0仕様

- 状態: `CANONICAL_CONTRACT / SOURCE_PARTIAL / RUNTIME_NOT_VERIFIED`
- 基準日: 2026-07-28
- implementation baseline: `3c6f3556c5319821601e6f62b971e8b041e1a31c`
- strategy baseline: `f21a67cabdf91f7007a9c66d1c44b708e478f34c`
- strategy candidate: `ikimon-business-strategy#28`
- 親Issue: #1469
- 関連: #1296、#1365、#1421、#1459
- 対象runtime: current app `platform_v2/`とCloudflare projection
- current URL・技術識別子: `ikimon.life`
- 公開サービス名: `ZUKAN`

本仕様は、既存実装の存在や過去のstaging証拠を否定しない。一方、最新mainのexact-SHAで一連のE2Eが確認されるまで`READY_P0`としない。

## 1. 結論

外部へ見せる前に、次の一連の体験を一つのE2E契約として成立させる。

`撮る → 保存される → 本人に返る → AI候補を見る → 編集・確認する → 公開安全を守る → Placeに積み重なる → 後から見返す`

P0は、画像アップロード、AI、編集、Place Atlas等の別機能を個別に通すことではない。一つのRecordが、media、owner、processing state、rights、public precision、Place membership、表示面の間で矛盾なく成立することを指す。

## 2. P0の位置

ZUKANの無料コアの最下層である。

P0は次へ依存しない。

- 有料契約
- Program・組織作成
- TaxonInventory、種一覧、生物相集計
- 報告用CSV、Excel、PDF、API
- 販促LP、campaign、coupon
- `zukan.earth`へのdomain migration
- 公式サイトrenewal

Program、Quest、Review、年度引継ぎは、P0で成立したRecordの上に乗る。専門成果物は、P0 Recordを別contractで名寄せ・集計・確認した有償派生物である。

## 3. 再利用する現行資産

作り直さない。

- current app `platform_v2/`
- 共通cameraと端末画像選択
- guest・member session
- Record / Observation / media保存
- owner detailとprocessing status
- AI suggestion・reassessmentの既存経路
- Home、Records、Self
- public visibility、rights、public precision、sensitive masking
- Place Atlas profile、search、membership、timeline、provenance
- Cloudflare source identity、materialization、release guardrail

既存の`ikimon` repository、package、API、DB、auth、Cloudflare resource等の技術識別子は、公開サービス名変更だけを理由に改名しない。

## 4. P0 / P1 / later

### P0

- cameraまたは端末画像から一件以上のmediaを選べる
- uploadとRecord作成が孤立せず、一意のRecordへ収束する
- session ownerがcanonical ownerとして保存される
- 保存後、本人のRecord詳細へ遷移・復帰できる
- 保存済み、AI処理中、候補確認待ち、判定済み、retry可能失敗、終端失敗を区別する
- AI候補を確認・却下・再試行できる
- ownerが名称、memo、撮影時点、公開範囲、public precision等を編集できる
- private、limited、public-readyがrights・safetyと一致する
- exact locationをpublic response・DOM・telemetryへ出さない
- Place membershipがconfirmed、candidate、または理由付きunresolvedになる
- Record詳細からPlaceへ移動でき、Place profileへ安全に反映される
- Home、Records、詳細、Placeが同じRecord状態を読む
- offline・部分失敗・再試行から復旧できる
- idempotent retryで重複Record・media・AI requestを作らない
- `/learn`、`/ja/contact`等のP0導線が、存在するか安全に代替される

### P1

- 過去の浅いAI結果の品質backlog
- anonymous Recordの高度なclaim・merge
- multiple photo sequencingの詳細編集
- owner間transfer
- curator・expertの高度Review
- Program、Quest、consent、handover
- Place correction、same-place candidate、merge review UI
- notification、email、push
- bulk repair・admin dashboard

### later / paid derivative

- TaxonInventory、species list、biodiversity aggregate
- 報告用CSV、Excel、PDF、API
- professional report・expert assurance
- promotional LP、campaign、custom event page
- coupon
- billing、payment、settlement
- `zukan.earth`production migration

## 5. canonical Record契約

一回の利用者行為は、一つのcanonical Recordへ収束する。

最低限の関係:

```text
owner/session
  └─ Record
      ├─ one or more Media
      ├─ observation/content fields
      ├─ processing state
      ├─ zero or more AI Suggestions
      ├─ accepted/rejected human decision
      ├─ visibility / rights / public precision
      ├─ zero or more Place Membership candidates
      ├─ one optional primary Place Membership
      └─ lifecycle / retry / correction events
```

写真数、Occurrence数、AI suggestion数をRecord数として重複計上しない。

## 6. 状態機械

### 6.1 保存状態

```text
local_draft
→ uploading
→ media_stored
→ record_committing
→ saved
```

失敗:

```text
upload_failed_retryable
record_commit_failed_retryable
failed_terminal
```

`saved`は、canonical Record ID、owner、media参照、rights/publication初期状態が確定したことを表す。AI完了を意味しない。

### 6.2 AI状態

```text
not_requested
→ queued
→ analyzing
→ suggestion_available
→ needs_owner_review
→ accepted | rejected | needs_expert_review
```

失敗:

```text
failed_retryable → queued
failed_terminal
```

保存する項目:

- request ID / idempotency key
- provider・model・rule version
- input media references
- status
- attempt count
- last attempted at
- failure category / safe reason code
- suggestion、confidence、Evidence Tier
- owner decision

AI suggestionをverified・research grade・officialと自動表示しない。

### 6.3 Place membership状態

```text
unresolved
→ candidates_found
→ confirmed
```

分岐:

```text
candidate
corrected
removed
suppressed_publicly
```

- internal exact pointとuncertaintyをmembership計算に使える。
- public responseはPlace、Zone、public cell等の安全なprecisionだけを返す。
- 境界近傍、approximate geometry、同順位overlapではcandidateにする。
- 名称、座標、OSM IDの一つだけでsame-placeを確定しない。

### 6.4 公開状態

Record visibility:

```text
private | limited | public_requested
```

Public readiness:

```text
not_public
pending_safety
public_ready
suppressed
withdrawn
```

`public_requested`と`public_ready`を同義にしない。

## 7. transaction・idempotency・outbox

### 必須不変条件

- Recordだけ、mediaだけ、ownerなし、AI requestだけを成功状態として残さない。
- provider外部呼出しをDB transaction内で待たない。
- 保存commitとAI enqueue intentを同じdurable boundaryへ残す。
- retryは同じidempotency keyを使う。
- client timeout後の再送がduplicateを作らない。
- queue at-least-once deliveryで結果が重複しない。

推奨:

1. clientはcapture draft IDとidempotency keyを持つ。
2. media uploadはcontent hash・draft ID・sequenceで再利用可能にする。
3. Record、owner、media relation、rights初期値、AI outboxを一つのatomic commitへ寄せる。
4. workerがoutboxをclaimし、AI処理する。
5. result writebackはcompare-and-setまたはversion checkを行う。
6. UIはprocessing-status read modelを読む。

## 8. owner・認可

canonical owner判定を、一覧、詳細、編集、AI retry、media retryで共有する。

- login member: session user ID
- guest: stable guest identity
- guest→member: explicit atomic rekey・claim contract
- public viewer: owner内部状態を取得不可
- another user: edit、retry、private media取得不可

「自分の記録」表示と編集認可を別ロジックにしない。

## 9. 画面別受入条件

### 9.1 camera / capture sheet

- 許可前にcameraを起動しない。
- cameraと端末画像を明示分離する。
- permission denied、unsupported、no deviceを区別する。
- locationは失敗しても撮影・private保存を続けられる。
- capture中のstreamを終了時に停止する。
- 320px幅でprimary actionが固定UIに隠れない。

### 9.2 upload / progress

- mediaごとのupload状態を表示する。
- 全media保存前に完了と表示しない。
- 部分失敗時に成功mediaを再送しない。
- offlineはlocal draftとして残し、復帰時に再開できる。
- cancel・retry後も同じRecordへ収束する。

### 9.3 Record詳細

表示順の基本:

1. media
2. 撮影時点・安全なPlace
3. AI suggestionと確認action
4. memo・編集
5. 保存・処理詳細
6. Placeへの導線

受入条件:

- ownerだけがprocessing details・retryを見られる。
- 保存とAI完了を区別する。
- suggestionをaccept/rejectできる。
- retry連打を抑止する。
- failure reasonはsecret、provider response、internal pathを漏らさない。
- public viewerへexact coordinate、owner identity、private noteを出さない。

### 9.4 Home / Records / Self

- Home: 本人の続きと次の一手。Recordが反映される。
- Records: 同じcanonical stateを一覧化する。
- Self: profile、公開範囲、参加、設定等を管理し、Homeを重複しない。
- state label、title、thumbnail、Placeが詳細と矛盾しない。
- pending・failed・privateを確定済みpublic Recordのように表示しない。

### 9.5 Place profile

- confirmedかpublic-safe geometry fallbackを通したRecordだけをcountする。
- same Recordのmultiple Occurrenceを一回計上する。
- candidate、removed、private、rights欠損、withdrawnを除外する。
- AI suggestionを確認済みtaxonとして表示しない。
- exact coordinate、contributor identityを出さない。
- empty、partial、suppressed、errorを区別する。
- Record詳細から戻れる。

### 9.6 help / contact

- `/learn`と`/ja/contact`をproduction smoke対象にするならmaterializeする。
- materializeしない場合は、navigation・CTA・smoke contractから安全に外し、代替導線を用意する。
- 404のままP0 READYとしない。

## 10. offline・failure・recovery

### offline before capture

- device local draftを作れる。
- location未取得を明示する。
- network復帰までpublic-readyにしない。

### offline during upload

- media sequence、hash、draft IDを保持する。
- exponential backoffとmanual retryを提供する。
- app再起動後にowner分離を守って復帰する。

### DB commit failure

- upload済みmediaをorphanとして放置せず、reconcile対象へ入れる。
- clientはRecord未確定と表示する。
- retryで同じRecordへ収束する。

### AI failure

- Record閲覧・編集・Place候補確認を阻害しない。
- retryableとterminalを区別する。
- ownerが再解析できる。
- provider outageでRecordを削除・非表示にしない。

### Place resolution failure

- Record保存を失敗させない。
- unresolved reasonを保持する。
- public displayは安全なcellまたは位置非表示へfall backする。
- 後から人が訂正できる。

## 11. privacy・rights

P0で最低限守る。

- 自宅、私有地、学校、未成年、人物、希少種、制限施設
- 撮影位置と対象位置の差
- exact/private geometryとpublic projectionの分離
- public requestedとpublic-readyの分離
- media rights、external export、research use、promotional useの分離
- private note・EXIF・contributor identityの除外
- withdrawal後のcache・snapshot抑止

AIは公開範囲を拡大しない。OSM `access=yes`等から撮影・公開許可を推定しない。

## 12. API・data・UI責任分界

### API / service

- auth・owner・CSRF・rate limit
- idempotency
- atomic commit / outbox
- processing state
- safe error code
- Place candidate・membership
- public-safe projection

### data

- canonical Record identity
- owner relation
- media relation・hash・sequence
- lifecycle events
- AI requests / suggestions / decision
- visibility / rights / precision
- Place membership / provenance / correction
- created / observed / valid / recorded time

### UI

- 状態と次の一手の表示
- retry・cancel・edit
- owner/public view分離
- offline draft
- accessibility、responsive、no-overflow
- internal stateを推測で作らない

## 13. device・browser test matrix

最低:

| device / browser | 必須 |
|---|---|
| Android Chrome 実機 | camera permission、capture、upload、background復帰、retry |
| iPhone Safari 実機 | camera、photo library、HEIC、permission、viewport・safe area |
| Chromium desktop | file upload、edit、keyboard、responsive |
| WebKit | route、CSP、media、dialog、fixed UI |
| Firefox | layout・API・fallback |

viewport:

`320×568 / 360×640 / 375×667 / 390×844 / 412×915 / 768×1024 / 1024×768 / 1280×720 / 1440×900 / 1920×1080`

media:

- JPEG / PNG / WebP
- HEICはsupportまたは明示的safe error
- portrait / landscape
- size limit直下・超過
- EXIF rotation
- multiple photos

scenarios:

1. member happy path
2. guest happy path
3. guest→member handover
4. camera denied→明示gallery
5. location denied
6. offline→resume
7. upload partial failure→retry
8. client timeout→idempotent retry
9. AI provider failure→retry→success
10. owner edit
11. another user edit denied
12. private Record public exclusion
13. candidate Place
14. boundary ambiguity
15. withdrawal
16. route help/contact

## 14. release gate

順序:

1. latest mainからfresh branch
2. targeted tests
3. full typecheck・build・tests
4. security・secret・diff checks
5. exact-SHA dry-run
6. staging deploy
7. runtime identity・materialization確認
8. fresh test Record作成
9. owner、AI state、edit、retry、Place、public safetyのreadback
10. Android・iPhone・desktop Visual / browser QA
11. evidence保存
12. unresolved分類

productionは別の明示承認がある場合のみ。同一SHA、green staging、rollback locatorを必須とする。

## 15. READY判定

現時点: `NOT_READY_P0`

`READY_P0`条件:

- 本仕様がlatest mainへ採用済み
- runtime QAがlatest mainから構築される
- exact-SHA staging identity一致
- fresh RecordでP0 happy pathを一周
- failure→retry→successを一件確認
- owner edit成功、他人edit拒否
- private・limited・public-ready・public precisionが正しい
- Place profileへ安全に一回反映
- Home、Records、詳細、Placeが一致
- route blocker解消
- Android、iPhone、desktopで重大P0/P1なし
- evidence、known limits、rollback locatorが記録される

## 16. 既存PR・Issueの扱い

- #1296: P0のowner、edit、AI、state、retryの親問題。open/closedだけで完了判定しない。
- #1365: `/learn`、`/ja/contact` historical production 404。解消証拠までblocker。
- #1421〜#1426: Universal Place Atlas。多くのsourceは実装済みだがcurrent runtimeを再検証する。
- #1441: 過去AI品質backlog。P1。
- #1442/#1443: post-capture detail・state UI。P0既存資産。
- #1459: runtime gate候補。古いbase・旧brandのためlatest mainから再構築する。
- #1460/#1462/#1466: Place Graph、無料組織コア、有償派生物contract。P0の上位・後続境界。
- #1469: 本同期Issue。

## 17. 禁止

- ZUKAN brand UIだけを作ってP0 READYとする
- UTSUROUをservice nameとして復活させる
- brand変更でDB・API・auth・repositoryを一斉改名する
- 保存済みをAI完了と表示する
- AI suggestionを確認済みと表示する
- ownerなしRecord、orphan media、duplicate retryを許容する
- exact location、private note、contributor identityをpublicへ出す
- Placeを名称・座標・外部IDだけで自動統合する
- P0を有料状態へ依存させる
- TaxonInventory・report outputをP0無料機能へ混ぜる
- staging未確認でproductionへ進む
