<?php
// Dev Admin Login — 本番環境では完全ブロック
// ローカル開発環境のみアクセス可能

// === 多重防御 ===

// 1. 本番ドメインからのアクセスは無条件拒否
$host = $_SERVER['HTTP_HOST'] ?? '';
$productionHosts = ['ikimon.life', 'www.ikimon.life'];
if (in_array($host, $productionHosts)) {
    http_response_code(403);
    echo '403 Forbidden';
    exit;
}

// 2. IP制限（ローカルのみ許可）
$allowedIPs = ['127.0.0.1', '::1'];
$clientIP = $_SERVER['REMOTE_ADDR'] ?? '';
if (!in_array($clientIP, $allowedIPs)) {
    http_response_code(403);
    echo '403 Forbidden';
    exit;
}

// 3. 環境変数チェック（本番ではこの変数を設定しない）
if (getenv('IKIMON_ENV') === 'production') {
    http_response_code(403);
    echo '403 Forbidden';
    exit;
}

require_once __DIR__ . '/../libs/Auth.php';
Auth::init();

// Login as Dr. Ikimon (Admin)
Auth::login([
    'id' => 'admin_001',
    'name' => 'Dr. Ikimon',
    'avatar' => 'assets/images/dr_ikimon.png',
    'rank' => 'Admin'
]);

header('Location: admin/index.php');
exit;
