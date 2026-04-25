param(
    [string]$BaseUrl = "https://ikimon.life",
    [string]$SshHost = "root@162.43.44.131",
    [string]$SshKey = (Join-Path $env:USERPROFILE ".ssh\ikimon_vps.pem"),
    [switch]$IncludeStagingSessionSmoke
)

$ErrorActionPreference = "Stop"

function Assert-Status {
    param(
        [string]$Path,
        [int[]]$Expected
    )

    $url = "$BaseUrl$Path"
    $status = [int](curl.exe -s -o NUL -w "%{http_code}" $url)
    if ($Expected -notcontains $status) {
        throw "$Path expected $($Expected -join "/"), got $status"
    }
    Write-Host "$Path -> $status"
}

function Assert-RedirectHost {
    param(
        [string]$Path,
        [string]$ExpectedHost
    )

    $line = curl.exe -s -o NUL -w "%{http_code} %{redirect_url}" "$BaseUrl$Path"
    $parts = $line -split " ", 2
    $status = [int]$parts[0]
    $redirectUrl = if ($parts.Count -gt 1) { $parts[1] } else { "" }
    $redirectHost = if ($redirectUrl.StartsWith("http")) { ([uri]$redirectUrl).Host } else { $redirectUrl }

    if ($status -ne 303 -or $redirectHost -ne $ExpectedHost) {
        throw "$Path expected 303 to $ExpectedHost, got $status to $redirectHost"
    }
    Write-Host "$Path -> $status location=$redirectHost"
}

function Assert-AuthPost {
    param(
        [string]$Name,
        [string]$Origin,
        [string]$SecFetchSite,
        [int]$ExpectedStatus,
        [string]$ExpectedError
    )

    $body = '{"email":"nobody@example.invalid","password":"wrongwrong"}'
    $out = curl.exe -s -X POST "$BaseUrl/api/v1/auth/login" `
        -H "Content-Type: application/json" `
        -H "Origin: $Origin" `
        -H "Sec-Fetch-Site: $SecFetchSite" `
        --data $body `
        -w "`n%{http_code}"
    $lines = $out -split "`n"
    $responseBody = $lines[0]
    $status = [int]$lines[-1]

    if ($status -ne $ExpectedStatus -or $responseBody -notmatch [regex]::Escape("""error"":""$ExpectedError""")) {
        throw "$Name auth POST expected $ExpectedStatus/$ExpectedError, got $status/$responseBody"
    }
    Write-Host "$Name auth POST -> $status $ExpectedError"
}

function Invoke-StagingSessionSmoke {
    $remoteScript = @'
set -euo pipefail
jar=$(mktemp)
body=$(mktemp)
stamp=$(date +%s)
email="codex-smoke-${stamp}@example.invalid"
register_json=$(printf '{"displayName":"Codex Smoke","email":"%s","password":"SmokePass12345","redirect":"/record"}' "$email")
register_status=$(curl -s -c "$jar" -o "$body" -w "%{http_code}" \
  -X POST http://127.0.0.1:3200/api/v1/auth/register \
  -H 'content-type: application/json' \
  -H 'origin: http://127.0.0.1:3200' \
  -H 'sec-fetch-site: same-origin' \
  --data "$register_json")
register_ok=$(grep -o '"ok":true' "$body" || true)
record_status=$(curl -s -b "$jar" -o "$body" -w "%{http_code}" http://127.0.0.1:3200/record)
if grep -q 'id="record-form"' "$body"; then form=present; else form=missing; fi
rm -f "$jar" "$body"
echo "staging register -> ${register_status} ${register_ok}"
echo "staging record with session -> ${record_status} form=${form}"
test "$register_status" = "200"
test "$register_ok" = '"ok":true'
test "$record_status" = "200"
test "$form" = "present"
'@

    $sshArgs = @()
    if ($SshKey -and (Test-Path $SshKey)) {
        $sshArgs += @("-i", $SshKey)
    }
    $sshArgs += @($SshHost, "bash")
    $remoteScript | & ssh @sshArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Staging session smoke failed with exit code $LASTEXITCODE"
    }
}

Assert-Status "/healthz" @(200)
Assert-Status "/readyz" @(200)
Assert-Status "/login" @(200)
Assert-Status "/register" @(200)
Assert-Status "/record" @(200)
Assert-Status "/login.php" @(404)

Assert-RedirectHost "/auth/oauth/google/start?redirect=/record" "accounts.google.com"
Assert-RedirectHost "/auth/oauth/twitter/start?redirect=/record" "twitter.com"

Assert-AuthPost -Name "cross-origin" -Origin "https://evil.example" -SecFetchSite "cross-site" -ExpectedStatus 403 -ExpectedError "same_origin_required"
Assert-AuthPost -Name "same-origin-invalid" -Origin $BaseUrl -SecFetchSite "same-origin" -ExpectedStatus 400 -ExpectedError "invalid_credentials"

if ($IncludeStagingSessionSmoke) {
    Invoke-StagingSessionSmoke
}

Write-Host "Release smoke passed for $BaseUrl"
