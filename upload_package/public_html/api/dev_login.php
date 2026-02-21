<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/UserStore.php';
Auth::init();
$user = UserStore::findById('user_ya_001');
if ($user) {
    Auth::login($user);
    echo 'Logged in as ' . $user['name'];
} else {
    echo 'user not found';
}
