# ikimon.life v2 staging — iNaturalist批判に対する返答境界

更新日: 2026-04-20

目的:

- 2026 年の iNaturalist 関連批判と一次資料を、`platform_v2 staging` の実装判断に落とす
- `どこまで返せているか` と `どこまで返すべきか` を混ぜずに固定する
- `full ecology lab` ではなく `honest observatory intake` としての返答範囲を定義する

---

## 1. 参照した一次資料

- [Grady et al. (2026), iNaturalist Users Exhibit Distinct Spatiotemporal Sampling Preferences](https://theoryandpractice.citizenscienceassociation.org/en/articles/10.5334/cstp.868)
  - 公開日: 2026-01-29
  - 論点: `sampling bias / local-traveler bias / urban-park bias`
- [Soberón & Christén (2026), On using iNaturalist data to estimate trends](https://journals.ku.edu/jbi/article/view/24266)
  - 公開日: 2026-02-25
  - 論点: `unstructured effort から trend を読む危うさ`
- [Callaghan et al. (2026 preprint), Guidelines and best practices for the scientific use of global iNaturalist data](https://www.researchgate.net/publication/402247878_Guidelines_and_best_practices_for_the_scientific_use_of_global_iNaturalist_data)
  - 公開月: 2026-03
  - 論点: `space / time / taxa / observer heterogeneity を前提に扱え`
- [iNaturalist — December 2025 Identifiers Survey](https://www.inaturalist.org/blog/123377-december-2025-identifiers-survey)
  - 公開日: 2026-01-22
  - 論点: `poor evidence / too few identifiers / expertise weighting`
- [iNaturalist — Our Product Goals for January–June 2026](https://www.inaturalist.org/blog/123394)
  - 公開日: 2026-01-26
  - 論点: `evidence quality / identifier support / CV error reduction`
- [iNaturalist — Observation Accuracy Experiment v0.6](https://www.inaturalist.org/blog/124087-observation-accuracy-experiment-v0-6)
  - 公開日: 2026-02-04、更新日: 2026-02-13
  - 論点: `RG accuracy と難群の現場感覚はズレうる`

---

## 2. 論点の MECE 整理

### 2.1 集める

- `effort / checklist / protocol` がない observation は、再利用価値が限定される
- 返答方針:
  - `quick capture` と `survey` を分ける
  - survey だけに `effort / scope / checklist / revisit reason` を持たせる

### 2.2 配る

- `local steward / traveler / casual` の違いを無視すると frontier が偏る
- 返答方針:
  - map の推薦を actor lens で出し分ける
  - `non-park urban / non-protected rural / low-coverage cell` を優先できる設計にする

### 2.3 確かめる

- `AI / community / authority / public claim` を混ぜると、信頼の段差が消える
- 返答方針:
  - UI 上で trust lane を分けて見せる
  - authority-backed review を public claim の前提として扱う

### 2.4 語る

- `absence / trend / increase / decrease` は protocol と comparability がない限り強く言わない
- 返答方針:
  - survey であっても `未観測` と `不在` は分ける
  - analytics / map / copy で条件未達データに強い主張を載せない

---

## 3. staging が返すべき境界

`platform_v2 staging` のゴールは `research-grade analytics` ではなく、`place-first observatory` の入口を正直に作ること。

必須:

- `Quick capture` と `Survey` の分離
- survey 側の `visit_mode / effort_minutes / complete_checklist_flag / target_taxa_scope / revisit_reason`
- `AI suggestion / community support / authority-backed / public claim` の可視化
- actor lens を踏まえた `frontier` と `effort-summary`

不要:

- occupancy model 実装
- 完全な研究者解析 UI
- AI 単独の public claim / trend claim

---

## 4. 2026-04-20 時点の実装反映

### 4.1 Collect: `/record` を quick capture と survey に分離

- 実装:
  - `platform_v2/src/routes/read.ts`
  - `platform_v2/src/services/observationWrite.ts`
- 追加内容:
  - `recordMode=quick|survey`
  - survey 時のみ `completeChecklistFlag`, `targetTaxaScope`, `effortMinutes`, `revisitReason` を必須化
  - `visit_mode='survey'` を保存し、visit row に `complete_checklist_flag`, `target_taxa_scope`, `effort_minutes`, `distance_meters` を書き込む
- 意味:
  - Soberón / Callaghan 系の `effort を主導線で持て` に対する最短の返答

### 4.2 Distribute: frontier を actor lens で出し分け

- 実装:
  - `platform_v2/src/services/mapEffort.ts`
  - `platform_v2/src/routes/mapApi.ts`
  - `platform_v2/src/ui/mapExplorer.ts`
  - `platform_v2/src/services/mapEffort.test.ts`
- 追加内容:
  - `actorClass=all|local_steward|traveler|casual`
  - 行動履歴から actor class を推定し、frontier candidate を actor ごとに並べ替え
  - `priorityCue` を返し、`fresh_gap / nearby_gap / steady_revisit` を UI で見せる
- 意味:
  - Grady 2026 の `誰をどこへ向かわせるか` に、最低限の routing で返し始めた

### 4.3 Verify: trust lane を UI で明示

- 実装:
  - `platform_v2/src/routes/read.ts`
  - `platform_v2/src/services/visitSubjects.ts`
- 追加内容:
  - observation detail に `AI suggestion -> Community support -> Authority-backed -> Public claim` の 4 層を表示
  - `evidenceTier` と `hasSpecialistApproval` をもとに、現在地を UI で見せる
- 意味:
  - `AI/community を final truth にしない` という stance を、仕様書ではなく画面で返す

### 4.4 Speak: survey を manual provenance に含める

- 実装:
  - `platform_v2/src/services/mapSnapshot.ts`
  - `platform_v2/src/services/readModels.ts`
- 追加内容:
  - `visit_mode='survey'` を manual lineage に含める
  - manual integrity 系の集計でも survey visit を除外しない
- 意味:
  - quick capture と survey を分けつつ、`人が現地で集めた記録` としての連続性は保つ

---

## 5. まだ返せていないこと

### 5.1 protocol-backed absence

- `no target detected` はいま `protocol note only` として残すだけ
- 真の absence claim にはまだ使わない

### 5.2 actor inference の精度

- 現状の actor lens は `behavioral inference` であり、user-declared role や長期 place ownership ではない
- bias correction の第一歩ではあるが、まだ heuristic 段階

### 5.3 trend-ready analytics

- `trend / increase / decrease` を place ごとに語るための comparability gate は未完成
- `claim ledger` や `trend-ready` tier は今後の課題

---

## 6. いまの成熟度評価

| 軸 | 実装前提 | 2026-04-20 時点 |
|---|---|---|
| 集める | survey に effort と scope を持たせる | 3.5 / 5 |
| 配る | actor lens で frontier を変える | 3 / 5 |
| 確かめる | trust lane と authority gate を分ける | 4.2 / 5 |
| 語る | absence / trend を強く言わない | 3 / 5 |

総評:

- `AI/community を final truth にしない` はかなり返せている
- `sampling effort を主導線で取る` は今回で入口ができた
- `どこまで trend-ready かを段階表示する` は次の大きな宿題

---

## 7. 検証メモ

2026-04-20 に次を確認済み:

- `npm run typecheck`
- `npm run build`
- `npx tsx --test src/services/mapEffort.test.ts`

未実施:

- HTTP smoke
  - `V2_BASE_URL`
  - `V2_PRIVILEGED_WRITE_API_KEY`
  が未設定だったため

---

## 8. 次の実装順

1. `absence` を protocol-bound claim に限定して書ける `survey result model` を追加する
2. actor lens を `place ownership / distance from home / revisit cadence` で強化する
3. `notebook -> survey-grade -> authority-backed -> public claim -> trend-ready` の claim ledger を place 単位に持つ
