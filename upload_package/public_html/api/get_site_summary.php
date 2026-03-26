<?php

/**
 * API: Site Summary
 *
 * Community 用の安全なサマリーAPI。
 * 汎用観察APIを経由せず、サイト単位で必要な概要だけ返す。
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/CorporatePlanGate.php';
require_once __DIR__ . '/../../libs/SiteManager.php';

header('Content-Type: application/json; charset=utf-8');

$siteId = trim((string)($_GET['site_id'] ?? ''));
if ($siteId === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'site_id が必要です',
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$site = SiteManager::load($siteId);
if (!$site) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'Site not found',
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$stats = SiteManager::getSiteStats($siteId);
$corporation = CorporatePlanGate::resolveCorporationForSite($siteId);
$canRevealSpeciesDetails = CorporatePlanGate::canRevealSpeciesDetails($corporation);
$isCommunityWorkspace = CorporatePlanGate::isCommunityWorkspace($corporation);

$summary = [
    'total_observations' => (int)($stats['total_observations'] ?? 0),
    'total_species' => (int)($stats['total_species'] ?? 0),
    'observer_count' => (int)($stats['total_observers'] ?? 0),
    'active_months' => (int)($stats['active_months'] ?? 0),
    'days_since_last_obs' => (int)($stats['days_since_last_obs'] ?? 0),
    'taxonomic_groups' => $stats['taxonomic_groups'] ?? [],
    'monthly_trend' => $stats['monthly_trend'] ?? [],
];

$mapPoints = [];
if ($canRevealSpeciesDetails) {
    foreach (SiteManager::getObservationsInSite($siteId, 300) as $obs) {
        $lat = isset($obs['lat']) ? (float)$obs['lat'] : 0.0;
        $lng = isset($obs['lng']) ? (float)$obs['lng'] : 0.0;
        if ($lat === 0.0 && $lng === 0.0) {
            continue;
        }

        $mapPoints[] = [
            'id' => (string)($obs['id'] ?? ''),
            'lat' => $lat,
            'lng' => $lng,
            'name' => (string)($obs['taxon']['name'] ?? ($obs['species_name'] ?? '未同定')),
            'observed_at' => (string)($obs['observed_at'] ?? ($obs['created_at'] ?? '')),
        ];
    }
}

echo json_encode([
    'success' => true,
    'data' => [
        'site_id' => $siteId,
        'is_community_workspace' => $isCommunityWorkspace,
        'species_detail_available' => $canRevealSpeciesDetails,
        'summary' => $summary,
        'map_points' => $mapPoints,
    ],
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
