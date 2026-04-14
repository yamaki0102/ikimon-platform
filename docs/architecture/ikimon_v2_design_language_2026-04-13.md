# ikimon v2 Design Language

更新日: 2026-04-13

## 0. 目的

この文書は、`ikimon.life` を v2 へ差し替えるときの **見た目 / 情報設計 / 体験の統一基準** を固定する。  
単なる CSS ルール集ではなく、`ikimon らしさ` を壊さないための判断基準として使う。

### Baseline

- visual / layout / section rhythm の母体は `https://staging.ikimon.life/` の現行 PHP トップとする
- v2 は `別ブランドの新デザイン` を作るのではなく、現行トップの構成・余白・軽さを継承したうえで、
  `コピー`, `CTA 優先順位`, `Field Mentor`, `place-first`, `自分のためのサービス感` を上書きする
- `https://staging.ikimon.life/v2/` は、現行トップから乖離したら不採用

---

## 1. デザインの役割

ikimon の UI は、`生き物検索ツール` ではなく次の 3 役を同時に担う。

1. `自然は最高のエンタメ` と感じさせる入口
2. `自分が学んでいる` と感じさせる mentor
3. `またその場所に行きたくなる` 理由を返す observatory

したがって、ikimon のデザインは

- generic SaaS
- database viewer
- scientific encyclopedia

に見えてはいけない。

ただし同時に、`雑に自然系っぽい`, `手作り感が強すぎる`, `情報の並びが粗い` 状態にもしてはいけない。  
ikimon は `野外の空気` を持ちながら、**Google サービスのような静かな洗練** を持つ必要がある。

---

## 2. コア原則

### 2.1 Place-first

- 種名より先に `場所 / 再訪 / 季節 / 変化` を感じられること
- 地図、観察地名、再訪文脈、季節感を主役に置く

### 2.2 Mentor-first

- 正解提示より `なぜ今はここまでか` を返す
- genus stop / evidence gap / retake suggestion を前向きに見せる

### 2.3 Growth-visible

- `前回より見えるようになった`
- `次に何を撮れば進む`
- `この記録がみんなの AI を育てる`

この 3 つが UI のどこかに visible であること

### 2.4 Protagonist-first, community-second

- hero で強い community pressure を出さない
- 入口は `自分の今日 / 自分の前回 / 自分の次回`
- community は否定しないが、front では `ambient connection` として見せる
- `みんながやっているから` ではなく `自分が進めるから続く` を優先する

### 2.5 Observation-first, formal-ID-second

- 一般観察導線では `observation + AI suggestion + learning feedback` を主役にする
- formal identification は別 lane として分ける
- `AI suggestion`, `observer submission`, `expert lane`, `expert verified` を UI 上でも混ぜない
- 誰でも同じ重みで species certainty を確定できるように見せない

### 2.6 Website, not tool dump

- header / footer / hierarchy / CTA がサイトとして統一されること
- 画面ごとに別サービスのように見えないこと

### 2.7 Quiet Precision

- `派手さ` より `整っている感じ` を優先する
- 余白、整列、文字サイズ、角丸、影、色数を厳密に揃える
- 一見すると自然体だが、触ると精度が高い UI にする
- Google サービスのように、`情報量はあるのにうるさくない` 状態を目指す
- `洗練` は冷たさではなく、迷わなさ・読みやすさ・押しやすさとして出す

---

## 3. Message Architecture

### Layer 1: Hero

1画面目で必ず伝えること:

- 何のサービスか
- 誰向けか
- 最初に何をすべきか
- 触るとどんな良いことがあるか

hero で使うべき主題:

- 今日の発見
- 自然は最高のエンタメ
- 観察すると次はもっと見える

hero で前面に出しすぎないもの:

- 保護の義務感
- 難しすぎる科学用語
- 公益だけを強調する重い mission

### Layer 2: Immediate benefit

- 学べる
- 見分けが前進する
- また行く理由ができる

この層は `自分の便益` を主語にする。

### Layer 3: Collective meaning

- 自分の観察がみんなの AI を育てる
- 場所ごとの記録基盤になる

この層は 1st message ではなく 2nd/3rd layer に置く。

