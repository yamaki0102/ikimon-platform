<?php
require_once __DIR__ . '/../upload_package/config/config.php';
require_once __DIR__ . '/../upload_package/libs/BadgeManager.php';

// Mock session
session_start();
$_SESSION['user'] = ['id' => 'test_user_badge'];
// Clear previous badges
$badgeFile = BadgeManager::USER_BADGES_DIR . '/test_user_badge.json';
if (file_exists($badgeFile)) unlink($badgeFile);

echo "Test 1: Check initial state (No badges)\n";
$badges = BadgeManager::getUserBadges('test_user_badge');
echo "Count: " . count($badges) . "\n";
if (count($badges) === 0) echo "PASS\n";
else echo "FAIL\n";

echo "\nTest 2: Award 'First Discovery' (1 post)\n";
$new = BadgeManager::checkAndAward('test_user_badge', 'post_count', ['post_count' => 1]);
echo "New Badges: " . count($new) . "\n";
if (count($new) === 1 && $new[0]['id'] === 'first_discovery') echo "PASS\n";
else echo "FAIL\n";

echo "\nTest 3: Check Persisted\n";
$badges = BadgeManager::getUserBadges('test_user_badge');
echo "Count: " . count($badges) . "\n";
if (count($badges) === 1) echo "PASS\n";
else echo "FAIL\n";

echo "\nTest 4: No duplicate award (1 post again)\n";
$new = BadgeManager::checkAndAward('test_user_badge', 'post_count', ['post_count' => 1]);
echo "New Badges: " . count($new) . "\n";
if (count($new) === 0) echo "PASS\n";
else echo "FAIL\n";

echo "\nTest 5: Award 'Observer Lvl.1' (3 posts)\n";
$new = BadgeManager::checkAndAward('test_user_badge', 'post_count', ['post_count' => 3]);
echo "New Badges: " . count($new) . "\n";
if (count($new) === 1 && $new[0]['id'] === 'observer_lvl1') echo "PASS\n";
else echo "FAIL\n";

echo "\nTest 6: Session Flash Check\n";
if (isset($_SESSION['new_badges']) && count($_SESSION['new_badges']) > 0) {
    echo "PASS: Session has " . count($_SESSION['new_badges']) . " new badges.\n";
    // Simulate consumption
    unset($_SESSION['new_badges']);
} else {
    echo "FAIL: Session flash missing.\n";
}

echo "\nTest Complete.\n";
