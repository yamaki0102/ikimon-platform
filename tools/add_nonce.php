<?php

/**
 * Batch add nonce="<?= CspNonce::attr() ?>" to all inline <script> tags.
 * 
 * DRY RUN by default. Set $dryRun = false to apply changes.
 * 
 * Target: <script> tags WITHOUT src attribute (inline scripts only).
 * Skip: <script src="..."> or <script defer src="..."> (external scripts)
 */

$dryRun = in_array('--apply', $argv ?? []) ? false : true;
$rootDir = __DIR__ . '/../upload_package/public_html';
$noncePhp = '<?= CspNonce::attr() ?>';

// Pattern: <script> or <script> with no src, no nonce already
// Matches: <script> but NOT <script src=".."> or <script nonce=".."> or <script defer src="..">
$pattern = '/<script(?!\s+(src|defer\s+src|nonce))(\s*)>/i';
$replacement = '<script nonce="' . $noncePhp . '"$2>';

$files = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($rootDir, RecursiveDirectoryIterator::SKIP_DOTS),
    RecursiveIteratorIterator::LEAVES_ONLY
);

$totalFiles = 0;
$totalReplacements = 0;
$modifiedFiles = [];

foreach ($files as $file) {
    if ($file->getExtension() !== 'php') continue;

    $content = file_get_contents($file->getPathname());
    $count = 0;
    $newContent = preg_replace($pattern, $replacement, $content, -1, $count);

    if ($count > 0) {
        $totalReplacements += $count;
        $totalFiles++;
        $relPath = str_replace($rootDir . DIRECTORY_SEPARATOR, '', $file->getPathname());
        $relPath = str_replace(DIRECTORY_SEPARATOR, '/', $relPath);
        $modifiedFiles[] = "$relPath ($count replacements)";

        if (!$dryRun) {
            file_put_contents($file->getPathname(), $newContent);
        }
    }
}

echo ($dryRun ? "[DRY RUN] " : "[APPLIED] ");
echo "Files: $totalFiles, Replacements: $totalReplacements\n";
echo "---\n";
foreach ($modifiedFiles as $f) {
    echo "  $f\n";
}
echo "---\n";
if ($dryRun) {
    echo "Run with --apply to write changes.\n";
}
