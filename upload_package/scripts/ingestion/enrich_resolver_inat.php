<?php

/**
 * Enrich taxon_resolver.json with iNaturalist data
 * 
 * 既存resolverの各エントリに対してiNat APIで照合し、
 * inat_taxon_id, thumbnail_url, rank を補完する。
 * 
 * Usage:
 *   php scripts/enrich_resolver_inat.php              # ドライラン
 *   php scripts/enrich_resolver_inat.php --execute     # 本実行
 *   php scripts/enrich_resolver_inat.php --execute --limit=50  # 最初の50件だけ
 */
require_once __DIR__ . '/../config/config.php';

$dryRun = !in_array('--execute', $argv ?? []);
$limit = 0;
foreach ($argv ?? [] as $arg) {
    if (str_starts_with($arg, '--limit=')) {
        $limit = (int)substr($arg, 8);
    }
}

echo "=== Enrich Resolver with iNaturalist ===\n";
echo "Mode: " . ($dryRun ? "DRY RUN" : "EXECUTE") . "\n";
if ($limit > 0) echo "Limit: $limit entries\n";
echo "\n";

$resolverFile = DATA_DIR . '/taxon_resolver.json';
if (!file_exists($resolverFile)) {
    echo "ERROR: taxon_resolver.json not found. Run build_taxon_resolver.php first.\n";
    exit(1);
}

$data = json_decode(file_get_contents($resolverFile), true);
$taxa = $data['taxa'] ?? [];
$totalTaxa = count($taxa);
echo "Total taxa in resolver: $totalTaxa\n";

// Count already enriched
$alreadyEnriched = count(array_filter($taxa, fn($t) => !empty($t['inat_taxon_id'])));
echo "Already have iNat ID: $alreadyEnriched\n\n";

$enrichedCount = 0;
$skippedCount = 0;
$failedCount = 0;
$processed = 0;

foreach ($taxa as $slug => &$entry) {
    // Skip if already has iNat data
    if (!empty($entry['inat_taxon_id'])) {
        $skippedCount++;
        continue;
    }

    if ($limit > 0 && $processed >= $limit) break;

    $sciName = $entry['accepted_name'] ?? '';
    if (!$sciName) {
        $skippedCount++;
        continue;
    }

    // Query iNaturalist Taxa API
    $params = http_build_query([
        'q' => $sciName,
        'locale' => 'ja',
        'per_page' => 3,
    ]);
    $url = "https://api.inaturalist.org/v1/taxa/autocomplete?$params";

    $ctx = stream_context_create([
        'http' => [
            'timeout' => 10,
            'header' => "User-Agent: ikimon.life/1.0 (taxon-resolver-builder)\r\n",
        ]
    ]);

    $json = @file_get_contents($url, false, $ctx);
    if (!$json) {
        echo "  FAIL: $sciName (no response)\n";
        $failedCount++;
        $processed++;
        usleep(500000); // 0.5s on failure
        continue;
    }

    $result = json_decode($json, true);
    $results = $result['results'] ?? [];

    // Find exact match by scientific name
    $match = null;
    foreach ($results as $r) {
        if (strtolower($r['name'] ?? '') === strtolower($sciName)) {
            $match = $r;
            break;
        }
    }
    // If no exact match, use best result if rank is species/genus
    if (!$match && !empty($results)) {
        $first = $results[0];
        $rank = $first['rank'] ?? '';
        if (in_array($rank, ['species', 'genus', 'subspecies', 'variety', 'family', 'order'])) {
            $match = $first;
        }
    }

    if ($match) {
        $entry['inat_taxon_id'] = $match['id'];
        $entry['rank'] = $match['rank'] ?? ($entry['rank'] ?? 'species');
        if (!empty($match['default_photo']['square_url'])) {
            $entry['thumbnail_url'] = $match['default_photo']['square_url'];
        }
        if (!empty($match['preferred_common_name']) && empty($entry['ja_name'])) {
            $entry['ja_name'] = $match['preferred_common_name'];
        }
        if (!in_array('inat', $entry['sources'] ?? [])) {
            $entry['sources'][] = 'inat';
        }
        $enrichedCount++;
        echo "  ✓ $sciName → iNat #{$match['id']} ({$match['rank']})\n";
    } else {
        echo "  ✗ $sciName (no match in iNat)\n";
    }

    $processed++;

    // Rate limiting: 1 request per second (iNat rate limit is ~1req/sec)
    usleep(1100000); // 1.1 seconds

    // Progress every 50
    if ($processed % 50 === 0) {
        echo "  --- Progress: $processed processed, $enrichedCount enriched ---\n";
    }
}
unset($entry);

echo "\n=== Results ===\n";
echo "Processed: $processed\n";
echo "Enriched:  $enrichedCount\n";
echo "Skipped:   $skippedCount\n";
echo "Failed:    $failedCount\n";

if (!$dryRun && $enrichedCount > 0) {
    // Update stats
    $data['taxa'] = $taxa;
    $data['stats']['with_inat_id'] = count(array_filter($taxa, fn($t) => !empty($t['inat_taxon_id'])));
    $data['stats']['with_thumbnail'] = count(array_filter($taxa, fn($t) => !empty($t['thumbnail_url'])));
    $data['enriched_at'] = date('c');

    file_put_contents($resolverFile, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo "\n💾 Resolver updated. iNat enriched: {$data['stats']['with_inat_id']}, with thumbnails: {$data['stats']['with_thumbnail']}\n";
} elseif ($dryRun) {
    echo "\n🔍 DRY RUN — no changes written.\n";

    // Show sample
    echo "\n=== Sample Enrichments ===\n";
    $sample = 0;
    foreach ($taxa as $slug => $entry) {
        if (!empty($entry['inat_taxon_id'])) {
            echo "  $slug: iNat #{$entry['inat_taxon_id']}, rank={$entry['rank']}, thumb=" . ($entry['thumbnail_url'] ?? 'none') . "\n";
            if (++$sample >= 5) break;
        }
    }
}
