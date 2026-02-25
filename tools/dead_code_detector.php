<?php

/**
 * Dead Code Detector for ikimon.life
 * ─────────────────────────────────────────
 * require/include で参照されていない PHP ファイルを検出する軽量ツール。
 * 「使われていないかもしれないファイル」を洗い出すことでコードベースの肥大化を防ぐ。
 *
 * Usage: php tools/dead_code_detector.php
 *
 * 注意:
 *   - 動的 include (変数パス) は検出できない → false positive の可能性あり
 *   - API エンドポイントやページファイルは HTTP から直接アクセスされるので除外対象
 *   - components/ 配下は include されるファイルなので検出対象
 */

$ROOT = dirname(__DIR__) . '/upload_package';
$PUBLIC = $ROOT . '/public_html';

// ── Step 1: Collect all PHP files ────────────

$allFiles = [];
$iter = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($ROOT));
foreach ($iter as $file) {
    if ($file->isFile() && $file->getExtension() === 'php') {
        $allFiles[] = $file->getPathname();
    }
}

echo "🔍 Dead Code Detector\n";
echo "   Scanning " . count($allFiles) . " PHP files...\n\n";

// ── Step 2: Build reference graph ────────────

// Files that are "entry points" (accessed directly via HTTP or CLI)
$entryPointPatterns = [
    // Pages in public_html root (accessed as URLs)
    '#[/\\\\]public_html[/\\\\][^/\\\\]+\\.php$#',
    // API endpoints
    '#[/\\\\]api[/\\\\]#',
    // Admin pages
    '#[/\\\\]admin[/\\\\][^/\\\\]+\\.php$#',
    // Config (bootstrapped)
    '#[/\\\\]config[/\\\\]config\\.php$#',
    // CLI scripts
    '#[/\\\\]scripts[/\\\\]#',
    '#[/\\\\]tools[/\\\\]#',
];

$entryPoints = [];
$libraries = [];  // Files that should be included somewhere

foreach ($allFiles as $f) {
    $isEntry = false;
    foreach ($entryPointPatterns as $pattern) {
        if (preg_match($pattern, $f)) {
            $isEntry = true;
            break;
        }
    }
    if ($isEntry) {
        $entryPoints[] = $f;
    } else {
        $libraries[] = $f;
    }
}

// ── Step 3: Scan all files for require/include references ──

$referenced = [];
$includePatterns = [
    '/(?:require|include)(?:_once)?\s*\(?[\'"]([^\'"]+\.php)[\'"]\)?/',
    '/(?:require|include)(?:_once)?\s*\(?\s*[A-Z_]+\s*\.\s*[\'"]([^\'"]+\.php)[\'"]\)?/',
];

foreach ($allFiles as $f) {
    $content = file_get_contents($f);
    if ($content === false) continue;

    foreach ($includePatterns as $pattern) {
        if (preg_match_all($pattern, $content, $matches)) {
            foreach ($matches[1] as $ref) {
                // Normalize: extract just the filename
                $basename = basename($ref);
                $referenced[$basename] = true;

                // Also store partial path for better matching
                $parts = explode('/', str_replace('\\', '/', $ref));
                if (count($parts) >= 2) {
                    $partialPath = implode('/', array_slice($parts, -2));
                    $referenced[$partialPath] = true;
                }
            }
        }
    }

    // Also detect class/function usage patterns for libs
    // e.g., SiteManager::, new DataStore, Auth::
    if (preg_match_all('/\b([A-Z][a-zA-Z]+)(?:::|\s+\$)/', $content, $classMatches)) {
        foreach ($classMatches[1] as $className) {
            $referenced[$className . '.php'] = true;
        }
    }
}

// ── Step 4: Find orphans ─────────────────────

$orphans = [];
foreach ($libraries as $f) {
    $basename = basename($f);
    $relativePath = str_replace(str_replace('\\', '/', $ROOT) . '/', '', str_replace('\\', '/', $f));

    // Check if referenced by basename or partial path
    $isReferenced = isset($referenced[$basename]);

    if (!$isReferenced) {
        // Check partial paths
        $parts = explode('/', str_replace('\\', '/', $relativePath));
        if (count($parts) >= 2) {
            $partial = implode('/', array_slice($parts, -2));
            $isReferenced = isset($referenced[$partial]);
        }
    }

    if (!$isReferenced) {
        $orphans[] = $relativePath;
    }
}

// ── Report ───────────────────────────────────

sort($orphans);
echo "📊 Results:\n";
echo "   Entry points: " . count($entryPoints) . "\n";
echo "   Libraries:    " . count($libraries) . "\n";
echo "   Referenced:   " . count($referenced) . " unique refs\n";
echo "   Orphans:      " . count($orphans) . "\n\n";

if (!empty($orphans)) {
    echo "🗑️  Potentially unused files:\n";
    foreach ($orphans as $o) {
        echo "   · {$o}\n";
    }
    echo "\n⚠️  These files are not include/required by any other file.\n";
    echo "   Verify manually before deleting — dynamic includes may be missed.\n";
} else {
    echo "✅ No orphan files detected!\n";
}

// Don't fail CI — this is advisory only
exit(0);
