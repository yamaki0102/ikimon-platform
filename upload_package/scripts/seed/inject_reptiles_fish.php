<?php

/**
 * inject_reptiles_fish.php - GBIF uses different keys for these
 * Reptilia doesn't exist as a class in GBIF backbone - need to use orders:
 *   Squamata (トカゲ・ヘビ): orderKey=715
 *   Testudines (カメ): orderKey=789
 *   Crocodylia (ワニ): orderKey=731
 * Fish: use phylumKey for Chordata + various class/order combos
 *   Actinopterygii: classKey=204 (maybe needs different approach)
 *   Chondrichthyes (サメ・エイ): classKey=121
 */
require_once __DIR__ . '/../config/config.php';

$queueFile = DATA_DIR . '/library/extraction_queue.json';
$fp = fopen($queueFile, 'c+');
if (!$fp || !flock($fp, LOCK_EX)) die("Cannot lock queue\n");
clearstatcache(true, $queueFile);
$sz = filesize($queueFile);
$queue = json_decode($sz > 0 ? fread($fp, $sz) : '', true) ?: [];
$before = count($queue);
echo "Current queue: {$before} entries\n\n";

// Try multiple keys for reptiles and fish
$taxa = [
    // Reptiles by order
    ['name' => 'トカゲ・ヘビ (Squamata)',   'key' => 'orderKey=715',   'source' => 'japanese_reptiles'],
    ['name' => 'カメ (Testudines)',          'key' => 'orderKey=789',   'source' => 'japanese_reptiles'],
    ['name' => 'ワニ (Crocodylia)',          'key' => 'orderKey=731',   'source' => 'japanese_reptiles'],
    // Fish
    ['name' => '硬骨魚 (Actinopterygii)',    'key' => 'classKey=204',   'source' => 'japanese_fish'],
    ['name' => 'サメ・エイ (Chondrichthyes)', 'key' => 'classKey=121',   'source' => 'japanese_fish'],
    // Also try taxon search approach
    ['name' => '爬虫類 (Reptilia taxon)',    'key' => 'taxonKey=358',   'source' => 'japanese_reptiles'],
];

$grandTotal = 0;

foreach ($taxa as $taxon) {
    echo "=== {$taxon['name']} ===\n";

    $url = "https://api.gbif.org/v1/occurrence/search?country=JP&{$taxon['key']}&limit=0&facet=speciesKey&facetLimit=5000";
    $ctx = stream_context_create(['http' => ['timeout' => 60]]);
    $response = @file_get_contents($url, false, $ctx);

    if (!$response) {
        echo "  ❌ Failed\n";
        continue;
    }
    $data = json_decode($response, true);
    if (!isset($data['facets'][0]['counts']) || empty($data['facets'][0]['counts'])) {
        echo "  ⚠ 0 species (count={$data['count']})\n";
        continue;
    }

    $keys = $data['facets'][0]['counts'];
    echo "  Got " . count($keys) . " species keys\n";

    $added = 0;
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
            }
        }
        curl_multi_close($mh);
    }

    echo "  ✅ Added: $added\n";
    $grandTotal += $added;
}

ftruncate($fp, 0);
fseek($fp, 0);
fwrite($fp, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

echo "\n========================================\n";
echo "Total new: $grandTotal\n";
echo "Queue: {$before} → " . count($queue) . "\n";
