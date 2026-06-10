param(
    [string]$Workflow = "deploy.yml",
    [string]$RunId,
    [int]$Limit = 12,
    [int]$StepThresholdSeconds = 30,
    [switch]$CompletedOnly
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

    $text = ($output -join "`n").Trim()
    if ([string]::IsNullOrWhiteSpace($text)) {
        return $null
    }

    return $text | ConvertFrom-Json
}

function Convert-ToDateTime {
    param($Value)

    if (-not $Value) {
        return $null
    }
    if ([string]$Value -match '^0001-01-01') {
        return $null
    }
    return ([datetimeoffset]::Parse([string]$Value)).UtcDateTime
}

function Get-DurationMinutes {
    param($Start, $End)

    if (-not $Start -or -not $End) {
        return $null
    }
    if ($End -lt $Start) {
        return $null
    }
    return [math]::Round(($End - $Start).TotalMinutes, 2)
}

function Get-DurationSeconds {
    param($Start, $End)

    if (-not $Start -or -not $End) {
        return $null
    }
    if ($End -lt $Start) {
        return $null
    }
    return [math]::Round(($End - $Start).TotalSeconds, 0)
}

function Format-Number {
    param($Value)

    if ($null -eq $Value) {
        return ""
    }
    return ([string]$Value)
}

function Get-RunDetail {
    param([string]$Id)

    Invoke-GhJson -GhArgs @(
        "run", "view", $Id,
        "--json", "databaseId,displayTitle,headBranch,headSha,status,conclusion,createdAt,updatedAt,url,event,jobs"
    )
}

function Get-JobByName {
    param($Run, [string]$Name)

    return @($Run.jobs | Where-Object { $_.name -eq $Name } | Select-Object -First 1)[0]
}

function Get-StepByName {
    param($Job, [string]$Name)

    if (-not $Job) {
        return $null
    }
    return @($Job.steps | Where-Object { $_.name -eq $Name } | Select-Object -First 1)[0]
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI 'gh' is required."
}

$runs = @()
if ($RunId) {
    $runs = @(Get-RunDetail -Id $RunId)
}
else {
    $listed = Invoke-GhJson -GhArgs @(
        "run", "list",
        "--workflow", $Workflow,
        "--limit", [string]$Limit,
        "--json", "databaseId,status,conclusion"
    )
    if ($CompletedOnly) {
        $listed = @($listed | Where-Object { $_.status -eq "completed" })
    }
    foreach ($run in @($listed)) {
        $runs += Get-RunDetail -Id ([string]$run.databaseId)
    }
}

Write-Output "# Deploy Timing Summary"
Write-Output ""
Write-Output "Workflow: ``$Workflow``"
Write-Output ""
Write-Output "| Run | Result | Total min | Queue wait min | Active span min | Pre-flight min | Prepare min | Legacy deploy sec | v2 prepare sec | Candidate smoke min | Promote min | Verify min |"
Write-Output "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"

foreach ($run in $runs) {
    $runStart = Convert-ToDateTime $run.createdAt
    $runEnd = Convert-ToDateTime $run.updatedAt
    $jobs = @($run.jobs | Where-Object { $_.startedAt } | Sort-Object { Convert-ToDateTime $_.startedAt })
    $firstJobStart = if ($jobs.Count -gt 0) { Convert-ToDateTime $jobs[0].startedAt } else { $null }
    $lastJobEnd = if ($jobs.Count -gt 0) {
        $completedJobs = @($jobs | Where-Object { $_.completedAt })
        if ($completedJobs.Count -gt 0) {
            ($completedJobs | ForEach-Object { Convert-ToDateTime $_.completedAt } | Sort-Object | Select-Object -Last 1)
        }
        else {
            $null
        }
    }
    else {
        $null
    }

    $preflight = Get-JobByName -Run $run -Name "Pre-flight Checks"
    $prepare = Get-JobByName -Run $run -Name "Prepare Production Candidate"
    $candidateSmoke = Get-JobByName -Run $run -Name "Smoke Production Candidate"
    $promote = Get-JobByName -Run $run -Name "Promote Production Candidate"
    $verify = Get-JobByName -Run $run -Name "Post-deploy Verification"

    $legacyStep = Get-StepByName -Job $prepare -Name "Deploy legacy lane via SSH"
    $v2PrepareStep = Get-StepByName -Job $prepare -Name "Prepare inactive platform_v2 candidate"

    $result = if ($run.status -eq "completed") { $run.conclusion } else { $run.status }
    $runLabel = "[$($run.databaseId)]($($run.url))"
    Write-Output ("| {0} | {1} | {2} | {3} | {4} | {5} | {6} | {7} | {8} | {9} | {10} | {11} |" -f `
        $runLabel,
        $result,
        (Format-Number (Get-DurationMinutes $runStart $runEnd)),
        (Format-Number (Get-DurationMinutes $runStart $firstJobStart)),
        (Format-Number (Get-DurationMinutes $firstJobStart $lastJobEnd)),
        (Format-Number (Get-DurationMinutes (Convert-ToDateTime $preflight.startedAt) (Convert-ToDateTime $preflight.completedAt))),
        (Format-Number (Get-DurationMinutes (Convert-ToDateTime $prepare.startedAt) (Convert-ToDateTime $prepare.completedAt))),
        (Format-Number (Get-DurationSeconds (Convert-ToDateTime $legacyStep.startedAt) (Convert-ToDateTime $legacyStep.completedAt))),
        (Format-Number (Get-DurationSeconds (Convert-ToDateTime $v2PrepareStep.startedAt) (Convert-ToDateTime $v2PrepareStep.completedAt))),
        (Format-Number (Get-DurationMinutes (Convert-ToDateTime $candidateSmoke.startedAt) (Convert-ToDateTime $candidateSmoke.completedAt))),
        (Format-Number (Get-DurationMinutes (Convert-ToDateTime $promote.startedAt) (Convert-ToDateTime $promote.completedAt))),
        (Format-Number (Get-DurationMinutes (Convert-ToDateTime $verify.startedAt) (Convert-ToDateTime $verify.completedAt)))
    )
}

Write-Output ""
Write-Output "## Slow Steps"
Write-Output ""
foreach ($run in $runs) {
    Write-Output "### $($run.databaseId) - $($run.displayTitle)"
    $slowSteps = @()
    foreach ($job in @($run.jobs)) {
        foreach ($step in @($job.steps)) {
            $seconds = Get-DurationSeconds (Convert-ToDateTime $step.startedAt) (Convert-ToDateTime $step.completedAt)
            if ($null -ne $seconds -and $seconds -ge $StepThresholdSeconds) {
                $slowSteps += [pscustomobject]@{
                    Job = $job.name
                    Step = $step.name
                    Seconds = $seconds
                }
            }
        }
    }
    if ($slowSteps.Count -eq 0) {
        Write-Output "- No steps >= ${StepThresholdSeconds}s"
        continue
    }
    foreach ($step in ($slowSteps | Sort-Object Seconds -Descending)) {
        Write-Output ('- {0}s `{1}` / `{2}`' -f $step.Seconds, $step.Job, $step.Step)
    }
}
