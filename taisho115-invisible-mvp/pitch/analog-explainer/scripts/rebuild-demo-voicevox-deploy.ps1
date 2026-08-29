param(
    [string]$EngineUrl = "http://127.0.0.1:50021",
    [string]$VoicevoxRunExe = "",
    [string]$SshAlias = "kagoya-vps",
    [string]$RemoteBase = "/home/ubuntu/apps/taisho115-invisible-mvp/public",
    [int]$PreviewPort = 4186,
    [double]$TargetCps = 4.35,
    [double]$VoicevoxSpeedScale = 0.92,
    [double]$MaxTempoAdjustment = 1.10,
    [double]$MinLineSeconds = 2.2,
    [double]$InterLinePauseSeconds = 0.5,
    [switch]$SkipRegenerate,
    [switch]$SkipDeploy,
    [switch]$SkipPublicQa
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$managerRoot = "E:\Projects\00_all_projects_management"
$scratch = "E:\Projects\_agent_scratch\taisho115-invisible-mvp\voicevox-rebuild-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Force -Path $scratch | Out-Null

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message"
}

function Invoke-Checked([scriptblock]$Script, [string]$Name) {
    Write-Step $Name
    $global:LASTEXITCODE = $null
    & $Script
    if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

function Test-VoicevoxEngine {
    try {
        return Invoke-RestMethod -Uri "$EngineUrl/version" -TimeoutSec 4
    }
    catch {
        return $null
    }
}

function Find-VoicevoxRunExe {
    if ($VoicevoxRunExe -and (Test-Path -LiteralPath $VoicevoxRunExe)) {
        return (Resolve-Path -LiteralPath $VoicevoxRunExe).Path
    }

    $known = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages\HiroshibaKazuyuki.VOICEVOX.CPU_Microsoft.Winget.Source_8wekyb3d8bbwe\VOICEVOX\vv-engine\run.exe"
    if (Test-Path -LiteralPath $known) {
        return $known
    }

    $packagesRoot = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
    $candidate = Get-ChildItem -Path $packagesRoot -Recurse -Filter "run.exe" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match "VOICEVOX.*vv-engine\\run\.exe$" } |
        Select-Object -First 1
    if ($candidate) {
        return $candidate.FullName
    }

    throw "VOICEVOX vv-engine run.exe was not found. Install VOICEVOX CPU via winget or pass -VoicevoxRunExe."
}

function Ensure-VoicevoxEngine {
    $version = Test-VoicevoxEngine
    if ($version) {
        Write-Host "VOICEVOX Engine already running: $version"
        return $version
    }

    $runExe = Find-VoicevoxRunExe
    $workDir = Split-Path $runExe
    Write-Host "Starting VOICEVOX Engine: $runExe"
    Start-Process -FilePath $runExe -ArgumentList @("--host", "127.0.0.1", "--port", "50021", "--output_log_utf8", "--cpu_num_threads", "4") -WorkingDirectory $workDir -WindowStyle Hidden

    for ($i = 0; $i -lt 90; $i++) {
        Start-Sleep -Seconds 2
        $version = Test-VoicevoxEngine
        if ($version) {
            Write-Host "VOICEVOX Engine started: $version"
            return $version
        }
        if (($i % 10) -eq 0) {
            Write-Host "waiting for VOICEVOX Engine... $i"
        }
    }
    throw "VOICEVOX Engine did not become ready at $EngineUrl"
}

function Normalize-ManifestJson {
    $manifestPath = Join-Path $root "public\assets\demo-narration\slide-manifest.json"
    $env:VOICEVOX_DEMO_MANIFEST_PATH = $manifestPath
    $script = @'
const fs = require("fs");
const p = process.env.VOICEVOX_DEMO_MANIFEST_PATH;
let text = fs.readFileSync(p, "utf8");
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
const json = JSON.parse(text);
fs.writeFileSync(p, JSON.stringify(json, null, 2) + "\n", "utf8");
console.log("normalized " + p);
'@
    $script | node -
}

