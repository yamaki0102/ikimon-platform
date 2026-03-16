<?php

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/AiBudgetGuard.php';
require_once __DIR__ . '/AiObservationAssessment.php';
require_once __DIR__ . '/AsyncJobMetrics.php';

class AiAssessmentQueue
{
    private const FILE = 'system/ai_assessment_queue';
    private const MAX_ATTEMPTS = 3;

    public static function enqueue(string $observationId, string $reason, array $options = []): void
    {
        if ($observationId === '') {
            return;
        }

        $lane = self::resolveLane($reason, $options['lane'] ?? null);
        $now = date('c');

        DataStore::upsert(self::FILE, [
            'id' => $observationId . ':' . $lane,
            'observation_id' => $observationId,
            'lane' => $lane,
            'reason' => $reason,
            'priority' => isset($options['priority']) ? (int)$options['priority'] : self::defaultPriority($lane),
            'status' => 'pending',
            'attempts' => 0,
            'requested_at' => $now,
            'updated_at' => $now,
            'next_run_at' => $options['next_run_at'] ?? self::defaultNextRunAt($lane),
            'estimated_cost_usd' => isset($options['estimated_cost_usd']) ? round((float)$options['estimated_cost_usd'], 6) : null,
            'last_error' => null,
            'last_result' => null,
        ]);
    }

    public static function planForObservation(array $observation, string $reason = 'observation_created'): ?array
    {
        if (!AiObservationAssessment::isConfigured()) {
            return null;
        }

        if (empty($observation['photos']) || !is_array($observation['photos'])) {
            return null;
        }

        $reason = trim($reason);
        $hasHumanTaxon = self::hasHumanTaxon($observation);
        $needsId = self::needsIdentification($observation);
        $hasConflict = !empty($observation['quality_flags']['has_lineage_conflict']);
        $hasMachineAssessment = self::hasMachineAssessment($observation);

        return match ($reason) {
            'observation_created' => (!$hasHumanTaxon && $needsId) ? ['lane' => 'fast', 'reason' => $reason] : null,
            'photo_added' => ($needsId || $hasConflict) ? ['lane' => 'batch', 'reason' => $reason] : null,
            'identification_updated', 'observation_refreshed' => (($needsId || $hasConflict || !$hasMachineAssessment) ? ['lane' => 'batch', 'reason' => $reason] : null),
            'manual_deep_review' => ['lane' => 'deep', 'reason' => $reason],
            default => (!$hasHumanTaxon && $needsId) ? ['lane' => 'fast', 'reason' => $reason] : null,
        };
    }

