[CmdletBinding()]
param(
    [string]$Serial = "100.88.23.11:41135",
    [string]$ProjectDir = "C:\Users\YAMAKI\Documents\Playground\mobile\android\ikimon-pocket",
    [switch]$SkipBuild,
    [switch]$Launch
)

$ErrorActionPreference = "Stop"

$adb = "C:\Android\Sdk\platform-tools\adb.exe"
$apk = Join-Path $ProjectDir "app\build\outputs\apk\debug\app-debug.apk"

function Invoke-Step([string]$Message, [scriptblock]$Action) {
    Write-Host "==> $Message"
    & $Action
}

if (-not (Test-Path $adb)) {
    throw "adb not found: $adb"
}

if (-not $SkipBuild) {
    Invoke-Step "assembleDebug" {
        Push-Location $ProjectDir
        try {
            & ".\gradlew.bat" "app:assembleDebug"
            if ($LASTEXITCODE -ne 0) {
                throw "Gradle build failed with exit code $LASTEXITCODE"
            }
        } finally {
            Pop-Location
        }
    }
}

if (-not (Test-Path $apk)) {
    throw "APK not found: $apk"
}

$fastArgs = @("-s", $Serial, "install", "-r", "--fastdeploy", $apk)
$fallbackArgs = @("-s", $Serial, "install", "-r", $apk)

Invoke-Step "fastdeploy install" {
    & $adb @fastArgs
    $script:fastExit = $LASTEXITCODE
}

if ($fastExit -ne 0) {
    Write-Warning "fastdeploy failed. Falling back to normal install."
    Invoke-Step "normal install" {
        & $adb @fallbackArgs
        if ($LASTEXITCODE -ne 0) {
            throw "adb install failed with exit code $LASTEXITCODE"
        }
    }
}

Invoke-Step "force-stop" {
    & $adb -s $Serial shell am force-stop life.ikimon.fieldscan
}

if ($Launch) {
    Invoke-Step "launch app" {
        & $adb -s $Serial shell monkey -p life.ikimon.fieldscan -c android.intent.category.LAUNCHER 1
    }
}

Write-Host "Done: deploy finished."
