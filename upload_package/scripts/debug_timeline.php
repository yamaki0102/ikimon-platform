<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Services/LibraryService.php';

$resolverFile = DATA_DIR . '/taxon_resolver.json';
$resolver = file_exists($resolverFile) ? json_decode(file_get_contents($resolverFile), true) : null;
$taxa = isset($resolver['taxa']) ? $resolver['taxa'] : [];

$slug = 'Ciconia nigra';
$slugNorm = strtolower(trim($slug));
$slugNorm = preg_replace('/\s+/', '-', $slugNorm);
$slugNorm = preg_replace('/[^a-z0-9\-]/', '', $slugNorm);

echo "Slug normalized: $slugNorm\n";
echo "In taxa? " . (isset($taxa[$slugNorm]) ? 'YES' : 'NO') . "\n";

$taxon = null;
$scientificName = null;

if (isset($taxa[$slugNorm])) {
    $entry = $taxa[$slugNorm];
    $taxon = isset($entry['ja_name']) ? $entry['ja_name'] : null;
    $scientificName = isset($entry['accepted_name']) ? $entry['accepted_name'] : null;
    echo "taxon (ja_name): $taxon\n";
    echo "scientificName: $scientificName\n";
} else {
    echo "Not in resolver\n";
}

echo "\n--- Citations for taxon='$taxon' ---\n";
$citations = LibraryService::getCitations($taxon);
echo "Citations count: " . count($citations) . "\n";
if (!empty($citations)) {
    echo "First 3 citation taxon_names:\n";
    foreach (array_slice($citations, 0, 3) as $c) {
        $tn = isset($c['taxon_name']) ? $c['taxon_name'] : 'N/A';
        $sn = isset($c['scientific_name']) ? $c['scientific_name'] : 'N/A';
        echo "  taxon_name=$tn | scientific_name=$sn\n";
    }
}

echo "\n--- Papers for taxon='$taxon' ---\n";
$papers = LibraryService::getPapersForTaxon($taxon);
echo "Papers count: " . count($papers) . "\n";
if (!empty($papers)) {
    echo "First 5 papers:\n";
    foreach (array_slice($papers, 0, 5) as $p) {
        $ql = isset($p['query_label']) ? $p['query_label'] : 'N/A';
        echo "  title=" . mb_strimwidth($p['title'], 0, 50, '...') . " | query_label=$ql\n";
    }
}
