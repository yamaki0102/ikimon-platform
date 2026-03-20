# Autonomous Directive — 実行報告 & 回答

**作成日**: 2026-03-19
**対象**: `claude_code_autonomous_directive.md` の指示に対する現状報告
**執筆**: Claude Code (Opus 4.6)
**セッション**: brave-burnell worktree

---

## 0. 総括

Directive は「100年耐久の正本設計」と「毎日使うUX」の両立を求めた。
本日のセッションでは、Directive が想定していなかった **UX側の構造的欠陥** に先に遭遇し、そちらを優先的に解決した。
具体的には「1観察 = 1生物」の制約が、実際のフィールド利用で即座に破綻する問題。

Directive の Step 1（データ品質の止血）に相当する作業と、Step 2（canonical schema）の萌芽にあたる作業を実行した。

---

## 1. 本日の実装内容

### 1.1 Multi-Subject Observation（Directive §2.3, §3.1 に関連）

**問題**: ユーザー Nats が「植物の上にアリがいる」写真を投稿。1観察1種の制約で、片方しか記録できなかった。

**実装**:
- `subjects[]` 配列を observation に追加。各 subject が独立した taxon, identifications, ai_assessments, consensus, verification_stage を持つ
- 既存の `taxon` / `identifications` フィールドは primary subject のミラーとして互換維持
- `SubjectHelper.php` — ensureSubjects, addSubject, findSubject, distributeIdentifications, syncPrimaryToLegacy, autoAssignSubject 等
- `BioUtils::updateConsensus()` を subject-aware に改修。各 subject ごとに独立した weighted voting → consensus
- Darwin Core Event Core + Occurrence Extension パターンに準拠（§2.3 の century durability に寄与）

**Directive との整合**:
- ✅ §3.1「taxon_name 文字列だけで生物レコードをマージしない」→ subject 単位で分離
- ✅ §2.3「schema_version を残す」→ observation.schema_version を 1.0 → 1.1 に更新
- ✅ §7.3「同じ種でも統合前に潰さない」→ subject 単位で event 保持
- ⚠️ 正本はまだ JSON ファイル（PostGIS 移行は DNS 伝播待ち）

### 1.2 AI 複数生物検出（Directive §8.1 に関連）

**実装**:
- Gemini プロンプトにルール 14-16 を追加（複数生物検出）
- レスポンススキーマに `multi_subject: boolean` + `subjects[]` 配列を追加
- `AiObservationAssessment::buildMultiSubjectAssessments()` で subject 別 assessment を生成
- `AiAssessmentQueue::saveAssessmentToObservation()` で AI 検出 subject を自動作成 + 既存同定の自動割り当て

**Directive との整合**:
- ✅ §8.1「モデル出力は事実ではなく versioned interpretation として保存」→ assessment に model_version, pipeline_version を付与
- ✅ §3.2「種同定の断定精度を過大表現しない」→ confidence_band 維持、subject ごとに異なるランクで提示

### 1.3 3段階 Taxon 正規化パイプライン（Directive §3.1 に直接対応）

**問題**: 「カエル」「Frog」「Anura」が別の同定として扱われ、コンセンサスが計算できない。

**実装**:
```
投稿時:
  ① オモイカネDB (2971種ローカル, 0ms) → 和名→学名
  ② TaxonSearchService (iNat/ローカルキャッシュ) → 完全一致優先
  ③ GBIF match API → 学名→lineage/kingdom/rank/taxon_key 補完
```

- `OmoikaneSearchEngine::resolveByJapaneseName()` — 完全一致→接尾辞除去→前方一致→部分一致の4段階
- GBIF 補完で lineage (kingdom→genus) を自動取得
- lineage.kingdom に基づく subject 自動振り分け（`SubjectHelper::autoAssignSubject()`）

**Directive との整合**:
- ✅ §3.1「taxon_name 文字列だけで生物レコードをマージしない」→ 学名 + taxon_key + lineage で正規化
- ✅ §3.1「taxon concept を追跡できない識別子設計を採用しない」→ GBIF usageKey を taxon_key として保持
- ⚠️ taxon_concept_version はまだ未実装（GBIF の taxonomicStatus は取得可能だが未格納）

### 1.4 UI/UX 改善（Directive §3.2 に関連）

- observation_detail.php: subject タブ、subject 別 AI 考察（フル展開）、subject 別コンセンサス表示、同定カードに subject バッジ
- id_form.php: 検索候補ドロップダウン修正（API レスポンス形式不一致の修正）、CSRF トークン取得方法修正、subject セレクター追加
- テキストコントラスト修正（`text-text` が emerald 背景で白に解決される問題）

### 1.5 インフラ（Directive §10.5 に関連）

- Xserver VPS (12GB, Ubuntu 24.04) にデプロイ開始
- PostgreSQL 16 + PostGIS 3.6.2 + TimescaleDB セットアップ完了
- DNS A レコード変更済み、伝播待ち（旧 IP のまま）
- 両サーバー（お名前ドットコム + VPS）への並行デプロイ体制構築

---

## 2. Directive の指示に対する進捗状況

### Step 1: データ品質の止血

