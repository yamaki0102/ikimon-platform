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

## Step 2: ローカルサーバー起動 & ヘルスチェック

```powershell
# サーバーが起動していなければ起動（バックグラウンド）
$server = Get-Process php -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match '8899' }
if (-not $server) {
    Start-Process php -ArgumentList "-S", "localhost:8899", "-t", "upload_package/public_html" -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

# 主要ページのHTTPステータス確認
@('/', '/explore.php', '/post.php') | ForEach-Object {
    $status = curl -s -o /dev/null -w "%{http_code}" "http://localhost:8899$_"
    $icon = if ($status -eq '200') { '✅' } else { '❌' }
    Write-Host "$icon $_ → $status"
}
```

## 判定基準
- Step 1 で 0 errors → 変更は安全
- Step 2 で全 200 → ページレンダリング正常
- いずれか ❌ → 修正してから再実行
