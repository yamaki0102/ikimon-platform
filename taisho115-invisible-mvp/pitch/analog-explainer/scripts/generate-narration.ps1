param(
    [string]$VoiceName = "",
    [double]$TargetCps = 5.45
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$slidesPath = Join-Path $root "src/slides.json"
$outDir = Join-Path $root "public/assets/narration"
$tmpDir = Join-Path $root ".runtime/narration-raw"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voices = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }

if ($VoiceName -and ($voices -contains $VoiceName)) {
    $synth.SelectVoice($VoiceName)
} elseif ($voices -contains "VOICEVOX 青山龍星 ノーマル") {
    $synth.SelectVoice("VOICEVOX 青山龍星 ノーマル")
} elseif ($voices -contains "Microsoft Haruka Desktop") {
    $synth.SelectVoice("Microsoft Haruka Desktop")
}

$synth.Rate = 0
$synth.Volume = 100
$slides = Get-Content -Raw -Encoding UTF8 -Path $slidesPath | ConvertFrom-Json
$manifest = @()

function Get-SpeechCharCount([string]$Text) {
    $normalized = [regex]::Replace($Text, "[\s\p{P}\p{S}]", "")
    return [Math]::Max(1, $normalized.Length)
}

function Get-Segments($Slide, [int]$SlideIndex) {
    $matches = [regex]::Matches([string]$Slide.narration, "[^。！？!?]+[。！？!?]?")
    $segments = @()
    if ($matches.Count -eq 0) {
        $segments += [pscustomobject]@{ text = [string]$Slide.narration; segmentIndex = 0 }
    } else {
        for ($i = 0; $i -lt $matches.Count; $i++) {
            $text = $matches[$i].Value.Trim()
            if ($text) { $segments += [pscustomobject]@{ text = $text; segmentIndex = $i } }
        }
    }
    foreach ($segment in $segments) {
        $slideNo = ($SlideIndex + 1).ToString("00")
        $segmentNo = ($segment.segmentIndex + 1).ToString("00")
        [pscustomobject]@{
            id = "$($Slide.id)-$($segment.segmentIndex + 1)"
            slideId = $Slide.id
            text = $segment.text
            audio = "slide-$slideNo-$segmentNo.wav"
        }
    }
}

function Get-DurationSeconds([string]$Path) {
    $value = & ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 $Path
    return [double]::Parse(($value | Select-Object -First 1), [Globalization.CultureInfo]::InvariantCulture)
}

for ($slideIndex = 0; $slideIndex -lt $slides.Count; $slideIndex++) {
foreach ($segment in (Get-Segments $slides[$slideIndex] $slideIndex)) {
    $rawPath = Join-Path $tmpDir $segment.audio
    $outPath = Join-Path $outDir $segment.audio
    $synth.SetOutputToWaveFile($rawPath)
    $synth.Speak($segment.text)
    $synth.SetOutputToDefaultAudioDevice()

    $chars = Get-SpeechCharCount $segment.text
    $targetDuration = $chars / $TargetCps
    $rawDuration = Get-DurationSeconds $rawPath
    $factor = $rawDuration / $targetDuration
    $factor = [Math]::Max(0.5, [Math]::Min(2.0, $factor))
    $factorText = $factor.ToString("0.000", [Globalization.CultureInfo]::InvariantCulture)

    & ffmpeg -y -hide_banner -loglevel error -i $rawPath -filter:a "atempo=$factorText" -ar 24000 -ac 1 $outPath
    $duration = Get-DurationSeconds $outPath
    $cps = $chars / $duration
    $manifest += [pscustomobject]@{
        id = $segment.id
        slideId = $segment.slideId
        file = $segment.audio
        text = $segment.text
        chars = $chars
        duration = [Math]::Round($duration, 2)
        cps = [Math]::Round($cps, 2)
        voice = $synth.Voice.Name
    }
}
}

$manifestPath = Join-Path $outDir "manifest.json"
[pscustomobject]@{
    generatedAt = (Get-Date).ToString("o")
    targetCps = $TargetCps
    slides = $manifest
} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -Path $manifestPath

$manifest | Format-Table -AutoSize
