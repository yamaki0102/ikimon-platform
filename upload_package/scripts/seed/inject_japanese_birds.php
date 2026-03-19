<?php

/**
 * inject_japanese_birds.php (v4 - Fast parallel key resolution)
 * Step 1: Single API call to get all 1040 speciesKeys
 * Step 2: Parallel curl (multi_curl) to resolve keys to names
 */

require_once __DIR__ . '/../config/config.php';

$queueFile = DATA_DIR . '/library/extraction_queue.json';
$queue = file_exists($queueFile) ? json_decode(file_get_contents($queueFile), true) : [];
$before = count($queue);

echo "Current queue size: {$before}\n";
echo "Step 1: Fetching all Japanese bird speciesKeys (single API call)...\n";

$url = "https://api.gbif.org/v1/occurrence/search?country=JP&classKey=212&limit=0&facet=speciesKey&facetLimit=5000";
$ctx = stream_context_create(['http' => ['timeout' => 30]]);
$response = @file_get_contents($url, false, $ctx);

if (!$response) die("Failed to fetch facets.\n");
$data = json_decode($response, true);
if (!isset($data['facets'][0]['counts'])) die("No facet data.\n");

$allKeys = $data['facets'][0]['counts'];
echo "Got " . count($allKeys) . " species keys.\n";

echo "Step 2: Resolving speciesKeys to names using parallel curl (batches of 50)...\n";

$totalAdded = 0;
$chunks = array_chunk($allKeys, 50);

foreach ($chunks as $chunkIdx => $chunk) {
    $mh = curl_multi_init();
    $handles = [];

    foreach ($chunk as $facet) {
        $key = $facet['name'];
        $occ = $facet['count'];
        $ch = curl_init("https://api.gbif.org/v1/species/{$key}");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_multi_add_handle($mh, $ch);
        $handles[] = ['ch' => $ch, 'key' => $key, 'occ' => $occ];
    }

    // Execute all in parallel
    do {
        $status = curl_multi_exec($mh, $running);
        curl_multi_select($mh);
    } while ($running > 0);

    foreach ($handles as $h) {
        $resp = curl_multi_getcontent($h['ch']);
        curl_multi_remove_handle($mh, $h['ch']);
        curl_close($h['ch']);

        if (!$resp) continue;
        $sp = json_decode($resp, true);
        $name = $sp['canonicalName'] ?? null;
        if (!$name || strpos($name, ' ') === false) continue;

        if (!isset($queue[$name])) {
            $queue[$name] = [
                'species_name' => $name,
                'status' => 'pending',
                'source' => 'japanese_birds_milestone',
                'gbif_key' => (int)$h['key'],
                'occurrence_count_jp' => $h['occ'],
                'retries' => 0,
                'last_processed_at' => null,
                'error_message' => null
            ];
            $totalAdded++;
        }
    }

    curl_multi_close($mh);
    echo "  Batch " . ($chunkIdx + 1) . "/" . count($chunks) . " done. +{$totalAdded} total new.\n";
}

file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo "\nDone! Added {$totalAdded} new Japanese Bird species.\n";
echo "Queue size: {$before} -> " . count($queue) . "\n";
