<?php

/**
 * save_event.php — 観察会V2 作成/編集 API
 *
 * POST body (JSON):
 *   - id (str): optional, 既存イベント編集時
 *   - title (str): optional, 未入力なら自動生成
 *   - memo (str): optional, 短いメモ(100字)
 *   - event_date (str): required (Y-m-d)
 *   - start_time (str): optional (H:i), default '09:00'
 *   - end_time (str): optional (H:i), default '12:00'
 *   - location.type (str): 'site' or 'custom'
 *   - location.site_id (str): type=site のとき
 *   - location.lat (float): required
 *   - location.lng (float): required
 *   - location.radius_m (int): default 500
 *   - location.name (str): 場所名
 *   - meeting_point (str): optional, 集合場所(200字)
 *   - rain_policy (str): optional, 雨天中止/小雨決行/雨天決行
 *   - precautions (str): optional, 注意事項(500字)
 *   - target_species (array): optional, 目標種リスト
 *   - grant_id (str): optional, 助成金・プロジェクトID
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/EventManager.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$user = Auth::user();
$input = json_decode(file_get_contents('php://input'), true);

// Required: date + location
$eventDate = trim($input['event_date'] ?? '');
$lat = (float)($input['location']['lat'] ?? 0);
$lng = (float)($input['location']['lng'] ?? 0);

if (!$eventDate || !$lat || !$lng) {
    echo json_encode(['success' => false, 'message' => '日付と場所は必須です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Location
$locationType = $input['location']['type'] ?? 'custom';
$locationName = trim($input['location']['name'] ?? '');
$radiusM = max(100, min(5000, (int)($input['location']['radius_m'] ?? 500)));

// Auto-generate title if empty
$title = trim($input['title'] ?? '');
if (!$title) {
    $dateObj = new DateTime($eventDate);
    $dow = ['日', '月', '火', '水', '木', '金', '土'][$dateObj->format('w')];
    $title = $dateObj->format('n/j') . "（{$dow}）" . ($locationName ? " {$locationName}" : '') . ' 観察会';
}

// Times with defaults
$startTime = trim($input['start_time'] ?? '09:00');
$endTime = trim($input['end_time'] ?? '12:00');

// Edit existing?
$eventId = $input['id'] ?? null;
$isEdit = false;
$existing = null;

if ($eventId) {
    $existing = DataStore::findById('events', $eventId);
    if (!$existing) {
        echo json_encode(['success' => false, 'message' => 'イベントが見つかりません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }
    if ($existing['organizer_id'] !== $user['id'] && ($user['role'] ?? '') !== 'Admin') {
        echo json_encode(['success' => false, 'message' => '権限がありません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }
    $isEdit = true;
}

// Target species (optional array of strings)
$targetSpecies = [];
if (!empty($input['target_species']) && is_array($input['target_species'])) {
    foreach ($input['target_species'] as $sp) {
        $sp = trim($sp);
        if ($sp) $targetSpecies[] = $sp;
    }
    $targetSpecies = array_slice($targetSpecies, 0, 20); // max 20
}

// Rain policy (validated)
$rainOptions = ['cancel' => '雨天中止', 'light_ok' => '小雨決行', 'rain_ok' => '雨天決行'];
$rainPolicy = $input['rain_policy'] ?? '';
if (!array_key_exists($rainPolicy, $rainOptions)) $rainPolicy = '';

// Event Code
$eventCode = trim($input['event_code'] ?? '');

// Grant ID
$grantId = trim($input['grant_id'] ?? '');

$event = [
    'id'                  => $eventId ?: uniqid('evt_'),
    'event_code'          => $eventCode,
    'title'               => $title,
    'memo'                => mb_substr(trim($input['memo'] ?? ''), 0, 1000), // Fixed limit to 1000
    'event_date'          => $eventDate,
    'start_time'          => $startTime,
    'end_time'            => $endTime,
    'location'            => [
        'type'      => $locationType,
        'site_id'   => ($locationType === 'site') ? trim($input['location']['site_id'] ?? '') : null,
        'lat'       => $lat,
        'lng'       => $lng,
        'radius_m'  => $radiusM,
        'name'      => $locationName,
    ],
    'meeting_point'       => mb_substr(trim($input['meeting_point'] ?? ''), 0, 200),
    'meeting_lat'         => !empty($input['meeting_lat']) ? (float)$input['meeting_lat'] : null,
    'meeting_lng'         => !empty($input['meeting_lng']) ? (float)$input['meeting_lng'] : null,
    'parking_info'        => mb_substr(trim($input['parking_info'] ?? ''), 0, 200),
    'rain_policy'         => $rainPolicy,
    'precautions'         => mb_substr(trim($input['precautions'] ?? ''), 0, 1000), // Fixed limit to 1000
    'target_species'      => $targetSpecies,
    'grant_id'            => $grantId,
    'organizer_id'        => $user['id'],
    'organizer_name'      => $user['name'],
    'linked_observations' => $isEdit ? ($existing['linked_observations'] ?? []) : [],
    'status'              => 'open',
    'created_at'          => $isEdit ? ($existing['created_at'] ?? date('c')) : date('c'),
    'updated_at'          => date('c'),
];

// Edit history — record what changed
if ($isEdit) {
    if (!isset($existing['edit_history'])) $existing['edit_history'] = [];
    $editHistory = $existing['edit_history'];

    $changedFields = [];
    $trackFields = ['title', 'event_date', 'start_time', 'end_time', 'memo', 'meeting_point', 'parking_info', 'rain_policy', 'precautions', 'event_code', 'grant_id'];
    foreach ($trackFields as $f) {
        $oldVal = trim($existing[$f] ?? '');
        $newVal = trim($event[$f] ?? '');
        if ($oldVal !== $newVal) $changedFields[] = $f;
    }
    // Check location change
    $oldLat = (float)($existing['location']['lat'] ?? 0);
    $oldLng = (float)($existing['location']['lng'] ?? 0);
    if (abs($oldLat - $lat) > 0.0001 || abs($oldLng - $lng) > 0.0001) {
        $changedFields[] = 'location';
    }
    if (!empty($changedFields)) {
        $editHistory[] = [
            'at'      => date('c'),
            'by'      => $user['name'],
            'by_id'   => $user['id'],
            'fields'  => $changedFields,
        ];
        // Keep last 20 entries
        $editHistory = array_slice($editHistory, -20);
    }
    $event['edit_history'] = $editHistory;
} else {
    $event['edit_history'] = [];
}

try {
    $savedEvent = EventManager::save($event);
    if ($savedEvent) {
        echo json_encode([
            'success' => true,
            'event'   => $savedEvent,
            'action'  => $isEdit ? 'updated' : 'created',
        ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    } else {
        echo json_encode(['success' => false, 'message' => '保存に失敗しました'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
}
