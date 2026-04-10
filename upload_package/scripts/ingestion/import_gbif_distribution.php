<?php
/**
 * Omoikane — GBIF Backbone Distribution Import
 *
 * backbone.zip から Distribution.tsv を抽出し taxon_distribution テーブルに投入。
 * 国別の在来/外来ステータスをローカルに保持。
 *
 * 使い方:
 *   php import_gbif_distribution.php
 *   php import_gbif_distribution.php --limit=1000
 *   php import_gbif_distribution.php --country=JP    # 特定国のみ
 *   php import_gbif_distribution.php --dry-run
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/OmoikaneDB.php';

$opts = getopt('', ['limit:', 'country:', 'dry-run']);
$limit   = isset($opts['limit']) ? (int)$opts['limit'] : 0;
$countryFilter = $opts['country'] ?? '';
$dryRun  = isset($opts['dry-run']);

$zipPath = DATA_DIR . '/library/backbone.zip';
$tsvPath = DATA_DIR . '/library/Distribution.tsv';
$backboneVersion = date('Y-m-d');

echo "=== GBIF Backbone Distribution Import ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
if ($dryRun) echo "*** DRY RUN ***\n";
if ($countryFilter) echo "Country filter: $countryFilter\n";
echo "\n";

if (!file_exists($tsvPath)) {
    if (!file_exists($zipPath)) {
        die("ERROR: backbone.zip not found at $zipPath\nRun import_gbif_backbone.php first.\n");
    }

    echo "[1/3] Extracting Distribution.tsv from backbone.zip...\n";
    $zip = new ZipArchive();
    if ($zip->open($zipPath) !== true) die("ERROR: Cannot open ZIP\n");

    $found = false;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = $zip->getNameIndex($i);
        if (basename($name) === 'Distribution.tsv') {
            $stream = $zip->getStream($name);
            $out = fopen($tsvPath, 'w');
            while (!feof($stream)) fwrite($out, fread($stream, 8192));
            fclose($out);
            fclose($stream);
            $found = true;
            break;
        }
    }
    $zip->close();
    if (!$found) die("ERROR: Distribution.tsv not found in ZIP\n");
    echo "  Extracted: " . round(filesize($tsvPath) / 1048576, 1) . " MB\n\n";
} else {
    echo "[1/3] Distribution.tsv exists: " . round(filesize($tsvPath) / 1048576, 1) . " MB\n\n";
}

echo "[2/3] Parsing and inserting...\n";

$fh = fopen($tsvPath, 'r');
$header = fgetcsv($fh, 0, "\t");
$colIndex = array_flip($header);

if (!isset($colIndex['taxonID'])) {
    die("ERROR: 'taxonID' column not found. Available: " . implode(', ', $header) . "\n");
}
$hasLocationId = isset($colIndex['locationID']);
$hasLocality   = isset($colIndex['locality']);
$hasMeans      = isset($colIndex['establishmentMeans']);

$db = new OmoikaneDB();
$pdo = $db->getPDO();

$stmt = $pdo->prepare(
    "INSERT OR IGNORE INTO taxon_distribution (gbif_taxon_id, location_id, locality, establishment_means, backbone_version)
     VALUES (:gid, :loc, :locality, :means, :ver)"
);

$inserted = 0;
$filtered = 0;
$lineNum = 0;
$batchSize = 1000;
$batch = [];
$startTime = microtime(true);

while (($row = fgetcsv($fh, 0, "\t")) !== false) {
    $lineNum++;

    $taxonId = $row[$colIndex['taxonID']] ?? '';
    if (empty($taxonId)) { $filtered++; continue; }

    $locationId = $hasLocationId ? ($row[$colIndex['locationID']] ?? '') : '';
    $locality   = $hasLocality ? ($row[$colIndex['locality']] ?? '') : '';
    $means      = $hasMeans ? ($row[$colIndex['establishmentMeans']] ?? '') : '';

    if ($countryFilter && stripos($locationId, $countryFilter) === false) {
        $filtered++;
        continue;
    }

    $batch[] = [
        ':gid'      => (int)$taxonId,
        ':loc'      => $locationId,
        ':locality' => $locality,
        ':means'    => $means,
        ':ver'      => $backboneVersion,
    ];

    if (count($batch) >= $batchSize) {
        if (!$dryRun) {
            $pdo->beginTransaction();
            foreach ($batch as $b) {
                $stmt->execute($b);
                $inserted += $stmt->rowCount();
            }
            $pdo->commit();
        } else {
            $inserted += count($batch);
        }
        $batch = [];

        if ($inserted % 50000 < $batchSize) {
            $elapsed = microtime(true) - $startTime;
            $rate = $inserted / max($elapsed, 0.001);
            echo "\r  Records: " . number_format($inserted) . " | Filtered: " . number_format($filtered)
                . " | Rate: " . number_format($rate, 0) . "/sec | Line: " . number_format($lineNum);
        }
    }

    if ($limit > 0 && $inserted >= $limit) {
        echo "\n  Reached limit of $limit.\n";
        break;
    }
}

if (!empty($batch) && !$dryRun) {
    $pdo->beginTransaction();
    foreach ($batch as $b) {
        $stmt->execute($b);
        $inserted += $stmt->rowCount();
    }
    $pdo->commit();
} elseif (!empty($batch)) {
    $inserted += count($batch);
}

fclose($fh);
$elapsed = microtime(true) - $startTime;

echo "\n\n[3/3] Summary\n";
echo "  Lines read:        " . number_format($lineNum) . "\n";
echo "  Records inserted:  " . number_format($inserted) . "\n";
echo "  Filtered:          " . number_format($filtered) . "\n";
echo "  Elapsed:           " . round($elapsed, 1) . " sec\n";

if (!$dryRun) {
    $total = $pdo->query("SELECT COUNT(*) FROM taxon_distribution")->fetchColumn();
    echo "  Total records:     " . number_format($total) . "\n";

    $byMeans = $pdo->query("SELECT establishment_means, COUNT(*) as cnt FROM taxon_distribution WHERE establishment_means != '' GROUP BY establishment_means ORDER BY cnt DESC")->fetchAll(PDO::FETCH_ASSOC);
    if ($byMeans) {
        echo "\n  By establishment means:\n";
        foreach ($byMeans as $r) {
            echo "    " . str_pad($r['establishment_means'], 20) . number_format($r['cnt']) . "\n";
        }
    }

    $jpCount = $pdo->query("SELECT COUNT(*) FROM taxon_distribution WHERE location_id LIKE '%JP%'")->fetchColumn();
    echo "\n  Japan records: " . number_format($jpCount) . "\n";
}

echo "\nDone.\n";
