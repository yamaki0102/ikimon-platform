<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/JobRunner.php';

$limit = isset($argv[1]) ? max(1, (int)$argv[1]) : 2;
$result = JobRunner::run(['ai_deep'], ['ai_deep_limit' => $limit]);
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
