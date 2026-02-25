<?php
require_once __DIR__ . '/../upload_package/config/config.php';
require_once __DIR__ . '/../upload_package/libs/DataStore.php';
require_once __DIR__ . '/../upload_package/libs/CorporateManager.php';

// Test 1: Register Corporation
echo "Test 1: Registering 'Ikimon Lab'...\n";
$id1 = CorporateManager::register('Ikimon Lab', 'pro');
echo "Registered ID: $id1\n";

$corp = CorporateManager::get($id1);
if ($corp && $corp['name'] === 'Ikimon Lab') {
    echo "PASS: Corporation retrieved successfully.\n";
} else {
    echo "FAIL: Could not retrieve corporation.\n";
    print_r($corp);
    exit(1);
}

// Test 2: Add Member
echo "\nTest 2: Adding member 'user_test_01'...\n";
CorporateManager::addMember($id1, 'user_test_01', 'admin');
$corp = CorporateManager::get($id1);
if (isset($corp['members']['user_test_01']) && $corp['members']['user_test_01']['role'] === 'admin') {
    echo "PASS: Member added successfully.\n";
} else {
    echo "FAIL: Member not added.\n";
    print_r($corp);
    exit(1);
}

// Test 3: Data Persistence (Simulate new request)
echo "\nTest 3: Persistence Check (Reloading list)...\n";
$list = CorporateManager::list();
$found = false;
foreach ($list as $c) {
    if ($c['id'] === $id1) $found = true;
}
if ($found) {
    echo "PASS: Data persisted correctly.\n";
} else {
    echo "FAIL: Data not found in list.\n";
}

echo "\nAll Tests Passed!\n";
