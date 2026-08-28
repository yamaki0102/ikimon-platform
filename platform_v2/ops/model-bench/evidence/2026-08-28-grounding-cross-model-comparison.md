# ZUKAN Vision Model Bench: blind grounding comparison (2026-08-28)

## 判定

- `BEST_GROUNDING`: `NO_CLEAR_WINNER`
- `BEST_OPERATIONAL`: `gemini-3.5-flash-lite`
- `BEST_BALANCED`: `gemini-3.5-flash-lite`
- 生物学的 accuracy winner は決めない。NOAH reference は高解像度の visual reference であり、human gold ではない。
- Gemini / GLM の既存実測は再実行していない。Qwen / Luna / Llama の既存canaryも再試行していない。

## 固定入力

- 7投稿 / 21画像、dataset SHA: `db98e2a6bd16f0cb3cf9b856dd54472d22760771d970572a3dead7bd99cfbfff`
- prompt SHA: `6d0cc93200ad45142713287f81a8a55d96489c0c0e9397b15098ed6b387fd9e9`
- 固定manifestの投稿順・各3画像・各画像SHA・post SHAは既存Evidenceから再確認済み。
- rightsはcanonical 7/7確認済みの状態を再利用し、変更していない。

## 既存運用実測の再利用

| model | success/schema | p50/p95 | input/output tokens | cost USD |
|---|---:|---:|---:|---:|
| Gemini 3.5 Flash-Lite | 7/7 / 7/7 | 2,582 / 4,831 ms | 82,845 / 2,238 | 0.0304485 |
| GLM-5.3-Flash | 7/7 / 7/7 | 53,996 / 64,073 ms | 153,402 / 26,359 | 0.0361898 |

GLMのper-post raw final contentは現行8192 Evidenceで4/7、同一設定canaryで1/7、既存4096 Evidenceで1/7が保存されている。beetle投稿は保存済みfinal contentがなく、内容スコアから除外した。rawが無いことを0点扱いしていない。

## grounding score（0–100、高い方が良い）

| 指標 | Gemini | GLM | 備考 |
|---|---:|---:|---|
| visible_feature_recall | 59 | 79.5 | 高い方が良い |
| diagnostic_feature_recall | 49.4 | 67.2 | 高い方が良い |
| multi_image_integration | 47.6 | 74.7 | 高い方が良い |
| subject_separation | 64 | 74.5 | 高い方が良い |
| taxonomic_stopping_rank | 69.3 | 75.7 | 高い方が良い |
| abstention_quality | 68.4 | 73.2 | 高い方が良い |
| useful_observations | 45.4 | 75.3 | 高い方が良い |
| unsupported_claims_score | 64.3 | 64 | 高い方が良い |
| hallucinated_features_score | 65 | 65 | 高い方が良い |
| overprecision_score | 72.3 | 71.8 | 高い方が良い |
| rank_discipline | 67.1 | 74.3 | 高い方が良い |

## 主張品質集計（低い方が良い rate）

| 指標 | Gemini | GLM |
|---|---:|---:|
| unsupported claim count / rate | 13 / 41.9% | 14 / 46.7% |
| hallucinated feature count / rate | 8 / 25.8% | 8 / 26.7% |
| overprecision count / rate | 4 / 12.9% | 3 / 10% |
| overprecision post rate | 42.9% | 33.3% |

## 7投稿の内容比較

