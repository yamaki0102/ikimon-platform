<?php

/**
 * API: Get Site Statistics
 * 
 * GET /api/get_site_stats.php?site_id=ikan_hq
 * 
 * Returns: JSON with site info, boundary GeoJSON, and observation statistics
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/SiteManager.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$siteId = $_GET['site_id'] ?? '';

if (!$siteId) {
    // List all sites
    $sites = SiteManager::listAll();
    echo json_encode([
        'success' => true,
        'data' => $sites,
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Load specific site
$site = SiteManager::load($siteId);
if (!$site) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Site not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Get statistics
$stats = SiteManager::getSiteStats($siteId);

// Get raw GeoJSON for map rendering
$geojson = SiteManager::getGeoJSON($siteId);

echo json_encode([
    'success' => true,
    'data' => [
        'site'    => $site,
        'stats'   => $stats,
        'geojson' => $geojson,
    ]
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
