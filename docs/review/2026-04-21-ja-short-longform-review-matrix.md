# 2026-04-21 JA Short / Longform Review Matrix

`short` は 1 画面目で約束する内容、`longform` は本文で回収する説明責任を持つ。  
`done` は `lead + longform` 更新済み、対応する赤入れ doc があり、route 回帰と content guard を通した staging コピーの正典。  
`next pass` は次回レビュー対象。

| route/pageId | short source key | longform file | page depth | first-screen promise | body obligation | paired CTA | internal-jargon risk | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/about` / `about` | `marketing.pages.about` | `platform_v2/src/content/longform/ja/about.md` | 解説面 | 読み返せる記録 / 場所から始める / AI と人の役割 / 再訪が価値 | 何を残すサービスなのか / なぜ「場所」から入るのか / AI はヒント役 / なぜ再訪が価値になるか | `使い方と考え方を見る`, `FAQを見る` | medium | done |
| `/learn` / `learn-index` | `marketing.pages.learnIndex` | `platform_v2/src/content/longform/ja/learn-index.md` | 解説面 | どこから入るか / どこへ進むか / 読む順番 | はじめてならこの順番 / もっと仕組みを知りたいとき / 団体で考えているとき | page links inside body | low | done |
| `/faq` / `faq` | `marketing.pages.faq` | `platform_v2/src/content/longform/ja/faq.md` | 解説面 | 1 件だけでも意味があるのか / どこまで記録すればよいか / 旅先 / 団体利用 | 1 件だけでも意味がありますか？ / どこまで記録すれば十分ですか？ / 旅先の記録にも向いていますか？ / まず何を決めてから相談すればよいですか？ | body links as needed | low | done |
| `/learn/field-loop` / `learn-field-loop` | `marketing.pages.learnFieldLoop` | `platform_v2/src/content/longform/ja/learn-field-loop.md` | 解説面 | また歩く / 1 件で言い切らない / 同じ場所に戻る / AI はどこで補助するのか | なぜ循環で考えるのか / なぜ 1 件で言い切らないのか / 再訪で何が増えるのか / AI はどこで補助するのか / 何を言いすぎないのか | `解説一覧へ戻る` | medium | done |
| `/learn/authority-policy` / `learn-authority-policy` | `marketing.pages.learnAuthorityPolicy` | `platform_v2/src/content/longform/ja/learn-authority-policy.md` | 解説面 | AI の候補 / みんなの見立て / 任された人の確認 / 公開前判断 / どこで慎重さが必要になるのか | なぜ段階を分けるのか / どこで慎重さが必要になるのか / ふだん使うときはどう読めばよいか / だれが「任された人」になるのか | none | high | done |
| `/learn/identification-basics` / `learn-identification-basics` | `marketing.pages.learnIdentificationBasics` | `platform_v2/src/content/longform/ja/learn-identification-basics.md` | 解説面 | 名前が分からなくても始められることを伝える | 最低限残すもの、写真とメモのコツ、AI の使い方を説明する | none | low | next pass |
| `/learn/methodology` / `learn-methodology` | `marketing.pages.learnMethodology` | `platform_v2/src/content/longform/ja/learn-methodology.md` | 解説面 | 場所を残す理由 / 公開範囲を分ける理由 / AI と人の役割 / 見ていないことを言い切らない理由 | なぜ場所を残すのか / 公開範囲をどう分けるのか / 「まだ見ていない」と「いない」を分ける理由 / AI と人の役割をどう分けるのか / 言いすぎない線引き | none | medium | done |
| `/for-business*` / `forBusiness*` | `marketing.pages.forBusiness*` | `platform_v2/src/content/longform/ja/for-business*.md` | 団体相談面 | 学校や地域で始めるときの相談入口を示す | 対象、始め方、相談前に揃えること、段階導入の考え方を説明する | `お問い合わせする`, page links | medium | next pass |
| `/privacy` / `privacy` | `marketing.pages.privacy` | `platform_v2/src/content/longform/ja/privacy.md` | 信頼面 | 位置情報と公開範囲の基本方針を伝える | 何を保持し、どう守り、どこまで公開するかを誤読なく説明する | none | low | next pass |
| `/terms` / `terms` | `marketing.pages.terms` | `platform_v2/src/content/longform/ja/terms.md` | 信頼面 | 安全に使うための前提を伝える | 禁止事項、責任範囲、運用上の前提を明確にする | none | low | next pass |
| `/contact` / `contact` | `marketing.pages.contact` | `platform_v2/src/content/longform/ja/contact.md` | 信頼面 | 個人相談と団体相談の窓口を案内する | どの相談を受けるか、何を送れば返答しやすいかを説明する | `お問い合わせする` | low | next pass |
