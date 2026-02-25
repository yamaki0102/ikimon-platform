<?php
require_once __DIR__ . '/../upload_package/config/config.php';
require_once __DIR__ . '/../upload_package/libs/DataStore.php';
require_once __DIR__ . '/../upload_package/libs/MyFieldManager.php';
require_once __DIR__ . '/../upload_package/libs/Auth.php';

// Mock Auth::isPremium to true for testing
class AuthMock
{
    public static function isPremium()
    {
        return true;
    }
}
// We can't redefine Auth, so we rely on Auth::isPremium being checkable or bypassable.
// In a real test environment, we'd use mockery or dependency injection.
// For this quick check, we'll temporaily assume the environment allows it or modify the test to set up state.
// Since Auth.php uses session, let's just try to call create. If it fails due to premium check, we know it's enforced.

// However, to test functional logic, we need it to succeed.
// Let's manually inject a session if needed, or rely on the fact that CLI doesn't have session so Auth::check() returns false.
// But Auth::isPremium() might check user rank.

// Let's create a "Test User" session if possible, or just modify the test to reflect reality.
// Actually, MyFieldManager::create checks Auth::isPremium().
// Let's see Auth.php... 
// Based on previous views, Auth is simple. 
// We will try to simulate a logged in user by setting $_SESSION.
session_start();
$_SESSION['user'] = ['id' => 'user_test_99', 'rank' => 'platinum', 'plan' => 'pro'];

echo "Debug: Checking loaded files...\n";
$files = get_included_files();
foreach ($files as $f) {
    if (strpos($f, 'BiodiversityScorer') !== false) echo "Loaded: $f\n";
}

if (class_exists('BiodiversityScorer')) {
    echo "Debug: Class BiodiversityScorer exists.\n";
} else {
    echo "Debug: Class BiodiversityScorer does NOT exist.\n";
    // Try manual include to see if it errors
    $path = __DIR__ . '/../upload_package/libs/BiodiversityScorer.php';
    if (file_exists($path)) {
        echo "Debug: File exists at $path. Including...\n";
        require_once $path;
        if (class_exists('BiodiversityScorer')) echo "Debug: Now it exists.\n";
    } else {
        echo "Debug: File NOT found at $path\n";
    }
}


// Test 1: Create My Field
echo "Test 1: Creating My Field 'Test Garden'...\n";
try {
    $field = MyFieldManager::create('user_test_99', 'Test Garden', 35.6895, 139.6917, 500, 'urban');
    echo "Created Field ID: " . $field['id'] . "\n";

    $retrieved = MyFieldManager::get($field['id']);
    if ($retrieved && $retrieved['name'] === 'Test Garden') {
        echo "PASS: Field created and retrieved.\n";
    } else {
        echo "FAIL: Field retrieval failed.\n";
        print_r($retrieved);
    }
} catch (Throwable $e) {
    echo "FAIL: Exception thrown: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}

// Test 4: Calculate Stats
echo "\nTest 4: Calculate Stats...\n";
try {
    if (isset($field)) {
        $stats = MyFieldManager::calculateStats($field);
        echo "PASS: Stats calculated. Score: " . $stats['total_score'] . "\n";
    }
} catch (Throwable $e) {
    echo "FAIL: Stats Calculation Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}

// Test 2: List by User
echo "\nTest 2: Listing fields for user...\n";
$list = MyFieldManager::listByUser('user_test_99');
if (count($list) > 0) {
    echo "PASS: List returned " . count($list) . " fields.\n";
} else {
    echo "FAIL: List is empty.\n";
}

// Test 3: Contains Logic
echo "\nTest 3: Containment Logic...\n";
// Point inside (same coords)
if (MyFieldManager::contains($field, 35.6895, 139.6917)) {
    echo "PASS: Center point is contained.\n";
} else {
    echo "FAIL: Center point not contained.\n";
}
// Point far away
if (!MyFieldManager::contains($field, 36.6895, 140.6917)) {
    echo "PASS: Far point is not contained.\n";
} else {
    echo "FAIL: Far point incorrectly contained.\n";
}

echo "\nAll MyField Tests Completed.\n";
