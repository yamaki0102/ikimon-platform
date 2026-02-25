<?php

/**
 * Debug: Test Wikidata API call and all pipeline steps
 */
require_once __DIR__ . '/../config/config.php';

$testSpecies = 'Bucephala clangula';
echo "=== Testing pipeline for: {$testSpecies} ===\n\n";

// 1. Test raw HTTP access to Wikidata
$url = "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=" . urlencode($testSpecies) . "&language=en&type=item&limit=1&format=json";
echo "Step 0: Wikidata URL: {$url}\n";

$ctx = stream_context_create(['http' => [
    'header' => "User-Agent: OmoikaneBot/2.0 (ikimon.life; mailto:admin@ikimon.life)\r\n",
    'timeout' => 15,
]]);

$result = @file_get_contents($url, false, $ctx);
if ($result === false) {
    echo "  FAILED! file_get_contents returned false\n";
    $err = error_get_last();
    echo "  Error: " . ($err['message'] ?? 'unknown') . "\n";

    // Try with curl
    echo "\n  Trying with curl_exec instead...\n";
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERAGENT, 'OmoikaneBot/2.0 (ikimon.life)');
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        $curlResult = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);
        echo "  Curl HTTP Code: {$httpCode}\n";
        echo "  Curl Error: " . ($curlErr ?: 'none') . "\n";
        echo "  Curl Result (first 500): " . substr($curlResult ?: 'NULL', 0, 500) . "\n";
    } else {
        echo "  curl not available!\n";
    }
} else {
    echo "  SUCCESS! Got " . strlen($result) . " bytes\n";
    $data = json_decode($result, true);
    $entities = $data['search'] ?? [];
    echo "  Entities found: " . count($entities) . "\n";
    if (!empty($entities)) {
        $qid = $entities[0]['id'] ?? '';
        $label = $entities[0]['label'] ?? '';
        echo "  First match: {$qid} = {$label}\n";

        // Get Japanese label
        $labelUrl = "https://www.wikidata.org/w/api.php?action=wbgetentities&ids={$qid}&props=labels&languages=ja&format=json";
        $labelResult = @file_get_contents($labelUrl, false, $ctx);
        if ($labelResult) {
            $labelData = json_decode($labelResult, true);
            $jaName = $labelData['entities'][$qid]['labels']['ja']['value'] ?? '';
            echo "  Japanese name: " . ($jaName ?: 'NOT FOUND') . "\n";
        }
    }
}

// 2. Test Wikipedia
echo "\nStep 1: Wikipedia JA (direct scientific name)...\n";
$wikiUrl = "https://ja.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=" . urlencode($testSpecies) . "&format=json";
$wikiResult = @file_get_contents($wikiUrl, false, $ctx);
if ($wikiResult) {
    $wikiData = json_decode($wikiResult, true);
    $pages = $wikiData['query']['pages'] ?? [];
    foreach ($pages as $pid => $page) {
        $hasExtract = ($pid != -1 && !empty($page['extract']));
        echo "  Page {$pid}: " . ($hasExtract ? "HIT - " . mb_strimwidth($page['extract'], 0, 100, '...') : "MISS") . "\n";
    }
} else {
    echo "  FAILED!\n";
}

// 3. Test GBIF
echo "\nStep 3: GBIF Species Match...\n";
$gbifUrl = "https://api.gbif.org/v1/species/match?name=" . urlencode($testSpecies) . "&strict=true";
$gbifResult = @file_get_contents($gbifUrl, false, $ctx);
if ($gbifResult) {
    $gbifData = json_decode($gbifResult, true);
    $usageKey = $gbifData['usageKey'] ?? null;
    echo "  usageKey: " . ($usageKey ?: 'NOT FOUND') . "\n";
    if ($usageKey) {
        $descUrl = "https://api.gbif.org/v1/species/{$usageKey}/descriptions?limit=5";
        $descResult = @file_get_contents($descUrl, false, $ctx);
        if ($descResult) {
            $descData = json_decode($descResult, true);
            $descs = $descData['results'] ?? [];
            echo "  Descriptions: " . count($descs) . "\n";
            foreach (array_slice($descs, 0, 2) as $d) {
                $text = strip_tags($d['description'] ?? '');
                echo "    - " . mb_strimwidth($text, 0, 120, '...') . "\n";
            }
        }
    }
} else {
    echo "  FAILED!\n";
}

echo "\n=== PHP openssl extensions ===\n";
echo "openssl: " . (extension_loaded('openssl') ? 'YES' : 'NO') . "\n";
echo "allow_url_fopen: " . ini_get('allow_url_fopen') . "\n";

echo "\n=== Done ===\n";
