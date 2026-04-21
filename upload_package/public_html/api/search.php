<?php

/**
 * Unified Search API — Cross-search species names + locations
 * 
 * Usage: api/search.php?q=クワガタ&limit=10
 * Response: { "results": [ { type: "taxon"|"place"|"site", name, ... }, ... ] }
 * 
 * Performance: Place names are cached (30min TTL) to avoid scanning all observations each request.
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/TaxonSearchService.php';
require_once __DIR__ . '/../../libs/SiteManager.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Cache.php';
require_once __DIR__ . '/../../libs/PrivacyFilter.php';

header('Content-Type: application/json; charset=utf-8');

$query = trim($_GET['q'] ?? '');
$limit = min((int)($_GET['limit'] ?? 10), 30);
$locale = $_GET['locale'] ?? 'ja';

if (mb_strlen($query) < 1) {
    echo json_encode(['results' => []], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$results = [];
$queryLower = mb_strtolower($query);

// 1. Taxon search (species names) — TaxonSearchService handles its own caching
try {
    $taxonResults = TaxonSearchService::search($query, [
        'locale' => $locale,
        'limit'  => min($limit, 5),
    ]);

    foreach ($taxonResults as $t) {
        $results[] = [
            'type'            => 'taxon',
            'name'            => $t['name'] ?? $t['scientific_name'] ?? '',
            'scientific_name' => $t['scientific_name'] ?? '',
            'common_name'     => $t['common_name'] ?? ($t['name'] ?? ''),
            'group'           => $t['group'] ?? '',
            'icon'            => '🔬',
        ];
    }
} catch (\Throwable $e) {
    // TaxonSearchService may not be available, continue
}

// 2. Site search (registered observation sites — lightweight, no caching needed)
try {
    $sites = SiteManager::listAll();
    foreach ($sites as $site) {
        $name = mb_strtolower($site['name'] ?? '');
        $desc = mb_strtolower($site['description'] ?? '');
        $addr = mb_strtolower($site['address'] ?? '');

        if (
            mb_strpos($name, $queryLower) !== false
            || mb_strpos($desc, $queryLower) !== false
            || mb_strpos($addr, $queryLower) !== false
        ) {
            $results[] = [
                'type'   => 'site',
                'name'   => $site['name'],
                'id'     => $site['id'],
                'center' => $site['center'] ?? null,
                'icon'   => '📍',
            ];
        }
    }
} catch (\Throwable $e) {
    // Skip
}

// 3. Place name search — CACHED unique place names (30min TTL)
try {
    $cacheKey = 'search_place_names_index';
    $placeIndex = Cache::get($cacheKey, 1800);

    if (!$placeIndex) {
        // Build place name index from observations (one-time per 30min)
        $placeIndex = [];
        $observations = DataStore::fetchAll('observations');

        foreach ($observations as $obs) {
            $placeName = PrivacyFilter::resolvePublicLocationLabel($obs);
            if (!$placeName) continue;

            $placeKey = mb_strtolower($placeName);
            if (!isset($placeIndex[$placeKey])) {
                $publicLocation = PrivacyFilter::buildPublicLocationSummary($obs);
                if (!empty($publicLocation['is_hidden']) || !is_numeric($publicLocation['lat'] ?? null) || !is_numeric($publicLocation['lng'] ?? null)) {
                    continue;
                }
                $placeIndex[$placeKey] = [
                    'name' => $placeName,
                    'lat'  => (float)$publicLocation['lat'],
                    'lng'  => (float)$publicLocation['lng'],
                ];
            }
        }

        // Convert to indexed array for cache storage
        $placeIndex = array_values($placeIndex);
        Cache::set($cacheKey, $placeIndex, 1800);
    }

    // Search cached index
    $placeCount = 0;
    foreach ($placeIndex as $place) {
        $placeKey = mb_strtolower($place['name']);
        if (mb_strpos($placeKey, $queryLower) !== false) {
            $results[] = [
                'type' => 'place',
                'name' => $place['name'],
                'lat'  => $place['lat'],
                'lng'  => $place['lng'],
                'icon' => '🗺️',
            ];
            $placeCount++;
            if ($placeCount >= 5) break;
        }
    }
} catch (\Throwable $e) {
    // Skip
}

// Trim to limit
$results = array_slice($results, 0, $limit);

echo json_encode(['results' => $results], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
