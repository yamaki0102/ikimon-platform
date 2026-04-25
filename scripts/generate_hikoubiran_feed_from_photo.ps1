$ErrorActionPreference = "Stop"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$workspace = "C:\Users\YAMAKI\Documents\Playground"
$harnessDir = Join-Path $workspace "CLI-Anything\gimp\agent-harness"
$outputDir = Join-Path $workspace "output"
$projectPath = Join-Path $outputDir "hikoubiran_feed_photo_sample.json"
$pngPath = Join-Path $outputDir "hikoubiran_feed_photo_sample.png"
$photoPath = "C:\Users\YAMAKI\Downloads\PXL_20260324_041009648.MP.jpg"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Remove-Item $projectPath, $pngPath -ErrorAction SilentlyContinue

function Invoke-CliAnything {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "python"
    $psi.WorkingDirectory = $harnessDir
    foreach ($arg in $Args) {
        [void]$psi.ArgumentList.Add($arg)
    }
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8
    $psi.UseShellExecute = $false
    $psi.Environment["PYTHONIOENCODING"] = "utf-8"
    $psi.Environment["PYTHONUTF8"] = "1"

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    if ($process.ExitCode -ne 0) {
        throw "CLI-Anything failed:`n$stdout`n$stderr"
    }
}

function Run-Gimp {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$CommandArgs
    )

    $fullArgs = @("-m", "cli_anything.gimp.gimp_cli") + $CommandArgs
    Invoke-CliAnything -Args $fullArgs
}

Run-Gimp @(
    "project", "new",
    "--width", "1080",
    "--height", "1350",
    "--background", "#F4EBDD",
    "--name", "hikoubiran-feed-photo-sample",
    "--output", $projectPath
)

# Background blocks
Run-Gimp @("--project", $projectPath, "layer", "new",
    "--name", "BottomCard", "--type", "solid", "--width", "1000", "--height", "278",
    "--fill", "#FFF9F2")
Run-Gimp @("--project", $projectPath, "layer", "set", "0", "offset_x", "40")
Run-Gimp @("--project", $projectPath, "layer", "set", "0", "offset_y", "1018")

Run-Gimp @("--project", $projectPath, "layer", "new",
    "--name", "PhotoFrame", "--type", "solid", "--width", "1000", "--height", "620",
    "--fill", "#FFF9F2")
Run-Gimp @("--project", $projectPath, "layer", "set", "0", "offset_x", "40")
Run-Gimp @("--project", $projectPath, "layer", "set", "0", "offset_y", "306")

Run-Gimp @("--project", $projectPath, "layer", "new",
    "--name", "HeaderBand", "--type", "solid", "--width", "1080", "--height", "248",
    "--fill", "#24493F")

Run-Gimp @("--project", $projectPath, "layer", "new",
    "--name", "HeaderTag", "--type", "solid", "--width", "236", "--height", "54",
    "--fill", "#E0B35A")
Run-Gimp @("--project", $projectPath, "layer", "set", "0", "offset_x", "72")
Run-Gimp @("--project", $projectPath, "layer", "set", "0", "offset_y", "62")

# Photo layer
Run-Gimp @("--project", $projectPath, "layer", "add-from-file", $photoPath, "--name", "LunchPhoto")
Run-Gimp @("--project", $projectPath, "filter", "add", "crop", "--layer", "0",
    "--param", "left=120", "--param", "top=110", "--param", "right=1291", "--param", "bottom=827")
Run-Gimp @("--project", $projectPath, "filter", "add", "resize", "--layer", "0",
    "--param", "width=980", "--param", "height=600")
Run-Gimp @("--project", $projectPath, "layer", "set", "0", "offset_x", "50")
Run-Gimp @("--project", $projectPath, "layer", "set", "0", "offset_y", "316")
Run-Gimp @("--project", $projectPath, "filter", "add", "brightness", "--layer", "0", "--param", "factor=1.04")
Run-Gimp @("--project", $projectPath, "filter", "add", "contrast", "--layer", "0", "--param", "factor=1.06")
Run-Gimp @("--project", $projectPath, "filter", "add", "sharpness", "--layer", "0", "--param", "factor=1.08")

