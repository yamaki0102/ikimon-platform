$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

& npm --prefix platform_v2 exec -- tsx --test src/productRegistry.test.ts src/productRegistryRequirements.test.ts
if ($LASTEXITCODE -ne 0) {
    throw "ZUKAN Product Registry tests failed with exit code $LASTEXITCODE"
}

Write-Host "ZUKAN Product Registry verification: PASS"
