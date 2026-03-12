# Remaining Production Diff Candidates (2026-03-12)

本番 parity を取った結果、`git status` に残る tracked modified のうち、現時点で本番との差分候補として残っているのは以下の 3 ファイルだけ。

## 1. `upload_package/libs/WellnessCalculator.php`

差分概要:

- `habit_guidance` を API レスポンスに追加
- `buildHabitGuidance()` を新規追加
- 週次自然時間から CTA 文言と残り分数を生成

意味:

- wellness 画面に「今週あと何分か」「次に何を促すか」を返す backend 差分

## 2. `upload_package/public_html/js/FieldRecorder.js`

差分概要:

- 同期成功時、`result.habit_qualified` が立っていれば
  `window.ikimonAnalytics.track('walk_habit_qualified', ...)` を送る

意味:

- さんぽ記録が habit 条件を満たした瞬間の計測追加

## 3. `upload_package/public_html/wellness.php`

差分概要:

- `habit_guidance` を表示する「WEEKLY LOOP」カードを追加
- CTA ボタン `ikimon_walk.php` / `post.php` を追加
- `started_at` / `species_count` を使うようセッション表示を調整
- `today_card_view` / `today_card_cta` の analytics 計測を追加

意味:

- wellness 画面を「振り返り」から「次の行動を促す habit loop UI」へ拡張する frontend 差分

## 解釈

- 残差分は 1 機能群に収束した
- つまりワークツリー上の大半の modified は「本番未反映」ではなく、既に本番一致の既存変更だった
- 次に切るべきブランチは `wellness-habit-loop` で十分
