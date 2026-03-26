<?php

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/JobRunner.php';

$limit = isset($argv[1]) ? max(1, (int)$argv[1]) : 3;
$result = JobRunner::run(['ai_fast'], ['ai_fast_limit' => $limit]);
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
