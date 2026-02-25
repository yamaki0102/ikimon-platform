<?php
// Mock data structure mimicking RedListManager::lookup outputs
$lists_assoc = [
    'category' => 'NT',
    'list_id' => 'national_2020',
    'list' => 'Environmental Ministry'
];

$species_lists = [
    'national' => $lists_assoc,
    // 'shizuoka' => ... 
];

// Simulation of generate_site_report.php logic
$name = "Test Species";
$lists = $species_lists;

echo "--- Testing Fix ---\n";

// OLD LOGIC (Simulated failure)
echo "Old Logic (expect warning):\n";
try {
    $cat = $lists[0]['category'];
    echo "Old Logic: Success ($cat)\n";
} catch (Throwable $e) {
    echo "Old Logic: Failed (" . $e->getMessage() . ")\n";
}

// NEW LOGIC
echo "New Logic:\n";
try {
    if (empty($lists)) {
        echo "Empty lists, continue\n";
    } else {
        $firstList = reset($lists);
        echo "First List Category: " . $firstList['category'] . "\n";
        echo "First List ID: " . ($firstList['list_id'] ?? $firstList['list'] ?? '') . "\n";
    }
} catch (Throwable $e) {
    echo "New Logic: Failed (" . $e->getMessage() . ")\n";
}