| 指示 | 状態 | 備考 |
|---|---|---|
| DataStageManager の遷移ルール修正 | ✅ 完了 (PR#4-#8) | 前セッションで実施済み |
| research_grade 判定条件の厳格化 | ✅ 完了 | human verification 必須化済み |
| EcosystemMapper の taxon-only merge 停止 | ⬜ 未着手 | 今回は multi-subject が優先だった |
| fake precision フィールドの整理 | ⬜ 未着手 | |
| **taxon 正規化（今回追加）** | ✅ 完了 | Directive §3.1 の実質的な止血 |

### Step 2: Canonical Schema

| 指示 | 状態 | 備考 |
|---|---|---|
| stable_id | ⬜ 未着手 | observation.id は UUID だが formal stable_id ではない |
| geometry_version | ⬜ 未着手 | |
| observation_event | 🔄 萌芽 | subjects[] が event 分離の原型 |
| location_uncertainty_m | ⬜ 未着手 | |
| taxon_id / taxon_concept_version | 🔄 部分 | GBIF usageKey を taxon_key に格納。concept version は未実装 |
| source_device | ⬜ 未着手 | |
| processing_stage | ✅ 完了 | DataStageManager で管理 |
| derived_view | ⬜ 未着手 | |
| provenance | 🔄 部分 | AI assessment に model_version あり。観測全体の provenance chain は未実装 |
| license | ✅ 完了 | CC BY-NC 4.0 がデフォルト |
| consent_scope | ⬜ 未着手 | |

### Step 3-5: 残りのステップ

未着手。PostGIS 移行完了後に着手予定。

---

## 3. Directive が想定していなかった問題

### 3.1 「1観察 = 1生物」の制約

Directive は 3D / 点群 / 空間データの正本設計に焦点を当てていた。
しかし実際のフィールド運用で最初にぶつかったのは、**観測モデル自体の構造的欠陥**だった。

iNaturalist もこの問題を[何年もフォーラムで議論中](https://forum.inaturalist.org/t/allow-more-than-one-species-per-photo-observation/2816)で未解決。
ikimon が先に解決したことは、DwC Event Core 準拠のデータモデルとして学術的にも正当。

### 3.2 異言語同定の不一致

「カエル」と「Frog」が別 taxon として扱われる問題。
Directive §3.1 の「taxon_name 文字列だけでマージしない」の具体的な発現形。
GBIF match API + ローカルDB の 3段階パイプラインで解決。

### 3.3 AI 考察はコア UX だった

Directive §3.2 は「3D がすごいを日常利用価値と誤認しない」と警告した。
同様に、**AI 考察の詳細表示がユーザーの学びと自己効力感の核心**であることが判明。
コンパクト化を試みたが、ユーザーから即座に否定された。
「情報量が多い = 悪」ではなく、「情報量が多い = 学びの価値」という UX 原則を学んだ。

---

## 4. 次のアクション（Directive 準拠）

### 即時（DNS 伝播完了後）

1. SSL セットアップ（certbot）
2. PostgreSQL へのデータ移行開始（JSON → PostGIS）
3. EcosystemMapper の deprecated 化検討

### 短期（1ヶ月）

4. canonical schema の ADR 作成（`docs/architecture/`）
5. stable_id + provenance chain の実装
6. taxon_concept_version の導入
7. GBIF IPT 連携（DwC-A エクスポート）

### 中期（3ヶ月）

8. VIRTUAL SHIZUOKA 連携 PoC
9. uncertainty-aware UI
10. archive/export パッケージ

---

## 5. 率直な評価

Directive は正しい。100年耐久の設計思想は、ikimon を「使い捨てアプリ」から「研究インフラ」に引き上げる唯一の道。

ただし、**ユーザーが0人のインフラは意味がない**。
本日のセッションでは、Directive の Step 1-2 と並行して「実際に使われるための UX 修正」を大量に行った。
これは Directive の §10.1 優先順位「4. 日常UXの成立」に該当し、正当な判断だったと考える。

競合分析の結論として、ikimon の勝ち筋は「TNFD/企業向けでマネタイズ → コミュニティを育てる → データが増える → AI が賢くなる」のフライホイール。
Directive の北極星アーキテクチャは、このフライホイールの「データが増える」段階で不可欠になる。

今は「使われる」ことが最優先。その上で、Directive の設計原則を一つずつ埋め込んでいく。

---

## 付録: 本日のコミット履歴

```
f8e59ac docs: アップデートページに v0.6.0 マルチサブジェクト & 学名正規化を追加
1afe474 feat: 3段階taxon正規化パイプライン — オモイカネDB → TaxonSearch → GBIF
f036520 feat: 同定の自動subject振り分け + AI考察フル表示復元 + id_form subjectセレクター
e284c93 fix: Multi-Subject UX改善 — id_formにsubjectセレクター + AI考察コンパクト化
04fd0bb fix: Multi-Subject テキストコントラスト修正 + id_form.php 検索候補バグ修正
ef998bc fix: Multi-Subject UI改善 — AI考察統合・コンセンサス分離・タブラベル修正
cd57d56 fix: Multi-Subject AI — 既存同定の自動割り当て + primary subjectラベル設定
7cab0f8 feat: Multi-Subject Observation — 1つの観察に複数生物の同定を可能に
```
