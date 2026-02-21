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
        'aikan_hq' => [
            'id' => 'aikan_hq',
            'name' => '愛管株式会社 本社ビオトープ',
            'owner' => '愛管株式会社 (Aikan Co., Ltd.)',
            'description' => '30by30アライアンス参加企業として、敷地内の緑地を生物多様性保全エリアとして管理。',
            'location' => [137.7812, 34.6946],
            'polygon' => [
                [137.779, 34.692],
                [137.783, 34.692],
                [137.783, 34.696],
                [137.779, 34.696],
                [137.779, 34.692]
            ],
            'stats' => [
                'species' => 86,
                'obs' => 452,
                'users' => 15,
                'score' => 78
            ]
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
