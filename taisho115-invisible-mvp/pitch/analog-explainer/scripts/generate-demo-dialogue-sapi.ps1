param(
    [double]$TargetCps = 4.35,
    [double]$MaxTempoAdjustment = 1.18,
    [double]$MinLineSeconds = 2.0,
    [double]$InterLinePauseSeconds = 0.22
)

$ErrorActionPreference = "Stop"

# Keep generated narration inside this project so release inputs stay reproducible.

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$slidesPath = Join-Path $root "src/demo-slides.json"
$outDir = Join-Path $root "public/assets/demo-narration"
$slideOutDir = Join-Path $outDir "slides"
$rawDir = Join-Path $root ".runtime/demo-dialogue-sapi-raw"

New-Item -ItemType Directory -Force -Path $slideOutDir | Out-Null
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = 0
$synth.Volume = 100

function Get-SpeechCharCount([string]$Text) {
    $normalized = [regex]::Replace($Text, "[\s\p{P}\p{S}]", "")
    return [Math]::Max(1, $normalized.Length)
}

function Get-DurationSeconds([string]$Path) {
    $value = & ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 $Path
    return [double]::Parse(($value | Select-Object -First 1), [Globalization.CultureInfo]::InvariantCulture)
}

function Get-AtempoFilter([double]$Factor) {
    $parts = @()
    while ($Factor -gt 2.0) {
        $parts += "atempo=2.0"
        $Factor = $Factor / 2.0
    }
    while ($Factor -lt 0.5) {
        $parts += "atempo=0.5"
        $Factor = $Factor / 0.5
    }
    $parts += ("atempo=" + $Factor.ToString("0.000", [Globalization.CultureInfo]::InvariantCulture))
    return ($parts -join ",")
}

function Clamp-Double([double]$Value, [double]$Min, [double]$Max) {
    return [Math]::Max($Min, [Math]::Min($Max, $Value))
}

function Convert-CardNamesForSpeech([string]$Text) {
    $speech = $Text
    $columnReadings = @{
        "阿" = "あ"
        "伊" = "い"
        "宇" = "う"
        "江" = "え"
    }
    $numberReadings = @{
        "一" = "いち"
        "二" = "に"
        "三" = "さん"
        "四" = "よん"
    }

    foreach ($column in $columnReadings.Keys) {
        foreach ($number in $numberReadings.Keys) {
            $withChome = "$column$number" + "丁目"
            $withoutChome = "$column$number"
            $readingWithChome = "$($columnReadings[$column])の$($numberReadings[$number])ちょうめ"
            $readingWithoutChome = "$($columnReadings[$column])の$($numberReadings[$number])"
            $speech = $speech.Replace($withChome, $readingWithChome)
            $speech = $speech.Replace($withoutChome, $readingWithoutChome)
        }
        $speech = $speech.Replace($column, $columnReadings[$column])
    }
    return $speech
}

function Select-SpeakerVoice([string]$Speaker) {
    $voiceName = if ($Speaker -eq "zundamon") { "VOICEVOX ずんだもん ノーマル" } else { "VOICEVOX 四国めたん ノーマル" }
    $synth.SelectVoice($voiceName)
    return $voiceName
}

$slides = Get-Content -Raw -Encoding UTF8 -Path $slidesPath | ConvertFrom-Json
$manifestSlides = @()

for ($slideIndex = 0; $slideIndex -lt $slides.Count; $slideIndex++) {
    $slide = $slides[$slideIndex]
    $slideNo = ($slideIndex + 1).ToString("00")
    $slideRawDir = Join-Path $rawDir "slide-$slideNo"
    New-Item -ItemType Directory -Force -Path $slideRawDir | Out-Null

    $concatPath = Join-Path $slideRawDir "concat.txt"
    $segments = @()
    $concatLines = @()
    $cursor = 0.0

    for ($lineIndex = 0; $lineIndex -lt $slide.dialogue.Count; $lineIndex++) {
        $line = $slide.dialogue[$lineIndex]
        $lineNo = ($lineIndex + 1).ToString("00")
        $voiceName = Select-SpeakerVoice ([string]$line.speaker)
        $speechText = Convert-CardNamesForSpeech ([string]$line.text)

        $rawPath = Join-Path $slideRawDir "line-$lineNo-raw.wav"
        $normPath = Join-Path $slideRawDir "line-$lineNo.wav"
        $synth.SetOutputToWaveFile($rawPath)
        $synth.Speak($speechText)
        $synth.SetOutputToDefaultAudioDevice()

        $chars = Get-SpeechCharCount([string]$line.text)
        $targetDuration = [Math]::Max($MinLineSeconds, ($chars / $TargetCps))
        $rawDuration = Get-DurationSeconds $rawPath
        $factor = Clamp-Double ($rawDuration / $targetDuration) (1 / $MaxTempoAdjustment) $MaxTempoAdjustment
        $filterText = Get-AtempoFilter $factor

        & ffmpeg -y -hide_banner -loglevel error -i $rawPath -filter:a $filterText -ar 24000 -ac 1 $normPath
        $duration = Get-DurationSeconds $normPath
        $segments += [pscustomobject]@{
            index = $lineIndex
            speaker = [string]$line.speaker
            voice = $voiceName
            text = [string]$line.text
            speechText = $speechText
            thought = [bool]$line.thought
            start = [Math]::Round($cursor, 3)
            end = [Math]::Round($cursor + $duration, 3)
            chars = $chars
            cps = [Math]::Round(($chars / $duration), 2)
            rawDuration = [Math]::Round($rawDuration, 3)
            tempoFactor = [Math]::Round($factor, 3)
        }
        $cursor += $duration
        $concatLines += "file '$normPath'"

        if ($lineIndex -lt ($slide.dialogue.Count - 1)) {
            $silencePath = Join-Path $slideRawDir "silence-$lineNo.wav"
            & ffmpeg -y -hide_banner -loglevel error -f lavfi -i anullsrc=r=24000:cl=mono -t $InterLinePauseSeconds $silencePath
            $concatLines += "file '$silencePath'"
            $cursor += $InterLinePauseSeconds
        }
    }

    Set-Content -Encoding ASCII -Path $concatPath -Value ($concatLines -join "`n")
    $outPath = Join-Path $slideOutDir "slide-$slideNo.wav"
    & ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i $concatPath -c copy $outPath
    $slideDuration = Get-DurationSeconds $outPath
    $charsTotal = ($slide.dialogue | ForEach-Object { Get-SpeechCharCount([string]$_.text) } | Measure-Object -Sum).Sum

    $manifestSlides += [pscustomobject]@{
        slideId = [string]$slide.id
        file = "slide-$slideNo.wav"
        duration = [Math]::Round($slideDuration, 2)
        cps = [Math]::Round(($charsTotal / $slideDuration), 2)
        segments = $segments
    }
}

[pscustomobject]@{
    generatedAt = (Get-Date).ToString("o")
    engine = "SAPIForVOICEVOX"
    mode = "slide-level"
    targetCps = $TargetCps
    maxTempoAdjustment = $MaxTempoAdjustment
    minLineSeconds = $MinLineSeconds
    interLinePauseSeconds = $InterLinePauseSeconds
    credit = @("VOICEVOX:ずんだもん", "VOICEVOX:四国めたん")
    slides = $manifestSlides
} | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -Path (Join-Path $outDir "slide-manifest.json")

$manifestSlides | Format-Table -AutoSize
