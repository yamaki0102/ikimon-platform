<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/UserStore.php';
require_once __DIR__ . '/../../libs/CSRF.php';

Auth::init();
CSRF::validateRequest();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid method'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$user = Auth::user();
if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

// 1. Update Basic Info
$updateData = [];
if (isset($input['name'])) {
    $name = trim($input['name']);
    if (mb_strlen($name) < 1 || mb_strlen($name) > 50) {
        echo json_encode(['success' => false, 'message' => '名前は1〜50文字で入力してください。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }
    $updateData['name'] = $name;
}

if (isset($input['bio'])) {
    $bio = trim($input['bio']);
    if (mb_strlen($bio) > 500) {
        echo json_encode(['success' => false, 'message' => '自己紹介は500文字以内で入力してください。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }
    $updateData['bio'] = $bio;
}

// 2. Change Password
if (!empty($input['new_password'])) {
    $current = $input['current_password'] ?? '';
    $new = $input['new_password'];
    $confirm = $input['confirm_password'] ?? '';

    // Verify current (UserStoreから再取得してハッシュを確認)
    $storedUser = UserStore::findById($user['id']);
    if (!$storedUser || !password_verify($current, $storedUser['password_hash'])) {
        echo json_encode(['success' => false, 'message' => '現在のパスワードが間違っています。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }

    if (strlen($new) < 8) {
        echo json_encode(['success' => false, 'message' => '新しいパスワードは8文字以上にしてください。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }

    if ($new !== $confirm) {
        echo json_encode(['success' => false, 'message' => '新しいパスワードが一致しません。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }

    $updateData['password_hash'] = password_hash($new, PASSWORD_DEFAULT);
}

if (empty($updateData)) {
    echo json_encode(['success' => true, 'message' => '変更はありません。', 'user' => $user], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Update DB
$newItem = UserStore::update($user['id'], $updateData);

// Update Session
$sessionUser = $newItem;
unset($sessionUser['password_hash']);
Auth::login($sessionUser); // Re-login updates session data

// Sync denormalized observer data in observations
if (isset($updateData['name'])) {
    syncObserverData($user['id'], ['user_name' => $updateData['name']]);
}

echo json_encode(['success' => true, 'message' => 'プロフィールを更新しました。', 'user' => $sessionUser], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);

/**
 * Update denormalized user data in all observation JSON files
 */
function syncObserverData(string $userId, array $updates): void
{
    $obsDir = DATA_DIR . '/observations';
    if (!is_dir($obsDir)) return;

    foreach (glob($obsDir . '/*.json') as $file) {
        $data = json_decode(file_get_contents($file), true);
        if (!is_array($data)) continue;

        $changed = false;
        foreach ($data as &$obs) {
            if (($obs['user_id'] ?? '') === $userId) {
                foreach ($updates as $key => $value) {
                    if (($obs[$key] ?? '') !== $value) {
                        $obs[$key] = $value;
                        $changed = true;
                    }
                }
            }
        }
        unset($obs);

        if ($changed) {
            file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        }
    }
}
