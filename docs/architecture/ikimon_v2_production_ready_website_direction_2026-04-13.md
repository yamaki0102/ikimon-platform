# ikimon v2 Production-Ready Website Direction

更新日: 2026-04-13

## 0. 結論

現時点の v2 shared shell は **そのまま本番差し替えして良い理想形ではない**。  
ただし、方向としては `統一された site shell を先に作る` のは正しい。

追記:

- トップページの design / structure baseline は `https://staging.ikimon.life/` の現行 PHP トップとする
- v2 top は `新しい見た目を発明する` のではなく、現行トップを母体にして思想と導線を上書きする
- したがって、現行トップより重い / うるさい / SaaS っぽい見た目は不採用

いまの位置づけ:

- 良い: header / footer / visual system / page hierarchy を統一し、website としての確認を可能にした
- 足りない: ikimon 固有の動機設計、Field Mentor らしい feedback、再訪したくなる意味づけ

したがって本番差し替えの判断は、

1. **site shell の統一**
2. **ikimon らしい message system**
3. **core flow の mentor UX**

の 3 条件が揃ってから出す。

---

## 1. 論点分解

### Axis

`Web体験・デザインシステム` と `継続・LTV・ロイヤル化` を分けて見る。  
見た目だけでなく、`続けたくなる理由` が載っているかを同時に評価する。

### 1.1 Message

- 1画面目で何のサービスか分かるか
- `自然は最高のエンタメ` と `学び / 再訪 / collective AI growth` が両立しているか
- moral pressure や説明過多で初回行動を重くしていないか

### 1.2 Screen

- header / footer / container / buttons / cards が統一されているか
- page 間で tone がぶれていないか
- mobile で読みやすいか

### 1.3 Operation

- `Record -> Detail -> Revisit -> Explore` の導線が自然か
- genus stop / uncertainty / retake の思想が UI で見えるか
- public/business/specialist が一つの世界観に入っているか

---

## 2. 知識OS と ikimon 戦略からの判断

### 2.1 採用する原理

- hero では `何のページ / 誰向け / 次に何をするか` が一瞬で分かること
- 初回体験は `今日の発見` に近く、長期意義は 2nd/3rd layer で見せること
- 最大差別化は `当てること` ではなく `なぜ今は当て切れないか` を気持ちよく返すこと
- 継続動機は `自分が学ぶ` と `みんなの AI を育てる` が同時に感じられること
- `場所` と `再訪` が種名より上位のストーリーとして見えること

### 2.2 今の shared shell の評価

良い:

- site-wide consistency は大きく改善した
- 公開面、read 面、specialist 面を同一世界観に寄せる土台ができた
- staging 上で website としての QA ができる

弱い:

- hero がまだ generic で、ikimon 固有の楽しさ・再訪理由が薄い
- record / detail / home が `機能 shell` 感を残している
- `なぜ属止めか / 次に何を撮るか / 今回の学びと貢献` が出ていない
- footer/navigation は揃ったが、message architecture はまだ仮置き
- 現行 `staging.ikimon.life/` トップの軽さ・余白・押しやすさをまだ十分に継承できていない

結論:

- **visual system の方向は採用**
- **message system と core UX は未採用**

---

## 3. 本番差し替え可の採用条件

### A. Message condition

- top hero が `何をするサービスか` と `なぜ楽しいか` を両方伝える
- 2nd section で `学べる / また行きたくなる / 場所ごとに残る` を示す
- 3rd section で `自分が学ぶ + みんなの AI を育てる` を示す
- mission は 4th layer 以降に置き、入口で重くしない

### B. Core flow condition

- record 完了後に `今回の学び` と `次に撮るべき証拠` が返る
- detail で uncertainty が肯定的に扱われる
- home で `前回からの成長` と `また行く理由` が見える
- explore が単なる一覧ではなく `次に見に行きたくなる` 面になる

### C. Visual/system condition

- top / about / business / read / specialist が同じ design token で見える
- mobile width で header, hero, CTA, cards が崩れない
- old PHP URL redirect を含めて導線が一貫する

### D. Release condition

- staging browser QA を MECE で完了
- public/business/core/specialist の代表導線で dead end がない
- human review で `いまの本番より弱い` と感じる箇所が主要導線に残らない

---

## 4. 不採用条件

次の状態では、そのまま差し替えない。

- generic SaaS のように見えて ikimon の思想が伝わらない
- hero が抽象語だけで行動に落ちない
- core pages が「フォーム」「一覧」「DB viewer」に見える
- uncertainty / retake / revisit / contribution のどれも visible でない
- business 面だけ整って、一般観察導線が弱い

---

## 5. いまの判定

- shared shell: `採用`
- current top/about/business visual direction: `条件付き採用`
- current core read shell visual direction: `未採用`
- current full website as production replacement: `未採用`

理由:

- 統一感は出た
- ただし、ikimon の value narrative が core flow にまだ乗っていない
- 本命は `beautiful shell` ではなく `mentor + revisit + collective growth` の可視化

---

## 6. 最短の実装順

1. top を `staging.ikimon.life/` の骨格へ寄せて作り直す
2. detail に `why not species / next shot / learning feedback` を入れる
3. home に `前回からの成長 / revisit cue` を入れる
4. explore に `次に行く理由` を入れる
5. record 完了後の success state を mentor 的に変える
6. その後に about / business の copy を微調整する

---

## 7. 採用条件 / 不採用条件 / 計測指標

### 採用条件

- 1画面目で `何をして何が返るか` が分かる
- 3画面以内で `学び` と `再訪理由` を体験できる
- 観察後の気分が `終わり` ではなく `次もやりたい` になる

### 不採用条件

- 記録して終わり
- 一覧を見て終わり
- business だけ強く、observer の感情導線が弱い

### 計測指標

- 初回 QA で `何のサービスか説明できるか`
- 初回 QA で `次に押す場所が迷わないか`
- 初回 QA で `また使いたい理由` を一文で言えるか

---

## 8. 次の進化

top / detail / home を `production replacement quality` で再設計し、shared shell を本物の ikimon 体験へ上書きする。
