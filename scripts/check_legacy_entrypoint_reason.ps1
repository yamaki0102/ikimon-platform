param(
    [string]$BaseRef = "origin/main",
    [string]$Reason = $env:IKIMON_LEGACY_ENTRYPOINT_REASON,
    [string]$ReasonFile = "ops/deploy/legacy_entrypoint_reasons.json",
    [switch]$WarningOnly
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$reasonFileFullPath = if ([System.IO.Path]::IsPathRooted($ReasonFile)) { $ReasonFile } else { Join-Path $repoRoot $ReasonFile }

function Get-GitLines {
    param([string[]]$GitArgs)

    $output = & git -C $repoRoot @GitArgs 2>$null
    if ($LASTEXITCODE -ne 0) {
        return @()
    }

    return @($output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Get-StatusPath {
    param([string]$Line)

    if ($Line.Length -lt 4) {
        return ""
    }

    $pathPart = $Line.Substring(3).Trim()
    if ($pathPart.Contains(" -> ")) {
        $pathPart = ($pathPart -split " -> ")[-1]
    }

    return $pathPart.Replace('\', '/')
}

$legacyPatterns = @(
    "upload_package/public_html/*",
    "upload_package/libs/*",
    "upload_package/config/*",
    "upload_package/scripts/*",
    "tests/*"
)

$changedPaths = New-Object System.Collections.Generic.HashSet[string]

foreach ($path in Get-GitLines -GitArgs @("diff", "--name-only", "$BaseRef...HEAD")) {
    $null = $changedPaths.Add($path.Replace('\', '/'))
}
foreach ($path in Get-GitLines -GitArgs @("diff", "--name-only")) {
    $null = $changedPaths.Add($path.Replace('\', '/'))
}
foreach ($path in Get-GitLines -GitArgs @("diff", "--cached", "--name-only")) {
    $null = $changedPaths.Add($path.Replace('\', '/'))
}
foreach ($line in Get-GitLines -GitArgs @("status", "--porcelain=v1", "-uall")) {
    $path = Get-StatusPath -Line $line
    if (-not [string]::IsNullOrWhiteSpace($path)) {
        $null = $changedPaths.Add($path)
    }
}

$legacyHits = @(
    $changedPaths |
        Where-Object {
            $path = $_
            @($legacyPatterns | Where-Object { $path -like $_ }).Count -gt 0
        } |
        Sort-Object
)

if ($legacyHits.Count -eq 0) {
    Write-Output "Legacy entrypoint reason check passed: no old PHP entrypoint changes."
    exit 0
}

$normalizedReason = ""
if (-not [string]::IsNullOrWhiteSpace($Reason)) {
    $normalizedReason = $Reason.Trim()
}
if ($normalizedReason.Length -lt 15) {
    $reasonMap = @{}
    if (Test-Path -LiteralPath $reasonFileFullPath) {
        $reasonObject = Get-Content -Raw -LiteralPath $reasonFileFullPath | ConvertFrom-Json
        foreach ($property in $reasonObject.PSObject.Properties) {
            $path = [string]$property.Name
            $value = [string]$property.Value
            if (-not [string]::IsNullOrWhiteSpace($path) -and -not [string]::IsNullOrWhiteSpace($value)) {
                $reasonMap[$path.Replace('\', '/')] = $value.Trim()
            }
        }
    }

    $missingReasonPaths = @(
        $legacyHits | Where-Object {
            -not $reasonMap.ContainsKey($_) -or ([string]$reasonMap[$_]).Trim().Length -lt 15
        }
    )

    if ($missingReasonPaths.Count -eq 0) {
        Write-Output "Legacy entrypoint reason accepted from $ReasonFile"
        Write-Output "Changed legacy entrypoint paths:"
        foreach ($path in $legacyHits) {
            Write-Output "  - $path : $($reasonMap[$path])"
        }
        exit 0
    }

    $message = @(
        "Legacy entrypoint changes require a reason.",
        "Set IKIMON_LEGACY_ENTRYPOINT_REASON, pass -Reason, or add path-specific reasons to $ReasonFile.",
        "Changed legacy entrypoint paths:",
        ($legacyHits | ForEach-Object {
            if ($missingReasonPaths -contains $_) {
                "  - $_"
            } else {
                "  - $_ (reason file ok)"
            }
        })
    ) -join [Environment]::NewLine

    if ($WarningOnly) {
        [Console]::Error.WriteLine("WARNING: $message")
        exit 0
    }

    [Console]::Error.WriteLine($message)
    exit 1
}

Write-Output "Legacy entrypoint reason accepted: $normalizedReason"
Write-Output "Changed legacy entrypoint paths:"
foreach ($path in $legacyHits) {
    Write-Output "  - $path"
}
exit 0
