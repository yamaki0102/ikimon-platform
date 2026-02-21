# [6-Month Strategic Plan v2] ikimon.life: The Hybrid Bibliographic Engine

## Goal Description
「ikimon.life」を単なる生物写真投稿アプリから、**100年先まで機能する「学術的根拠（Evidence-Based）」に基づく生物多様性インフラ**へと進化させる。

旧計画（v1）での「キーワードによる絨毯爆撃的な自動収集」や「未完成の図鑑デジタイズへの依存」を完全に破棄する。
新計画（v2）では、**私たちがすでに持っている「学名（scientificName）」を起点とする「GBIF連携」**と、**地域的価値が極めて高い「自然史博物館の紀要」**の2つをコア（Seed）とする **「ハイブリッド・ハブ戦略」** を採用する。
これにより、ノイズを極小化しつつ、グローバルな分類の権威性とローカルな分布記録の実用性を両立させる。

---

## 📅 ロードマップ概要 (6-Month Timeline)

*   **Month 1-2**: The Core Hooks (Seedの確立とパイプライン構築)
*   **Month 3-4**: Semantic Extraction (LLMによる知識の構造化)
*   **Month 5**: UI/UX Integration (ユーザー体験への統合)
*   **Month 6**: The Feedback Ecosystem (データへの還元)

---

## 🏗️ フェーズ詳細

### Phase 1: The Core Hooks - Seedの確立とパイプライン構築 (Month 1-2)
**目標**: 無駄な論文を拾わず、「確実にikimon.lifeに関連する質の高い論文」だけを収集する仕組みを完成させる。

*   **Hook A: 学名駆動GBIFクローラー (`scripts/ingest_gbif_lit.php`)**:
    *   現在 ikimon.life のレッドリストや観察記録に登録されている「学名（`scientificName`）」のリストを Seed とする。
    *   GBIF Literature API に対し、保有する学名を直接クエリとして投げ、その種に明確に言及している学術論文のみをピンポイントで取得・JSON化（`PaperStore`へ格納）。
*   **Hook B: ローカル博物誌クローラー (`scripts/ingest_museums.php`)**:
    *   国立科学博物館、大阪市立自然史博物館などのオープンアクセスな「紀要」や「研究報告」にターゲットを絞る（J-STAGEやCiNii経由）。
    *   フィールドワーカーにとって最も価値の高い「地方での初記録」や「微妙な生態記録」を確実に拾い上げる。
*   **インデックスの構築 (`libs/TaxonPaperIndex.php`)**:
    *   取得した論文のDOIと、対象となった学名を紐付ける高速なルックアップテーブルを作成。

### Phase 2: Semantic Extraction - LLMによる知識の構造化 (Month 3-4)
**目標**: 収集した良質な論文テキストから、Geminiを活用してアプリが直接利用可能な「構造化データ」を抽出する。

*   **非同期でのメタデータ錬成 (`scripts/distill_papers.php`)**:
    *   収集した論文のアブストラクトや本文に対しGeminiを適用し、以下の2つをJSONとして抽出する。
        1.  **生態制約 (Ecological Constraints)**: 標高、生息環境、出現時期など。
        2.  **同定キー (Identification Keys)**: 近縁種との識別ポイント（ロジックツリー構造）。
*   **品質管理ゲート (Human-in-the-Loop)**:
    *   LLMの抽出結果をすべて盲信せず、アドミン画面で「抽出された同定キー」を人間（専門家）が承認・修正できるレビューUIを実装。

### Phase 3: UI/UX Integration - ユーザー体験への統合 (Month 5)
**目標**: 構造化された論文データを、子供から大人までが自然に使える形でUIに組み込む。

*   **Citation-Backed ID Wizard**:
    *   ユーザーが同定に迷った際、Phase 2で抽出した「同定キー」を用いた2択の質問用フローチャートを提示。
    *   *「AとBの違いはここだよ（出典: 鈴木ら 2024）」* と明記し、「なぜその結論になるのか」を論文ベースで学習できる体験を提供する。
*   **Soft Validation Alarms**:
    *   ユーザーの投稿データ（位置情報、時期）と論文から抽出した「生態制約」を照合。
    *   乖離がある場合、*「あれ？この虫は普通、標高1000m以上にしかいないはずだけど、本当に合ってるかな？（引用: 〇〇論文）」* と警告を出し誤同定を防ぐ。
*   **Dynamic Reference Lists (Zukan)**:
    *   各種の図鑑詳細ページに、その種に紐づく最新の論文リストを自動表示し、深く知りたいユーザーへの導線とする。

### Phase 4: The Feedback Ecosystem - データへの還元 (Month 6)
**目標**: ikimon.life 内のデータ品質を最高レベルに引き上げ、将来の学術研究に貢献できるエコシステムを完成させる。

*   **DwC-A (Darwin Core Archive) エクスポーターへの統合**:
    *   ユーザーの観察記録に紐づく「生息環境（Habitat）」や「生活史（Life Stage）」などの情報を、GBIF互換の世界標準フォーマットで正確に出力できるようにする。
*   **検証済みデータの蓄積**:
    *   論文から得た「生態制約」によるバリデーションを通過した、極めて信頼性の高い観察ビッグデータ（分布や出現時期）を構築し、未来の研究者が「ikimon.lifeのデータ」を引用（Citation）できる土壌を作る。

---

### Phase 5: The Extraction Engine - 10万種対応の自動化エンジン (Completed)
**目標**: 第一段階のKGIである「10万種」の自動抽出を、JSONファイルベースかつAPIコストゼロで完全自律的に達成する基盤を構築する。

*   **The Master Queue**:
    *   全10万種の学名リストを元にキューイングシステムを構築し、24時間365日無人で稼働するデーモン化を実現。
*   **Local AI Pipeline (Qwen 3 Swallow 8B)**:
    *   外部API（Gemini）への依存を断ち切り、WSL上にOllamaとQwen 3 Swallow 8B（日本語特化LLM）を完全ローカルでデプロイ。
    *   「非同期マルチスレッド実行（12〜16並列）」と「Extreme Night Mode（深夜のフル稼働）」を実装し、GPUとCPUを限界まで使い倒す。
*   **Zero-Hallucination Matrix (Reflexion Gate)**:
    *   LLMの抽出結果をデータベースに保存する直前に「ハルシネーション（嘘）が混入していないか」を別のシステムプロンプトで自己監査・自己棄却させる超高精度ゲートを確立。

---

### Phase 6: Project "OMOIKANE" - The Knowledge Graph (Next Evolution)
**目標**: 100万種・3GBクラスのJSONデータの壁を突破し、お名前.com（RSプラン）環境でも超高速動作する「リレーショナル知識グラフ（SQLite）」を構築する。

*   **The Great Migration (JSON → SQLite)**:
    *   メモリクラッシュを引き起こすフラットな `distilled_knowledge.json` を廃止し、サーバーレスかつ爆速な `omoikane.sqlite3` への完全移行マイグレーションスクリプトを作成する。
*   **Reverse-Lookup Engine (逆引き検索の実現)**:
    *   「学名から生態を引く」だけでなく、「夏、標高2000m以上、黄色い花」といった**生態的特徴（制約）の組み合わせから、100万種の中で合致する生物を瞬時に特定できる逆引き検索エンジン**をデータベース層で実現する。
    *   これにより、単なる「図鑑」から「真の推論・特定AIアシスタント（オモイカネ）」へと進化する。
