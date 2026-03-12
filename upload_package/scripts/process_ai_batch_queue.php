<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/AiAssessmentQueue.php';

$limit = isset($argv[1]) ? max(1, (int)$argv[1]) : 8;
$batchResult = AiAssessmentQueue::processPending($limit, ['lane' => 'batch']);
$deepResult = AiAssessmentQueue::processPending($limit, ['lane' => 'deep']);

echo json_encode([
    'batch' => $batchResult,
    'deep' => $deepResult,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
