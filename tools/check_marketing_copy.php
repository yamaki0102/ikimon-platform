<?php

error_reporting(E_ALL);
ini_set('display_errors', '1');

$repoRoot = realpath(__DIR__ . '/..');
if ($repoRoot === false) {
    fwrite(STDERR, "Failed to resolve repository root.\n");
    exit(1);
}

$snapshotPath = $repoRoot . '/tests/fixtures/marketing_copy_snapshot.json';
$snapshotRaw = @file_get_contents($snapshotPath);
if ($snapshotRaw === false) {
    fwrite(STDERR, "Snapshot not found: {$snapshotPath}\n");
    exit(1);
}

$snapshot = json_decode($snapshotRaw, true);
if (!is_array($snapshot)) {
    fwrite(STDERR, "Invalid snapshot JSON: {$snapshotPath}\n");
    exit(1);
}

$errors = [];
foreach ($snapshot as $relativePath => $phrases) {
    $absolutePath = $repoRoot . '/' . $relativePath;
    if (!is_file($absolutePath)) {
        $errors[] = "Page not found: {$relativePath}";
        continue;
    }

    $html = renderPage($repoRoot, $absolutePath, $relativePath);
    foreach ($phrases as $phrase) {
        if (mb_strpos($html, $phrase) === false) {
            $errors[] = "{$relativePath}: missing phrase [{$phrase}]";
        }
    }
}

if ($errors !== []) {
    foreach ($errors as $error) {
        fwrite(STDERR, $error . PHP_EOL);
    }
    exit(1);
}

echo "Marketing copy snapshot OK" . PHP_EOL;

function renderPage(string $repoRoot, string $absolutePath, string $relativePath): string
{
    $originalServer = $_SERVER ?? [];
    $originalGet = $_GET ?? [];
    $originalRequest = $_REQUEST ?? [];
    $originalCwd = getcwd();
    $bufferLevel = ob_get_level();

    $_GET = [];
    $_REQUEST = [];
    $_SERVER = $originalServer;
    $_SERVER['HTTP_HOST'] = 'localhost';
    $_SERVER['REQUEST_URI'] = '/' . ltrim(str_replace('upload_package/public_html/', '', $relativePath), '/');
    $_SERVER['HTTPS'] = 'off';
    $_SERVER['SERVER_PORT'] = '80';
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
    $_SERVER['DOCUMENT_ROOT'] = $repoRoot . '/upload_package/public_html';

    try {
        chdir(dirname($absolutePath));
        ob_start();
        include $absolutePath;
        $html = (string) ob_get_clean();
        return $html;
    } finally {
        while (ob_get_level() > $bufferLevel) {
            ob_end_clean();
        }
        $_SERVER = $originalServer;
        $_GET = $originalGet;
        $_REQUEST = $originalRequest;
        chdir($originalCwd ?: $repoRoot);
    }
}
