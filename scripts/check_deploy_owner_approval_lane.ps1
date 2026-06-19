param(
    [string]$BaseRef = 'origin/main',
    [string]$HeadRef = 'HEAD',
    [switch]$Fetch
)

$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & git @Args
}

function Normalize-RepoPath {
    param([string]$Path)
    return ($Path -replace '\\', '/').Trim()
}

function Test-CodexBranch {
    param([string]$Branch)
    return -not [string]::IsNullOrWhiteSpace($Branch) -and (Normalize-RepoPath $Branch) -match '^codex/'
}

$prTitle = [string]$env:PR_TITLE
$prBody = [string]$env:PR_BODY
$headRef = [string]$env:PR_HEAD_REF

if (-not (Test-CodexBranch $headRef)) {
    Write-Host "Deploy-owner approval lane skipped: PR head is not a codex/* branch ($headRef)."
    exit 0
}

Invoke-Git 'rev-parse' '--is-inside-work-tree' | Out-Null

if ($Fetch) {
    Invoke-Git 'fetch' 'origin' '--prune' | Out-Null
}

Invoke-Git 'rev-parse' '--verify' $BaseRef | Out-Null

$changedFiles = @(
    Invoke-Git 'diff' '--name-only' "${BaseRef}...${HeadRef}"
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { Normalize-RepoPath $_ }

Write-Host 'Deploy-owner approval lane active.'
Write-Host "PR title: $prTitle"
Write-Host "Head ref: $headRef"
Write-Host "Base ref: $BaseRef"
Write-Host "Changed files: $($changedFiles.Count)"

$errors = [System.Collections.Generic.List[string]]::new()

if ([string]::IsNullOrWhiteSpace($prBody)) {
    $errors.Add('PR body is empty; deploy-owner approval packet is required for codex/* PRs to main.') | Out-Null
}

$requiredPatterns = @(
    '(?im)^##\s+Deploy-owner approval lane\s*$',
    '(?im)^\s*-\s*\[x\]\s*Owner approval required before merge\s*$',
    '(?im)^\s*-\s*\[x\]\s*Admin bypass is not requested\s*$',
    '(?im)^\s*-\s*\[x\]\s*Branch protection remains enforced\s*$',
    '(?im)^Staging evidence:\s*\S',
    '(?im)^Production deploy intent:\s*\S'
)

foreach ($pattern in $requiredPatterns) {
    if ($prBody -notmatch $pattern) {
        $errors.Add("Missing required deploy-owner approval packet marker: $pattern") | Out-Null
    }
}

if ($prBody -match '(?im)^\s*-\s*\[x\]\s*Admin bypass is requested\s*$') {
    $errors.Add('Admin bypass is marked as requested. Use owner review instead, unless the user explicitly asks for an emergency branch-protection bypass.') | Out-Null
}

if ($prBody -match '(?i)\bgh\s+pr\s+merge\b[^\r\n]*--admin\b') {
    $errors.Add('PR body references gh pr merge --admin. The deploy-owner lane must not plan branch-protection bypass.') | Out-Null
}

if ($errors.Count -gt 0) {
    Write-Host ''
    Write-Host 'Deploy-owner approval lane failed:'
    foreach ($errorMessage in $errors) {
        Write-Host "  - $errorMessage"
    }
    Write-Host ''
    Write-Host 'Required PR body section:'
    Write-Host '## Deploy-owner approval lane'
    Write-Host ''
    Write-Host '- [x] Owner approval required before merge'
    Write-Host '- [x] Admin bypass is not requested'
    Write-Host '- [x] Branch protection remains enforced'
    Write-Host ''
    Write-Host 'Staging evidence: <run URL or reason not required>'
    Write-Host 'Production deploy intent: <what will deploy after owner merge>'
    Write-Host ''
    Write-Host 'Changed files:'
    foreach ($path in $changedFiles) {
        Write-Host "  - $path"
    }
    exit 2
}

Write-Host 'Deploy-owner approval lane passed.'
exit 0