    public static function processPending(int $limit = 20, array $options = []): array
    {
        $lockPath = DATA_DIR . '/locks/ai_assessment_queue.lock';
        @mkdir(dirname($lockPath), 0755, true);
        $lockFp = fopen($lockPath, 'c+');
        if ($lockFp === false || !flock($lockFp, LOCK_EX | LOCK_NB)) {
            if ($lockFp) { fclose($lockFp); }
            return ['processed' => 0, 'failed' => 0, 'completed' => 0, 'deferred' => 0, 'queued_followups' => 0, 'locked' => true];
        }

        try {
        $startedAt = microtime(true);
        $queue = DataStore::get(self::FILE, 0);
        if (!is_array($queue) || empty($queue)) {
            $result = ['processed' => 0, 'failed' => 0, 'completed' => 0, 'deferred' => 0, 'queued_followups' => 0, 'queue_snapshot' => self::buildQueueSnapshot([], time())];
            AsyncJobMetrics::recordQueueRun('ai_assessment', $result + ['duration_ms' => 0]);
            return $result;
        }

        $laneFilter = isset($options['lane']) ? self::normalizeLane((string)$options['lane']) : null;
        $assessmentBuilder = $options['assessment_builder'] ?? null;
        $nowTs = isset($options['now']) ? (int)$options['now'] : time();

        $processed = 0;
        $failed = 0;
        $completed = 0;
        $deferred = 0;
        $queuedFollowups = 0;

        foreach (self::dueIndexes($queue, $laneFilter, $nowTs) as $index) {
            if ($processed >= $limit) {
                break;
            }

            $item = $queue[$index];
            $lane = self::normalizeLane((string)($item['lane'] ?? 'fast'));
            $observationId = (string)($item['observation_id'] ?? '');
            if ($observationId === '') {
                $queue[$index] = self::markFailed($item, 'Observation id missing', $nowTs);
                $failed++;
                continue;
            }

            $observation = DataStore::findById('observations', $observationId);
            if (!$observation) {
                $queue[$index] = self::markFailed($item, 'Observation not found', $nowTs);
                $failed++;
                continue;
            }

            $estimatedCost = (float)($item['estimated_cost_usd'] ?? AiObservationAssessment::estimateCostUsd($observation, $lane));
            if (!AiBudgetGuard::canSpend($lane, $estimatedCost)) {
                $queue[$index] = self::markDeferred($item, 'budget_deferred', self::nextBudgetWindow($nowTs));
                $deferred++;
                continue;
            }

            $processed++;
            $budgetCommitted = false;

            try {
                $assessment = is_callable($assessmentBuilder)
                    ? $assessmentBuilder($observation, ['lane' => $lane], $item)
                    : AiObservationAssessment::buildAssessmentForObservation($observation, ['lane' => $lane]);

                if ($assessment === null) {
                    $queue[$index] = self::markDone($item, 'skipped');
                    $completed++;
                    continue;
                }

                AiBudgetGuard::commit($lane, $estimatedCost, (string)$item['id']);
                $budgetCommitted = true;

                self::saveAssessmentToObservation($observation, $assessment);
                $queue[$index] = self::markDone($item, 'completed');
                $completed++;

                $followup = self::buildFollowupOptions($assessment, $observation, $nowTs, $lane);
                if ($followup !== null) {
                    $queue = self::upsertQueueItem($queue, $observationId, $followup['reason'], [
                        'lane' => $followup['lane'],
                        'priority' => $followup['priority'],
                        'next_run_at' => $followup['next_run_at'],
                    ]);
                    $queuedFollowups++;
                }
            } catch (\Throwable $e) {
                if (!$budgetCommitted) {
                    AiBudgetGuard::commit($lane, $estimatedCost, (string)$item['id']);
                }
                if ($lane === 'fast') {
                    $queue = self::upsertQueueItem($queue, $observationId, 'manual_deep_review', [
                        'lane' => 'deep',
                        'priority' => 24,
                        'next_run_at' => date('c', $nowTs + 300),
                    ]);
                    $queuedFollowups++;
                }
                $queue[$index] = self::markFailed($item, mb_substr($e->getMessage(), 0, 160), $nowTs);
                $failed++;
            }
        }

        DataStore::save(self::FILE, array_values($queue));

        $result = [
            'processed' => $processed,
            'failed' => $failed,
            'completed' => $completed,
            'deferred' => $deferred,
            'queued_followups' => $queuedFollowups,
            'lane' => $laneFilter ?? 'all',
            'budget' => AiBudgetGuard::snapshot(),
            'queue_snapshot' => self::buildQueueSnapshot($queue, $nowTs),
        ];
        $result['duration_ms'] = (int)round((microtime(true) - $startedAt) * 1000);
        AsyncJobMetrics::recordQueueRun('ai_assessment', $result);
        return $result;
        } finally {
            flock($lockFp, LOCK_UN);
            fclose($lockFp);
        }
    }

    public static function snapshot(): array
    {
        return self::buildQueueSnapshot(DataStore::get(self::FILE, 0), time());
    }

    public static function processImmediate(array $observation, array $options = []): ?array
    {
        $lane = self::normalizeLane((string)($options['lane'] ?? 'fast'));
        $assessmentBuilder = $options['assessment_builder'] ?? null;

        $assessment = is_callable($assessmentBuilder)
            ? $assessmentBuilder($observation, ['lane' => $lane], null)
            : AiObservationAssessment::buildAssessmentForObservation($observation, ['lane' => $lane]);

        if ($assessment === null) {
            return null;
        }

        $followup = self::buildFollowupOptions($assessment, $observation, time(), $lane);
        if ($followup !== null) {
            self::enqueue((string)($observation['id'] ?? ''), $followup['reason'], [
                'lane' => $followup['lane'],
                'priority' => $followup['priority'],
                'next_run_at' => $followup['next_run_at'],
            ]);
        }

        self::saveAssessmentToObservation($observation, $assessment);

        return $assessment;
    }

    private static function saveAssessmentToObservation(array $observation, array $assessment): void
    {
        if (empty($assessment['id'])) {
            $assessment['id'] = 'ai-' . substr(bin2hex(random_bytes(8)), 0, 12);
        }
        $assessment['kind'] = $assessment['kind'] ?? 'machine_assessment';
        $assessment['created_at'] = $assessment['created_at'] ?? date('Y-m-d H:i:s');

        $observation['ai_assessment_status'] = 'completed';
        $observation['ai_assessment_updated_at'] = date('Y-m-d H:i:s');
        $observation['ai_assessments'] = array_values(array_filter(
            $observation['ai_assessments'] ?? [],
            fn($entry) => (string)($entry['kind'] ?? '') !== 'machine_assessment'
        ));
        $observation['ai_assessments'][] = $assessment;
        $observation['updated_at'] = date('Y-m-d H:i:s');
        DataStore::upsert('observations', $observation);
    }

