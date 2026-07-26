# ikimon.life 基本体験 P0仕様

- 状態: proposed / Draft PR review
- 基準日: 2026-07-26
- base SHA: `298bfa16b378fc73dcf874dd036d2df947035298`
- 親Issue: #1444
- 関連: #1296、#1365、#1421
- 対象runtime: current app `platform_v2/`とCloudflare projection

## 1. 結論

外部へ見せる前に、次の一連の体験を一つのE2E契約として成立させる。

`撮る → 保存される → 本人に紐づく → AI候補が出る → 編集・確認できる → 公開範囲と位置精度を守る → Placeに積み重なる → 後から見返せる`

一部の画面やAPIが存在するだけではP0完了としない。利用者が一件の新規記録を最初から最後まで進め、失敗した場合も自力で復旧でき、同じ記録が本人画面とPlace画面に矛盾なく現れることを完了条件とする。

## 2. P0の北極星

P0の主指標は投稿数ではない。

> 新規記録が、owner・media・AI状態・編集権限・公開方針・位置精度・Place所属を失わず、一つのRecordとして本人へ返る割合。

P0検証では、次を分けて測る。

- 撮影開始成功率
- media保存成功率
- Record作成成功率
- owner紐付け成功率
- AI job作成成功率
- AI結果または確認待ち状態到達率
- owner編集成功率
- Place所属確定または候補表示率
- 本人一覧・詳細・Place profileの整合率
- retryによる回復率
- orphan media / orphan Record / orphan job発生数

## 3. 優先順位

### P0: 外部提示・通常利用の前提

1. 共通カメラまたは明示的な端末画像選択から記録を開始できる。
2. 位置取得の許可・拒否・失敗を区別し、拒否しても記録を失わない。
3. media、Record、owner、AI requestを同一idempotency scopeで確定する。
4. 保存完了後、本人の記録詳細へ遷移する。
5. 「写真保存」と「AI処理」を別状態として表示する。
6. owner本人が、名称候補、メモ、日時、公開範囲、公開位置精度、Place候補を編集・確認できる。
7. AIの成功・候補確認待ち・retryable失敗・terminal失敗を区別する。
8. retryable失敗には、本人だけが使える冪等な再解析導線を出す。
9. RecordがPlaceに`confirmed`または`candidate`として所属し、曖昧な場合は利用者へ候補として示す。
10. 公開投影は、ownerの公開範囲、rights、public precision、sensitive policyを通過した情報だけに限定する。
11. 本人Home／自分ページ／記録詳細／Place profileで、同じRecordの状態が矛盾しない。
12. `/learn`と`/ja/contact`を含む利用支援・問い合わせ導線がproductionで404にならない。
13. Android、iPhone、PCで、撮影開始からPlace反映までのE2Eを通す。
14. offlineまたは通信切断時に、保存前の素材を黙って消さず、再送・破棄を利用者が選べる。

### P1: P0成立後に品質・対象範囲を広げる

- 匿名／guest Recordのログイン後claimと競合解決
- 既存の「名前待ち」Recordのread-only診断、分類、安全なbackfill
- 過去の浅いAI結果を優先再判定する品質backlog（Draft PR #1441）
- HEIC、動画、複数写真、長時間uploadの最適化
- 複数Place所属、階層表示、利用者による所属訂正の高度化
- AI confidence、Evidence Tier、専門家確認の詳細UI
- offline outboxの複数Record、端末間同期、長期保管
- 通知、活動mission、継続記録の誘導
- 管理者・curator向けreview queue

### Later: 基本体験とは分離する

- 全国自治体への展開
- 自治体固有CMSへのwriteback connector
- 大量の非公開資料移行
- 汎用RAGチャット
- SNS機能、ランキング、フォロー
- AIによる自動公開・公式正本自動更新
- ネイティブアプリ専用機能

## 4. 用語と不変条件

### Record

一回の記録行為の正本単位。複数mediaやOccurrenceがあっても、本人画面・Place集計・状態表示でRecord数を重複させない。

### Media