# Header texts
Run-Gimp @("--project", $projectPath, "layer", "new",
    "--name", "AreaText", "--type", "text", "--width", "420", "--height", "40", "--fill", "transparent")
Run-Gimp @("--project", $projectPath, "draw", "text", "--layer", "0",
    "--text", "浜松・佐鳴台", "--x", "92", "--y", "74", "--font", "Meiryo", "--size", "26", "--color", "#24493F")

Run-Gimp @("--project", $projectPath, "layer", "new",
    "--name", "TitleLine1", "--type", "text", "--width", "700", "--height", "70", "--fill", "transparent")
Run-Gimp @("--project", $projectPath, "draw", "text", "--layer", "0",
    "--text", "ヒコウビランの", "--x", "72", "--y", "134", "--font", "Meiryo", "--size", "52", "--color", "#FFF9F2")

Run-Gimp @("--project", $projectPath, "layer", "new",
    "--name", "TitleLine2", "--type", "text", "--width", "780", "--height", "80", "--fill", "transparent")
Run-Gimp @("--project", $projectPath, "draw", "text", "--layer", "0",
    "--text", "ごほうびランチ", "--x", "72", "--y", "184", "--font", "Meiryo", "--size", "62", "--color", "#FFF9F2")

Run-Gimp @("--project", $projectPath, "layer", "new",
    "--name", "Subtitle", "--type", "text", "--width", "760", "--height", "40", "--fill", "transparent")
Run-Gimp @("--project", $projectPath, "draw", "text", "--layer", "0",
    "--text", "レトロな喫茶で、昼の時間をゆっくり。", "--x", "76", "--y", "264", "--font", "Meiryo", "--size", "26", "--color", "#5C746C")

# Bottom information card
Run-Gimp @("--project", $projectPath, "layer", "new",
    "--name", "CardHeading", "--type", "text", "--width", "800", "--height", "40", "--fill", "transparent")
Run-Gimp @("--project", $projectPath, "draw", "text", "--layer", "0",
    "--text", "ちゃんと満たされる、喫茶の昼ごはん。", "--x", "86", "--y", "1066", "--font", "Meiryo", "--size", "34", "--color", "#24493F")

Run-Gimp @("--project", $projectPath, "layer", "new",
    "--name", "CardBody1", "--type", "text", "--width", "880", "--height", "34", "--fill", "transparent")
Run-Gimp @("--project", $projectPath, "draw", "text", "--layer", "0",
    "--text", "魚料理ランチ / サラダ付き / 落ち着いた店内", "--x", "88", "--y", "1122", "--font", "Meiryo", "--size", "26", "--color", "#4C5C57")

Run-Gimp @("--project", $projectPath, "layer", "new",
    "--name", "CardBody2", "--type", "text", "--width", "900", "--height", "34", "--fill", "transparent")
Run-Gimp @("--project", $projectPath, "draw", "text", "--layer", "0",
    "--text", "家族でも、ひとりでも。浜松の定番ランチ時間に。", "--x", "88", "--y", "1168", "--font", "Meiryo", "--size", "25", "--color", "#6C736F")

Run-Gimp @("--project", $projectPath, "layer", "new",
    "--name", "Caption", "--type", "text", "--width", "720", "--height", "28", "--fill", "transparent")
Run-Gimp @("--project", $projectPath, "draw", "text", "--layer", "0",
    "--text", "店内で撮影した素材を使う想定の Instagram サンプル", "--x", "88", "--y", "1232", "--font", "Meiryo", "--size", "20", "--color", "#8B8B7C")

Run-Gimp @("--project", $projectPath, "export", "render", $pngPath, "--preset", "png", "--overwrite")

Write-Output "Generated:"
Write-Output $projectPath
Write-Output $pngPath
