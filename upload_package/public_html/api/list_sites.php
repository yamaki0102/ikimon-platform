<?php

/**
 * List Sites API — Returns all registered sites with basic info + geometry
 * 
 * Usage: api/list_sites.php
 * Response: { "sites": [ { id, name, description, geometry, center }, ... ] }
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/SiteManager.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $sites = SiteManager::listAll();

    // Return lightweight site data (drop heavy fields for list view)
    $result = array_map(function ($site) {
        return [
            'id'          => $site['id'],
            'name'        => $site['name'],
            'name_en'     => $site['name_en'] ?? '',
            'description' => $site['description'] ?? '',
            'center'      => $site['center'] ?? null,
            'geometry'    => $site['geometry'] ?? null,
            'status'      => $site['status'] ?? 'active',
        ];
    }, $sites);

    echo json_encode(['sites' => $result], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to load sites', 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
}
