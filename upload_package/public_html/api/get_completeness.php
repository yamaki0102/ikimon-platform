<?php

/**
 * get_completeness.php — Completeness Bar API (Growth Style)
 *
 * Returns a user's observation "growth" metrics without using percentages.
 * Instead uses organic metaphors: seed → sprout → sapling → tree → forest
 *
 * GET params:
 *   - user_id (str): optional, defaults to current user
 *
 * Response: JSON with growth stage and metrics
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';

Auth::init();

$userId = $_GET['user_id'] ?? (Auth::user()['id'] ?? '');

if (!$userId) {
    echo json_encode(['error' => 'user_id required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$allObs = DataStore::fetchAll('observations');

// User's observations
$userObs = array_filter($allObs, fn($o) => ($o['user_id'] ?? '') === $userId);
$totalCount = count($userObs);

// Identified observations
$identified = array_filter($userObs, fn($o) => !empty($o['taxon']['id']) || ($o['status'] ?? '') === 'Research Grade');
$identifiedCount = count($identified);

// Unique species
$species = [];
foreach ($identified as $obs) {
    $name = $obs['taxon']['name'] ?? '';
    if ($name) $species[$name] = true;
}
$uniqueSpecies = count($species);

// Unique months with observations
$months = [];
foreach ($userObs as $obs) {
    $date = $obs['observed_at'] ?? $obs['created_at'] ?? '';
    if ($date) $months[substr($date, 0, 7)] = true;
}
$activeMonths = count($months);

// Contributions (identifications given to others)
$idContributions = 0;
foreach ($allObs as $obs) {
    if (($obs['user_id'] ?? '') === $userId) continue;
    foreach ($obs['identifications'] ?? [] as $id) {
        if (($id['user_id'] ?? '') === $userId) $idContributions++;
    }
}

// Determine growth stage (no percentages!)
$growthStages = [
    ['stage' => 'seed',    'label' => '種',    'emoji' => '🌱', 'threshold' => 0],
    ['stage' => 'sprout',  'label' => '芽',    'emoji' => '🌿', 'threshold' => 5],
    ['stage' => 'sapling', 'label' => '若木',  'emoji' => '🌳', 'threshold' => 20],
    ['stage' => 'tree',    'label' => '大木',  'emoji' => '🌲', 'threshold' => 50],
    ['stage' => 'forest',  'label' => '森',    'emoji' => '🏔️', 'threshold' => 100],
];

$currentStage = $growthStages[0];
$nextStage = $growthStages[1];

for ($i = count($growthStages) - 1; $i >= 0; $i--) {
    if ($totalCount >= $growthStages[$i]['threshold']) {
        $currentStage = $growthStages[$i];
        $nextStage = $growthStages[$i + 1] ?? null;
        break;
    }
}

// Growth distance to next stage
$toNext = $nextStage ? ($nextStage['threshold'] - $totalCount) : 0;

echo json_encode([
    'growth' => [
        'stage'          => $currentStage,
        'next_stage'     => $nextStage,
        'observations_to_next' => max(0, $toNext),
    ],
    'metrics' => [
        'total_observations' => $totalCount,
        'identified'         => $identifiedCount,
        'unique_species'     => $uniqueSpecies,
        'active_months'      => $activeMonths,
        'id_contributions'   => $idContributions,
    ],
    'milestones' => [
        ['label' => '最初の一歩',    'achieved' => $totalCount >= 1,  'icon' => '👣'],
        ['label' => '10種類発見',    'achieved' => $uniqueSpecies >= 10, 'icon' => '🔟'],
        ['label' => '名付け親',      'achieved' => $idContributions >= 1, 'icon' => '🏷️'],
        ['label' => '四季の記録者',  'achieved' => $activeMonths >= 4, 'icon' => '🍂'],
        ['label' => '100件の足あと', 'achieved' => $totalCount >= 100, 'icon' => '💯'],
    ],
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);
