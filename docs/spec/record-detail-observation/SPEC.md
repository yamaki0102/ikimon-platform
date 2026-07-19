# SPEC — Record / Observation / Identification / Occurrence / Environment

## 1. Scope

本仕様は、記録詳細ページとその背後にある次のproduct contractを定義します。

- 1 record内の複数観察
- mediaとobservationの関連
- 保存後の非同期AI解析
- provisional observation
- community identification
- occurrenceへの科学データ投影
- ペット、個体不明、群れ
- AI環境推定
- site / place monitoring
- 公開位置保護

物理テーブル名、API path、UI copyは実装PRで確定できますが、意味論と昇格境界は本仕様に従います。

## 2. Entity contract

### 2.1 Record

`record`は投稿・収集単位のコンテナです。

含められるもの:

- 投稿者
- observed_at
- place / location source
- public visibility
- note
- 1..N media
- 0..N observations
- AI jobと解析結果
- privacy decision

`record`自体を「1生物のoccurrence」とみなしません。対象生物が判別できない環境写真、音、足跡、空の記録も保存できるため、`record → observations`は`0..N`です。

### 2.2 Media

`media`は写真、動画、音声等のassetです。

- 1 recordに属する
- 1つ以上のobservationへ関連付けられる
- 同じmediaを複数observationが参照できる
- observationは複数mediaを参照できる
- crop、region、time range等のsubject locatorを持てる

`observation`と`media`は多対多です。1枚の集合写真や、同じ個体を複数方向から撮った記録を表現できます。

### 2.3 Observation

`observation`は「このrecordの中で、観察対象として分けて扱うもの」です。

例:

- 前景の蝶
- 蝶が止まっている植物
- 写真内の群れ
- 飼育されている犬
- 種は不明だが独立した1対象
- 個体数を確定できない鳴き声群

最小属性:

- observation ID
- record ID
- origin: `user | ai | import | system`
- lifecycle: `provisional | confirmed | excluded`
- subject type: `organism | group | trace | sound | unknown_subject`
- individual certainty: `individual | group | unknown`
- captive / cultivated / pet等のcontext
- media linksとsubject locator
- provenance
- created_at / reviewed_at

AIは`provisional` observationを自動作成できます。

AI単独では`confirmed`へ昇格できません。昇格には投稿者確認、community合意、reviewer判断等、AI以外の有効なhuman provenanceが必要です。

### 2.4 Identification

`identification`はobservationに対する分類・同定の主張です。

- 1 observationへ0..N件
- taxonだけでなく`unknown`、粗い分類、ペット等のcontextを許容
- source: `submitter | community_member | reviewer | ai`
- status: `candidate | accepted | rejected | withdrawn`
- confidenceと根拠を持てる

AI identificationは候補として保存できますが、AIだけでは`accepted`にしません。

accepted identificationはobservationごとに最大1つをactiveとし、変更履歴と過去候補を消しません。

### 2.5 Community identification

公開recordのobservationは、投稿者が募集操作をしなくてもcommunity同定の対象です。

- 「みんなに聞く」ボタンや募集状態を実装しない
- public visibilityとparticipation policyから同定可否を決める
- 投稿者が明示募集しなかったことをcommunity参加拒否と解釈しない
- AIの推論・候補・confidenceをcommunity票数へ含めない
- 投票、reviewer判断、投稿者判断を区別してprovenanceを保持する
- 荒らし、組織票、低品質連投へのtrust / rate / moderation contractを別途適用する

### 2.6 Occurrence

`occurrence`はobservationから生成される科学データ用の派生投影です。

`occurrence`を写真内subject、AI候補、投稿UIの観察対象、Darwin Core exportの全責務へ兼用しません。

active occurrenceの最小条件:

- source observationが`confirmed`
- accepted identificationが存在する、または科学的に許容されたcoarse / unknown contractを満たす
- location / time / rights / privacy / quality gateが評価済み
- AI以外のhuman provenanceが存在する
- active projectionとして明示的に生成または更新される

AIだけではactive occurrenceを作りません。

provisional observationが存在しても、active occurrence、GBIF候補、研究利用可能データが存在するとは限りません。

occurrenceは再生成可能なprojectionとし、source observation、accepted identification、privacy rule version、quality rule version、projection versionを追跡します。

### 2.7 Research-use projection

研究、GBIF、TNFD等の外部利用はactive occurrenceよりさらに厳しいgateを持てます。

最低限:

- rights / consent
- location precision policy
- evidence tier
- provenance
- accepted identification quality
- export policy
- revocation / correction path

「publicページに表示できる」と「研究利用できる」を同一視しません。

### 2.8 Environment assessment

`environment assessment`は写真、音、時刻、場所、気象・地形等から得る推定・観測値です。

- source record / media / placeを参照できる
- AI推定、外部データ、sensor、人入力を区別する
- confidence、model / rule version、input provenanceを持つ
- 生息環境、植生、水辺、人工物、天候等の候補を保持できる
- AI結果はprovisional assessmentであり、siteの長期状態を直接上書きしない

### 2.9 Monitoring

`monitoring`はsite、place、field、project等を対象とする継続時系列です。

- 複数record、occurrence、environment assessment、sensor、human reviewから集約する
- 集約条件、期間、欠測、抑制、privacy、consentを持つ
- AI環境推定とは別entity / read model / governanceにする
- 1回のAI推定をmain monitoring valueとして直接確定しない

