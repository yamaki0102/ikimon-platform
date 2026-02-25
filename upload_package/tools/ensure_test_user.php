<?php

/**
 * Ensure Test User Exists
 * Usage: php tools/ensure_test_user.php
 * 
 * Creates or updates 'health_check_user@ikimon.life' with a known password.
 * Used by page_health_check.php for authenticated testing.
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/UserStore.php';

$email = 'health_check_user@ikimon.life';
$password = 'HealthCheckPass2026!';
$name = 'Health Check Bot';

$user = UserStore::findByEmail($email);

if ($user) {
    // Update existing user to ensure password logic matches
    // Note: UserStore doesn't expose strict password update easily without knowing ID
    // So we'll manually update via DataStore logic to ensure password hash is correct
    $users = DataStore::get('users');
    foreach ($users as &$u) {
        if (($u['id'] ?? '') === $user['id']) {
            $u['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
            $u['banned'] = false; // Unban if banned
            $u['role'] = 'Observer'; // Reset role
        }
    }
    DataStore::save('users', $users);
    echo "✅ Test user updated: {$email}\n";
} else {
    // Create new
    UserStore::create($name, $email, $password);
    echo "✅ Test user created: {$email}\n";
}
