# 市民参加型バイオセキュリティ — AI / API Cost Boundary

- Status: `CANONICAL DESIGN SUPPLEMENT after merge`
- Date: 2026-09-13 JST
- Parent contract: `SPEC.md`
- Surface/prompt boundary: `SERVICE_SURFACE_AND_PROMPT_BOUNDARY.md`
- Scope: invasive-species / citizen-biosecurity AI inference and external AI API usage only

## 0. Decision

Target Profile数とAI/API実行回数を比例させない。

> **Profile追加は原則0 inference。AI費用はRecord起点・必要時のみ発生させる。**

対象種が10、100、1000へ増えても、Profile登録自体、地域policy登録、見分け方、撮影ガイド、連絡先、rights、routing ruleの読取りは通常のDB/cache処理で完結させる。

通常のZUKAN投稿へ「外来種全件screening」を常時追加しない。投稿量が増えるほど固定AI費用になるため禁止する。

通常ZUKANと外来種surfaceのpromptも分離する。ZUKAN generic promptへ外来種全Profileを常駐させず、外来種surfaceでだけversioned Biosecurity domain promptを使い、対象固有情報は必要なTarget Profileだけ注入する。

## 1. Allowed inference triggers

AIを起動してよいのは次のいずれか。

1. 利用者が外来種surface / 対象profile入口から解析を伴う投稿をした。
2. 利用者が通常ZUKANで既存のAI解析を明示的に開始した。
3. 既存の通常AI解析結果に、active Target Profileと関連する候補が既に含まれた。
4. 実在するProgram / monitoring policyが、対象・地域・期間・費用上限を限定して追加解析を要求する。
5. operator / reviewerが、未解決Recordに対して再解析を明示的に要求した。

単に「Profileがactive」「地域に侵入種がいる」「画像が投稿された」だけではAIを起動しない。

## 2. Dedicated biosecurity surface

例: `/invasive/kubiaka` からの投稿。

```text
Biosecurity domain prompt
+ Target Profile = kubiaka-watch
+ relevant regional policy only
→ deterministic evidence checks
→ optional bounded Kubiaka assessment
→ human review only when policy requires
```

全外来種候補のvision promptを回さない。Target Profileが既知なら必要なProfileだけをcontextへ入れる。

種ごとの独立system promptを増殖させず、一つのBiosecurity domain promptへversioned Target Profileを差し込む。専門性は保ちながらpromptの保守・token量をTarget Profile数から切り離す。

AI failure、quota exhaustion、provider outageはRecord保存と公式窓口案内を止めない。

## 3. Generic ZUKAN path

通常投稿へbiosecurity専用prompt / AI callを追加しない。

通常 `zukan.earth` は地域の写真、環境、資料、自然、文化、活動等を扱う汎用Record体験であり、外来種専用promptを常時持たない。

既存の通常画像解析が利用者操作等ですでに走る場合のみ、その既存結果を再利用する。結果にactive Target Profile候補が含まれた場合、deterministicなregion / time / policy filterを通して専門guideを提示できる。

```text
normal Record
→ existing analysis, if already requested
→ persisted candidate output
→ local Target Profile match
→ optional targeted escalation on biosecurity surface
```

同じ画像について「通常AI解析」と「外来種screening」を別々に呼ぶことをdefaultにしない。

## 4. Unknown-target biosecurity entry

`/invasive` のような一般入口で対象種が不明でも、active Target Profileごとのpromptを順番に実行しない。

```text
one bounded biosecurity candidate assessment, when needed
→ candidate taxon / group
→ deterministic taxon + region + policy lookup
→ relevant Target Profile only
```

外来種一覧を全件promptへ投入することもdefaultにしない。候補が登録Target Profileへ一致しなくてもRecordは保存できる。

## 5. Candidate narrowing

対象数が増えても、LLM/vision promptへ全Profile一覧を投入しない。

候補を次の安価な情報から絞る。

- explicit entry profile
- existing AI candidate taxonomy
- country / region / jurisdiction policy
- observation time / season where authoritative enough for prioritization
- subject class or taxonomic group
- Program / Quest target scope

