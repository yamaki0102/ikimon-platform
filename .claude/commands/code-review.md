---
description: 変更ファイルのコードレビュー（品質・セキュリティ・パフォーマンス）
---

# /code-review — コードレビュー

git diff の変更ファイルに対して包括的なコードレビューを実行する。

## 手順

1. `git diff --name-only` で変更ファイル一覧を取得
2. 各ファイルの差分を読み、以下の観点でレビュー:

### セキュリティ
- XSS: `htmlspecialchars()` / `JSON_HEX_TAG` の使用確認
- CSRF: フォーム送信に `CSRF::validate()` があるか
- ファイルアップロード: `finfo` + 拡張子チェック
- ユーザー入力のサニタイズ

### 品質
- デバッグコードの残存 (`var_dump`, `print_r`, `dd`)
- エラーハンドリングの適切さ
- DataStore API の正しい使用 (`fetchAll` not `getAll`)
- SiteManager の static メソッド呼び出し

### パフォーマンス
- N+1 クエリパターン（ループ内の DataStore 呼び出し）
- 不要なファイル全読み込み
- 大量データの `json_decode` without streaming

### ikimon.life 固有
- パス定数 (`ROOT_DIR`, `DATA_DIR`) の正しい使用
- `public_html/` 配下の配置ルール
- Alpine.js の `x-data` / `x-bind` の適切な使用

3. 各カテゴリで Issue/Warning/OK を報告
4. Critical な問題は修正コード付きで提案

5. **レビューゲートマーカー更新**（push 前の自動ゲート用）

   レビュー完了後、`.claude/review-gate/` ディレクトリを作成し `last-review.json` を書き込む。

   **全カテゴリで Critical/High issue なし → pass:**
   ```bash
   mkdir -p .claude/review-gate
   ```
   ```json
   {
     "commit": "<git rev-parse HEAD の出力>",
     "branch": "<git branch --show-current の出力>",
     "result": "pass",
     "timestamp": <date +%s の出力>,
     "reviewed_files": ["変更ファイル一覧"],
     "summary": "Review passed: 0 critical, 0 high, N warnings"
   }
   ```
   → メッセージ: 「Review passed — push gate marker updated (30分有効)」

   **Critical/High issue あり → fail:**
   ```json
   {
     "commit": "<HEAD>",
     "branch": "<branch>",
     "result": "fail",
     "timestamp": <unix timestamp>,
     "issues": ["問題の一覧"]
   }
   ```
   → メッセージ: 「Review failed — push gate will block. Fix issues and re-review」

   **緊急バイパス**: `HOTFIX_PUSH=1 git push` で review gate をスキップ可能
