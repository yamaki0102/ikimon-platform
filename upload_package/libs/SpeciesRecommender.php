<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';

/**
 * SpeciesRecommender — 「ここで見つかりそうな、まだ見てない種」推薦
 *
 * iNaturalist では URL ハッキングでしかできない機能を UI 化。
 * フィールドに出る前のワクワク感を生む。
 */
class SpeciesRecommender
{
    private const RADIUS_KM = 5.0;
    private const MAX_RECOMMENDATIONS = 5;
    private const EARTH_RADIUS_KM = 6371.0;

    /**
     * 指定地点×季節で、ユーザーがまだ見ていない種を推薦
     *
     * @param float $lat 緯度
     * @param float $lng 経度
     * @param string $userId ユーザーID
     * @param int|null $month 対象月（null=現在月）
     * @return array 推薦リスト [{species_name, scientific_name, observation_count, last_seen, months_active, icon}]
     */
    public static function recommend(float $lat, float $lng, string $userId, ?int $month = null): array
    {
        $month = $month ?? (int)date('n');

        $nearbySpecies = self::collectNearbySpecies($lat, $lng, $month);
        if (empty($nearbySpecies)) return [];

        $userLifeList = self::collectUserLifeList($userId);

        $candidates = [];
        foreach ($nearbySpecies as $name => $data) {
            if (isset($userLifeList[$name])) continue;

            $candidates[] = [
                'species_name' => $name,
                'scientific_name' => $data['scientific_name'] ?? '',
                'observation_count' => $data['count'],
                'last_seen' => $data['last_seen'] ?? null,
                'months_active' => $data['months'] ?? [],
                'taxon_group' => $data['taxon_group'] ?? '',
                'icon' => self::resolveIcon($data['taxon_group'] ?? ''),
            ];
        }

        usort($candidates, fn($a, $b) => $b['observation_count'] - $a['observation_count']);

        $diversified = self::diversifyByTaxon($candidates);

        return array_slice($diversified, 0, self::MAX_RECOMMENDATIONS);
    }

    /**
     * 指定地点の半径内で観察された種を月別に集計
     */
    private static function collectNearbySpecies(float $lat, float $lng, int $targetMonth): array
    {
        $observations = DataStore::fetchAll('observations');
        $species = [];

        foreach ($observations as $obs) {
            $oLat = (float)($obs['latitude'] ?? $obs['lat'] ?? 0);
            $oLng = (float)($obs['longitude'] ?? $obs['lng'] ?? 0);
            if (!$oLat || !$oLng) continue;

            $dist = self::haversineDistance($lat, $lng, $oLat, $oLng);
            if ($dist > self::RADIUS_KM) continue;

            $name = $obs['taxon']['name'] ?? $obs['taxon_name'] ?? $obs['species_name'] ?? '';
            if (empty($name) || mb_strlen($name) < 2) continue;

            $createdAt = $obs['created_at'] ?? $obs['observed_on'] ?? '';
            $obsMonth = $createdAt ? (int)date('n', strtotime($createdAt)) : 0;

            if (!isset($species[$name])) {
                $species[$name] = [
                    'count' => 0,
                    'scientific_name' => $obs['taxon']['scientific_name'] ?? '',
                    'last_seen' => $createdAt,
                    'months' => [],
                    'taxon_group' => $obs['taxon']['lineage']['order']
                        ?? $obs['taxon']['lineage']['class']
                        ?? $obs['taxon_group'] ?? '',
                    'month_match' => false,
                ];
            }

            $species[$name]['count']++;
            if ($obsMonth > 0) {
                $species[$name]['months'][$obsMonth] = true;
            }
            if ($obsMonth === $targetMonth) {
                $species[$name]['month_match'] = true;
            }
            if ($createdAt > ($species[$name]['last_seen'] ?? '')) {
                $species[$name]['last_seen'] = $createdAt;
            }
        }

        // Omoikane 季節制約でフィルタリング（利用可能な場合）
        $species = self::filterBySeason($species, $targetMonth);

        // 対象月に観察記録がある種を優先
        $result = [];
        foreach ($species as $name => $data) {
            if ($data['month_match'] || count($data['months']) <= 3) {
                $result[$name] = $data;
            }
        }

        return $result;
    }

    /**
     * Omoikane の季節制約でフィルタリング
     */
    private static function filterBySeason(array $species, int $month): array
    {
        $omoikaneDB = ROOT_DIR . '/libs/OmoikaneDB.php';
        if (!file_exists($omoikaneDB)) return $species;

        try {
            require_once $omoikaneDB;
            $db = OmoikaneDB::getInstance();
            $monthStr = str_pad((string)$month, 2, '0', STR_PAD_LEFT);

            foreach ($species as $name => &$data) {
                $sci = $data['scientific_name'] ?? '';
                if (empty($sci)) continue;

                $constraints = $db->getEcologicalConstraints($sci);
                if (empty($constraints)) continue;

                foreach ($constraints as $c) {
                    $season = $c['season'] ?? '';
                    if (empty($season)) continue;
                    if (stripos($season, $monthStr) === false
                        && stripos($season, self::monthToJapanese($month)) === false) {
                        unset($species[$name]);
                        break;
                    }
                }
            }
            unset($data);
        } catch (\Throwable $e) {
            // Non-fatal
        }

        return $species;
    }

    private static function collectUserLifeList(string $userId): array
    {
        $observations = DataStore::fetchAll('observations');
        $lifeList = [];
        foreach ($observations as $obs) {
            if (($obs['user_id'] ?? '') !== $userId) continue;
            $name = $obs['taxon']['name'] ?? $obs['taxon_name'] ?? $obs['species_name'] ?? '';
            if (!empty($name)) $lifeList[$name] = true;
        }
        return $lifeList;
    }

    /**
     * 分類群を分散させて多様な推薦にする
     */
    private static function diversifyByTaxon(array $candidates): array
    {
        $byGroup = [];
        foreach ($candidates as $c) {
            $group = $c['taxon_group'] ?: 'other';
            $byGroup[$group][] = $c;
        }

        $result = [];
        $maxRounds = self::MAX_RECOMMENDATIONS;
        for ($round = 0; $round < $maxRounds; $round++) {
            foreach ($byGroup as $group => &$items) {
                if (empty($items)) continue;
                $result[] = array_shift($items);
                if (count($result) >= self::MAX_RECOMMENDATIONS) return $result;
            }
        }
        return $result;
    }

    private static function haversineDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return self::EARTH_RADIUS_KM * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private static function resolveIcon(string $taxonGroup): string
    {
        $icons = [
            'Aves' => 'bird', '鳥綱' => 'bird',
            'Lepidoptera' => 'bug', 'チョウ目' => 'bug',
            'Coleoptera' => 'bug', 'コウチュウ目' => 'bug',
            'Mammalia' => 'cat', '哺乳綱' => 'cat',
            'Amphibia' => 'droplets', '両生綱' => 'droplets',
            'Reptilia' => 'snail', '爬虫綱' => 'snail',
            'Plantae' => 'leaf', '植物界' => 'leaf',
            'Fungi' => 'cloud', '菌界' => 'cloud',
            'Arachnida' => 'target', 'クモ綱' => 'target',
        ];
        return $icons[$taxonGroup] ?? 'search';
    }

    private static function monthToJapanese(int $month): string
    {
        $names = [1=>'1月',2=>'2月',3=>'3月',4=>'4月',5=>'5月',6=>'6月',7=>'7月',8=>'8月',9=>'9月',10=>'10月',11=>'11月',12=>'12月'];
        return $names[$month] ?? '';
    }
}
