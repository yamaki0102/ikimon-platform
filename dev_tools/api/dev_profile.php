<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/UserStore.php';
require_once __DIR__ . '/../../libs/Gamification.php';

Auth::init();
$user = UserStore::findById('user_ya_001');
Auth::login($user);

// Execute profile.php capturing output
ob_start();
include __DIR__ . '/../profile.php';
$output = ob_get_clean();

echo "Profile.php executed without crashing.\n";
echo "Output length: " . strlen($output) . "\n";
echo "Title: " . preg_match('/<title>(.*?)<\/title>/is', $output, $matches) ? $matches[1] : 'No title' . "\n";
