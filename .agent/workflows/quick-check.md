---
description: 日常開発用の軽量品質チェック。30秒以内に完了する/pre-releaseの簡易版。
---
// turbo-all

# /quick-check — 日常開発チェック

> コード変更後に素早く確認。全ファイルではなく、変更ファイル中心の軽量チェック。
> デプロイ前の本格チェックは `/pre-release` を使うこと。

## Step 1: 変更ファイルの構文チェック

```powershell
# jj で変更ファイルを取得して lint
$changed = jj diff --name-only 2>$null | Where-Object { $_ -match '\.php$' }
if ($changed) {
    $errors = 0
    foreach ($f in $changed) {
        $result = php -l $f 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ $f"
            $errors++
        }
    }
    Write-Host "`n$($changed.Count) files checked, $errors errors"
} else {
    Write-Host "No PHP files changed"
}
```

## Step 1.5: 静的解析 (PHPStan) — 変更ファイルのみ

```powershell
# 変更ファイルだけ PHPStan で解析 (未定義メソッド呼び出し等を検出)
if ($changed) {
    $changed | ForEach-Object {
        php tools/phpstan.phar analyse --no-progress --memory-limit=512M $_ 2>&1
    }
}
```

## Step 1.8: HTML構造チェック — 変更ファイルのみ

```powershell
# 変更された PHP ファイルのみ HTML 構造監査
$htmlTargets = $changed | Where-Object { $_ -match 'public_html[\\/]' }
if ($htmlTargets) {
    php tools/html_structure_check.php $htmlTargets
} else {
    Write-Host "No public_html PHP files changed — HTML check skipped"
}
```

**検出対象**: タグバランス、meta.php統合、CSP nonce適用
**期待結果**: `❌ Errors: 0` / `⚠️ Warnings: 0`

## Step 2: ローカルサーバー起動 & スモークテスト 🆕

```powershell
# サーバーが起動していなければ起動（バックグラウンド）
$server = Get-Process php -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match '8899' }
if (-not $server) {
    Start-Process php -ArgumentList "-S", "localhost:8899", "-t", "upload_package/public_html" -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

# E2E スモークテスト（Phase 1 のみ = 公開ページの HTTP ステータスチェック）
php tools/e2e_full.php --smoke
```

> **旧方式** (手動curl) から **e2e_full.php --smoke** に統合。
> 30+ページを自動チェック。`exit 1` で失敗を検出。

## Step 2.1. Page Health Check (Local)
   - **Command**:
     ```powershell
     php tools/ensure_test_user.php
     php tools/page_health_check.php http://localhost:8899
     php tools/page_health_check.php http://localhost:8899 --auth
     ```
   - **Goal**: PHP Fatal Error (画面真っ白) がないこと。
   - **Pass**: 全ページ `✅ OK`。`❌` が出たら調査。
**典型的な失敗原因**: 共通コンポーネントで `require_once` 欠落 → PHP Fatal mid-render

## Step 2.5: セキュリティパターンスキャン 🆕

```powershell
# OWASP Top 10 危険パターンを静的検出
php tools/security_scan.php
```

**検出対象**: eval/exec/system/shell_exec (RCE)、extract+SuperGlobal、ハードコード秘密鍵、SSRF、デバッグ出力残留
**判定**: CRITICAL/HIGH が0件ならPASS

## 判定基準
- Step 1 で 0 errors → 変更は安全
- Step 1.8 で 0 errors → HTML構造が正常
- Step 2 で SMOKE TEST PASSED → 全ページレンダリング正常
- Step 2.1 で ALL PAGES HEALTHY → PHP出力が `</html>` まで到達
- Step 2.5 で 0 CRITICAL/HIGH → セキュリティ問題なし
- いずれか ❌ → 修正してから再実行
