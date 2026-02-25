<?php
// Test Script for Gamification Refactor (Phase 15)
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../upload_package/config/config.php';
require_once __DIR__ . '/../upload_package/libs/DataStore.php';
require_once __DIR__ . '/../upload_package/libs/Gamification.php';
require_once __DIR__ . '/../upload_package/libs/MyFieldManager.php';
require_once __DIR__ . '/../upload_package/libs/BadgeManager.php';

// Test Setup
$userId = 'test_user_gamification_' . time();
$userFn = DATA_DIR . '/users/' . $userId . '.json';

// Create User
$userData = [
    'id' => $userId,
    'name' => 'Gamification Tester',
    'email' => 'test@example.com',
    'role' => 'Admin', // Admin is Premium
    'badges' => []
];
DataStore::save('users/' . $userId, $userData);

echo "Created Test User: $userId\n";

// Mock Session for Auth::isPremium() logic
$_SESSION['user'] = $userData;

// 1. Test My Field Creation Badge
echo "\n--- Test 1: My Field Creation ---\n";
echo "DATA_DIR (Global): " . DATA_DIR . "\n";
echo "MyFieldManager::DATA_DIR: " . MyFieldManager::DATA_DIR . "\n";

try {
    $field = MyFieldManager::create($userId, 'Test Field', 35.6895, 139.6917, 500, 'urban');
    echo "Field Created: " . $field['id'] . "\n";
} catch (Exception $e) {
    echo "ERROR: MyFieldManager::create failed: " . $e->getMessage() . "\n";
    exit(1);
}

$fields = MyFieldManager::listByUser($userId);
echo "MyFields count: " . count($fields) . "\n";
print_r($fields);

// Sync Stats
$user = Gamification::syncUserStats($userId);

// Verify
echo "[TEST DEBUG] Verifying field_creator for user $userId...\n";
$badges = BadgeManager::getUserBadges($userId);
echo "[TEST DEBUG] Badges found: " . count($badges) . "\n";
print_r(array_column($badges, 'id'));

$ids = array_column($badges, 'id');
if (!in_array('field_creator', $ids)) {
    echo "FAILURE: 'field_creator' badge NOT awarded.\n";
    print_r($ids);
} else {
    echo "SUCCESS: 'field_creator' awarded.\n";
}

// 2. Test My Field Observation Count (Field Guardian - 10 obs)
echo "\n--- Test 2: Field Guardian (10 Obs) ---\n";
// Create 10 observations inside the field
for ($i = 0; $i < 10; $i++) {
    $obsId = 'obs_test_' . time() . '_' . $i;
    $obs = [
        'id' => $obsId,
        'user_id' => $userId,
        'latitude' => 35.6895, // Center of field
        'longitude' => 139.6917,
        'status' => 'certified',
        'data_quality' => 'A', // Ensure high score
        'taxon' => ['lineage' => ['order' => 'Lepidoptera']], // Insect
        'created_at' => date('Y-m-d H:i:s')
    ];
    // Use append to match DataStore expectation for fetchAll
    DataStore::append('observations', $obs);
}

// Sync Stats
$user = Gamification::syncUserStats($userId);
// $badges contains newly awarded badges in this call.
// To be safe, check USER BADGES from file.
$badges = BadgeManager::getUserBadges($userId);
$ids = array_column($badges, 'id');

if (in_array('field_guardian', $ids)) {
    echo "SUCCESS: 'field_guardian' badge awarded.\n";
} else {
    echo "FAILURE: 'field_guardian' badge NOT awarded.\n";
    print_r($ids);
}

// 3. Test Field Researcher (Shannon > 2.0)
echo "\n--- Test 3: Field Researcher (Shannon > 2.0) ---\n";
// Need diverse species.
// We already added 10 identical observations (same species? check scorer).
// Scorer uses 'name' or taxon ID to distinguish species.
// My mock obs didn't have name. Let's add diverse obs.

$speciesList = ['Sp A', 'Sp B', 'Sp C', 'Sp D', 'Sp E', 'Sp F', 'Sp G', 'Sp H', 'Sp I', 'Sp J'];
foreach ($speciesList as $k => $sp) {
    // Create Observation
    $obsData = [
        'id' => uniqid(),
        'user_id' => $userId,
        'latitude' => 35.6895 + (rand(-10, 10) / 10000), // Within ~100m
        'longitude' => 139.6917 + (rand(-10, 10) / 10000),
        'observed_at' => date('Y-m-d H:i:s'),
        'status' => 'Research Grade', // Ensure high score
        'data_quality' => 'A',
        'taxon_name_ja' => $sp, // For Scorer
        'taxon' => [
            'name' => $sp,
            'group' => 'Insecta' // Add group for coverage score
        ],
        'identifications' => [
            [
                'user_id' => 'validator_' . rand(100, 999),
                'taxon_name' => $sp
            ],
            [
                'user_id' => $userId,
                'taxon_name' => $sp
            ]
        ]
    ];
    DataStore::append('observations', $obsData);
}

// Sync Stats
$user = Gamification::syncUserStats($userId);
$badges = BadgeManager::getUserBadges($userId);
$ids = array_column($badges, 'id');

// Check actual Shannon Index
$fields = MyFieldManager::listByUser($userId);
$stats = MyFieldManager::calculateStats($fields[0]);
echo "Current Shannon Index: " . $stats['shannon_index'] . "\n";

if (in_array('field_researcher', $ids)) {
    echo "SUCCESS: 'field_researcher' badge awarded.\n";
} else {
    echo "FAILURE: 'field_researcher' badge NOT awarded.\n";
    print_r($ids);
}


// Cleanup (Optional, usage dependent)
// ...
