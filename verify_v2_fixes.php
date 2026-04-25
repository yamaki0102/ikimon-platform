<?php
require_once __DIR__ . '/upload_package/config/config.php';
require_once __DIR__ . '/upload_package/libs/DataStore.php';
require_once __DIR__ . '/upload_package/libs/Indexer.php';

echo "=== V2 Fixes Verification ===\n";

// 0. Pre-check Legacy
$legacy = DataStore::get('observations');
echo "[Pre-Check] Legacy observations.json count: " . count($legacy) . "\n";

// 1. Verify fetchAll (should return count > 0 from partitions)
echo "\n[Test 1] DataStore::fetchAll('observations')\n";
$all = DataStore::fetchAll('observations');
echo "Count: " . count($all) . "\n";
if (count($all) === 0) {
    echo "FAIL: No data found via fetchAll. Partitions not being read?\n";
    exit;
}

// 2. Verify findById (should find a valid ID)
$testId = $all[0]['id'];
echo "\n[Test 2] DataStore::findById('observations', '$testId')\n";
$item = DataStore::findById('observations', $testId);
if ($item && $item['id'] === $testId) {
    echo "SUCCESS: Found item via Indexer.\n";
} else {
    echo "FAIL: Item not found via Indexer.\n";
}

// 3. Verify upsert (should update item in Partition, NOT legacy)
echo "\n[Test 3] DataStore::upsert (Partitioned Update)\n";
$item['verification_test_flag'] = 'updated_' . time();
DataStore::upsert('observations', $item);

// Verify by reading directly from partition file (bypass fetchAll cache if any)
// We need to know WHICH file it's in.
$index = Indexer::getFromIndex('observations_index', $testId);
$partitionFile = $index[0]; 
echo "Target Partition: $partitionFile\n";

$pData = DataStore::get($partitionFile);
$foundInPartition = false;
foreach ($pData as $pItem) {
    if ($pItem['id'] === $testId) {
        if (($pItem['verification_test_flag'] ?? '') === $item['verification_test_flag']) {
            echo "SUCCESS: Item updated in partition file.\n";
            $foundInPartition = true;
        } else {
            echo "FAIL: Item found but not updated. Value: " . ($pItem['verification_test_flag'] ?? 'NULL') . "\n";
        }
        break;
    }
}
if (!$foundInPartition) echo "FAIL: Item not found in partition file after upsert.\n";

// Check Legacy file (should NOT be there)
$legacy = DataStore::get('observations');
if (!empty($legacy)) {
    echo "WARNING: Legacy observations.json is not empty. Count: " . count($legacy) . "\n";
    // Check if our test item is there
    foreach ($legacy as $lItem) {
        if ($lItem['id'] === $testId) {
            echo "FAIL: Upsert wrote to legacy file instead of partition!\n";
            break;
        }
    }
} else {
    echo "SUCCESS: Legacy file remains empty.\n";
}

// Revert change
unset($item['verification_test_flag']);
DataStore::upsert('observations', $item);
echo "\nTest cleanup complete.\n";
