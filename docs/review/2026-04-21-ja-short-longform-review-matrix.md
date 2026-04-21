# 2026-04-21 JA Short / Longform Review Matrix

`short` は 1 画面目で約束する内容、`longform` は本文で回収する説明責任を持つ。  
`done` は今回レビュー済み、`next pass` は次回レビュー対象。

| route/pageId | short source key | longform file | page depth | first-screen promise | body obligation | paired CTA | internal-jargon risk | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/about` / `about` | `marketing.pages.about` | `platform_v2/src/content/longform/ja/about.md` | 解説面 | 散歩や旅先の 1 枚を読み返せる記録に変えるページ | 何を残すのか、なぜ場所から入るのか、AI と人の役割、なぜ再訪が価値になるかを答える | `使い方と考え方を見る`, `FAQを見る` | medium | done |
| `/learn` / `learn-index` | `marketing.pages.learnIndex` | `platform_v2/src/content/longform/ja/learn-index.md` | 解説面 | どこから読めばよいかが分かる入口 | 最初の読む順番、仕組みを知る導線、団体向け導線を案内する | page links inside body | low | done |
| `/faq` / `faq` | `marketing.pages.faq` | `platform_v2/src/content/longform/ja/faq.md` | 解説面 | 初心者と団体の迷いどころに答えるページ | 最低限の記録、AI の位置づけ、旅先利用、団体相談前の準備を実務レベルで答える | body links as needed | low | done |
| `/learn/field-loop` / `learn-field-loop` | `marketing.pages.learnFieldLoop` | `platform_v2/src/content/longform/ja/learn-field-loop.md` | 解説面 | なぜ `見つける -> 記録する -> また歩く` を大事にするか | 再訪の意味、循環の価値、AI の役割、言いすぎない線引きを説明する | `解説一覧へ戻る` | medium | next pass |
| `/learn/authority-policy` / `learn-authority-policy` | `marketing.pages.learnAuthorityPolicy` | `platform_v2/src/content/longform/ja/learn-authority-policy.md` | 解説面 | 同定を 1 段で決めない理由を伝える | AI、みんなの見立て、任された人、公開前判断の違いを説明する | none | high | next pass |
| `/learn/identification-basics` / `learn-identification-basics` | `marketing.pages.learnIdentificationBasics` | `platform_v2/src/content/longform/ja/learn-identification-basics.md` | 解説面 | 名前が分からなくても始められることを伝える | 最低限残すもの、写真とメモのコツ、AI の使い方を説明する | none | low | next pass |
| `/learn/methodology` / `learn-methodology` | `marketing.pages.learnMethodology` | `platform_v2/src/content/longform/ja/learn-methodology.md` | 解説面 | データの扱いと線引きを理由つきで説明するページ | 位置情報、公開範囲、AI と人の役割、言いすぎない方針を回収する | none | medium | next pass |
| `/for-business*` / `forBusiness*` | `marketing.pages.forBusiness*` | `platform_v2/src/content/longform/ja/for-business*.md` | 団体相談面 | 学校や地域で始めるときの相談入口を示す | 対象、始め方、相談前に揃えること、段階導入の考え方を説明する | `お問い合わせする`, page links | medium | next pass |
| `/privacy` / `privacy` | `marketing.pages.privacy` | `platform_v2/src/content/longform/ja/privacy.md` | 信頼面 | 位置情報と公開範囲の基本方針を伝える | 何を保持し、どう守り、どこまで公開するかを誤読なく説明する | none | low | next pass |
| `/terms` / `terms` | `marketing.pages.terms` | `platform_v2/src/content/longform/ja/terms.md` | 信頼面 | 安全に使うための前提を伝える | 禁止事項、責任範囲、運用上の前提を明確にする | none | low | next pass |
| `/contact` / `contact` | `marketing.pages.contact` | `platform_v2/src/content/longform/ja/contact.md` | 信頼面 | 個人相談と団体相談の窓口を案内する | どの相談を受けるか、何を送れば返答しやすいかを説明する | `お問い合わせする` | low | next pass |
