<?php

/**
 * Cross-platform PHP Lint Tool
 * 
 * Usage: php tools/lint.php [path]
 * Default path: upload_package/
 */

$searchPath = $argv[1] ?? __DIR__ . '/../upload_package';
$searchPath = realpath($searchPath);

if (!$searchPath || !is_dir($searchPath)) {
    echo "Error: Directory not found: " . ($argv[1] ?? 'upload_package/') . PHP_EOL;
    exit(1);
}

$errors = [];
$checked = 0;

$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($searchPath, RecursiveDirectoryIterator::SKIP_DOTS)
);

foreach ($iterator as $file) {
    if ($file->getExtension() !== 'php') continue;

    $checked++;
    $output = [];
    $returnCode = 0;
    exec('php -l ' . escapeshellarg($file->getPathname()) . ' 2>&1', $output, $returnCode);

    if ($returnCode !== 0) {
        $errors[] = [
            'file' => str_replace($searchPath . DIRECTORY_SEPARATOR, '', $file->getPathname()),
            'message' => implode(' ', $output)
        ];
    }
}

echo PHP_EOL;
echo "=== PHP Lint Report ===" . PHP_EOL;
echo "Checked: {$checked} files" . PHP_EOL;
echo "Errors:  " . count($errors) . PHP_EOL;
echo PHP_EOL;

if (!empty($errors)) {
    foreach ($errors as $err) {
        echo "  ❌ {$err['file']}" . PHP_EOL;
        echo "     {$err['message']}" . PHP_EOL;
    }
    echo PHP_EOL;
    exit(1);
}

echo "  ✅ All files passed syntax check" . PHP_EOL;
echo PHP_EOL;
exit(0);
