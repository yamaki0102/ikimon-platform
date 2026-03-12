<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/AiAssessmentQueue.php';

$limit = isset($argv[1]) ? max(1, (int)$argv[1]) : 3;
$result = AiAssessmentQueue::processPending($limit, ['lane' => 'fast']);
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
