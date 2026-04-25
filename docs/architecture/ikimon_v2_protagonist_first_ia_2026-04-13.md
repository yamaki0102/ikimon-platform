# ikimon v2 Protagonist-First IA

更新日: 2026-04-13

## 0. 結論

ikimon の情報設計は、`community-first` ではなく `protagonist-first` を採る。  
ただし個人主義に振り切るのではなく、`個人の学び -> weak community trace -> collective AI growth` の順で接続する。

同時に、同定に関しては

- `一般観察 + AI suggestion`
- `formal ID / expert lane`

を明確に分ける。

---

## 1. なぜこの構成か

### 1.1 個人とコミュニティのつながり

入口で強い community pressure を出すと、初学者には

- うまくやらなければならない
- 間違えると恥ずかしい
- 既存コミュニティに入る感じが重い

という friction になりやすい。

一方で ikimon が欲しいのは、孤立した個人体験でもない。  
理想はこう。

1. `自分の発見`
2. `自分の学び`
3. `前回からの成長`
4. `同じ場所や近い季節の気配`
5. `みんなの AI を育てる contribution`

つまり community は **ambient** に感じさせるが、front では押しつけない。

### 1.2 同定 lane の分離

ikimon の差別化は `誰でも species を断定すること` ではない。  
むしろ

- 観察は広く開く
- AI は候補と学習補助を返す
- formal ID は expert lane に寄せる

方が、長期のデータ品質と AI 学習資産に合う。

---

## 2. 主要 surface の役割

### 2.1 Public / Observer surface

対象:

- top
- record
- detail
- home
- profile
- explore

役割:

- 観察を始めやすくする
- 学びを返す
- 再訪したくなる理由を返す
- uncertainty を肯定的に扱う

出してよいもの:

- AI suggestion
- explanation
- evidence gap
- retake checklist
- place revisit cue
- weak community trace

出しすぎないもの:

- formal expert authority
- strong public claim
- community 内序列

### 2.2 Specialist surface

対象:

- id workbench
- review queue
- public claim review

役割:

- formal ID を根拠つきで積み上げる
- high-risk / rare / public claim を慎重に扱う
- AI suggestion と observer 投稿を精査する

必須:

- rationale
- confidence
- similar taxa ruled out
- locality / seasonality basis
- status distinction

### 2.3 Business / Institutional surface

対象:

- for-business
- pricing
- status
- apply

役割:

- monitoring 基盤としての価値を示す
- ただし generic B2B brochure にしない
- 最後は現地行動・観察・場所の変化に閉じる

---

## 3. IA の並び順

### Layer A. My Story

最初に見せる:

- 今日の発見
- 前回との違い
- 次にやること

主画面:

- top
- record
- home

### Layer B. My Place

次に見せる:

- この場所で見えるもの
- 季節比較
- 再訪候補

主画面:

- detail
- profile
- explore

### Layer C. Ambient Others

その次に見せる:

- 近い場所の観察
- 似た観察の流れ
- review や改善が future AI に効くこと

ここでは `コミュニティ所属感` より `つながりの痕跡` を重視する。

### Layer D. Formal Knowledge

最後に見せる:

- expert lane
- review queue
- public claim

observer flow と混ぜない。

---

## 4. 画面ごとの構成指針

### Top

順番:

1. 今日の自分に近い hero
2. 何が返るか
3. 学び / 再訪 / contribution
4. 導線

### Record

順番:

1. 観察したくなる導入
2. 軽い入力
3. submit 後の mentor feedback
4. 次の detail / revisit 導線

### Detail

順番:

1. 今分かること
2. なぜまだそこまでか
3. 次に撮ること
4. 同じ場所 / 前回 / profile への導線

### Home

順番:

1. 前回からの成長
2. また行く理由
3. 最近の観察
4. profile / explore への導線

### Explore

順番:

1. 行きたくなる場所
2. 季節や地域の流れ
3. 最近の観察
4. detail への導線

### Specialist

順番:

1. lane の責任
2. queue
3. rationale-backed action
4. verification status

---

## 5. UI で分けるべき境界

### Observer / AI side

- `候補`
- `説明`
- `まだ確定ではない`
- `次に撮る`

### Expert side

- `formal ID`
- `reviewed`
- `verified`
- `public claim ready`

同じ色、同じ pill、同じ見出しで見せない。

---

## 6. 実装上の operating rule

1. top nav では `Community` を主ラベルにしない
2. home は feed-first にしない
3. detail では always certainty を約束しない
4. AI suggestion を `公式記録` に見せない
5. specialist action は observer flow から 1 click で見せすぎない
6. collective contribution は reward でなく meaning として返す

---

## 7. 今の v2 への適用

直近で適用すべきこと:

1. top hero は `自分の今日` を主語にする
2. home は `前回からの成長 / revisit cue` を主役にする
3. detail は `why not species yet / next shot` を主役にする
4. specialist は role boundary を文言でも視覚でも強める
5. community らしさは feed ではなく `ambient traces` と `collective AI growth` で見せる

---

## 8. 次の進化

この IA をもとに、`top / home / detail / specialist` の具体 wireframe と copy deck を固定する。
