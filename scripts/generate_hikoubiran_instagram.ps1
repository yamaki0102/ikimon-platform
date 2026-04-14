$ErrorActionPreference = "Stop"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

$workspace = "C:\Users\YAMAKI\Documents\Playground"
$harnessDir = Join-Path $workspace "CLI-Anything\inkscape\agent-harness"
$outputDir = Join-Path $workspace "output"
$projectPath = Join-Path $outputDir "hikoubiran_instagram_sample.json"
$svgPath = Join-Path $outputDir "hikoubiran_instagram_sample.svg"
$pngPath = Join-Path $outputDir "hikoubiran_instagram_sample.png"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Remove-Item $projectPath, $svgPath, $pngPath -ErrorAction SilentlyContinue

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

function Run-Inkscape {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$CommandArgs
    )

    $fullArgs = @("-m", "cli_anything.inkscape.inkscape_cli") + $CommandArgs
    Invoke-CliAnything -Args $fullArgs
}

Run-Inkscape @(
    "document", "new",
    "--width", "1080",
    "--height", "1350",
    "--units", "px",
    "--background", "#F6F0E6",
    "--name", "hikoubiran-instagram-sample",
    "--output", $projectPath
)

Run-Inkscape @("--project", $projectPath, "shape", "add-rect",
    "--x", "60", "--y", "72", "--width", "960", "--height", "220", "--rx", "36", "--ry", "36",
    "--style", "fill:#234E45;stroke:none;")

Run-Inkscape @("--project", $projectPath, "text", "add",
    "--text", "週末はヒコウビランへ",
    "--x", "110", "--y", "152",
    "--font-family", "BIZ UDPGothic",
    "--font-size", "64",
    "--font-weight", "700",
    "--fill", "#FFF9F2")

Run-Inkscape @("--project", $projectPath, "text", "add",
    "--text", "レトロな喫茶で、家族の時間をゆっくり。",
    "--x", "112", "--y", "214",
    "--font-family", "BIZ UDPGothic",
    "--font-size", "30",
    "--font-weight", "400",
    "--fill", "#DCE8E0")

Run-Inkscape @("--project", $projectPath, "text", "add",
    "--text", "キッズルーム完備  |  生パスタ  |  浜名湖卵のオムライス",
    "--x", "112", "--y", "258",
    "--font-family", "BIZ UDPGothic",
    "--font-size", "24",
    "--font-weight", "400",
    "--fill", "#C8D7CF")

Run-Inkscape @("--project", $projectPath, "shape", "add-circle",
    "--cx", "860", "--cy", "182", "--r", "78",
    "--style", "fill:#F2D7B5;stroke:#FCEEDC;stroke-width:4;")

Run-Inkscape @("--project", $projectPath, "shape", "add-path",
    "--d", "M 824 186 C 844 144, 900 144, 915 186 C 918 213, 897 236, 870 234 C 844 235, 820 214, 824 186 Z",
    "--style", "fill:#FFF4E8;stroke:#FFF8F0;stroke-width:3;")

Run-Inkscape @("--project", $projectPath, "shape", "add-rect",
    "--x", "846", "--y", "128", "--width", "46", "--height", "16", "--rx", "8", "--ry", "8",
    "--style", "fill:#E85D5D;stroke:none;")

Run-Inkscape @("--project", $projectPath, "shape", "add-circle",
    "--cx", "512", "--cy", "640", "--r", "260",
    "--style", "fill:#E9D8BF;stroke:none;")

Run-Inkscape @("--project", $projectPath, "shape", "add-ellipse",
    "--cx", "510", "--cy", "646", "--rx", "250", "--ry", "170",
    "--style", "fill:#FFF7EC;stroke:#DDBE95;stroke-width:8;")

Run-Inkscape @("--project", $projectPath, "shape", "add-ellipse",
    "--cx", "514", "--cy", "660", "--rx", "190", "--ry", "110",
    "--style", "fill:#F7D24A;stroke:none;")

Run-Inkscape @("--project", $projectPath, "shape", "add-path",
    "--d", "M 350 640 C 430 555, 612 548, 690 628 C 650 730, 412 752, 350 640 Z",
    "--style", "fill:#E95F3B;stroke:none;opacity:0.92;")

Run-Inkscape @("--project", $projectPath, "shape", "add-path",
    "--d", "M 360 670 C 445 592, 600 590, 664 650 C 612 724, 438 728, 360 670 Z",
    "--style", "fill:#F7D24A;stroke:none;")

