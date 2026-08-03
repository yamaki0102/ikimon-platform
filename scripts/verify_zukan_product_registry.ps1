$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

& npm --prefix platform_v2 run test:product-registry
if ($LASTEXITCODE -ne 0) {
    throw "ZUKAN Product Registry tests failed with exit code $LASTEXITCODE"
}

Write-Host "ZUKAN Product Registry verification: PASS"
