<?php
/**
 * Omoikane — GBIF Backbone Synonym Import
 *
 * Taxon.tsv を再パースし、taxonomicStatus != 'accepted' かつ
 * acceptedNameUsageID が存在する行を taxon_synonyms テーブルに投入。
 *
 * 使い方:
 *   php import_gbif_synonyms.php
 *   php import_gbif_synonyms.php --limit=1000
 *   php import_gbif_synonyms.php --dry-run
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/OmoikaneDB.php';

$opts = getopt('', ['limit:', 'dry-run']);
$limit  = isset($opts['limit']) ? (int)$opts['limit'] : 0;
$dryRun = isset($opts['dry-run']);

$tsvPath = DATA_DIR . '/library/Taxon.tsv';
$backboneVersion = date('Y-m-d');

echo "=== GBIF Backbone Synonym Import ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
if ($dryRun) echo "*** DRY RUN ***\n";
echo "\n";

if (!file_exists($tsvPath)) {
    die("ERROR: Taxon.tsv not found at $tsvPath\nRun import_gbif_backbone.php first.\n");
}

$fh = fopen($tsvPath, 'r');
$header = fgetcsv($fh, 0, "\t");
$colIndex = array_flip($header);

foreach (['taxonID', 'canonicalName', 'taxonomicStatus', 'acceptedNameUsageID'] as $col) {
    if (!isset($colIndex[$col])) {
        die("ERROR: Required column '$col' not found in TSV header.\n");
    }
}

$db = new OmoikaneDB();
$pdo = $db->getPDO();

$stmt = $pdo->prepare(
    "INSERT OR IGNORE INTO taxon_synonyms (synonym_id, accepted_id, synonym_name, taxonomic_status, backbone_version)
     VALUES (:sid, :aid, :name, :status, :ver)"
);

$inserted = 0;
$filtered = 0;
$lineNum = 0;
$batchSize = 1000;
$batch = [];
$startTime = microtime(true);

echo "[1/2] Parsing Taxon.tsv for synonyms...\n";

while (($row = fgetcsv($fh, 0, "\t")) !== false) {
    $lineNum++;

    $status = strtolower($row[$colIndex['taxonomicStatus']] ?? '');
    if ($status === 'accepted') {
        $filtered++;
        continue;
    }

    $acceptedId = $row[$colIndex['acceptedNameUsageID']] ?? '';
    if (empty($acceptedId) || !is_numeric($acceptedId)) {
        $filtered++;
        continue;
    }

    $synonymId = $row[$colIndex['taxonID']] ?? '';
    $name = $row[$colIndex['canonicalName']] ?? '';
    if (empty($synonymId) || empty($name)) {
        $filtered++;
        continue;
    }

    $batch[] = [
        ':sid'    => (int)$synonymId,
        ':aid'    => (int)$acceptedId,
        ':name'   => $name,
        ':status' => $status,
        ':ver'    => $backboneVersion,
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
            echo "\r  Synonyms: " . number_format($inserted) . " | Filtered: " . number_format($filtered)
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

echo "\n\n[2/2] Summary\n";
echo "  Lines read:      " . number_format($lineNum) . "\n";
echo "  Synonyms added:  " . number_format($inserted) . "\n";
echo "  Filtered:        " . number_format($filtered) . "\n";
echo "  Elapsed:         " . round($elapsed, 1) . " sec\n";

if (!$dryRun) {
    $total = $pdo->query("SELECT COUNT(*) FROM taxon_synonyms")->fetchColumn();
    echo "  Total in table:  " . number_format($total) . "\n";
}

echo "\nDone.\n";
