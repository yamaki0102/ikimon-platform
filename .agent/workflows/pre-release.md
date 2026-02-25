---
description: 大量実装後のリリース前品質チェック。構文・パス整合性・ブラウザ検証を一気に実行。
---
// turbo-all

# /pre-release — リリース前品質ゲート

> 複数スロットの連続実装後、デプロイ前に必ず実行するチェックリスト。
> 「動くはず」は嘘。証拠を出せ。

## Phase 1: 全ファイル構文チェック (Lint Sweep)

```powershell
$errors = @()
Get-ChildItem -Recurse -Filter *.php upload_package/ | ForEach-Object {
    $null = php -l $_.FullName 2>&1
    if ($LASTEXITCODE -ne 0) {
        $errors += $_.FullName
        Write-Host "FAIL: $($_.Name)"
    }
}
Write-Host "Result: $($errors.Count) errors"
```

**期待結果**: `0 errors`
**よくある原因**:
- 閉じ括弧不足（foreach/if のネスト）
- 重複コードブロック（コピペ事故）
- require_once 先が存在しない

## Phase 1.5: 静的解析 (PHPStan)

> Lint では検出できない「未定義メソッド呼び出し」「型不一致」等を検出。
> **Auth::check() 事件（2026-02-14）の再発防止策。**

```powershell
php tools/phpstan.phar analyse --no-progress --memory-limit=512M
```

**期待結果**: `[OK] No errors` (ベースライン以外のエラーがゼロ)
**よくある原因**:
- 存在しないメソッドを呼んでいる (`Auth::check()` → `Auth::user()`)
- include 先のファイルが存在しない
- 既に private なメソッドを外部から呼んでいる

## Phase 1.8: HTML構造監査 (Structure Audit) 🆕

> タグバランス、meta.php統合、CSP nonce適用を静的解析で検証。
> **全53ファイル 0 errors / 0 warnings が基準（2026-02-18達成）。**

```powershell
php tools/html_structure_check.php
```

**期待結果**: `❌ Errors: 0` / `⚠️ Warnings: 0`
**検出対象**:
- タグの開閉不一致（UNCLOSED_TAG, EXTRA_CLOSE_TAG, CLOSE_TAG_MISMATCH）
- `<!DOCTYPE html>` を持つページで `components/meta.php` が未インクルード
- `cdn.tailwindcss.com` の直接使用（`assets/css/` を使うべき）
- `<script>` タグに `CspNonce::attr()` が未付与

## Phase 2: パス整合性チェック

新規PHPファイル作成時、`require_once` のパスがローカルと本番の両方で解決できるか確認。

```powershell
# 本番サーバーのディレクトリ構造を確認
ssh production "ls ~/public_html/<site>/ | head -10"
ssh production "cat ~/public_html/<site>/.htaccess | grep RewriteRule"
```

**チェック項目**:
- [ ] `.htaccess` に `RewriteRule` があるか → ある場合、true web root は `public_html/` 配下
- [ ] `__DIR__ . '/../../config/config.php'` の `../` の数がローカル構造と一致するか
- [ ] `ROOT_DIR` 定数が定義された後に他のファイルを `require` しているか

## Phase 3: ブラウザ検証 (Visual Verification)

Puppeteerで主要ページのスクリーンショットを撮影。

```
確認対象（最低限）:
1. index.php    — ヒーロー、ナビ、季節コンテンツ
2. explore.php  — 検索、地図、統計カード
3. post.php     — アップロードフロー、フォーム
4. 新規追加ページ — 全て
```

**確認ポイント**:
- PHPエラーが画面に出ていないか
- レイアウト崩れ（要素の重なり、はみ出し）
- 動的データ（APIから取得する数値等）が表示されているか

## Phase 4: E2E フルテスト 🆕

> 認証フロー、API POST、CSRF検証、静的資産、パラメータ付きページまで全網羅。
> テストユーザー作成 → テスト実行 → クリーンアップまで自動。
> **Phase 4 からはローカルサーバー（localhost:8899）が起動している必要がある。**

