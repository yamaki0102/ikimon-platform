# Claude Opus Prompt — SZ-UC-05

以下をそのまま実行してください。

---

ikimon.life の UX テストを 1 ケースだけ実行してほしい。今回の対象は **SZ-UC-05 牧之原の茶農家が益虫害虫を記録する**。

## 最初に読むファイル

1. `C:\Users\YAMAKI\Documents\Playground\AGENTS.md`
2. `C:\Users\YAMAKI\Documents\Playground\docs\spec\shizuoka-ux-test-cases\05_makinohara_tea_farm_insect_check.md`
3. `C:\Users\YAMAKI\Documents\Playground\docs\spec\shizuoka-ux-test-cases\TEST_REPORT_TEMPLATE.md`

## あなたの役割

- テスターとして 1 ケースを最後まで実行する
- 単なる要約ではなく、実行ログと UX 評価を残す
- 結果は Markdown で保存する

## 作業ルール

- この依頼ではアプリ本体コードを編集しない
- 例外として、結果レポートの新規作成だけは許可する
- 可能なら実ブラウザまたはブラウザ自動操作を優先する
- それが不可能なら、何が不足しているかを明記したうえで確認可能な範囲を最大化する
- 推測で「できた」と言わない
- 問題を見つけたら、再現手順とユーザー影響を書く

## 実行手順

1. `AGENTS.md` と対象ケースを読む
2. `http://localhost:8899/` が応答するか確認する
3. 応答しない場合は、リポジトリ root で `php -S localhost:8899 -t upload_package/public_html` を起動する
4. ケースファイルの前提条件に沿って、片手操作と最小入力を中心に検証する
5. 合格条件と失敗シグナルを埋める
6. 結果を次のファイルに保存する

`C:\Users\YAMAKI\Documents\Playground\docs\review\shizuoka-ux-tests\SZ-UC-05_report.md`

## レポート要件

- `TEST_REPORT_TEMPLATE.md` の章立てを使う
- 総合判定を必ず書く
- 最低 3 件の具体的 finding を出す。finding が 0 件なら、その理由と残留リスクを書く
- 確認した URL、参照したファイル、使った前提を明記する
- 可能ならスクリーンショットの保存先も書く

## ケース固有の観点

- 片手操作で詰まらないか
- 種名不明でも写真中心で進めるか
- 農業文脈でも利用価値があるか
- 高齢寄りユーザーに厳しい UI はどこか

完了したら、保存したレポートのパスを最後に一行で示してください。
