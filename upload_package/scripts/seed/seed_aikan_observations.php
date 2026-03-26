<?php

/**
 * Phase 15 — Seed ikan_hq observations
 * 
 * - Adds diverse species with proper taxon structure
 * - Includes Red List species from shizuoka.json
 * - Spans multiple months for trend visibility
 * - Sets correct taxon.class for report taxonomy mapping
 * 
 * SAFE: Removes old obs_aikan_* entries first, then re-inserts fresh data.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';

// ───── Configuration ─────
$siteId = 'ikan_hq';
// Center of ikan_hq: 137.732881, 34.813473 (±0.001 for point spread)
$center = ['lat' => 34.813473, 'lng' => 137.732881];
$spread = 0.0012; // ~100m spread

// ───── Seed Data Definition ─────
// Format: [id_suffix, ja_name, sci_name, class, group(ja), date, quality, user_id]
$seeds = [
    // === Red List Species (intentional match with shizuoka.json) ===
    ['rl01', 'ゲンジボタル', 'Luciola cruciata', 'Insecta', '昆虫類', '2025-06-15 20:30:00', 'Research Grade', 'user_tanaka'],
    ['rl02', 'メダカ', 'Oryzias latipes', 'Actinopterygii', '魚類', '2025-07-20 14:00:00', 'Research Grade', 'user_suzuki'],
    ['rl03', 'オオムラサキ', 'Sasakia charonda', 'Insecta', '昆虫類', '2025-07-05 10:15:00', 'Research Grade', 'user_tanaka'],
    ['rl04', 'ニホンイシガメ', 'Mauremys japonica', 'Reptilia', '爬虫類', '2025-08-10 09:00:00', 'Research Grade', 'user_yamada'],
    ['rl05', 'カワセミ', 'Alcedo atthis', 'Aves', '鳥類', '2025-09-12 07:30:00', 'Research Grade', 'user_suzuki'],
    ['rl06', 'モリアオガエル', 'Rhacophorus arboreus', 'Amphibia', '両生類', '2025-06-20 19:00:00', 'Research Grade', 'user_yamada'],
    ['rl07', 'タガメ', 'Kirkaldyia deyrolli', 'Insecta', '昆虫類', '2025-08-25 21:00:00', 'Needs ID', 'user_tanaka'],

    // === Common species (not Red List, for diversity) ===
    ['cm01', 'ツバメ', 'Hirundo rustica', 'Aves', '鳥類', '2025-10-05 08:00:00', 'Research Grade', 'user_suzuki'],
    ['cm02', 'モンシロチョウ', 'Pieris rapae', 'Insecta', '昆虫類', '2025-10-12 11:30:00', 'Research Grade', 'user_tanaka'],
    ['cm03', 'アマガエル', 'Hyla japonica', 'Amphibia', '両生類', '2025-11-01 16:00:00', 'Research Grade', 'user_yamada'],
    ['cm04', 'シジュウカラ', 'Parus minor', 'Aves', '鳥類', '2025-11-15 07:45:00', 'Research Grade', 'user_suzuki'],
    ['cm05', 'トノサマバッタ', 'Locusta migratoria', 'Insecta', '昆虫類', '2025-12-01 13:00:00', 'Research Grade', 'user_tanaka'],
    ['cm06', 'キジバト', 'Streptopelia orientalis', 'Aves', '鳥類', '2025-12-20 09:30:00', 'Research Grade', 'user_yamada'],
    ['cm07', 'カントウタンポポ', 'Taraxacum platycarpum', 'Plantae', '植物', '2026-01-15 10:00:00', 'Research Grade', 'user_suzuki'],
    ['cm08', 'ジョウビタキ', 'Phoenicurus auroreus', 'Aves', '鳥類', '2026-01-20 08:15:00', 'Research Grade', 'user_tanaka'],
    ['cm09', 'ヒメオドリコソウ', 'Lamium purpureum', 'Plantae', '植物', '2026-02-01 11:00:00', 'Research Grade', 'user_yamada'],
    ['cm10', 'ハクセキレイ', 'Motacilla alba', 'Aves', '鳥類', '2026-02-05 07:00:00', 'Research Grade', 'user_suzuki'],
    ['cm11', 'ウグイス', 'Horornis diphone', 'Aves', '鳥類', '2026-02-07 06:30:00', 'Needs ID', 'user_tanaka'],
    ['cm12', 'フキノトウ', 'Petasites japonicus', 'Plantae', '植物', '2026-02-08 09:00:00', 'Needs ID', 'user_yamada'],

    // === Duplicates for trend (same species, different dates) ===
    ['dup01', 'ゲンジボタル', 'Luciola cruciata', 'Insecta', '昆虫類', '2025-07-10 21:00:00', 'Research Grade', 'user_suzuki'],
    ['dup02', 'メダカ', 'Oryzias latipes', 'Actinopterygii', '魚類', '2025-09-05 15:30:00', 'Research Grade', 'user_yamada'],
    ['dup03', 'ツバメ', 'Hirundo rustica', 'Aves', '鳥類', '2025-11-20 08:30:00', 'Research Grade', 'user_tanaka'],
    ['dup04', 'カワセミ', 'Alcedo atthis', 'Aves', '鳥類', '2026-01-10 07:00:00', 'Research Grade', 'user_yamada'],
];


// ───── Step 1: Remove old obs_aikan_* entries ─────
$allObs = DataStore::fetchAll('observations');
$cleaned = [];
$removedCount = 0;

foreach ($allObs as $obs) {
    $id = $obs['id'] ?? '';
    if (str_starts_with($id, 'obs_aikan_')) {
        $removedCount++;
    } else {
        $cleaned[] = $obs;
    }
}

echo "Removed $removedCount old obs_aikan_* entries\n";


// ───── Step 2: Generate new observations ─────
$newObs = [];
foreach ($seeds as $seed) {
    [$suffix, $jaName, $sciName, $class, $groupJa, $date, $quality, $userId] = $seed;

    // Random offset within site boundary
    $lat = $center['lat'] + (mt_rand(-100, 100) / 100) * $spread;
    $lng = $center['lng'] + (mt_rand(-100, 100) / 100) * $spread;

    $obs = [
        'id'            => 'obs_aikan_' . $suffix,
        'user_id'       => $userId,
        'site_id'       => $siteId,
        'taxon'         => [
            'name'            => $jaName,
            'scientific_name' => $sciName,
            'class'           => $class,
            'group'           => $groupJa,
        ],
        'species_name'  => $jaName,
        'scientific_name' => $sciName,
        'category'      => $groupJa,
        'lat'           => round($lat, 6),
        'lng'           => round($lng, 6),
        'observed_at'   => $date,
        'created_at'    => $date,
        'quality_grade' => $quality,
        'status'        => $quality,
        'photos'        => [],
        'likes'         => [],
        'seed_version'  => 'phase15_v2',
    ];

    $newObs[] = $obs;
}

echo "Generated " . count($newObs) . " new observations\n";


// ───── Step 3: Merge & Save ─────
$merged = array_merge($cleaned, $newObs);
DataStore::save('observations', $merged);

echo "Total observations after merge: " . count($merged) . "\n";
echo "\n=== Species List ===\n";
foreach ($seeds as $s) {
    echo "  {$s[0]}: {$s[1]} ({$s[2]}) [{$s[4]}] {$s[5]} [{$s[6]}]\n";
}

echo "\nDone! Seed data injected successfully.\n";
