<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/UserStore.php';
require_once __DIR__ . '/../../libs/CSRF.php';

Auth::init();
CSRF::validateRequest();
header('Content-Type: application/json; charset=utf-8');

$user = Auth::user();
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized'], JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';
$email = strtolower(trim($input['email'] ?? ''));

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'error' => '有効なメールアドレスを入力してください'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE);
    exit;
}

$storedUser = UserStore::findById($user['id']);
if (!$storedUser) {
    echo json_encode(['success' => false, 'error' => 'ユーザーが見つかりません'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE);
    exit;
}

$primaryEmail = strtolower($storedUser['email'] ?? '');
$emails = $storedUser['emails'] ?? [];

if ($action === 'add') {
    if ($email === $primaryEmail || in_array($email, $emails, true)) {
        echo json_encode(['success' => false, 'error' => 'このメールアドレスは既に登録されています'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE);
        exit;
    }

    $existing = UserStore::findByEmail($email) ?? UserStore::findBySecondaryEmail($email);
    if ($existing && $existing['id'] !== $user['id']) {
        echo json_encode(['success' => false, 'error' => 'このメールアドレスは別のアカウントで使用されています'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE);
        exit;
    }

    $emails[] = $email;
    $updated = UserStore::update($user['id'], ['emails' => $emails]);
    $sessionUser = $updated;
    unset($sessionUser['password_hash']);
    Auth::login($sessionUser);

    echo json_encode(['success' => true, 'emails' => $emails], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE);

} elseif ($action === 'remove') {
    $idx = array_search($email, $emails, true);
    if ($idx === false) {
        echo json_encode(['success' => false, 'error' => 'このメールアドレスは登録されていません'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE);
        exit;
    }

    array_splice($emails, $idx, 1);
    $updated = UserStore::update($user['id'], ['emails' => $emails]);
    $sessionUser = $updated;
    unset($sessionUser['password_hash']);
    Auth::login($sessionUser);

    echo json_encode(['success' => true, 'emails' => $emails], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE);

} else {
    echo json_encode(['success' => false, 'error' => '不正なアクション'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE);
}
