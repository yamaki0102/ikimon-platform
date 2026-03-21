<?php

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/JobRunner.php';

$limit = 10;

foreach (array_slice($argv, 1) as $arg) {
    if (preg_match('/^\d+$/', $arg)) {
        $limit = max(1, (int)$arg);
        continue;
    }
    if (str_starts_with($arg, '--limit=')) {
        $limit = max(1, (int)substr($arg, 8));
    }
}

$result = JobRunner::run(['embedding'], ['embedding_limit' => $limit]);
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
