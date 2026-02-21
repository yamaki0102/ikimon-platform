<?php

/**
 * Ingest Papers - Academic Paper Registry → DataStore
 * 
 * papers_registry.json (Crossref収集済み340論文) を
 * ikimon.life の DataStore に取り込む。
 * 
 * - library/papers/{paper_id}        : 論文メタデータ
 * - library/paper_taxa/{link_id}     : 論文 ↔ 種 紐付け
 * 
 * Usage: php scripts/ingest_papers.php [--skip-gbif]
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/Services/GbifService.php';

// ============================================================
// CLI Options
// ============================================================
$skipGbif = in_array('--skip-gbif', $argv ?? []);
if ($skipGbif) {
    echo "[INFO] --skip-gbif mode: GBIF lookup will be skipped.\n";
}

// ============================================================
// Locate Registry
// ============================================================
$registryPath = __DIR__ . '/../../../book_digitization/_project/references/papers/_generated/papers_registry.json';
if (!file_exists($registryPath)) {
    echo "[ERROR] Registry not found: {$registryPath}\n";
    echo "Run ingest_crossref_queries.ps1 first.\n";
    exit(1);
}

$content = file_get_contents($registryPath);

// PowerShell ConvertTo-Json adds UTF-8 BOM — strip it
if (substr($content, 0, 3) === "\xEF\xBB\xBF") {
    $content = substr($content, 3);
} elseif (substr($content, 0, 2) === "\xFF\xFE") {
    $content = mb_convert_encoding(substr($content, 2), 'UTF-8', 'UTF-16LE');
}

$raw = json_decode($content, true);
if (!$raw || !isset($raw['entries'])) {
    echo "[ERROR] Invalid registry format. json_last_error: " . json_last_error_msg() . "\n";
    exit(1);
}

$entries = $raw['entries'];
$runId = $raw['run_id'] ?? 'unknown';
echo "=== Ingest Papers ===\n";
echo "Registry run: {$runId}\n";
echo "Total entries: " . count($entries) . "\n\n";

// ============================================================
// Paper Type Filter (skip low-value entries)
// ============================================================
$SKIP_TYPES = ['dataset', 'other', 'component', 'peer-review'];

// ============================================================
// Main Loop
// ============================================================
$totalPapers = 0;
$totalLinks = 0;
$totalGbif = 0;
$skipped = 0;

foreach ($entries as $entry) {
    $doi = $entry['doi'] ?? null;
    if (!$doi) {
        $skipped++;
        continue;
    }

    // Skip low-value types
    $type = $entry['type'] ?? 'unknown';
    if (in_array($type, $SKIP_TYPES)) {
        $skipped++;
        continue;
    }

    // Clean title (remove HTML tags)
    $title = strip_tags($entry['title'] ?? 'Untitled');

    // Generate stable ID from DOI
    $paperId = 'paper_' . md5($doi);

    // Build paper record
    $paper = [
        'id'              => $paperId,
        'doi'             => $doi,
        'title'           => $title,
        'year'            => $entry['year'] ?? null,
        'container_title' => $entry['container_title'] ?? null,
        'type'            => $type,
        'url'             => $entry['url'] ?? "https://doi.org/{$doi}",
        'source'          => 'crossref',
        'registry_run'    => $runId,
        'tier'            => 1,  // Peer-reviewed = Tier 1
        'dublin_core'     => [
            'dc:identifier' => "doi:{$doi}",
            'dc:title'      => $title,
            'dc:date'       => $entry['year'] ?? null,
            'dc:source'     => $entry['container_title'] ?? null,
            'dc:type'       => $type,
            'dc:format'     => 'application/json'
        ]
    ];

    DataStore::save("library/papers/{$paperId}", $paper);
    $totalPapers++;

    // -----------------------------------------------
    // Species Linking: queries[] → taxa
    // -----------------------------------------------
    $queries = $entry['queries'] ?? [];
    foreach ($queries as $q) {
        $queryId = $q['id'] ?? '';
        $label = $q['label'] ?? '';

        // Extract scientific name from label (first quoted binomial)
        $sciName = null;
        $jpName = null;
        if (preg_match('/^([A-Z][a-z]+ [a-z]+)/', $label, $m)) {
            $sciName = $m[1];
        }

        // Fallback: extract Japanese name from label (e.g. "オキナインコ Japan (keyword search)")
        if (!$sciName && preg_match('/^([\p{Han}\p{Hiragana}\p{Katakana}ー]+)/u', $label, $m)) {
            $jpName = $m[1];
        }

        if (!$sciName && !$jpName) continue;

        $linkKey = $sciName ?? $jpName;
        $linkId = "ptl_{$paperId}_" . md5($queryId . $linkKey);
        $link = [
            'id'              => $linkId,
            'paper_id'        => $paperId,
            'doi'             => $doi,
            'query_id'        => $queryId,
            'query_label'     => $label,
            'scientific_name' => $sciName,
            'jp_name'         => $jpName,
            'darwin_core'     => [
                'dwc:associatedReferences' => "doi:{$doi}",
                'dwc:scientificName'   => $sciName,
                'dwc:vernacularName'   => $jpName
            ]
        ];

        // GBIF enrichment
        if (!$skipGbif && $sciName) {
            $gbif = GbifService::matchName($sciName);
            if ($gbif && ($gbif['confidence'] ?? 0) >= 80) {
                $link['gbif_taxon_key']     = $gbif['taxon_key'];
                $link['gbif_status']        = $gbif['status'];
                $link['gbif_accepted_name'] = $gbif['accepted_name'];
                $link['gbif_accepted_key']  = $gbif['accepted_key'];
                $link['gbif_family']        = $gbif['family'];

                // Add DwC terms
                $link['darwin_core']['dwc:taxonConceptID'] = "gbif:{$gbif['taxon_key']}";
                $link['darwin_core']['dwc:taxonomicStatus'] = $gbif['status'];
                $link['darwin_core']['dwc:scientificName'] = $gbif['accepted_name'] ?? $sciName;
                $link['darwin_core']['dwc:originalNameUsage'] = $sciName; // Record exactly what they called it in the context of this paper Search Query
                $link['darwin_core']['dwc:nameAccordingTo'] = 'Crossref_Query';
                $link['darwin_core']['dwc:family'] = $gbif['family'];

                $totalGbif++;
            }
        }

        DataStore::save("library/paper_taxa/{$linkId}", $link);
        $totalLinks++;
    }

    // Progress
    if ($totalPapers % 50 === 0) {
        echo "  ... {$totalPapers} papers processed\n";
    }
}

echo "\n" . str_repeat('=', 60) . "\n";
echo "=== PAPER INGESTION COMPLETE ===\n";
echo "Papers indexed:    {$totalPapers}\n";
echo "Taxa links:        {$totalLinks}\n";
echo "GBIF enriched:     {$totalGbif}\n";
echo "Skipped:           {$skipped}\n";
