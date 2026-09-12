# 外来種・バイオセキュリティ — Service Surface / Prompt / Shared Data Boundary

- Status: `CANONICAL DESIGN SUPPLEMENT after merge`
- Date: 2026-09-13 JST
- Parent: `SPEC.md`
- Cost boundary: `AI_INFERENCE_COST_BOUNDARY.md`

## 0. Decision

外来種の市民参加体験は、利用者からは独立した専門サービスに見えるsurfaceとして提供してよい。

ただし、別サービスに見せることと、別データ基盤・別認証・別AI常駐系を作ることは分ける。

> **Surface / conversation / guidance は外来種専用。Record / Media / Place / Evidence / Claim / Rights / Review / Case / Action はZUKAN共通。**

ZUKAN本体の汎用AI promptへ外来種の専門指示や全Target Profileを常時混ぜない。外来種surfaceへ入った時だけBiosecurity専用promptを使用する。

## 1. Service appearance

外来種surfaceは、通常のZUKAN地域記録画面とは情報設計・語彙・導線を分ける。

利用者には次が明確であること。

- ここは外来種・病害虫等の発見、記録、確認、公式窓口案内に特化した体験である
- ZUKANの通常投稿より専門的な撮影ガイド、類似種、痕跡、注意事項を持つ
- AI・人Review・行政受付を同じものとして表示しない
- ZUKAN基盤を利用していることはprivacy、rights、account、record provenance上隠さない

独立感のために別DB、別session、別upload stack、別Place modelを作らない。

## 2. URL / origin policy

初期のcanonical surfaceは同一origin配下を優先する。

```text
zukan.earth/invasive
zukan.earth/invasive/:target
```

クビアカの既存入口は必要に応じてalias/redirectとして扱える。

```text
zukan.earth/kubiaka
→ zukan.earth/invasive/kubiaka
```

理由:

- account/sessionを複製しない
- upload / receipt / rights / CSP / analytics / SEOの境界を増やさない
-同じWorker / Record Core / media pipelineを利用できる
- canonical URLとindexingを一箇所へ固定できる

将来、ブランド上 `invasive.zukan.earth` の価値が実需要で証明された場合も、別backendを作る理由にはしない。同じcanonical service contractへroute/redirectすることを先に検討する。

## 3. Prompt architecture

### 3.1 ZUKAN generic prompt

通常の `zukan.earth` は地域の写真、資料、環境、自然、文化、活動等を扱う広い記録体験である。

通常promptへ次を常駐させない。

- 外来種全一覧
- 種ごとの見分け方
- 行政通報ルール全文
- 外来種専用の安全・対応instructions
- 全Target Profileのprompt断片

通常ZUKAN投稿だけを理由にbiosecurity専用推論を起動しない。

### 3.2 Biosecurity domain prompt

外来種surfaceでは、一つのversioned Biosecurity domain promptを使う。

Domain promptが固定する責務:

- 画像・位置・時刻等のEvidenceを区別する
- 観察Recordと対象種Claimを分ける
- AI候補、人Review、行政受付を分ける
- 根拠不足時は追加Evidenceを求められる
- 画像だけから不在、根絶、安全を主張しない
- 公式通報を勝手に実行・完了扱いしない
- 生体運搬等、対象domainの共通安全境界を守る
- structured assessment contractを返す

対象種数が増えても、このdomain prompt自体へ全種情報を追記し続けない。

### 3.3 Target Profile context

対象固有差分はprompt本文ではなくversioned Target Profileとして必要時だけ注入する。

例:

```text
profile_id
subject_scope
signal_types
evidence_roles
lookalikes
capture_guidance
minimum_evidence
review_policy
safety_guidance
regional_policy_refs
```

`/invasive/kubiaka` なら原則 `kubiaka-watch` だけをcontextへ入れる。

1000 Target Profileが登録されていても1000 profileをpromptへ投入しない。

### 3.4 Regional policy context

地域の公式方針、管轄、連絡先、対象状態はSource/Policy dataから必要な範囲だけ注入する。

AIモデルの記憶を行政ルールの正本にしない。

### 3.5 Record context

各推論へ渡すRecord contextも必要最小限とする。

- assessment対象asset
- observed time
-必要なlocation precision / jurisdiction candidate
- user-provided signal
- relevant prior assessment only
- relevant Target Profile / regional policy version

無関係なZUKAN履歴、他のTarget Profile、他ユーザー情報をpromptへ入れない。

