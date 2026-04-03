<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../../config/config.php';
require_once __DIR__ . '/../../../libs/PhenologyEngine.php';

$action = trim($_GET['action'] ?? 'predictions');

switch ($action) {
    case 'predictions':
        $lat = (float)($_GET['lat'] ?? 0);
        $lng = (float)($_GET['lng'] ?? 0);
        $month = isset($_GET['month']) ? (int)$_GET['month'] : null;

        if (!$lat || !$lng) {
            echo json_encode(['success' => false, 'error' => 'lat and lng required'], JSON_HEX_TAG);
            exit;
        }

        $predictions = PhenologyEngine::getPredictions($lat, $lng, $month);
        echo json_encode([
            'success' => true,
            'month' => $month ?? (int)date('n'),
            'total_species' => count($predictions),
            'predictions' => $predictions,
        ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        break;

    case 'site_summary':
        $siteId = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['site_id'] ?? '');
        $month = isset($_GET['month']) ? (int)$_GET['month'] : null;

        if (empty($siteId)) {
            echo json_encode(['success' => false, 'error' => 'site_id required'], JSON_HEX_TAG);
            exit;
        }

        $summary = PhenologyEngine::getSitePhenologySummary($siteId, $month);
        echo json_encode(['success' => true, 'summary' => $summary], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        break;

    case 'species_calendar':
        $lat = (float)($_GET['lat'] ?? 0);
        $lng = (float)($_GET['lng'] ?? 0);
        $species = trim($_GET['species'] ?? '');

        if (!$lat || !$lng || empty($species)) {
            echo json_encode(['success' => false, 'error' => 'lat, lng, and species required'], JSON_HEX_TAG);
            exit;
        }

        $calendar = PhenologyEngine::getSpeciesCalendar($lat, $lng, $species);
        echo json_encode(['success' => true, 'calendar' => $calendar], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        break;

    default:
        echo json_encode(['success' => false, 'error' => 'Unknown action'], JSON_HEX_TAG);
}
