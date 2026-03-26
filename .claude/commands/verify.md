---
description: PHP lint + テスト + セキュリティの一括検証
---

# /verify — 品質ゲート

ビルド・テスト・セキュリティの一括検証を実行する。コミットやデプロイ前に使う。

## 手順

1. **PHP Syntax Check**: `php tools/lint.php` でプロジェクト全体の構文チェック
2. **PHPUnit**: `php composer.phar test` でテスト実行
3. **セキュリティスキャン**: 以下を grep で検出
   - `var_dump`, `print_r`, `dd(`, `die(`, `dump(` — デバッグ残し
   - `eval(`, `exec(`, `system(`, `passthru(` — 危険関数
   - `$_GET`, `$_POST` が `echo` に直接渡される — XSS
   - CSRF トークンなしの POST フォーム
4. **結果サマリー**: Pass/Fail を一覧表示

## 出力例
```
✅ PHP Lint: 0 errors
✅ PHPUnit: 42 tests, 0 failures
⚠️ Security: 1 warning (var_dump in post.php:123)
```

全チェックが Pass したら「✅ All checks passed — ready to commit」と表示。
Fail があれば該当箇所と修正案を提示。
