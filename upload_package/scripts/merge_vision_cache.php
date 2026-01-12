<?php

$cacheDir = __DIR__ . '/../data/vision_cache';
$outputFile = __DIR__ . '/../data/legacy_ingest/v3_graph_world_amphibians_visual.json';
$bookSlug = 'world_amphibians_visual';

echo "Merging Vision Cache for '$bookSlug'...\n";

if (!file_exists($cacheDir)) {
    die("Error: Cache directory not found at $cacheDir\n");
}

$files = glob($cacheDir . "/{$bookSlug}_*.json");
$data = [];

foreach ($files as $file) {
    echo "Reading: " . basename($file) . "... ";
    $content = json_decode(file_get_contents($file), true);

    if (isset($content['structured_data'])) {
        $structuredData = $content['structured_data'];
    } else {
        $structuredData = $content;
    }

    if (isset($structuredData['source_metadata'])) {
        $data[] = [
            'description' => "Page " . str_pad($structuredData['source_metadata']['page_number'] ?? $structuredData['source_metadata']['page'], 3, '0', STR_PAD_LEFT) . " (Auto-Ingested)",
            'structured_data' => $structuredData
        ];
        echo "OK\n";
    } else {
        echo "SKIPPED (No structured_data or source_metadata)\n";
    }
}

// Sort by page number
usort($data, function ($a, $b) {
    $pageA = $a['structured_data']['source_metadata']['page_number'] ?? $a['structured_data']['source_metadata']['page'] ?? 0;
    $pageB = $b['structured_data']['source_metadata']['page_number'] ?? $b['structured_data']['source_metadata']['page'] ?? 0;
    return $pageA <=> $pageB;
});

echo "Total pages merged: " . count($data) . "\n";

// Write to file
file_put_contents($outputFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "Saved to $outputFile\n";