写真・動画等の原本または派生asset。media保存成功とRecord確定を分けて追跡するが、利用者へ孤立assetを正常記録として見せない。

### Owner

Recordを編集し、AI再解析を要求し、公開方針を変更できる主体。owner判定は一覧、詳細、編集、processing status、retryで共通policyを使用する。

### AI suggestion

対象名、theme、説明等の候補。AIだけで`confirmed`または`verified`へ遷移させない。

### Place membership

RecordとPlace／Zone／Spotの所属関係。`confirmed`、`candidate`、`corrected`、`removed`を区別する。exact internal pointはmembership計算に使用できるが、公開APIへ返さない。

### Public projection

非公開原本から、公開範囲、rights、位置精度、sensitive policy、moderationを通して生成した表示用情報。原本と公開派生を同一row／同一responseとして扱わない。

### 不変条件

- 一つのidempotency keyから、重複Recordや重複AI requestを作らない。
- owner本人の表示条件と編集権限判定を別実装にしない。
- 保存済みをAI完了と表示しない。
- AI候補を確認済み名称として表示しない。
- private RecordをPlace public profileへ投影しない。
- exact coordinate、contributor identity、private noteを公開responseへ含めない。
- retryで元media、本文、位置、公開範囲を上書きしない。
- Place候補が曖昧な場合、誤った一件へ自動確定しない。
- partial failureを全成功として返さない。

## 5. 状態機械

### 5.1 Capture / upload状態

```text
idle
  → camera_open | gallery_selected
  → media_ready
  → location_pending | location_skipped | location_acquired | location_failed
  → upload_pending
  → uploading
  → media_stored
  → record_committing
  → record_saved
  → post_save_ready
```

失敗状態:

```text
camera_denied
camera_unavailable
media_invalid
upload_failed_retryable
upload_failed_terminal
record_commit_failed_retryable
record_commit_failed_terminal
```

ルール:

- `media_stored`だけでは利用者へ「記録を保存しました」と表示しない。
- `record_saved`はRecord ID、owner、media link、公開方針、location stateがread-backできた時に成立する。
- AI request作成が遅延する場合でも、`record_saved`後に詳細へ遷移し、AI状態を`enqueue_pending`として見せる。
- upload中に画面を閉じても、端末側draftまたはoutboxから再開できる。

### 5.2 AI状態

```text
not_requested
  → enqueue_pending
  → queued
  → analyzing
  → needs_review | identified
```

失敗・保留:

```text
failed_retryable
failed_terminal
suppressed
not_applicable
```

最低保存項目:

- AI request ID
- Record ID
- media input version
- model / provider lane
- rule / prompt version
- state
- attempt count
- last attempted at
- next retry at
- public-safe error code
- internal error locator
- candidate payload version
- result written at
- accepted / rejected / pending state

ルール:

- providerの生error、secret、private URLを利用者へ返さない。
- 同じmedia input versionとrule versionのactive requestを重複作成しない。
- retryは新しいattemptを記録するが、同じRecordを増やさない。
- `needs_review`は候補が存在し、本人またはreviewerの確認が必要な状態。
- `identified`は採用されたclaimが存在し、誰が採用したかを追跡できる状態。

### 5.3 Owner状態

```text
owned
anonymous_unclaimed
claimable
claim_pending
claimed
ownership_ambiguous
ownership_blocked
```

P0ではログイン済みユーザーの`owned`を必須とする。guest claimはP1だが、P0実装は将来のclaimを壊さない識別子・履歴を保持する。

### 5.4 Place membership状態

```text
unresolved
  → candidate
  → confirmed
  → corrected
  → removed
```

導出理由:

- inside
- near_boundary
- manual
- imported
- hierarchy_derived
- no_location
- no_safe_match
- overlapping_siblings

ルール:

- exact pointとGPS uncertaintyを内部計算に使用する。
- boundary付近、approximate boundary、同順位overlapは`candidate`へ落とす。
- public responseはPlace／Zone／cell precisionのみ。
- ownerの手動訂正は元の自動導出を削除せず、correction historyを残す。

### 5.5 公開状態

