<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';

class QuestManager
{
    const CONFIG_FILE = ROOT_DIR . '/data/config/quests.json';
    private static $definitions = null;

    public static function getDefinitions(): array
    {
        if (self::$definitions !== null) return self::$definitions;
        if (!file_exists(self::CONFIG_FILE)) {
            self::$definitions = [];
            return self::$definitions;
        }
        $defs = json_decode(file_get_contents(self::CONFIG_FILE), true) ?: [];
        self::$definitions = is_array($defs) ? $defs : [];
        return self::$definitions;
    }

    public static function getActiveQuests(?string $userId = null): array
    {
        $definitions = self::getDefinitions();
        if (empty($definitions)) return [];

        $seed = crc32(date('Y-m-d') . ($userId ?? ''));
        $shuffled = $definitions;
        usort($shuffled, function ($a, $b) use ($seed) {
            $aKey = hash('sha256', $seed . ($a['id'] ?? ''));
            $bKey = hash('sha256', $seed . ($b['id'] ?? ''));
            return strcmp($aKey, $bKey);
        });

        return array_slice($shuffled, 0, 3);
    }

    public static function checkProgress(string $userId, string $questId): int
    {
        $definitions = self::getDefinitions();
        $quest = null;
        foreach ($definitions as $q) {
            if (($q['id'] ?? '') === $questId) {
                $quest = $q;
                break;
            }
        }
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
        }

        return 0;
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
}
