param(
    [string]$AabPath = "mobile/android/ikimon-pocket/app/build/outputs/bundle/release/app-release.aab",
    [string]$ExpectedAabSha256 = "FDAA8A7FA54F6BBBA3E9B29DF59D63CF80575277FFAA93F151585368BD5814AF",
    [string]$StoreIconPath = "docs/play/assets/store_icon_512.png",
    [string]$FeatureGraphicPath = "docs/play/assets/feature_graphic_1024x500.png",
    [string]$ScreenshotsDir = "docs/play/assets/screenshots",
    [string]$ForegroundServiceVideoPath = "docs/play/assets/videos/fieldscan_foreground_service_demo.mp4",
    [string]$ExpectedForegroundServiceVideoSha256 = "BC8F2094C2074C7D1FC9D2A73764E78DF29CEBB90CD3F788EF3543EA7165329C",
    [string]$ForegroundServiceEvidencePngPath = "docs/play/assets/videos/fieldscan_foreground_notification_evidence.png",
    [string]$ExpectedForegroundServiceEvidencePngSha256 = "72381A7D05EA5D5EC290C5BC4B7F43D56C198B397D7EFF2C5896A129C3E33EEE",
    [string]$ReleasePackPath = "docs/play/fieldscan_play_release_pack_2026-05-17.md",
    [string]$PrivacyUrl = "https://ikimon.life/ja/privacy",
    [switch]$AllowPendingScreenshots,
    [switch]$SkipNetwork
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$issues = New-Object System.Collections.Generic.List[string]

function Resolve-RepoPath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    return Join-Path $repoRoot $Path
}

function Add-Issue {
    param([string]$Message)
    $issues.Add($Message)
}

function Test-TextContains {
    param(
        [string]$Text,
        [string]$Needle,
        [string]$Context
    )

    if (-not $Text.Contains($Needle)) {
        Add-Issue "$Context is missing: $Needle"
    }
}

function Get-ImageInfo {
    param([string]$Path)

    Add-Type -AssemblyName System.Drawing
    $image = [System.Drawing.Image]::FromFile($Path)
    try {
        return [pscustomobject]@{
            Width = $image.Width
            Height = $image.Height
            PixelFormat = $image.PixelFormat.ToString()
            Bytes = (Get-Item -LiteralPath $Path).Length
        }
    }
    finally {
        $image.Dispose()
    }
}

Write-Output "==> FieldScan Play release validation"

$aabFullPath = Resolve-RepoPath $AabPath
if (-not (Test-Path -LiteralPath $aabFullPath)) {
    Add-Issue "AAB not found: $AabPath"
}
else {
    $aabHash = (Get-FileHash -LiteralPath $aabFullPath -Algorithm SHA256).Hash
    if ($aabHash -ne $ExpectedAabSha256) {
        Add-Issue "AAB SHA-256 mismatch: expected $ExpectedAabSha256 but got $aabHash"
    }
    Write-Output "AAB: $AabPath ($((Get-Item -LiteralPath $aabFullPath).Length) bytes, sha256=$aabHash)"
}

$buildGradlePath = Resolve-RepoPath "mobile/android/ikimon-pocket/app/build.gradle.kts"
if (-not (Test-Path -LiteralPath $buildGradlePath)) {
    Add-Issue "Android build file not found: mobile/android/ikimon-pocket/app/build.gradle.kts"
}
else {
    $buildGradle = Get-Content -Raw -LiteralPath $buildGradlePath
    Test-TextContains -Text $buildGradle -Needle 'applicationId = "life.ikimon.fieldscan"' -Context "build.gradle.kts"
    Test-TextContains -Text $buildGradle -Needle 'versionCode = 80002' -Context "build.gradle.kts"
    Test-TextContains -Text $buildGradle -Needle 'versionName = "0.8.1"' -Context "build.gradle.kts"
    Test-TextContains -Text $buildGradle -Needle 'https://ikimon.life/api/v1/mobile/field-sessions' -Context "release API base"
}

$manifestPath = Resolve-RepoPath "mobile/android/ikimon-pocket/app/src/main/AndroidManifest.xml"
if (-not (Test-Path -LiteralPath $manifestPath)) {
    Add-Issue "Android manifest not found: mobile/android/ikimon-pocket/app/src/main/AndroidManifest.xml"
}
else {
    $manifest = Get-Content -Raw -LiteralPath $manifestPath
    foreach ($permission in @(
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.RECORD_AUDIO",
        "android.permission.CAMERA",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
        "android.permission.FOREGROUND_SERVICE_MICROPHONE",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.INTERNET"
    )) {
        Test-TextContains -Text $manifest -Needle $permission -Context "AndroidManifest.xml"
    }

    if ($manifest.Contains("android.permission.ACCESS_BACKGROUND_LOCATION")) {
        Add-Issue "AndroidManifest.xml must not request ACCESS_BACKGROUND_LOCATION for this release"
    }
}

