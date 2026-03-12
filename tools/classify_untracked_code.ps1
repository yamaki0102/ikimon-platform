param(
    [string]$RemoteAlias = 'production',
    [string]$RemoteBase = '~/public_html/ikimon.life'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$targets = @(
    'upload_package/libs',
    'upload_package/public_html',
    'upload_package/scripts',
    'upload_package/tests',
    'docs',
    'tools'
)

$files = git -C $repoRoot ls-files --others --exclude-standard -- $targets
$results = New-Object System.Collections.Generic.List[object]

foreach ($file in $files) {
    $bucket = 'LOCAL_ONLY'
    $remoteState = 'N/A'

    if ($file -like 'upload_package/*' -and -not $file.StartsWith('upload_package/tests/')) {
        $remotePath = $file -replace '^upload_package/', ''
        $remoteHash = (& ssh $RemoteAlias "if [ -f $RemoteBase/$remotePath ]; then sha256sum $RemoteBase/$remotePath | cut -d ' ' -f1; else echo MISSING; fi").Trim().ToLower()
        $localHash = (Get-FileHash -Algorithm SHA256 (Join-Path $repoRoot $file)).Hash.ToLower()

        if ($remoteHash -eq 'missing') {
            $bucket = 'LOCAL_ONLY'
            $remoteState = 'MISSING'
        } elseif ($remoteHash -eq $localHash) {
            $bucket = 'DEPLOYED_UNTRACKED'
            $remoteState = 'MATCH'
        } else {
            $bucket = 'REMOTE_DIFFERS'
            $remoteState = 'DIFF'
        }
    } elseif ($file -like 'upload_package/tests/*') {
        $bucket = 'TEST_LOCAL_ONLY'
    } elseif ($file -like 'docs/*' -or $file -like 'tools/*') {
        $bucket = 'REPO_LOCAL_ONLY'
    }

    $results.Add([pscustomobject]@{
        Bucket = $bucket
        Remote = $remoteState
        File = $file
    })
}

$results |
    Sort-Object Bucket, File |
    Format-Table -AutoSize
