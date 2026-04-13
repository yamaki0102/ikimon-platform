<?php
// tools/fetch_taxonomy.php
// Usage: php tools/fetch_taxonomy.php > public_html/data/navigator_data_gbif.json

// Config
$CLASSES = [
    'Insecta' => 1000, 
    // 'Aves' => 200, 
    // 'Plantae' => 1000 
];

$API_BASE = "https://api.gbif.org/v1";

function fetchJson($url) {
    echo stderr("Fetching: $url\n");
    // Use system curl to bypass PHP SSL configuration issues
    // Note: Windows curl might need quotes handling
    $cmd = "curl -s \"$url\"";
    $json = shell_exec($cmd);
    
    if (!$json) {
        stderr("Error: Empty response from curl\n");
        return null;
    }
    
    return json_decode($json, true);
}

function stderr($msg) {
    fwrite(STDERR, $msg);
}

$tree = [];

foreach ($CLASSES as $class => $limit) {
    stderr("Processing $class...\n");
    
    // 1. Get Occurrences in Japan to find Common Families
    // Facet by FAMILY_KEY to get popular families directly
    // This is faster than fetching species and aggregating
    $url = "$API_BASE/occurrence/search?country=JP&classKey=131&facet=familyKey&limit=0&facetLimit=50"; 
    // Note: classKey 131 = Insecta. We need to lookup Class Key first? 
    // Let's hardcode for MVP or search.
    // Insecta = 216 (GBIF Backbone?). Let's search 'Insecta'.
    
    // Searching for Class Key
    $classSearch = fetchJson("$API_BASE/species/match?name=$class&rank=CLASS");
    $classKey = $classSearch['usageKey'];
    stderr("Class $class Key: $classKey\n");
    
    // Facet Search
    $facetUrl = "$API_BASE/occurrence/search?country=JP&classKey=$classKey&facet=familyKey&limit=0&facetLimit=50";
    $facetData = fetchJson($facetUrl);
    
    $families = $facetData['facets'][0]['counts'];
    
    $classNode = [
        'id' => strtolower($class),
        'label' => $class, // Should fetch JA name
        'children' => []
    ];

    foreach ($families as $f) {
        $familyKey = $f['name'];
        $count = $f['count'];
        
        // Get Family Details (Name & Order)
        $info = fetchJson("$API_BASE/species/$familyKey");
        $scientificName = $info['canonicalName'];
        $order = isset($info['order']) ? $info['order'] : 'Other';
        
        // 1. Try GBIF Vernacular
        $names = fetchJson("$API_BASE/species/$familyKey/vernacularNames");
        $jaName = null;
        
        if (isset($names['results'])) {
            foreach ($names['results'] as $n) {
                if ($n['language'] === 'jpn' || $n['language'] === 'ja') {
                    $jaName = $n['vernacularName'];
                    echo stderr("  GBIF Name found: $jaName\n");
                    break;
                }
            }
        }
        
        // 2. Fallback to Wikidata
        if (!$jaName) {
            $jaName = fetchWikidataJa($scientificName);
            if ($jaName) echo stderr("  Wikidata Name found: $jaName\n");
        }
        
        // 3. Fallback to Scientific Cap
        if (!$jaName) $jaName = $scientificName;
        
        echo stderr("  Final Family: $scientificName [$order] -> $jaName [$count]\n");
        
        if (!isset($tree[$order])) {
            $tree[$order] = [];
        }
        
        $tree[$order][] = [
            'id' => $familyKey,
            'label' => $jaName,
            'sub' => $scientificName,
            'count' => $count,
            'icon' => 'help-circle' // Placeholder
        ];
    }
}

function fetchWikidataJa($sciname) {
    // 1. Search for Entity ID
    $searchUrl = "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=" . urlencode($sciname) . "&language=en&format=json";
    $search = fetchJson($searchUrl);
    
    if (empty($search['search'])) return null;
    
    $id = $search['search'][0]['id'];
    
    // 2. Get Label in JA
    $entityUrl = "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=$id&props=labels&languages=ja&format=json";
    $entity = fetchJson($entityUrl);
    
    if (isset($entity['entities'][$id]['labels']['ja']['value'])) {
        return $entity['entities'][$id]['labels']['ja']['value'];
    }
    
    return null;
}

echo json_encode($tree, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?>
