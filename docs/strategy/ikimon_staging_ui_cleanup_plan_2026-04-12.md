# ikimon Staging UI Cleanup Plan

最終更新: 2026-04-12  
対象: staging の公開面  
優先対象: `header / hero / footer / explore / profile / for-business`

## 進捗

- 完了: `Phase 1 Shared cleanup`
- 完了: `Phase 2 Home cleanup`
- 完了: `Phase 3 Explore simplification`
- 完了: `Phase 4 Profile reframing`
- 完了: `Phase 5 For Business trim`
- 完了: `Visual second pass`
- 完了: `Copy architecture tuning`

## 1. 目的

staging の公開面を、`情報が多い / 改行が不自然 / 文言が語りすぎる / 幅で崩れる` 状態から、

- 主導線がすぐわかる
- 文字が安定して読める
- 幅が変わっても壊れない
- 英語混じりが少ない
- Google 公式サイトのように静かで整理された見え方

に寄せる。

## 2. 問題分解

### A. 情報量の問題

- shared header に役割の違う要素が同居している
- hero が複数メッセージを同時に語っている
- footer がリンク集以上の説明を持ちすぎている

### B. レイアウトの問題

- header に幅予算がない
- locale 変更時の文字幅が設計に織り込まれていない
- page ごとに `pt-14`, `header spacer`, sticky block の扱いがばらついている

### C. 文言の問題

- ポエミーな抽象語が混ざる
- 日本語 UI に英語ラベルが残る
- 同じ意味の文言が複数トーンで存在する
- 機能名をそのまま hero copy に上げており、`それで自分に何があるか` が欠けている

### D. 品質運用の問題

- shared component を触った後の visual gate が後ろすぎる
- `4幅 x 4言語 x 2状態` の確認が固定されていない

## 3. 設計原則

### 原則 1: 主導線は 2-3 本まで

- header の常設リンクは最大 2 本
- 主 CTA は 1 本
- 補助導線は menu や page body に逃がす

### 原則 2: 文言は動詞ベース

- 採用: `記録する`, `探す`, `見返す`, `参加する`
- 不採用: `関係を深める`, `気持ちよく残す`, `未来につながる` を front copy に置くこと

### 原則 2.5: hero copy は機能名で終わらせない

- hero の 1 行目は `即時便益`
- CTA は `行動`
- trust / support で `長期意味`
- `記録する / 探す / 見返す` は CTA や補助導線には使ってよい
- ただし h1 や support card の主コピーにそのまま置かない

### 原則 3: hero は 1 メッセージ + 1 補足

- h1 は 1 主張だけ
- 補足文は 2 文まで
- metrics / supporting cards は 3 枚まで、各カード 1 行タイトル + 1 行説明

### 原則 4: footer は説明しすぎない

- 役割は `回遊補助 + 信頼補助`
- 説明文は 1 ブロックだけ
- リンク群は 3 カラム以内

### 原則 5: locale と width を前提に作る

- `390 / 768 / 1280 / 1536`
- `ja / en / es / pt-BR`
- `guest / signed-in`

## 4. 監査結果

### Header

- まだ要素数が多い
- search, nav links, notification, user menu, CTA, language が同列に並ぶ
- signed-in と guest の状態差が大きい
- mobile menu の文言が旧思想のまま残っている

### Home

- hero の方向性は改善中だが、補助カードがまだ多い
- old philosophy の文言が一部残る
- home 全体で `place-first / fun / evidence` の優先順位がまだ不均一

### Explore

- sticky filter area が情報量過多
- title, subtitle, search, chips, imported toggle, AI filter, invasive filter, source filter を同時に出している
- 初見の認知負荷が高い

### Profile

- `My Places` の方向に寄せたいが、実体は `profile / rank / gamification / wellness / report` が混在
- first view の優先順位が散っている

### For Business

- LP としての情報量が多い
- hero 以下の block 数が多く、見出しの密度も高い
- 現状の public / community / personal の説明が front でやや重い

## 5. 実装順

### Phase 1: Shared cleanup

対象:

- `components/nav.php`
- `components/footer.php`
- `lang/*.php`

内容:

- header を `logo / 2 links / primary CTA / utility` に固定
- mobile menu を新しい言葉に揃える
- footer の説明とリンク量を削る
- 英日混在ラベルを整理する

完了条件:

- header で横崩れなし
- 英語混在ラベルなし
- footer の first view 説明量が半減している

### Phase 2: Home cleanup

対象:

- `index.php`

内容:

- hero の h1, subcopy, support metrics をさらに削る
- card 群の視覚密度を下げる
- `fun / growth / evidence` の順に整理する

完了条件:

- hero の意味が 3 秒で取れる
- 1 画面内の強い要素数が 5 個以下

### Phase 3: Explore simplification

対象:

- `explore.php`

内容:

- sticky block を 2 段から 1 段に減らす
- chip 群は primary filter と secondary filter に分離
- 初見で不要な filter は collapse / more に逃がす

完了条件:

- first view に並ぶ chips 数を大幅削減
- mobile で改行崩れなし

### Phase 4: Profile reframing

対象:

- `profile.php`

内容:

- first view を `自分の場所 / 最近の記録 / 基本 stats` に絞る
- rank / wellness / wrapped 的要素を二軍に下げる

完了条件:

- first view が profile ではなく `自分の場所` として読める

### Phase 5: For Business trim

対象:

- `for-business/index.php`

内容:

- hero と pricing までの情報量を圧縮
- region / school / company の説明を短くし、詳細は下層へ逃がす

完了条件:

- first scroll で要点が取れる
- section density が下がる

## 6. 品質ゲート

実装ごとに次を確認する。

- `390 / 768 / 1280 / 1536`
- `ja / en / es / pt-BR`
- `guest / signed-in`
- `horizontal overflow = 0`
- `button overflow = 0`
- `unexpected line break = 0`
- `icon clipping = 0`
- `mixed-language primary labels = 0`

## 7. 実装ルール

- shared component を先に閉じる
- page 固有施策を shared fix より先にやらない
- copy change は structure change と一緒にやる
- 1 phase ごとに staging で確認する
- 本番反映は最後まで行わない

## 8. いまの実施方針

次に着手するのは `Phase 1: Shared cleanup の仕上げ`。  
具体的には `nav mobile menu の旧文言除去`, `signed-in menu の整理`, `footer の最終削減` を先に閉じる。

## 9. 2026-04-12 追記: Copy architecture tuning

- `記録する / 探す / 見返す` のような機能名を hero 主コピーから外した
- Home は `歩く理由が増える / 少しわかる / また見たくなる` の順に並べ替えた
- `meta.php` 側で `| ikimon` の二重付与を防ぎ、page title の重複を shared で止めた
- 次の locale sweep でも、`即時便益 -> 行動 -> 長期意味` の順を崩さない
