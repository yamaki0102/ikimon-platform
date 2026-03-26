<?php

require_once __DIR__ . '/../config/config.php';

$taxonData = json_decode(file_get_contents(DATA_DIR . '/taxon_resolver.json'), true);

if (empty($taxonData['taxa'])) {
    die("No taxa found.\n");
}

$first = reset($taxonData['taxa']);
print_r(array_keys($first));
print_r($first);
