<?php

require_once __DIR__ . '/../config/config.php';

$papersFile = DATA_DIR . '/library/papers.json';
if (!file_exists($papersFile)) {
    die("papers.json not found.\n");
}

$papers = json_decode(file_get_contents($papersFile), true);

echo "Total digitized books/papers: " . count($papers) . "\n";
echo "Listing books:\n";

foreach ($papers as $id => $paper) {
    if (isset($paper['title'])) {
        echo "- ID: {$id} | Title: {$paper['title']}\n";
    }
}
