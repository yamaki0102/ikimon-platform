# Codex 実行検証レポート

## 1. 基本情報

- レポート種別: 実行基盤検証レポート
- 実施日: 2026-04-08
- 実施モデル: Codex (GPT-5 系)
- 対象: `docs/spec/shizuoka-ux-test-cases/` の Claude 向け運用が Codex でも成立するか
- 対象ワークスペース: `C:\Users\YAMAKI\Documents\Playground`

## 2. 結論

- 総合判定: 成立
- 一言要約: ケース prompt 群は Codex でも実行可能で、ローカル起動、主要ページ応答、投稿 API、保存、詳細表示、ゲスト上限制御まで確認できた。ただし、10 ケース個別の完全実行はまだ未着手。

## 3. 今回実施した範囲

- 実行ランブック確認
  - `docs/spec/shizuoka-ux-test-cases/CLAUDE_OPUS_RUNBOOK.md`
  - `docs/spec/shizuoka-ux-test-cases/README.md`
  - `docs/spec/shizuoka-ux-test-cases/TEST_REPORT_TEMPLATE.md`
- ケース prompt / ケース本文確認
  - `docs/spec/shizuoka-ux-test-cases/prompts/prompt_SZ-UC-01.md`
  - `docs/spec/shizuoka-ux-test-cases/01_hamanako_beginner_first_post.md`
- 自動テスト / lint / レンダー検証
- ローカルサーバー応答確認
- 隔離環境での実投稿検証
- ゲスト投稿上限制御の確認

## 4. 今回未実施の範囲

- `SZ-UC-01` から `SZ-UC-10` までの個別ケースレポートの再生成
- 10 ケースすべてのブラウザ操作ベース検証
- スクリーンショット付き UX 証拠採取
- 実機モバイル操作感の比較

## 5. 実行結果サマリ

### 自動テスト

- `php .\composer.phar test`
- 結果: 161 tests / 383 assertions 全通

### 構文検査

- `php .\composer.phar lint`
- 結果: 596 files / errors 0

### 文言スナップショット

- `php .\tools\check_marketing_copy.php`
- 結果: OK

### CLI レンダーゲート

- `php .\tools\render_pages.php`
- 結果:
  - `upload_package/public_html/index.php` OK
  - `upload_package/public_html/about.php` OK
  - `upload_package/public_html/for-business/index.php` OK

### ローカルサーバー応答

- `http://localhost:8899/` → 200

### 主要ページ HTTP 確認

- `/` → 200
- `/post.php` → 200
- `/about.php` → 200
- `/explore.php` → 200
- `/profile.php` → 302 `login.php`

### 投稿関連 API 確認

- `api/taxon_suggest.php?q=ヒドリガモ` → 候補返却あり
- `api/validate_observation.php` → warnings 配列あり、今回条件では 0 件

## 6. 実投稿検証

### 検証環境

- 隔離先: `C:\Users\YAMAKI\Documents\Playground\_tmp_ux_test_env`
- サーバー: `http://127.0.0.1:8898/`
- 理由: ローカル実データを汚さずに投稿 API の成功可否を検証するため

### 実施内容

- `post.php` から CSRF トークン取得
- `curl` の multipart form で画像付き投稿を送信
- 返却された observation ID を `observation_detail.php?id=...` で確認
- 保存先 JSON に反映されたことを確認

### 投稿成功の証拠

- 成功 ID:
  - `45436b55-77cf-4183-ada5-a9a5f9c107f8`
  - `ab67c63e-dca6-4972-872d-d176808c1122`
  - `d90c8f60-24a0-4ba5-aeaa-f8efba5f5ed2`
- 確認結果:
  - 詳細ページは全件 200
  - 保存 JSON に全件存在
  - `municipality=浜松市`
  - `PHOTO_COUNT=1`
  - `LICENSE=CC-BY`

## 7. 重要な発見

### 1. Codex でも runbook 運用は成立する

- Claude 固有の機能前提ではなく、Markdown 指示書としてそのまま読める
- 出力テンプレートと保存先ルールもそのまま使える

### 2. 投稿 API はブラウザ相当 multipart なら正常動作する

- `curl -F "photos[]=@..."`
- 上記経路では投稿成功、保存成功、詳細表示成功を確認

### 3. PowerShell の `Invoke-WebRequest -Form` は検証クライアントとして不適切

- `api/post_observation.php` は `$_FILES['photos']['name']` を配列前提で扱う
- PowerShell 側の単一ファイル multipart では `string` 形になり、500 が発生
- これは通常ブラウザ利用の不具合ではなく、CLI クライアント差異によるもの

### 4. ゲスト投稿 3 件制限は有効

- 3 件までは成功
- 4 件目相当で `/post.php` は `302 login.php?redirect=post.php&reason=guest_limit`

## 8. ケース実行状況

| ケース | 状況 | 備考 |
| --- | --- | --- |
| SZ-UC-01 | 部分実施 | prompt / 本文読解、投稿導線・投稿 API・保存・詳細表示を実地確認 |
| SZ-UC-02 | 未実施 | 個別レポート未作成 |
| SZ-UC-03 | 未実施 | 個別レポート未作成 |
| SZ-UC-04 | 未実施 | 個別レポート未作成 |
| SZ-UC-05 | 未実施 | 個別レポート未作成 |
| SZ-UC-06 | 未実施 | 個別レポート未作成 |
| SZ-UC-07 | 未実施 | 個別レポート未作成 |
| SZ-UC-08 | 未実施 | 個別レポート未作成 |
| SZ-UC-09 | 未実施 | 個別レポート未作成 |
| SZ-UC-10 | 未実施 | 個別レポート未作成 |

## 9. 判断

- 「全部のケースを回したか」への回答: まだ
- 「Codex でこの運用を実行できるか」への回答: できる
- 「ケースごとのレポートを同じ運用で増やせるか」への回答: できる

## 10. 次アクション

- 優先 1: `SZ-UC-01` をこの環境で正式テンプレートに沿って再レポート化する
- 優先 2: `SZ-UC-02` から `SZ-UC-10` を 1 ケース 1 レポートで順次実行する
- 優先 3: 隔離環境 + multipart 投稿 + レポート保存までを自動化し、運用をコマンド化する