### Layer 4: Mission / institution

- biodiversity understanding
- regional monitoring
- corporate / public utility

---

## 4. Visual Direction

### 4.1 全体印象

- 明るい
- 屋外感がある
- 清潔だが無機質ではない
- 研究室より field notebook / observatory に近い
- Google Maps / Google Photos / Google Search のような、軽くて整った trust 感を持つ
- ただし `Google そのもの` には寄せず、ikimon の自然観察らしい柔らかさは残す

### 4.2 色

主軸:

- 葉・土・空気を感じる green 系
- 背景は白ベタでなく、空気感のある light field tone

避ける:

- generic startup purple
- 無機質な pure gray
- dark mode 前提の重い表現
- 原色の多用
- 彩度がバラつく UI

補足:

- ベースは neutral + green accent で組み、必要な強調だけに色を使う
- Google サービスのように `基本は静か、必要箇所だけ強い` を守る

### 4.3 形

- card はやや大きめの corner radius
- 角が立ちすぎない
- CTA は柔らかいが弱くない
- 輪郭は明確だが主張しすぎない
- 角丸、線、影のルールは面ごとに変えない

### 4.4 余白

- 情報量は多くても、息継ぎできる間を残す
- `一覧` より `眺める` 感覚を優先
- セクション間の余白は広めに取り、カード内の余白は均質に保つ
- Google サービスのように、`余白が設計されている感じ` を出す

### 4.5 画像

- 画像は `generic な自然写真` の飾りではなく、`今日の発見 / 再訪したくなる場所 / 観察のディテール / 学びの手触り` を見せるために置く
- 完璧に整った stock 感より、`現地で見つけた` 気配がある方を優先する
- 1st view では `観察対象そのもの` だけでなく、`場所の空気` も一緒に見せる
- hero 画像 1 枚で全部説明しようとせず、`今日`, `場所`, `観察ディテール` の 2-4 面で分ける
- expert lane や business では画像を減らしてよいが、top / learn / explore では視覚の記憶を作る
- ただし top は `画像がなくても成立する` のが条件。コピー、余白、benefit chips、small metric cards だけで空気感を作れるなら画像を無理に置かない

### 4.6 タイポグラフィ

- 見出しは `field note` と `editorial` の中間に寄せる
- body は読みやすさを最優先しつつ、見出しは少し叙情性を持たせる
- `generic dashboard sans` だけで全画面を押し切らない
- top では hero heading, section heading, pull quote の 3 階層を明確に分ける
- タイポ階層は少なく強くする
- Google サービスのように、`見出し / 本文 / 補助情報` の差が一目で分かる状態を作る
- 太字の乱用は避け、重みとサイズ差で情報階層を見せる

### 4.7 動き

- micro animation で散らさない
- page load 時は `hero`, `image block`, `card group` の 3 箇所くらいに限定する
- hover は `少し浮く / 光が差す / 余白が呼吸する` 程度に留める

### 4.8 Top 固有の構図

- 1st viewport で `主張 + CTA + benefit chips + small cards` が同時に見えること
- top の視覚記憶は `画像` でも `タイポ + 空気感 + chips + metrics` でもよい
- hero 下の最初の段で `今日の発見`, `次の学び`, `また行きたくなる場所` を置く
- その次に `自分が学ぶ + みんなの AI を育てる` を少し濃い面で置く
- `ops` や `QA` は最下段に退避させ、トップ前半に運用感を出さない
- hero / cards / metrics / CTA の密度と並びは、まず `staging.ikimon.life/` を写経ベースで合わせる
- 改善は `洗練` のみ許可し、`別物化` は不許可

---

## 5. UI Component Rules

### Header

- すべての主要面で共通
- Home / Explore / Record / Learn / For Business を固定
- CTA は 2 個まで
- `community` を top nav の主ラベルにしない
- Specialist は utility entry として見せても、observer flow と role 混同しない
- nav 項目は増やしすぎない
- Google サービスのように `何が主要導線か` が一瞬で分かること

### Footer

- すべての主要面で共通
- Start / Learn / Trust の 3 ブロックは固定
- staging 期間は QA note を含めてよい

