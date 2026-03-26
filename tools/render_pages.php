<?php
/**
 * Render critical pages in CLI and assert that the HTML completes.
 *
 * Usage:
 *   php tools/render_pages.php
 *   php tools/render_pages.php upload_package/public_html/index.php
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

$repoRoot = realpath(__DIR__ . '/..');
if ($repoRoot === false) {
    fwrite(STDERR, "Failed to resolve repository root.\n");
    exit(1);
}

$defaultPages = [
    'upload_package/public_html/index.php' => [
        'uri' => '/',
        'markers' => ['最近の発見', ['observation_detail.php?id=', '最初の記録者になりませんか？'], '</html>'],
    ],
    'upload_package/public_html/about.php' => [
        'uri' => '/about.php',
        'markers' => ['消滅可能性自治体', 'IKIMON株式会社', '</html>'],
    ],
    'upload_package/public_html/for-business/index.php' => [
        'uri' => '/for-business/',
        'markers' => ['消滅可能性自治体', '無償提供', '</html>'],
    ],
];

$targets = array_slice($argv, 1);
if (empty($targets)) {
    $targets = array_keys($defaultPages);
}

$errors = [];
$reports = [];

foreach ($targets as $target) {
    $normalized = normalizePagePath($target, $repoRoot);
    if ($normalized === null) {
        $errors[] = "Page not found: {$target}";
        continue;
    }

    $spec = $defaultPages[$normalized] ?? [
        'uri' => '/' . ltrim(str_replace('upload_package/public_html/', '', $normalized), '/'),
        'markers' => ['</html>'],
    ];

    $result = renderPage($repoRoot, $normalized, $spec['uri'], $spec['markers']);
    $reports[] = $result;
    if (!$result['ok']) {
        $errors[] = "{$normalized}: {$result['message']}";
    }
}

echo PHP_EOL;
echo "=== CLI Render Gate ===" . PHP_EOL;
foreach ($reports as $report) {
    $status = $report['ok'] ? 'OK ' : 'NG ';
    echo sprintf(
        "[%s] %s (%d bytes)",
        $status,
        $report['path'],
        $report['bytes']
    ) . PHP_EOL;
    if (!$report['ok']) {
        echo "      {$report['message']}" . PHP_EOL;
    }
}
echo PHP_EOL;

if (!empty($errors)) {
    foreach ($errors as $error) {
        fwrite(STDERR, $error . PHP_EOL);
    }
    exit(1);
}

echo "All critical pages rendered to closing HTML." . PHP_EOL;
exit(0);

function normalizePagePath(string $path, string $repoRoot): ?string
{
    $candidate = str_replace('\\', '/', $path);
    if (preg_match('/^[A-Za-z]:\//', $candidate)) {
        $absolute = realpath($candidate);
    } else {
        $absolute = realpath($repoRoot . '/' . ltrim($candidate, '/'));
    }

    if ($absolute === false || !is_file($absolute)) {
        return null;
    }

    $absolute = str_replace('\\', '/', $absolute);
    $root = str_replace('\\', '/', $repoRoot);
    if (strpos($absolute, $root . '/') !== 0) {
        return null;
    }

    return substr($absolute, strlen($root) + 1);
}

function renderPage(string $repoRoot, string $relativePath, string $uri, array $markers): array
{
    $absolutePath = $repoRoot . '/' . $relativePath;
    $originalServer = $_SERVER ?? [];
    $originalGet = $_GET ?? [];
    $originalRequest = $_REQUEST ?? [];
    $originalCwd = getcwd();
    $issues = [];
    $html = '';

    set_error_handler(static function (int $severity, string $message, string $file, int $line) use (&$issues): bool {
        $issues[] = "PHP warning: {$message} @ {$file}:{$line}";
        return true;
    });

    try {
        $_GET = [];
        $_REQUEST = [];
        $_SERVER = $originalServer;
        $_SERVER['HTTP_HOST'] = 'localhost';
        $_SERVER['REQUEST_URI'] = $uri;
        $_SERVER['HTTPS'] = 'off';
        $_SERVER['SERVER_PORT'] = '80';
        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
        $_SERVER['DOCUMENT_ROOT'] = $repoRoot . '/upload_package/public_html';

        chdir(dirname($absolutePath));
        ob_start();
        include $absolutePath;
        $html = (string)ob_get_clean();
    } catch (Throwable $e) {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        $issues[] = get_class($e) . ': ' . $e->getMessage();
    } finally {
        restore_error_handler();
        $_SERVER = $originalServer;
        $_GET = $originalGet;
        $_REQUEST = $originalRequest;
        chdir($originalCwd ?: $repoRoot);
    }

    foreach ($markers as $marker) {
        if ($html === '') {
            continue;
        }

        if (is_array($marker)) {
            $matched = false;
            foreach ($marker as $candidate) {
                if (mb_strpos($html, $candidate) !== false) {
                    $matched = true;
                    break;
                }
            }
            if (!$matched) {
                $issues[] = 'Missing one-of marker: ' . implode(' | ', $marker);
            }
            continue;
        }

        if (mb_strpos($html, $marker) === false) {
            $issues[] = "Missing marker: {$marker}";
        }
    }

    return [
        'ok' => empty($issues),
        'path' => $relativePath,
        'bytes' => strlen($html),
        'message' => empty($issues) ? 'rendered' : implode(' | ', $issues),
    ];
}
