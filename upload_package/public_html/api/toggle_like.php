<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/Notification.php';

Auth::init();
header('Content-Type: application/json; charset=utf-8');
$JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_HEX_TAG;

if (!Auth::isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'Login required'], $JSON_FLAGS);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$obsId = $input['id'] ?? '';
$type = $input['type'] ?? 'footprint';
$user = Auth::user();

$validTypes = ['footprint', 'like', 'suteki', 'manabi'];
if (!$obsId || !in_array($type, $validTypes, true)) {
    echo json_encode(['success' => false, 'message' => 'Invalid parameters'], $JSON_FLAGS);
    exit;
}

$reactDir = DATA_DIR . '/reactions/' . $obsId;
if (!is_dir($reactDir)) {
    mkdir($reactDir, 0777, true);
}

$reactFile = $reactDir . '/' . $type . '.json';
$users = file_exists($reactFile) ? (json_decode(file_get_contents($reactFile), true) ?: []) : [];
$userId = $user['id'];

$action = 'reacted';
if (in_array($userId, $users)) {
    $users = array_values(array_diff($users, [$userId]));
    $action = 'unreacted';
} else {
    $users[] = $userId;

    $obs = DataStore::findById('observations', $obsId);
    if ($obs && isset($obs['user_id']) && $obs['user_id'] !== $userId) {
        $labels = [
            'footprint' => ['足あとが残された 👣', ' さんがあなたの記録に足あとを残しました。'],
            'like'      => ['いいね！ ❤️', ' さんがあなたの記録にいいねしました。'],
            'suteki'    => ['すてき！ ✨', ' さんがあなたの記録を「すてき」と言っています。'],
            'manabi'    => ['学び！ 🔬', ' さんがあなたの記録で学びを得ました。'],
        ];
        $label = $labels[$type];
        Notification::send(
            $obs['user_id'],
            Notification::TYPE_LIKE,
            $label[0],
            $user['name'] . $label[1],
            'observation_detail.php?id=' . $obsId
        );
    }
}

file_put_contents($reactFile, json_encode($users, $JSON_FLAGS), LOCK_EX);

$allReactions = [];
foreach ($validTypes as $t) {
    $f = $reactDir . '/' . $t . '.json';
    $list = file_exists($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
    $allReactions[$t] = [
        'count' => count($list),
        'reacted' => in_array($userId, $list),
    ];
}

// Legacy: likes/ 互換 — 全リアクション合算を likes カウントにも反映
$totalReactions = array_sum(array_column($allReactions, 'count'));
$countFile = DATA_DIR . '/counts/observations/' . $obsId . '.json';
if (!is_dir(dirname($countFile))) {
    mkdir(dirname($countFile), 0777, true);
}
$counts = file_exists($countFile) ? (json_decode(file_get_contents($countFile), true) ?: []) : [];
$counts['likes'] = $totalReactions;
file_put_contents($countFile, json_encode($counts, $JSON_FLAGS), LOCK_EX);

echo json_encode([
    'success' => true,
    'action' => $action,
    'type' => $type,
    'reactions' => $allReactions,
    'total' => $totalReactions,
], $JSON_FLAGS);
