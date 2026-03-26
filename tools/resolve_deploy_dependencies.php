<?php
/**
 * Resolve PHP include/require dependencies for partial deployments.
 *
 * Usage:
 *   php tools/resolve_deploy_dependencies.php --json upload_package/public_html/index.php
 *   php tools/resolve_deploy_dependencies.php upload_package/public_html/index.php
 */

$repoRoot = realpath(__DIR__ . '/..');
if ($repoRoot === false) {
    fwrite(STDERR, "Failed to resolve repository root.\n");
    exit(1);
}

$jsonOutput = false;
$includeUnchanged = false;
$inputFiles = [];
foreach (array_slice($argv, 1) as $arg) {
    if ($arg === '--json') {
        $jsonOutput = true;
        continue;
    }
    if ($arg === '--include-unchanged') {
        $includeUnchanged = true;
        continue;
    }
    $inputFiles[] = $arg;
}

if (empty($inputFiles)) {
    fwrite(STDERR, "Usage: php tools/resolve_deploy_dependencies.php [--json] <file> [file...]\n");
    exit(1);
}

$queue = [];
$seedFiles = [];
$resolved = [];
$seen = [];
$changedFiles = getChangedFiles($repoRoot);

foreach ($inputFiles as $inputFile) {
    $normalized = normalizeInputPath($inputFile, $repoRoot);
    if ($normalized === null) {
        fwrite(STDERR, "File not found: {$inputFile}\n");
        exit(1);
    }
    $queue[] = $normalized;
    $seedFiles[$normalized] = true;
}

while (!empty($queue)) {
    $relativePath = array_shift($queue);
    if (isset($seen[$relativePath])) {
        continue;
    }
    $seen[$relativePath] = true;

    if ($includeUnchanged || isset($seedFiles[$relativePath]) || isset($changedFiles[$relativePath])) {
        $resolved[$relativePath] = true;
    }

    if (pathinfo($relativePath, PATHINFO_EXTENSION) !== 'php') {
        continue;
    }

    $absolutePath = $repoRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
    $content = @file_get_contents($absolutePath);
    if ($content === false) {
        continue;
    }

    foreach (extractDependencyPaths($content, $absolutePath, $repoRoot) as $dependency) {
        if (!isset($seen[$dependency])) {
            $queue[] = $dependency;
        }
    }
}

$result = array_keys($resolved);
sort($result, SORT_STRING);

if ($jsonOutput) {
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
}

foreach ($result as $path) {
    echo $path . PHP_EOL;
}

function normalizeInputPath(string $path, string $repoRoot): ?string
{
    $candidate = str_replace('\\', '/', $path);
    if (preg_match('/^[A-Za-z]:\//', $candidate)) {
        $absolute = realpath($candidate);
    } else {
        $absolute = realpath($repoRoot . '/' . ltrim($candidate, '/'));
    }

    if ($absolute === false) {
        return null;
    }

    $absolute = str_replace('\\', '/', $absolute);
    $root = str_replace('\\', '/', $repoRoot);
    if (strpos($absolute, $root . '/') !== 0) {
        return null;
    }

    return substr($absolute, strlen($root) + 1);
}

function getChangedFiles(string $repoRoot): array
{
    $command = 'git -C ' . escapeshellarg($repoRoot) . ' status --short --untracked-files=all';
    exec($command . ' 2>NUL', $output, $exitCode);
    if ($exitCode !== 0) {
        return [];
    }

    $changed = [];
    foreach ($output as $line) {
        if (!preg_match('/^.. (.+)$/', $line, $matches)) {
            continue;
        }
        $path = str_replace('\\', '/', trim($matches[1]));
        if ($path !== '') {
            $changed[$path] = true;
        }
    }

    return $changed;
}

function extractDependencyPaths(string $content, string $sourceFile, string $repoRoot): array
{
    $dependencies = [];
    $tokens = token_get_all($content);
    $count = count($tokens);

    for ($i = 0; $i < $count; $i++) {
        $token = $tokens[$i];
        if (!is_array($token)) {
            continue;
        }

        $tokenId = $token[0];
        if (!in_array($tokenId, [T_REQUIRE, T_REQUIRE_ONCE, T_INCLUDE, T_INCLUDE_ONCE], true)) {
            continue;
        }

        $expressionTokens = [];
        for ($j = $i + 1; $j < $count; $j++) {
            $candidate = $tokens[$j];
            $expressionTokens[] = $candidate;
            if ($candidate === ';') {
                $i = $j;
                break;
            }
        }

        $dependency = evaluateDependencyExpression($expressionTokens, dirname($sourceFile), $repoRoot);
        if ($dependency !== null) {
            $dependencies[$dependency] = true;
        }
    }

    return array_keys($dependencies);
}

function evaluateDependencyExpression(array $tokens, string $baseDir, string $repoRoot): ?string
{
    $expression = '';
    foreach ($tokens as $token) {
        if ($token === ';') {
            break;
        }
        if (is_array($token)) {
            $expression .= $token[1];
            continue;
        }
        $expression .= $token;
    }

    $expression = trim($expression);
    if ($expression === '') {
        return null;
    }

    $baseDir = str_replace('\\', '/', $baseDir);
    $expression = preg_replace_callback(
        '/dirname\s*\(\s*__DIR__\s*(?:,\s*(\d+)\s*)?\)/',
        static function (array $matches) use ($baseDir): string {
            $levels = isset($matches[1]) ? (int)$matches[1] : 1;
            $dir = $baseDir;
            for ($i = 0; $i < $levels; $i++) {
                $dir = str_replace('\\', '/', dirname($dir));
            }
            return "'" . addslashes($dir) . "'";
        },
        $expression
    );
    $expression = str_replace('__DIR__', "'" . addslashes($baseDir) . "'", $expression);

    if (strpos($expression, '$') !== false) {
        return null;
    }

    $parts = token_get_all('<?php ' . $expression . ';');
    $assembled = '';
    foreach ($parts as $part) {
        if (is_array($part)) {
            $tokenId = $part[0];
            $tokenText = $part[1];
            if (in_array($tokenId, [T_OPEN_TAG, T_WHITESPACE], true)) {
                continue;
            }
            if ($tokenId !== T_CONSTANT_ENCAPSED_STRING) {
                return null;
            }
            $assembled .= decodePhpStringLiteral($tokenText);
            continue;
        }

        if (in_array($part, ['.', '(', ')', ';'], true)) {
            continue;
        }

        return null;
    }

    if ($assembled === '') {
        return null;
    }

    $absolute = realpath($assembled);
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

function decodePhpStringLiteral(string $literal): string
{
    $quote = $literal[0];
    $body = substr($literal, 1, -1);
    if ($quote === "'") {
        return str_replace(["\\\\", "\\'"], ["\\", "'"], $body);
    }

    return stripcslashes($body);
}
