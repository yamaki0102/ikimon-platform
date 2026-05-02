<?php

class CorporateSites
{
    // Mock Data for Demo
    // In production, this would fetch from a database table `corporate_sites`
    const SITES = [
        'ikimon_forest' => [
            'id' => 'ikimon_forest',
            'name' => 'ikimonの森 (本社工場)',
            'owner' => 'ikimon株式会社',
            'description' => '浜松市の本社工場敷地内にある3.5haのビオトープ。従業員と近隣住民が共同で管理しています。',
            'location' => [137.726, 34.710], // Hamamatsu Center-ish
            'polygon' => [
                [137.724, 34.708],
                [137.728, 34.708],
                [137.728, 34.712],
                [137.724, 34.712],
                [137.724, 34.708]
            ],
            'stats' => [
                'species' => 142,
                'obs' => 1240,
                'users' => 120,
                'score' => 84
            ]
        ],
        'hamamatsu_park' => [
            'id' => 'hamamatsu_park',
            'name' => '浜松城公園 共生エリア',
            'owner' => '浜松市',
            'description' => '都市公園の中にある自然共生サイト。',
            'public_location_detail' => true,
            'location' => [137.733, 34.711],
            'polygon' => [
                [137.731, 34.709],
                [137.735, 34.709],
                [137.735, 34.713],
                [137.731, 34.713],
                [137.731, 34.709]
            ],
            'stats' => [
                'species' => 210,
                'obs' => 3500,
                'users' => 500,
                'score' => 92
            ]
        ],
        'ikan_hq' => [
            'id' => 'ikan_hq',
            'name' => '愛管株式会社 連理の木コミュニティーエリア',
            'owner' => '愛管株式会社',
            'description' => '浜松市浜名区都田町の本社敷地内1.3haのエリア。有機農業による農園ゾーン、保育園「れんりの子」の園庭ゾーン、天然記念物「連理の木」を中心とした緑地からなる自然共生サイト。',
            'location' => [137.7327, 34.8142], // Real center from survey GPS data
            'polygon' => [
                [137.7318, 34.8135],
                [137.7336, 34.8135],
                [137.7336, 34.8152],
                [137.7318, 34.8152],
                [137.7318, 34.8135]
            ],
            'area_ha' => 1.3,
            'ecosystem_type' => '畑・果樹園・牧草地、創出緑地',
            'certification' => [
                'type' => '自然共生サイト',
                'status' => '申請中',
                'period' => '令和7年12月〜12年11月',
            ],
            'zones' => ['園庭ゾーン', '農園ゾーン'],
            'monitoring' => [
                'targets' => ['昆虫類', '植物', '鳥類'],
                'frequency' => '2年に1度（2月・5月・8月・11月）',
            ],
        ]
    ];

    public static function get($id)
    {
        return self::SITES[$id] ?? null;
    }

    /**
     * Find a corporate site whose location is within radius of given coordinates.
     * Uses simple Haversine approximation (good enough for ~2km radius matching).
     *
     * @param float $lat Latitude
     * @param float $lng Longitude
     * @param float $radiusKm Maximum distance in km (default 2)
     * @return array|null Matched site data or null
     */
    public static function findMatchingSite(float $lat, float $lng, float $radiusKm = 2.0): ?array
    {
        $closest = null;
        $minDist = PHP_FLOAT_MAX;

        foreach (self::SITES as $site) {
            $sLng = $site['location'][0];
            $sLat = $site['location'][1];
            // Haversine approximation for short distances
            $dlat = deg2rad($lat - $sLat);
            $dlng = deg2rad($lng - $sLng);
            $a = sin($dlat / 2) ** 2 + cos(deg2rad($sLat)) * cos(deg2rad($lat)) * sin($dlng / 2) ** 2;
            $dist = 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a)); // km

            if ($dist < $radiusKm && $dist < $minDist) {
                $minDist = $dist;
                $closest = $site;
            }
        }

        return $closest;
    }
}
