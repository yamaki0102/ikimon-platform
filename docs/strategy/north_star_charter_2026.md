# ikimon North Star Charter 2026

更新日: 2026-06-10

この文書を、ikimon.life / ikimon.co.jp の外向け戦略、公開面、KPI、次期実装判断の North Star 正本として扱う。

Source:

- 外向けピッチ: `ikimon.co.jp/pitch/ikimon/`
- workspace: `E:\Projects\ikimon\cojp_pitch_upload`
- 実体: `pitch/ikimon/index.html`
- repo 内索引: `docs/IKIMON_KNOWLEDGE_MAP_2026-04-12.md`

---

## 1. North Star Statement

> 自然の記録を、地域の力へ。

この一文を、以後の公開面、プロダクト優先順位、KPI、agent 判断の最上位に置く。

3層循環:

1. 暮らしの入口
2. 地域の自然データ
3. 企業・行政の判断材料

解釈:

- `ENJOY NATURE` は入口層の public face。参加理由を軽くし、散歩、家族、健康、学び、旅先の発見を受け止める。
- `Place Intelligence OS` は中核層。場所への愛着、再訪、地域の記録、観察努力量、同定根拠を束ねる。
- 企業・行政の判断材料は出口層。monitoring 契約、地域施策、自然共生サイト、説明責任に接続する。

独立した北極星として扱わないもの:

- 子ども、健康、世代間交流、NEMA、観光、教育は入口または use case であり、単独の製品ラインではない。
- `Place Intelligence OS` は公開 hero の主語ではなく、地域データ層の内部 identity として使う。
- monitoring / TNFD / OECM は出口であり、最初の参加理由ではない。

---

## 2. Primary Metric

North Star metric:

`月内に、地元ユーザーによる再訪記録が2回以上成立した active places 数`

理由:

- 暮らしの入口が機能していなければ、再訪が起きない。
- 地域の自然データが育っていなければ、place 単位の蓄積にならない。
- 企業・行政の判断材料にするには、単発写真ではなく同じ場所の継続記録が必要。

定義メモ:

- `active place`: 同一月内に local steward / local resident 相当のユーザーから、同一 place へ2回以上の visit または observation が成立した place。
- `revisit`: 前回 visit から一定時間を空けた再訪。短時間の重複投稿は除外する。
- `local user`: UI 上の actor lens、profile locality、event participation、または運用登録から判定する。未確定の場合は `unknown` とし、North Star には含めない。

---

## 3. Input Metrics

当面の input metrics は4つに固定する。

| Metric | 対応層 | なぜ見るか | 最小実装 |
|---|---|---|---|
| クラブの根拠付き同定件数/月 | 地域データ | reviewer 供給をボランティア頼みからクラブ運営へ移すため | reviewer / organization / evidence ref / decision count |
| 投稿フロー完了率 | 暮らしの入口 | 10秒投稿と動画対応の約束を測るため | record start -> media selected -> submitted -> accepted |
| 地図 -> 観察会作成数 | 暮らしの入口から地域データ | place を参加導線へ変換できているかを見るため | map place selected -> event create start -> event published |
| place 再訪転換率 | 地域データ | active places の先行指標 | first visit cohort -> second visit within period |

`uiKpi` event 設計の最小 payload:

- `place_id`
- `visit_type`: `first_visit | revisit | event_visit | club_review | monitoring_review`
- `actor_lens`: `local_steward | traveler | casual | organizer | specialist | unknown`
- `source_surface`: `home | record | map | event | review | export`
- `organization_id` は設計判断後に追加する。今は無理に個人 role へ混ぜない。

---

## 4. Regional Club Model

ピッチで追加された戦略進化:

`観察 -> 根拠ある同定 -> 地域データ -> クラブ運営`

この loop を、reviewer 供給問題への最初の具体解として採用する。

採用条件:

- 同定は種名だけでなく、図鑑、文献、信頼できる Web 情報、現地資料などの根拠を必ず持つ。
- 個人 reviewer だけでなく、クラブ / 組織単位で attribution できる。
- monitoring 収益または企業協賛から、同定と記録整理の対価をクラブ運営費へ回せる。
- 品質指標は件数だけでなく、根拠登録率、差し戻し率、合意率、処理時間を含む。

不採用条件:

- クラブ参加を、無償の作業力としてだけ扱う。
- 件数ランキングで雑な同定を増やす。
- 子どもや学生の活動成果を、根拠や監修なしに企業・行政の強い判断材料として売る。
- NEMA や入口ファネル実験を、ikimon.life 本体の実装スコープへ先に入れる。

設計判断:

- `specialist` role と `fieldManagers` だけではクラブ運営費の attribution が弱い。
- 先に `organization / club / attribution` の境界を設計し、実装はその後にする。
- 既存の observation events に乗せるか、新しい club entity を作るかは、`docs/strategy/regional_club_reviewer_attribution_2026-06-10.md` を参照して決める。

---

## 5. Backlog Reprioritization

P1:

- reviewer throughput 可観測化
  - `specialistReview` / `identificationConsensus` から、誰が、どの組織で、何件、何分、どの根拠で処理したかを集計できるようにする。
  - club model の対価設計に直結するため P2 ではなく P1。
- club attribution 設計
  - `organization_id`, `club_id`, `reviewer_membership`, `review_credit` の要否を判断する。
  - 既存 `fieldManagers` へ吸収する場合も、club 運営費に回せる集計単位を失わない。
  - 詳細は `docs/strategy/regional_club_reviewer_attribution_2026-06-10.md` を正本候補として使う。

P2 上位:

- effort / absence readiness
  - スライド2の約束「いつ・どこで・どの努力量で見たか」を records / export / report で説明できる状態にする。
  - `survey` は比較可能性を高める入口だが、まだ `absence claim` や `trend-ready claim` ではない境界を UI と export に残す。
  - `samplingEffort`, `complete_checklist_flag`, `target_taxa_scope`, `absence/no-detection` の有無を record package で読めるようにする。

P0 継続:

- `npm --prefix platform_v2 run test:node` を current app の node test gate として維持する。
- 動画投稿の約束は `platform_v2/src/services/videoUpload.test.ts` を gate に含め続ける。

---

## 6. Operating Rule

今後の agent / human 判断では、次の順で読む。

1. `docs/strategy/north_star_charter_2026.md`
2. `docs/IKIMON_KNOWLEDGE_MAP_2026-04-12.md`
3. `docs/strategy/ikimon_public_surface_canonical_pack_2026-04-22.md`
4. `docs/KNOWLEDGE_OS_OVERVIEW.md`
5. 実装対象の spec / route / service

判断を迷ったとき:

- 入口を軽くするか? -> 投稿完了率と地図から観察会作成数を見る。
- 地域データが育つか? -> active places と place 再訪転換率を見る。
- 判断材料になるか? -> monitoring 契約、effort/absence readiness、根拠付き同定件数を見る。
- クラブに仕事として渡せるか? -> club attribution と reviewer throughput を見る。
