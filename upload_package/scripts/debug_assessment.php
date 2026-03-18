<?php
require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/DataStore.php';

$obsId = $argv[1] ?? 'fbf3a382-a4db-4fe5-9573-e4740f660071';
$obs = DataStore::findById('observations', $obsId);
if (!$obs) { echo "NOT FOUND\n"; exit(1); }

$assessments = $obs['ai_assessments'] ?? [];
$latest = null;
foreach (array_reverse($assessments) as $a) {
    if (($a['kind'] ?? '') === 'machine_assessment') { $latest = $a; break; }
}

if (!$latest) { echo "NO ASSESSMENT\n"; exit(1); }

$stc = $latest['similar_taxa_to_compare'] ?? [];
echo "similar_taxa_to_compare:\n";
echo "  type: " . gettype($stc) . "\n";
echo "  count: " . count($stc) . "\n";
echo "  empty(): " . (empty($stc) ? "YES" : "NO") . "\n";
echo "  json: " . json_encode($stc, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";

$me = $latest['missing_evidence'] ?? [];
echo "\nmissing_evidence:\n";
echo "  empty(): " . (empty($me) ? "YES" : "NO") . "\n";

echo "\nOuter condition (!empty(stc) || !empty(me)): " . ((!empty($stc) || !empty($me)) ? "TRUE" : "FALSE") . "\n";
echo "Inner condition (!empty(stc)): " . (!empty($stc) ? "TRUE" : "FALSE") . "\n";

// Check first element
if (!empty($stc)) {
    $first = $stc[0];
    echo "\nFirst element:\n";
    echo "  is_array: " . (is_array($first) ? "YES" : "NO") . "\n";
    if (is_array($first)) {
        echo "  name: " . ($first['name'] ?? 'MISSING') . "\n";
        echo "  hint: " . ($first['hint'] ?? 'MISSING') . "\n";
    } else {
        echo "  value: " . $first . "\n";
    }
}
