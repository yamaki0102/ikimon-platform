<?php
/**
 * Omoikane — GBIF Backbone Vernacular Names Import
 *
 * backbone.zip から VernacularName.tsv を抽出し vernacular_names テーブルに投入。
 * 全言語を取り込み、和名は language IN ('ja', 'jpn') でクエリ時にフィルタ。
 *
 * 使い方:
 *   php import_gbif_vernacular.php
 *   php import_gbif_vernacular.php --limit=1000
 *   php import_gbif_vernacular.php --lang=jpn      # 特定言語のみ
 *   php import_gbif_vernacular.php --dry-run
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/OmoikaneDB.php';

$opts = getopt('', ['limit:', 'lang:', 'dry-run']);
$limit   = isset($opts['limit']) ? (int)$opts['limit'] : 0;
$langFilter = $opts['lang'] ?? '';
$dryRun  = isset($opts['dry-run']);

$zipPath = DATA_DIR . '/library/backbone.zip';
$tsvPath = DATA_DIR . '/library/VernacularName.tsv';
$backboneVersion = date('Y-m-d');

echo "=== GBIF Backbone Vernacular Names Import ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
if ($dryRun) echo "*** DRY RUN ***\n";
if ($langFilter) echo "Language filter: $langFilter\n";
echo "\n";

// Extract VernacularName.tsv if needed
if (!file_exists($tsvPath)) {
    if (!file_exists($zipPath)) {
        die("ERROR: backbone.zip not found at $zipPath\nRun import_gbif_backbone.php first.\n");
    }

    echo "[1/3] Extracting VernacularName.tsv from backbone.zip...\n";
    $zip = new ZipArchive();
    if ($zip->open($zipPath) !== true) die("ERROR: Cannot open ZIP\n");

    $found = false;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = $zip->getNameIndex($i);
        if (basename($name) === 'VernacularName.tsv') {
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
    if (!$found) die("ERROR: VernacularName.tsv not found in ZIP\n");
    echo "  Extracted: " . round(filesize($tsvPath) / 1048576, 1) . " MB\n\n";
} else {
    echo "[1/3] VernacularName.tsv exists: " . round(filesize($tsvPath) / 1048576, 1) . " MB\n\n";
}

echo "[2/3] Parsing and inserting...\n";

$fh = fopen($tsvPath, 'r');
$header = fgetcsv($fh, 0, "\t");
$colIndex = array_flip($header);

foreach (['taxonID', 'vernacularName', 'language'] as $col) {
    if (!isset($colIndex[$col])) {
        die("ERROR: Required column '$col' not found. Available: " . implode(', ', $header) . "\n");
    }
}
$hasCountry = isset($colIndex['countryCode']);
$hasSource  = isset($colIndex['source']);

$db = new OmoikaneDB();
$pdo = $db->getPDO();

$stmt = $pdo->prepare(
    "INSERT OR IGNORE INTO vernacular_names (gbif_taxon_id, name, language, country, source, backbone_version)
     VALUES (:gid, :name, :lang, :country, :source, :ver)"
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
    $name    = $row[$colIndex['vernacularName']] ?? '';
    $lang    = $row[$colIndex['language']] ?? '';

    if (empty($taxonId) || empty($name) || empty($lang)) {
        $filtered++;
        continue;
    }

    if ($langFilter && strcasecmp($lang, $langFilter) !== 0) {
        $filtered++;
        continue;
    }

    $batch[] = [
        ':gid'     => (int)$taxonId,
        ':name'    => $name,
        ':lang'    => $lang,
        ':country' => $hasCountry ? ($row[$colIndex['countryCode']] ?? '') : '',
        ':source'  => $hasSource ? ($row[$colIndex['source']] ?? '') : '',
        ':ver'     => $backboneVersion,
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
            echo "\r  Names: " . number_format($inserted) . " | Filtered: " . number_format($filtered)
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
echo "  Lines read:      " . number_format($lineNum) . "\n";
echo "  Names inserted:  " . number_format($inserted) . "\n";
echo "  Filtered:        " . number_format($filtered) . "\n";
echo "  Elapsed:         " . round($elapsed, 1) . " sec\n";

if (!$dryRun) {
    $total = $pdo->query("SELECT COUNT(*) FROM vernacular_names")->fetchColumn();
    $jaCount = $pdo->query("SELECT COUNT(*) FROM vernacular_names WHERE language IN ('ja', 'jpn')")->fetchColumn();
    echo "  Total names:     " . number_format($total) . "\n";
    echo "  Japanese names:  " . number_format($jaCount) . "\n";

    $byLang = $pdo->query("SELECT language, COUNT(*) as cnt FROM vernacular_names GROUP BY language ORDER BY cnt DESC LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
    echo "\n  Top languages:\n";
    foreach ($byLang as $r) {
        echo "    " . str_pad($r['language'], 8) . number_format($r['cnt']) . "\n";
    }
}

echo "\nDone.\n";
