<?php
// Generate a batch SCP script (PowerShell) for all nonce-modified files
$base = realpath(__DIR__ . '/../upload_package/public_html');
$iter = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS)
);
$files = [];
foreach ($iter as $f) {
    if ($f->getExtension() !== 'php') continue;
    $content = file_get_contents($f->getPathname());
    if (strpos($content, 'CspNonce::attr()') !== false) {
        $rel = str_replace('\\', '/', substr($f->getPathname(), strlen($base)));
        $files[] = $rel;
    }
}

// Also include config.php, CspNonce.php, meta.php, admin head.php
$extraLocal = [
    '/components/meta.php',
];

// Output file list for SCP
$out = '';
$out .= '$key = "$env:USERPROFILE\.ssh\production.pem"' . "\n";
$out .= '$dest = "r1522484@www1070.onamae.ne.jp"' . "\n";
$out .= '$port = "8022"' . "\n";
$out .= '$root = "~/public_html/ikimon.life/public_html"' . "\n";
$out .= '$src = "' . str_replace('\\', '/', $base) . '"' . "\n";
$out .= '$ok = 0; $fail = 0' . "\n";

$allFiles = array_unique(array_merge($files, $extraLocal));
sort($allFiles);

foreach ($allFiles as $rel) {
    $remoteDir = dirname($rel);
    $out .= "scp -P \$port -i \$key \"\$src{$rel}\" \"\${dest}:\${root}{$rel}\" 2>&1 | Out-Null; if(\$?) { \$ok++ } else { \$fail++; Write-Host \"FAIL: {$rel}\" }\n";
}

$out .= 'Write-Host "--- SCP DONE: OK=$ok FAIL=$fail ---"' . "\n";

$outPath = __DIR__ . '/scp_nonce_batch.ps1';
file_put_contents($outPath, $out);
echo "Generated: $outPath\n";
echo count($allFiles) . " files to upload\n";
