<?php
/**
 * Ghost API
 * Phase C: Ambient Presence
 * Returns anonymized coordinates of observations made within the last 24 hours.
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';

header('Content-Type: application/json; charset=utf-8');

$allObs = DataStore::fetchAll('observations');
$ghosts = [];
$now = time();
$twentyFourHoursAgo = $now - (24 * 3600);

foreach ($allObs as $obs) {
    if (!isset($obs['location']['lat'], $obs['location']['lon'])) continue;
    
    $timestamp = isset($obs['created_at']) ? strtotime($obs['created_at']) : 0;
    if ($timestamp < $twentyFourHoursAgo) continue;

    // Fuzz coordinates slightly (approx ~100m) for anonymity
    // 0.001 deg is approx 111m
    $fuzzLat = (rand(-10, 10) / 10000);
    $fuzzLng = (rand(-10, 10) / 10000);
    
    $lat = floatval($obs['location']['lat']) + $fuzzLat;
    $lng = floatval($obs['location']['lon']) + $fuzzLng;
    
    // Calculate how many hours ago for opacity calculation
    $hoursAgo = max(0, min(24, ($now - $timestamp) / 3600));

    $ghosts[] = [
        'lat' => $lat,
        'lng' => $lng,
        'hours_ago' => round($hoursAgo, 1)
    ];
}

echo json_encode([
    'success' => true,
    'ghosts' => $ghosts
], JSON_UNESCAPED_UNICODE);
