# ZUKAN クビアカツヤカミキリ見守り — 2026国防除戦略 Alignment

- Status: `PROPOSED / merge activates this amendment`
- Date: 2026-09-13 JST
- Parent contract: `SPEC.md`
- Parent plan: `PLAN.md`
- Design canonical: `../../../DESIGN.md`
- Current source base: `c6b983443a250937bc7c1ea70a57b4893a83275a`
- Runtime note: dedicated Kubiaka PostgreSQL/runtime boundary was retired by platform PR #1602; this document does not restore that retired boundary.

## 0. Decision

クビアカ専用体験を、従来の「写真を安全に残し、確認できた範囲を返す」だけでなく、国の2026年9月11日防除戦略に沿う市民参加の早期発見・通報支援へ更新する。

既存の `Receipt-first, Map-later` は捨てない。次の形に意味を明確化する。

> **保存を先に。通報は明示的に。地図は後段。**

利用者の基本Journeyは次とする。

```text
見つける
→ 写真と場所を安全に残す
→ AI候補 / 人の確認を区別して返す
→ 自治体へ知らせるための情報を整える
→ 利用者が明示的に公式窓口へ送る / 連携先へ送信を承認する
→ 受付・確認状態をZUKAN保存状態と分離して表示する
→ 必要なら再訪・追加撮影する
```

ZUKANは行政機関を装わず、公式通報の成立を先取りしない。

## 1. Why now

環境省・農林水産省は2026年9月11日に第2回クビアカツヤカミキリ対策本部を開催し、防除戦略を示した。国・都道府県・市町村・土地所有者等の役割を分け、市町村を被害状況に応じて区分し、住民からの成虫・フラス等の発見情報を早期把握につなげる方向が明確になった。

ZUKANにとって重要なのは、投稿量を増やすことではなく、次を成立させること。

1. 市民が迷わず記録できる。
2. 位置・日時・写真・兆候が通報に使える形で残る。
3. ZUKANへの保存と行政への通報状態が混同されない。
4. 自治体・学校・施設管理者が再訪・モニタリングへつなげられる。
5. 地域区分に応じて必要な行動を変えられる。

## 2. Public landing `/kubiaka`

### Primary copy

H1:

> クビアカツヤカミキリを見つけたかも？

Lead:

> 赤い首の黒い虫、サクラやウメの根元の木くず、木の異変を見つけたら、写真と場所を残してください。確認できた内容を整理し、必要なら自治体へ知らせる準備までできます。

Primary CTA:

> 写真を送る

Secondary action:

> 見分け方を見る

Trust line:

> ログイン不要。ZUKANへの保存と自治体への通報は別です。通報したことになった場合だけ、その状態を明示します。

Safety:

> 虫には触れず、生きたまま持ち運ばないでください。私有地や車道など危険な場所には入らないでください。

### Page structure

1. Hero — 1 primary CTA
2. `見つける` — 成虫 / フラス / 木の異変
3. `残す` — 何を何枚撮るか
4. `知らせる` — ZUKAN保存と公式通報の違い
5. `広げない` — 生体運搬をしない、安全な対応
6. `この地域の連絡先` — official-source backed only
7. `国の防除戦略` — source/date付き短い説明
8. FAQ / privacy / data use

巨大な説明、複数の同格CTA、専用テーマは作らず `DESIGN.md` の共通token/componentを使う。

## 3. Capture contract

専用カメラ基盤は作らない。現在のZUKAN共通Capture Loopを再利用し、Kubiaka contextだけをserver-authoritativeに付与する。

Required input:

- photo: 1–6
- captured/observed date-time
- approximate location or current Place
- sign type: `adult_insect | frass | tree_damage | unknown`
- optional note

Recommended photo roles:

- surroundings
- whole_tree
- trunk
- base
- adult_insect
- adult_detail
- frass
- exit_hole
- damage_sign

Locationは本人・operatorには必要精度で保持できるが、public表示へそのまま出さない。

## 4. Status truthfulness

状態は直列の一語に潰さず、最低限次を区別する。

### Record

```text
saving | saved | failed
```

### Assessment / review

```text
not_started | ai_candidate | human_reviewed | needs_more_evidence | failed
```

### Official reporting

```text
not_started
report_ready
handoff_opened
submission_confirmed
acknowledged
failed
unknown
```

Rules:

- `saved` != `submission_confirmed`
- 公式窓口ページを開いただけで `submission_confirmed` にしない
- AI候補を `human_reviewed` にしない
- 送信receipt/API acknowledgement等のEvidenceがない限り「自治体へ通報済み」と表示しない
- partner APIがない地域では、通報用情報を整え、公式窓口を案内するところまでをZUKANの責務とする

