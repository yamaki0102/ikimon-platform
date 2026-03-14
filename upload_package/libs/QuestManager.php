<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/MyFieldManager.php';

class QuestManager
{
    const CONFIG_FILE = ROOT_DIR . '/data/config/quests.json';
    private static $definitions = null;

    public static function getDefinitions(): array
    {
        if (self::$definitions !== null) return self::$definitions;
        $defs = [];
        if (file_exists(self::CONFIG_FILE)) {
            $defs = json_decode(file_get_contents(self::CONFIG_FILE), true) ?: [];
        }
        self::$definitions = is_array($defs) ? $defs : [];
        return self::$definitions;
    }

    public static function getActiveQuests(?string $userId = null): array
    {
        $definitions = self::getDefinitions();
        $walkQuest = self::buildWalkQuest();

        if (empty($definitions)) {
            return [$walkQuest];
        }

        $seed = crc32(date('Y-m-d') . ($userId ?? ''));
        $shuffled = $definitions;
        usort($shuffled, function ($a, $b) use ($seed) {
            $aKey = hash('sha256', $seed . ($a['id'] ?? ''));
            $bKey = hash('sha256', $seed . ($b['id'] ?? ''));
            return strcmp($aKey, $bKey);
        });

        $selected = array_slice($shuffled, 0, 2);
        $selected[] = $walkQuest;

        return $selected;
    }

    public static function checkProgress(string $userId, string $questId): int
    {
        $quest = self::findQuestDefinition($questId);
        if (!$quest) return 0;

        $today = date('Y-m-d');
        $todaysObs = DataStore::getLatest('observations', 300, function ($item) use ($userId, $today) {
            $created = $item['created_at'] ?? '';
            return ($item['user_id'] ?? '') === $userId && strpos($created, $today) === 0;
        });

        $target = $quest['target'] ?? [];
        $targetCount = (int)($target['count'] ?? 1);
        if ($targetCount <= 0) return 0;

        if (!empty($target['taxon_group'])) {
            $count = 0;
            foreach ($todaysObs as $obs) {
                $group = self::resolveTaxonGroup($obs);
                if ($group === $target['taxon_group']) {
                    $count++;
                }
            }
            return min(100, (int)floor(($count / $targetCount) * 100));
        }

        $type = $target['type'] ?? '';
        switch ($type) {
            case 'post_count':
                $count = count($todaysObs);
                return min(100, (int)floor(($count / $targetCount) * 100));
            case 'identifications':
                $count = 0;
                foreach ($todaysObs as $obs) {
                    foreach ($obs['identifications'] ?? [] as $id) {
                        if (($id['user_id'] ?? '') === $userId) $count++;
                    }
                }
                return min(100, (int)floor(($count / $targetCount) * 100));
            case 'new_species':
                $pastSpecies = self::collectUserSpecies($userId, $today);
                $newCount = 0;
                foreach ($todaysObs as $obs) {
                    $key = self::resolveSpeciesKey($obs);
                    if ($key && empty($pastSpecies[$key])) {
                        $newCount++;
                    }
                }
                return min(100, (int)floor(($newCount / $targetCount) * 100));
            case 'new_location':
                $pastLocations = self::collectUserLocations($userId, $today);
                $newCount = 0;
                foreach ($todaysObs as $obs) {
                    $key = self::resolveLocationKey($obs);
                    if ($key && empty($pastLocations[$key])) {
                        $newCount++;
                    }
                }
                return min(100, (int)floor(($newCount / $targetCount) * 100));
            case 'walk_distance_m':
                $trackStats = self::collectTodayTrackStats($userId, $today);
                return min(100, (int)floor(($trackStats['distance_m'] / $targetCount) * 100));
            case 'walk_sessions':
                $trackStats = self::collectTodayTrackStats($userId, $today);
                return min(100, (int)floor(($trackStats['session_count'] / $targetCount) * 100));
        }

        return 0;
    }

    private static function findQuestDefinition(string $questId): ?array
    {
        $definitions = self::getDefinitions();
        foreach ($definitions as $q) {
            if (($q['id'] ?? '') === $questId) {
                return $q;
            }
        }

        $walkQuest = self::buildWalkQuest();
        if (($walkQuest['id'] ?? '') === $questId) {
            return $walkQuest;
        }

        return null;
    }

    private static function buildWalkQuest(): array
    {
        return [
            'id' => 'q_walk_light',
            'type' => 'daily',
            'icon' => 'footprints',
            'title' => '自然さんぽ',
            'description' => '今日は300mだけでも歩いて、自然との接続を続けよう',
            'target' => [
                'type' => 'walk_distance_m',
                'count' => 300,
            ],
            'reward' => 120,
        ];
    }

    private static function resolveTaxonGroup(array $obs): ?string
    {
        $lineage = $obs['taxon']['lineage'] ?? [];
        return $obs['taxon_group']
            ?? ($lineage['class'] ?? ($lineage['order'] ?? ($lineage['kingdom'] ?? null)));
    }

    private static function resolveSpeciesKey(array $obs): ?string
    {
        if (!empty($obs['taxon']['key'])) return $obs['taxon']['key'];
        if (!empty($obs['taxon']['name'])) return $obs['taxon']['name'];
        if (!empty($obs['taxon_name'])) return $obs['taxon_name'];
        return null;
    }

    private static function resolveLocationKey(array $obs): ?string
    {
        $name = $obs['location']['name'] ?? $obs['location_name'] ?? '';
        if (!empty($name)) return $name;
        $lat = $obs['latitude'] ?? $obs['lat'] ?? null;
        $lng = $obs['longitude'] ?? $obs['lng'] ?? null;
        if ($lat !== null && $lng !== null) {
            return round((float)$lat, 3) . ',' . round((float)$lng, 3);
        }
        return null;
    }

    private static function collectUserSpecies(string $userId, string $today): array
    {
        $all = DataStore::fetchAll('observations');
        $set = [];
        foreach ($all as $obs) {
            if (($obs['user_id'] ?? '') !== $userId) continue;
            $created = $obs['created_at'] ?? '';
            if (strpos($created, $today) === 0) continue;
            $key = self::resolveSpeciesKey($obs);
            if ($key) $set[$key] = true;
        }
        return $set;
    }

    private static function collectUserLocations(string $userId, string $today): array
    {
        $all = DataStore::fetchAll('observations');
        $set = [];
        foreach ($all as $obs) {
            if (($obs['user_id'] ?? '') !== $userId) continue;
            $created = $obs['created_at'] ?? '';
            if (strpos($created, $today) === 0) continue;
            $key = self::resolveLocationKey($obs);
            if ($key) $set[$key] = true;
        }
        return $set;
    }

    private static function collectTodayTrackStats(string $userId, string $today): array
    {
        $sessions = MyFieldManager::getUserTracks($userId);
        $distance = 0.0;
        $count = 0;

        foreach ($sessions as $session) {
            $startedAt = $session['started_at'] ?? '';
            if (strpos($startedAt, $today) !== 0) {
                continue;
            }
            $distance += (float)($session['total_distance'] ?? 0);
            $count++;
        }

        return [
            'distance_m' => $distance,
            'session_count' => $count,
        ];
    }
}