地域・季節外であることは誤認の証明には使わない。`not_supported`を自動生成せず、解析対象候補を減らすためだけに利用する。

## 6. Asset and result reuse

同じ保存済みEvidenceに同じ解析を繰り返さない。

Logical reuse key:

```text
asset_checksum
+ normalized assessment purpose
+ model/provider family
+ model version
+ pipeline/prompt version
+ materially relevant profile/policy version
```

同じkeyの確定結果が存在すれば再利用する。Profileの説明文変更やUI copy変更だけでは再解析しない。

再解析が必要なのは、model/pipeline変更、対象policy変更、追加Evidence、明示的なreview、過去結果がinvalidatedされた場合等、結果が変わり得る理由がある場合だけ。

Provider cacheは補助でありcanonical cacheではない。ZUKAN側にEvidenceとassessment provenanceを保持する。

## 7. Multi-image records

写真1枚ごとに無条件で独立LLM callしない。

- deterministic quality / MIME / dimensions / duplicate checks first
- provider/modelが安全に複数画像を扱える場合は一つのbounded assessmentへまとめる
- 全画像の詳細評価が不要なら、必要Evidenceのみ対象とする
- assessed / unassessed asset IDsを必ず分ける

費用節減のため未評価画像を評価済みと扱わない。

## 8. Escalation ladder

Default order:

```text
0. no AI — save / policy / rights / routing guidance
1. reuse persisted assessment
2. existing general ZUKAN analysis output, if already created
3. Biosecurity domain prompt + only relevant Target Profile
4. cheapest capable bounded model
5. stronger model only for unresolved material case
6. human review when required by risk / policy / authority
```

高リスクだから全件premium model、ではない。高リスクはreview/routing priorityを上げる理由であり、無条件に高価な推論を増やす理由ではない。

## 9. Cost invariants

Implementation must preserve:

- `number_of_target_profiles` alone causes zero AI requests.
- one Record is never multiplied by every active profile.
- normal ZUKAN contribution does not acquire mandatory biosecurity inference.
- normal ZUKAN prompt does not grow with all biosecurity Target Profiles.
- biosecurity requests receive only the domain prompt and relevant bounded profile context.
- cached/persisted equivalent assessment is reused before provider call.
- AI/provider failure never invalidates a successfully saved Record.
- official-contact guidance can work without AI.
- retries are bounded and idempotent; provider retry loops cannot create unbounded spend.
- model routing and limits are configuration/runtime policy, not hard-coded into every profile.

## 10. Budget controls

Before scaled rollout, expose at least:

- inference calls / 1,000 Records by surface
- AI cost / 1,000 Records by surface
- percentage with zero new AI call
- persisted-result reuse rate
- average prompt/input size for biosecurity assessment
- escalation rate to stronger model
- human-review rate
- provider failure / retry rate

Set runtime spend caps / rate limits at service or provider boundary when available. A cost cap must degrade to `AI pending/unavailable`, not prevent Record capture or falsely classify the observation.

## 11. Cloudflare boundary

Current Cloudflare capabilities may be used where they reduce operations, but are not product semantics.

- Workers AI is usage-priced; profile count must not trigger model execution.
- AI Gateway provider caching is useful only when requests are equivalent; unique field photos should not be assumed to produce cache hits.
- canonical reuse therefore depends on ZUKAN's stored asset checksum + assessment provenance, not only provider/Gateway cache.
- AI Gateway cost metadata/spend controls may support observability, but do not replace product-level per-Record invariants.

## 12. Non-goals

Do not build now:

- species-by-species classifier services
- one system prompt per species
- one prompt per active profile executed on every Record
- all Target Profiles embedded in the generic ZUKAN prompt
- a generic inference scheduler/control plane
- automatic re-analysis of historical media whenever a Profile is added
- permanent premium-model routing for all invasive-species Records
- a separate AI database for biosecurity

Generalize only after measured recurring demand proves that the direct bounded path is insufficient.
