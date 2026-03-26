param(
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$javaHome = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot'
$sdkRoot = 'C:\Android\Sdk'
$adb = Join-Path $sdkRoot 'platform-tools\adb.exe'
$apk = Join-Path $projectRoot 'app\build\outputs\apk\debug\app-debug.apk'

if (-not (Test-Path $javaHome)) {
    throw "JDK 17 が見つかりません: $javaHome"
}

if (-not (Test-Path $adb)) {
    throw "adb が見つかりません: $adb"
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_SDK_ROOT = $sdkRoot

if (-not $SkipBuild) {
    Push-Location $projectRoot
    try {
        .\gradlew.bat assembleDebug
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path $apk)) {
    throw "APK が見つかりません: $apk"
}

$devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\S+\s+device$' }
if (-not $devices) {
    Write-Host 'adb 接続された端末がありません。APK を端末に送って手動インストールしてください。'
    Write-Host $apk
    exit 0
}

& $adb install -r $apk
Write-Host 'インストール完了:'
Write-Host $apk
