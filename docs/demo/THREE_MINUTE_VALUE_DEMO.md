# ZUKAN 3分価値デモ設計

- 状態: `P0_DEPENDENT / NOT_READY`
- 基準日: 2026-07-28
- 関連仕様: `docs/spec/core-experience-p0/SPEC.md`
- 実施計画: `docs/spec/core-experience-p0/ZUKAN_EXECUTION_PLAN.md`
- READY条件: latest main exact-SHA stagingでP0 integrated E2Eがgreen
- current URL: `ikimon.life`
- 公開サービス名: `ZUKAN`

## 1. デモの目的

機能一覧を説明しない。一件の写真が、端末内の画像から、本人へ返るRecord、AI候補、人の確認、Placeの記憶へ変わるまでを見せる。

伝える結論:

> 何気なく撮った一枚が、場所と時間に結び付き、確かめられ、地域の次の記録へつながる。

## 2. 想定相手

- 自治体
- 学校・教育関係者
- 企業・自然共生・地域貢献担当
- 地域団体・施設
- 市民・参加者

同じデモを使い、最後の30秒だけ相手別に変える。

## 3. 事前条件

- ZUKAN P0 `READY_P0`
- exact staging runtime identityを表示できる
- test accountまたはguest flowが使える
- cameraまたは事前撮影mediaが使える
- Place candidateが存在する
- public-safe RecordがPlace profileへ反映できる
- failure時のfallback recordingがある
- demo Record・media・locationが公開安全

## 4. 3分台本

### 0:00–0:20　地域の現在は、あとから作れない

画面:

- ZUKAN HomeまたはPlaceの過去・現在

説明:

> 地域には、あとから検索しても戻らない現在があります。店、風景、生きもの、看板、行事、子どもの発見。ZUKANは、こうした記録を場所と時間に結び付け、次の人が確かめられる形で残します。

### 0:20–0:50　撮る

操作:

1. `撮る`
2. cameraまたは端末画像
3. 一枚撮影

説明:

> 専門知識や長い入力は先に求めません。まず撮ります。位置が取れない、通信が切れる場合も、Recordを失わない設計にします。

見せるもの:

- camera permission
- clear primary action
- optional location

### 0:50–1:15　保存され、本人へ返る

操作:

- upload progress
- Record詳細へ遷移

説明:

> 写真が保存されたことと、AIの処理が終わったことは別です。保存できたRecordは本人へ返り、処理中・確認待ち・失敗・再試行が分かります。

見せるもの:

- photo
- saved state
- owner-only processing state
- observed time
- safe Place表示

### 1:15–1:45　AI候補を、人が確かめる

操作:

- AI suggestionを表示
- accept、edit、reject、retryのどれか

説明:

> AIは名前や内容の候補を出しますが、勝手に確定しません。本人、先生、専門家、自治体担当者など、役割を持つ人が根拠を見て確かめます。

成功demo:

- suggestion_available → acceptedまたはneeds_review

failure fallback demo:

- failed_retryable → retry → suggestion_available

### 1:45–2:15　公開範囲と位置を守る

操作:

- private / limited / public requested
- public precision説明

説明:

> 正確な撮影位置は、Placeへの所属判定には使えても、そのまま公開しません。自宅、学校、子ども、人物、希少種、施設ルールを考慮し、一般には場所や安全な範囲として表示します。

見せないもの:

- exact coordinate
- private note
- contributor identity
- internal provider error

### 2:15–2:40　Placeの記憶へ積み重なる

操作:

- `この場所を見る`
- Place profile
- Record一件増加
- 過去・現在または周辺Record

説明:

> 一枚は、投稿欄へ流れて終わりません。この場所のRecordとして積み重なります。同じ写真を自治体別、学校別に複製するのではなく、共通のPlaceを地域Viewから読みます。

### 2:40–3:00　次の行動へつながる

共通説明:

> 情報が足りない場所はQuestになります。次の人が現地で確かめ、Reviewされ、必要なら地域や行政の正式な更新へ返ります。ZUKANは、完成済みの図鑑ではなく、地域の記録をみんなで育てる仕組みです。

