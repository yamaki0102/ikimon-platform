<?php

/**
 * Reset stuck queue items (SQLite version)
 */
date_default_timezone_set('Asia/Tokyo');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../libs/ExtractionQueue.php';

$eq = new ExtractionQueue();
$result = $eq->resetAllStuck();

echo "✅ Reset complete!\n";
echo "  Processing → literature_ready: {$result['processing']}\n";
echo "  Failed → literature_ready: {$result['failed']}\n";
echo "  Total recoverable: " . ($result['processing'] + $result['failed']) . "\n";
