<?php

/**
 * ingest_museums.php
 * Automated pipeline to fetch high-value local distribution records from 
 * Japanese Natural History Museum bulletins via J-STAGE API.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/PaperStore.php';

echo "Starting Local Museum Bulletin Ingestion Pipeline (Hybrid Hook B)...\n";

$jstage_api_base = 'https://api.jstage.jst.go.jp/searchapi/do?service=3';

// Top-tier Museum Bulletins available on J-STAGE (Examples)
// 国立科学博物館専報 (Memoirs of the National Science Museum) -> pubcode: memnsm
// 大阪市立自然史博物館研究報告 (Bulletin of the Osaka Museum of Natural History) -> pubcode: omnh
// 富山市科学博物館研究報告 -> pubcode: kensei
// Note: Actual pubcodes differ, so we can use "material" or exact ISSN searches.
// For PoC, we use broad boolean queries for museum journals in Japan.

$queries = [
    '("自然史博物館" OR "科学博物館") AND ("分布" OR "新種" OR "記録")',
    // We can also target specific taxa here
];

foreach ($queries as $query) {
    echo "\n-------------------------------------------------\n";
    echo "Querying J-STAGE for Museum Bulletins: $query\n";

    // limit=5 to avoid overloading
    $url = $jstage_api_base . '&text=' . urlencode($query) . '&count=5';

    $xmlData = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 10]]));
    if (!$xmlData) {
        echo "Failed to fetch from J-STAGE API.\n";
        continue;
    }

    $xml = @simplexml_load_string($xmlData);
    if (!$xml) continue;

    if (isset($xml->entry)) {
        foreach ($xml->entry as $entry) {
            $title = (string)$entry->title;
            // Ensure this is from a museum bulletin or relevant journal
            $journal = isset($entry->children('http://prismstandard.org/namespaces/basic/2.0/')->publicationName)
                ? (string)$entry->children('http://prismstandard.org/namespaces/basic/2.0/')->publicationName
                : '';

            $published = (string)$entry->published;
            $link = isset($entry->link['href']) ? (string)$entry->link['href'] : '';

            // Extract DOI
            $doi = '';
            $prism = $entry->children('http://prismstandard.org/namespaces/basic/2.0/');
            if (isset($prism->doi)) {
                $doi = (string)$prism->doi;
            } else {
                $dc = $entry->children('http://purl.org/dc/elements/1.1/');
                if (isset($dc->identifier)) {
                    $id = (string)$dc->identifier;
                    if (strpos($id, 'doi:') !== false) $doi = str_replace('doi:', '', $id);
                }
            }
            if (empty($doi)) $doi = 'jstage-museum-' . md5($link . $title);

            // Save to PaperStore
            $existing = PaperStore::findById($doi, 'doi');
            if (!$existing) {
                $paperData = [
                    'doi' => $doi,
                    'title' => $title,
                    'journal' => $journal,
                    'author' => isset($entry->author->name) ? (string)$entry->author->name : 'Unknown',
                    'published_date' => $published,
                    'abstract' => isset($entry->content) ? (string)$entry->content : '',
                    'link' => $link,
                    'source' => "Museum_Bulletin ($journal)",
                    'ingested_at' => date('Y-m-d H:i:s'),
                ];
                PaperStore::append($paperData);
                echo " [NEW] Ingested: $title ($journal)\n";
            } else {
                echo " [SKIP] Already ingested: $doi\n";
            }
        }
    }
}

echo "\n-------------------------------------------------\n";
echo "Museum Bulletin Ingestion Completed.\n";