### Hero

- 1ページ1主張
- CTA は primary 1、secondary 2 まで
- abstract copy だけで終わらない
- top では hero 内か直下に `benefit chips / metric cards / image` のどれかを必ず置く
- 画像を使う場合は `発見の現場感` を優先し、説明図やロゴだけで済ませない

### Card

- `説明カード` と `一覧カード` を混ぜすぎない
- 1カード1役割
- card ごとに情報密度を揃える
- 角丸、padding、見出し位置、CTA 位置のばらつきを抑える
- Google サービスのような `同じシステムで作られている感` を出す

### Checklist / Feedback

- `なぜ今は種まで行けないか`
- `次に何を撮るか`
- `今回の学び`

これらは text block でなく、読み返しやすい card / row で返す

### Identification Lane

- observer flow: `観察する -> AI候補を見る -> 学ぶ -> また撮る`
- specialist flow: `review queue -> rationale-backed formal ID -> verification`
- observer 画面で specialist 権限を想起させすぎない
- specialist 画面では根拠・confidence・比較候補を必須に近い扱いで見せる

---

## 6. Page-by-Page Intent

### Top

- 面白そう
- 何をするか分かる
- まず押したくなる
- `自分の物語` が始まる感覚を出す
- みんなとのつながりは ambient trace として下層で見せる
- hero の時点で視覚記憶が残る
- `UI が整っている` より `自然の空気と手触りがある` を優先する
- ただし `素朴` に逃げず、Google サービスのような洗練を保つ
- top は `一目で理解できる / すぐ押せる / 読み疲れない` を満たすこと

### Record

- 難しい入力より、観察したくなる勢いを優先
- submit 後は `登録完了` で終わらず、学びと次行動を返す
- AI suggestion は出してよいが、公式確定のように見せない

### Observation Detail

- 判定結果より explanation が主役
- uncertainty が恥に見えない
- `observer interpretation` と `expert verified` を同じ見た目にしない

### Home

- dashboard ではなく `前回からの成長` の面
- revisit cue を返す
- direct community feed より `自分の trail` を優先する

### Explore

- 一覧面ではなく `次に見に行きたくなる面`
- social feed ではなく place graph に寄せる

### Specialist

- 一般観察導線と別世界にしない
- ただし緊張感と formal review 感は持たせる
- `一般 + AI` と `formal ID` の責任境界が視覚的に分かるようにする

### For Business

- TNFD / monitoring を語れても、最後は現地行動に閉じる
- 見た瞬間に corporate brochure に寄りすぎない

---

## 7. 不採用パターン

- generic SaaS LP
- 図鑑の目次みたいな画面
- ただの管理画面
- ボタンだらけで自然観察の余韻がない画面
- どのページも同じ CTA しかない画面
- species certainty を過剰に約束する表現
- community belonging を入口で強く要求する画面
- AI suggestion と expert verification が同格に見える画面
- 情報は正しいが、整列・余白・階層が粗くてプロダクト品質に見えない画面
- `雰囲気はあるが洗練がない` 画面
- `Google サービスみたいな静かな精度` がなく、雑然として見える画面

---

## 8. 差し替え判定のチェック

本番差し替え前に、各主要画面で次を確認する。

1. 1画面目で `何の面か / 何をするか` が言える
2. `ikimon らしい` と感じる根拠が 1 つ以上ある
3. その面を閉じるとき、次に押す行動が自然に分かる
4. generic SaaS や DB viewer に見えない
5. `学び / 再訪 / collective growth` のどれかが visible
6. protagonist-first が守られ、強い social pressure が入口に出ていない
7. observer lane と specialist lane の責任境界が見える

---

## 9. いまの使い方

以後の v2 UI 実装では、

- 新しい page を作る前
- hero copy を変える前
- 共通 component を変える前

にこの文書を判断基準にする。

実装判断は:

- 合っている: そのまま進める
- 迷う: この文書へ追記してから進める
- 合っていない: 実装より先に文書を直す

---

## 10. 次の進化

この design language をもとに、`top / record / detail / home` の production-ready wireframe を別 MD で固定する。
