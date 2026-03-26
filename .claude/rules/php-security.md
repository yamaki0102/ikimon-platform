# PHP セキュリティルール — ikimon.life

## 必須

### XSS 防御
- HTML 出力時は必ず `htmlspecialchars($val, ENT_QUOTES, 'UTF-8')` を適用
- JSON API 出力は `json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE)`
- Alpine.js テンプレートでは `x-text`（エスケープあり）を優先、`x-html` は信頼データのみ

### CSRF 防御
- POST/PUT/DELETE を受け付ける全エンドポイントで `CSRF::validate()` を呼ぶ
- フォームには `<?= CSRF::tokenField() ?>` を含める
- Ajax リクエストは `X-CSRF-Token` ヘッダーで送信

### ファイルアップロード
- `finfo_file()` で MIME タイプを検証
- 拡張子ホワイトリスト: `['jpg', 'jpeg', 'png', 'webp', 'gif']`
- アップロード先は `DATA_DIR` 配下（`public_html` 外）
- ファイル名はサニタイズ（UUID ベース推奨）

### 認証
- 保護ページでは `Auth::requireLogin()` を冒頭で呼ぶ
- セッション ID はログイン成功時に `session_regenerate_id(true)` で再生成
- パスワードは `password_hash()` / `password_verify()` のみ

## 禁止

- `eval()`, `exec()`, `system()`, `passthru()`, `shell_exec()`, `popen()` — 使用禁止
- `$_GET` / `$_POST` の値を直接 `echo` / `include` / `require` に渡さない
- `extract($_POST)` / `extract($_GET)` — 変数汚染のため禁止
- `phpinfo()` — 本番コードに残さない
- `error_reporting(E_ALL)` + `display_errors = On` — 本番では Off
