param(
    [int]$Pr,
    [string]$RunId,
    [string]$Sha,
    [int]$Limit = 20,
    [int]$LogTail = 160,
    [switch]$NoLogs
)

$ErrorActionPreference = "Stop"

function Invoke-GhJson {
    param([string[]]$GhArgs)

    $errFile = [System.IO.Path]::GetTempFileName()
    try {
        $output = & gh @GhArgs 2> $errFile
        $exitCode = $LASTEXITCODE
        $errText = Get-Content -Raw -Path $errFile
    }
    finally {
        Remove-Item -LiteralPath $errFile -Force -ErrorAction SilentlyContinue
    }

    if ($exitCode -ne 0) {
        throw "gh $($GhArgs -join ' ') failed:`n$errText`n$($output -join "`n")"
    }

    $text = $output -join "`n"
    if ([string]::IsNullOrWhiteSpace($text)) {
        return $null
    }

    $jsonText = $text.Trim()
    $objectIndex = $jsonText.IndexOf("{")
    $arrayIndex = $jsonText.IndexOf("[")
    $starts = @($objectIndex, $arrayIndex) | Where-Object { $_ -ge 0 } | Sort-Object
    if ($starts.Count -gt 0 -and $starts[0] -gt 0) {
        $jsonText = $jsonText.Substring($starts[0])
    }
    if ($jsonText.StartsWith("{")) {
        $end = $jsonText.LastIndexOf("}")
        if ($end -ge 0) { $jsonText = $jsonText.Substring(0, $end + 1) }
    }
    elseif ($jsonText.StartsWith("[")) {
        $end = $jsonText.LastIndexOf("]")
        if ($end -ge 0) { $jsonText = $jsonText.Substring(0, $end + 1) }
    }

    return $jsonText | ConvertFrom-Json
}

function Invoke-GhLines {
    param([string[]]$GhArgs)

    $errFile = [System.IO.Path]::GetTempFileName()
    try {
        $output = & gh @GhArgs 2> $errFile
        $exitCode = $LASTEXITCODE
        $errText = Get-Content -Raw -Path $errFile
    }
    finally {
        Remove-Item -LiteralPath $errFile -Force -ErrorAction SilentlyContinue
    }

    if ($exitCode -ne 0) {
        throw "gh $($GhArgs -join ' ') failed:`n$errText`n$($output -join "`n")"
    }

    return @($output)
}

function Format-Conclusion {
    param($Status, $Conclusion)

    if ($Status -ne "completed") {
        return $Status
    }
    if ([string]::IsNullOrWhiteSpace([string]$Conclusion)) {
        return "completed"
    }
    return $Conclusion
}

function Get-RunsForWorkflow {
    param(
        [string]$Workflow,
        [string]$TargetSha,
        [int]$RunLimit
    )

    $runs = Invoke-GhJson -GhArgs @(
        "run", "list",
        "--workflow", $Workflow,
        "--limit", [string]$RunLimit,
        "--json", "databaseId,displayTitle,headBranch,headSha,status,conclusion,createdAt,updatedAt,url,event"
    )

    if ($TargetSha) {
        return @($runs | Where-Object { $_.headSha -eq $TargetSha })
    }

    return @($runs | Select-Object -First 1)
}

function Get-FailedJobs {
    param($Run)

    return @($Run.jobs | Where-Object { $_.conclusion -eq "failure" -or $_.conclusion -eq "cancelled" -or $_.conclusion -eq "timed_out" })
}

function Get-FailedSteps {
    param($Job)

    return @($Job.steps | Where-Object { $_.conclusion -eq "failure" -or $_.conclusion -eq "cancelled" -or $_.conclusion -eq "timed_out" })
}

function Get-MinimalJobLog {
    param(
        [string]$JobId,
        [int]$TailCount
    )

    $lines = Invoke-GhLines -GhArgs @("run", "view", "--job", $JobId, "--log")
    $patterns = @(
        "##\[error\]",
        "Process completed with exit code",
        "\bERROR\b",
        "\bError\b",
        "\bfail(ed|ure)?\b",
        "\bFAIL\b",
        "constraint",
        "violat",
        "did not return",
        "No known",
        "fatal",
        "Exception"
    )
    $regex = [regex]::new(($patterns -join "|"), [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    $selected = New-Object System.Collections.Generic.List[string]

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($regex.IsMatch([string]$lines[$i])) {
            $start = [Math]::Max(0, $i - 2)
            $end = [Math]::Min($lines.Count - 1, $i + 8)
            for ($j = $start; $j -le $end; $j++) {
                $line = [string]$lines[$j]
                if ($line -notmatch "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}") {
                    continue
                }
                if ($line -match "\sINPUT_[A-Z0-9_]+:" -or $line -match "\sskip \d{4}_[^\s]+\.sql") {
                    continue
                }
                if (-not $selected.Contains($line)) {
                    $selected.Add($line)
                }
            }
        }
    }

    if ($selected.Count -eq 0) {
        return @($lines | Select-Object -Last $TailCount)
    }

    return @($selected | Select-Object -Last $TailCount)
}

function Write-RunSummary {
    param(
        [string]$Label,
        $Run,
        [switch]$IncludeFailureLog
    )

    if (-not $Run) {
        Write-Output "${Label}: not found"
        return
    }

    $state = Format-Conclusion -Status $Run.status -Conclusion $Run.conclusion
    Write-Output "${Label}: $state"
    Write-Output "  run: $($Run.databaseId)"
    Write-Output "  title: $($Run.displayTitle)"
    Write-Output "  branch: $($Run.headBranch)"
    Write-Output "  sha: $($Run.headSha)"
    Write-Output "  url: $($Run.url)"

    if ($Run.status -eq "completed" -and $Run.conclusion -ne "success") {
        $detail = Invoke-GhJson -GhArgs @(
            "run", "view", [string]$Run.databaseId,
            "--json", "status,conclusion,url,headSha,displayTitle,jobs"
        )
        $failedJobs = Get-FailedJobs -Run $detail
        if ($failedJobs.Count -eq 0) {
            Write-Output "  failed_jobs: none listed"
            return
        }

        Write-Output "  failed_jobs:"
        foreach ($job in $failedJobs) {
            Write-Output "  - $($job.name) [$($job.conclusion)] job=$($job.databaseId)"
            $failedSteps = Get-FailedSteps -Job $job
            foreach ($step in $failedSteps) {
                Write-Output "    step: $($step.name) [$($step.conclusion)]"
            }

            if ($IncludeFailureLog -and -not $NoLogs) {
                Write-Output "    minimal_log:"
                $logLines = Get-MinimalJobLog -JobId ([string]$job.databaseId) -TailCount $LogTail
                foreach ($line in $logLines) {
                    Write-Output "      $line"
                }
            }
        }
    }
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI 'gh' is required."
}

$targetSha = $Sha
$prInfo = $null

if ($Pr) {
    $prInfo = Invoke-GhJson -GhArgs @(
        "pr", "view", [string]$Pr,
        "--json", "number,state,mergedAt,mergeCommit,url,headRefName,baseRefName,statusCheckRollup"
    )
    if (-not $targetSha -and $prInfo.mergeCommit -and $prInfo.mergeCommit.oid) {
        $targetSha = $prInfo.mergeCommit.oid
    }
}

if ($RunId) {
    $run = Invoke-GhJson -GhArgs @(
        "run", "view", $RunId,
        "--json", "databaseId,displayTitle,headBranch,headSha,status,conclusion,createdAt,updatedAt,url,event,jobs"
    )
    Write-Output "deploy status summary"
    Write-Output "input: run $RunId"
    Write-Output ""
    Write-RunSummary -Label "run" -Run $run -IncludeFailureLog
    exit 0
}

Write-Output "deploy status summary"
if ($Pr) {
    Write-Output "input: PR #$Pr"
    Write-Output "pr: $($prInfo.state) $($prInfo.url)"
    if ($prInfo.mergedAt) {
        Write-Output "merged_at: $($prInfo.mergedAt)"
    }
}
elseif ($targetSha) {
    Write-Output "input: sha $targetSha"
}
else {
    Write-Output "input: latest production/staging runs"
}

if ($targetSha) {
    Write-Output "sha: $targetSha"
}
Write-Output ""

$productionRuns = Get-RunsForWorkflow -Workflow "deploy.yml" -TargetSha $targetSha -RunLimit $Limit
$stagingRuns = Get-RunsForWorkflow -Workflow "deploy-staging.yml" -TargetSha $targetSha -RunLimit $Limit

Write-RunSummary -Label "production" -Run ($productionRuns | Select-Object -First 1) -IncludeFailureLog
Write-Output ""
Write-RunSummary -Label "staging" -Run ($stagingRuns | Select-Object -First 1) -IncludeFailureLog
