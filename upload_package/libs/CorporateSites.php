<?php

class CorporateSites {
    // Mock Data for Demo
    // In production, this would fetch from a database table `corporate_sites`
    const SITES = [
        'ikimon_forest' => [
            'id' => 'ikimon_forest',
            'name' => 'ikimonの森 (本社工場)',
            'owner' => 'ikimon株式会社',
            'description' => '浜松市の本社工場敷地内にある3.5haのビオトープ。従業員と近隣住民が共同で管理しています。',
            'location' => [137.726, 34.710], // Hamamatsu Center-ish
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
            'stats' => [
                'species' => 210,
                'obs' => 3500,
                'users' => 500,
                'score' => 92
            ]
        ]
    ];

    public static function get($id) {
        return self::SITES[$id] ?? null;
    }
}
