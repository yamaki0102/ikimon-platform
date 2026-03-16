<?php

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/EmbeddingService.php';
require_once __DIR__ . '/EmbeddingStore.php';
require_once __DIR__ . '/AsyncJobMetrics.php';

class EmbeddingQueue
{
    private const FILE = 'system/embedding_queue';
    private const MAX_ATTEMPTS = 3;

    public static function enqueue(string $observationId, string $reason = 'observation_created', array $options = []): void
    {
        if ($observationId === '') {
            return;
        }

        $now = date('c');
        DataStore::upsert(self::FILE, [
            'id' => $observationId,
            'observation_id' => $observationId,
            'reason' => $reason,
            'status' => 'pending',
            'attempts' => 0,
            'requested_at' => $now,
            'updated_at' => $now,
            'next_run_at' => $options['next_run_at'] ?? $now,
            'last_error' => null,
            'last_result' => null,
        ]);
    }

    public static function shouldQueueObservation(array $observation): bool
    {
        return !empty($observation['photos'])
            || trim((string)($observation['note'] ?? '')) !== ''
            || trim((string)($observation['taxon']['name'] ?? '')) !== '';
    }

    public static function snapshot(): array
    {
        return self::buildQueueSnapshot(DataStore::get(self::FILE, 0), time());
    }

    public static function processPending(int $limit = 20): array
    {
        $lockPath = DATA_DIR . '/locks/embedding_queue.lock';
        @mkdir(dirname($lockPath), 0755, true);
        $lockFp = fopen($lockPath, 'c+');
        if ($lockFp === false || !flock($lockFp, LOCK_EX | LOCK_NB)) {
            if ($lockFp) { fclose($lockFp); }
            return ['processed' => 0, 'failed' => 0, 'completed' => 0, 'skipped' => 0, 'locked' => true];
        }

        try {
        $startedAt = microtime(true);
        $queue = DataStore::get(self::FILE, 0);
        if (!is_array($queue) || $queue === []) {
            $result = [
                'processed' => 0,
                'failed' => 0,
                'completed' => 0,
                'skipped' => 0,
                'queue_snapshot' => self::buildQueueSnapshot([], time()),
            ];
            AsyncJobMetrics::recordQueueRun('embedding', $result + ['duration_ms' => 0]);
            return $result;
        }

        $processed = 0;
        $failed = 0;
        $completed = 0;
        $skipped = 0;
        $nowTs = time();
        $service = new EmbeddingService();

        foreach (self::dueIndexes($queue, $nowTs) as $index) {
            if ($processed >= $limit) {
                break;
            }

            $processed++;
            $item = $queue[$index];
            $observationId = (string)($item['observation_id'] ?? '');
            $observation = $observationId !== '' ? DataStore::findById('observations', $observationId) : null;
            if (!$observation) {
                $queue[$index] = self::markFailed($item, 'Observation not found');
                $failed++;
                continue;
            }

            try {
                $savedModes = [];
                $embedding = $service->embedObservation($observation);
                if ($embedding) {
                    $embeddingText = EmbeddingService::prepareObservationText($observation);
                    EmbeddingStore::save('observations', $observationId, $embedding['vector'], [
                        'mode' => $embedding['mode'],
                        'text' => mb_substr($embeddingText, 0, 200),
                        'has_photo' => !empty($observation['photos']),
                    ]);
                    $savedModes[] = $embedding['mode'];
                }

                if (!empty($observation['photos'])) {
                    $photoVector = $service->embedObservationPhoto($observation);
                    if ($photoVector) {
                        EmbeddingStore::save('photos', $observationId, $photoVector, ['mode' => 'photo_only']);
                        $savedModes[] = 'photo_only';
                    }
                }

                if ($savedModes === []) {
                    $queue[$index] = self::markDone($item, 'skipped');
                    DataStore::upsert('observations', [
                        'id' => $observationId,
                        'embedding_status' => 'skipped',
                        'embedding_updated_at' => date('Y-m-d H:i:s'),
                    ]);
                    $skipped++;
                    continue;
                }

                $queue[$index] = self::markDone($item, implode(',', array_unique($savedModes)));
                DataStore::upsert('observations', [
                    'id' => $observationId,
                    'embedding_status' => 'completed',
                    'embedding_updated_at' => date('Y-m-d H:i:s'),
                ]);
                $completed++;
            } catch (\Throwable $e) {
                $queue[$index] = self::markFailed($item, mb_substr($e->getMessage(), 0, 160));
                DataStore::upsert('observations', [
                    'id' => $observationId,
                    'embedding_status' => 'failed',
                    'embedding_updated_at' => date('Y-m-d H:i:s'),
                ]);
                $failed++;
            }
        }

        DataStore::save(self::FILE, array_values($queue));

        $result = [
            'processed' => $processed,
            'failed' => $failed,
            'completed' => $completed,
            'skipped' => $skipped,
            'queue_snapshot' => self::buildQueueSnapshot($queue, $nowTs),
        ];
        $result['duration_ms'] = (int)round((microtime(true) - $startedAt) * 1000);
        AsyncJobMetrics::recordQueueRun('embedding', $result);

        return $result;
        } finally {
            flock($lockFp, LOCK_UN);
            fclose($lockFp);
        }
    }

    private static function dueIndexes(array $queue, int $nowTs): array
    {
        $indexes = [];
        foreach ($queue as $index => $item) {
            if (($item['status'] ?? 'pending') !== 'pending') {
                continue;
            }

            $nextRunAt = strtotime((string)($item['next_run_at'] ?? ''));
            if ($nextRunAt !== false && $nextRunAt > $nowTs) {
                continue;
            }

            $indexes[] = [
                'index' => $index,
                'requested_at' => strtotime((string)($item['requested_at'] ?? '')) ?: 0,
            ];
        }

        usort($indexes, static fn(array $a, array $b): int => $a['requested_at'] <=> $b['requested_at']);
        return array_column($indexes, 'index');
    }

    private static function markDone(array $item, string $result): array
    {
        $item['status'] = 'done';
        $item['updated_at'] = date('c');
        $item['last_result'] = $result;
        $item['last_error'] = null;
        return $item;
    }

    private static function markFailed(array $item, string $error): array
    {
        $attempts = (int)($item['attempts'] ?? 0) + 1;
        $item['attempts'] = $attempts;
        $item['updated_at'] = date('c');
        $item['last_error'] = $error;
        $item['last_result'] = 'failed';
        if ($attempts >= self::MAX_ATTEMPTS) {
            $item['status'] = 'failed';
            return $item;
        }

        $item['status'] = 'pending';
        $item['next_run_at'] = date('c', time() + 300);
        return $item;
    }

    private static function buildQueueSnapshot(array $queue, int $nowTs): array
    {
        $pending = 0;
        $failed = 0;
        $done = 0;
        $oldestPending = null;

        foreach ($queue as $item) {
            $status = (string)($item['status'] ?? 'pending');
            if ($status === 'pending') {
                $pending++;
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
        ];
    }
}
