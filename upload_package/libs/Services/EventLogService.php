<?php

/**
 * EventLogService — 観察会ライフログ集約サービス
 *
 * ユーザーの観察会参加履歴・統計を集約するビューレイヤー。
 * 新しいデータストアは作らず、events.json + observations.json を横断クエリ。
 */

require_once __DIR__ . '/../DataStore.php';

class EventLogService
{
    /**
     * ユーザーの参加イベント一覧（年別グルーピング）
     *
     * @return array ['2026' => [...events], '2025' => [...events]]
     */
    public static function getUserEventHistory(string $userId): array
    {
        $allEvents = DataStore::fetchAll('events');
        $userEvents = [];

        foreach ($allEvents as $evt) {
            foreach (($evt['participants'] ?? []) as $p) {
                if (($p['user_id'] ?? '') === $userId) {
                    $evt['user_joined_at'] = $p['joined_at'] ?? null;
                    $evt['participant_count'] = count($evt['participants'] ?? []);
                    $userEvents[] = $evt;
                    break;
                }
            }
        }

        // Sort by event_date descending (newest first)
        usort($userEvents, fn($a, $b) => strcmp($b['event_date'] ?? '', $a['event_date'] ?? ''));

        // Group by year
        $byYear = [];
        foreach ($userEvents as $evt) {
            $year = substr($evt['event_date'] ?? '????', 0, 4);
            $byYear[$year][] = $evt;
        }

        return $byYear;
    }

    /**
     * 特定イベントでのユーザーの観察記録（または全参加者の記録）
     */
    public static function getEventObservations(string $eventId, ?string $userId = null): array
    {
        $allObs = DataStore::fetchAll('observations');
        $results = [];

        foreach ($allObs as $obs) {
            if (($obs['event_id'] ?? '') !== $eventId) continue;
            if ($userId && ($obs['user_id'] ?? '') !== $userId) continue;
            $results[] = $obs;
        }

        // Sort by created_at descending
        usort($results, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));

        return $results;
    }

    /**
     * ユーザーの観察会サマリー統計
     *
     * @return array ['event_count', 'total_observations', 'unique_species', 'first_event_date']
     */
    public static function getUserEventStats(string $userId): array
    {
        $history = self::getUserEventHistory($userId);
        $eventCount = 0;
        $eventIds = [];
        $firstDate = null;

        foreach ($history as $year => $events) {
            foreach ($events as $evt) {
                $eventCount++;
                $eventIds[] = $evt['id'];
                $d = $evt['event_date'] ?? null;
                if ($d && (!$firstDate || $d < $firstDate)) {
                    $firstDate = $d;
                }
            }
        }

        // Count observations from these events
        $totalObs = 0;
        $species = [];
        if (!empty($eventIds)) {
            $allObs = DataStore::fetchAll('observations');
            foreach ($allObs as $obs) {
                if (in_array($obs['event_id'] ?? '', $eventIds) && ($obs['user_id'] ?? '') === $userId) {
                    $totalObs++;
                    $sp = $obs['species_name'] ?? $obs['common_name'] ?? '';
                    if ($sp) $species[$sp] = true;
                }
            }
        }

        return [
            'event_count' => $eventCount,
            'total_observations' => $totalObs,
            'unique_species' => count($species),
            'first_event_date' => $firstDate,
        ];
    }
}
