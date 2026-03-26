---
description: プロジェクト全体のセキュリティ監査
---

# /security-audit — セキュリティ監査

ikimon.life プロジェクト全体を対象にセキュリティ監査を実行する。

## チェック項目

### 1. 入力バリデーション
- API エンドポイント (`public_html/api/`) の全ファイルで:
  - `$_GET`, `$_POST`, `$_REQUEST` の使用箇所
  - `filter_input()` / `filter_var()` の適用状況
  - JSON リクエストボディの `json_decode` 後のバリデーション

### 2. XSS 対策
- `echo` / `<?=` 出力での `htmlspecialchars()` 適用
- JSON 出力での `JSON_HEX_TAG | JSON_HEX_AMP` フラグ
- Alpine.js `x-text` vs `x-html` の使い分け

### 3. CSRF 対策
- POST/PUT/DELETE を受け付けるエンドポイントで `CSRF::validate()` 呼び出し
- フォームに `<?= CSRF::tokenField() ?>` 埋め込み

### 4. 認証・認可
- Auth::requireLogin() の適用範囲
- API のセッション検証
- 管理者専用機能のアクセス制御

### 5. ファイル操作
- `DATA_DIR` 外へのファイル書き込み試行
- パストラバーサル (`../`) の可能性
- アップロードファイルの MIME 検証

### 6. 情報漏洩
- エラーメッセージでの内部パス露出
- `.env` / `config.php` の Web 公開状況
- `phpinfo()` 呼び出しの残存

## 出力
脆弱性を Critical / High / Medium / Low で分類し、修正案付きで報告。