$mainActivityPath = Resolve-RepoPath "mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/ui/MainActivity.kt"
if (-not (Test-Path -LiteralPath $mainActivityPath)) {
    Add-Issue "MainActivity not found: mobile/android/ikimon-pocket/app/src/main/kotlin/life/ikimon/ui/MainActivity.kt"
}
else {
    $mainActivity = Get-Content -Raw -LiteralPath $mainActivityPath
    foreach ($requiredText in @(
        "val started = when (selectedMode)",
        "if (started)",
        "private fun startFieldScan(intent: FieldSessionIntent, testLevel: FieldTestLevel, movementMode: MovementMode): Boolean",
        "private fun startPocketMode(): Boolean",
        "Manifest.permission.POST_NOTIFICATIONS"
    )) {
        Test-TextContains -Text $mainActivity -Needle $requiredText -Context "MainActivity foreground-service start gate"
    }
}

$releasePackFullPath = Resolve-RepoPath $ReleasePackPath
if (-not (Test-Path -LiteralPath $releasePackFullPath)) {
    Add-Issue "Release pack not found: $ReleasePackPath"
}
else {
    $releasePack = Get-Content -Raw -LiteralPath $releasePackFullPath
    foreach ($requiredText in @(
        "FieldScan Google Play Release Pack",
        "life.ikimon.fieldscan",
        $ExpectedAabSha256,
        "Data safety draft",
        "Sensitive permissions",
        "Prominent disclosure text draft",
        "Privacy policy verification"
    )) {
        Test-TextContains -Text $releasePack -Needle $requiredText -Context "release pack"
    }
}

$storeIconFullPath = Resolve-RepoPath $StoreIconPath
if (-not (Test-Path -LiteralPath $storeIconFullPath)) {
    Add-Issue "Store icon not found: $StoreIconPath"
}
else {
    $icon = Get-ImageInfo -Path $storeIconFullPath
    if ($icon.Width -ne 512 -or $icon.Height -ne 512) {
        Add-Issue "Store icon must be 512x512, got $($icon.Width)x$($icon.Height)"
    }
    if ($icon.Bytes -gt 1048576) {
        Add-Issue "Store icon must be 1024KB or smaller, got $($icon.Bytes) bytes"
    }
    if ($icon.PixelFormat -notin @("Format32bppArgb", "Format32bppPArgb")) {
        Add-Issue "Store icon should be 32-bit PNG with alpha, got $($icon.PixelFormat)"
    }
    Write-Output "Store icon: $StoreIconPath ($($icon.Width)x$($icon.Height), $($icon.PixelFormat), $($icon.Bytes) bytes)"
}

$featureGraphicFullPath = Resolve-RepoPath $FeatureGraphicPath
if (-not (Test-Path -LiteralPath $featureGraphicFullPath)) {
    Add-Issue "Feature graphic not found: $FeatureGraphicPath"
}
else {
    $feature = Get-ImageInfo -Path $featureGraphicFullPath
    if ($feature.Width -ne 1024 -or $feature.Height -ne 500) {
        Add-Issue "Feature graphic must be 1024x500, got $($feature.Width)x$($feature.Height)"
    }
    if ($feature.PixelFormat -ne "Format24bppRgb") {
        Add-Issue "Feature graphic must be 24-bit PNG without alpha, got $($feature.PixelFormat)"
    }
    Write-Output "Feature graphic: $FeatureGraphicPath ($($feature.Width)x$($feature.Height), $($feature.PixelFormat), $($feature.Bytes) bytes)"
}

$screenshotsFullPath = Resolve-RepoPath $ScreenshotsDir
$screenshots = @()
if (Test-Path -LiteralPath $screenshotsFullPath) {
    $screenshots = @(
        Get-ChildItem -LiteralPath $screenshotsFullPath -File |
            Where-Object { $_.Extension.ToLowerInvariant() -in @(".png", ".jpg", ".jpeg") }
    )
}

if ($screenshots.Count -lt 2) {
    $message = "At least 2 real app screenshots are required; found $($screenshots.Count) in $ScreenshotsDir"
    if ($AllowPendingScreenshots) {
        Write-Warning $message
    }
    else {
        Add-Issue $message
    }
}

