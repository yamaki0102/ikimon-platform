# ikimon Renewal Gate Framework

更新日: 2026-04-12

目的:

- `place-first`, `identification stance`, `collective AI growth loop`, `nature site monitoring` を1本の改装計画に束ねる
- `プロダクト改装 gate` と `v2 cutover gate` を混ぜない
- 何を先に閉じるべきかを、思想から実装順まで一気通貫で固定する

---

## 1. 新しい前提

ikimon は、単なる `生き物検索アプリ` ではない。

ikimon は

- `自分が学ぶ`
- `みんなの AI を育てる`
- `まだ十分に知られていない生物多様性の理解に寄与する`

を、同じ記録ループに乗せる `place-based learning system` である。

したがって renewal の主目的は、画面をきれいにすることではなく、

- なぜ続けたくなるのか
- なぜ記録の質が上がるのか
- なぜ場所への関係が深まるのか
- なぜ企業や地域が乗れるのか

を、同じ product spine に揃えることにある。

---

## 2. Issue Tree

### Issue A. なぜ個人が続けたくなるのか

- `自分が賢くなる`
- `前回よりうまく観察できる`
- `属止めでも前進だと分かる`
- `今回の改善がみんなの AI を育てると感じられる`

### Issue B. なぜデータの質が年単位で上がるのか

- observation first で入口を広く保つ
- formal ID は expert lane に寄せる
- rationale, confidence, ruled-out taxa を残す
- coarse rank を正式許容して誤同定を減らす

### Issue C. なぜ場所との関係が深まるのか

- `今日の発見` から入る
- `この季節の変化` に戻れる
- `去年 / 以前の自分` と比較できる
- `この場所の変化` を読める

### Issue D. なぜ企業・地域が乗るのか

- 価値訴求を `見える化` でなく `自然共生サイトモニタリングの高速起動` に置く
- site quickstart, repeat visit, auto event bootstrap で初速を作る
- Community / Public / sponsor を同じコアで繋ぐ

### Issue E. なぜ切替可能なシステムになるのか

- legacy write surface が固定されている
- canonical contract が固定されている
- v2 data plane が再実行可能である
- shadow sync と rollback がある

---

## 3. Renewal Gate

改装 gate は 8 個にする。  
`Gate 1-5 = product renewal`、`Gate 6-8 = platform migration`。

cutover は Gate 8 まで通って初めて議論してよい。  
Gate 6-8 だけ進んでいても、Gate 1-5 が弱いなら renewal は未完了。

### Gate 1. Motivation Loop Fixed

定義:

- `自分が学ぶ`
- `みんなの AI を育てる`
- `生物多様性理解への寄与`

が、同じ UX ループとして画面とコピーに現れている

受け入れ条件:

- hero / onboarding / feedback に mission 動機がある
- genus stop のとき `失敗` でなく `前進` と感じられる
- feedback 画面に `今回の学び` と `みんなへの貢献` が両方ある

現在地:

- master note と product strategy に思想は入った
- `onboarding.php` に mission 動機カードを追加し、`自分が学ぶ / あとで効く記録 / みんなのAIを育てる` を初回導線へ入れた
- `quick_identify.php` に `これでも前進 / 次に撮るもの / みんなへの貢献` の guidance card を追加し、属止めや不確実性を前向きに扱う最小 UI を入れた
- guidance は `selected rank`, `写真枚数`, `既存の提案数` に応じて動的に変わるようになり、同定行為を `学習と貢献` として返し始めた
- `observation_detail.php` に共通 guidance を追加し、AIメモの直後で `これでも前進 / 次に撮るもの / 自分の外でもどう役立つか` を返すようにした
- `post.php` の投稿完了面にも同じ思想の guidance を入れ、`記録直後` から学びと collective AI growth の意味づけを返し始めた
- `observation_detail.php` の guidance は `community_supporters / conflict / trust lane` まで見るようになり、単なる AI メモでなく `いま何が足りていて何が足りないか` を返し始めた
- ただし feedback history, contribution feedback の実データ連携はまだない

判定:

- `IN PROGRESS`

進捗:

- `70%`

### Gate 2. Place-First Surface Fixed

定義:

- 入口から再訪まで `場所` が主語になっている

受け入れ条件:

