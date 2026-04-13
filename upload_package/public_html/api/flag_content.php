<?php

/**
 * flag_content.php — コンテンツ通報 API
 *
 * POST body (JSON):
 *   - content_id (str): required
 *   - content_type (str): observation|identification|comment
 *   - reason (str): spam|abuse|misidentification|privacy|other
 *   - details (str): optional
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/Moderation.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$user = Auth::user();
$input = json_decode(file_get_contents('php://input'), true);

$contentId = trim($input['content_id'] ?? '');
$contentType = trim($input['content_type'] ?? '');
$reason = trim($input['reason'] ?? 'other');
$details = trim($input['details'] ?? '');

if (!$contentId || !$contentType) {
    echo json_encode(['success' => false, 'message' => 'content_id, content_type は必須です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$validTypes = ['observation', 'identification', 'comment'];
if (!in_array($contentType, $validTypes)) {
    echo json_encode(['success' => false, 'message' => '無効な content_type です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$success = Moderation::flagContent($contentId, $contentType, $user['id'], $reason, $details);

echo json_encode([
    'success' => $success,
    'message' => $success ? '通報を受け付けました。ありがとうございます。' : '通報の送信に失敗しました。',
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