## 5. Report-ready package

利用者が自治体へ知らせやすいよう、保存済みRecordから次を生成する。

```text
観察日時
場所（通報に必要な精度）
兆候の種類
写真
短い状況説明
AI候補とその不確かさ
人Reviewの有無
ZUKAN record/receipt reference
```

これは「行政向け正式様式」とは称さない。自治体の指定様式/APIがある場合だけadapterで変換する。

## 6. Municipality zone awareness

国戦略の区分をproduct上で表現可能にする。

```text
unaffected        = 未被害地域
isolated_outbreak = 飛び地的被害地域
front_line        = 被害最前線地域
widespread        = まん延地域
unknown           = 公式区分未取得
```

重要ルール:

- 投稿数、AI判定、ZUKAN内の分布から自治体区分を推定しない
- 国・都道府県・市町村等のofficial source + edition/dateを保持した場合だけ区分を表示する
- `unknown` を欠損ではなく正直な状態として扱う
- 区分ごとの行動説明はofficial policy editionへ紐づける

## 7. Area / map decision

従来どおりraw detection pinのpublic mapはP0にしない。

一方、国戦略では被害状況の可視化、モニタリング、地域単位の計画が重要になったため、`Map-later` は「地図不要」ではなく「通報体験とprivacyを成立させた後に、目的別read modelとして作る」の意味に更新する。

Order:

1. 個人receipt / record
2. operator・partner向け再訪 / monitoring list
3. municipality strategy / coverage read model
4. privacy-safe public aggregate view — separate decision after real partner evidence

public mapにexact coordinate、個人識別、単発Recordの生位置を出さない。

## 8. Municipality / school / facility use

同じRecordを複製せず、Workspace / Program / Place側から次を扱えるようにする。

- 対象樹木・地点の巡回
- 住民発見情報の確認
- 追加写真依頼
- 同じ木・場所の再訪
- monitoring freshness
- official zone/source edition
- 対応メモ / task
- 集計・報告用のrights-safe export

学校利用では、自由研究や観察活動と公式通報を分離する。児童の投稿が自動的に行政通報・public位置公開される設計にしない。

## 9. Source and visual content

一次情報は環境省・農林水産省を優先する。

Current reference set at this amendment:

- 環境省「クビアカツヤカミキリ対策本部」2026-09-11 materials
- 環境省「クビアカツヤカミキリ資料集」
- 農林水産省「第2回クビアカツヤカミキリ対策本部の開催について」2026-09-11

環境省のクビアカ写真資料ページで再利用条件が明示された写真は、その条件と「環境省提供」creditを守って使用可能な候補とする。権利条件をasset metadataに保持する。

## 10. Current-runtime migration rule

旧Kubiaka PostgreSQL runtimeを復活させない。

Implementation starts from fresh current main and current active Cloudflare runtime. Reuse in this order:

1. current ZUKAN Capture Loop / Record / Media / Place / Rights
2. current Cloudflare Worker / D1 / R2 bindings and existing native deployment path
3. current Design System
4. old Kubiaka implementation only as behavior/test evidence

旧route/serviceをそのままcherry-pickしない。必要な差分だけcurrent runtimeへ再実装する。

## 11. First implementation slice

最初のVerified Outcomeは次だけに絞る。

```text
/kubiaka landing + guide
→ common captureを使うKubiaka-context record
→ private receipt
→ report-ready package
→ official contact/handoff
```

Acceptance:

- mobile 320px–desktopで操作可能
- 1 primary CTA
- no-login first contribution
- 1–6 photos
- Record save truthfully evidenced
- save/report state separated
- official contact has source + checked date
- no auto external send
- no public exact-location pin
- AI does not claim identification certainty
- current common Capture Loop is reused, not forked

Not in first slice:

- public map
- automatic municipality routing
- generic Focused Experience framework
- SLA promise
- survey non-detection
- inferred municipality zone
- new scheduler/control plane

## 12. Supersession intent

If this amendment is merged:

- `SPEC.md` remains the base Kubiaka contract, with this document overriding only product purpose, report handoff, national-zone awareness, map rationale and current-runtime migration direction where they conflict.
- old implementation sequencing in `PLAN.md` that assumes restoration of the retired PostgreSQL Kubiaka boundary becomes historical and must be replaced by a fresh current-main implementation plan before code execution.
- privacy, asset accounting, review-authority, non-detection and guest/shared-device safeguards in `SPEC.md` remain valid unless explicitly superseded later.
