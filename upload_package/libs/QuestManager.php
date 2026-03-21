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

    // ── Scan Quest: 動的クエスト生成 ──

    const SCAN_QUEST_TTL = 48 * 3600;

    public static function generateFromScan(string $userId, array $summary, array $sessionMeta): array
    {
        $detectedSpecies = $summary['species'] ?? [];
        if (empty($detectedSpecies)) return [];

        $lifeList = self::collectUserSpecies($userId, '9999-99-99');
        $photoSpecies = self::collectUserPhotoSpecies($userId);

        $candidates = [];
        foreach ($detectedSpecies as $name => $count) {
            if (empty($name) || mb_strlen($name) < 2) continue;

            if (!isset($lifeList[$name])) {
                $candidates[] = [
                    'species_name' => $name,
                    'trigger' => 'new_species',
                    'priority' => 3,
                    'reward' => 200,
                    'title' => '🆕 ' . $name . 'を初記録！詳しく観察しよう',
                    'description' => 'スキャンで検出された' . $name . 'はキミの初記録種。写真付きで投稿して図鑑に追加しよう',
                ];
            } elseif (!isset($photoSpecies[$name])) {
                $candidates[] = [
                    'species_name' => $name,
                    'trigger' => 'photo_needed',
                    'priority' => 2,
                    'reward' => 150,
                    'title' => '📸 ' . $name . 'を写真で記録しよう',
                    'description' => $name . 'の写真付き観察を投稿すると、研究グレードデータに近づきます',
                ];
            } else {
                $candidates[] = [
                    'species_name' => $name,
                    'trigger' => 'high_confidence',
                    'priority' => 1,
                    'reward' => 100,
                    'title' => '🎯 ' . $name . 'を確認投稿しよう',
                    'description' => $name . 'が検出されました。写真付きで投稿してデータを充実させよう',
                ];
            }
        }

        usort($candidates, fn($a, $b) => $b['priority'] - $a['priority']);
        $selected = array_slice($candidates, 0, 3);

        $now = date('c');
        $expires = date('c', time() + self::SCAN_QUEST_TTL);
        $sessionId = $sessionMeta['session_id'] ?? ('ps_' . bin2hex(random_bytes(6)));

        $quests = [];
        foreach ($selected as $c) {
            $quests[] = [
                'id' => 'sq_' . bin2hex(random_bytes(6)),
                'type' => 'scan_followup',
                'species_name' => $c['species_name'],
                'trigger' => $c['trigger'],
                'title' => $c['title'],
                'description' => $c['description'],
                'reward' => $c['reward'],
                'icon' => $c['trigger'] === 'new_species' ? 'sparkles' : ($c['trigger'] === 'photo_needed' ? 'camera' : 'target'),
                'scan_session_id' => $sessionId,
                'created_at' => $now,
                'expires_at' => $expires,
                'completed_at' => null,
            ];
        }

        return $quests;
    }

    public static function saveScanQuests(string $userId, array $newQuests): void
    {
        if (empty($newQuests)) return;
        $file = 'scan_quests/' . $userId;
        $existing = DataStore::get($file) ?: [];
        if (!is_array($existing)) $existing = [];

        $now = time();
        $existing = array_filter($existing, function ($q) use ($now) {
            if (!empty($q['completed_at'])) return false;
            $exp = strtotime($q['expires_at'] ?? '');
            return $exp && $exp > $now;
        });

        $existing = array_merge(array_values($existing), $newQuests);
        if (count($existing) > 10) {
            $existing = array_slice($existing, -10);
        }
        DataStore::save($file, $existing);
    }

    public static function getScanQuests(string $userId): array
    {
        $file = 'scan_quests/' . $userId;
        $quests = DataStore::get($file) ?: [];
        if (!is_array($quests)) return [];

        $now = time();
        return array_values(array_filter($quests, function ($q) use ($now) {
            if (!empty($q['completed_at'])) return false;
            $exp = strtotime($q['expires_at'] ?? '');
            return $exp && $exp > $now;
        }));
    }

    public static function completeScanQuest(string $userId, string $questId): ?array
    {
        $file = 'scan_quests/' . $userId;
        $quests = DataStore::get($file) ?: [];
        if (!is_array($quests)) return null;

        $completed = null;
        foreach ($quests as &$q) {
            if (($q['id'] ?? '') === $questId && empty($q['completed_at'])) {
                $q['completed_at'] = date('c');
                $completed = $q;
                break;
            }
        }
        unset($q);

        if ($completed) {
            DataStore::save($file, $quests);
        }
        return $completed;
    }

    public static function checkScanQuestMatch(string $userId, array $obs): ?array
    {
        $quests = self::getScanQuests($userId);
        if (empty($quests)) return null;
        if (empty($obs['photos'])) return null;

        $obsSpecies = $obs['taxon']['name'] ?? $obs['species_name'] ?? '';
        if (empty($obsSpecies)) return null;

        foreach ($quests as $q) {
            if ($q['species_name'] === $obsSpecies) {
                return self::completeScanQuest($userId, $q['id']);
            }
        }
        return null;
    }

    private static function collectUserPhotoSpecies(string $userId): array
    {
        $all = DataStore::fetchAll('observations');
        $set = [];
        foreach ($all as $obs) {
            if (($obs['user_id'] ?? '') !== $userId) continue;
            if (empty($obs['photos'])) continue;
            $key = self::resolveSpeciesKey($obs);
            if ($key) $set[$key] = true;
        }
        return $set;
    }
}
