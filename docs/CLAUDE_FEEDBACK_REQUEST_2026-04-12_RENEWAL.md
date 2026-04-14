# Claude Feedback Request — Renewal Review / UltraPlan (2026-04-12)

以下を Claude Code にそのまま渡してよい。

---

ikimon.life の改装状況に対して、`最近実装したもののレビュー` と `次の ultra-plan` をください。

まず次の順に読んでください。

1. `E:\Projects\Playground\docs\CLAUDE_HANDOVER_2026-04-12_RENEWAL_GATE_STATUS.md`
2. `E:\Projects\Playground\docs\strategy\ikimon_renewal_gate_framework_2026-04-12.md`
3. `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\notes\ikimon_identification_system_master_note.md`
4. `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\domains\ikimon_product_strategy.md`
5. `E:\Projects\Playground\docs\architecture\ikimon_v2_cutover_readiness_checklist_2026-04-12.md`

次に、少なくとも以下の実装を見てください。

- `E:\Projects\Playground\upload_package\public_html\components\onboarding.php`
- `E:\Projects\Playground\upload_package\public_html\components\quick_identify.php`
- `E:\Projects\Playground\upload_package\libs\ObservationLearningGuidance.php`
- `E:\Projects\Playground\upload_package\public_html\post.php`
- `E:\Projects\Playground\upload_package\public_html\observation_detail.php`
- `E:\Projects\Playground\upload_package\libs\IdentificationContributionFeedback.php`
- `E:\Projects\Playground\upload_package\libs\PlaceRevisitLoop.php`
- `E:\Projects\Playground\upload_package\public_html\profile.php`
- `E:\Projects\Playground\upload_package\public_html\index.php`
- `E:\Projects\Playground\upload_package\public_html\id_workbench.php`

レビューの前提はこれです。

- ikimon.life は `species certainty machine` ではない
- `自分が学ぶ + みんなの AI を育てる + 生物多様性理解への寄与` が product spine
- 属止めは失敗でなく正式な前進
- public strong claim は cautious lane
- expert lane は separate に扱う
- renewal gate と cutover gate を混ぜない

やってほしいことは4つです。

## 1. 最近実装したものへのレビュー

以下の観点で、厳しめにレビューしてください。

- 今の実装は本当に product spine に沿っているか
- `species certainty machine` への逆流がまだ残っていないか
- UI が増えただけで loop が閉じていない箇所はどこか
- cheap に見えるが実は筋が悪いものは何か
- 逆に、今の small changes の中で大きく効いているものは何か

出力形式:

1. `Critical mismatches`
2. `High-leverage wins already achieved`
3. `What still feels fake / partial`

## 2. Gate progress の妥当性チェック

いまの自己評価はこうです。

- Gate 1: 70%
- Gate 2: 55%
- Gate 3: 88%
- Gate 4: 82%
- Gate 5: 45%
- Gate 6: 100%
- Gate 7: 65%
- Gate 8: 5%

この進捗感が甘いか厳しいかを判定してください。

出力形式:

- `Too high`
- `Fair`
- `Too low`

を gate ごとに短く。

## 3. UltraPlan を作る

次の `3〜5ラリー` で最も費用対効果が高い plan を作ってください。

条件:

- 本筋優先
- できるだけ少ないラリーで `使える完成度` に寄せる
- renewal gate を優先
- cutover は本筋を邪魔しない範囲に限定
- `必須` と `任意` を混ぜない

出力形式:

1. `Next 1 rally`
2. `Next 3 rallies`
3. `What to defer`
4. `What to delete if necessary`

## 4. 10x 提案

最後に1つだけ、10x 効く構造変更があれば提案してください。

ただし条件:

- 本筋を閉じたあとに効くものだけ
- 今すぐ枝を増やす提案は避ける
- 小手先でなく構造に効くものだけ

回答は日本語で、忖度なしでお願いします。

---

補足:

- `E:\Projects\Playground` 側が実装本体です
- `E:\Projects\03_ikimon.life_Product` は今回の作業起点ですが、最新コードは Playground 側にあります
