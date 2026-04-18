<?php
/**
 * Omoikane — Mark Japan-Observed Species & Enqueue for Enrichment
 *
 * GBIF Occurrence API の facets を使って、日本で実際に観察された種を特定し
 * ExtractionQueue に pending として追加する。
 *
 * 使い方:
 *   php mark_japan_species.php                 # フル実行
 *   php mark_japan_species.php --dry-run       # カウントのみ
 *   php mark_japan_species.php --skip-enqueue  # OmoikaneDBの更新のみ（キュー追加なし）
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/OmoikaneDB.php';
require_once __DIR__ . '/../../libs/ExtractionQueue.php';

$opts = getopt('', ['dry-run', 'skip-enqueue']);
$dryRun = isset($opts['dry-run']);
$skipEnqueue = isset($opts['skip-enqueue']);

echo "=== Japan Species Marker ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
if ($dryRun) echo "*** DRY RUN ***\n";
echo "\n";

// ── Step 1: Fetch Japan species facets from GBIF ──
echo "[1/3] Fetching Japan occurrence facets from GBIF...\n";
echo "  This may take a minute (requesting up to 999,999 facets)...\n";

$facetUrl = 'https://api.gbif.org/v1/occurrence/search?'
    . http_build_query([
        'country' => 'JP',
        'limit'   => 0,
        'facet'   => 'speciesKey',
        'facetLimit' => 999999,
    ]);

$ch = curl_init($facetUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 300,
    CURLOPT_HTTPHEADER => ['Accept: application/json'],
]);
$resp = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$resp) {
    die("ERROR: GBIF API returned HTTP $httpCode\n");
}

$data = json_decode($resp, true);
$facets = $data['facets'][0]['counts'] ?? [];
echo "  Species with occurrences in Japan: " . number_format(count($facets)) . "\n\n";

if (empty($facets)) {
    die("ERROR: No facets returned. Check GBIF API.\n");
}

// Build speciesKey → count map
$jpSpecies = [];
foreach ($facets as $f) {
    $jpSpecies[(int)$f['name']] = (int)$f['count'];
}

// ── Step 2: Resolve speciesKey → scientific_name via GBIF Species API ──
echo "[2/3] Resolving species keys to names and updating OmoikaneDB...\n";

$db = new OmoikaneDB();
$pdo = $db->getPDO();

// First, try to match via gbif_taxon_id already in our DB
$existingStmt = $pdo->prepare("SELECT scientific_name FROM species WHERE gbif_taxon_id = :gid");
$updateStmt = $pdo->prepare("UPDATE species SET knowledge_coverage = CASE WHEN knowledge_coverage = 'none' THEN 'none' ELSE knowledge_coverage END WHERE gbif_taxon_id = :gid");

// For species not in DB, we need to batch-resolve via GBIF API
$keysToResolve = [];
$matchedInDb = 0;
$japanSpeciesNames = [];

foreach ($jpSpecies as $speciesKey => $occCount) {
    $existingStmt->execute([':gid' => $speciesKey]);
    $name = $existingStmt->fetchColumn();
    if ($name) {
        $matchedInDb++;
        $japanSpeciesNames[] = ['name' => $name, 'gbif_key' => $speciesKey, 'occ_count' => $occCount];
    } else {
        $keysToResolve[$speciesKey] = $occCount;
    }
}

echo "  Already in OmoikaneDB: " . number_format($matchedInDb) . "\n";
echo "  Need GBIF API resolve: " . number_format(count($keysToResolve)) . "\n";

// Batch-resolve unknown species keys via GBIF Species API (curl_multi for speed)
$resolved = 0;
$resolveErrors = 0;
$batchKeys = array_keys($keysToResolve);
$totalToResolve = count($batchKeys);

$insertStmt = $pdo->prepare(
    "INSERT OR IGNORE INTO species (scientific_name, gbif_taxon_id, catalog_source, distillation_status, kingdom, phylum, class_name, order_name, family)
     VALUES (:name, :gid, 'gbif_jp_occurrence', 'catalog', :kingdom, :phylum, :class, :order, :family)"
);

$concurrency = 20;
for ($i = 0; $i < $totalToResolve; $i += $concurrency) {
    $chunk = array_slice($batchKeys, $i, $concurrency);
    $mh = curl_multi_init();
    $handles = [];

    foreach ($chunk as $key) {
        $ch = curl_init("https://api.gbif.org/v1/species/$key");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$key] = $ch;
    }

    $running = null;
    do {
        curl_multi_exec($mh, $running);
        curl_multi_select($mh, 1);
    } while ($running > 0);

    if (!$dryRun) {
        $pdo->beginTransaction();
    }

    foreach ($handles as $key => $ch) {
        $resp = curl_multi_getcontent($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);

        if ($httpCode !== 200 || !$resp) {
            $resolveErrors++;
            continue;
        }

        $sp = json_decode($resp, true);
        $name = $sp['canonicalName'] ?? $sp['species'] ?? '';
        if (empty($name) || substr_count(trim($name), ' ') !== 1) {
            $resolveErrors++;
            continue;
        }

        if (!$dryRun) {
            $insertStmt->execute([
                ':name'    => $name,
                ':gid'     => $key,
                ':kingdom' => $sp['kingdom'] ?? '',
                ':phylum'  => $sp['phylum'] ?? '',
                ':class'   => $sp['class'] ?? '',
                ':order'   => $sp['order'] ?? '',
                ':family'  => $sp['family'] ?? '',
            ]);
        }

        $japanSpeciesNames[] = ['name' => $name, 'gbif_key' => $key, 'occ_count' => $keysToResolve[$key]];
        $resolved++;
    }

    if (!$dryRun) {
        $pdo->commit();
    }

    curl_multi_close($mh);
    usleep(100000); // 100ms between batches

    if (($i + $concurrency) % 500 < $concurrency) {
        echo "  Resolved: " . number_format($resolved) . " / " . number_format($totalToResolve)
            . " (errors: $resolveErrors)\n";
    }
}

echo "\n  Total resolved via API: " . number_format($resolved) . "\n";
echo "  Resolve errors: $resolveErrors\n\n";

// ── Step 3: Enqueue Japan species for enrichment ──
if (!$skipEnqueue) {
    echo "[3/3] Adding Japan-observed species to ExtractionQueue...\n";

    $eq = ExtractionQueue::getInstance();

    if (!$dryRun) {
        $added = $eq->addSpeciesBulk(
            array_map(fn($s) => [
                'name' => $s['name'],
                'gbif_key' => $s['gbif_key'],
                'source' => 'gbif_jp_occurrence',
            ], $japanSpeciesNames),
            'gbif_jp_occurrence'
        );
        echo "  Enqueued: " . number_format($added) . " new species (skipped existing)\n";
    } else {
        echo "  Would enqueue: " . number_format(count($japanSpeciesNames)) . " species\n";
    }
} else {
    echo "[3/3] Skipped enqueue (--skip-enqueue)\n";
}

// Summary
echo "\n=== Summary ===\n";
echo "  Japan species (GBIF facets): " . number_format(count($facets)) . "\n";
echo "  Matched in OmoikaneDB:       " . number_format($matchedInDb) . "\n";
echo "  Resolved via API:            " . number_format($resolved) . "\n";
echo "  Total Japan species:         " . number_format(count($japanSpeciesNames)) . "\n";

if (!$dryRun) {
    $totalSpecies = $pdo->query("SELECT COUNT(*) FROM species")->fetchColumn();
    echo "  OmoikaneDB total species:    " . number_format($totalSpecies) . "\n";

    $queueCounts = $eq->getCounts();
    echo "\n  ExtractionQueue:\n";
    foreach ($queueCounts as $k => $v) {
        echo "    $k: " . number_format($v) . "\n";
    }
}

echo "\nDone.\n";
