$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..\..")

if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = "postgresql:///ikimon_v2_staging?host=%2Fvar%2Frun%2Fpostgresql"
}

if (-not $env:V2_BASE_URL) {
    $env:V2_BASE_URL = "http://127.0.0.1:3200"
}

if (-not $env:V2_PRIVILEGED_WRITE_API_KEY) {
    throw "V2_PRIVILEGED_WRITE_API_KEY is required."
}

Push-Location $projectRoot
try {
    npm run migrate
    npm run smoke:specialist-authority -- --base-url=$env:V2_BASE_URL
} finally {
    Pop-Location
}
