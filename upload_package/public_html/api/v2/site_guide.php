<?php

/**
 * Site Guide API — サイトガイド取得
 *
 * GET /api/v2/site_guide.php?site_id=ikan_hq
 * GET /api/v2/site_guide.php?lat=34.8144&lng=137.7333  (自動検出)
 *
 * Returns guide data (POIs, walking routes, seasonal info) for a site.
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/SiteManager.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('GET only', 405);
}

$siteId = api_param('site_id');
$lat    = api_param('lat', null, 'float');
$lng    = api_param('lng', null, 'float');

if (!$siteId && $lat && $lng) {
    $sites = SiteManager::listAll(true);
    foreach ($sites as $s) {
        $site = SiteManager::load($s['id']);
        if (!$site || empty($site['geometry'])) continue;
        if (SiteManager::isPointInGeometry($lat, $lng, $site['geometry'])) {
            $siteId = $s['id'];
            break;
        }
    }
    if (!$siteId) {
        api_success(null, ['matched' => false]);
    }
}

if (!$siteId) {
    api_error('site_id or lat/lng required', 400);
}

$guidePath = DATA_DIR . "/sites/{$siteId}/guide.json";

if (!file_exists($guidePath)) {
    api_success(null, ['has_guide' => false, 'site_id' => $siteId]);
}

$guide = json_decode(file_get_contents($guidePath), true);

if (!$guide) {
    api_error('Failed to parse guide data', 500);
}

$siteMeta = SiteManager::load($siteId);

api_success([
    'site_id'   => $siteId,
    'site_name' => $siteMeta['name'] ?? $siteId,
    'guide'     => $guide,
], ['has_guide' => true]);
