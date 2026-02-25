<?php

/**
 * Security Pattern Scanner for ikimon.life
 * ─────────────────────────────────────────
 * OWASP Top 10 2025 に基づく危険パターンの静的検出。
 * PHP製なので CI (Linux) でもローカル (Windows) でも実行可能。
 *
 * Usage: php tools/security_scan.php [directory]
 *        Default: upload_package/public_html
 *
 * Exit Codes:
 *   0 - CRITICAL/HIGH が検出されなかった
 *   1 - CRITICAL/HIGH が1件以上見つかった
 */

$ROOT = $argv[1] ?? dirname(__DIR__) . '/upload_package/public_html';

// ── Pattern Definitions ──────────────────────

$patterns = [
    // CRITICAL: Remote Code Execution
    ['regex' => '/\beval\s*\(/i',           'severity' => 'CRITICAL', 'desc' => 'eval() 使用 — RCE リスク', 'owasp' => 'A03'],
    ['regex' => '/\bexec\s*\(/i',           'severity' => 'CRITICAL', 'desc' => 'exec() 使用 — RCE リスク', 'owasp' => 'A03'],
    ['regex' => '/\bsystem\s*\(/i',         'severity' => 'CRITICAL', 'desc' => 'system() 使用 — RCE リスク', 'owasp' => 'A03'],
    ['regex' => '/\bpassthru\s*\(/i',       'severity' => 'CRITICAL', 'desc' => 'passthru() 使用 — RCE リスク', 'owasp' => 'A03'],
    ['regex' => '/\bshell_exec\s*\(/i',     'severity' => 'CRITICAL', 'desc' => 'shell_exec() 使用 — RCE リスク', 'owasp' => 'A03'],

    // HIGH: Deserialization & Injection
    ['regex' => '/\bunserialize\s*\(/i',    'severity' => 'HIGH', 'desc' => 'unserialize() — 信頼できない入力の場合危険', 'owasp' => 'A08'],
    ['regex' => '/\bextract\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)/i', 'severity' => 'HIGH', 'desc' => 'extract() + SuperGlobal — 変数汚染', 'owasp' => 'A03'],

    // MEDIUM: Direct SuperGlobal (コントローラー外)
    ['regex' => '/\$_(GET|POST|REQUEST|COOKIE)\s*\[/', 'severity' => 'INFO', 'desc' => 'SuperGlobal 直接参照（要サニタイズ確認）', 'owasp' => 'A03'],

    // LOW: Debug remnants
    ['regex' => '/\bvar_dump\s*\(/i',       'severity' => 'LOW', 'desc' => 'var_dump() — デバッグ出力残留', 'owasp' => 'A09'],
    ['regex' => '/\bdd\s*\(/i',            'severity' => 'LOW', 'desc' => 'dd() — デバッグ出力残留', 'owasp' => 'A09'],
    ['regex' => '/\bprint_r\s*\(/i',       'severity' => 'LOW', 'desc' => 'print_r() — デバッグ出力残留', 'owasp' => 'A09'],

    // MEDIUM: Hardcoded secrets  
    ['regex' => '/(?:password|passwd|secret|api_?key)\s*=\s*[\'"][^\'"]{8,}[\'"]/i', 'severity' => 'MEDIUM', 'desc' => 'ハードコード秘密鍵/パスワード疑い', 'owasp' => 'A02'],

    // MEDIUM: SSRF risk
    ['regex' => '/file_get_contents\s*\(\s*\$/', 'severity' => 'MEDIUM', 'desc' => 'file_get_contents() にユーザー変数 — SSRF リスク', 'owasp' => 'A10'],

    // MEDIUM: Unsafe CORS
    ['regex' => "/Access-Control-Allow-Origin:\s*\*/i", 'severity' => 'MEDIUM', 'desc' => 'CORS 全開放 (*) — 攻撃面拡大', 'owasp' => 'A05'],
];

// ── Severity Colors (ANSI) ───────────────────

$colors = [
    'CRITICAL' => "\033[91m",  // Red
    'HIGH'     => "\033[93m",  // Yellow
    'MEDIUM'   => "\033[96m",  // Cyan
    'LOW'      => "\033[90m",  // Gray
    'INFO'     => "\033[37m",  // White
    'RESET'    => "\033[0m",
];

// Disable colors if not a terminal
$isTerminal = function_exists('posix_isatty') ? posix_isatty(STDOUT) : (getenv('TERM') !== false);
if (!$isTerminal) {
    $colors = array_map(fn() => '', $colors);
    $colors['RESET'] = '';
}

// ── Scan Files ───────────────────────────────

$files = [];
$iter = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($ROOT));
foreach ($iter as $file) {
    if ($file->isFile() && $file->getExtension() === 'php') {
        $files[] = $file->getPathname();
    }
}

// Also scan api/ and components/ subdirectories
$extraDirs = [
    dirname(__DIR__) . '/upload_package/libs',
    dirname(__DIR__) . '/upload_package/config',
];
foreach ($extraDirs as $dir) {
    if (!is_dir($dir)) continue;
    $iter = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
    foreach ($iter as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $files[] = $file->getPathname();
        }
    }
}

$files = array_unique($files);
sort($files);

echo "🔒 Security Pattern Scan\n";
echo "   Scanning " . count($files) . " PHP files...\n\n";

$findings = [
    'CRITICAL' => 0,
    'HIGH' => 0,
    'MEDIUM' => 0,
    'LOW' => 0,
    'INFO' => 0,
];

$totalFindings = 0;

foreach ($files as $filePath) {
    $lines = file($filePath, FILE_IGNORE_NEW_LINES);
    if ($lines === false) continue;

    $relativePath = str_replace(dirname(__DIR__) . '/', '', $filePath);
    $relativePath = str_replace(dirname(__DIR__) . '\\', '', $relativePath);
    $fileHasFindings = false;

    foreach ($lines as $lineNum => $line) {
        // Skip comment lines
        $trimmed = ltrim($line);
        if (str_starts_with($trimmed, '//') || str_starts_with($trimmed, '*') || str_starts_with($trimmed, '/*')) {
            continue;
        }

        foreach ($patterns as $p) {
            if (preg_match($p['regex'], $line)) {
                if (!$fileHasFindings) {
                    echo "📂 {$relativePath}:\n";
                    $fileHasFindings = true;
                }
                $sev = $p['severity'];
                $ln = $lineNum + 1;
                echo "  {$colors[$sev]}[{$sev}]{$colors['RESET']} L{$ln}: {$p['desc']} [{$p['owasp']}]\n";
                $findings[$sev]++;
                $totalFindings++;
            }
        }
    }
}

// ── Report ───────────────────────────────────

echo "\n" . str_repeat('─', 50) . "\n";
echo "📊 Security Scan Complete: " . count($files) . " files\n";
echo "   🔴 Critical: {$findings['CRITICAL']}\n";
echo "   🟠 High:     {$findings['HIGH']}\n";
echo "   🟡 Medium:   {$findings['MEDIUM']}\n";
echo "   🔵 Low:      {$findings['LOW']}\n";
echo "   ⚪ Info:     {$findings['INFO']}\n";
echo "   Total:      {$totalFindings}\n";

$critHigh = $findings['CRITICAL'] + $findings['HIGH'];
if ($critHigh > 0) {
    echo "\n🚨 {$critHigh} CRITICAL/HIGH finding(s) — CI FAIL\n";
    exit(1);
} else {
    echo "\n✅ No CRITICAL/HIGH findings\n";
    exit(0);
}
