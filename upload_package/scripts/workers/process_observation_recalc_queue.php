<?php

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/JobRunner.php';

$limit = isset($argv[1]) && is_numeric($argv[1]) ? (int)$argv[1] : 100;
$result = JobRunner::run(['recalc'], ['recalc_limit' => $limit]);
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