相手別締め:

- 自治体: `公開データの不足を現地Recordで補い、正本更新へ返せます。`
- 学校: `今年の探究を、次年度の子どもが続けられます。`
- 企業: `拠点周辺の活動を地域へ返し、必要な専門reportだけを有償で作れます。`
- 地域団体・施設: `担当者が替わっても、Placeと根拠と訂正履歴が残ります。`

## 5. 必要画面

1. Home
2. capture sheet
3. upload progress
4. owner Record detail
5. AI suggestion / retry
6. edit / visibility / public precision
7. Place profile
8. Place timelineまたは関連Record
9. optional Quest / correction status
10. runtime identity・demo evidence（裏画面）

## 6. sample data

### Record

- 日常的だが場所の現在が分かる写真
- 顔、車番、住所、室内private情報なし
- Place候補が一つまたは安全なcandidate状態
- 撮影日時あり
- AIが候補を出しやすいが、人の確認余地がある

候補:

- 公園の季節変化
- 文化財の現在写真
- 店舗・施設の外観変化（公開許可確認済み）
- 学校外の地域景観
- 生きもの（希少種でないもの）

### Place

- public profileあり
- source・provenanceあり
- exact geometryをpublicへ出さない
- 過去Recordが一件以上ある

## 7. live失敗時のfallback

優先順:

1. staging live happy path
2. staging pre-created Recordを使い、AI retryだけlive
3. exact同一SHAで撮影済みの90秒screen recording
4. 8〜12枚のstep screenshots
5. static sample。必ず`操作デモではなく画面例`と表示

fallbackでも、source SHA、runtime SHA、撮影日時、Record ID、Place、公開状態、失敗理由を記録する。

動画構成:

- 15秒 capture
- 15秒 saved / owner
- 20秒 AI candidate / retry
- 15秒 edit / safety
- 15秒 Place profile
- 10秒 next Quest / writeback

## 8. FAQ

### iNaturalistや写真SNSとの違いは

生きものだけでなく、場所、文化、施設、仕事、行事等を同じPlace・Time・Evidenceモデルで扱う。投稿数を競わず、Review、訂正、正本還流、次年度引継ぎまでを対象にする。

### AIが間違えたら

AIは候補であり確定ではない。本人や役割を持つ人がaccept、edit、reject、専門Reviewを行う。処理履歴を残す。

### 位置は公開されるか

内部の正確な位置と、公開するPlace・Zone・cellを分ける。自宅、学校、未成年、人物、希少種、施設ルール等で抑止する。

### 自治体ごとに別systemか

別DB・別tenantにしない。共通Place Graphを対象地域・時点・theme・Programで読むViewとする。

### 学校・自治体・企業は有料か

標準Program、参加、Quest、同意、Review、引継ぎ、通常Viewは無料コア。専門report、種リスト、販促制作、coupon、個別integration・運営は有償。

### CSVは無料か

Record単位の原記録保全・移行は無料。場所・期間単位のspecies list、aggregate、提出用CSV・Excel・PDF・APIは有償派生物。

### `ikimon.life`とZUKANの関係は

公開サービス名がZUKAN。現在のURL・runtime・技術識別子は`ikimon.life`で、domain移行は別release計画。

### UTSUROUは

サービス名としてはsuperseded。`この場所のうつろい`はPlaceの時間変化を見る機能名として残せる。

## 9. 合格条件

- 3分以内
- 一件のRecordを中心に進む
- savedとAI completedを区別
- owner、edit、retryを実際に示す
- exact locationを表示しない
- Placeへ一回だけ反映
- AIを確定主体として説明しない
- 無料コアと有償派生物を一文で説明できる
- current URLとfuture domainを混同しない
- live失敗時にfallbackへ切り替えられる

## 10. 現時点判定

`NOT_READY`

理由:

- strategy ZUKAN definition adoption pending
- P0 docs sync Draft
- #1459 latest main rebuild pending
- exact-SHA staging P0 E2E pending
- current route blocker resolution evidence absent
