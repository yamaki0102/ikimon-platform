<?php

/**
 * ingest_gbif_lit.php
 * Automated pipeline to fetch paper metadata from GBIF Literature API using ikimon taxa
 * and store them into PaperStore, mapped by TaxonPaperIndex.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/PaperStore.php';
require_once __DIR__ . '/../libs/TaxonPaperIndex.php';

echo "Starting GBIF Literature Ingestion Pipeline (Hybrid Hook A)...\n";

$taxonData = DataStore::get('taxon_resolver', 0);
if (empty($taxonData['taxa'])) {
    die("No taxa found in taxon_resolver.json.\n");
}

$progressFile = DATA_DIR . '/library/gbif_lit_progress.json';
$progress = file_exists($progressFile) ? json_decode(file_get_contents($progressFile), true) : ['last_processed_slug' => ''];
$lastProcessed = $progress['last_processed_slug'];

$taxaArray = $taxonData['taxa'];
$slugs = array_keys($taxaArray);
$startIndex = 0;
if ($lastProcessed) {
    $idx = array_search($lastProcessed, $slugs);
    if ($idx !== false) {
        $startIndex = $idx + 1;
    }
}
if ($startIndex >= count($slugs)) {
    echo "All taxa processed. Resetting loop to 0.\n";
    $startIndex = 0;
}

// Process 5 taxa per cron run
$batchSize = 5;
$processedSlugs = 0;
$index = TaxonPaperIndex::getIndex();

for ($i = $startIndex; $i < count($slugs); $i++) {
    if ($processedSlugs >= $batchSize) break;

    $slug = $slugs[$i];
    $taxon = $taxaArray[$slug];
    $name = $taxon['accepted_name'];
    $processedSlugs++;
    $progress['last_processed_slug'] = $slug;

    if (empty($name) || strpos($name, ' ') === false) { // Skip vague names or single words
        continue;
    }

    echo "\n-------------------------------------------------\n";
    echo "Querying GBIF Literature API for: $name\n";

    // limit=3 to avoid blowing up DB on initial runs
    $url = "https://api.gbif.org/v1/literature/search?q=" . urlencode('"' . $name . '"') . "&limit=3";

    // Create streaming context to have a small timeout
    $ctx = stream_context_create(['http' => ['timeout' => 10]]);
    $json = @file_get_contents($url, false, $ctx);

    if (!$json) {
        echo "Failed to fetch from GBIF Literature API.\n";
        continue;
    }

    $result = json_decode($json, true);
    if (empty($result['results'])) {
        echo "No results found.\n";
        continue;
    }

    foreach ($result['results'] as $entry) {
        $doi = $entry['identifiers']['doi'] ?? ($entry['id'] ?? 'gbif-lit-' . md5(json_encode($entry)));
        if (strpos($doi, 'doi.org/') !== false) {
            $doi = str_replace(['https://doi.org/', 'http://doi.org/'], '', $doi);
        }

        $title = $entry['title'] ?? 'Unknown Title';
        $abstract = $entry['abstract'] ?? '';
        $authors = [];
        if (!empty($entry['authors'])) {
            foreach ($entry['authors'] as $author) {
                $first = $author['firstName'] ?? '';
                $last = $author['lastName'] ?? '';
                $authors[] = trim("$first $last");
            }
        }
        $authorStr = empty($authors) ? 'Unknown' : implode(', ', $authors);
        $published = $entry['published'] ?? ($entry['year'] ?? '');
        $link = "https://www.gbif.org/literature/" . ($entry['id'] ?? '');

        // Save to PaperStore
        $existing = PaperStore::findById($doi, 'doi');
        if (!$existing) {
            $paperData = [
                'doi' => $doi,
                'title' => $title,
                'author' => $authorStr,
                'published_date' => (string)$published,
                'abstract' => $abstract,
                'link' => $link,
                'source' => 'GBIF_Literature',
                'ingested_at' => date('Y-m-d H:i:s'),
                'gbif_id' => $entry['id'] ?? null,
                'keywords' => $entry['keywords'] ?? []
            ];
            PaperStore::append($paperData);
            echo " [NEW] Ingested paper: $title\n";
        } else {
            echo " [SKIP] Already ingested: $doi\n";
        }

        // Add to index mapped to this specific taxon
        $nameKey = strtolower(trim($name));
        if (!isset($index[$nameKey])) $index[$nameKey] = [];
        if (!in_array($doi, $index[$nameKey])) {
            $index[$nameKey][] = $doi;
        }
    }
}

// Save the index and progress in batch
TaxonPaperIndex::saveIndex($index);
file_put_contents($progressFile, json_encode($progress, JSON_PRETTY_PRINT));
echo "\n-------------------------------------------------\n";
echo "GBIF Ingestion Batch Completed.\n";
