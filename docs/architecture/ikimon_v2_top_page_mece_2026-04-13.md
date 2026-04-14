# ikimon v2 Top Page MECE Breakdown

対象ページ: `https://staging.162-43-44-131.sslip.io/v2/`  
比較基準: `https://staging.ikimon.life/` の現行 PHP トップ  
基準実装: `repo_root/platform_v2/src/app.ts` の `buildLandingRootHtml` と `repo_root/platform_v2/src/ui/siteShell.ts`

## 1. 目的

このページは、ikimon.life v2 のトップページを

- 何のサービスか
- 最初に何をすればよいか
- なぜ続けたくなるか
- 他にどんな入口があるか

の4つに分けて、最短で理解させるための入口である。

ただし今後の改善では、`https://staging.ikimon.life/` の現行トップを母体として、
この MECE を `別物の新トップを作るため` ではなく `現行トップを v2 へ移植するため` に使う。

## 2. 構成要素 MECE

### A. グローバルフレーム

ページ全体の共通枠。本文以外の恒常要素。

| 要素 | 役割 | 現在の中身 |
|---|---|---|
| Header | どの面にいるかを示し、主要導線へ遷移させる | Brand, Home, Explore, Record, Learn, For Business, Header CTA |
| Main shell | ページ本文を読みやすい幅に制御する | `shell` container |
| Footer | 下層導線、Trust、Business、Learn への再分岐 | ikimon summary, Start, Learn, For Business, Trust |

### B. トップ本文

トップページ固有の本文。役割ごとに4ブロックへ分かれる。

| ブロック | 役割 | 現在の中身 |
|---|---|---|
| Hero | サービスの第一印象と最初の行動提示 | Eyebrow, Headline, Lead, metrics, benefit chips, primary/secondary CTA |
| Core value steps | 使い続ける理由を3段で理解させる | Today, Season, Later の3カード |
| Thesis banner | ikimon の思想を短く伝える | Field Mentor banner |
| Secondary gateways | 主導線以外の入口を示す | Learn card, For Business card |

## 3. コンテンツ要素 MECE

### A. ブランド・認知

「何のサービスか」を伝える要素。

| 要素 | 内容 |
|---|---|
| Brand name | `ikimon.life` |
| Brand subtitle | `observe, learn, revisit` |
| Page title | `いつもの散歩が、少しだけ冒険になる` |
| Hero eyebrow | `ikimon life` |

### B. ベネフィット訴求

「使うと何が良いか」を伝える要素。

| レイヤー | 内容 |
|---|---|
| 主便益 | いつもの散歩が少しだけ冒険になる |
| 準主便益 | 見つけたものを残しておくと次の見え方が変わる |
| 機能便益 | 記録できる、あとで見返せる、場所ごとに比べやすい |
| 継続便益 | また行きたくなる、次に見るべきものが分かる |

### C. 社会的・定量的証拠

「すでに動いている感」を伝える要素。

| 要素 | 内容 |
|---|---|
| Observation metric | 観察件数 |
| Species metric | 確認種数 |
| Place metric | 場所数 |

### D. 行動導線

「何を押せばよいか」を分担している要素。

| 種別 | 役割 | 現在の要素 |
|---|---|---|
| Primary CTA | 最初の主行動 | `観察をはじめる`, `Record` |
| Secondary CTA | 覗いてみる導線 | `近くの発見を見る`, `Explore` |
| Value-step CTA | 各便益に対応する個別導線 | `Record`, `Observation Detail`, `My Trail` |
| Secondary gateway CTA | 補助入口 | `Learn`, `For Business` |

### E. 思想・世界観

「ikimon が何を信じているか」を伝える要素。

| 要素 | 内容 |
|---|---|
| Thesis heading | `自分が学ぶことと、みんなの AI を育てることが、ひとつの行動になる。` |
| Thesis body | 観察は自分の学び、場所の記録、未来の候補提示改善の材料になる |

### F. 補助情報

「今すぐ押さなくてもよいが、理解を補完する」要素。

| 要素 | 役割 |
|---|---|
| Learn gateway | About, FAQ, 同定の考え方, Methodology への入口 |
| For Business gateway | 組織導入、運用基盤への入口 |
| Footer links | 再探索、比較、Trust、Business 下層への再導線 |

## 4. 情報設計 MECE

### A. ユーザーの問い

トップページが答えるべき問いを MECE に並べる。

| 問い | 回答する場所 |
|---|---|
| これは何か | Hero headline / lead |
| 自分に関係あるか | Benefit chips / 3ステップ |
| 何をすれば始まるか | Hero CTA / Record CTA |
| 続けると何が起きるか | Season / Later / Thesis banner |
| 深く知る入口はどこか | Learn gateway |
| 仕事で使えるか | For Business gateway |

### B. 意思決定フェーズ

| フェーズ | 目的 | 対応要素 |
|---|---|---|
| 認知 | サービスの空気をつかむ | Header, Hero |
| 初期理解 | 自分向けか判断する | Chips, metrics, 3 cards |
| 初回行動 | 最初の押し先を決める | Hero CTA, step CTA |
| 継続理解 | なぜ続くか腹落ちする | Field Mentor banner |
| 分岐 | 別目的の入口へ進む | Learn, For Business, Footer |

## 5. UI要素 MECE

### A. 表示コンポーネント

| 種類 | 現在の用途 |
|---|---|
| Sticky header | 常時ナビゲーション |
| Hero panel | 第一印象と CTA 集約 |
| Metric strip | 定量的証拠の圧縮表示 |
| Chip row | 軽い便益の箇条書き表示 |
| Accent cards | 3ステップ訴求 |
| Thesis banner | 思想の圧縮表示 |
| Standard cards | Learn / Business 分岐 |
| Footer blocks | 役割別リンク群 |

### B. 文体レイヤー

| レイヤー | 文体 |
|---|---|
| Hero | 感情に近い、短い、日常起点 |
| Steps | 行動起点、具体的 |
| Thesis | やや抽象、思想圧縮 |
| Gateway | 説明的だが短い |
| Footer | ナビゲーション中心 |

## 6. 現在のトップの強み

- 何を押せばよいかはかなり明確
- Hero と 3ステップで主導線は閉じている
- Learn と For Business が主導線を邪魔しない
- Footer で Learn / Trust / Business を再整理できている

## 7. 現在のトップの不足

- Hero がまだ少し説明的で、現行 ikimon.life の軽さには届いていない
- `Field Mentor` バナーが思想として正しい一方、トップ文脈では少し重い
- `Observation Detail` や `My Trail` は内部概念で、初見では意味が即伝わりにくい
- community と expert lane をあえて裏に回しているが、そのぶん `ひとりで始めて続く理由` の表現をもっと強くする余地がある

## 8. 次の改善論点

### 必須

1. `staging.ikimon.life/` の hero / CTA / metrics / step rhythm を v2 に寄せる
2. Hero のコピー密度をさらに下げる
3. `Field Mentor` バナーをもう少し軽い見せ方へ変える

### 任意

1. footer の Specialist lane は public top の文脈からさらに下げる
2. Learn gateway に `FAQ / Methodology / Updates` の中身差を少しだけ見せる
