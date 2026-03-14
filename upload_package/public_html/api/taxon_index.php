<?php

/**
 * Taxon Index API — Species catalog endpoint for zukan.php
 * 
 * GET /api/taxon_index.php
 *   ?q=       - Search query (Japanese name / scientific name)
 *   &group=   - Taxon group (bird, insect, plant, mammal, fish, fungi, amphibian_reptile)
 *   &sort=    - Sort order (obs_count, name, latest)
 *   &limit=   - Results per page (default 24, max 100)
 *   &offset=  - Pagination offset
 *   &user_id= - Filter to user's collection only
 * 
 * @version 1.0.0
 * @since 2026-02-15
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Lang.php';
require_once __DIR__ . '/../../libs/Services/ZukanService.php';

try {
    Lang::init();

    $options = [
        'q'       => $_GET['q'] ?? '',
        'group'   => $_GET['group'] ?? '',
        'sort'    => $_GET['sort'] ?? 'obs_count',
        'limit'   => $_GET['limit'] ?? 24,
        'offset'  => $_GET['offset'] ?? 0,
        'user_id' => $_GET['user_id'] ?? '',
    ];

    $result = ZukanService::getSpeciesList($options);

    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error'   => 'Internal server error',
        'message' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
}
