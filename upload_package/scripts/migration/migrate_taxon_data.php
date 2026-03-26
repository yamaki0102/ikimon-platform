<?php

/**
 * Phase B: 既存観察データ taxon enrichment マイグレーション
 * 
 * 全観察の taxon フィールドに rank/source/thumbnail_url/inat_taxon_id を後付けする。
 * 
 * Usage:
 *   php scripts/migrate_taxon_data.php              # ドライラン（変更なし）
 *   php scripts/migrate_taxon_data.php --execute     # 本実行
 *   php scripts/migrate_taxon_data.php --execute --skip-api  # APIコールなし（ローカルのみ）
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/TaxonSearchService.php';

$dryRun = !in_array('--execute', $argv ?? []);
$skipApi = in_array('--skip-api', $argv ?? []);
$legacyOnly = in_array('--legacy-only', $argv ?? []);

echo "=== Taxon Data Migration ===\n";
echo "Mode: " . ($dryRun ? "DRY RUN (no changes)" : "EXECUTE") . "\n";
echo "API: " . ($skipApi ? "SKIP (local only)" : "ENABLED (iNat + GBIF)") . "\n";
echo "Target: " . ($legacyOnly ? "LEGACY ONLY (re-enrich source=legacy)" : "ALL without source") . "\n\n";

// Load resolver for local lookups
$resolverFile = DATA_DIR . '/taxon_resolver.json';
$resolver = [];
$jpIndex = [];
if (file_exists($resolverFile)) {
    $resolverData = json_decode(file_get_contents($resolverFile), true);
    $resolver = $resolverData['taxa'] ?? [];
    $jpIndex = $resolverData['jp_index'] ?? [];
}
echo "Local resolver: " . count($resolver) . " taxa, " . count($jpIndex) . " JP names\n\n";

// Load all observations
$obs = DataStore::fetchAll('observations');
echo "Total observations: " . count($obs) . "\n\n";

$stats = [
    'total' => count($obs),
    'already_enriched' => 0,
    'enriched_local' => 0,
    'enriched_api' => 0,
    'marked_legacy' => 0,
    'skipped_no_taxon' => 0,
    'errors' => 0,
];

$modified = [];
$apiCallCount = 0;

foreach ($obs as $i => $o) {
    $taxon = $o['taxon'] ?? [];

    // Skip observations without any taxon info
    if (empty($taxon) || (empty($taxon['name']) && empty($taxon['slug']) && empty($taxon['scientific_name']))) {
        $stats['skipped_no_taxon']++;
        continue;
    }

    // Skip already enriched observations (have source field)
    if (!empty($taxon['source'])) {
        // legacy-onlyモード: source=legacy のみ再処理
        if ($legacyOnly && $taxon['source'] === 'legacy') {
            // 再処理対象 → continue しない
            // sourceをクリアして再判定させる
            unset($taxon['source']);
        } else {
            $stats['already_enriched']++;
            continue;
        }
    }

    // Get search query: try slug (scientific name), then Japanese name
    $slug = $taxon['slug'] ?? '';
    $jaName = $taxon['name'] ?? '';
    $sciName = $taxon['scientific_name'] ?? '';

    $enriched = false;

    // --- Strategy 1: Local resolver lookup by slug ---
    if ($slug && isset($resolver[$slug])) {
        $local = $resolver[$slug];
        $taxon['rank'] = $taxon['rank'] ?? ($local['rank'] ?? 'species');
        $taxon['source'] = 'local';
        if (!empty($local['gbif_key']) && empty($taxon['id'])) {
            $taxon['id'] = (int)$local['gbif_key'];
        }
        $enriched = true;
        $stats['enriched_local']++;
    }

    // --- Strategy 2: Local resolver lookup by Japanese name ---
    if (!$enriched && $jaName && isset($jpIndex[$jaName])) {
        $resolvedSlug = $jpIndex[$jaName];
        if (!str_starts_with($resolvedSlug, '__jp__') && isset($resolver[$resolvedSlug])) {
            $local = $resolver[$resolvedSlug];
            $taxon['slug'] = $resolvedSlug;
            $taxon['scientific_name'] = $local['accepted_name'] ?? $sciName;
            $taxon['rank'] = $taxon['rank'] ?? ($local['rank'] ?? 'species');
            $taxon['source'] = 'local';
            if (!empty($local['gbif_key']) && empty($taxon['id'])) {
                $taxon['id'] = (int)$local['gbif_key'];
            }
            $enriched = true;
            $stats['enriched_local']++;
        }
    }

    // --- Strategy 3: API lookup (iNat → GBIF) ---
    if (!$enriched && !$skipApi) {
        $query = $jaName ?: ($sciName ?: str_replace('-', ' ', $slug));
        if ($query) {
            try {
                $results = TaxonSearchService::search($query, ['limit' => 1]);
                if (!empty($results)) {
                    $match = $results[0];
                    $taxon['rank'] = $match['rank'] ?? 'species';
                    $taxon['source'] = $match['source'] ?? 'inat';
                    $taxon['thumbnail_url'] = $match['thumbnail_url'] ?? null;
                    $taxon['inat_taxon_id'] = $match['inat_taxon_id'] ?? null;
                    if (!empty($match['slug'])) {
                        $taxon['slug'] = $match['slug'];
                    }
                    if (!empty($match['scientific_name']) && empty($taxon['scientific_name'])) {
                        $taxon['scientific_name'] = $match['scientific_name'];
                    }
                    $enriched = true;
                    $stats['enriched_api']++;
                }
                $apiCallCount++;
                // Rate limiting: 1 second between API calls
                if ($apiCallCount % 5 === 0) {
                    usleep(1000000); // 1 second every 5 calls
                }
            } catch (Exception $e) {
                echo "  ERROR on obs {$o['id']}: {$e->getMessage()}\n";
                $stats['errors']++;
            }
        }
    }

    // --- Fallback: mark as legacy ---
    if (!$enriched) {
        $taxon['source'] = 'legacy';
        $taxon['rank'] = $taxon['rank'] ?? 'species';
        $stats['marked_legacy']++;
    }

    // Store updated observation
    $o['taxon'] = $taxon;
    $modified[] = $o;

    // Progress indicator
    if (($i + 1) % 100 === 0) {
        echo "  Processed: " . ($i + 1) . "/" . count($obs) . " (API calls: $apiCallCount)\n";
    }
}

echo "\n=== Results ===\n";
echo "Already enriched: {$stats['already_enriched']}\n";
echo "Enriched (local): {$stats['enriched_local']}\n";
echo "Enriched (API):   {$stats['enriched_api']}\n";
echo "Marked legacy:    {$stats['marked_legacy']}\n";
echo "Skipped (no taxon): {$stats['skipped_no_taxon']}\n";
echo "Errors:           {$stats['errors']}\n";
echo "Total modified:   " . count($modified) . "\n";

if ($dryRun) {
    echo "\n🔍 DRY RUN — no changes written.\n";
    echo "Run with --execute to apply changes.\n";

    // Show 3 sample modifications
    echo "\n=== Sample Modifications ===\n";
    foreach (array_slice($modified, 0, 3) as $o) {
        echo "--- {$o['id']} ---\n";
        echo json_encode($o['taxon'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    }
} else {
    // Apply changes: update observations in DataStore
    echo "\n💾 Writing changes...\n";

    // Build ID->observation map for bulk update
    $allObs = DataStore::fetchAll('observations');
    $idMap = [];
    foreach ($modified as $m) {
        $idMap[$m['id']] = $m;
    }

    // Update in place
    $updated = 0;
    foreach ($allObs as &$o) {
        if (isset($idMap[$o['id']])) {
            $o['taxon'] = $idMap[$o['id']]['taxon'];
            $updated++;
        }
    }
    unset($o);

    // Save back via partition-aware method
    // DataStore uses file-per-partition, so we need to save per-partition
    $partitions = [];
    foreach ($allObs as $o) {
        $date = $o['observed_at'] ?? $o['created_at'] ?? date('Y-m-d');
        $month = substr($date, 0, 7); // YYYY-MM
        $partitions[$month][] = $o;
    }

    foreach ($partitions as $month => $items) {
        $file = DATA_DIR . "/observations/$month.json";
        $dir = dirname($file);
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        file_put_contents($file, json_encode($items, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    echo "✅ Updated $updated observations across " . count($partitions) . " partitions.\n";
}
