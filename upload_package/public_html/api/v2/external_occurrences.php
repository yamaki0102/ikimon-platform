<?php

/**
 * API v2: External Occurrences — 外部データベースの種記録取得
 *
 * GET /api/v2/external_occurrences.php?lat=34.71&lng=137.73&source=both&radius=5
 *
 * GBIF / iNaturalist から指定座標周辺の種記録を取得。
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Services/GbifOccurrenceService.php';
require_once ROOT_DIR . '/libs/Services/iNatOccurrenceService.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('Method not allowed', 405);
}

if (!api_rate_limit('external_occ', 20, 60)) {
    api_error('Rate limit exceeded', 429);
}

$lat = api_param('lat', null, 'float');
$lng = api_param('lng', null, 'float');
$source = api_param('source', 'both', 'string');
$radius = api_param('radius', 5, 'int');

if ($lat === null || $lng === null) {
    api_error('lat and lng are required', 400);
}

if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
    api_error('Invalid coordinates', 400);
}

$radius = max(1, min(10, $radius));

$gbifData = null;
$inatData = null;

if ($source === 'gbif' || $source === 'both') {
    $gbifData = GbifOccurrenceService::search($lat, $lng, $radius);
}

if ($source === 'inat' || $source === 'both') {
    $inatData = iNatOccurrenceService::search($lat, $lng, $radius);
}

$mergedSpecies = [];
if ($gbifData) {
    foreach ($gbifData['top_species'] ?? [] as $sp) {
        $key = strtolower(trim($sp['scientific_name'] ?? ''));
        if ($key === '') continue;
        $mergedSpecies[$key] = [
            'scientific_name' => $sp['scientific_name'],
            'gbif_count' => $sp['count'] ?? 0,
            'inat_count' => 0,
            'kingdom' => $sp['kingdom'] ?? null,
        ];
    }
}
if ($inatData) {
    foreach ($inatData['top_species'] ?? [] as $sp) {
        $key = strtolower(trim($sp['scientific_name'] ?? ''));
        if ($key === '') continue;
        if (isset($mergedSpecies[$key])) {
            $mergedSpecies[$key]['inat_count'] = $sp['count'] ?? 0;
            if (!$mergedSpecies[$key]['kingdom'] && isset($sp['iconic_taxon'])) {
                $mergedSpecies[$key]['iconic_taxon'] = $sp['iconic_taxon'];
            }
        } else {
            $mergedSpecies[$key] = [
                'scientific_name' => $sp['scientific_name'],
                'gbif_count' => 0,
                'inat_count' => $sp['count'] ?? 0,
                'iconic_taxon' => $sp['iconic_taxon'] ?? null,
            ];
        }
    }
}

uasort($mergedSpecies, fn($a, $b) => ($b['gbif_count'] + $b['inat_count']) <=> ($a['gbif_count'] + $a['inat_count']));

api_success([
    'center' => ['lat' => $lat, 'lng' => $lng],
    'radius_km' => $radius,
    'sources' => [
        'gbif' => $gbifData ? [
            'species_count' => $gbifData['species_count'],
            'total_records' => $gbifData['total_records'],
            'fetched_at' => $gbifData['fetched_at'],
        ] : null,
        'inat' => $inatData ? [
            'species_count' => $inatData['species_count'],
            'total_records' => $inatData['total_records'],
            'fetched_at' => $inatData['fetched_at'],
        ] : null,
    ],
    'merged_species_count' => count($mergedSpecies),
    'species' => array_values($mergedSpecies),
]);
