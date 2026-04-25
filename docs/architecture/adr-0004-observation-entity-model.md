# ADR-0004 Observation Entity Model — 候補 / subject / occurrence / interaction / event / public claim

2026-04-18 / status: proposed

## 背景

ikimon は iNaturalist の単純コピーではなく、AI が複数候補を出し、1枚の写真に複数の生きものが写り、調査文脈（時間・距離・努力量・不在情報）も持つプラットフォームへ向かっている。

しかし現状、意味論が層ごとにぶれている：

| 層 | 表現 |
|---|---|
| UI (`post.php`, `post-uploader.js`) | 1 投稿から AI 候補を複数選択可 |
| API (`api/post_observation.php`) | 複数選択時に追加 subject を作る |
| Helper (`libs/SubjectHelper.php`) | multi-subject 前提 |
| Canonical (`libs/CanonicalObservationWriter.php`) | **1 投稿 → 1 event + 1 occurrence のまま** |

この最後のズレが原因で、candidate / subject / occurrence が canonical に落ちる過程で情報が潰れ、DwC / Humboldt 互換 export や将来のリビルドで詰まる。

本 ADR では、6 つの第一級エンティティを定義し、それぞれの状態遷移を固定する。

## 第一級エンティティ

| エンティティ | 定義 | 例 |
|---|---|---|
| **candidate** | AI が提示した taxa 候補。同一 subject に対して複数並び、人の採用/却下を待つ投票前の仮説。 | Gemini が「ヒメスミレ 0.9 / スミレ 0.7 / タチツボスミレ 0.4」と出す3候補 |
| **subject** | 写真または音声の中で識別された「1体の生きもの」。主被写体 1体 + 背景生物 N体。 | 前景の蝶 / 止まっている葉の植物 / 遠景で鳴く鳥 |
| **occurrence** | 公式記録された生物の出現。DwC Occurrence 準拠。subject に1つ以上のcandidate が昇格して初めてできる。 | `occ:{visit_id}:0` が前景の蝶、`:1` が葉の植物 |
| **interaction** | 2 subject / occurrence 間の関係。host-prey, bee-on-flower, parasite-host 等。 | 「蝶 ← 吸蜜 ← スミレ」 |
| **event** | 調査文脈。時刻・場所・effort・checklist・target_taxa_scope・absence を持つ。観察 1回。 | 40分・1.2km・完全チェックリスト・対象=鳥類 |
| **public_claim** | 研究データとして外部 (GBIF, 学術, TNFD) に公開されたクレーム。occurrence に provenance と reviewer 同意が付いて昇格する。 | 「ヒメスミレ、浜松市、2026-04-17、Nats / reviewer @expert_a」 |

## 状態遷移

```
 写真/音声 投稿
      │
      ▼
 ┌─────────────┐
 │ subject     │ ← 写真領域 / 音声タイムレンジ ごとに切り出し
 │ 識別        │
 └─────┬───────┘
       │ 各 subject に対して AI 推論
       ▼
 ┌─────────────┐
 │ candidate   │ 複数 taxa、confidence 付き、alternative hypothesis として共存
 │ 提示        │
 └─────┬───────┘
       │ 人が採用 (suggestion) / 却下 / 追加証拠で更新
       ▼
 ┌─────────────┐
 │ occurrence  │ provisional (Tier 0-1) → reviewed (Tier 2+)
 │ 昇格        │ subject 1体につき最終的には 1 occurrence
 └─────┬───────┘
       │ reviewer 同意 + evidence tier 充足
       ▼
 ┌─────────────┐
 │ public_claim│ DwC export / TNFD レポート / GBIF 候補
 └─────────────┘
```

event は上記 subject〜public_claim を **包む文脈**で、並列に：

```
 ┌─────────────────────────────────────────┐
 │ event (1 観察セッション)                 │
 │  - observed_at / place_id / effort       │
 │  - target_taxa_scope / absence_records   │
 │                                          │
 │  subject 1 ─ occurrence 1 ─┐             │
 │  subject 2 ─ occurrence 2 ─┼── interaction edges
 │  subject 3 ─ (candidate のみ、未昇格)─┘ │
 └─────────────────────────────────────────┘
```

## 重要な原則

### A. AI単独で occurrence にしない

candidate のまま UI で表示するのは OK だが、**canonical の occurrence には reviewer 同意が必要**。  
iNaturalist と同じ保守的ルール（coarse ID と uncertainty を許容）を守る。

### B. 代替候補は「負けた仮説」として残す

ある subject に対して採用された taxa だけを残すのではなく、**却下された candidate も alternative_hypothesis として保持**する。これは AI 学習ループと研究的な再解析に効く。

### C. 「同じ被写体の代替候補」 と 「別 subject」 を UI で分離

- 代替候補モード: 1 subject に複数 taxa を付けて選んでもらう
- 別 subject モード: 画面に複数個体の枠を作って、各枠に candidate セットを付ける

これを UI のトグル or 明示アクションで分ける。

### D. event は incidental / survey-grade で別物扱い

- incidental post = 散歩中に「あ、これ撮ろう」
- survey-grade event = complete_checklist_flag + effort + target_taxa_scope + absence

eBird から学ぶ。両者を混ぜない。

### E. interaction は first-class edge

observation_fields の workaround ではなく、`interactions` テーブル（subject_a × subject_b × relation_type）として持つ。これが ikimon の差別化。

## データモデルへのマッピング

| エンティティ | テーブル |
|---|---|
| candidate | `observation_ai_assessments` の `recommended_taxon` / `similar_taxa` / `distinguishing_tips` と、将来的な `taxa_candidates` テーブル |
| subject | `occurrences` 行 1つ = 1 subject 1 taxa として正規化（subject_index で複数） |
| occurrence | `occurrences` （同上、tier と quality_grade で provisional/reviewed を区別） |
| interaction | **新規テーブル** `observation_interactions` (P1) |
| event | `visits` 行（observed_at / place_id / effort_minutes / target_taxa_scope / complete_checklist_flag 既存、absence は P1） |
| public_claim | `occurrences.evidence_tier` ≥ 2 かつ reviewer 同意レコードあり |

## 優先順位

**P0**: subject を canonical に通す（1 visit → N occurrences）／UI の 代替候補 vs 別subject 分離  
**P1**: event/checklist/effort/absence 実装、interaction edge first-class、reviewer trust (taxon × region × evidence)  
**P2**: DwC / Humboldt / GloBI export、再分類 ledger

## 非採用案

- 「1 occurrence 行に複数 taxa を入れる」 ← DwC 互換を崩し、研究利用で即詰まる
- 「AI 単独で reviewed occurrence 昇格」 ← 研究記録の信頼性を崩す
- 「complete checklist を incidental と同じ扱い」 ← eBird の effort 哲学に反する