    private static function buildQueueSnapshot(array $queue, int $nowTs): array
    {
        $pending = 0;
        $failed = 0;
        $done = 0;
        $oldestPending = null;
        $byLane = [
            'fast' => 0,
            'batch' => 0,
            'deep' => 0,
        ];

        foreach ($queue as $item) {
            $status = (string)($item['status'] ?? 'pending');
            $lane = self::normalizeLane((string)($item['lane'] ?? 'fast'));
            if ($status === 'pending') {
                $pending++;
                $byLane[$lane] = ($byLane[$lane] ?? 0) + 1;
                $requestedAt = strtotime((string)($item['requested_at'] ?? ''));
                if ($requestedAt !== false) {
                    $age = max(0, $nowTs - $requestedAt);
                    $oldestPending = $oldestPending === null ? $age : max($oldestPending, $age);
                }
            } elseif ($status === 'failed') {
                $failed++;
            } elseif ($status === 'done') {
                $done++;
            }
        }

        return [
            'pending' => $pending,
            'failed' => $failed,
            'done' => $done,
            'oldest_pending_seconds' => $oldestPending ?? 0,
            'by_lane' => $byLane,
        ];
    }

    private static function dueIndexes(array $queue, ?string $laneFilter, int $nowTs): array
    {
        $candidates = [];
        foreach ($queue as $index => $item) {
            if (($item['status'] ?? 'pending') !== 'pending') {
                continue;
            }

            $lane = self::normalizeLane((string)($item['lane'] ?? 'fast'));
            if ($laneFilter !== null && $lane !== $laneFilter) {
                continue;
            }

            $nextRunAt = strtotime((string)($item['next_run_at'] ?? ''));
            if ($nextRunAt !== false && $nextRunAt > $nowTs) {
                continue;
            }

            $candidates[] = [
                'index' => $index,
                'priority' => (int)($item['priority'] ?? self::defaultPriority($lane)),
                'requested_at' => strtotime((string)($item['requested_at'] ?? '')) ?: 0,
            ];
        }

        usort($candidates, static function (array $a, array $b): int {
            if ($a['priority'] !== $b['priority']) {
                return $b['priority'] <=> $a['priority'];
            }
            return $a['requested_at'] <=> $b['requested_at'];
        });

        return array_column($candidates, 'index');
    }

    private static function shouldQueueBatchFollowup(array $assessment, array $observation): bool
    {
        $hasHumanAgreement = count($observation['identifications'] ?? []) >= 2
            && !empty($observation['taxon']['id'] ?? null);
        if ($hasHumanAgreement) {
            return false;
        }

        if (self::hasHumanTaxon($observation)) {
            return false;
        }

        if (empty($assessment['recommended_taxon'])) {
            return true;
        }

        $recommendedRank = (string)($assessment['recommended_taxon']['rank'] ?? '');
        if (in_array($recommendedRank, ['order', 'class', 'phylum', 'kingdom', 'unknown'], true)) {
            return true;
        }

        $similarCount = count($assessment['similar_taxa_to_compare'] ?? []);
        $disagreement = (string)($assessment['candidate_disagreement'] ?? '');

        if ($similarCount >= 2 && in_array($disagreement, [
            'shared_lineage',
            'broad_lineage_only',
            'unresolved',
        ], true)) {
            return true;
        }

        return false;
    }

    private static function shouldQueueDeepFollowup(array $assessment, array $observation): bool
    {
        if (self::hasHumanTaxon($observation)) {
            return false;
        }

        $model = (string)($assessment['model'] ?? '');
        if ($model === 'system-fallback') {
            return true;
        }

        return empty($assessment['recommended_taxon'])
            && count($observation['photos'] ?? []) >= 2;
    }

    private static function buildFollowupOptions(array $assessment, array $observation, int $nowTs, string $lane): ?array
    {
        if ($lane === 'fast' && self::shouldQueueDeepFollowup($assessment, $observation)) {
            return [
                'reason' => 'manual_deep_review',
                'lane' => 'deep',
                'priority' => 24,
                'next_run_at' => date('c', $nowTs + 300),
            ];
        }

        if ($lane === 'fast' && self::shouldQueueBatchFollowup($assessment, $observation)) {
            return [
                'reason' => 'fast_followup',
                'lane' => 'batch',
                'priority' => 18,
                'next_run_at' => date('c', $nowTs + 1800),
            ];
        }

        if ($lane === 'batch' && self::shouldQueueDeepFollowup($assessment, $observation)) {
            return [
                'reason' => 'manual_deep_review',
                'lane' => 'deep',
                'priority' => 14,
                'next_run_at' => date('c', $nowTs + 300),
            ];
        }

        return null;
    }

