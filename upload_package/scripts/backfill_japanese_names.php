<?php
/**
 * OMOIKANE - Backfill japanese_name column
 *
 * Sources (priority order):
 *   1. taxon_resolver.json (ja_name from library/paper_taxa)
 *   2. observations.json + monthly partitions (taxon.name)
 *   3. redlist_mapping.json (name)
 *
 * Usage: php scripts/backfill_japanese_names.php
 */

require_once __DIR__ . '/../libs/OmoikaneDB.php';
date_default_timezone_set('Asia/Tokyo');

echo "[" . date('H:i:s') . "] japanese_name backfill started\n";

$db = new OmoikaneDB();
$pdo = $db->getPDO();

// Ensure column exists
try {
    $pdo->exec("ALTER TABLE species ADD COLUMN japanese_name TEXT;");
    echo "  Column added.\n";
} catch (PDOException $e) {
    echo "  Column already exists.\n";
}
$pdo->exec("CREATE INDEX IF NOT EXISTS idx_japanese_name ON species(japanese_name);");

// Load all distilled species
$rows = $pdo->query("SELECT id, scientific_name FROM species WHERE distillation_status = 'distilled'")->fetchAll();
$speciesMap = []; // lowercase scientific_name => id
foreach ($rows as $r) {
    $speciesMap[strtolower(trim($r['scientific_name']))] = $r['id'];
}
echo "  Distilled species: " . count($speciesMap) . "\n";

// Build mapping from all sources
$mapping = []; // species_id => japanese_name

// --- Source 1: taxon_resolver.json ---
$resolverPath = __DIR__ . '/../data/taxon_resolver.json';
if (file_exists($resolverPath)) {
    $resolver = json_decode(file_get_contents($resolverPath), true);
    $taxa = $resolver['taxa'] ?? [];
    $src1 = 0;
    foreach ($taxa as $t) {
        $ja = $t['ja_name'] ?? '';
        $sci = $t['accepted_name'] ?? '';
        if (empty($ja) || $ja === 'Unknown' || empty($sci)) continue;

        // Try exact match first
        $sciLower = strtolower(trim($sci));
        if (isset($speciesMap[$sciLower]) && !isset($mapping[$speciesMap[$sciLower]])) {
            $mapping[$speciesMap[$sciLower]] = $ja;
            $src1++;
            continue;
        }

        // Try normalized: strip authority "Gehyra mutilata (WIEGMANN, 1835)" → "gehyra mutilata"
        if (preg_match('/^([A-Za-z]+\s+[a-z]+)/', $sci, $m)) {
            $normalized = strtolower($m[1]);
            if (isset($speciesMap[$normalized]) && !isset($mapping[$speciesMap[$normalized]])) {
                $mapping[$speciesMap[$normalized]] = $ja;
                $src1++;
            }
        }
    }
    echo "  Source 1 (resolver): $src1 matches\n";
}

// --- Source 2: observations ---
$src2 = 0;
$obsFiles = [];
$mainObs = __DIR__ . '/../data/observations.json';
if (file_exists($mainObs)) $obsFiles[] = $mainObs;
$monthlyDir = __DIR__ . '/../data/observations';
if (is_dir($monthlyDir)) {
    foreach (glob($monthlyDir . '/*.json') as $f) $obsFiles[] = $f;
}

foreach ($obsFiles as $file) {
    $obs = json_decode(file_get_contents($file), true) ?: [];
    foreach ($obs as $o) {
        $sci = strtolower(trim($o['taxon']['scientific_name'] ?? ''));
        $ja = $o['taxon']['name'] ?? '';
        if (empty($sci) || empty($ja) || mb_strlen($ja) <= 1) continue;
        // Skip if name is Latin/ASCII (not Japanese)
        if (preg_match('/^[a-zA-Z\s\-\.]+$/', $ja)) continue;
        if (isset($speciesMap[$sci]) && !isset($mapping[$speciesMap[$sci]])) {
            $mapping[$speciesMap[$sci]] = $ja;
            $src2++;
        }
    }
}
echo "  Source 2 (observations): $src2 additional\n";

// --- Source 3: redlist_mapping.json ---
$rlPath = __DIR__ . '/../data/redlist_mapping.json';
$src3 = 0;
if (file_exists($rlPath)) {
    $rl = json_decode(file_get_contents($rlPath), true) ?: [];
    foreach ($rl as $entry) {
        $sci = strtolower(trim($entry['scientificName'] ?? ''));
        $ja = $entry['name'] ?? '';
        if (empty($sci) || empty($ja) || mb_strlen($ja) <= 1) continue;
        if (isset($speciesMap[$sci]) && !isset($mapping[$speciesMap[$sci]])) {
            $mapping[$speciesMap[$sci]] = $ja;
            $src3++;
        }
    }
    echo "  Source 3 (redlist): $src3 additional\n";
}

// --- Write to DB ---
echo "\n[" . date('H:i:s') . "] Writing " . count($mapping) . " names to DB...\n";

$stmt = $pdo->prepare("UPDATE species SET japanese_name = :ja WHERE id = :id AND (japanese_name IS NULL OR japanese_name = '')");
$written = 0;
$pdo->exec('BEGIN');
foreach ($mapping as $speciesId => $jaName) {
    $stmt->execute([':ja' => $jaName, ':id' => $speciesId]);
    if ($stmt->rowCount() > 0) $written++;
}
$pdo->exec('COMMIT');

echo "[" . date('H:i:s') . "] Done.\n";
echo "\n=== Results ===\n";
echo "  Total distilled : " . count($speciesMap) . "\n";
echo "  Mapped          : " . count($mapping) . "\n";
echo "  Written to DB   : $written\n";
echo "  Backfill rate   : " . round(count($mapping) / count($speciesMap) * 100, 1) . "%\n";
echo "  Remaining NULL  : " . (count($speciesMap) - count($mapping)) . "\n";

// Verify
$filled = $pdo->query("SELECT COUNT(*) FROM species WHERE japanese_name IS NOT NULL AND japanese_name != ''")->fetchColumn();
echo "\n  DB verification : $filled species with japanese_name\n";

// Show samples
echo "\n  Samples:\n";
$samples = $pdo->query("SELECT scientific_name, japanese_name FROM species WHERE japanese_name IS NOT NULL AND japanese_name != '' ORDER BY RANDOM() LIMIT 10")->fetchAll();
foreach ($samples as $s) {
    echo "    {$s['scientific_name']} => {$s['japanese_name']}\n";
}
