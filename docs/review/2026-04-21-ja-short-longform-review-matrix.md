# 2026-04-21 JA Short / Longform Review Matrix

`short` は 1 画面目で約束する内容、`longform` は本文で回収する説明責任を持つ。  
`done` は `lead + longform` 更新済み、対応する review doc があり、route 回帰と content guard を通した staging コピーの正典。  
`next pass` は次回レビュー対象。

| route/pageId | short source key | longform file | page depth | first-screen promise | body obligation | paired CTA | internal-jargon risk | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/about` / `about` | `marketing.pages.about` | `platform_v2/src/content/longform/ja/about.md` | 解説面 | 何を残すサービスか / AIはヒント役 / また見る理由 | 何を残すサービスか / なぜ場所を先に残すのか / AIはヒント役 / また見る理由 | `使い方と考え方を見る`, `FAQを見る` | low | done |
| `/learn` / `learn-index` | `marketing.pages.learnIndex` | `platform_v2/src/content/longform/ja/learn-index.md` | 解説面 | 読む順番 / 仕組みを知る入口 / 団体利用の入口 | 読む順番 / 仕組みを知る入口 / 団体利用の入口 | page links inside body | low | done |
| `/faq` / `faq` | `marketing.pages.faq` | `platform_v2/src/content/longform/ja/faq.md` | 解説面 | 1件だけでも意味 / どこまで記録 / 団体相談 | 1件だけでも意味 / どこまで記録 / 団体相談 | body links as needed | low | done |
| `/learn/field-loop` / `learn-field-loop` | `marketing.pages.learnFieldLoop` | `platform_v2/src/content/longform/ja/learn-field-loop.md` | 解説面 | また見る理由 / 1件で言い切らない / AIは補助 | また見る理由 / 1件で言い切らない / AIは補助 / 次にどう使うか | `解説一覧へ戻る` | low | done |
| `/learn/authority-policy` / `learn-authority-policy` | `marketing.pages.learnAuthorityPolicy` | `platform_v2/src/content/longform/ja/learn-authority-policy.md` | 解説面 | AIの候補 / みんなの見立て / 任された人の確認 / 公開前判断 | AIの候補 / みんなの見立て / 任された人の確認 / 公開前判断 / どこで慎重になるか | none | medium | done |
| `/learn/identification-basics` / `learn-identification-basics` | `marketing.pages.learnIdentificationBasics` | `platform_v2/src/content/longform/ja/learn-identification-basics.md` | 解説面 | 名前が分からなくても残せる | 最低限残すもの、写真とメモのコツ、AIの使い方 | none | low | next pass |
| `/learn/methodology` / `learn-methodology` | `marketing.pages.learnMethodology` | `platform_v2/src/content/longform/ja/learn-methodology.md` | 解説面 | 場所を残す理由 / 公開範囲 / 言いすぎない | 場所を残す理由 / 公開範囲 / 言いすぎない / AIと人の線引き | none | low | done |
| `/for-business*` / `forBusiness*` | `marketing.pages.forBusiness*` | `platform_v2/src/content/longform/ja/for-business*.md` | 団体相談面 | 誰向けか / 無料で始める範囲 / 相談で決める範囲 | 対象 / 無料で始める範囲 / 相談前に揃えること / 段階導入 | `お問い合わせする`, page links | low | next pass |
| `/privacy` / `privacy` | `marketing.pages.privacy` | `platform_v2/src/content/longform/ja/privacy.md` | 信頼面 | 何を預かるか / どこまで公開するか | 何を預かるか / どこまで公開するか / どう相談できるか | none | low | next pass |
| `/terms` / `terms` | `marketing.pages.terms` | `platform_v2/src/content/longform/ja/terms.md` | 信頼面 | 使うときの基本ルール / 禁止事項 | 使うときの基本ルール / 禁止事項 / 運営の責任範囲 | none | low | next pass |
| `/contact` / `contact` | `marketing.pages.contact` | `platform_v2/src/content/longform/ja/contact.md` | 信頼面 | 何を相談できるか / 何を送れば早いか | 何を相談できるか / 何を送れば早いか / 団体相談の入口 | `お問い合わせする` | low | next pass |