| visitId | Gemini（blind A） | GLM（blind B） | cross-model agreement / 重点所見 |
|---|---|---|---|
| record-1784366489892 | キク科の一種または近縁の双子葉植物子株 (Asteraceae / order Asterales などの一種として発芽初期段階の個体ですが、葉や茎の毛、対生または互生の初期配列などの決定的形質がまだ十分に展開していません。画像からはキク科などの幼植物の可能性がありますが、種レベルへの踏み込みは不十分です。) / family / low | ムラサキバレンギク属（Erigeron属）の幼苗 / genus / low | PARTIAL_DIRECTIONAL: B exposes stronger leaf/hair/context evidence; A is conservative but underspecified. |
| record-1784430741938 | カタバミ属の一種（カタバミ等） / genus / high | カタバミ（オックスalis類） / species / medium | STRONG_DIRECTIONAL: B integrates the three diagnostic signals and reaches Oxalis corniculata plausibly; A points to Oxalis but omits most visible evidence. |
| record-1781252770584 | コガネムシ科の一種あるいはスジコガネ属などコガネムシ亜科の甲虫類です。赤褐色の上翅と平行な筋（条溝）を持つ体型が特徴ですが、種レベルの同定には頭部や腹面の詳細な特徴が必要です。コガネムシ科の総称として捉えるのが無難です。 / family / medium |  / — / — | NOT_COMPARABLE: A provides a defensible Scarabaeidae-family stop; B has no saved final content, so no content comparison. |
| record-1784430374598 | アカリファ属（キャットテール）の一種子孫・近縁種またはヒスイカズラ類等ではなくエノキグサ属 (Acalypha) の園芸種キャットテール等の一種に類似した植物群の一例等として、エノキグサ属の一種であるアカネ科やトウダイグサ科などの形質を持つ植物に酷似する花序（Acalypha hispidaなど）の一種群と考えられるが、一般的な鑑賞用キャットテール（Acalypha hispida）を第一候補とする群としての命名が可能だが、ここでは genus または species レベルで表現します：Acalypha属（アカリファ属）の一種（代表例: キャットテール / Acalypha hispida 等）等、ただし種レベルでの園芸品種が多彩なため属レベルを推奨するケースもあるが、特徴的な赤い尾状の花穂から Acalypha hispida が最も有力）と推定される。しかし安全に属レベルとする：Acalypha属の一種としてアカリファ・ヒスピダ（Acalypha hispida）等が疑われるが安全に属レベル名とする：Acalypha属の一種とするべきか species とすべきか。写真のフサフサとした赤い穂状花序と鋸歯のある卵形の葉は、トウダイグサ科アカリファ属（Acalypha）の代表種であるキャットテール（アカリファ・ヒスピダ）に非常に一致する。園芸種として栽培されるほか、熱帯では逸出することもある。確度の高い種名として Acalypha hispida を挙げられるが、近縁な園芸品種も存在するため属または種としてアカリファ・ヒスピダを提示する。正確な種確定には花序の細かい構造や栽培環境の確認が望ましい。ここでは推奨 taxon 名として「アカリファ・ヒスピダ」を挙げつつ rank を species とする。実際に写真の鮮やかな赤いブラシ状の穂と鋸歯状の葉は典型的なキャットテールの形態を示しているため、確信度高く species レベルで提示できる。ただし、安全を期すため、学名は Acalypha hispida、推薦ランクを species とするが、確信度は高めである。以下に出力する：推奨学名 Acalypha hispida、推奨種名 キャットテール（アカリファ・ヒスピダ）。写真の赤いブラシ状の花穂や鋸歯のある葉、対生あるいは互生の葉の付き方からトウダイグサ科アカリファ属のキャットテール（Acalypha hispida）と判断できる。ただし、同属の他種や品種の可能性も完全に否定できないため、ここでは種レベルまたは属レベルでの慎重な扱いとしてアカリファ属の代表種として提示する。一般的な園芸種であるキャットテールとして鑑賞されることが多い。 / genus / high | アカリファ・ヒスピダ（猫しっぽ） / species / high | STRONG_BUT_OVERPRECISE: Both recognize Acalypha direction but both overcommit to A. hispida; neither adequately separates the dwarf target from neighboring plants. |
| record-1784430118720 | キイチゴ属の一種（モミジイチゴ等）またはキイチゴ類（バラ科）の若葉・茎の可能性があります。トゲや掌状の葉脈パターンが特徴的です。」として分類します。写真では明確な種確定に必要な花や果実が不足しています。同定は慎重に属レベルで行います。葉の形状や鋸歯からバラ科キイチゴ属（Rubus属）などが疑われます。追加の全体像や花・果実を確認してください。」として扱うのが妥当です。位置情報が未取得のため地域分布は評価保留。季節・時期情報は提供されていないため季節特有の動態は推測できません。場所情報がないため地域読みは保留とします。バラ科キイチゴ属は日本各地の林縁や道端に広く自生します。AIによる目測のため誤差大。確定値ではありません。新種判定はAIにはできません。可能性の示唆に留まります。AI判定です。駆除前に自治体・環境省にご確認ください。」 / genus / medium | ツタ属（ノブドウ類） / genus / medium | LOW_DIRECTIONAL: Both notice serrate foliage but miss the small developing head/bud and choose unsupported alternatives; this is the clearest shared visual miss. |
| record-1784431188621 | スズメ または ホオジロ類等（画像不鮮明のため要確認）の鳥類の一種 (Passer montanus等に近いが遠景のため要検証・スズメ科の一種として扱うべき可能性あり。ここではスズメ科の一種とするか、スズメ Passer montanus を第一候補とするが自信は中程度。確実に同定するため仮の候補としてスズメを置く。ここではスズメとする。学名: Passer montanus, ランク: species として暫定提示するが慎重に検証が必要。指示に従い形質を確認する。ここでは信頼度を高めるため rank=family, Passeridae スズメ科、あるいは rank=species Passer montanus を置く。写真では全体的に茶色っぽい頭部・体色と枝にとまる姿がスズメ科を想起させる。しかし解像度が低いため同定に限界がある。一般的なスズメ Passer montanus を推奨taxonとするが、慎重を期して低めの評価にする。画像中の鳥はスズメ科の特徴（ずんぐりした体型、円錐形のくちばし）を持つ。ただ種確定には不十分なため、スズメ科の一種にするかスズメとするか迷うところ。指示のフォーマットに合わせるため recommended_taxon_name は「スズメ」とする。学名は Passer montanus。) / species / medium | スズメ / species / medium | STRONG_DIRECTIONAL: B is materially better grounded in head pattern, upperparts, and two-bird/context separation; A remains sparse and rank-inconsistent. |
| record-1784430530197 | スズメ科の一種または類似の小鳥類の一種あるいは幼鳥等モズ科等可能性あり要詳細検討必要証拠不足のため保留群はハッカチョウ科などとも比較要するがシルエットや樹木中の環境から小鳥類の一種として科または目レベルで検討するが位置特定不可のため断定を避ける必要ありここではスズメ目の一種や一般的な鳴禽類の一種として保留し追加証拠が必須である点に注意を払うことが安全であるためスズメ目の一種あるいは科レベルでの一般候補とするがここでは分かりやすくスズメ目として表現する代わりに一般的な鳥類の一種とするのが適切か確認を要するがスズメ目の一種を推奨するべきか検討した結果スズメ目の一種とするのが安全であるためスズメ目の一種として記載する形が望ましいがより具体的にスズメ科の一種とするかあるいはモズ科の一種とするか判断を留保しスズメ目の一種とするのが最も無難であるためスズメ目の一種とするがシステム上科レベルまたは目レベルが望ましいためスズメ目とするのが安全であるためスズメ目とするが指示に従い科レベルとしてスズメ科の一種とするかモズ科を置くスズメ目の一種とするのが無難であるからスズメ目の一種としておくが項目ルールに従いスズメ目の一種とするのが良いかあるいはモズ科の一種とするか検討しスズメ目鳥類の一種としておくのが安全であるためスズメ目の一種とするが指定のランクfamilyに対応させるためカラス科やヒヨドリ科などの可能性も含めスズメ目の一種とするべきところを一般的なスズメ目の一種としておく。具体的にどの科か断定できないためスズメ目の一種とするのが適切だがrankをfamilyにする必要があるためスズメ科の一種とするかヒヨドリ科の一種とするか不明でありしかしシルエットから小型の鳴禽類の一種として一般的なスズメ目の一種として登録するわけにいかないためヒヨドリ科またはスズメ科の一種として記載するがここではスズメ目の一種としつつ推奨ランクをfamilyにしておくためスズメ科の一種として記載するのが安全かもしれないが断定を避けてスズメ目の一種とするためにランクをorderにすべきか指定はfamilyのためスズメ科の一種とするが不確実性が高いためスズメ科の一種として扱うこととするが正確にはスズメ目の一種とするべきであるものの形式に合わせてスズメ科の一種として記載する事とするがより正確な表現としてスズメ目の一種とするのが妥当でありしかし指示された制約からスズメ科の一種とする。さらにモズ科の一種という可能性もあるためスズメ目の一種としておくのが無難であるが指定のフォーマットに準拠するためスズメ科の一種とする。詳細を記載し不確実性を明記する。実質的に種同定は困難である。正確にはスズメ目の一種。 / family / low | ツグミ科の一種（鳥類） / family / low | PARTIAL_DIRECTIONAL: Both abstain at broad rank and avoid exact location, which is appropriate for the blur; both lean to Turdidae rather than the NOAH Hypsipetes direction. |

