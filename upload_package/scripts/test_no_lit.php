<?php
require_once __DIR__ . '/../config/config.php';

$term = "Dermochelys coriacea schlegelii";
$usageKey = "6157025"; // 適当なusageKeyとして

echo "Testing: $term\n";

$httpGet = function (string $url): ?string {
    $ctx = stream_context_create(['http' => [
        'header' => "User-Agent: OmoikaneBot/3.0 (ikimon.life; mailto:admin@ikimon.life)\r\n",
        'timeout' => 15,
    ]]);
    $result = @file_get_contents($url, false, $ctx);
    echo "  [GET] $url -> " . ($result ? "OK (" . strlen($result) . " bytes)" : "FAIL") . "\n";
    return $result !== false ? $result : null;
};

// 1. Wikidata
$wdUrl = "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=" . urlencode($term) . "&language=en&type=item&limit=1&format=json";
$httpGet($wdUrl);

// 2. Wikipedia EN
$url = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=" . urlencode($term) . "&format=json";
$httpGet($url);

// 3. GBIF Literature
$glUrl = "https://api.gbif.org/v1/literature/search?q=" . urlencode($term) . "&limit=3";
$httpGet($glUrl);

// 4. Semantic Scholar
$s2Url = "https://api.semanticscholar.org/graph/v1/paper/search?query=" . urlencode($term) . "&fields=title,abstract,year,url&limit=3";
$httpGet($s2Url);

// 5. Crossref
$crUrl = "https://api.crossref.org/works?query=" . urlencode($term) . "&select=title,abstract,DOI&rows=3";
$httpGet($crUrl);
