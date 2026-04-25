<?php

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/Indexer.php';
require_once __DIR__ . '/Auth.php';
require_once __DIR__ . '/Cache.php';

class SurveyManager
{
    /**
     * Create and Start a new Survey Session
     *
     * @param string $userId
     * @param string $protocol 'stationary' | 'traveling' | 'casual'
     * @param string|null $fieldId Optional My Field ID
     * @param array $party Array of member IDs or guest names
     * @param string|null $eventTag Optional Event Code/Tag
     * @return array The created survey object
     */
    public static function create(string $userId, string $protocol, ?string $fieldId = null, array $party = [], ?string $eventTag = null): array
    {
        $id = 'srv_' . bin2hex(random_bytes(8));
        $now = date('c');

        $survey = [
            'id' => $id,
            'user_id' => $userId,
            'status' => 'running',
            'protocol' => $protocol,
            'field_id' => $fieldId,
            'event_tag' => $eventTag, // New field
            'party' => [
                'members' => [], // User IDs
                'guests' => []   // Guest names
            ],
            'started_at' => $now,
            'created_at' => $now,
            'stats' => [ // Initial stats
                'duration_min' => 0,
                'distance_m' => 0,
                'obs_count' => 0,
                'sp_count' => 0,
            ],
            'context' => [],
            'tracks' => []
        ];

        // Process party members
        foreach ($party as $p) {
            // Simple heuristic to distinguish ID from name
            if (strpos($p, 'user_') === 0) {
                $survey['party']['members'][] = $p;
            } else {
                $survey['party']['guests'][] = $p;
            }
        }

        // Save to 'surveys/YYYY-MM'
        DataStore::append('surveys', $survey, strtotime($now));

        // Index owner
        Indexer::addToIndex("user_{$userId}_surveys", date('Y-m'), $id);

        // Index participants (if any)
        foreach ($survey['party']['members'] as $memberId) {
            Indexer::addToIndex("user_{$memberId}_surveys", date('Y-m'), $id);
        }

        // Index Event Tag (New)
        if ($eventTag) {
            // Normalize tag: uppercase, alphanumeric only
            $normalizedTag = preg_replace('/[^A-Z0-9_]/', '', strtoupper($eventTag));
            if ($normalizedTag) {
                // Index by tag (across all time or monthly? Let's do monthly first for scalability, but maybe global index for lookup?)
                // For MVP event, usually short-lived. Let's index by month like users.
                // Or maybe just a single list for the tag?
                // Let's stick to Y-m structure for consistency.
                Indexer::addToIndex("event_{$normalizedTag}_surveys", date('Y-m'), $id);
            }
        }

        // Set as active survey in user's temp state (optional, or just rely on status=running queries)
        // For MVP, query running surveys is fine, but caching active ID is faster.
        Cache::set("active_survey_{$userId}", $id, 86400); // 24h max

        return $survey;
    }

    /**
     * Get Survey by ID
     */
    public static function get(string $id): ?array
    {
        return DataStore::findById('surveys', $id);
    }

    /**
     * Get Active Survey for User
     */
    public static function getActive(string $userId): ?array
    {
        $cachedId = Cache::get("active_survey_{$userId}");
        if ($cachedId) {
            $survey = self::get($cachedId);
            if ($survey && ($survey['status'] ?? '') === 'running') {
                return $survey;
            }
            Cache::clear("active_survey_{$userId}");
        }

        // Fallback: search recent surveys
        // This is slow if not indexed by status. For MVP, assuming cache works mostly.
        // Or fetch latest user surveys and check status.
        $recent = DataStore::getLatest('surveys', 20, function ($item) use ($userId) {
            return ($item['user_id'] ?? '') === $userId && ($item['status'] ?? '') === 'running';
        });

        if (!empty($recent)) {
            $active = $recent[0];
            Cache::set("active_survey_{$userId}", $active['id'], 86400);
            return $active;
        }

        return null;
    }

    /**
     * Update Survey Stats / Context (Partial Update)
     */
    public static function update(string $id, array $updates): bool
    {
        $survey = self::get($id);
        if (!$survey) return false;

        $survey = array_merge($survey, $updates);

        // Recalculate duration if not explicitly set but running
        // (Implementation detail: usually done on finish)

        return DataStore::upsert('surveys', $survey);
    }

    /**
     * Finish Survey
     *
     * @param string $id
     * @param array $finalStats ['distance_m', 'obs_count', 'sp_count']
     * @param array $context ['weather', 'habitat', 'notes']
     */
    public static function finish(string $id, array $finalStats, array $context): ?array
    {
        $survey = self::get($id);
        if (!$survey || $survey['status'] !== 'running') return null;

        $now = time();
        $start = strtotime($survey['started_at']);
        $durationMin = floor(($now - $start) / 60);

        $survey['status'] = 'completed';
        $survey['ended_at'] = date('c', $now);

        // Merge stats
        $survey['stats']['duration_min'] = $durationMin;
        foreach ($finalStats as $k => $v) {
            $survey['stats'][$k] = $v;
        }

        // Merge context
        $survey['context'] = $context;

        // Calculate Quality Score (Draft Logic)
        $score = 50; // Base
        if ($survey['protocol'] !== 'casual') $score += 10;
        if (!empty($survey['context']['weather_type'])) $score += 5;
        if (!empty($survey['context']['temp_range']))   $score += 5;
        // Legacy fallback
        if (empty($survey['context']['weather_type']) && !empty($survey['context']['weather'])) $score += 5;
        if (!empty($survey['context']['notes'])) $score += 10;
        if (!empty($survey['party']['members']) || !empty($survey['party']['guests'])) $score += 5;
        // Duration bonus
        if ($durationMin > 30) $score += 5;
        if ($durationMin > 60) $score += 5;

        $survey['stats']['quality_score'] = min(100, $score);

        DataStore::upsert('surveys', $survey);

        // Clear active cache
        Cache::clear("active_survey_{$survey['user_id']}");

        // Trigger Rank Update on survey completion
        require_once __DIR__ . '/ObserverRank.php';
        ObserverRank::calculate($survey['user_id']);

        return $survey;
    }

    /**
     * List Surveys for User
     */
    public static function listByUser(string $userId, int $limit = 50, int $offset = 0): array
    {
        // Use Indexer to get IDs
        // Index key: "user_{$userId}_surveys" (content: "YYYY-MM", value: surveyId)
        // Actually DataStore::append logic:
        // Indexer::addToIndex("user_{$userId}_surveys", date('Y-m'), $id);
        // But Indexer::getFromIndex returns array of TARGET FILES/VALUES.
        // Default DataStore::append index logic uses 'date' as key? No, look at DataStore.php:80
        // Indexer::addToIndex("user_{$item['user_id']}_{$resource}", $date, $item['id']);
        // Key is user_ID_resource, Value is date.  Wait, Indexer structure is Key -> [Values]
        // If we add ($date, $id), then getting "user_ID_surveys" returns list of dates?
        // Let's verify DataStore logic. 
        // DataStore:80: Indexer::addToIndex("user_{$item['user_id']}_{$resource}", $date, $item['id']);
        // Indexer::addToIndex($key, $value, $subKey = null)
        // So Key=user_..._surveys, Value=$date, SubKey=$id.
        // If we want list of surveys, we need the IDs.

        // For MVP, let's use DataStore::getLatest filtered by user if Indexer is complex to query for list.
        // DataStore::getLatest iterates files.
        return DataStore::getLatest('surveys', $limit, function ($item) use ($userId) {
            return ($item['user_id'] ?? '') === $userId;
        });
    }
}
