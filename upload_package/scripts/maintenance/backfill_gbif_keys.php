<?php

/**
 * GBIF Key Backfill
 * 
 * Reads taxon_resolver.json, finds entries with gbif_key=null,
 * queries GBIF Species API to get taxon keys, and updates the resolver.
 * 
 * Usage: php scripts/backfill_gbif_keys.php [--dry-run] [--limit=N]
 */
require_once __DIR__ . '/../config/config.php';

$dryRun = in_array('--dry-run', $argv ?? []);
$limit = 0;
foreach ($argv ?? [] as $arg) {
    if (preg_match('/^--limit=(\d+)$/', $arg, $m)) {
        $limit = (int) $m[1];
    }
}

echo "=== GBIF Key Backfill ===\n";
if ($dryRun) echo "[DRY RUN MODE]\n";

$resolverFile = DATA_DIR . '/taxon_resolver.json';
$resolver = json_decode(file_get_contents($resolverFile), true);

if (!$resolver || empty($resolver['taxa'])) {
    die("ERROR: Cannot read resolver\n");
}

// Find entries needing GBIF key
$needsKey = [];
foreach ($resolver['taxa'] as $slug => $data) {
    if (empty($data['gbif_key']) && !empty($data['accepted_name'])) {
        $needsKey[$slug] = $data['accepted_name'];
    }
}

echo "Entries needing GBIF key: " . count($needsKey) . "\n";

if ($limit > 0) {
    $needsKey = array_slice($needsKey, 0, $limit, true);
    echo "Processing limit: $limit\n";
}

$found = 0;
$notFound = 0;
$errors = 0;
$processed = 0;

foreach ($needsKey as $slug => $sciName) {
    $processed++;
    $url = 'https://api.gbif.org/v1/species/match?name=' . urlencode($sciName) . '&strict=false';

    $ctx = stream_context_create([
        'http' => [
            'timeout' => 10,
            'header' => "User-Agent: ikimon.life/1.0 (biodiversity platform)\r\n"
        ]
    ]);

    $response = @file_get_contents($url, false, $ctx);

    if (!$response) {
        echo "  [$processed] ERROR: $sciName - no response\n";
        $errors++;
        usleep(500000); // 0.5s backoff
        continue;
    }

    $data = json_decode($response, true);

    if (!$data || ($data['matchType'] ?? '') === 'NONE') {
        echo "  [$processed] MISS: $sciName\n";
        $notFound++;
        usleep(200000); // 0.2s
        continue;
    }

    $key = $data['usageKey'] ?? null;
    $status = $data['status'] ?? '';
    $matchType = $data['matchType'] ?? '';
    $matchedName = $data['canonicalName'] ?? $data['species'] ?? '';

    if ($key) {
        echo "  [$processed] HIT: $sciName → key=$key ($matchType, $status)\n";

        if (!$dryRun) {
            $resolver['taxa'][$slug]['gbif_key'] = $key;

            // If GBIF says it's a synonym, record the accepted name
            if ($status === 'SYNONYM' && !empty($data['acceptedUsageKey'])) {
                $resolver['taxa'][$slug]['gbif_accepted_key'] = $data['acceptedUsageKey'];
            }
        }
        $found++;
    } else {
        echo "  [$processed] MISS: $sciName (no usageKey)\n";
        $notFound++;
    }

    // Rate limit: 10 req/sec max → 100ms minimum
    usleep(150000); // 0.15s
}

// Recalculate stats
$withKey = count(array_filter($resolver['taxa'], fn($r) => !empty($r['gbif_key'])));
$resolver['stats']['with_gbif_key'] = $withKey;

if (!$dryRun && $found > 0) {
    file_put_contents($resolverFile, json_encode($resolver, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo "\nResolver updated and saved.\n";
}

echo "\n=== RESULT ===\n";
echo "Processed: $processed\n";
echo "Found: $found\n";
echo "Not found: $notFound\n";
echo "Errors: $errors\n";
echo "Total with GBIF key: $withKey / " . count($resolver['taxa']) . "\n";