foreach ($screenshot in $screenshots) {
    $shot = Get-ImageInfo -Path $screenshot.FullName
    $minSide = [Math]::Min($shot.Width, $shot.Height)
    $maxSide = [Math]::Max($shot.Width, $shot.Height)
    if ($minSide -lt 320) {
        Add-Issue "Screenshot minimum side must be at least 320px: $($screenshot.Name) is $($shot.Width)x$($shot.Height)"
    }
    if ($maxSide -gt 3840) {
        Add-Issue "Screenshot maximum side must be 3840px or smaller: $($screenshot.Name) is $($shot.Width)x$($shot.Height)"
    }
    if ($maxSide -gt ($minSide * 2)) {
        Add-Issue "Screenshot long side cannot be more than twice the short side: $($screenshot.Name) is $($shot.Width)x$($shot.Height)"
    }
    if ($screenshot.Extension.ToLowerInvariant() -eq ".png" -and $shot.PixelFormat -ne "Format24bppRgb") {
        Add-Issue "Screenshot PNG must be 24-bit without alpha: $($screenshot.Name) is $($shot.PixelFormat)"
    }
}

$foregroundServiceVideoFullPath = Resolve-RepoPath $ForegroundServiceVideoPath
if (-not (Test-Path -LiteralPath $foregroundServiceVideoFullPath)) {
    Add-Issue "Foreground service demo video not found: $ForegroundServiceVideoPath"
}
else {
    $videoHash = (Get-FileHash -LiteralPath $foregroundServiceVideoFullPath -Algorithm SHA256).Hash
    if ($videoHash -ne $ExpectedForegroundServiceVideoSha256) {
        Add-Issue "Foreground service demo video SHA-256 mismatch: expected $ExpectedForegroundServiceVideoSha256 but got $videoHash"
    }
    if ((Get-Item -LiteralPath $foregroundServiceVideoFullPath).Length -le 0) {
        Add-Issue "Foreground service demo video is empty: $ForegroundServiceVideoPath"
    }
    Write-Output "Foreground service video: $ForegroundServiceVideoPath ($((Get-Item -LiteralPath $foregroundServiceVideoFullPath).Length) bytes, sha256=$videoHash)"
}

$foregroundServiceEvidencePngFullPath = Resolve-RepoPath $ForegroundServiceEvidencePngPath
if (-not (Test-Path -LiteralPath $foregroundServiceEvidencePngFullPath)) {
    Add-Issue "Foreground service notification evidence screenshot not found: $ForegroundServiceEvidencePngPath"
}
else {
    $evidencePngHash = (Get-FileHash -LiteralPath $foregroundServiceEvidencePngFullPath -Algorithm SHA256).Hash
    if ($evidencePngHash -ne $ExpectedForegroundServiceEvidencePngSha256) {
        Add-Issue "Foreground service notification evidence PNG SHA-256 mismatch: expected $ExpectedForegroundServiceEvidencePngSha256 but got $evidencePngHash"
    }
    $evidencePng = Get-ImageInfo -Path $foregroundServiceEvidencePngFullPath
    if ($evidencePng.Width -ne 1080 -or $evidencePng.Height -ne 1920) {
        Add-Issue "Foreground service notification evidence PNG should be 1080x1920, got $($evidencePng.Width)x$($evidencePng.Height)"
    }
    Write-Output "Foreground service evidence: $ForegroundServiceEvidencePngPath ($($evidencePng.Width)x$($evidencePng.Height), sha256=$evidencePngHash)"
}

if (-not $SkipNetwork) {
    try {
        $privacyResponse = Invoke-WebRequest -Uri $PrivacyUrl -UseBasicParsing -TimeoutSec 20
        $privacyText = $privacyResponse.Content
        foreach ($requiredPrivacyText in @(
            "Android",
            "ikimon.life",
            "AI"
        )) {
            Test-TextContains -Text $privacyText -Needle $requiredPrivacyText -Context $PrivacyUrl
        }
        Write-Output "Privacy policy: $PrivacyUrl"
    }
    catch {
        Add-Issue "Privacy policy check failed: $($_.Exception.Message)"
    }
}

if ($issues.Count -gt 0) {
    foreach ($issue in $issues) {
        Write-Output "ERROR: $issue"
    }
    exit 1
}

Write-Output "FieldScan Play release validation passed."
$global:LASTEXITCODE = 0
exit 0
