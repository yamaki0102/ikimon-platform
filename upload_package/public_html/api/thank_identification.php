<?php
/**
 * 同定ありがとう API
 *
 * 観察の投稿者が、同定してくれた人にワンタップでお礼を送る。
 * 1同定につき1回きり。同定者に通知が届く。
 *
 * POST { observation_id, identification_id }
 */
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/Notification.php';

Auth::init();
header('Content-Type: application/json; charset=utf-8');

if (!Auth::isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'Login required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$obsId = $input['observation_id'] ?? '';
$identId = $input['identification_id'] ?? '';
$user = Auth::user();

if (!$obsId || !$identId) {
    echo json_encode(['success' => false, 'message' => 'Missing parameters'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// 観察データ取得
$obs = DataStore::findById('observations', $obsId);
if (!$obs) {
    echo json_encode(['success' => false, 'message' => 'Observation not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// 投稿者本人のみがありがとうを送れる
if ($obs['user_id'] !== $user['id']) {
    echo json_encode(['success' => false, 'message' => 'Only the observer can send thanks'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// 該当する同定を探す
$identifications = $obs['identifications'] ?? [];
$found = false;
$identifierUserId = null;
$identifierName = null;

foreach ($identifications as &$ident) {
    if (($ident['id'] ?? '') === $identId) {
        // 既にお礼済みか？
        if (!empty($ident['thanked'])) {
            echo json_encode(['success' => false, 'message' => 'Already thanked'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
            exit;
        }
        // 自分自身の同定にはお礼を送れない
        if (($ident['user_id'] ?? '') === $user['id']) {
            echo json_encode(['success' => false, 'message' => 'Cannot thank yourself'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
            exit;
        }

        $ident['thanked'] = true;
        $ident['thanked_by'] = $user['id'];
        $ident['thanked_at'] = date('c');
        $identifierUserId = $ident['user_id'] ?? '';
        $identifierName = $ident['user_name'] ?? 'Unknown';
        $found = true;
        break;
    }
}
unset($ident);

if (!$found) {
    echo json_encode(['success' => false, 'message' => 'Identification not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// 観察データを更新
$obs['identifications'] = $identifications;
$partition = date('Y-m', strtotime($obs['created_at'] ?? 'now'));
DataStore::update('observations', $obsId, $obs, $partition);

// 通知を送信
if ($identifierUserId && $identifierUserId !== $user['id']) {
    Notification::send(
        $identifierUserId,
        Notification::TYPE_THANKS,
        '同定へのお礼 🙏',
        $user['name'] . ' さんがあなたの同定にありがとうと言っています。',
        'observation_detail.php?id=' . $obsId
    );
}

echo json_encode(['success' => true, 'action' => 'thanked'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
