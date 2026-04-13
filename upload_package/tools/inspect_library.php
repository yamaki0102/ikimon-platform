<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Services/LibraryService.php';

$taxon = 'リュウキュウヤマガメ'; // Example taxon
$citations = LibraryService::getCitations($taxon);
$papers = LibraryService::getPapersForTaxon($taxon);

echo "Citations (first item):\n";
print_r(empty($citations) ? [] : $citations[0]);
echo "\nPapers (first item):\n";
print_r(empty($papers) ? [] : $papers[0]);
