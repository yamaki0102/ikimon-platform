<?php
require_once __DIR__ . '/../config/config.php';

// 1. library/index stats
$dir = DATA_DIR . '/library/index';
$files = glob($dir . '/*.json');
$total = count($files);
$hasGbif = 0;
$hasSci = 0;
$statuses = [];
$sample = [];

foreach ($files as $f) {
    $j = json_decode(file_get_contents($f), true);
    if (!empty($j['gbif_taxon_key'])) $hasGbif++;
    if (!empty($j['scientific_name'])) $hasSci++;
    $s = $j['gbif_status'] ?? 'NONE';
    $statuses[$s] = ($statuses[$s] ?? 0) + 1;
    if (count($sample) < 3) {
        $sample[] = [
            'taxon' => $j['taxon_name'] ?? '?',
            'sci' => $j['scientific_name'] ?? '',
            'gbif_key' => $j['gbif_taxon_key'] ?? '',
            'gbif_status' => $j['gbif_status'] ?? '',
            'gbif_accepted' => $j['gbif_accepted_name'] ?? ''
        ];
    }
}

echo "=== LIBRARY INDEX ===\n";
echo "total=$total gbif_key=$hasGbif sci_name=$hasSci\n";
echo "statuses: " . json_encode($statuses) . "\n";
echo "samples:\n";
foreach ($sample as $s) {
    echo "  {$s['taxon']} | {$s['sci']} | key={$s['gbif_key']} | {$s['gbif_status']} | accepted={$s['gbif_accepted']}\n";
}

// 2. paper_taxa stats
$dir2 = DATA_DIR . '/library/paper_taxa';
$files2 = glob($dir2 . '/*.json');
$total2 = count($files2);
$hasGbif2 = 0;
foreach ($files2 as $f) {
    $j = json_decode(file_get_contents($f), true);
    if (!empty($j['gbif_taxon_key'])) $hasGbif2++;
}
echo "\n=== PAPER_TAXA ===\n";
echo "total=$total2 gbif_key=$hasGbif2\n";

// 3. observations stats
$dir3 = DATA_DIR . '/observations';
$files3 = glob($dir3 . '/*.json');
$total3 = count($files3);
$obsHasGbif = 0;
$obsHasSci = 0;
foreach ($files3 as $f) {
    $j = json_decode(file_get_contents($f), true);
    if (!empty($j['taxon']['gbif_key'])) $obsHasGbif++;
    if (!empty($j['taxon']['scientific_name'])) $obsHasSci++;
}
echo "\n=== OBSERVATIONS ===\n";
echo "total=$total3 gbif_key=$obsHasGbif sci_name=$obsHasSci\n";
