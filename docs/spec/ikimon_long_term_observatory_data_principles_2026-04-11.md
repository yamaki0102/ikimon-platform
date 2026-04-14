# ikimon.life Long-term Nature Observatory Data Principles

更新日: 2026-04-11

目的:

- `今日の発見体験` と `10年単位の場所モニタリング` を同じ設計で両立させる
- 何を残せば将来の再利用価値が高いかを固定する

---

## 1. 基本原則

1. 表のUXは近く、データ構造は遠く設計する
2. `正しい種名` だけを唯一の価値にしない
3. 不確実性を消さずに残す
4. 同じ場所を見直せる再訪単位を優先する
5. 種データと場所状態データを分けて持つ

---

## 2. 100年価値を持つ観測の5層

### Layer 1. Taxon

- `species`
- `species_group`
- `native_exotic_status`
- `hybrid_suspected`
- `unknown`

### Layer 2. Evidence

- photo / audio / note
- observed_at
- location precision
- observer note
- identification reason

### Layer 3. Effort

- observation_mode
- duration
- distance / route
- observer_count
- complete_checklist の有無

### Layer 4. Site Condition

- mowing / pruning
- lighting
- water level / moisture
- bare soil / paving
- trash / cleanup
- planting / habitat intervention

### Layer 5. Time Series

- site_id
- revisit window
- season bucket
- year-over-year comparability

---

## 3. 問いと必要粒度

| 問い | 最低限必要な粒度 | 補助情報 |
|---|---|---|
| 今日は何がいた? | species group 以上 | photo, date, rough place |
| 去年の今ごろとどう違う? | species / species group + season | effort, revisit window |
| 外来化が進んだか? | native / exotic / hybrid suspected | site condition, year trend |
| この拠点で群集が均質化したか? | community composition | checklist, effort, habitat change |
| 希少種対応が必要か? | species + verification status | evidence, review trail |

---

## 4. 同定の設計原則

- AI は `候補提示`
- Community は `支援`
- Expert は `検証`

表示ルール:

- `AI suggestion`
- `community support`
- `expert verified`

難しい群では次を first-class にする。

- `在来`
- `外来`
- `交雑疑い`
- `不明`

---

## 5. UIへの翻訳

### 初回

- `今日は何を見る?`
- `撮る / メモする`
- `候補を見る`
- `保存できた`

### 継続

- `この春の記録`
- `去年の今ごろ`
- `この場所で増えた / 減った気配`

### 長期

- 拠点別の季節カバー
- 在来 / 外来の比率変化
- 群集の偏り
- site condition の変化ログ

---

## 6. 今回の実装で最低限必要な保存方針

- note-only 記録を正式に許す
- confidence を保存する
- taxon granularity を保存する
- site_id と season bucket を結びつける
- site condition は後付けでも入力できる

---

## 7. 今回まだやらないこと

- 完全な DwC Event export
- 本格的な occupancy model
- 研究者向け解析UI
- 高度な音声 / eDNA 統合
