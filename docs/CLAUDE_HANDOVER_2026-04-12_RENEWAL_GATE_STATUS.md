# Claude Handover — Renewal Gate Status (2026-04-12)

## 0. この handover の目的

Claude が次セッションで最短復帰できるように、`ikimon.life` の改装状況を

- `プロダクト思想`
- `renewal gate`
- `cutover gate`
- `直近までに実装済みのこと`
- `まだ未完のこと`
- `次にやるべき本筋`

の順で1枚に圧縮したもの。

重要なのは、**renewal gate と cutover gate を混ぜない**こと。

- renewal gate = いまの `ikimon.life` を良いプロダクトに作り直す話
- cutover gate = 将来 `v2` に安全に切り替えるための基盤整備の話

いまの主戦場は renewal gate。

---

## 1. まず読むべき正本

1. `E:\Projects\Playground\docs\strategy\ikimon_renewal_gate_framework_2026-04-12.md`
2. `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\notes\ikimon_identification_system_master_note.md`
3. `C:\Users\YAMAKI\.codex\knowledge\ikimon_biodiversity_os\artifacts\domains\ikimon_product_strategy.md`
4. `E:\Projects\Playground\docs\IKIMON_MASTER_STATUS_AND_PLAN_2026-04-12.md`
5. `E:\Projects\Playground\docs\architecture\ikimon_v2_cutover_readiness_checklist_2026-04-12.md`

---

## 2. プロダクト思想の現時点の結論

ikimon.life は `species certainty machine` ではない。

現時点の product spine はこれ。

- `自分が学ぶ`
- `みんなの AI を育てる`
- `まだ十分に知られていない生物多様性の理解に寄与する`

つまり、

- 観察は広く受ける
- 同定は `証拠に見合う最も細かい粒度` で止める
- 属止めは失敗でなく正式な前進として返す
- AI は真実判定機でなく `候補提示 + 次の一手 + review priority`
- 強い公開主張は慎重 lane に乗せる
- expert lane は separate に扱う

が根本方針。

---

## 3. Renewal Gate 現在地

### Gate 1. Motivation Loop Fixed

- 進捗: `70%`
- 状態: `IN PROGRESS`
- できていること:
  - `onboarding.php` に mission 動機
  - `quick_identify.php` に `これでも前進 / 次に撮るもの / みんなへの貢献`
  - `post.php` の成功画面に学びと collective AI growth の意味づけ
  - `observation_detail.php` に共通 guidance
- まだ弱いこと:
  - feedback 面としてはまだ薄い
  - contribution feedback の蓄積面は部分実装

### Gate 2. Place-First Surface Fixed

- 進捗: `55%`
- 状態: `IN PROGRESS`
- できていること:
  - place-first の意思決定文書は揃っている
  - 公開面の多言語 parity は staging で概ね閉じた
- まだ弱いこと:
  - `home / explore / my places / place page` の page completion が未完
  - 時間階層 `今日 -> 今季 -> 去年 -> この場所` はまだ弱い

### Gate 3. Capture and Identification Loop Fixed

- 進捗: `97%`
- 状態: `IN PROGRESS`
- できていること:
  - novice default は coarse rank 許容の方向へ寄った
  - `quick_identify.php` が genus stop reason / retake guidance を返す
  - `quick_identify.php` の guidance card から `種の案内 / この場所でもう一度記録 / review notes` に飛べる
  - `observation_detail.php` に review lanes / confidence / evidence / expert lane / strong claim caution
  - `id_workbench.php?lane=public-claim|expert-lane` で dedicated review flow を開ける
  - `observation_detail.php` から `公開主張キュー / expert lane キュー` へ直行できる
  - `expert lane` で `conflict / reference / reason needed` を見ながら `全件選択 / 残りをあとで` を回せる
- まだ弱いこと:
  - 専用 lane は `id_workbench` の mode であり、専用 page component までは切っていない
  - 投稿フォーム自体で note 必須にする enforcement はまだない

### Gate 4. Revisit and Collective Growth Loop Fixed

- 進捗: `82%`
- 状態: `IN PROGRESS`
- できていること:
  - `observation_detail.php` に review history
  - 同定ごとの contribution feedback
  - `detail -> post -> profile -> index` の再訪ループ
  - `profile.php` に `最近また行った場所 / そろそろ戻りたい場所`
  - `index.php` に再訪候補要約
- まだ弱いこと:
  - feed/history の深さがまだ足りない
  - place revisit の比較体験はまだ薄い

### Gate 5. Monitoring Offer Fixed

- 進捗: `45%`
- 状態: `IN PROGRESS`
- できていること:
  - `for-business` の多言語 parity は閉じた
  - monitoring acceleration の思想文書はある
- まだ弱いこと:
  - site quickstart
  - initial event bootstrap
  - operational workflow

### Gate 6. Legacy and Canonical Foundation Fixed

- 進捗: `100%`
- 状態: `DONE`

