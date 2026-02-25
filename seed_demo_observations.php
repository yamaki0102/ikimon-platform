<?php
require_once __DIR__ . '/upload_package/config/config.php';
require_once __DIR__ . '/upload_package/libs/DataStore.php';
require_once __DIR__ . '/upload_package/libs/CorporateSites.php';

// Common species list for demo
$speciesList = [
    'forest' => ['カブトムシ', 'ノコギリクワガタ', 'オオタカ', 'キビタキ', 'スギ', 'ヒノキ', 'コナラ', 'アブラゼミ', 'ミンミンゼミ', 'タヌキ'],
    'water' => ['メダカ', 'アメリカザリガニ', 'アオサギ', 'カルガモ', 'コイ', 'ギンヤンマ', 'シオカラトンボ', 'ナマズ'],
    'urban' => ['スズメ', 'ハシブトガラス', 'ドバト', 'シジュウカラ', 'アオスジアゲハ', 'モンシロチョウ', 'ダンゴムシ', 'アリ']
];

echo "Seeding demo observations...\n";

// Load existing observations
$observations = DataStore::fetchAll('observations');
$initialCount = count($observations);
echo "Initial count: $initialCount\n";

foreach (CorporateSites::SITES as $id => $site) {
    echo "Processing {$site['name']}...\n";
    $targetObs = $site['stats']['obs'] ?? 100;
    // Limit to reasonable amount per site for JSON performance (max 200 for demo)
    $targetObs = min($targetObs, 200);

    $centerLng = $site['location'][0];
    $centerLat = $site['location'][1];

    // Choose species set based on ID
    $type = 'urban';
    if (strpos($id, 'forest') !== false) $type = 'forest';
    if (strpos($id, 'park') !== false) $type = 'water';

    $list = array_merge($speciesList[$type], $speciesList['urban']);

    for ($i = 0; $i < $targetObs; $i++) {
        // Random bias
        $offsetLat = (mt_rand(-50, 50) / 100000); // approx +/- 50m
        $offsetLng = (mt_rand(-50, 50) / 100000);

        $species = $list[array_rand($list)];

        $observations[] = [
            'id' => uniqid('demo_'),
            'user_id' => 'user_demo_' . mt_rand(1, 20),
            'taxon_name_ja' => $species,
            'taxon' => ['name' => $species, 'group' => 'Insecta', 'id' => 123], // Mock taxonomy
            'lat' => $centerLat + $offsetLat,
            'lng' => $centerLng + $offsetLng,
            'observed_at' => date('Y-m-d H:i:s', strtotime('-' . mt_rand(0, 365) . ' days')),
            'biome' => 'unknown',
            'note' => 'Demo data generated for synchronization.',
            'created_at' => date('Y-m-d H:i:s')
        ];
    }
    echo "  > Generated $targetObs observations\n";
}

DataStore::save('observations', $observations);
echo "Saved total " . count($observations) . " observations.\n";
