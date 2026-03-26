<?php

require_once __DIR__ . '/../config/config.php';

$papersFile = DATA_DIR . '/library/papers.json';
if (!file_exists($papersFile)) {
    die("papers.json not found.\n");
}

$papers = json_decode(file_get_contents($papersFile), true);
$output = "Total papers: " . count($papers) . "\n";

foreach ($papers as $id => $paper) {
    if (isset($paper['title'])) {
        $output .= "ID: {$id} | Title: {$paper['title']}\n";
    }
}

file_put_contents(__DIR__ . '/all_papers.txt', $output);
echo "Wrote all titles to all_papers.txt\n";