## blocked models

| model | status | existing canary | full |
|---|---|---|---|
| @cf/qwen/qwen3.8-27b | CANARY_BLOCKED | HTTP 408 / provider 3046 | not executed |
| gpt-5.6-luna | CANARY_BLOCKED | HTTP 402 / invalid_prompt | not executed |
| @cf/meta/llama-3.2-11b-vision-instruct | CANARY_BLOCKED | HTTP 403 / model terms not accepted | not executed; no license acceptance |

## Evidence

- `2026-08-28-blind-grounding-per-post.json`: model名を隠した14 output枠、保存済みraw final全文、parsed JSON全体、claim labels、score、review fields。
- `2026-08-28-gemini-grounding-summary.json`: Gemini grounding/quality集計と既存運用値。
- `2026-08-28-glm-grounding-summary.json`: GLM grounding/quality集計。補助content sourceを明記し、operational値は現行8192 reportのみ再利用。
- `2026-08-28-grounding-cross-model-comparison.json`: model mapping、per-post比較、blocked状態、verdict。
- `2026-08-28-grounding-cross-model-comparison.md`: 本文比較。
- `schemas/zukan-grounding-comparison-v1.schema.json` と `src/scripts/zukanGroundingComparisonEvidence.test.ts`: 保存形式と固定入力・blind privacyの検証。

## 結論

内容の明示的なfeature recallはGLMが一部で優位だが、Bidens-like投稿を共に外し、dwarf Acalyphaで共に過剰停止するため、visual groundingの明確な勝者は出さない。運用性能と追加Human Attentionの観点では、既存の7/7・低遅延・僅かに低コストのGeminiをbalanced選択として維持する。