### Gate 7. v2 Data and Staging Lane Fixed

- 進捗: `65%`
- 状態: `IN PROGRESS`
- できていること:
  - cutover readiness gate 1-3 は実質閉じた
  - minimal read-write API lane は smoke 済み
- まだ弱いこと:
  - product parity は未完

### Gate 8. Shadow and Cutover Operations Fixed

- 進捗: `5%`
- 状態: `NOT STARTED`

---

## 4. Cutover Gate 現在地

cutover 側は別軸。

- Gate 1 `Scope freeze`: `DONE`
- Gate 2 `Canonical contract freeze`: `DONE`
- Gate 3 `v2 data plane ready`: `DONE`
- Gate 4 `v2 product parity ready`: `IN PROGRESS`
- Gate 5 `Production shadow sync ready`: `NOT STARTED`
- Gate 6 `Rollback operations ready`: `NOT STARTED`

結論:

- **いまは No-Go**
- ただし `No-Go` の理由は Gate 1-3 ではなく Gate 4-6

---

## 5. 直近までに実装済みのこと

### A. Learning / motivation / capture loop

- `onboarding.php`
  - mission 動機カード追加
- `quick_identify.php`
  - rank / 写真枚数 / 既存提案数に応じた動的 guidance
  - guidance card から action へ飛べる最小 CTA を追加
- `post.php`
  - 投稿完了面に `これでも前進 / 次に足すもの / 自分の外でもどう効くか`
- `observation_detail.php`
  - 同じ guidance を表示
  - review lanes / confidence / evidence / expert lane / strong claim caution

### B. Review / expert lane / public claim

- `observation_detail.php`
  - `強い主張` と `慎重 lane` の区別
  - expert lane badge
  - inline disagreement を cautious lane 寄りに修正
- `id_workbench.php`
  - `公開主張レーン`
  - `expert lane`
  - lane 切替フィルタ
  - current item routing card
  - `?lane=public-claim|expert-lane` の dedicated review mode
  - expert lane triage stats
  - `全件選択 / 残りをあとで`
- `observation_detail.php`
  - `公開主張キュー / expert lane キュー` への直行 CTA

### C. Revisit / collective growth

- `observation_detail.php`
  - latest review history
  - contribution feedback
  - place revisit CTA
- `post.php`
  - 同じ場所で再記録 / 見返す CTA
- `profile.php`
  - 最近また行った場所 / そろそろ戻りたい場所
- `index.php`
  - home に再訪候補要約
- `PlaceRevisitLoop.php`
  - 再訪集計 helper

### D. v2 / cutover 基盤

- canonical create/update parity は広く入った
- divergence CLI は `PASS` まで到達
- v2 ledger/importer/parity/drift report は基礎完了
- staging の drift report hourly 実行も入った

---

## 6. まだ未完で、次に触ると効く場所

### renewal 本筋の残件

1. Gate 3 を閉じる
   - public claim 専用面
   - expert 専用 queue
   - `id_workbench -> dedicated flow` の接続

2. Gate 2 を前に進める
   - `home / explore / my places / place page` の place-first completion
   - 時間階層の visible 化

3. Gate 5 を前に進める
   - `for-business` を monitoring acceleration の product flow に落とす

### cutover 側の残件

1. Gate 4
   - v2 の product parity
2. Gate 5
   - production shadow sync
3. Gate 6
   - rollback rehearsal / runbook

---

## 7. Claude に一番すすめたい次の一手

最高効率で行くなら、次は **Gate 3 を閉じる**。

具体的にはこの順。

1. `id_workbench.php`
   - 追加した `公開主張レーン / expert lane` を受ける dedicated action を作る
   - 例: `慎重 review に送る`, `expert candidate として見る`

2. `review_queue` か新規 page
   - public claim 専用 queue
   - expert 専用 queue

3. `observation_detail.php`
   - 上の queue への明示入口を揃える

理由:

- Gate 3 はいま `88%` で、最短で `DONE` に近づける
- Gate 1/4 もここに連動して押し上がる
- いま place-first completion に戻るより、差分が小さくインパクトが大きい

---

## 8. 作業時の注意

- 実コードの主戦場は `E:\Projects\Playground` 側
- `E:\Projects\03_ikimon.life_Product` は今回の起点だが、最新の PHP 実装は Playground 側にある
- 多言語 public parity は staging までかなり進んでいる
- ただし renewal 系の最新変更は **local only のものがある**
- `shared-root` なので staging 反映時は dirty worktree に注意

---

## 9. 迷ったときの判断原理

迷ったらこの順で決める。

1. `species certainty machine` に戻していないか
2. 属止めや不確実性を `失敗` でなく `前進` と返せているか
3. `自分が学ぶ` と `みんなの AI を育てる` が同時に返っているか
4. `場所` と `再訪` に戻れるか
5. 強い主張だけは慎重 lane に逃がしているか

これを外すなら、その変更はたぶん筋が悪い。
