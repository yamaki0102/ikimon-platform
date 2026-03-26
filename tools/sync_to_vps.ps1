param(
    [ValidateSet('code', 'data', 'uploads', 'finalize')]
    [string]$Mode = 'code',
    [switch]$DryRun,
    [switch]$VerifyOnly,
    [string]$RepoRoot = 'C:\Users\YAMAKI\ikimon\ikimon.life',
    [string]$VpsHost = 'root@162.43.44.131',
    [string]$VpsKey = 'C:\Users\YAMAKI\Downloads\ikimon.pem',
    [string]$VpsBase = '/var/www/ikimon.life/repo/upload_package',
    [string]$LegacyHost = 'r1522484@www1070.onamae.ne.jp',
    [string]$LegacyKey = "$HOME\.ssh\antigravity.pem",
    [int]$LegacyPort = 8022,
    [string]$LegacyBase = '~/public_html/ikimon.life'
)

$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host "[sync_to_vps] $Message"
}

function Invoke-Strict {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [string[]]$Arguments
    )

    $commandLine = "$FilePath $($Arguments -join ' ')"
    if ($DryRun) {
        Write-Step "DRY RUN: $commandLine"
        return
    }

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $FilePath $($Arguments -join ' ')"
    }
}

function New-TempTarPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Prefix
    )

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    Join-Path $env:TEMP "$Prefix-$stamp.tar.gz"
}

function Publish-ArchiveToVps {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ArchivePath,
        [Parameter(Mandatory = $true)]
        [string]$RemoteExtractDir,
        [string]$RemoteArchivePath = '/tmp/ikimon-migration.tar.gz'
    )

    Invoke-Strict -FilePath 'scp.exe' -Arguments @('-i', $VpsKey, $ArchivePath, "${VpsHost}:${RemoteArchivePath}")
    Invoke-Strict -FilePath 'ssh.exe' -Arguments @('-i', $VpsKey, $VpsHost, "mkdir -p '$RemoteExtractDir' && tar xzf '$RemoteArchivePath' -C '$RemoteExtractDir' && rm -f '$RemoteArchivePath'")
}

function Get-LocalItemCount {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        return -1
    }
    return (Get-ChildItem -Path $Path -Recurse -Force | Measure-Object).Count
}

function Show-Verification {
    switch ($Mode) {
        'code' {
            $localPath = Join-Path $RepoRoot 'upload_package'
            $localCount = Get-LocalItemCount -Path $localPath
            Write-Step "Local code items: $localCount"
            Invoke-Strict -FilePath 'ssh.exe' -Arguments @('-i', $VpsKey, $VpsHost, "find '$VpsBase' | wc -l")
        }
        'data' {
            Invoke-Strict -FilePath 'ssh.exe' -Arguments @('-i', $LegacyKey, '-p', $LegacyPort.ToString(), $LegacyHost, "find $LegacyBase/data | wc -l")
            Invoke-Strict -FilePath 'ssh.exe' -Arguments @('-i', $VpsKey, $VpsHost, "find '$VpsBase/data' | wc -l")
        }
        'uploads' {
            Invoke-Strict -FilePath 'ssh.exe' -Arguments @('-i', $LegacyKey, '-p', $LegacyPort.ToString(), $LegacyHost, "find $LegacyBase/public_html/uploads | wc -l")
            Invoke-Strict -FilePath 'ssh.exe' -Arguments @('-i', $VpsKey, $VpsHost, "find '$VpsBase/public_html/uploads' | wc -l")
        }
        'finalize' {
            Invoke-Strict -FilePath 'ssh.exe' -Arguments @('-i', $VpsKey, $VpsHost, "stat -c '%U:%G %a %n' '$VpsBase' '$VpsBase/data' '$VpsBase/public_html/uploads'")
        }
    }
}

function Sync-Code {
    $archive = New-TempTarPath -Prefix 'ikimon-code'
    $pushed = $false

    try {
        Push-Location $RepoRoot
        $pushed = $true
        Invoke-Strict -FilePath 'tar.exe' -Arguments @(
            '-czf', $archive,
            '--exclude=.git',
            '--exclude=tests',
            '--exclude=upload_package/data',
            '--exclude=upload_package/config/secret.php',
            '-C', $RepoRoot,
            'upload_package'
        )
        Pop-Location
        $pushed = $false

        Publish-ArchiveToVps -ArchivePath $archive -RemoteExtractDir '/tmp'
        Invoke-Strict -FilePath 'ssh.exe' -Arguments @(
            '-i', $VpsKey, $VpsHost,
            "mkdir -p '$VpsBase' && cp -a /tmp/upload_package/. '$VpsBase/' && rm -rf /tmp/upload_package"
        )
    } finally {
        if (Test-Path $archive) {
            Remove-Item $archive -Force
        }
        if ($pushed) {
            Pop-Location
        }
    }
}

function Sync-RemoteDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RemoteSource,
        [Parameter(Mandatory = $true)]
        [string]$RemoteDestination
    )

    $archive = New-TempTarPath -Prefix 'ikimon-sync'
    $remoteArchive = '/tmp/ikimon-legacy-sync.tar.gz'

    try {
        Invoke-Strict -FilePath 'ssh.exe' -Arguments @(
            '-i', $LegacyKey,
            '-p', $LegacyPort.ToString(),
            $LegacyHost,
            "tar czf '$remoteArchive' -C $RemoteSource ."
        )

        Invoke-Strict -FilePath 'scp.exe' -Arguments @(
            '-i', $LegacyKey,
            '-P', $LegacyPort.ToString(),
            "${LegacyHost}:${remoteArchive}",
            $archive
        )

        Publish-ArchiveToVps -ArchivePath $archive -RemoteExtractDir $RemoteDestination

        Invoke-Strict -FilePath 'ssh.exe' -Arguments @(
            '-i', $LegacyKey,
            '-p', $LegacyPort.ToString(),
            $LegacyHost,
            "rm -f '$remoteArchive'"
        )
    } finally {
        if (Test-Path $archive) {
            Remove-Item $archive -Force
        }
    }
}

switch ($Mode) {
    'code' {
        if ($VerifyOnly) {
            Show-Verification
            break
        }
        Sync-Code
    }
    'data' {
        if ($VerifyOnly) {
            Show-Verification
            break
        }
        Sync-RemoteDirectory -RemoteSource "$LegacyBase/data" -RemoteDestination "$VpsBase/data"
    }
    'uploads' {
        if ($VerifyOnly) {
            Show-Verification
            break
        }
        Sync-RemoteDirectory -RemoteSource "$LegacyBase/public_html/uploads" -RemoteDestination "$VpsBase/public_html/uploads"
    }
    'finalize' {
        if ($VerifyOnly) {
            Show-Verification
            break
        }
        Invoke-Strict -FilePath 'ssh.exe' -Arguments @(
            '-i', $VpsKey, $VpsHost,
            "chown -R www-data:www-data '$VpsBase' && find '$VpsBase' -type d -exec chmod 755 {} \; && find '$VpsBase' -type f -exec chmod 644 {} \; && chmod -R 775 '$VpsBase/data' '$VpsBase/public_html/uploads'"
        )
    }
}
