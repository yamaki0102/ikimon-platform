param(
    [double]$TargetCps = 4.35,
    [string]$EngineUrl = "http://127.0.0.1:50021",
    [double]$VoicevoxSpeedScale = 0.92,
    [double]$MaxTempoAdjustment = 1.10,
    [double]$MinLineSeconds = 2.2,
    [double]$InterLinePauseSeconds = 0.26
)

$ErrorActionPreference = "Stop"

# Keep generated narration inside this project so release inputs stay reproducible.

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$slidesPath = Join-Path $root "src/demo-slides.json"
$outDir = Join-Path $root "public/assets/demo-narration"
$slideOutDir = Join-Path $outDir "slides"
$rawDir = Join-Path $root ".runtime/demo-dialogue-raw"

New-Item -ItemType Directory -Force -Path $slideOutDir | Out-Null
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null

function Join-Chars([int[]]$Codes) {
    return -join ($Codes | ForEach-Object { [char]$_ })
}

$ZundamonName = Join-Chars @(0x305A, 0x3093, 0x3060, 0x3082, 0x3093)
$MetanName = (Join-Chars @(0x56DB, 0x56FD)) + (Join-Chars @(0x3081, 0x305F, 0x3093))
$NormalStyle = Join-Chars @(0x30CE, 0x30FC, 0x30DE, 0x30EB)
$ZundamonSpeaker = 3
$MetanSpeaker = 2

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
    while ($Factor -lt 0.5) {
        $parts += "atempo=0.5"
        $Factor = $Factor / 0.5
    }
    while ($Factor -gt 2.0) {
        $parts += "atempo=2.0"
        $Factor = $Factor / 2.0
    }
    $parts += ("atempo=" + $Factor.ToString("0.000", [Globalization.CultureInfo]::InvariantCulture))
    return ($parts -join ",")
}

function Clamp-Double([double]$Value, [double]$Min, [double]$Max) {
    return [Math]::Max($Min, [Math]::Min($Max, $Value))
}

function Get-TargetLineDuration([string]$Text, [int]$Chars) {
    return [Math]::Max($MinLineSeconds, ($Chars / $TargetCps))
}

function Get-SpeakerId([string]$Speaker) {
    if ($Speaker -eq "zundamon") {
        return $ZundamonSpeaker
    }
    return $MetanSpeaker
}

function Convert-CardNamesForSpeech([string]$Text) {
    $speech = $Text
    $columnReadings = @{}
    $columnReadings[(Join-Chars @(0x963F))] = Join-Chars @(0x3042)
    $columnReadings[(Join-Chars @(0x4F0A))] = Join-Chars @(0x3044)
    $columnReadings[(Join-Chars @(0x5B87))] = Join-Chars @(0x3046)
    $columnReadings[(Join-Chars @(0x6C5F))] = Join-Chars @(0x3048)

    $numberReadings = @{}
    $numberReadings[(Join-Chars @(0x4E00))] = Join-Chars @(0x3044, 0x3061)
    $numberReadings[(Join-Chars @(0x4E8C))] = Join-Chars @(0x306B)
    $numberReadings[(Join-Chars @(0x4E09))] = Join-Chars @(0x3055, 0x3093)
    $numberReadings[(Join-Chars @(0x56DB))] = Join-Chars @(0x3088, 0x3093)
    $no = Join-Chars @(0x306E)
    $chomeMarker = Join-Chars @(0x4E01, 0x76EE)
    $chomeReading = Join-Chars @(0x3061, 0x3087, 0x3046, 0x3081)

    foreach ($column in $columnReadings.Keys) {
        foreach ($number in $numberReadings.Keys) {
            $withChome = "$column$number$chomeMarker"
            $withoutChome = "$column$number"
            $readingWithChome = "$($columnReadings[$column])$no$($numberReadings[$number])$chomeReading"
            $readingWithoutChome = "$($columnReadings[$column])$no$($numberReadings[$number])"
            $speech = $speech.Replace($withChome, $readingWithChome)
            $speech = $speech.Replace($withoutChome, $readingWithoutChome)
        }
        $speech = $speech.Replace($column, $columnReadings[$column])
    }
    return $speech
}

function Get-VoiceLabel([string]$Speaker) {
    if ($Speaker -eq "zundamon") {
        return "VOICEVOX:$ZundamonName/$NormalStyle"
    }
    return "VOICEVOX:$MetanName/$NormalStyle"
}

function Invoke-VoicevoxLine([string]$Text, [int]$SpeakerId, [string]$OutPath) {
    $encodedText = [uri]::EscapeDataString($Text)
    $queryUrl = "$EngineUrl/audio_query?text=$encodedText&speaker=$SpeakerId"
    $query = Invoke-RestMethod -Method Post -Uri $queryUrl -TimeoutSec 60
    $query.speedScale = $VoicevoxSpeedScale
    $query.pitchScale = 0.0
    $query.intonationScale = 1.0
    $query.volumeScale = 1.0
    $query.prePhonemeLength = 0.04
    $query.postPhonemeLength = 0.08

    $body = $query | ConvertTo-Json -Depth 20
    $synthesisUrl = "$EngineUrl/synthesis?speaker=$SpeakerId"
    Invoke-WebRequest -Method Post -Uri $synthesisUrl -Body $body -ContentType "application/json" -OutFile $OutPath -TimeoutSec 120 | Out-Null
}

$version = Invoke-RestMethod -Uri "$EngineUrl/version" -TimeoutSec 20

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
        $speakerId = Get-SpeakerId ([string]$line.speaker)
        $voiceName = Get-VoiceLabel ([string]$line.speaker)
        $speechText = Convert-CardNamesForSpeech ([string]$line.text)

        $rawPath = Join-Path $slideRawDir "line-$lineNo-raw.wav"
        $normPath = Join-Path $slideRawDir "line-$lineNo.wav"
        Invoke-VoicevoxLine $speechText $speakerId $rawPath

        $chars = Get-SpeechCharCount([string]$line.text)
        $targetDuration = Get-TargetLineDuration ([string]$line.text) $chars
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
    engine = "VOICEVOX Engine $version"
    mode = "slide-level"
    targetCps = $TargetCps
    voicevoxSpeedScale = $VoicevoxSpeedScale
    maxTempoAdjustment = $MaxTempoAdjustment
    minLineSeconds = $MinLineSeconds
    interLinePauseSeconds = $InterLinePauseSeconds
    credit = @("VOICEVOX:$ZundamonName", "VOICEVOX:$MetanName")
    slides = $manifestSlides
} | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -Path (Join-Path $outDir "slide-manifest.json")

$manifestSlides | Format-Table -AutoSize
