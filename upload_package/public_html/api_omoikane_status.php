<?php

/**
 * API Endpoint: omoikane_status.php
 * Returns real-time JSON metrics of the Omoikane extraction engine.
 */

// Basic Security: Restrict or ensure we log access if needed, but for now simple return.
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/OmoikaneDB.php';

header('Content-Type: application/json');

$queueFile = DATA_DIR . '/library/extraction_queue.json';
$queueData = file_exists($queueFile) ? json_decode(file_get_contents($queueFile), true) : [];

$counts = [
    'completed' => 0,
    'processing' => 0,
    'pending' => 0,
    'failed' => 0,
    'total' => count($queueData)
];

foreach ($queueData as $v) {
    if (isset($v['status'])) {
        $counts[$v['status']] = ($counts[$v['status']] ?? 0) + 1;
    }
}

// Get SQLite stats
$dbHelper = new OmoikaneDB();
$pdo = $dbHelper->getPDO();

$stmt = $pdo->query("SELECT count(*) as count FROM species WHERE distillation_status = 'distilled'");
$distilledCount = $stmt->fetchColumn() ?: 0;

// Calculate speed over last 5 minutes
$timeLimit = date('Y-m-d H:i:s', time() - 300);
$stmtSpeed = $pdo->prepare("SELECT count(*) as count FROM species WHERE distillation_status = 'distilled' AND last_distilled_at >= :timeLimit");
$stmtSpeed->execute([':timeLimit' => $timeLimit]);
$recentCount = $stmtSpeed->fetchColumn() ?: 0;

$speciesPerMinute = round($recentCount / 5, 2);
$speciesPerHour = round($speciesPerMinute * 60, 2);

$etaHours = -1;
if ($speciesPerHour > 0 && $counts['pending'] > 0) {
    $etaHours = round($counts['pending'] / $speciesPerHour, 1);
}

// Fetch recent 10 extractions
$stmtRecent = $pdo->query("SELECT scientific_name, last_distilled_at FROM species WHERE distillation_status = 'distilled' ORDER BY last_distilled_at DESC LIMIT 10");
$recentSpecies = $stmtRecent->fetchAll(PDO::FETCH_ASSOC);

// Attach Japanese name from queue if available
$cleanRecentSpecies = [];
foreach ($recentSpecies as &$rs) {
    if (isset($queueData[$rs['scientific_name']]['ja_name'])) {
        $ja_name = $queueData[$rs['scientific_name']]['ja_name'];
        // Strip out unwanted strings
        $ja_name = preg_replace('/\\s*\\(続き\\)\\s*/u', '', $ja_name);

        if (stripos($ja_name, 'Unknown') !== false || stripos($ja_name, '概説続き') !== false || stripos($ja_name, '系統分類') !== false) {
            $rs['ja_name'] = null;
        } else {
            $rs['ja_name'] = $ja_name;
        }
    } else {
        $rs['ja_name'] = null;
    }

    // Also skip showing the record if scientific name is obviously wrong
    if (stripos($rs['scientific_name'], 'Unknown') !== false || stripos($rs['scientific_name'], '概説続き') !== false || stripos($rs['scientific_name'], '系統分類') !== false) {
        continue;
    }

    $cleanRecentSpecies[] = $rs;
}
unset($rs);

echo json_encode([
    'success' => true,
    'timestamp' => time(),
    'metrics' => [
        'queue' => $counts,
        'sqlite_distilled' => (int)$distilledCount,
        'speed' => [
            'per_minute' => $speciesPerMinute,
            'per_hour' => $speciesPerHour
        ],
        'eta_hours' => $etaHours,
        'recent_failed' => $counts['failed'],
        'recent_species' => $cleanRecentSpecies
    ]
], JSON_PRETTY_PRINT);
