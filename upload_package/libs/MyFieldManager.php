<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/GeoUtils.php';
require_once __DIR__ . '/BiodiversityScorer.php';

class MyFieldManager
{
    const DATA_DIR = DATA_DIR . '/my_fields';

    /**
     * Create a new My Field.
     */
    public static function create(string $userId, string $name, float $lat, float $lng, int $radius = 500, string $biome = 'unknown'): array
    {
        if (!file_exists(self::DATA_DIR)) {
            mkdir(self::DATA_DIR, 0777, true);
        }

        $id = uniqid('mf_');
        $field = [
            'id' => $id,
            'user_id' => $userId,
            'name' => $name,
            'center' => ['lat' => $lat, 'lng' => $lng],
            'radius' => $radius,
            'biome_type' => $biome,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ];

        file_put_contents(self::DATA_DIR . '/' . $id . '.json', json_encode($field, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

        return $field;
    }

    /**
     * Get a field by ID.
     */
    public static function get(string $id): ?array
    {
        $path = self::DATA_DIR . '/' . $id . '.json';
        if (!file_exists($path)) return null;
        return json_decode(file_get_contents($path), true);
    }

    /**
     * List all fields for a user.
     */
    public static function listByUser(string $userId): array
    {
        $fields = [];
        $files = glob(self::DATA_DIR . '/*.json');
        foreach ($files as $file) {
            $data = json_decode(file_get_contents($file), true);
            if (($data['user_id'] ?? '') === $userId) {
                $fields[] = $data;
            }
        }
        return $fields;
    }

    /**
     * Check if a point is within a field.
     */
    public static function contains(array $field, float $lat, float $lng): bool
    {
        $center = $field['center'] ?? ['lat' => 0, 'lng' => 0];
        $distance = GeoUtils::distance($center['lat'], $center['lng'], $lat, $lng);
        return $distance <= ($field['radius'] ?? 0);
    }

    /**
     * Calculate ecological stats for a field.
     * Uses BiodiversityScorer for advanced metrics.
     */
    public static function calculateStats(array $field): array
    {


        $allObs = DataStore::fetchAll('observations');
        $fieldObs = [];

        foreach ($allObs as $obs) {
            // lat/lng validation
            if (empty($obs['latitude']) && empty($obs['lat'])) continue; // Handle both key variations if any

            $lat = (float)($obs['latitude'] ?? $obs['lat']);
            $lng = (float)($obs['longitude'] ?? $obs['lng']);

            if (empty($lat) || empty($lng)) continue;

            if (self::contains($field, $lat, $lng)) {
                $fieldObs[] = $obs;
            }
        }

        // Calculate all scores via Scorer
        $scoreResult = BiodiversityScorer::calculate($fieldObs, $field);

        return array_merge([
            'observation_count' => count($fieldObs), // Keep for backward compatibility
            // 'species_count' & 'shannon_index' are now in 'breakdown' but we might want to expose them directly for UI
            'species_count'     => $scoreResult['species_count'],
            'shannon_index'     => $scoreResult['shannon_index'],
            'top_species'       => $scoreResult['top_species'] ?? []
        ], $scoreResult);
    }

    /**
     * Get all tracks for a user (Activity Log).
     * Includes observation count and basic stats.
     */
    public static function getUserTracks(string $userId): array
    {
        $tracksBase = DATA_DIR . '/tracks/' . $userId;
        if (!is_dir($tracksBase)) return [];

        $sessions = [];
        // Optimization: Load all observations for this user once
        // DataStore::fetchAll reads the file, so we do it once here.
        $allObs = DataStore::fetchAll('observations');
        $userObs = [];
        foreach ($allObs as $obs) {
            if (($obs['user_id'] ?? '') === $userId) {
                $userObs[] = $obs;
            }
        }

        foreach (glob($tracksBase . '/*.json') as $file) {
            $data = json_decode(file_get_contents($file), true);
            if (!$data) continue;

            // Enrich with field name
            $fieldName = 'Free Roam';
            if (!empty($data['field_id'])) {
                $field = self::get($data['field_id']);
                if ($field) {
                    $fieldName = $field['name'];
                }
            }

            // Count observations in this session
            $start = strtotime($data['started_at'] ?? 0);
            $end = strtotime($data['updated_at'] ?? 0);
            $obsCount = 0;

            foreach ($userObs as $obs) {
                // Observations created within session window
                $t = strtotime($obs['created_at'] ?? '');
                if ($t >= $start && $t <= $end) {
                    $obsCount++;
                }
            }

            $sessions[] = [
                'session_id'     => $data['session_id'],
                'field_id'       => $data['field_id'] ?? null,
                'field_name'     => $fieldName,
                'started_at'     => $data['started_at'] ?? null,
                'ended_at'       => $data['updated_at'] ?? null,
                'duration_sec'   => $end - $start,
                'point_count'    => $data['point_count'] ?? 0,
                'total_distance' => $data['total_distance_m'] ?? 0,
                'observation_count' => $obsCount,
                'step_count'     => $data['step_count'] ?? null,
                'points'         => $data['points'] ?? [], // Include points for mini-map
            ];
        }

        // Sort by most recent first
        usort($sessions, fn($a, $b) => strcmp($b['started_at'] ?? '', $a['started_at'] ?? ''));
        return $sessions;
    }

    /**
     * Get full session details including linked observations.
     */
    public static function getSessionWithObservations(string $userId, string $sessionId): ?array
    {
        $trackFile = DATA_DIR . '/tracks/' . $userId . '/' . $sessionId . '.json';
        if (!file_exists($trackFile)) return null;

        $data = json_decode(file_get_contents($trackFile), true);
        if (!$data) return null;

        // Security check handled by caller or here?
        // Method signature implies getting specific user's session.
        if (($data['user_id'] ?? '') !== $userId) return null;

        // Fetch observations
        $allObs = DataStore::fetchAll('observations');
        $linkedObs = [];
        $start = strtotime($data['started_at'] ?? 0);
        $end = strtotime($data['updated_at'] ?? 0);

        foreach ($allObs as $obs) {
            if (($obs['user_id'] ?? '') !== $userId) continue;
            $t = strtotime($obs['created_at'] ?? '');
            if ($t >= $start && $t <= $end) {
                $linkedObs[] = $obs;
            }
        }

        $data['observations'] = $linkedObs;
        return $data;
    }

    /**
     * Get all track sessions for a field (from all users).
     *
     * @param string $fieldId
     * @return array List of track session summaries
     */
    public static function getTrackSessions(string $fieldId): array
    {
        $tracksBase = DATA_DIR . '/tracks';
        if (!is_dir($tracksBase)) return [];

        $sessions = [];
        foreach (glob($tracksBase . '/*', GLOB_ONLYDIR) as $userDir) {
            foreach (glob($userDir . '/*.json') as $file) {
                $data = json_decode(file_get_contents($file), true);
                if (!$data) continue;
                if (($data['field_id'] ?? '') !== $fieldId) continue;

                $sessions[] = [
                    'session_id'     => $data['session_id'],
                    'user_id'        => $data['user_id'],
                    'started_at'     => $data['started_at'] ?? null,
                    'point_count'    => $data['point_count'] ?? 0,
                    'total_distance' => $data['total_distance_m'] ?? 0,
                ];
            }
        }

        // Sort by most recent first
        usort($sessions, fn($a, $b) => strcmp($b['started_at'] ?? '', $a['started_at'] ?? ''));
        return $sessions;
    }

    /**
     * Get aggregated track stats for a field.
     *
     * @param string $fieldId
     * @return array {session_count, total_distance_m, total_points}
     */
    public static function getTrackStats(string $fieldId): array
    {
        $sessions = self::getTrackSessions($fieldId);
        $totalDist = 0;
        $totalPoints = 0;

        foreach ($sessions as $s) {
            $totalDist += $s['total_distance'];
            $totalPoints += $s['point_count'];
        }

        return [
            'session_count'    => count($sessions),
            'total_distance_m' => round($totalDist, 1),
            'total_points'     => $totalPoints,
        ];
    }
}
