<?php

/**
 * Phase 15: Biological Heatmap Data API
 * 
 * Returns weighted point data for heatmap visualization.
 * 
 * Usage: api/heatmap_data.php?taxon=Insecta&year=2025
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Cache.php';

// Params
$taxonGroup = $_GET['taxon'] ?? 'all';
$year = $_GET['year'] ?? 'all';
$minCreatedYear = 2026;

// Cache Key
$cacheKey = "heatmap_{$taxonGroup}_{$year}";
$cached = Cache::get($cacheKey, 3600); // 1 hour cache

if ($cached) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($cached, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Fetch Data
$allObs = DataStore::fetchAll('observations');
$points = [];

foreach ($allObs as $obs) {
    // 1. Location Check — support both flat (lat/lng) and nested (location.lat/lon)
    $lat = $obs['lat'] ?? $obs['location']['lat'] ?? null;
    $lng = $obs['lng'] ?? $obs['location']['lng'] ?? $obs['location']['lon'] ?? null;
    if ($lat === null || $lng === null) continue;

    $createdAt = (string)($obs['created_at'] ?? '');
    $createdYear = $createdAt !== '' ? (int)substr($createdAt, 0, 4) : 0;
    if ($createdYear < $minCreatedYear) continue;

    // 2. Year Filter
    if ($year !== 'all') {
        $date = $obs['observed_at'] ?? ($obs['created_at'] ?? '');
        if (substr($date, 0, 4) !== $year) continue;
    }

    // 3. Taxon Filter
    if ($taxonGroup !== 'all') {
        $group = $obs['taxon']['class'] ?? ($obs['taxon']['kingdom'] ?? '');
        if (strtolower($group) !== strtolower($taxonGroup)) continue;
    }

    // Weighting Algorithm
    // - Research Grade: x2.0
    // - Normal: x1.0
    $weight = 1.0;

    $status = $obs['quality_grade'] ?? ($obs['status'] ?? '');
    if ($status === 'Research Grade') $weight = 2.0;

    // Round coordinates to reduce precision/size (approx 11m resolution)
    $lat = round(floatval($lat), 4);
    $lng = round(floatval($lng), 4);

    $points[] = [$lat, $lng, $weight];
}

// Prepare Response
$response = [
    'points' => $points,
    'meta' => [
        'count' => count($points),
        'taxon' => $taxonGroup,
        'year' => $year
    ]
];

// Save Cache
Cache::set($cacheKey, $response, 3600);

header('Content-Type: application/json; charset=utf-8');
echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
