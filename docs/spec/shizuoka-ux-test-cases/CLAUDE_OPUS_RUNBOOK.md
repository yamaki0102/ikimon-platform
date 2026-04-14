# Claude Opus 実行ランブック

このディレクトリは、Claude Opus に静岡県内 UX テストケースを 1 本ずつ実行させるための受け渡しパック。

## 目的

- Claude Opus が 1 スレッドで 1 ケースだけ確実に実行できること
- テスト結果の粒度をそろえること
- 「何を読ませて、何を出力させるか」を固定すること

## 事前に用意しておくもの

- このリポジトリを開いた Claude Code または Claude Desktop
- 作業ディレクトリ: `C:\Users\YAMAKI\Documents\Playground`
- ローカル確認用 URL: `http://localhost:8899/`

## 使うファイル

- ケース一覧: [README.md](./README.md)
- 実行ランブック: [CLAUDE_OPUS_RUNBOOK.md](./CLAUDE_OPUS_RUNBOOK.md)
- 結果テンプレート: [TEST_REPORT_TEMPLATE.md](./TEST_REPORT_TEMPLATE.md)
- ケース別 prompt: `prompts/` 配下
- 結果出力先: [docs/review/shizuoka-ux-tests/README.md](C:/Users/YAMAKI/Documents/Playground/docs/review/shizuoka-ux-tests/README.md)

## Claude にやらせること

1. `AGENTS.md` を読む
2. 対象ケースファイルを読む
3. `TEST_REPORT_TEMPLATE.md` の構造に従って結果を書く
4. 必要ならローカルサーバーを起動する
5. 実際に画面遷移と投稿フローを確認する
6. 結果を `docs/review/shizuoka-ux-tests/` に保存する

## Claude にやらせないこと

- 本番デプロイ
- アプリ本体コードの無断修正
- `upload_package/data/` の手動変更
- 秘密情報の出力

## 実行単位

- 1 スレッド = 1 ケース
- 10 ケースまとめて 1 スレッドで処理させない
- ケースごとに独立した結果ファイルを出させる

## 推奨フロー

1. Claude をこのリポジトリのルートで開く
2. `prompts/` から実行したいケースの prompt を開く
3. 中身をそのまま Claude Opus に貼る
4. Claude がレポートを書き終えたら、保存先ファイルを確認する
5. 次のケースは新しいスレッドで実行する

## 期待成果物

- ケースごとの Markdown レポート 1 本
- 必要ならスクリーンショットパス
- 合格 / 要改善 / 不合格 の判定
- 再現手順つきの主要課題

## 命名規則

- レポート: `docs/review/shizuoka-ux-tests/SZ-UC-XX_report.md`
- 任意の補助画像: `output/shizuoka-ux-tests/SZ-UC-XX/`