```text
private
limited
public_pending
public_ready
public_suppressed
withdrawn
```

`public_ready`には最低限次が必要:

- ownerが公開を選択
- mediaがpublic-ready
- active public rights
- public precision決定済み
- sensitive policy通過
- private note除外
- Place profile側のprojection条件通過

## 6. 画面単位の受入条件

### 6.1 共通カメラ／画像選択

必須:

- 主操作「撮る」はカメラ起動を試みる。
- 「端末の写真から選ぶ」は別操作として明示する。
- camera permission拒否時に、無言でgalleryを開かない。
- camera streamを画面終了時に停止する。
- 撮影前後に公開・非公開の長い説明を出さない。
- 位置取得は自動で試みるが、利用者が拒否・skipできる。
- 撮影位置と対象位置が異なる可能性を保持し、後からPlace候補を訂正できる。
- multiple tapで同じcapture sessionを重複開始しない。

表示状態:

- カメラ準備中
- カメラを使用できない
- 権限が必要
- 写真を確認
- 位置を取得中
- 位置なしで続ける
- 保存中
- 再送待ち

### 6.2 保存進行

必須:

- upload progressまたは段階表示を行う。
- media保存、Record保存、AI準備を一つの「完了」にまとめない。
- Record保存前に画面を離れる場合、draft/outboxが存在することを示す。
- retryable errorでは同じidempotency keyを再利用する。
- terminal errorでは、残せたdraftと破棄対象を明示する。
- partial photo upload時に、成功写真と失敗写真を区別する。

### 6.3 投稿直後の記録詳細

優先順:

1. 写真
2. 保存できたこと
3. AI候補またはAI状態
4. 次に必要な操作
5. 場所・公開範囲
6. メモ・詳細
7. processing details

必須:

- owner専用status取得が成功した場合だけ内部状態を表示する。
- owner status取得に失敗しても、既存の安全な記録詳細を消さない。
- `record_saved`、`queued`、`analyzing`、`needs_review`、`identified`、`failed_retryable`、`failed_terminal`を区別する。
- retryable時に「もう一度試す」を出す。
- candidateがある場合、採用・変更・保留ができる。
- Place confirmed時は「この場所の記録として保存」とPlace導線を出す。
- Place candidate時は候補と訂正導線を出す。
- no location時は後から場所を追加できる。
- owner以外へAI内部状態、retry、編集操作を見せない。

### 6.4 編集画面

P0編集対象:

- 表示名／対象名
- AI候補の採用・却下
- メモ
- 撮影日時
- 公開範囲
- public location precision
- Place候補・所属

必須:

- owner共通policyで認可する。
- CSRF、validation、rate limit、optimistic concurrencyを適用する。
- 更新競合時に、後勝ちで黙って上書きせず再読込・比較を促す。
- AI候補の採用はclaimとして履歴を残す。
- 公開範囲をprivateへ戻した場合、public projectionを無効化する。
- Place所属訂正は元の自動判定を履歴として保持する。

P0で必須にしない編集:

- 原本mediaの物理削除
- 複雑な画像編集
- 複数Occurrenceの専門編集
- curator専用taxonomy操作

### 6.5 Home／自分ページ／記録一覧

役割:

- Home: 本人の続きと次の一つ。
- 自分ページ: profile、記録、場所、公開範囲、参加、設定の管理。
- 記録一覧: Recordの検索・状態確認。

必須:

- 同じRecordをmedia数・Occurrence数で重複表示しない。
- 本人Recordに編集可能状態を示す。
- AI状態を短く表示し、詳細はRecord画面へ集約する。
- private、limited、publicを視覚的に区別する。
- failed retryable Recordを見失わない。
- draft/outboxとserver saved Recordを同じ正常記録として混ぜない。

### 6.6 Place profile／地域図鑑

必須:

- confirmed membershipのpublic-ready Recordだけを通常集計する。
- candidate、removed、private、rights欠損、withdrawnを公開数へ含めない。
- 一Record内の複数Occurrenceを一件として数える。
- exact coordinateとcontributor identityを返さない。
- AI provisional、unverified、verifiedを区別する。
- empty、partial、suppressed、errorを区別する。
- 撮影・公開可否はOSM accessから推定しない。
- 施設ルールが未確認なら`check_rules`または`unknown`とする。
- ownerには、本人Recordがcandidateで未反映の場合、その理由と訂正導線を出せる。