- home / explore / my places / place page が place-first で繋がる
- `今日 -> 今季 -> 去年 -> この場所` の時間階層が見える
- North Star と UI 主語が一致している

現在地:

- decision sheet, execution plan, staging cleanup plan はある
- 多言語 parity は閉じた
- ただし page completion はまだ途中

判定:

- `IN PROGRESS`

進捗:

- `55%`

### Gate 3. Capture and Identification Loop Fixed

定義:

- observation-first
- evidence-supported level
- expert lane
- AI suggestion as mentor

が capture / review / public claim に通っている

受け入れ条件:

- novice default は coarse rank を正式許容
- genus stop reason を返す
- retake checklist がある
- formal ID は expert lane と rationale を持つ
- public strong claim は慎重 lane に乗る

現在地:

- stance doc は強い
- canonical 側の更新 parity はかなり入った
- `quick_identify.php` に coarse rank を前向きに扱う説明と retake guidance を追加した
- guidance は rank と existing suggestion count に応じて変わるようになり、`species certainty machine` への逆流を少し抑えた
- `quick_identify.php` の guidance card から `種の案内 / この場所でもう一度記録 / review notes` に飛べるようにし、`読ませるだけ` で終わらない最小 action loop を入れた
- `observation_detail.php` にも同じ思想の guidance を差し、AIメモを `閲覧` で終わらせず `次の一手` と `collective AI growth` に接続した
- `post.php` の成功画面にも guidance を入れ、capture 終了時点で `次の一手` と `学習価値` を返す導線をつないだ
- `observation_detail.php` の guidance は community/trust データも参照し、`あと1件で安定しやすい / いまは意見が割れている / すでに trusted lane に入った` を localized に返す
- `observation_detail.php` の同定一覧と modal に `review lanes / confidence / evidence / expert lane / strong claim caution` を追加し、review queue と public claim cautious lane の最小 UI が入った
- `id_workbench.php?lane=public-claim|expert-lane` を dedicated review flow として使えるようにし、`観察詳細 -> 専用レーン` の直行導線を入れた
- 新規ページはまだ作っていないが、`id_workbench` 自体はもう public claim / expert 専用 queue として開ける
- `expert lane` に `conflict / reference / reason needed` と `全件選択 / 残りをあとで` を足し、review を運用として回しやすくした

判定:

- `IN PROGRESS`

進捗:

- `97%`

### Gate 4. Revisit and Collective Growth Loop Fixed

定義:

- 記録が単発で終わらず、再訪・比較・AI育成への寄与に戻る

受け入れ条件:

- feedback history が見返せる
- `前回の弱点` と `次の改善点` が残る
- contribution feedback が返る
- place revisit の導線がある

現在地:

- 思想は入った
- `observation_detail.php` の各同定カードで `この提案が何を動かしたか` を返し始めた
- first clue / stabilized / trusted lane / review open / reference lane / expert review signal の粒度で contribution feedback を返せる
- `observation_detail.php` に最新 review history を追加し、直近の提案が観察をどう動かしたか見返せるようになった
- `observation_detail.php` から `もう1回この場所で記録する / My places で見返す` の再訪導線を追加した
- `post.php` の完了画面でも `同じ場所でもう1件記録する / My places or nearby records で見返す` までつないだ
- `profile.php` に `最近また行った場所 / そろそろ戻りたい場所` を追加し、My places 側からも再訪候補へ戻れるようにした
- `index.php` にも再訪候補の要約を追加し、home -> post / detail の最短戻りを作った

判定:

- `IN PROGRESS`

進捗:

- `82%`

### Gate 5. Monitoring Offer Fixed

定義:

- 企業 / 地域向け導線が `自然共生サイトモニタリングの高速起動` として閉じている

受け入れ条件:

- LP が monitoring acceleration の主語で統一
- site quickstart がある
- initial event bootstrap がある
- Community / Public / sponsor の役割が衝突しない

現在地:

- `for-business` の多言語 parity は閉じた
- acceleration plan はある
- ただし productized quickstart と workflow は未完

判定:

- `IN PROGRESS`

進捗:

- `45%`

### Gate 6. Legacy and Canonical Foundation Fixed

定義:

- renewal を壊さずに進めるための現行土台が固定されている

