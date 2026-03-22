<?php

/**
 * Taxon Index API — Species catalog endpoint for zukan.php
 *
 * GET /api/taxon_index.php
 *   ?q=        - Search query (Japanese name / scientific name)
 *   &group=    - Taxon group (bird, insect, plant, mammal, fish, fungi, amphibian_reptile)
 *   &sort=     - Sort order (obs_count, name, latest, first, encounters)
 *   &limit=    - Results per page (default 24, max 100)
 *   &offset=   - Pagination offset
 *   &user_id=  - Filter to user's collection only
 *   &mode=my   - My Zukan mode (requires auth, returns personal encounters)
 *   &category= - Category filter for mode=my (post, walk, scan, identify, audio)
 *   &detail=1  - Return full encounter detail for a single taxon_key
 *   &taxon_key=- Taxon key for detail mode
 *
 * @version 2.0.0
 * @since 2026-02-15
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Services/ZukanService.php';
require_once __DIR__ . '/../../libs/Auth.php';

$mode = $_GET['mode'] ?? '';

try {
    if ($mode === 'my') {
        require_once __DIR__ . '/../../libs/Services/MyZukanService.php';

        Auth::init();
        if (!Auth::isLoggedIn()) {
            http_response_code(401);
            echo json_encode(['error' => 'Login required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
            exit;
        }

        $userId = Auth::user()['id'];
        header('Cache-Control: private, max-age=60');

        $detail = $_GET['detail'] ?? '';
        $taxonKey = $_GET['taxon_key'] ?? '';

        if ($detail && $taxonKey) {
            $entry = MyZukanService::getSpeciesDetail($userId, $taxonKey);
            if (!$entry) {
                http_response_code(404);
                echo json_encode(['error' => 'Species not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
                exit;
            }
            echo json_encode(['success' => true, 'entry' => $entry], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        } else {
            $options = [
                'q'        => $_GET['q'] ?? '',
                'group'    => $_GET['group'] ?? '',
                'category' => $_GET['category'] ?? '',
                'sort'     => $_GET['sort'] ?? 'latest',
                'limit'    => $_GET['limit'] ?? 24,
                'offset'   => $_GET['offset'] ?? 0,
            ];

            $result = MyZukanService::getSpeciesList($userId, $options);
            echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        }
    } else {
        header('Cache-Control: public, max-age=300');

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
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error'   => 'Internal server error',
        'message' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
}
