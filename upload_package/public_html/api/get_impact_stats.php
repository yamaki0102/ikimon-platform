<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/GeoUtils.php';

Auth::init();
header('Content-Type: application/json; charset=utf-8');

$id = $_GET['id'] ?? '';
$obs = DataStore::findById('observations', $id);

if (!$obs) {
    echo json_encode(['success' => false, 'message' => 'Observation not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Calculate Impact Stats
// 1. Local Rank (e.g. "You are #X contributor in Hamamatsu")
// 2. Species First/Rarity (e.g. "1st observation of this species in Hamamatsu")

// Mocking "Hamamatsu" detection (in reality, use Geocoding or Polygon)
$city = "Hamamatsu"; // Default for MVP

// Fetch all observations (using cache/index would be better, but fetchAll is robust now)
$all = DataStore::fetchAll('observations');

$city_obs_count = 0;
$user_city_count = 0;
$species_city_count = 0;
$is_first_species_in_city = false;

// Filter for City
foreach ($all as $o) {
    // Simple lat/lng box for Hamamatsu (approx)
    if ($o['lat'] > 34.6 && $o['lat'] < 35.0 && $o['lng'] > 137.5 && $o['lng'] < 138.0) {
        $city_obs_count++;
        
        if ($o['user_id'] === $obs['user_id']) {
            $user_city_count++;
        }
        
        if (isset($o['taxon']['name']) && isset($obs['taxon']['name']) && $o['taxon']['name'] === $obs['taxon']['name']) {
             $species_city_count++;
             // Check if this obs is the oldest?
             // If we sort by date...
        }
    }
}

// Emphasize the "Hero" aspect
$message = [];
if ($species_city_count === 1) {
    $message[] = "浜松市での初見記録です！(New Record)";
} else if ($species_city_count < 5) {
    $message[] = "浜松市でまだ " . $species_city_count . " 例しかない貴重な記録です！";
}

$rank_msg = "あなたは浜松市の貢献者トップ10に入っています！"; // Mock logic for simplicity or need sorting users

echo json_encode([
    'success' => true,
    'city' => $city,
    'stats' => [
        'city_total' => $city_obs_count,
        'user_city_total' => $user_city_count,
        'species_city_total' => $species_city_count
    ],
    'hero_messages' => $message,
    'badges' => [
        ['icon' => 'map-pin', 'label' => '地域貢献者'],
        ['icon' => 'leaf', 'label' => '初発見']
    ]
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
