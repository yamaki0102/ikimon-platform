<?php

/**
 * inject_japanese_fauna.php - Inject multiple taxa from GBIF
 * Uses faceted occurrence search to find all species observed in Japan
 * 
 * GBIF Higher Taxon Keys:
 *   Mammalia (哺乳類): classKey=359
 *   Reptilia (爬虫類): classKey=358
 *   Amphibia (両生類): classKey=131
 *   Actinopterygii (条鰭綱/魚類): classKey=204
 *   Insecta (昆虫): classKey=216
 *   Arachnida (クモ類): classKey=367
 *   Gastropoda (巻貝): classKey=225
 *   Malacostraca (甲殻類): classKey=229
 */

require_once __DIR__ . '/../config/config.php';

$queueFile = DATA_DIR . '/library/extraction_queue.json';

// Lock queue for safe read/write
$fp = fopen($queueFile, 'c+');
if (!$fp || !flock($fp, LOCK_EX)) die("Cannot lock queue\n");
clearstatcache(true, $queueFile);
$sz = filesize($queueFile);
$queue = json_decode($sz > 0 ? fread($fp, $sz) : '', true) ?: [];
$before = count($queue);
echo "Current queue: {$before} entries\n\n";

// Taxa to inject (植物は除外 - 後回し)
$taxa = [
    ['name' => '哺乳類 (Mammalia)',      'classKey' => 359, 'source' => 'japanese_mammals'],
    ['name' => '爬虫類 (Reptilia)',       'classKey' => 358, 'source' => 'japanese_reptiles'],
    ['name' => '両生類 (Amphibia)',       'classKey' => 131, 'source' => 'japanese_amphibians'],
    ['name' => '魚類 (Actinopterygii)',   'classKey' => 204, 'source' => 'japanese_fish'],
    ['name' => '昆虫 (Insecta)',          'classKey' => 216, 'source' => 'japanese_insects'],
    ['name' => 'クモ類 (Arachnida)',      'classKey' => 367, 'source' => 'japanese_arachnids'],
    ['name' => '甲殻類 (Malacostraca)',   'classKey' => 229, 'source' => 'japanese_crustaceans'],
];

$grandTotal = 0;

foreach ($taxa as $taxon) {
    echo "=== {$taxon['name']} ===\n";

    // Fetch speciesKeys via GBIF faceted search
    $url = "https://api.gbif.org/v1/occurrence/search?country=JP&classKey={$taxon['classKey']}&limit=0&facet=speciesKey&facetLimit=5000";
    $ctx = stream_context_create(['http' => ['timeout' => 60]]);
    $response = @file_get_contents($url, false, $ctx);

    if (!$response) {
        echo "  ❌ Failed to fetch from GBIF\n";
        continue;
    }
    $data = json_decode($response, true);
    if (!isset($data['facets'][0]['counts'])) {
        echo "  ❌ No facet data\n";
        continue;
    }

    $keys = $data['facets'][0]['counts'];
    echo "  Got " . count($keys) . " species keys\n";

    // Resolve keys to names in parallel batches
    $added = 0;
    $skipped = 0;
    $chunks = array_chunk($keys, 50);

    foreach ($chunks as $chunk) {
        $mh = curl_multi_init();
        $handles = [];

        foreach ($chunk as $facet) {
            $ch = curl_init("https://api.gbif.org/v1/species/{$facet['name']}");
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            curl_multi_add_handle($mh, $ch);
            $handles[] = ['ch' => $ch, 'key' => $facet['name'], 'occ' => $facet['count']];
        }

        do {
            curl_multi_exec($mh, $running);
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
                    'source' => $taxon['source'],
                    'gbif_key' => (int)$h['key'],
                    'occurrence_count_jp' => $h['occ'],
                    'retries' => 0,
                    'last_processed_at' => null,
                    'error_message' => null
                ];
                $added++;
            } else {
                $skipped++;
            }
        }
        curl_multi_close($mh);
    }

    echo "  ✅ Added: $added, Already in queue: $skipped\n";
    $grandTotal += $added;
}

// Write back
ftruncate($fp, 0);
fseek($fp, 0);
fwrite($fp, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

// Also backup
copy($queueFile, $queueFile . '.backup.' . date('Ymd_His'));

echo "\n========================================\n";
echo "Total new species added: $grandTotal\n";
echo "Queue: {$before} → " . count($queue) . "\n";
echo "Backup saved.\n";
