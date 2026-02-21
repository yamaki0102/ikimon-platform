<?php
require_once __DIR__ . '/../../../libs/Auth.php';
require_once __DIR__ . '/../../../libs/UserStore.php';

Auth::init();
Auth::requireRole('Admin');
header('Content-Type: application/json; charset=utf-8');

$users = UserStore::getAll(false);
$clean = array_map(function($u) {
    return [
        'id' => $u['id'] ?? null,
        'name' => $u['name'] ?? '',
        'email' => $u['email'] ?? '',
        'role' => $u['role'] ?? Auth::getRole($u),
        'rank' => $u['rank'] ?? Auth::getRankLabel($u),
        'avatar' => $u['avatar'] ?? '',
        'created_at' => $u['created_at'] ?? null,
        'last_login_at' => $u['last_login_at'] ?? null,
        'banned' => !empty($u['banned'])
    ];
}, $users);

echo json_encode(['success' => true, 'data' => $clean], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
