<?php

/**
 * ObservationRecalcQueue - lightweight JSON-backed recalculation queue
 */

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/BioUtils.php';
require_once __DIR__ . '/Taxonomy.php';
require_once __DIR__ . '/AsyncJobMetrics.php';

class ObservationRecalcQueue
{
    private const FILE = 'system/observation_recalc_queue';

    public static function enqueue(string $observationId, string $reason): void
    {
        if ($observationId === '') {
            return;
        }

        DataStore::upsert(self::FILE, [
            'id' => $observationId,
            'observation_id' => $observationId,
            'reason' => $reason,
            'status' => 'pending',
            'attempts' => 0,
            'requested_at' => date('c'),
            'updated_at' => date('c'),
        ]);
    }

    public static function processPending(int $limit = 100): array
    {
        $lockPath = DATA_DIR . '/locks/observation_recalc_queue.lock';
        @mkdir(dirname($lockPath), 0755, true);
        $lockFp = fopen($lockPath, 'c+');
        if ($lockFp === false || !flock($lockFp, LOCK_EX | LOCK_NB)) {
            if ($lockFp) { fclose($lockFp); }
            return ['processed' => 0, 'failed' => 0, 'completed' => 0, 'locked' => true];
        }

        try {
        $startedAt = microtime(true);
        $queue = DataStore::get(self::FILE, 0);
        if (!is_array($queue) || empty($queue)) {
            $result = ['processed' => 0, 'failed' => 0, 'completed' => 0, 'queue_snapshot' => self::snapshot()];
            AsyncJobMetrics::recordQueueRun('observation_recalc', $result + ['duration_ms' => 0]);
            return $result;
        }

        $processed = 0;
        $failed = 0;
        $completed = 0;

        foreach ($queue as $index => $item) {
            if ($processed >= $limit) {
                break;
            }
            if (($item['status'] ?? 'pending') !== 'pending') {
                continue;
            }

            $obsId = (string)($item['observation_id'] ?? $item['id'] ?? '');
            $obs = DataStore::findById('observations', $obsId);
            if (!$obs) {
                $queue[$index]['status'] = 'failed';
                $queue[$index]['updated_at'] = date('c');
                $queue[$index]['last_error'] = 'Observation not found';
                $queue[$index]['attempts'] = (int)($queue[$index]['attempts'] ?? 0) + 1;
                $failed++;
                $processed++;
                continue;
            }

            $changed = false;
            foreach (($obs['identifications'] ?? []) as $idIndex => $identification) {
                $canonical = Taxonomy::resolveFromInput($identification);
                $normalized = array_merge($identification, Taxonomy::toIdentificationFields($canonical));
                if ($normalized !== $identification) {
                    $obs['identifications'][$idIndex] = $normalized;
                    $changed = true;
                }
            }

            BioUtils::updateConsensus($obs);
            $obs['updated_at'] = date('Y-m-d H:i:s');
            DataStore::upsert('observations', $obs);

            $queue[$index]['status'] = 'done';
            $queue[$index]['updated_at'] = date('c');
            $queue[$index]['attempts'] = (int)($queue[$index]['attempts'] ?? 0) + 1;
            $queue[$index]['last_result'] = $changed ? 'normalized+recalculated' : 'recalculated';
            $processed++;
            $completed++;
        }

        DataStore::save(self::FILE, array_values($queue));

        $result = [
            'processed' => $processed,
            'failed' => $failed,
            'completed' => $completed,
            'queue_snapshot' => self::buildQueueSnapshot($queue, time()),
            'duration_ms' => (int)round((microtime(true) - $startedAt) * 1000),
        ];
        AsyncJobMetrics::recordQueueRun('observation_recalc', $result);
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

    private static function buildQueueSnapshot(array $queue, int $nowTs): array
    {
        $pending = 0;
        $failed = 0;
        $done = 0;
        $oldestPending = 0;

        foreach ($queue as $item) {
            $status = (string)($item['status'] ?? 'pending');
            if ($status === 'pending') {
                $pending++;
                $requestedAt = strtotime((string)($item['requested_at'] ?? ''));
                if ($requestedAt !== false) {
                    $oldestPending = max($oldestPending, max(0, $nowTs - $requestedAt));
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
            'oldest_pending_seconds' => $oldestPending,
        ];
    }
}
