<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/UserStore.php';

Auth::init();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid method']);
    exit;
}

$user = Auth::user();
if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

// 1. Update Basic Info
$updateData = [];
if (isset($input['name'])) {
    $name = trim($input['name']);
    if (mb_strlen($name) < 1 || mb_strlen($name) > 50) {
        echo json_encode(['success' => false, 'message' => '名前は1〜50文字で入力してください。']);
        exit;
    }
    $updateData['name'] = $name;
}

if (isset($input['bio'])) {
    $bio = trim($input['bio']);
    if (mb_strlen($bio) > 500) {
        echo json_encode(['success' => false, 'message' => '自己紹介は500文字以内で入力してください。']);
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
        echo json_encode(['success' => false, 'message' => '現在のパスワードが間違っています。']);
        exit;
    }

    if (strlen($new) < 8) {
        echo json_encode(['success' => false, 'message' => '新しいパスワードは8文字以上にしてください。']);
        exit;
    }

    if ($new !== $confirm) {
        echo json_encode(['success' => false, 'message' => '新しいパスワードが一致しません。']);
        exit;
    }

    $updateData['password_hash'] = password_hash($new, PASSWORD_DEFAULT);
}

if (empty($updateData)) {
    echo json_encode(['success' => true, 'message' => '変更はありません。', 'user' => $user]);
    exit;
}

// Update DB
$newItem = UserStore::update($user['id'], $updateData);

// Update Session
$sessionUser = $newItem;
unset($sessionUser['password_hash']);
Auth::login($sessionUser); // Re-login updates session data

echo json_encode(['success' => true, 'message' => 'プロフィールを更新しました。', 'user' => $sessionUser]);
