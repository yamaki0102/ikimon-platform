<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/JobRunner.php';

$limit = isset($argv[1]) ? max(1, (int)$argv[1]) : 8;
$result = JobRunner::run(['ai_batch', 'ai_deep', 'embedding', 'recalc'], [
    'ai_batch_limit' => $limit,
    'ai_deep_limit' => min(2, $limit),
    'embedding_limit' => 4,
    'recalc_limit' => 50,
]);
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
