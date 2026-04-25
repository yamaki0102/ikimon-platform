<?php
require_once __DIR__ . '/../config/config.php';

$r = json_decode(file_get_contents(DATA_DIR . '/taxon_resolver.json'), true);
echo "JP index entries: " . count($r['jp_index']) . "\n";

// Check specific species
$checks = ['メダカ', 'ゲンジボタル', 'オナガサナエ'];
foreach ($checks as $name) {
    $found = isset($r['jp_index'][$name]) ? 'YES → ' . $r['jp_index'][$name] : 'NO';
    echo "$name: $found\n";
}

// Show first 5 jp_index entries
echo "\nFirst 5 jp_index:\n";
$i = 0;
foreach ($r['jp_index'] as $jp => $slug) {
    echo "  $jp → $slug\n";
    if (++$i >= 5) break;
}

// Show resolver stats
echo "\nResolver stats:\n";
echo json_encode($r['stats'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
