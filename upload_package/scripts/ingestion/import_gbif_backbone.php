<?php
/**
 * Omoikane — GBIF Backbone Taxonomy Full Import
 *
 * GBIF Backbone (~600MB ZIP, ~2.3M accepted species) をストリームパースし
 * OmoikaneDB species テーブルに全種カタログを一括投入する。
 *
 * 使い方:
 *   php import_gbif_backbone.php                          # フルインポート
 *   php import_gbif_backbone.php --limit=1000             # テスト用
 *   php import_gbif_backbone.php --kingdom=Animalia       # 特定界のみ
 *   php import_gbif_backbone.php --dry-run                # カウントのみ
 *   php import_gbif_backbone.php --zip=/path/backbone.zip # 既DL済みファイル指定
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/OmoikaneDB.php';

$opts = getopt('', ['zip:', 'limit:', 'kingdom:', 'dry-run', 'resume']);
$zipPath   = $opts['zip'] ?? DATA_DIR . '/library/backbone.zip';
$tsvPath   = DATA_DIR . '/library/Taxon.tsv';
$limit     = isset($opts['limit']) ? (int)$opts['limit'] : 0;
$kingdomFilter = $opts['kingdom'] ?? '';
$dryRun    = isset($opts['dry-run']);
$resume    = isset($opts['resume']);

$progressFile = DATA_DIR . '/library/backbone_import_progress.json';

echo "=== GBIF Backbone Full Import ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
if ($dryRun) echo "*** DRY RUN — no data will be written ***\n";
if ($kingdomFilter) echo "Kingdom filter: $kingdomFilter\n";
if ($limit) echo "Limit: $limit species\n";
echo "\n";

// ── Step 1: Download backbone.zip if needed ──
if (!file_exists($tsvPath)) {
    if (!file_exists($zipPath)) {
        $url = 'https://hosted-datasets.gbif.org/datasets/backbone/current/backbone.zip';
        echo "[1/4] Downloading backbone.zip (~600MB)...\n";
        echo "  URL: $url\n";
        echo "  Destination: $zipPath\n";

        $ch = curl_init($url);
        $fp = fopen($zipPath, 'w');
        if (!$fp) die("ERROR: Cannot write to $zipPath\n");

        curl_setopt_array($ch, [
            CURLOPT_FILE => $fp,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 3600,
            CURLOPT_NOPROGRESS => false,
            CURLOPT_PROGRESSFUNCTION => function ($ch, $dlTotal, $dlNow) {
                if ($dlTotal > 0) {
                    $pct = round($dlNow / $dlTotal * 100, 1);
                    $mb = round($dlNow / 1048576, 1);
                    echo "\r  Progress: $mb MB / " . round($dlTotal / 1048576, 1) . " MB ($pct%)";
                }
            },
        ]);

        $ok = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        fclose($fp);
        echo "\n";

        if (!$ok || $httpCode !== 200) {
            @unlink($zipPath);
            die("ERROR: Download failed (HTTP $httpCode)\n");
        }
        echo "  Downloaded: " . round(filesize($zipPath) / 1048576, 1) . " MB\n\n";
    } else {
        echo "[1/4] backbone.zip already exists: " . round(filesize($zipPath) / 1048576, 1) . " MB\n\n";
    }

    // ── Step 2: Extract Taxon.tsv ──
    echo "[2/4] Extracting Taxon.tsv from ZIP...\n";
    $zip = new ZipArchive();
    if ($zip->open($zipPath) !== true) {
        die("ERROR: Cannot open ZIP file: $zipPath\n");
    }

    $found = false;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = $zip->getNameIndex($i);
        if (basename($name) === 'Taxon.tsv') {
            echo "  Found: $name\n";
            $stream = $zip->getStream($name);
            if (!$stream) die("ERROR: Cannot get stream for $name\n");

            $out = fopen($tsvPath, 'w');
            while (!feof($stream)) {
                fwrite($out, fread($stream, 8192));
            }
            fclose($out);
            fclose($stream);
            $found = true;
            break;
        }
    }
    $zip->close();

    if (!$found) die("ERROR: Taxon.tsv not found in ZIP\n");
    echo "  Extracted: " . round(filesize($tsvPath) / 1048576, 1) . " MB\n\n";
} else {
    echo "[1/4] backbone.zip — skipped (Taxon.tsv exists)\n";
    echo "[2/4] Taxon.tsv already extracted: " . round(filesize($tsvPath) / 1048576, 1) . " MB\n\n";
}

// ── Step 3: Parse TSV & Insert ──
echo "[3/4] Parsing Taxon.tsv and inserting into OmoikaneDB...\n";

$fh = fopen($tsvPath, 'r');
if (!$fh) die("ERROR: Cannot open $tsvPath\n");

// Read header to build column index
$header = fgetcsv($fh, 0, "\t");
if (!$header) die("ERROR: Empty TSV file\n");

$colIndex = array_flip($header);
$requiredCols = ['taxonID', 'canonicalName', 'taxonomicStatus', 'taxonRank', 'kingdom', 'phylum', 'class', 'order', 'family'];
foreach ($requiredCols as $col) {
    if (!isset($colIndex[$col])) {
        die("ERROR: Required column '$col' not found in TSV header.\nAvailable: " . implode(', ', $header) . "\n");
    }
}

$db = new OmoikaneDB();
$pdo = $db->getPDO();

// Resume support
$resumeOffset = 0;
if ($resume && file_exists($progressFile)) {
    $prog = json_decode(file_get_contents($progressFile), true);
    $resumeOffset = $prog['lines_processed'] ?? 0;
    echo "  Resuming from line $resumeOffset\n";
}

$stmt = $pdo->prepare(
    "INSERT OR IGNORE INTO species (scientific_name, kingdom, phylum, class_name, order_name, family, gbif_taxon_id, catalog_source, distillation_status)
     VALUES (:name, :kingdom, :phylum, :class, :order, :family, :gbif_id, 'gbif_backbone', 'catalog')"
);

$inserted = 0;
$skipped = 0;
$filtered = 0;
$lineNum = 0;
$batchSize = 1000;
$batch = [];
$startTime = microtime(true);

while (($row = fgetcsv($fh, 0, "\t")) !== false) {
    $lineNum++;

    // Resume: skip already processed lines
    if ($resumeOffset > 0 && $lineNum <= $resumeOffset) {
        if ($lineNum % 500000 === 0) echo "\r  Skipping to resume point... line $lineNum";
        continue;
    }

    // Filter: accepted species only
    $status = $row[$colIndex['taxonomicStatus']] ?? '';
    $rank   = $row[$colIndex['taxonRank']] ?? '';
    if (strtolower($rank) !== 'species' || strtolower($status) !== 'accepted') {
        $filtered++;
        continue;
    }

    $name = $row[$colIndex['canonicalName']] ?? '';
    if (empty($name) || substr_count(trim($name), ' ') !== 1) {
        $filtered++;
        continue;
    }

    $kingdom = $row[$colIndex['kingdom']] ?? '';
    if ($kingdomFilter && strcasecmp($kingdom, $kingdomFilter) !== 0) {
        $filtered++;
        continue;
    }

    $batch[] = [
        ':name'    => $name,
        ':kingdom' => $kingdom,
        ':phylum'  => $row[$colIndex['phylum']] ?? '',
        ':class'   => $row[$colIndex['class']] ?? '',
        ':order'   => $row[$colIndex['order']] ?? '',
        ':family'  => $row[$colIndex['family']] ?? '',
        ':gbif_id' => (int)($row[$colIndex['taxonID']] ?? 0),
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
        $skipped += count($batch) - ($dryRun ? count($batch) : $inserted);
        $batch = [];

        // Progress report every 10K species
        if ($inserted % 10000 < $batchSize) {
            $elapsed = microtime(true) - $startTime;
            $rate = $inserted / max($elapsed, 0.001);
            echo "\r  Inserted: " . number_format($inserted) . " | Filtered: " . number_format($filtered)
                . " | Rate: " . number_format($rate, 0) . " species/sec | Line: " . number_format($lineNum);
        }

        // Save progress for resume
        if ($lineNum % 100000 === 0) {
            file_put_contents($progressFile, json_encode([
                'lines_processed' => $lineNum,
                'inserted' => $inserted,
                'filtered' => $filtered,
                'timestamp' => date('Y-m-d H:i:s'),
            ], JSON_PRETTY_PRINT));
        }
    }

    if ($limit > 0 && $inserted >= $limit) {
        echo "\n  Reached limit of $limit species.\n";
        break;
    }
}

// Flush remaining batch
if (!empty($batch)) {
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
}

fclose($fh);

$elapsed = microtime(true) - $startTime;

echo "\n\n";
echo "[4/4] Summary\n";
echo "  Total lines read:  " . number_format($lineNum) . "\n";
echo "  Species inserted:  " . number_format($inserted) . "\n";
echo "  Filtered out:      " . number_format($filtered) . "\n";
echo "  Elapsed:           " . round($elapsed, 1) . " sec\n";
echo "  Rate:              " . number_format($inserted / max($elapsed, 0.001), 0) . " species/sec\n";

if (!$dryRun) {
    // Final counts
    $total = $pdo->query("SELECT COUNT(*) FROM species")->fetchColumn();
    $byKingdom = $pdo->query("SELECT kingdom, COUNT(*) as cnt FROM species WHERE kingdom != '' GROUP BY kingdom ORDER BY cnt DESC")->fetchAll(PDO::FETCH_ASSOC);

    echo "\n=== OmoikaneDB Species Table ===\n";
    echo "  Total species: " . number_format($total) . "\n";
    foreach ($byKingdom as $row) {
        echo "  " . str_pad($row['kingdom'], 20) . number_format($row['cnt']) . "\n";
    }

    // Clean up progress file
    @unlink($progressFile);
}

echo "\nDone.\n";
