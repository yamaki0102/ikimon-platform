<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/RedListManager.php';

$obs = DataStore::fetchAll('observations');
$aikan = [];
foreach ($obs as $o) {
    $id = $o['id'] ?? '';
    if (str_starts_with($id, 'obs_aikan')) {
        $aikan[] = $o;
    }
}

echo "=== obs_aikan* entries: " . count($aikan) . " ===\n";

// Collect species names
$speciesNames = [];
foreach ($aikan as $o) {
    $name = $o['taxon']['name'] ?? '?';
    $speciesNames[] = $name;
    echo "{$o['id']} | $name\n";
}

// Check red list
echo "\n=== Red List Check ===\n";
$rlm = new RedListManager();
$results = $rlm->lookupMultiple($speciesNames, 'shizuoka');
echo "Red list matches: " . count($results) . "\n";
foreach ($results as $name => $lists) {
    foreach ($lists as $listId => $entry) {
        echo "  $name -> [$listId] {$entry['category']}\n";
    }
}

// Show monthly distribution
echo "\n=== Monthly Distribution ===\n";
$monthly = [];
foreach ($aikan as $o) {
    $date = $o['observed_at'] ?? '';
    if ($date) {
        $ym = substr($date, 0, 7);
        $monthly[$ym] = ($monthly[$ym] ?? 0) + 1;
    }
}
ksort($monthly);
foreach ($monthly as $m => $c) {
    echo "$m: $c\n";
}

// Check quality grades
echo "\n=== Quality Grades ===\n";
$grades = [];
foreach ($aikan as $o) {
    $g = $o['quality_grade'] ?? ($o['status'] ?? 'unknown');
    $grades[$g] = ($grades[$g] ?? 0) + 1;
}
foreach ($grades as $g => $c) {
    echo "$g: $c\n";
}

// Check taxon groups
echo "\n=== Taxon Groups ===\n";
$groups = [];
foreach ($aikan as $o) {
    $g = $o['taxon']['group'] ?? ($o['category'] ?? 'unknown');
    $groups[$g] = ($groups[$g] ?? 0) + 1;
}
foreach ($groups as $g => $c) {
    echo "$g: $c\n";
}