受け入れ条件:

- legacy write surface が固定
- canonical contract が固定
- destructive migration guard がある

現在地:

- cutover readiness の Gate 1-2 は閉じた

判定:

- `DONE`

進捗:

- `100%`

### Gate 7. v2 Data and Staging Lane Fixed

定義:

- v2 staging で data plane と最小 read-write lane が動く

受け入れ条件:

- full parity
- hourly drift report
- minimal read-write smoke
- login/logout 代替 lane

現在地:

- cutover readiness の Gate 3 は閉じた
- Gate 4 は minimal API lane まで到達

判定:

- `IN PROGRESS`

進捗:

- `65%`

### Gate 8. Shadow and Cutover Operations Fixed

定義:

- 本番 shadow sync と rollback 運用ができる

受け入れ条件:

- delta sync daemon
- production shadow verification
- rollback rehearsal
- day-0 cutover runbook

現在地:

- ほぼ未着手

判定:

- `NOT STARTED`

進捗:

- `5%`

---

## 4. いま本当に先に閉じる順番

順番を固定する。

1. Gate 1 `Motivation Loop Fixed`
2. Gate 3 `Capture and Identification Loop Fixed`
3. Gate 2 `Place-First Surface Fixed`
4. Gate 5 `Monitoring Offer Fixed`
5. Gate 4 `Revisit and Collective Growth Loop Fixed`
6. Gate 7 `v2 Data and Staging Lane Fixed`
7. Gate 8 `Shadow and Cutover Operations Fixed`

理由:

- ikimon の差別化は `検索速度` ではなく `学習と再挑戦の伴走`
- したがって `why続くのか` と `なぜ属止めでも前進か` を先に閉じる必要がある
- place-first surface はその後に整理する
- corporate は同じ spine の上に載せる
- cutover は product spine が固まった後で十分

---

## 5. Renewal Phase

### Phase A. Motivation Spine

対象 gate:

- Gate 1
- Gate 3

やること:

- onboarding, feedback, explanation card, genus stop reason を first-class にする
- `今回の学び` / `みんなへの貢献` / `次に何を撮れば進むか` を固定 UI 要件にする
- expert lane と novice lane を UI で分ける

### Phase B. Place Loop

対象 gate:

- Gate 2
- Gate 4

やること:

- home / explore / my places / place page を place-first でつなぐ
- revisit, seasonal compare, past-self compare を入れる
- place hub で `今日 / 今季 / 去年 / 長期変化` を読めるようにする

### Phase C. Monitoring Productization

対象 gate:

- Gate 5

やること:

- for-business LP を monitoring acceleration で統一
- site quickstart, first two events, free-start policy を product facts として実装
- sponsor / municipality / corporate site mode を同じコアで分ける

### Phase D. Migration and Cutover

対象 gate:

- Gate 6
- Gate 7
- Gate 8

やること:

- legacy/canonical foundation を維持
- v2 lane を main product spine に追従させる
- shadow sync と rollback を作る

---

## 6. 次の 3 スプリント

### Sprint 1

- Gate 1 を 35% -> 60%
- Gate 3 を 40% -> 60%

具体:

- onboarding に `自分が学ぶ / みんなの AI を育てる` を入れる
- quick identify / result card に `genus stop reason`, `retake checklist`, `contribution feedback` を入れる
- review queue の UI 要件を `expert lane` 前提に書き直す

### Sprint 2

- Gate 2 を 55% -> 75%
- Gate 5 を 45% -> 65%

具体:

- home / explore / place page の page completion
- for-business を `LP -> site quickstart -> auto event bootstrap` で実装計画に落とす

### Sprint 3

- Gate 4 を 15% -> 45%
- Gate 7 を 65% -> 75%

具体:

- feedback history と revisit loop を作る
- v2 lane で record / observation detail / profile の smoke を足す

---

## 7. 使い方

- product の優先順位で迷ったら、まずこの gate を見る
- cutover readiness を見るのは Gate 6 以降だけ
- `この仕事は今やるべきか` は、どの gate を進めるかで判断する

最重要:

- ikimon は `species certainty machine` ではない
- ikimon は `place-based learning system with collective AI growth` である
- この定義に寄与しない改装は、たとえ見た目が良くても優先度を下げる
