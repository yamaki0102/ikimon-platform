<?php

/**
 * HTML Structure Checker for ikimon.life
 * ──────────────────────────────────────
 * PHPテンプレートのHTML構造問題を静的解析で検出する。
 */

$ROOT = dirname(__DIR__) . '/upload_package/public_html';

$files = [];
if ($argc > 1) {
    for ($i = 1; $i < $argc; $i++) {
        $files[] = realpath($argv[$i]) ?: $argv[$i];
    }
} else {
    $files = glob($ROOT . '/*.php');
}

$totalErrors   = 0;
$totalWarnings = 0;

foreach ($files as $filePath) {
    if (!is_file($filePath)) continue;
    $basename = basename($filePath);
    if (in_array($basename, ['logout.php'])) continue;

    $content = file_get_contents($filePath);
    if ($content === false) continue;

    // ── Pre-process: Mask PHP, Comments, Script, Style ──
    $mask = function ($m) {
        return preg_replace('/[^\n]/', ' ', $m[0]);
    };
    $cleanContent = preg_replace_callback('/(<\?(?:php|=)?.*?\?>|<!--.*?-->|<script\b[^>]*>.*?<\/script>|<style\b[^>]*>.*?<\/style>)/is', $mask, $content);

    // ── Second Pass: Mask quoted attributes to handle '>' inside attributes (e.g. @click="x=>y") ──
    $cleanContentForTags = preg_replace_callback('/([a-z0-9:-]+)=(?:"[^"]*"|\'[^\']*\')/i', function ($m) {
        return preg_replace('/>/', ' ', $m[0]);
    }, $cleanContent);

    $errors   = [];
    $warnings = [];

    // ── Check 1: Tag Balance ──
    // Match ALL tags but ignore void tags during processing
    preg_match_all('/<([a-z0-9-]+)\b[^>]*>/is', $cleanContentForTags, $opens, PREG_OFFSET_CAPTURE);
    preg_match_all('/<\/([a-z0-9-]+)>/is', $cleanContentForTags, $closes, PREG_OFFSET_CAPTURE);

    $voidTags = ['br', 'img', 'hr', 'input', 'link', 'meta', 'source', 'area', 'base', 'col', 'embed', 'keygen', 'param', 'track', 'wbr'];

    $tags = [];
    foreach ($opens[1] as $index => $match) {
        $fullTag = $opens[0][$index][0];
        $tagName = strtolower($match[0]);
        if (in_array($tagName, $voidTags)) continue;
        if (str_ends_with(trim($fullTag, " \t\n\r\0\x0B>"), '/')) continue; // Self-closing <tag />

        $tags[] = [
            'type' => 'open',
            'name' => $tagName,
            'line' => substr_count(substr($content, 0, $opens[0][$index][1]), "\n") + 1,
            'pos' => $opens[0][$index][1],
            'raw_tag' => $fullTag
        ];
    }
    foreach ($closes[1] as $index => $match) {
        $tagName = strtolower($match[0]);
        if (in_array($tagName, $voidTags)) continue;

        $tags[] = [
            'type' => 'close',
            'name' => $tagName,
            'line' => substr_count(substr($content, 0, $closes[0][$index][1]), "\n") + 1,
            'pos' => $closes[0][$index][1],
            'raw_tag' => $closes[0][$index][0] // Store the full raw tag for error messages
        ];
    }
    usort($tags, function ($a, $b) {
        return $a['pos'] <=> $b['pos'];
    });

    $stack = [];
    foreach ($tags as $tagInfo) {
        $tagName = $tagInfo['name'];
        $line = $tagInfo['line'];
        $rawTag = $tagInfo['raw_tag'];

        if ($tagInfo['type'] === 'open') {
            $stack[] = ['name' => $tagName, 'line' => $line, 'raw_tag' => $rawTag];
        } else {
            if (empty($stack)) {
                $errors[] = "EXTRA_CLOSE_TAG: Tag </$tagName> (extracted from $rawTag) on line $line has no matching start tag.";
            } else {
                $last = array_pop($stack);
                if ($tagName !== $last['name']) {
                    $errors[] = "CLOSE_TAG_MISMATCH: Tag <{$last['name']}> (extracted from {$last['raw_tag']}) on line {$last['line']} closed by </$tagName> (extracted from $rawTag) on line $line";
                }
            }
        }
    }

    foreach ($stack as $unclosed) {
        $errors[] = "UNCLOSED_TAG: Tag <{$unclosed['name']}> on line {$unclosed['line']} was never closed.";
    }

    // ── Check 2: Design Standard Warnings ──
    if (strpos($content, '<!DOCTYPE html>') !== false) {
        if (strpos($content, 'components/meta.php') === false) {
            $warnings[] = "MISSING_META_COMPONENT: Page has DOCTYPE but doesn't include components/meta.php";
        }
    }
    if (strpos($content, 'cdn.tailwindcss.com') !== false) {
        $warnings[] = "TAILWIND_CDN_USED: Should use assets/css/ instead of debug CDN.";
    }
    if (strpos($content, 'CspNonce::attr()') === false && strpos($content, '<script') !== false) {
        $warnings[] = "MISSING_CSP_NONCE: Script tag found but CspNonce::attr() is missing.";
    }

    if (!empty($errors) || !empty($warnings)) {
        echo "📂 {$basename}:\n";
        foreach ($errors as $e) {
            echo "  ❌ ERROR: $e\n";
            $totalErrors++;
        }
        foreach ($warnings as $w) {
            echo "  ⚠️  WARN: $w\n";
            $totalWarnings++;
        }
    }
}

echo "\n📊 Checks complete: " . count($files) . " files\n";
echo "   ❌ Errors:   $totalErrors\n";
echo "   ⚠️  Warnings: $totalWarnings\n";

if ($totalErrors > 0) exit(1);
exit(0);
