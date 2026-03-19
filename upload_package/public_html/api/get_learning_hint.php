<?php
/**
 * get_learning_hint.php — ホームフィード用の学習ヒントAPI
 *
 * ログインユーザーの最新の考察済み観察から
 * 「次にここを見ると深く分かる」ヒントを返す。
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';

Auth::init();
$user = Auth::user();

if (!$user) {
    echo json_encode(['success' => false, 'message' => 'not_logged_in'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$userId = $user['id'];

// ユーザーの最新の考察済み観察を探す
$obs = DataStore::getLatest('observations', 20, function ($item) use ($userId) {
    if (($item['user_id'] ?? '') !== $userId) return false;
    $photo = $item['photos'][0] ?? '';
    if (empty($photo)) return false;

    // AI考察済みかチェック
    foreach ($item['ai_assessments'] ?? [] as $a) {
        if (($a['kind'] ?? '') === 'machine_assessment' && !empty($a['summary'])) {
            return true;
        }
    }
    return false;
});

if (empty($obs)) {
    echo json_encode(['success' => true, 'hint' => null], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$latest = $obs[0];
$assessment = null;
foreach ($latest['ai_assessments'] ?? [] as $a) {
    if (($a['kind'] ?? '') === 'machine_assessment') {
        $assessment = $a;
    }
}

if (!$assessment) {
    echo json_encode(['success' => true, 'hint' => null], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// next_action を取得（display_ja 優先、next_step フォールバック）
$nextAction = '';
if (!empty($assessment['display_ja']['next_action'])) {
    $nextAction = $assessment['display_ja']['next_action'];
} elseif (!empty($assessment['next_step'])) {
    $nextAction = $assessment['next_step'];
} elseif (!empty($assessment['missing_evidence'])) {
    $missing = array_slice($assessment['missing_evidence'], 0, 3);
    $nextAction = implode(' / ', $missing) . ' が分かる写真があると、もう一段絞りやすくなります。';
}

$observerNote = $assessment['display_ja']['observer_note'] ?? ($assessment['observer_boost'] ?? '');

echo json_encode([
    'success' => true,
    'hint' => [
        'obs_id' => $latest['id'],
        'taxon_name' => $latest['taxon']['name'] ?? '',
        'photo_url' => $latest['photos'][0] ?? '',
        'next_action' => $nextAction,
        'observer_note' => $observerNote,
        'created_at' => $latest['created_at'] ?? '',
    ],
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
