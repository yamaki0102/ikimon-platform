<?php

require_once __DIR__ . '/AiAssessmentQueue.php';
require_once __DIR__ . '/EmbeddingQueue.php';
require_once __DIR__ . '/ObservationRecalcQueue.php';
require_once __DIR__ . '/AsyncJobMetrics.php';
require_once __DIR__ . '/QueueHealthNotifier.php';

class JobRunner
{
    public static function run(array $jobs, array $options = []): array
    {
        $results = [];
        foreach ($jobs as $job) {
            $job = (string)$job;
            switch ($job) {
                case 'ai_fast':
                    $results[$job] = AiAssessmentQueue::processPending((int)($options['ai_fast_limit'] ?? 3), ['lane' => 'fast']);
                    break;
                case 'ai_batch':
                    $results[$job] = AiAssessmentQueue::processPending((int)($options['ai_batch_limit'] ?? 8), ['lane' => 'batch']);
                    break;
                case 'ai_deep':
                    $results[$job] = AiAssessmentQueue::processPending((int)($options['ai_deep_limit'] ?? 2), ['lane' => 'deep']);
                    break;
                case 'embedding':
                    $results[$job] = EmbeddingQueue::processPending((int)($options['embedding_limit'] ?? 4));
                    break;
                case 'recalc':
                    $results[$job] = ObservationRecalcQueue::processPending((int)($options['recalc_limit'] ?? 50));
                    break;
            }
        }

        $queueSnapshots = [
            'ai_assessment' => AiAssessmentQueue::snapshot(),
            'embedding' => EmbeddingQueue::snapshot(),
            'observation_recalc' => ObservationRecalcQueue::snapshot(),
        ];
        $postLatency = AsyncJobMetrics::summarizePostLatency(20);
        $alerts = QueueHealthNotifier::evaluate($queueSnapshots, $postLatency);

        return [
            'jobs' => $results,
            'snapshots' => $queueSnapshots,
            'post_latency' => $postLatency,
            'alerts' => $alerts,
        ];
    }
}
