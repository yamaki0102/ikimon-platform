<?php
require_once __DIR__ . '/libs/DataStore.php';
require_once __DIR__ . '/libs/Taxon.php';

echo "Search: ヤマシギ\n";
$res1 = Taxon::search('ヤマシギ');
print_r($res1);

echo "\nSearch: Scolopax rusticola\n";
$res2 = Taxon::search('Scolopax rusticola');
print_r($res2);