function Test-DemoAudioDurations([string]$BaseDir) {
    $env:VOICEVOX_DEMO_AUDIO_BASE = $BaseDir
    $script = @'
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const root = process.env.VOICEVOX_DEMO_AUDIO_BASE;
const manifestPath = path.join(root, "assets/demo-narration/slide-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const bad = [];
for (const slide of manifest.slides) {
  const file = path.join(root, "assets/demo-narration/slides", slide.file);
  const stat = fs.statSync(file);
  const actual = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" }).trim());
  const delta = Math.abs(actual - slide.duration);
  if (stat.size < 1000 || delta > 0.08) bad.push(`${slide.file} size=${stat.size} manifest=${slide.duration} actual=${actual.toFixed(3)} delta=${delta.toFixed(3)}`);
}
const r7 = manifest.slides[17];
console.log(`audio duration check: engine=${manifest.engine} slides=${manifest.slides.length} bad=${bad.length} r7=${r7.duration}s segments=${r7.segments.length}`);
if (bad.length) {
  console.error(bad.join("\n"));
  process.exit(1);
}
'@
    $script | node -
    if ($LASTEXITCODE -ne 0) {
        throw "audio duration check failed"
    }
}

function Stop-Preview {
    $procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "$PreviewPort" -and $_.ProcessId -ne $PID }
    $ids = @($procs | Select-Object -ExpandProperty ProcessId)
    if ($ids.Count -gt 0) {
        Stop-Process -Id $ids -Force
        Write-Host "stopped preview: $($ids -join ',')"
    }
}