### 6.7 Learn／Contact／Help

P0では、次をroute smoke対象に含める。

- `/learn`
- `/ja/contact`
- 現行localeのcontact/help相当route

必須:

- productionで200または意図したredirect。
- `html_not_materialized`を返さない。
- navigationから到達できる。
- 問い合わせ送信を変更しないread-only確認と、必要なform E2Eを分離する。
- 404を既知制限として放置したまま外部デモREADYとしない。

## 7. API・data・UI責任分界

| 層 | 責任 | 責任外 |
|---|---|---|
| Capture UI | camera/gallery、位置許可、draft、progress、retry選択 | owner確定、公開投影の最終判断 |
| Record create API | idempotency、session owner、Record/media link、public policy、read-back | AI provider処理そのもの |
| Media service | MIME、size、orientation、安全な保存、派生asset | Record ownerの独自判定 |
| Owner policy | 一覧、詳細、編集、status、retryの共通認可 | UIごとの個別例外 |
| AI request service | enqueue、idempotency、attempt、retry、state | AI候補の自動確定 |
| AI consumer/provider | media取得、解析、schema validation、result writeback | 公開・公式確定 |
| Claim service | 候補、本人採用、reviewer確認、履歴 | 元AI evidenceの削除 |
| Place resolver | exact internal point、uncertainty、hierarchy、candidate/confirmed | exact pointの公開 |
| Public projection | rights、visibility、precision、sensitive、moderation | private原本の透過返却 |
| Presentation UI | 状態・次操作・Place価値の表示 | server状態の推測 |
| Release layer | exact SHA、build identity、staging/production gate、rollback | runtime source不明のまま成功扱い |

## 8. Transaction・idempotency契約

理想的な単一DB transactionが技術境界上不可能な場合も、利用者から見た整合性をoutbox／ledgerで保証する。

最低契約:

1. capture session IDを生成する。
2. client idempotency keyを固定する。
3. media uploadごとにcontent hashまたはstable upload tokenを持つ。
4. Record createは同じkeyで同じRecord IDを返す。
5. owner linkが欠損したRecordをpublic-readyにしない。
6. AI request作成失敗は`enqueue_pending`としてledgerに残す。
7. retry workerがRecord／media／ownerをread-backしてからenqueueする。
8. 重複consumer実行はcompare-and-swapまたはunique constraintで一結果へ収束する。
9. public projectionはRecord確定・rights確定前に生成しない。
10. orphan診断をread-onlyで実行できる。

診断分類:

- media_only
- record_without_owner
- record_without_media
- record_without_ai_request
- ai_request_without_result
- result_without_claim
- claim_without_public_projection
- public_projection_without_active_rights
- place_membership_missing
- conflicting_primary_place

## 9. 失敗・再試行・復旧

| 失敗 | 利用者表示 | 自動処理 | 手動復旧 |
|---|---|---|---|
| camera拒否 | カメラを使えません。端末の写真を選べます | なし | gallery選択または設定を開く |
| 位置拒否 | 位置なしで保存します | location_state記録 | 後からPlace追加 |
| upload切断 | 写真を送信できませんでした | bounded retry / outbox | 再送、端末保存、破棄 |
| Record commit失敗 | 記録の保存を完了できませんでした | idempotent retry | 再送。重複作成しない |
| AI enqueue失敗 | 保存済み。AIの準備をやり直します | outbox retry | owner再解析 |
| provider timeout | 解析できませんでした。もう一度試せます | retry policy | owner再解析 |
| provider terminal | AIで整理できませんでした。手動で入力できます | なし | 手動編集 |
| result writeback失敗 | 解析結果を保存できませんでした | idempotent writeback retry | owner再解析は元requestと競合しない |
| Place曖昧 | 場所の候補があります | candidate保存 | ownerが選択・検索 |
| public projection抑止 | 非公開または安全確認のため地域図鑑には表示されません | reason code保存 | 公開範囲・位置・rightsを確認 |
| owner認可不一致 | 編集できません | security log | login／claim／support導線 |