Run-Inkscape @("--project", $projectPath, "shape", "add-path",
    "--d", "M 414 594 C 486 542, 582 546, 624 610 C 610 670, 452 686, 398 630 Z",
    "--style", "fill:#FFF0A8;stroke:none;")

Run-Inkscape @("--project", $projectPath, "shape", "add-path",
    "--d", "M 328 596 C 376 538, 470 515, 538 528 C 458 546, 402 584, 362 632 C 340 626, 333 615, 328 596 Z",
    "--style", "fill:none;stroke:#FFF2B7;stroke-width:12;stroke-linecap:round;opacity:0.8;")

Run-Inkscape @("--project", $projectPath, "shape", "add-rect",
    "--x", "710", "--y", "470", "--width", "118", "--height", "235", "--rx", "24", "--ry", "24",
    "--style", "fill:#BDE8D1;stroke:#FFF9F2;stroke-width:6;")

Run-Inkscape @("--project", $projectPath, "shape", "add-rect",
    "--x", "710", "--y", "610", "--width", "118", "--height", "95", "--rx", "0", "--ry", "0",
    "--style", "fill:#9AD5C1;stroke:none;")

Run-Inkscape @("--project", $projectPath, "shape", "add-circle",
    "--cx", "768", "--cy", "455", "--r", "32",
    "--style", "fill:#FFF7F1;stroke:#FFF9F4;stroke-width:4;")

Run-Inkscape @("--project", $projectPath, "shape", "add-circle",
    "--cx", "782", "--cy", "445", "--r", "10",
    "--style", "fill:#E95F3B;stroke:none;")

Run-Inkscape @("--project", $projectPath, "shape", "add-line",
    "--x1", "794", "--y1", "406", "--x2", "842", "--y2", "346",
    "--style", "fill:none;stroke:#F3A23A;stroke-width:8;stroke-linecap:round;")

Run-Inkscape @("--project", $projectPath, "shape", "add-line",
    "--x1", "754", "--y1", "426", "--x2", "714", "--y2", "368",
    "--style", "fill:none;stroke:#F3A23A;stroke-width:8;stroke-linecap:round;")

Run-Inkscape @("--project", $projectPath, "text", "add",
    "--text", "昭和レトロと今の心地よさ",
    "--x", "140", "--y", "980",
    "--font-family", "BIZ UDPGothic",
    "--font-size", "34",
    "--font-weight", "700",
    "--fill", "#234E45")

Run-Inkscape @("--project", $projectPath, "text", "add",
    "--text", "浜松・佐鳴台グリーンストリート沿い",
    "--x", "140", "--y", "1030",
    "--font-family", "BIZ UDPGothic",
    "--font-size", "24",
    "--font-weight", "400",
    "--fill", "#52756B")

Run-Inkscape @("--project", $projectPath, "shape", "add-rect",
    "--x", "90", "--y", "1088", "--width", "900", "--height", "186", "--rx", "30", "--ry", "30",
    "--style", "fill:#FFF9F2;stroke:#D7C3A5;stroke-width:3;")

Run-Inkscape @("--project", $projectPath, "text", "add",
    "--text", "人気ポイント",
    "--x", "130", "--y", "1144",
    "--font-family", "BIZ UDPGothic",
    "--font-size", "28",
    "--font-weight", "700",
    "--fill", "#234E45")

Run-Inkscape @("--project", $projectPath, "text", "add",
    "--text", "・個室タイプのキッズルーム\n・もちもち生パスタ\n・浜名湖卵のオムライス\n・テラス席あり",
    "--x", "132", "--y", "1192",
    "--font-family", "BIZ UDPGothic",
    "--font-size", "25",
    "--font-weight", "400",
    "--fill", "#4E5A54")

Run-Inkscape @("--project", $projectPath, "text", "add",
    "--text", "Instagram sample concept / unofficial",
    "--x", "694", "--y", "1240",
    "--font-family", "BIZ UDPGothic",
    "--font-size", "18",
    "--font-weight", "400",
    "--fill", "#8B8B7D")

Run-Inkscape @("--project", $projectPath, "export", "svg", $svgPath, "--overwrite")
Run-Inkscape @("--project", $projectPath, "export", "png", $pngPath, "--width", "1080", "--height", "1350", "--overwrite")

Write-Output "Generated:"
Write-Output $projectPath
Write-Output $svgPath
Write-Output $pngPath