```powershell
# ローカルサーバーが起動していなければ起動
$server = Get-Process php -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match '8899' }
if (-not $server) {
    Start-Process php -ArgumentList "-S", "localhost:8899", "-t", "upload_package/public_html" -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

# E2E フルテスト実行
php tools/e2e_full.php http://localhost:8899 2>&1 | Out-String -Width 120
```

**期待結果**: 全テストケースが `PASS`
**カバー範囲**:
- 公開ページの HTTP 200 チェック
- API エンドポイントのレスポンス検証（JSON 構造含む）
- ユーザー登録 → ログイン → 認証ページアクセス → ログアウト
- CSRF トークン付き POST リクエスト（観察投稿、同定提案）
- 静的資産（CSS, JS, manifest.json）の存在確認
- テストデータのクリーンアップ

### Phase 4.5: HTML出力完結チェック 🆕
   - 目的: 全ページ（ログイン前後）のPHP Fatal Errorチェック
   - コマンド:
     ```powershell
     # 1. テストユーザー準備 (health_check_user@ikimon.life)
     php tools/ensure_test_user.php

     # 2. 未ログインチェック
     php tools/page_health_check.php http://localhost:8899

     # 3. ログイン済みチェック
     php tools/page_health_check.php http://localhost:8899 --auth
     ```
   - 判定: 全て `✅ ... OK` であること。`❌ ... MISSING` があれば即修正。
     - ※ `/review_queue.php` 等の管理者ページが `Redirect detected` となるのは正常。(exit code 0)
**よくある原因**: 共通コンポーネント（meta.php等）でクラスの `require_once` 欠落
**本番確認**: `php tools/page_health_check.php https://ikimon.life`

## Phase 5: セキュリティパターンスキャン 🆕

> OWASP Top 10 2025 に基づく危険パターンの静的検出。
> eval/exec/unserialize 等の RCE リスクや、ハードコード秘密鍵、デバッグ出力残留を検出。

```powershell
php tools/security_scan.php
```

**期待結果**: `0 CRITICAL/HIGH findings`
**検出パターン**:
- 🔴 CRITICAL: eval(), exec(), system(), shell_exec(), passthru()
- 🟠 HIGH: unserialize(), extract()+SuperGlobal
- 🟡 MEDIUM: ハードコード秘密鍵、file_get_contents()+ユーザー変数、CORS全開放
- 🔵 LOW: var_dump(), print_r(), dd() — デバッグ残留

## Phase 5.5: CSRF フロント⇔バックエンド整合性チェック 🆕

> APIがCSRF検証を要求しているのに、フロント側のfetch()がトークンを送っていない不整合を自動検出。
> **2026-02-18 同定送信バグの教訓から追加。**

```powershell
php tools/csrf_consistency_check.php
```

**期待結果**: `ALL CLEAR — CSRF整合性チェック通過`
**検出パターン**:
- API側で `CSRF::validateRequest()` を呼んでいるのに、フロントのfetchにトークンヘッダーがない
- `components/meta.php` に csrf-token meta タグがない
- CSRF必須APIがフロントから一切呼ばれていない（呼び出し漏れ or 外部専用）

## Phase 5.8: fetch() エラーハンドリング監査 🆕

> fetch() が `response.ok` をチェックせず、失敗レスポンスを無言で無視するパターンを検出。
> CSRF 403 が「壊れた」としか見えなかった根本原因。

```powershell
# fetch() の後に response.ok チェックがないパターンを検出
Get-ChildItem -Path "upload_package/public_html" -Include "*.php","*.js" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'fetch\s*\(' -and $content -notmatch 'response\.ok|res\.ok|\.catch\(') {
        Write-Host "⚠️  $($_.Name) — fetch() にエラーハンドリングなし"
    }
}
```

**期待結果**: 検出 0 件
**注意**: 偽陽性があり得るので、検出されたファイルは目視確認が必要

## Fail Criteria — 以下のいずれかでデプロイ禁止

- [ ] 構文エラーが1件でもある
- [ ] HTML構造チェックでエラーがある
- [ ] 新規ファイルの require_once パスが未検証
- [ ] 主要ページでPHPエラー表示
- [ ] E2E テストで FAIL が1件でもある
- [ ] セキュリティスキャンで CRITICAL/HIGH が1件でもある
- [ ] CSRF整合性チェックで不整合がある 🆕
