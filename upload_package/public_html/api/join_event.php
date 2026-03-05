<?php

/**
 * join_event.php — イベント参加登録/取消 API
 *
 * POST body (JSON):
 *   - event_id (str): required
 *   - action (str): 'join' or 'leave'
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/Notification.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$user = Auth::user();
$input = json_decode(file_get_contents('php://input'), true);

$eventId = $input['event_id'] ?? '';
$action = $input['action'] ?? 'join';

if (!$eventId) {
    echo json_encode(['success' => false, 'message' => 'イベントIDが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$event = DataStore::findById('events', $eventId);
if (!$event) {
    echo json_encode(['success' => false, 'message' => 'イベントが見つかりません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$participants = $event['participants'] ?? [];
$userId = $user['id'];
$isParticipant = false;
$participantIndex = -1;

foreach ($participants as $i => $p) {
    if (($p['user_id'] ?? '') === $userId) {
        $isParticipant = true;
        $participantIndex = $i;
        break;
    }
}

if ($action === 'join') {
    if ($isParticipant) {
        echo json_encode(['success' => false, 'message' => '既に参加登録済みです'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }

    // Check capacity
    $maxP = $event['max_participants'] ?? 0;
    if ($maxP > 0 && count($participants) >= $maxP) {
        echo json_encode(['success' => false, 'message' => '定員に達しています'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }

    // Check status
    if (($event['status'] ?? '') !== 'open') {
        echo json_encode(['success' => false, 'message' => 'このイベントは受付を終了しています'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }

    $participants[] = [
        'user_id' => $userId,
        'user_name' => $user['name'],
        'joined_at' => date('c'),
    ];

    // Notify organizer
    if ($event['organizer_id'] !== $userId) {
        Notification::sendAmbient(
            $event['organizer_id'],
            Notification::TYPE_BADGE, // reuse existing type
            '参加者が増えた！',
            $user['name'] . ' さんが「' . ($event['title'] ?? '') . '」に参加登録しました。',
            'site_dashboard.php?id=' . urlencode($event['site_id'] ?? '')
        );
    }
} elseif ($action === 'leave') {
    if (!$isParticipant) {
        echo json_encode(['success' => false, 'message' => '参加登録されていません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }
    array_splice($participants, $participantIndex, 1);
}

$event['participants'] = $participants;
$event['updated_at'] = date('c');

if (DataStore::upsert('events', $event)) {
    echo json_encode([
        'success' => true,
        'action' => $action,
        'participant_count' => count($participants),
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
} else {
    echo json_encode(['success' => false, 'message' => '保存に失敗しました'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
}
