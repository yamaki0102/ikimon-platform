<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../../config/config.php';
require_once __DIR__ . '/../../../libs/SiteTwinSnapshot.php';

$siteId = trim($_GET['site_id'] ?? '');
$action = trim($_GET['action'] ?? 'latest');

if (empty($siteId)) {
    echo json_encode(['success' => false, 'error' => 'site_id required'], JSON_HEX_TAG);
    exit;
}

$siteId = preg_replace('/[^a-zA-Z0-9_-]/', '', $siteId);

switch ($action) {
    case 'latest':
        $snapshot = SiteTwinSnapshot::getLatest($siteId);
        if (!$snapshot) {
            $snapshot = SiteTwinSnapshot::generate($siteId);
        }
        if ($snapshot) {
            echo json_encode(['success' => true, 'snapshot' => $snapshot], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        } else {
            echo json_encode(['success' => false, 'error' => 'Site not found or no data'], JSON_HEX_TAG);
        }
        break;

    case 'history':
        $weeks = min(52, max(1, (int)($_GET['weeks'] ?? 12)));
        $history = SiteTwinSnapshot::getHistory($siteId, $weeks);
        echo json_encode(['success' => true, 'history' => $history, 'count' => count($history)], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        break;

    case 'generate':
        $snapshot = SiteTwinSnapshot::generate($siteId);
        if ($snapshot) {
            echo json_encode(['success' => true, 'snapshot' => $snapshot], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        } else {
            echo json_encode(['success' => false, 'error' => 'Generation failed'], JSON_HEX_TAG);
        }
        break;

    default:
        echo json_encode(['success' => false, 'error' => 'Unknown action: ' . $action], JSON_HEX_TAG);
}