Push-Location $root
try {
    Invoke-Checked { Ensure-VoicevoxEngine | Out-Null } "voicevox engine ready"

    if (-not $SkipRegenerate) {
        Invoke-Checked {
            powershell -ExecutionPolicy Bypass -File .\scripts\generate-demo-dialogue.ps1 `
                -EngineUrl $EngineUrl `
                -VoicevoxSpeedScale $VoicevoxSpeedScale `
                -TargetCps $TargetCps `
                -MaxTempoAdjustment $MaxTempoAdjustment `
                -MinLineSeconds $MinLineSeconds `
                -InterLinePauseSeconds $InterLinePauseSeconds
        } "regenerate all demo VOICEVOX audio"
    }
    else {
        Write-Step "skip demo VOICEVOX audio regeneration"
    }

    Invoke-Checked { Normalize-ManifestJson } "normalize demo narration manifest"
    Invoke-Checked { Test-DemoAudioDurations (Join-Path $root "public") } "check generated demo audio durations"
    Invoke-Checked { npm run qa } "static QA"
    Invoke-Checked { npm run check } "typecheck and build"
    Invoke-Checked { Test-DemoAudioDurations (Join-Path $root "dist") } "check built demo audio durations"

    Invoke-Checked {
        Start-Process -FilePath npm.cmd -ArgumentList @("run", "preview", "--", "--port", "$PreviewPort") -WorkingDirectory $root -WindowStyle Hidden
        Start-Sleep -Seconds 3
        $res = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$PreviewPort/?demo" -TimeoutSec 10
        if ($res.StatusCode -ne 200) { throw "preview returned $($res.StatusCode)" }
    } "start local preview"

    Invoke-Checked {
        $env:DECK_URL = "http://127.0.0.1:$PreviewPort/?demo"
        powershell -ExecutionPolicy Bypass -File "$managerRoot\scripts\run_playwright.ps1" -ScriptPath "$root\scripts\qa-demo-feedback.cjs"
    } "local demo Playwright QA"

    Invoke-Checked {
        $env:DECK_URL = "http://127.0.0.1:$PreviewPort/"
        powershell -ExecutionPolicy Bypass -File "$managerRoot\scripts\run_playwright.ps1" -ScriptPath "$root\scripts\qa-playwright.cjs"
    } "local standard Playwright QA"

    if (-not $SkipDeploy) {
        Invoke-Checked {
            $matches = Get-ChildItem -LiteralPath (Join-Path $root "dist") -Recurse |
                Where-Object { $_.Name -match "\.(sqlite|db|env)$|credentials\.json|debug_|dev_|test_" }
            if ($matches) {
                $matches | Select-Object FullName
                throw "blocked deploy because forbidden files were found in dist"
            }
        } "deploy preflight forbidden-file check"

        $archive = Join-Path $scratch "dist-voicevox-demo.tar.gz"
        Invoke-Checked { tar -czf $archive -C (Join-Path $root "dist") . } "pack dist"
        Invoke-Checked { scp $archive "${SshAlias}:/tmp/taisho115-slides-voicevox-demo.tar.gz" } "upload dist archive"

        $remoteScript = @'
set -e
TS=$(date +%Y%m%d%H%M%S)
BASE="__REMOTE_BASE__"
WORK=/tmp/taisho115-slides-voicevox-demo
rm -rf "$WORK"
mkdir -p "$WORK"
tar -xzf /tmp/taisho115-slides-voicevox-demo.tar.gz -C "$WORK"
cp -a "$BASE/slides" "$BASE/slides.prev.$TS"
cp -a "$BASE/slides-demo" "$BASE/slides-demo.prev.$TS"
rm -rf "$BASE/slides" "$BASE/slides-demo"
mkdir -p "$BASE/slides" "$BASE/slides-demo"
cp -a "$WORK/." "$BASE/slides/"
cp -a "$WORK/." "$BASE/slides-demo/"
printf "backup_ts=%s\n" "$TS"
python3 - <<'PY'
import json
p = "__REMOTE_BASE__/slides-demo/assets/demo-narration/slide-manifest.json"
with open(p, encoding="utf-8") as f:
    m = json.load(f)
print("demo_manifest=%s slides=%s r7=%s" % (m["engine"], len(m["slides"]), m["slides"][17]["duration"]))
PY
'@.Replace("__REMOTE_BASE__", $RemoteBase)
        $remoteScriptPath = Join-Path $scratch "remote-deploy.sh"
        [System.IO.File]::WriteAllText($remoteScriptPath, $remoteScript, (New-Object System.Text.UTF8Encoding($false)))
        Invoke-Checked { scp $remoteScriptPath "${SshAlias}:/tmp/taisho115-voicevox-demo-deploy.sh" } "upload remote deploy script"
        Invoke-Checked { ssh $SshAlias "bash /tmp/taisho115-voicevox-demo-deploy.sh" } "remote deploy"

        if (-not $SkipPublicQa) {
            Invoke-Checked {
                $env:DECK_URL = "https://ikan.nexchat.cloud/game-test/taisho115/slides-demo/"
                powershell -ExecutionPolicy Bypass -File "$managerRoot\scripts\run_playwright.ps1" -ScriptPath "$root\scripts\qa-demo-feedback.cjs"
            } "public demo Playwright QA"

            Invoke-Checked {
                $env:DECK_URL = "https://ikan.nexchat.cloud/game-test/taisho115/slides/"
                powershell -ExecutionPolicy Bypass -File "$managerRoot\scripts\run_playwright.ps1" -ScriptPath "$root\scripts\qa-playwright.cjs"
            } "public standard Playwright QA"

            Invoke-Checked {
                $manifest = Invoke-RestMethod -Uri "https://ikan.nexchat.cloud/game-test/taisho115/slides-demo/assets/demo-narration/slide-manifest.json" -TimeoutSec 20
                if ($manifest.engine -notmatch "VOICEVOX Engine" -or $manifest.slides.Count -ne 26 -or $manifest.slides[17].segments.Count -ne 8) {
                    throw "public demo manifest smoke failed"
                }
                $wav = Invoke-WebRequest -UseBasicParsing -Uri "https://ikan.nexchat.cloud/game-test/taisho115/slides-demo/assets/demo-narration/slides/slide-18.wav" -TimeoutSec 30
                if ($wav.StatusCode -ne 200 -or $wav.RawContentLength -lt 100000) {
                    throw "public R7 WAV smoke failed"
                }
                Write-Host "public smoke ok: engine=$($manifest.engine) r7=$($manifest.slides[17].duration)s bytes=$($wav.RawContentLength)"
            } "public demo audio smoke"
        }
    }

    Write-Step "done"
    Write-Host "VOICEVOX demo rebuild complete."
}
finally {
    Stop-Preview
    Pop-Location
}