    private static function markDone(array $item, string $result): array
    {
        $item['status'] = 'done';
        $item['updated_at'] = date('c');
        $item['attempts'] = (int)($item['attempts'] ?? 0) + 1;
        $item['last_result'] = $result;
        $item['last_error'] = null;
        return $item;
    }

    private static function markDeferred(array $item, string $reason, string $nextRunAt): array
    {
        $item['status'] = 'pending';
        $item['updated_at'] = date('c');
        $item['next_run_at'] = $nextRunAt;
        $item['last_result'] = $reason;
        return $item;
    }

    private static function markFailed(array $item, string $error, int $nowTs): array
    {
        $attempts = (int)($item['attempts'] ?? 0) + 1;
        $item['attempts'] = $attempts;
        $item['updated_at'] = date('c', $nowTs);
        $item['last_error'] = $error;

        if ($attempts >= self::MAX_ATTEMPTS) {
            $item['status'] = 'failed';
            $item['last_result'] = 'failed_permanently';
            return $item;
        }

        $item['status'] = 'pending';
        $item['next_run_at'] = date('c', $nowTs + self::retryDelaySeconds($attempts));
        $item['last_result'] = 'retry_scheduled';
        return $item;
    }

    private static function retryDelaySeconds(int $attempts): int
    {
        return min(21600, 600 * (2 ** max(0, $attempts - 1)));
    }

    private static function nextBudgetWindow(int $nowTs): string
    {
        $tomorrow = strtotime('tomorrow 02:10', $nowTs);
        return date('c', $tomorrow !== false ? $tomorrow : ($nowTs + 43200));
    }

    private static function defaultNextRunAt(string $lane): string
    {
        $offset = match ($lane) {
            'batch' => 900,
            'deep' => 3600,
            default => 0,
        };
        return date('c', time() + $offset);
    }

    private static function defaultPriority(string $lane): int
    {
        return match ($lane) {
            'deep' => 10,
            'batch' => 20,
            default => 30,
        };
    }

    private static function resolveLane(string $reason, mixed $explicitLane): string
    {
        if (is_string($explicitLane) && $explicitLane !== '') {
            return self::normalizeLane($explicitLane);
        }

        return match ($reason) {
            'fast_followup', 'photo_added', 'observation_refreshed', 'identification_updated' => 'batch',
            'manual_deep_review' => 'deep',
            default => 'fast',
        };
    }

    private static function normalizeLane(string $lane): string
    {
        return in_array($lane, ['fast', 'batch', 'deep'], true) ? $lane : 'fast';
    }

    private static function hasHumanTaxon(array $observation): bool
    {
        if (!empty($observation['taxon']['id'] ?? null) || !empty($observation['taxon']['name'] ?? null)) {
            return true;
        }

        foreach ($observation['identifications'] ?? [] as $identification) {
            if ((string)($identification['user_type'] ?? '') === 'ai') {
                continue;
            }
            if (!empty($identification['taxon_id'] ?? null) || !empty($identification['taxon_name'] ?? null)) {
                return true;
            }
        }

        return false;
    }

    private static function hasMachineAssessment(array $observation): bool
    {
        foreach ($observation['ai_assessments'] ?? [] as $assessment) {
            if ((string)($assessment['kind'] ?? '') === 'machine_assessment') {
                return true;
            }
        }
        return false;
    }

    private static function needsIdentification(array $observation): bool
    {
        $status = (string)($observation['status'] ?? '');
        return in_array($status, ['未同定', '要同定', '名前募集中', 'Needs ID', '調査中'], true)
            || !self::hasHumanTaxon($observation);
    }

    private static function upsertQueueItem(array $queue, string $observationId, string $reason, array $options = []): array
    {
        $lane = self::resolveLane($reason, $options['lane'] ?? null);
        $id = $observationId . ':' . $lane;
        $payload = [
            'id' => $id,
            'observation_id' => $observationId,
            'lane' => $lane,
            'reason' => $reason,
            'priority' => isset($options['priority']) ? (int)$options['priority'] : self::defaultPriority($lane),
            'status' => 'pending',
            'attempts' => 0,
            'requested_at' => date('c'),
            'updated_at' => date('c'),
            'next_run_at' => $options['next_run_at'] ?? self::defaultNextRunAt($lane),
            'estimated_cost_usd' => isset($options['estimated_cost_usd']) ? round((float)$options['estimated_cost_usd'], 6) : null,
            'last_error' => null,
            'last_result' => null,
        ];

        foreach ($queue as $existingIndex => $existingItem) {
            if (($existingItem['id'] ?? null) === $id) {
                $queue[$existingIndex] = array_merge($existingItem, $payload);
                return $queue;
            }
        }

        $queue[] = $payload;
        return $queue;
    }
}
