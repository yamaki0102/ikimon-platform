<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/AiBudgetGuard.php';

$queueFile = DATA_DIR . '/system/ai_assessment_queue.json';
$queue = [];
if (is_file($queueFile)) {
    $decoded = json_decode((string)file_get_contents($queueFile), true);
    $queue = is_array($decoded) ? $decoded : [];
}

$summary = [
    'total' => count($queue),
    'status' => [],
    'lane' => [],
    'lane_status' => [],
    'oldest_pending' => null,
    'budget' => AiBudgetGuard::snapshot(),
];

foreach ($queue as $item) {
    $status = (string)($item['status'] ?? 'unknown');
    $lane = (string)($item['lane'] ?? 'fast');

    $summary['status'][$status] = ($summary['status'][$status] ?? 0) + 1;
    $summary['lane'][$lane] = ($summary['lane'][$lane] ?? 0) + 1;
    $summary['lane_status'][$lane . ':' . $status] = ($summary['lane_status'][$lane . ':' . $status] ?? 0) + 1;

    if ($status === 'pending') {
        $requestedAt = (string)($item['requested_at'] ?? '');
        if ($requestedAt !== '' && ($summary['oldest_pending'] === null || strtotime($requestedAt) < strtotime((string)$summary['oldest_pending']))) {
            $summary['oldest_pending'] = $requestedAt;
        }
    }
}

echo json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . PHP_EOL;
