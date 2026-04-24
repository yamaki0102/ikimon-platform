<?php

/**
 * API Endpoint: omoikane_status.php
 * Returns real-time JSON metrics of the Omoikane extraction engine.
 */

// Basic Security: Restrict or ensure we log access if needed, but for now simple return.
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/OmoikaneDB.php';
require_once __DIR__ . '/../libs/ExtractionQueue.php';

header('Content-Type: application/json');

$eq = new ExtractionQueue();
$counts = $eq->getCounts();


// Get SQLite stats
$dbHelper = new OmoikaneDB();
$pdo = $dbHelper->getPDO();

$stmt = $pdo->query("SELECT count(*) as count FROM species WHERE distillation_status = 'distilled'");
$distilledCount = $stmt->fetchColumn() ?: 0;

// Calculate speed over last 15 minutes for stable throughput
date_default_timezone_set('Asia/Tokyo');
$windowMinutes = 15;
$timeLimit = date('Y-m-d H:i:s', time() - ($windowMinutes * 60));
$stmtSpeed = $pdo->prepare("SELECT count(*) as count FROM species WHERE distillation_status = 'distilled' AND last_distilled_at >= :timeLimit");
$stmtSpeed->execute([':timeLimit' => $timeLimit]);
$recentCount = $stmtSpeed->fetchColumn() ?: 0;

$speciesPerMinute = round($recentCount / $windowMinutes, 2);
$speciesPerHour = round($speciesPerMinute * 60, 2);

// ETA based on remaining work (pending + literature_ready)
$remaining = ($counts['pending'] ?? 0) + ($counts['literature_ready'] ?? 0);
$etaHours = -1;
if ($speciesPerHour > 0 && $remaining > 0) {
    $etaHours = round($remaining / $speciesPerHour, 1);
}

// Fetch recent 10 extractions
$stmtRecent = $pdo->query("SELECT scientific_name, last_distilled_at FROM species WHERE distillation_status = 'distilled' ORDER BY last_distilled_at DESC LIMIT 10");
$recentSpecies = $stmtRecent->fetchAll(PDO::FETCH_ASSOC);

// Clean up recent species list
$cleanRecentSpecies = [];
foreach ($recentSpecies as &$rs) {
    $rs['ja_name'] = null; // ja_name lookup via species DB if needed later

    // Skip showing the record if scientific name is obviously wrong
    if (stripos($rs['scientific_name'], 'Unknown') !== false || stripos($rs['scientific_name'], '概説続き') !== false || stripos($rs['scientific_name'], '系統分類') !== false) {
        continue;
    }

    $cleanRecentSpecies[] = $rs;
}
unset($rs);

// Read active worker heartbeats
$heartbeatFile = DATA_DIR . '/library/worker_heartbeats.json';
$activeWorkers = [];
if (file_exists($heartbeatFile)) {
    $beats = json_decode(file_get_contents($heartbeatFile), true) ?: [];
    $now = time();
    foreach ($beats as $pid => $beat) {
        $pidInt = (int)$pid;

        // Skip invalid entries
        if ($pidInt <= 0 || !is_array($beat)) continue;

        // Time-based alive check (within last 60 seconds)
        $updatedAtRaw = $beat['updated_at'] ?? 0;
        $updatedAt = is_numeric($updatedAtRaw) ? $updatedAtRaw : strtotime($updatedAtRaw);
        $isAlive = (($now - $updatedAt) < 60);

        if ($isAlive) {
            $beat['pid'] = $pidInt;
            $beat['species'] = $beat['name'] ?? ($beat['species'] ?? 'unknown');
            $beat['phase'] = $beat['status'] ?? ($beat['phase'] ?? '');
            $activeWorkers[] = $beat;
        }
    }
}

// Count spool files for writer status
$spoolDir = DATA_DIR . '/spool';
$spoolPending = count(glob($spoolDir . '/*.json'));
$spoolArchived = count(glob($spoolDir . '/archive/*.json'));

// Count total unique papers from TaxonPaperIndex (live count)
$paperIndexFile = DATA_DIR . '/library/taxon_paper_index.json';
$paperCount = 0;
if (file_exists($paperIndexFile)) {
    $idx = json_decode(file_get_contents($paperIndexFile), true) ?: [];
    $uniqueDois = [];
    foreach ($idx as $papers) {
        foreach ($papers as $doi) $uniqueDois[$doi] = true;
    }
    $paperCount = count($uniqueDois);
}

echo json_encode([
    'success' => true,
    'timestamp' => time(),
    'metrics' => [
        'queue' => $counts,
        'sqlite_distilled' => (int)$distilledCount,
        'total_papers' => (int)$paperCount,
        'speed' => [
            'per_minute' => $speciesPerMinute,
            'per_hour' => $speciesPerHour
        ],
        'eta_hours' => $etaHours,
        'recent_failed' => $counts['failed'],
        'recent_species' => $cleanRecentSpecies,
        'active_workers' => $activeWorkers,
        'spool' => [
            'pending' => $spoolPending,
            'archived' => $spoolArchived
        ]
    ]
], JSON_PRETTY_PRINT);