全失敗にpublic-safe reason codeを持たせる。画面文言と内部errorを一対一にしすぎず、secret・private locatorを露出しない。

## 10. Offline契約

P0最低要件:

- capture後、server確定前の素材を端末draft/outboxへ保持する。
- `pending_local`、`uploading`、`server_saved`を区別する。
- online復帰後、同じidempotency keyで再送する。
- 別ユーザーでloginした場合、前ユーザーのdraftを表示しない。
- guest draftをlogin userへ引き継ぐ場合は明示・原子的にrekeyする。
- draftの期限、端末使用量、破棄操作を表示する。
- OSによるstorage evictionを想定し、「端末に永久保存」と約束しない。
- production browser write QAを行う場合、テストRecordとcleanup境界を事前定義する。

## 11. Privacy・安全

### 公開既定

- 利用者体験上は公開を選びやすくできるが、正確な位置、人物、子ども、学校、自宅、私有地、希少種、施設規則を自動公開しない。
- public precisionはPlace／Zone／cellを基本とし、exact pointを既定にしない。
- 撮影位置と対象位置を同一と断定しない。
- EXIFは原本保持方針と公開派生除去を分ける。

### sensitive gate

最低判定対象:

- 自宅または住宅敷地
- 学校・保育・子ども関連
- 人物・顔・車両番号・個人情報
- 私有地・立入制限
- 医療・福祉・避難関連の機微情報
- 希少種・営巣・繁殖場所
- 施設の撮影・公開規則
- 事故・事件・脆弱性につながる情報

AIはsensitive候補を出せるが、自動的に「安全」と確定しない。

### 訂正・削除

- ownerは公開停止を即時要求できる。
- public projectionはwithdrawalを速やかに反映する。
- 原本の物理削除は、監査・法的保持・派生・backupとの関係を別手順で扱う。
- 通報、訂正提案、Place所属訂正を分ける。

## 12. 端末・ブラウザテスト

### 必須実機／実ブラウザ群

| 群 | 最低対象 | 重点 |
|---|---|---|
| Android | Pixel相当の現行Chrome、360×640、390×844、412×915 | getUserMedia、権限拒否、戻る、PWA、画像向き、通信切断 |
| iPhone | Safari、320×568、375×667、390×844 | camera capture、photo picker、HEIC、safe area、storage、WebKit |
| Tablet | 768×1024 | panel、keyboard、orientation |
| PC | Chromium 1280×720 / 1440×900、WebKit相当、可能ならFirefox | gallery upload、keyboard、drag/dropがある場合、responsive panel |
| Wide | 1920×1080 / 2560×1440 | 最大幅、画像解像度、空白、panel overflow |

### P0 E2Eケース

1. login userがカメラ撮影する。
2. 位置を許可する。
3. uploadとRecord保存が完了する。
4. 自動でowner detailへ遷移する。
5. AIがqueued→analyzing→needs_reviewまたはidentifiedへ進む。
6. 候補を採用または変更する。
7. 公開範囲とpublic precisionを確認する。
8. Place confirmedまたはcandidateを確認する。
9. Home／自分／記録一覧に一件として現れる。
10. Place profileへpublic-ready Recordが一件として現れる。
11. privateへ変更するとpublic profileから消える。
12. exact coordinateとowner identityがpublic response／DOMへ出ない。

### 失敗E2Eケース

- camera permission拒否→gallery選択
- geolocation拒否→位置なし保存→後からPlace追加
- upload中offline→outbox→online再送
- API response loss→同key再送→重複なし
- AI provider timeout→failed_retryable→再解析成功
- AI terminal→手動編集で完了
- Place boundary付近→candidate→手動確定
- 他人Recordの編集／status／retryが拒否される
- private RecordがPlace public profileへ出ない
- `/learn`、`/ja/contact`、主要navigationが200／意図したredirect

