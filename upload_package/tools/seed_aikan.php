<?php

/**
 * 愛管HQ シードデータ投入スクリプト
 * 都田町エリアのリアルな生物観察データを生成
 * 
 * Usage: php tools/seed_aikan.php
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/SiteManager.php';

// ── Configuration ──
$siteId = 'aikan_hq';
$site = SiteManager::load($siteId);
if (!$site) {
    echo "ERROR: Site '{$siteId}' not found\n";
    exit(1);
}

echo "=== 愛管HQ シードデータ投入 ===\n";
echo "Site: {$site['name']}\n";
echo "Center: " . json_encode($site['center']) . "\n\n";

// ── Seed Users ──
$seedUsers = [
    ['id' => 'seed_aikan_01', 'name' => '都田の自然観察員', 'avatar' => 'https://i.pravatar.cc/150?u=seed_aikan_01'],
    ['id' => 'seed_aikan_02', 'name' => 'フィールドワーカーA', 'avatar' => 'https://i.pravatar.cc/150?u=seed_aikan_02'],
    ['id' => 'seed_aikan_03', 'name' => '浜松生物部', 'avatar' => 'https://i.pravatar.cc/150?u=seed_aikan_03'],
];

// ── 都田町周辺の実在する生物種 ──
// 浜松市北区の実際の生態系に基づく
$species = [
    // 植物 (10種)
    ['taxon_name' => 'ソメイヨシノ', 'taxon_slug' => 'cerasus-x-yedoensis', 'category' => 'plant', 'life_stage' => 'flowering', 'months' => [3, 4]],
    ['taxon_name' => 'クヌギ', 'taxon_slug' => 'quercus-acutissima', 'category' => 'plant', 'life_stage' => 'adult', 'months' => [5, 6, 7, 8, 9]],
    ['taxon_name' => 'コナラ', 'taxon_slug' => 'quercus-serrata', 'category' => 'plant', 'life_stage' => 'adult', 'months' => [4, 5, 6, 7, 8, 9, 10]],
    ['taxon_name' => 'アジサイ', 'taxon_slug' => 'hydrangea-macrophylla', 'category' => 'plant', 'life_stage' => 'flowering', 'months' => [6, 7]],
    ['taxon_name' => 'ヒガンバナ', 'taxon_slug' => 'lycoris-radiata', 'category' => 'plant', 'life_stage' => 'flowering', 'months' => [9, 10]],
    ['taxon_name' => 'スギ', 'taxon_slug' => 'cryptomeria-japonica', 'category' => 'plant', 'life_stage' => 'adult', 'months' => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
    ['taxon_name' => 'タブノキ', 'taxon_slug' => 'machilus-thunbergii', 'category' => 'plant', 'life_stage' => 'adult', 'months' => [4, 5, 6]],
    ['taxon_name' => 'リョウブ', 'taxon_slug' => 'clethra-barbinervis', 'category' => 'plant', 'life_stage' => 'flowering', 'months' => [6, 7, 8]],
    ['taxon_name' => 'ヤマユリ', 'taxon_slug' => 'lilium-auratum', 'category' => 'plant', 'life_stage' => 'flowering', 'months' => [7, 8]],
    ['taxon_name' => 'イロハモミジ', 'taxon_slug' => 'acer-palmatum', 'category' => 'plant', 'life_stage' => 'adult', 'months' => [10, 11]],

    // 鳥類 (7種)
    ['taxon_name' => 'メジロ', 'taxon_slug' => 'zosterops-japonicus', 'category' => 'bird', 'life_stage' => 'adult', 'months' => [2, 3, 4, 5]],
    ['taxon_name' => 'ウグイス', 'taxon_slug' => 'horornis-diphone', 'category' => 'bird', 'life_stage' => 'adult', 'months' => [3, 4, 5, 6]],
    ['taxon_name' => 'カワセミ', 'taxon_slug' => 'alcedo-atthis', 'category' => 'bird', 'life_stage' => 'adult', 'months' => [4, 5, 6, 7, 8]],
    ['taxon_name' => 'コゲラ', 'taxon_slug' => 'yungipicus-kizuki', 'category' => 'bird', 'life_stage' => 'adult', 'months' => [1, 2, 3, 10, 11, 12]],
    ['taxon_name' => 'シジュウカラ', 'taxon_slug' => 'parus-minor', 'category' => 'bird', 'life_stage' => 'adult', 'months' => [3, 4, 5, 6]],
    ['taxon_name' => 'ヤマガラ', 'taxon_slug' => 'sittiparus-varius', 'category' => 'bird', 'life_stage' => 'adult', 'months' => [9, 10, 11]],
    ['taxon_name' => 'オオルリ', 'taxon_slug' => 'cyanoptila-cyanomelana', 'category' => 'bird', 'life_stage' => 'adult', 'months' => [4, 5, 6]],

    // 昆虫 (6種)
    ['taxon_name' => 'アゲハチョウ', 'taxon_slug' => 'papilio-xuthus', 'category' => 'insect', 'life_stage' => 'adult', 'months' => [4, 5, 6, 7, 8, 9]],
    ['taxon_name' => 'カブトムシ', 'taxon_slug' => 'trypoxylus-dichotomus', 'category' => 'insect', 'life_stage' => 'adult', 'months' => [7, 8]],
    ['taxon_name' => 'オオムラサキ', 'taxon_slug' => 'sasakia-charonda', 'category' => 'insect', 'life_stage' => 'adult', 'months' => [6, 7, 8], 'redlist' => 'NT'],
    ['taxon_name' => 'ギフチョウ', 'taxon_slug' => 'luehdorfia-japonica', 'category' => 'insect', 'life_stage' => 'adult', 'months' => [3, 4], 'redlist' => 'VU'],
    ['taxon_name' => 'ニホンミツバチ', 'taxon_slug' => 'apis-cerana-japonica', 'category' => 'insect', 'life_stage' => 'adult', 'months' => [3, 4, 5, 6, 7, 8, 9, 10]],
    ['taxon_name' => 'ホタル（ゲンジボタル）', 'taxon_slug' => 'luciola-cruciata', 'category' => 'insect', 'life_stage' => 'adult', 'months' => [5, 6, 7]],

    // 両生類/爬虫類 (3種)
    ['taxon_name' => 'ニホンアマガエル', 'taxon_slug' => 'dryophytes-japonicus', 'category' => 'amphibian', 'life_stage' => 'adult', 'months' => [4, 5, 6, 7, 8, 9]],
    ['taxon_name' => 'ニホントカゲ', 'taxon_slug' => 'plestiodon-japonicus', 'category' => 'reptile', 'life_stage' => 'adult', 'months' => [4, 5, 6, 7, 8, 9, 10]],
    ['taxon_name' => 'モリアオガエル', 'taxon_slug' => 'zhangixalus-arboreus', 'category' => 'amphibian', 'life_stage' => 'adult', 'months' => [5, 6, 7], 'redlist' => 'NT'],

    // 哺乳類 (2種)
    ['taxon_name' => 'ニホンリス', 'taxon_slug' => 'sciurus-lis', 'category' => 'mammal', 'life_stage' => 'adult', 'months' => [9, 10, 11]],
    ['taxon_name' => 'ムササビ', 'taxon_slug' => 'petaurista-leucogenys', 'category' => 'mammal', 'life_stage' => 'adult', 'months' => [5, 6, 7, 8]],
];

echo "Total species templates: " . count($species) . "\n";

// ── Coordinate generation within boundary ──
// aikan_hq center: [137.732881, 34.813473], radius ~200m
$centerLng = $site['center'][0]; // 137.732881
$centerLat = $site['center'][1]; // 34.813473
$radiusLat = 0.001;  // ~110m (boundary内に収まるよう縮小)
$radiusLng = 0.0012; // ~110m

function randomCoord($center, $radius)
{
    return $center + (mt_rand(-1000, 1000) / 1000) * $radius;
}

// ── Generate observations ──
$observations = DataStore::get('observations');
$existingCount = count($observations);
echo "Existing observations: {$existingCount}\n";

// Remove any existing aikan seed data first
$observations = array_values(array_filter($observations, function ($o) {
    return !isset($o['is_seed']) || $o['is_seed'] !== true ||
        strpos($o['user_id'] ?? '', 'seed_aikan') === false;
}));
$removedCount = $existingCount - count($observations);
if ($removedCount > 0) {
    echo "Removed {$removedCount} old aikan seed observations\n";
}

$newObs = [];
$obsCounter = 0;

foreach ($species as $sp) {
    // Pick a random month from the species' active months
    $month = $sp['months'][array_rand($sp['months'])];

    // Generate date: 2025-04 through 2026-02
    $year = ($month >= 4) ? 2025 : 2026;
    $day = mt_rand(1, 28);
    $date = sprintf('%04d-%02d-%02d', $year, $month, $day);
    $hour = mt_rand(6, 17);
    $minute = mt_rand(0, 59);
    $datetime = sprintf('%s %02d:%02d:00', $date, $hour, $minute);

    // Random coords within boundary
    $lat = randomCoord($centerLat, $radiusLat);
    $lng = randomCoord($centerLng, $radiusLng);

    // Random user
    $user = $seedUsers[array_rand($seedUsers)];

    $obsId = 'obs_seed_aikan_' . str_pad($obsCounter + 1, 3, '0', STR_PAD_LEFT);

    $obs = [
        'id' => $obsId,
        'user_id' => $user['id'],
        'user_name' => $user['name'],
        'user_avatar' => $user['avatar'],
        'user_rank' => '観察者',
        'photos' => [],
        'observed_at' => $datetime,
        'lat' => number_format($lat, 6, '.', ''),
        'lng' => number_format($lng, 6, '.', ''),
        'location_name' => '静岡県浜松市浜名区都田町',
        'taxon_name' => $sp['taxon_name'],
        'taxon_slug' => $sp['taxon_slug'],
        'cultivation' => 'wild',
        'life_stage' => $sp['life_stage'],
        'note' => '',
        'created_at' => $datetime,
        'updated_at' => $datetime,
        'country' => 'JP',
        'prefecture' => 'JP-22',
        'municipality' => '浜松市',
        'is_seed' => true,
    ];

    $newObs[] = $obs;
    $obsCounter++;
}

// Append to existing observations
$observations = array_merge($observations, $newObs);
DataStore::save('observations', $observations);

echo "\n✅ Generated {$obsCounter} seed observations for aikan_hq\n";
echo "Total observations now: " . count($observations) . "\n\n";

// Summary
$categories = [];
$redlistCount = 0;
foreach ($species as $sp) {
    $cat = $sp['category'];
    $categories[$cat] = ($categories[$cat] ?? 0) + 1;
    if (!empty($sp['redlist'])) $redlistCount++;
}
echo "Species by category:\n";
foreach ($categories as $cat => $count) {
    echo "  {$cat}: {$count}\n";
}
echo "Red-listed species: {$redlistCount}\n";
echo "\nDone! 🌿\n";
