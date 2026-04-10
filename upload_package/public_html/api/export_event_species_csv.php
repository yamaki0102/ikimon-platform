<?php

/**
 * Event Species List CSV Export
 *
 * Generates a species-aggregated CSV for a given event (observation meeting).
 * Available to Public plan corporations only.
 *
 * Usage: GET /api/export_event_species_csv.php?event_id=evt_xxxx
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/EventManager.php';
require_once __DIR__ . '/../../libs/CorporatePlanGate.php';
require_once __DIR__ . '/../../libs/CorporateManager.php';
require_once __DIR__ . '/../../libs/RedListManager.php';
require_once __DIR__ . '/../../libs/PrivacyFilter.php';
require_once __DIR__ . '/../../libs/GeoUtils.php';

// --- Auth ---
Auth::init();

if (!Auth::isLoggedIn()) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'ログインが必要です'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
    exit;
}

$user = Auth::user();

// --- Event Loading ---
$eventId = $_GET['event_id'] ?? '';
if (!$eventId) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'event_id パラメータが必要です'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
    exit;
}

$event = EventManager::get($eventId);
if (!$event) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'イベントが見つかりません'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
    exit;
}

// --- Permission Check (organizer or admin) ---
$isOrganizer = ($user['id'] === ($event['organizer_id'] ?? ''));
$isAdmin = (($user['role'] ?? '') === 'Admin');
if (!$isOrganizer && !$isAdmin) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => '権限がありません'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
    exit;
}

// --- Plan Gate (Public plan only) ---
$corporation = CorporatePlanGate::resolveCorporationForEvent($event);
if ($corporation && !CorporatePlanGate::canUseAdvancedOutputs($corporation)) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Community ワークスペースでは種リストCSVをエクスポートできません。Public プランにアップグレードしてください。'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
    exit;
}

// --- Observation Collection (same logic as generate_grant_report.php) ---
$eventDate = $event['event_date'] ?? date('Y-m-d');
$startTime = $event['start_time'] ?? '09:00';
$endTime = $event['end_time'] ?? '12:00';
$bufferMin = 30;

$rangeStart = (new DateTime("{$eventDate} {$startTime}"))->modify("-{$bufferMin} minutes");
$rangeEnd = (new DateTime("{$eventDate} {$endTime}"))->modify("+{$bufferMin} minutes");
$evtLat = (float)($event['location']['lat'] ?? 0);
$evtLng = (float)($event['location']['lng'] ?? 0);
$radiusM = (int)($event['location']['radius_m'] ?? 500);
$eventCode = $event['event_code'] ?? '';

$linkedIds = $event['linked_observations'] ?? [];
$touchedObsIds = [];
$matchedObs = [];

$dateKey = str_replace('-', '', $eventDate);
$partitionFile = "observations/{$dateKey}";
$dayObservations = DataStore::get($partitionFile);
$candidates = $dayObservations ? $dayObservations : DataStore::getLatest('observations', 2000);

foreach ($candidates as $obs) {
    $obsId = $obs['id'] ?? '';
    if (isset($touchedObsIds[$obsId])) {
        continue;
    }

    $obsTag = $obs['event_tag'] ?? '';
    if (in_array($obsId, $linkedIds) || ($eventCode && $obsTag === $eventCode)) {
        $touchedObsIds[$obsId] = true;
        $matchedObs[] = $obs;
        continue;
    }

    $obsTime = $obs['observed_at'] ?? $obs['created_at'] ?? '';
    if (!$obsTime || strpos($obsTime, $eventDate) !== 0) {
        continue;
    }

    $obsDateTime = new DateTime($obsTime);
    if ($obsDateTime >= $rangeStart && $obsDateTime <= $rangeEnd) {
        $obsLat = (float)($obs['lat'] ?? 0);
        $obsLng = (float)($obs['lng'] ?? 0);
        if ($obsLat && $obsLng && $evtLat && $evtLng && GeoUtils::distance($evtLat, $evtLng, $obsLat, $obsLng) <= $radiusM) {
            $touchedObsIds[$obsId] = true;
            $matchedObs[] = $obs;
        }
    }
}

// --- Species Aggregation ---
$speciesAgg = [];

foreach ($matchedObs as $obs) {
    $taxonName = $obs['taxon']['name'] ?? ($obs['identifications'][0]['taxon_name'] ?? '不明');
    $scientificName = $obs['taxon']['scientific_name'] ?? ($obs['scientific_name'] ?? '');
    $taxonKey = $obs['taxon']['key'] ?? ($obs['taxon_key'] ?? ($obs['gbif_key'] ?? ''));
    $obsTime = $obs['observed_at'] ?? ($obs['created_at'] ?? '');
    $hasPhoto = !empty($obs['photos']) || !empty($obs['images']) || !empty($obs['image_url']);

    if ($taxonName === '不明') {
        continue;
    }

    if (!isset($speciesAgg[$taxonName])) {
        $speciesAgg[$taxonName] = [
            'scientific_name' => $scientificName,
            'taxon_key' => $taxonKey,
            'count' => 0,
            'first_time' => $obsTime,
            'last_time' => $obsTime,
            'has_photo' => false,
        ];
    }

    $agg = &$speciesAgg[$taxonName];
    $agg['count']++;

    if ($obsTime && (!$agg['first_time'] || $obsTime < $agg['first_time'])) {
        $agg['first_time'] = $obsTime;
    }
    if ($obsTime && (!$agg['last_time'] || $obsTime > $agg['last_time'])) {
        $agg['last_time'] = $obsTime;
    }
    if ($hasPhoto) {
        $agg['has_photo'] = true;
    }
    if (!$agg['scientific_name'] && $scientificName) {
        $agg['scientific_name'] = $scientificName;
    }
    if (!$agg['taxon_key'] && $taxonKey) {
        $agg['taxon_key'] = $taxonKey;
    }
    unset($agg);
}

ksort($speciesAgg);

// --- RedList + Privacy ---
$redListManager = new RedListManager();

// --- CSV Output ---
$eventTitle = preg_replace('/[^\w\-]/', '_', $event['title'] ?? $eventId);
$filename = "event_species_{$eventTitle}_" . date('Ymd') . ".csv";

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');
header('Expires: 0');

$output = fopen('php://output', 'w');
fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));

fputcsv($output, [
    '和名',
    '学名',
    'taxon_key',
    '観察件数',
    '初観察時刻',
    '最終観察時刻',
    '代表写真有無',
    '希少種フラグ',
    '公開可否',
]);

foreach ($speciesAgg as $name => $data) {
    $redListCategory = '';
    try {
        $rlResult = $redListManager->lookup($name);
        if ($rlResult) {
            $redListCategory = $rlResult['category'] ?? '';
        }
    } catch (\Throwable $e) {
        // skip
    }

    $isProtected = PrivacyFilter::isProtectedSpecies($name);

    fputcsv($output, [
        $name,
        $data['scientific_name'],
        $data['taxon_key'],
        $data['count'],
        $data['first_time'],
        $data['last_time'],
        $data['has_photo'] ? 'TRUE' : 'FALSE',
        $redListCategory,
        $isProtected ? '要配慮' : 'OK',
    ]);
}

fclose($output);
exit;
