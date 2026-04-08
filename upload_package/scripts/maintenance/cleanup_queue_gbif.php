<?php

/**
 * cleanup_fast.php - curl_multi並列でGBIFバリデーション (20並列)
 */
require_once __DIR__ . '/../../config/config.php';

$queueFile = DATA_DIR . '/library/extraction_queue.json';
$queue = json_decode(file_get_contents($queueFile), true);

// Quick pre-filter (saves API calls)
function isObviousGarbage(string $name): ?string
{
    if (preg_match('/(概説|概論|総論|系統分類|続き)/u', $name)) return 'section_header';
    if (preg_match('/\b(Japan|bird|alien|singing|citizen)\b/i', $name)) return 'garbage';
    if (stripos($name, 'Unknown') !== false) return 'unknown';
    return null;
}

// Separate entries: skip completed/processing, pre-filter garbage, rest needs GBIF
$kept = [];
$removed = [];
$needsValidation = [];

foreach ($queue as $key => $entry) {
    $status = $entry['status'] ?? 'pending';

    // Keep completed/processing as-is
    if (in_array($status, ['completed', 'processing', 'fetching_lit'])) {
        $kept[$key] = $entry;
        continue;
    }

    $garbage = isObviousGarbage($key);
    if ($garbage) {
        $removed[] = ['name' => $key, 'reason' => $garbage, 'rank' => '-'];
        continue;
    }

    $needsValidation[$key] = $entry;
}

echo "Total: " . count($queue) . "\n";
echo "Pre-filtered garbage: " . count($removed) . "\n";
echo "Skipped (completed/processing): " . count($kept) . "\n";
echo "Needs GBIF validation: " . count($needsValidation) . "\n\n";

// curl_multi batch validation (20 parallel)
$BATCH_SIZE = 20;
$entries = array_keys($needsValidation);
$total = count($entries);
$processed = 0;

for ($i = 0; $i < $total; $i += $BATCH_SIZE) {
    $batch = array_slice($entries, $i, $BATCH_SIZE);
    $mh = curl_multi_init();
    $handles = [];

    foreach ($batch as $name) {
        $ch = curl_init();
        $url = "https://api.gbif.org/v1/species/match?name=" . urlencode($name) . "&strict=true";
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_USERAGENT => 'ikimon-platform/1.0',
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$name] = $ch;
    }

    // Execute all in parallel
    do {
        $status = curl_multi_exec($mh, $active);
        curl_multi_select($mh, 0.1);
    } while ($active > 0);

    // Process results
    foreach ($handles as $name => $ch) {
        $response = curl_multi_getcontent($ch);
        $result = json_decode($response, true) ?: ['matchType' => 'ERROR'];

        $matchType = $result['matchType'] ?? 'NONE';
        $rank = $result['rank'] ?? 'UNKNOWN';

        if ($matchType === 'NONE' || $matchType === 'ERROR') {
            $removed[] = ['name' => $name, 'reason' => 'gbif_no_match', 'rank' => $rank];
            echo "  ✗ [$rank] $name\n";
        } elseif (!in_array($rank, ['SPECIES', 'SUBSPECIES', 'VARIETY', 'FORM'])) {
            $removed[] = ['name' => $name, 'reason' => 'gbif_not_species', 'rank' => $rank];
            echo "  ✗ [$rank] $name\n";
        } else {
            // Valid! Enrich with GBIF data
            $entry = $needsValidation[$name];
            $canon = $result['canonicalName'] ?? $result['species'] ?? null;
            if ($canon && $canon !== $name) {
                $entry['gbif_canonical'] = $canon;
            }
            $entry['gbif_key'] = $result['usageKey'] ?? null;
            $kept[$name] = $entry;
        }

        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }

    curl_multi_close($mh);
    $processed += count($batch);

    if ($processed % 100 === 0 || $processed >= $total) {
        echo "  [$processed/$total validated]\n";
    }
}

echo "\n=== RESULTS ===\n";
echo "Kept:    " . count($kept) . "\n";
echo "Removed: " . count($removed) . "\n\n";

// Summary by reason
$byReason = [];
foreach ($removed as $r) {
    $byReason[$r['reason']][] = $r;
}
foreach ($byReason as $reason => $items) {
    echo "[$reason] (" . count($items) . ")\n";
    foreach (array_slice($items, 0, 5) as $item) {
        echo "  [{$item['rank']}] {$item['name']}\n";
    }
    if (count($items) > 5) echo "  ... +" . (count($items) - 5) . " more\n";
}

// Apply
if (in_array('--apply', $argv ?? [])) {
    $backup = $queueFile . '.backup.' . date('Ymd_His');
    copy($queueFile, $backup);
    echo "\nBackup: $backup\n";
    file_put_contents($queueFile, json_encode($kept, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo "Done! Queue: " . count($kept) . " entries\n";
} else {
    echo "\n(Dry run. Use --apply to execute)\n";
}
