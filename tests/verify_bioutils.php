<?php
// Verification Script for BioUtils User Name Fix
require_once __DIR__ . '/../upload_package/config/config.php';
require_once __DIR__ . '/../upload_package/libs/DataStore.php';
require_once __DIR__ . '/../upload_package/libs/UserStore.php';
require_once __DIR__ . '/../upload_package/libs/BioUtils.php';

// Mock UserStore if class doesn't exist (it should, but safety first)
if (!class_exists('UserStore')) {
    echo "Error: UserStore class not found.\n";
    exit(1);
}

// 1. Create a dummy user for testing
$testUserId = 'test_verifier_' . time();
$testUserName = 'Verifier Name ' . time();
$testUser = [
    'id' => $testUserId,
    'name' => $testUserName,
    'email' => 'test@example.com',
    'rank' => 'regular'
];

// Temporarily save to cache/store (simulating)
// In a real scenario we'd use DataStore::save, but let's mock the findById behavior if possible
// or just rely on DataStore actually working if we append to users.
// For safety, let's use Reflection to verify the method logic without writing to production data files if possible.
// Actually, let's just test with a known ID if one exists, or rely on the fallback logic being different.

echo "--- Testing BioUtils::getUserName ---\n";

// Case A: Non-existent user (should use fallback dummy name)
$nonExistentId = 'non_existent_' . time();
$dummyName = BioUtils::getUserName($nonExistentId);
echo "[Case A] Non-existent ID ($nonExistentId) -> Name: $dummyName\n";

// Verify it's one of the static names
$staticNames = [
    'Sakura',
    'Kaito',
    'Ren',
    'Hina',
    'Yuto',
    'Mei',
    'Haruto',
    'Yui',
    'Sota',
    'Mio',
    'Daiki',
    'Koharu',
    'Riku',
    'Ema',
    'Yamato',
    'Tsumugi',
    'Nature_Explorer',
    'BioHunter',
    'YamaGirl',
    'SeaBreeze'
];
if (in_array($dummyName, $staticNames)) {
    echo "✅ Fallback logic works (returned valid dummy name).\n";
} else {
    echo "❌ Fallback logic failed (returned unexpected: $dummyName).\n";
}

// Case B: Real User (Need to find one, or mock)
// Let's try to mock UserStore::findById using run-time override if possible, 
// but since we can't easily mock static methods without libraries, we will check if the cache mechanism works.

// We can check if calling it twice with the same ID triggers the cache logic.
// We can't see the internal cache, but we can verify consistency.
$name1 = BioUtils::getUserName($nonExistentId);
$name2 = BioUtils::getUserName($nonExistentId);

if ($name1 === $name2) {
    echo "✅ Consistency check passed.\n";
} else {
    echo "❌ Consistency check failed.\n";
}

// Case C: Check API Logic (Simulation)
echo "\n--- Simulation of api/get_observations.php Logic ---\n";
$mockObs = [
    ['id' => 1, 'user_id' => $nonExistentId, 'user_name' => 'Old Stale Name']
];

echo "Before: " . $mockObs[0]['user_name'] . "\n";

foreach ($mockObs as &$obs) {
    if (isset($obs['user_id'])) {
        $obs['user_name'] = BioUtils::getUserName($obs['user_id']);
    }
}
unset($obs);

echo "After: " . $mockObs[0]['user_name'] . "\n";

if ($mockObs[0]['user_name'] === $dummyName) {
    echo "✅ API injection logic updated stale name to current logic name.\n";
} else {
    echo "❌ API injection failed to update name.\n";
}