## 4. Unknown-target entry

利用者が種名を知らなくても使える一般入口を持てる。

```text
/invasive
→ 「気になる生き物・痕跡を記録」
→ common capture
→ bounded biosecurity assessment if requested/eligible
→ candidate taxon/group
→ local registry/policy match
→ relevant Target Profile only
```

未知対象のために `active profile × prompt` を実行しない。

候補生成は一回のbounded assessmentまたは既存の生物候補結果を使い、その後にtaxon/region/policy registryをdeterministic lookupする。

候補がTarget Profileに一致しなくてもRecordはZUKANの地域記録として保持できる。外来種でないと断定する根拠がなければ、単に専用workflow対象外とする。

## 5. Shared data contract

外来種surfaceから保存したデータもZUKAN共通CoreのRecordである。

```text
Record
├─ Media / Evidence
├─ Place / Entity / Subject
├─ entry_context
│  ├─ service_surface = invasive
│  ├─ domain = biosecurity
│  └─ target_profile optional
├─ Claim / ClaimRevision
├─ Rights / Consent
├─ Review / Authority
└─ Case / Action / Follow-up optional
```

`service_surface` や `target_profile` はRecordの由来・専門文脈であり、canonical species truthではない。

同じRecordを、権利条件を満たす場合に次へ再利用できる。

- 外来種専門receipt / history
- 一般ZUKANの地域・環境記録
- 同じPlace/Subjectの時系列
- Program / Quest / 学校活動
- operator monitoring
- rights-safe Publication / dataset

再利用時に写真・位置・観察日時を複製しない。用途ごとのProjection / Publication / Caseを作る。

## 6. Environmental data connection

外来種情報を独立サイロにしない。

同じPlace / Time / Subjectを通じて、ZUKANが保持する他の環境記録と接続できる。

例:

```text
Place: 公園A
├─ サクラ個体 #123
│  ├─ 2026-05 開花記録
│  ├─ 2026-07 フラスRecord
│  ├─ クビアカ候補Claim
│  ├─ 2026-08 処置Record
│  └─ 2027-06 再訪Record
├─ 植生記録
├─ 景観写真
└─ Program参加記録
```

外来種surfaceはこのうちbiosecurityに必要なProjectionだけを見せる。通常ZUKANはrights-safeな地域記録として別のProjectionを見せられる。

## 7. AI cost implication

この分離により、ZUKAN generic promptのtoken/context量をTarget Profile数に比例させない。

- generic ZUKAN request: biosecurity prompt/profile = 0
- `/invasive` generic entry: Biosecurity domain prompt + bounded candidate discovery
- `/invasive/kubiaka`: Biosecurity domain prompt + Kubiaka Profile only
- follow-up review: persisted assessmentを優先し、必要差分だけ再評価

新しい外来種をTarget Profileへ追加しただけでは既存Record再解析を起動しない。

## 8. Brand / UX boundary

専門サービス感は次で作る。

- distinct service title / wordmark area
- biosecurity-specific navigation
- target-specific hero / photography guidance
- lookalike cards
- alert / report status UI
-専門家・行政sourceの明示

ただし次はZUKAN共通を維持する。

- accessibility foundation
- design tokens / components
- account / language / privacy controls
- media capture primitives
- receipt truthfulness
- rights / consent semantics
- Place / Record identity

専用感のために第二のDesign Systemを作らない。

## 9. Non-goals

今は作らない。

- 別会社・別製品としての独立auth/backend
- speciesごとのsystem prompt
- speciesごとのAI service
- 全Target Profileをgeneric ZUKAN promptへ注入
- 全ZUKAN Recordの外来種常時screening
- biosecurity専用のRecord database
- ZUKAN general promptを生物専用promptへ変更

## 10. Acceptance invariants

- 外来種surfaceは通常ZUKANとは異なる専門体験として理解できる。
- URLはzukan.earth配下でcanonical化できる。
- 通常ZUKAN promptは外来種Target Profile数によって肥大化しない。
- Biosecurity promptは外来種surfaceだけで使用される。
- Target Profileは必要なものだけcontextへ入る。
- 外来種surfaceのRecordはZUKAN共通RecordとしてPlace/Time/Rightsを保つ。
- 同じ原Recordを環境記録と外来種workflowの双方から参照できる。
- profile追加のみではAI推論、過去Record再解析、外部送信を起こさない。
