param(
    [string]$Path,
    [string]$HostAlias,
    [string]$RemotePath = "/var/www/ikimon.life/deploy_state/prepare_timing_latest.jsonl",
    [int]$Top = 20
)

$ErrorActionPreference = "Stop"

function Get-InputLines {
    if ($Path) {
        if (-not (Test-Path -LiteralPath $Path)) {
            throw "Timing log was not found: $Path"
        }
        return @(Get-Content -LiteralPath $Path)
    }

    if ($HostAlias) {
        if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
            throw "ssh is required when -HostAlias is used."
        }
        $lines = & ssh $HostAlias "cat '$RemotePath'"
        if ($LASTEXITCODE -ne 0) {
            throw "ssh $HostAlias cat '$RemotePath' failed."
        }
        return @($lines)
    }

    throw "Pass either -Path <jsonl> or -HostAlias <ssh-alias>."
}

function Read-TimingRows {
    param([string[]]$Lines)

    $rows = @()
    foreach ($line in $Lines) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }
        try {
            $row = $line | ConvertFrom-Json
        }
        catch {
            Write-Warning "Skipping invalid JSONL row: $line"
            continue
        }
        if ($row.event -ne "deploy_timing" -or -not $row.stage) {
            continue
        }
        $rows += [pscustomobject]@{
            Stage = [string]$row.stage
            Seconds = [double]$row.seconds
            Status = [string]$row.status
            Release = [string]$row.release
        }
    }
    return @($rows)
}

$rows = Read-TimingRows -Lines (Get-InputLines)
if ($rows.Count -eq 0) {
    throw "No deploy_timing rows found."
}

$release = @($rows | Select-Object -ExpandProperty Release -Unique | Where-Object { $_ }) -join ", "
$total = [math]::Round((($rows | Measure-Object -Property Seconds -Sum).Sum), 0)
$failed = @($rows | Where-Object { $_.Status -ne "success" })

Write-Output "# Prepare Timing Summary"
Write-Output ""
Write-Output "Release: ``$release``"
Write-Output "Total measured seconds: ``$total``"
Write-Output "Failed stages: ``$($failed.Count)``"
Write-Output ""
Write-Output "| Rank | Stage | Seconds | Status | Share |"
Write-Output "| ---: | --- | ---: | --- | ---: |"

$rank = 1
foreach ($row in ($rows | Sort-Object Seconds -Descending | Select-Object -First $Top)) {
    $share = if ($total -gt 0) { [math]::Round(($row.Seconds / $total) * 100, 1) } else { 0 }
    Write-Output ("| {0} | `{1}` | {2} | {3} | {4}% |" -f $rank, $row.Stage, $row.Seconds, $row.Status, $share)
    $rank++
}

if ($failed.Count -gt 0) {
    Write-Output ""
    Write-Output "## Failed Stages"
    Write-Output ""
    foreach ($row in $failed) {
        Write-Output ("- `{0}` ({1}s)" -f $row.Stage, $row.Seconds)
    }
}