## 3. Relationship contract

```text
record 1 ── 1..N media
record 1 ── 0..N observation
observation N ── N media
observation 1 ── 0..N identification
observation 1 ── 0..N occurrence projection versions
observation 1 ── 0..1 active occurrence
record / media / place 1 ── 0..N environment assessment
site / place / project 1 ── 0..N monitoring series
```

同じ写真内の別subjectと、同じsubjectに対する代替taxon候補を分離します。

- 別subject: observationを分ける
- 代替候補: 同じobservationのidentification候補として保持する

## 4. Save and AI pipeline

### 4.1 User-facing save

投稿保存はAI解析完了を待ちません。

1. recordとmediaをdurableに保存
2. 必要な初期observationを保存
3. privacy-safeなrecord詳細へ遷移
4. AI解析jobを非同期enqueue
5. UIは解析待ち、解析中、候補あり、要確認、失敗を区別して表示

AI障害でrecord保存を失敗扱いにしません。

### 4.2 AI analysis

AIは次を行えます。

- multi-subject detection
- subject locator生成
- 既存observationとのmatching
- provisional observation作成
- identification候補作成
- coexisting taxa候補
- visual subject rescue
- 環境assessment候補
- 注意事項や追加撮影suggestion

冪等性を持ち、同じinput / model / prompt / rule versionの再実行で重複observationを無制限に増やしません。

AIのmerge / split判断は履歴を残し、人が訂正可能にします。

### 4.3 Promotion boundary

AI job成功は次の成功を意味しません。

- confirmed observation
- accepted identification
- active occurrence
- research-use eligibility
- monitoring confirmation

各昇格は別の状態遷移と監査証跡を持ちます。

## 5. Record detail UI contract

記録詳細ではrecordとobservationを混同しません。

最低表示:

- record media gallery
- record contextと公開範囲
- observation list
- observationごとの関連media / region
- lifecycleとorigin
- identification候補とaccepted状態
- AI解析状態とhuman confirmationの違い
- community activity
- environment assessment
- monitoringへの反映有無
- privacy-safe location

### 5.1 Multiple observations

- 0件: 環境記録、解析待ち、対象不明等として成立
- 1件: 一般的な単一subject
- 複数件: 写真内の複数生物、群れと背景植物、主対象と共存種等

ユーザーはobservationの追加、分割、統合、除外、media再関連付けを行えます。操作はsource historyを残します。

### 5.2 Pet / captive / unknown / group

- ペットや飼育個体を野生occurrenceと誤投影しない
- captive / cultivated contextを表示・保持する
- 個体を区別できない場合は無理に個体IDを作らない
- 群れはgroup observationとして扱い、countはexact / estimate / range / unknownを区別できる
- taxon不明でもobservationを保持できる

## 6. Location protection

全公開面は共通のlocation protection service / policyを使います。

対象:

- record detail
- observation detail
- cards / feeds
- map
- search
- API
- structured data
- image metadata / downloadable assets
- area profile / monitoring
- export

保護判断は少なくとも次を考慮します。

- privacy / visibility
- rare or sensitive species
- home / school / minors
- private land
- contributor consent
- civic public precision
- research export policy

UIだけを丸め、API、HTML attribute、JSON-LD、画像metadataからexact locationが漏れる状態を許容しません。

## 7. Audit and provenance

重要状態には次を追跡します。

- actor typeとactor ID
- source
- before / after
- reason
- model / prompt / rule version
- source media / observation / identification
- timestamp
- related Issue / PR / migration / backfill run

候補や過去判断を履歴から消さず、active状態と区別します。

## 8. Compatibility and migration

既存occurrence中心の実装から一括置換しません。

必須順序:

```text
expand
→ dual-write
→ backfill
→ shadow-read
→ cutover
→ contract
```

- `expand`: 新entity / columns / mappingをadditiveに追加
- `dual-write`: 旧経路と新経路を同じtransaction / outbox contractで同期
- `backfill`: provenance付きで既存dataを変換し、曖昧なものを自動確定しない
- `shadow-read`: 新read modelを比較し、差分理由を分類
- `cutover`: gateを満たしたread / write単位だけ切替
- `contract`: rollback windowと監査完了後に旧責務を縮小

## 9. Acceptance criteria

- 1 recordへ0..N observationsを保存・表示できる
- observationとmediaの多対多が往復可能
- AIは保存後に非同期実行される
- AIがprovisional observationを作成できる
- AIだけではconfirmed / accepted / active occurrence / research-useへ昇格しない
- community同定は募集操作なしで機能する
- AIがcommunity vote countへ入らない
- pet、unknown individual、groupを表現できる
- environment assessmentとmonitoringが別状態として確認できる
- 全公開surfaceの位置保護回帰testがある
- migration各段階にrollback、metrics、差分ledgerがある
- 旧occurrence中心contractが現行仕様として参照されない

## 10. Non-goals

- 本仕様だけでDB schemaやAPI名を即時固定すること
- AIを最終reviewerにすること
- community募集ボタンを追加すること
- public visibilityを研究利用同意として扱うこと
- 既存dataを曖昧なまま自動確定すること
- AI環境推定をsite monitoringへ直接上書きすること
