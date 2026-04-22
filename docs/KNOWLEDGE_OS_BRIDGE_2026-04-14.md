# Knowledge OS Bridge (ChatGPT export → 運用正本)

更新日: 2026-04-22

目的:
- `E:\Projects\f4051...` の ChatGPT エクスポート由来知識を、実運用で迷わない形に固定する
- 「どれが draft で、どれが既に Knowledge OS に統合済みか」を明示する
- エージェントが自己判断するときの参照順を固定する

---

## 1) ソース区分（正本 / draft）

### A. 運用正本（参照優先）
- Decision Intelligence OS:
  - `C:\Users\YAMAKI\.codex\knowledge\decision_intelligence_os\artifacts\registries\user_decision_patterns.md`
  - `C:\Users\YAMAKI\.codex\knowledge\decision_intelligence_os\artifacts\registries\user_rejected_patterns.md`
  - `C:\Users\YAMAKI\.codex\knowledge\decision_intelligence_os\artifacts\registries\project_operating_contexts.md`
  - `C:\Users\YAMAKI\.codex\knowledge\decision_intelligence_os\artifacts\registries\local_business_constraints.md`
  - `C:\Users\YAMAKI\.codex\knowledge\decision_intelligence_os\artifacts\notes\japanese_human_web_writing_and_ai_smell.md`
  - `C:\Users\YAMAKI\.codex\knowledge\decision_intelligence_os\artifacts\decisions\human_product_copy_operating_rules.md`

### B. ドメイン正本（ikimon）
- ikimon Biodiversity OS:
  - `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\overview.md`
  - `...\artifacts\domains\ikimon_product_strategy.md`
  - `...\artifacts\notes\ikimon_identification_system_master_note.md`
- repo docs:
  - `E:\Projects\03_ikimon.life_Product\docs\STAGING_JA_COPY_GUIDE.md`
  - `E:\Projects\03_ikimon.life_Product\docs\research\2026-04-22-human-web-writing-and-ai-smell-synthesis.md`
  - `E:\Projects\03_ikimon.life_Product\docs\review\2026-04-22-production-copy-harvest.md`

### C. Draft（一次抽出 staging。直接の最終判断には使わない）
- ChatGPT export staging:
  - `E:\Projects\f4051...\_knowledge_os_staging\README.md`
  - `...\EXTRACTION_SUMMARY.md`
  - `...\user_decision_patterns.md`
  - `...\myths_and_rejected_patterns.md`
  - `...\project_operating_contexts.md`
  - `...\local_constraints_and_assumptions.md`
  - `...\repeated_questions_registry.md`
  - `...\knowledge_themes_to_deepen.md`

運用ルール:
- 日常の意思決定は A/B を先に参照
- C は「A/Bに未反映の補助証拠」としてのみ参照

---

## 2) 今回確認した要点

1. ChatGPT export は大量（約 56 ファイル、42k+ messages）だが、
   主要示唆は既存 Decision OS レジストリへほぼ吸収済み
2. 特に以下は既に運用側に反映済み
   - evidence-first / issue-first
   - local-first（浜松・地方中小・車社会補正）
   - reject patterns（vibe-only / 媒体依存 / 一般論直適用の棄却）
   - 愛管/LENRI/ikimon の複合経営文脈
3. よって今後は `f4051...` を毎回掘るより、
   `.codex/knowledge` 側のレジストリ参照を標準にする方が速い

---

## 3) 自己判断用の参照順（固定）

### 汎用（マーケ・組織・LLM活用）
1. `decision_intelligence_os/artifacts/architecture/issue_structuring.md`
2. `decision_intelligence_os/artifacts/architecture/problem_space_map.md`
3. `decision_intelligence_os/artifacts/registries/user_decision_patterns.md`
4. `decision_intelligence_os/artifacts/registries/user_rejected_patterns.md`
5. `decision_intelligence_os/artifacts/registries/local_business_constraints.md`

### ikimon タスク
1. `docs/IKIMON_KNOWLEDGE_MAP_2026-04-12.md`
2. `docs/IKIMON_MASTER_STATUS_AND_PLAN_2026-04-12.md`
3. `ikimon_biodiversity_os/artifacts/domains/ikimon_product_strategy.md`
4. `ikimon_biodiversity_os/artifacts/notes/ikimon_identification_system_master_note.md`
5. `docs/STAGING_JA_COPY_GUIDE.md`（文章ルールと page depth）
6. `docs/research/2026-04-22-human-web-writing-and-ai-smell-synthesis.md`
7. `docs/review/2026-04-22-production-copy-harvest.md`
8. `docs/STAGING_RUNBOOK.md` / `docs/DEPLOYMENT.md`（実行系）

---

## 4) 迷いを減らす運用ルール

- ルール1: まず正本（.codex/knowledge）を読む。f4051...は必要時のみ
- ルール2: 新知見は「採用/保留/棄却」で書く（メモのまま残さない）
- ルール3: 地方文脈（浜松/車社会/少人数運用）をデフォルト前提にする
- ルール4: 提案は「短期実行可能な一手」から始める

---

## 5) 未処理の残件（将来）

- f4051... の未精査会話群の追加監査（必要になった時だけ）
- `repeated_questions_registry` を decision OS の既存 registry と定期マージ
- ikimon 固有の repeated questions を ikimon_biodiversity_os 側へ分離

---

## 6) 結論

今後の実務では、
- 「ChatGPT export staging = 参考庫」
- 「.codex/knowledge の registry = 実運用正本」
として扱う。

この切り分けで、毎回の判断開始コストを下げる。
