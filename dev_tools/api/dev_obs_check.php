<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';

Auth::init();
$user = DataStore::findById('users', 'user_ya_001');
$_SESSION['user'] = $user; // force login

ob_start();
$_SERVER['REQUEST_URI'] = '/profile.php';
$_SERVER['HTTP_HOST'] = 'localhost';
include __DIR__ . '/../../public_html/profile.php';
$out = ob_get_clean();

if (strpos($out, 'col-span-full py-20 text-center text-muted font-bold') !== false) {
    echo "TEXT_FOUND: まだ観察がありません。\n";
} else {
    echo "TEXT_NOT_FOUND: The user has observations rendered.\n";
}
