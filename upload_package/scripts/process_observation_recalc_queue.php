<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/ObservationRecalcQueue.php';

$limit = isset($argv[1]) && is_numeric($argv[1]) ? (int)$argv[1] : 100;
$result = ObservationRecalcQueue::processPending($limit);

echo "processed={$result['processed']} failed={$result['failed']}\n";
