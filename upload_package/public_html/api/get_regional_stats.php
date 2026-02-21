<?php

/**
 * API: Get Regional Statistics
 * 
 * Endpoints:
 *   ?action=overview     → National overview (all prefectures)
 *   ?action=detail&pref=JP-22 → Specific prefecture detail
 *   ?action=neighbors&pref=JP-22 → Neighboring comparison
 *   ?action=prefectures  → Prefecture list for selector
 *   ?action=municipalities&pref=JP-22 → Municipality stats within a prefecture
 *   ?action=countries    → Country-level overview
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300'); // 5min cache

require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/RegionalStats.php';

$action = $_GET['action'] ?? 'overview';
$pref = $_GET['pref'] ?? '';

$stats = new RegionalStats();

try {
    switch ($action) {
        case 'overview':
            $data = $stats->getNationalOverview();
            break;

        case 'detail':
            if (!$pref || !preg_match('/^JP-\d{2}$/', $pref)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid prefecture code. Use JP-01 to JP-47.'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
                exit;
            }
            $data = $stats->getPrefectureStats($pref);
            $data['neighbors'] = $stats->getNeighboringComparison($pref);
            $data['recent_discoveries'] = $stats->getRecentDiscoveries($pref, 30);
            $data['taxon_groups'] = $stats->getTaxonGroupDistribution($pref);
            $data['area_users'] = $stats->getAreaUsers($pref);
            break;

        case 'neighbors':
            if (!$pref || !preg_match('/^JP-\d{2}$/', $pref)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid prefecture code.'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
                exit;
            }
            $data = $stats->getNeighboringComparison($pref);
            break;

        case 'prefectures':
            $data = $stats->getPrefectureList();
            break;

        case 'municipalities':
            if (!$pref || !preg_match('/^JP-\d{2}$/', $pref)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid prefecture code.'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
                exit;
            }
            $data = $stats->getMunicipalityStats($pref);
            break;

        case 'countries':
            $data = $stats->getCountryOverview();
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Unknown action. Use: overview, detail, neighbors, prefectures, municipalities, countries'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
            exit;
    }

    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Internal error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
}
