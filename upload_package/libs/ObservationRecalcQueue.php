<?php

/**
 * ObservationRecalcQueue - lightweight JSON-backed recalculation queue
 */

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/BioUtils.php';
require_once __DIR__ . '/Taxonomy.php';

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
        $queue = DataStore::get(self::FILE, 0);
        if (!is_array($queue) || empty($queue)) {
            return ['processed' => 0, 'failed' => 0];
        }

        $processed = 0;
        $failed = 0;

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
        }

        DataStore::save(self::FILE, array_values($queue));

        return ['processed' => $processed, 'failed' => $failed];
    }
}