## 13. Accessibility・UI品質

- mobile touch targetは最低56pxを基本とし、少なくとも44pxを下回らない。
- 状態を色だけで示さない。
- progress、error、retryをscreen readerへ通知する。
- camera／location permissionの説明を操作前後で読める。
- focus orderは写真→状態→主操作→編集→詳細。
- fixed header／bottom navと主操作が重ならない。
- 320pxで横スクロールを発生させない。
- image aspect ratio、orientation、fallbackを維持する。
- polling中もfocus、入力、button stateを壊さない。
- reduced motionを尊重する。

## 14. Observability

個人情報を含まない最低イベント:

- capture_opened
- camera_permission_result
- gallery_selected
- location_result
- upload_started / succeeded / failed
- record_commit_succeeded / failed
- ai_enqueued / started / needs_review / identified / failed
- retry_requested / retry_succeeded / retry_failed
- edit_opened / edit_saved / edit_conflict
- place_candidate_shown / confirmed / corrected
- public_projection_ready / suppressed / withdrawn
- help_opened / contact_opened

禁止:

- exact coordinateをanalyticsへ送る
- image内容、自由記述、候補名を汎用analyticsへ送る
- email、user ID、Record IDをそのまま外部計測へ送る
- provider error bodyやsigned URLをlogへ出す

## 15. Release gate

### Source gate

- latest `main`から専用branchを作る。
- migration、runtime、tests、docsの整合を確認する。
- P0を一度に巨大変更せず、vertical sliceでmerge可能にする。
- source testがgreenでもruntime READYとはしない。

### Staging gate

同じexact SHAで次を完了する。

1. dry-run
2. deploy
3. runtime identity read-back
4. health / ready
5. authenticated P0 E2E
6. failure・retry E2E
7. Place public projection
8. responsive / Visual QA
9. `/learn`、`/ja/contact` route smoke
10. DB・R2に作成したテストデータとcleanup方針の記録

### Production gate

- productionは別の明示承認が必要。
- stagingと同じsource tree／artifactを使用する。
- migration／backfillはroutine deployと分離する。
- production write QAは最小テストRecord、明示識別、cleanup承認境界を持つ。
- runtime source、Worker version、deployment、rollbackを記録する。
- HTTP 200だけでなく、owner detail、AI retry、edit、Place反映を確認する。

## 16. 完了判定

### `READY_P0`

次をすべて満たす。

- login userの新規Record E2EがAndroid、iPhone、PCで成功。
- owner、media、AI、edit、Place、public projectionが一つのRecordへ収束。
- retryable failureから利用者操作で回復できる。
- private／sensitive／exact locationがpublic面へ漏れない。
- `/learn`と`/ja/contact`がproductionで成立。
- stagingとproductionのexact source identityを記録。
- 未解決P0が0。

### `READY_WITH_LIMITS`

P0の主要体験は成立するが、P1制限がある。制限は利用者影響、対象端末、回避策、解消Issueを明示する。

### `NOT_READY_P0`

次のいずれかがある。

- owner不一致または本人編集不可
- 保存済みとAI完了の誤表示
- retry不能
- orphan Record／media／jobの再現
- private／exact locationの公開漏えい
- Place所属が無言で誤確定
- 主要route 404
- current SHAのstaging E2E未完了
- current production source identity不明

## 17. 現時点の判定

`NOT_READY_P0`

理由:

- latest main `298bfa16...`のstaging terminal closeoutが確認できない。
- Issue #1296は部分実装で、本文全体のE2E完了証拠が揃っていない。
- production `/learn`と`/ja/contact`の404継続記録がある。
- 現在のproduction source identityについて、中央registryと後続release記録の一致確認が必要。
- AI provider失敗→owner retry→成功、owner edit、Place public反映までの一続きのcurrent runtime evidenceが未確認。

## 18. P0で変更しないもの

- production DBの直接編集
- destructive migration
- secret、DNS、権限、課金
- 既存Recordの一括backfill
- AIによる自動公式確定
- exact locationの既定公開
- Universal Place Atlasの全面再設計
- 自治体固有システム
