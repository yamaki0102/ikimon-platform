<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/JobRunner.php';

$profile = $argv[1] ?? 'fast';

$profiles = [
    'fast' => [
        'jobs' => ['ai_fast', 'embedding', 'recalc'],
        'options' => ['ai_fast_limit' => 3, 'embedding_limit' => 4, 'recalc_limit' => 25],
    ],
    'batch' => [
        'jobs' => ['ai_batch', 'ai_deep', 'embedding', 'recalc'],
        'options' => ['ai_batch_limit' => 8, 'ai_deep_limit' => 2, 'embedding_limit' => 8, 'recalc_limit' => 50],
    ],
    'deep' => [
        'jobs' => ['ai_deep', 'embedding', 'recalc'],
        'options' => ['ai_deep_limit' => 2, 'embedding_limit' => 4, 'recalc_limit' => 50],
    ],
];

if (!isset($profiles[$profile])) {
    fwrite(STDERR, "Unknown profile: {$profile}\n");
    exit(1);
}

$result = JobRunner::run($profiles[$profile]['jobs'], $profiles[$profile]['options']);
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
