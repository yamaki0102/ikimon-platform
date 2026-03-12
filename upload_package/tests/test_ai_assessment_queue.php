<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/AiAssessmentQueue.php';

function assertQueueTrue(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assertQueueSame($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        throw new RuntimeException($message . ' expected=' . var_export($expected, true) . ' actual=' . var_export($actual, true));
    }
}

function setupQueueSandbox(string $name): string
{
    $base = sys_get_temp_dir() . '/ikimon-ai-queue-' . $name . '-' . bin2hex(random_bytes(4));
    @mkdir($base . '/observations', 0777, true);
    @mkdir($base . '/system', 0777, true);
    DataStore::setPath($base);
    DataStore::save('observations', []);
    DataStore::save('system/ai_assessment_queue', []);
    DataStore::save('system/ai_budget_daily', []);
    return $base;
}

function findQueueEntry(array $queue, string $id): ?array
{
    foreach ($queue as $item) {
        if (($item['id'] ?? null) === $id) {
            return $item;
        }
    }
    return null;
}

putenv('IKIMON_AI_FAST_DAILY_BUDGET_USD=1');
putenv('IKIMON_AI_BATCH_DAILY_BUDGET_USD=1');
putenv('IKIMON_AI_DEEP_DAILY_BUDGET_USD=1');

setupQueueSandbox('followup');
DataStore::save('observations', [[
    'id' => 'obs-1',
    'photos' => ['uploads/example/photo_0.webp'],
    'identifications' => [],
    'ai_assessments' => [],
]]);

AiAssessmentQueue::enqueue('obs-1', 'observation_created', ['lane' => 'fast']);
$result = AiAssessmentQueue::processPending(1, [
    'lane' => 'fast',
    'assessment_builder' => static function (array $observation, array $options): array {
        return [
            'id' => 'ai-test-1',
            'kind' => 'machine_assessment',
            'created_at' => '2026-03-11 00:00:00',
            'model' => 'test-model',
            'processing_lane' => $options['lane'] ?? 'fast',
            'candidate_disagreement' => 'shared_lineage',
            'similar_taxa_to_compare' => ['A', 'B'],
            'recommended_taxon' => ['id' => 'gbif:10', 'name' => 'キク科', 'rank' => 'family'],
        ];
    },
]);

assertQueueSame(1, $result['completed'], 'fast lane should complete one job');
assertQueueSame(1, $result['queued_followups'], 'fast lane should queue one batch followup');

$queue = DataStore::get('system/ai_assessment_queue', 0);
assertQueueSame('done', findQueueEntry($queue, 'obs-1:fast')['status'] ?? null, 'fast job should be marked done');
assertQueueSame('pending', findQueueEntry($queue, 'obs-1:batch')['status'] ?? null, 'batch followup should be pending');

$savedObservation = DataStore::findById('observations', 'obs-1');
assertQueueSame('completed', $savedObservation['ai_assessment_status'] ?? null, 'observation should store completed assessment');
assertQueueTrue(count($savedObservation['ai_assessments'] ?? []) === 1, 'observation should contain machine assessment');

assertQueueSame(null, AiAssessmentQueue::planForObservation([
    'photos' => ['uploads/example/photo_0.webp'],
    'status' => '要同定',
    'taxon' => ['id' => 'gbif:10', 'name' => 'キク科'],
    'identifications' => [[
        'user_type' => 'human',
        'taxon_id' => 'gbif:10',
        'taxon_name' => 'キク科',
    ]],
], 'observation_created'), 'human-identified observations should skip fast AI on create');

assertQueueSame('fast', AiAssessmentQueue::planForObservation([
    'photos' => ['uploads/example/photo_0.webp'],
    'status' => '未同定',
    'taxon' => null,
    'identifications' => [],
], 'observation_created')['lane'] ?? null, 'unidentified observations should still use fast AI');

setupQueueSandbox('budget');
DataStore::save('observations', [[
    'id' => 'obs-2',
    'photos' => ['uploads/example/photo_0.webp'],
    'identifications' => [],
    'ai_assessments' => [],
]]);

putenv('IKIMON_AI_FAST_DAILY_BUDGET_USD=0');
AiAssessmentQueue::enqueue('obs-2', 'observation_created', ['lane' => 'fast']);
$deferred = AiAssessmentQueue::processPending(1, [
    'lane' => 'fast',
    'assessment_builder' => static function (): array {
        throw new RuntimeException('builder should not run when budget is exhausted');
    },
]);

assertQueueSame(1, $deferred['deferred'], 'budget exhaustion should defer the job');
$queue = DataStore::get('system/ai_assessment_queue', 0);
$budgetJob = findQueueEntry($queue, 'obs-2:fast');
assertQueueSame('pending', $budgetJob['status'] ?? null, 'budget-deferred job should remain pending');
assertQueueTrue(!empty($budgetJob['next_run_at']), 'budget-deferred job should have a next run time');

putenv('IKIMON_AI_FAST_DAILY_BUDGET_USD=1');

echo "OK\n";
