<?php
/**
 * Omoikane — No-Literature Species Rescue via GBIF Occurrence Data
 * 
 * For species with no literature found, fetches REAL observation data from GBIF
 * (coordinates, dates, elevation) and synthesizes a pseudo-document for extraction.
 * 
 * This avoids LLM hallucination by grounding everything in actual field observations.
 * Rate: 1 request/second to stay within GBIF API limits.
 * 
 * Usage: php rescue_no_literature.php [--limit=500] [--jp-only]
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/ExtractionQueue.php';

date_default_timezone_set('Asia/Tokyo');
echo "=== GBIF Occurrence Rescue for No-Literature Species ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n\n";

// Parse args
$limit = 500;
$jpOnly = false;
foreach ($argv as $arg) {
    if (preg_match('/--limit=(\d+)/', $arg, $m)) $limit = (int)$m[1];
    if ($arg === '--jp-only') $jpOnly = true;
}

$eq = ExtractionQueue::getInstance();
$eqPdo = $eq->getPDO();

// Get no_literature species
$sql = "SELECT species_name, occurrence_count_jp FROM queue WHERE status = 'no_literature'";
if ($jpOnly) $sql .= " AND occurrence_count_jp > 0";
$sql .= " ORDER BY occurrence_count_jp DESC LIMIT " . $limit;

$stmt = $eqPdo->query($sql);
$species = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "Found " . count($species) . " no_literature species to rescue" . ($jpOnly ? " (JP only)" : "") . "\n\n";

$rescued = 0;
$noData = 0;
$errors = 0;

$monthNames = [1=>'January',2=>'February',3=>'March',4=>'April',5=>'May',6=>'June',
               7=>'July',8=>'August',9=>'September',10=>'October',11=>'November',12=>'December'];

foreach ($species as $sp) {
    $name = $sp['species_name'];
    echo "  [{$rescued}/{$limit}] {$name}... ";
    
    // Fetch GBIF occurrences (real observations)
    $url = 'https://api.gbif.org/v1/occurrence/search?' . http_build_query([
        'scientificName' => $name,
        'limit' => 50,
        'hasCoordinate' => 'true',
        'hasGeospatialIssue' => 'false',
    ]);
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);
    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 429) {
        echo "RATE LIMITED. Waiting 60s...\n";
        sleep(60);
        continue;
    }
    
    if ($httpCode !== 200) {
        echo "HTTP {$httpCode}\n";
        $errors++;
        sleep(1);
        continue;
    }
    
    $data = json_decode($resp, true);
    $totalOccurrences = $data['count'] ?? 0;
    $results = $data['results'] ?? [];
    
    if (empty($results)) {
        echo "no occurrences\n";
        $noData++;
        sleep(1);
        continue;
    }
    
    // Aggregate real observation data
    $months = [];
    $elevations = [];
    $countries = [];
    $provinces = [];
    $habitats = [];
    $latitudes = [];
    $longitudes = [];
    
    foreach ($results as $r) {
        if (isset($r['month'])) $months[] = (int)$r['month'];
        if (isset($r['elevation'])) $elevations[] = (float)$r['elevation'];
        if (isset($r['country'])) $countries[$r['country']] = true;
        if (isset($r['stateProvince'])) $provinces[$r['stateProvince']] = true;
        if (isset($r['habitat']) && !empty($r['habitat'])) $habitats[$r['habitat']] = true;
        if (isset($r['decimalLatitude'])) $latitudes[] = (float)$r['decimalLatitude'];
        if (isset($r['decimalLongitude'])) $longitudes[] = (float)$r['decimalLongitude'];
    }
    
    // Synthesize a factual summary from REAL observation data
    $summaryParts = [];
    $summaryParts[] = "Species: {$name}";
    $summaryParts[] = "Based on {$totalOccurrences} verified GBIF occurrence records:";
    
    if (!empty($countries)) {
        $summaryParts[] = "Distribution countries: " . implode(', ', array_keys($countries));
    }
    if (!empty($provinces)) {
        $top = array_slice(array_keys($provinces), 0, 10);
        $summaryParts[] = "Regions/Provinces: " . implode(', ', $top);
    }
    if (!empty($months)) {
        sort($months);
        $uniqueMonths = array_unique($months);
        $monthLabels = array_map(fn($m) => $monthNames[$m] ?? $m, $uniqueMonths);
        $summaryParts[] = "Observation months: " . implode(', ', $monthLabels);
        $freq = array_count_values($months); arsort($freq); $peakMonth = array_key_first($freq); $summaryParts[] = "Peak activity month: " . ($monthNames[$peakMonth] ?? 'unknown');
    }
    if (!empty($elevations)) {
        $summaryParts[] = "Elevation range: " . round(min($elevations)) . "-" . round(max($elevations)) . "m (median: " . round(array_sum($elevations)/count($elevations)) . "m)";
    }
    if (!empty($latitudes)) {
        $summaryParts[] = "Latitude range: " . round(min($latitudes), 1) . "° to " . round(max($latitudes), 1) . "°";
    }
    if (!empty($habitats)) {
        $summaryParts[] = "Recorded habitats: " . implode('; ', array_slice(array_keys($habitats), 0, 5));
    }
    
    $syntheticText = implode("\n", $summaryParts);
    
    // Update queue: inject synthetic literature and set to literature_ready
    $updateStmt = $eqPdo->prepare("UPDATE queue SET 
        status = 'literature_ready',
        prefetched_literature = :lit,
        retries = 0
        WHERE species_name = :name AND status = 'no_literature'");
    
    $litPayload = json_encode([[
        'doi' => 'gbif_occurrence_' . md5($name),
        'title' => "GBIF Occurrence Summary for {$name}",
        'source' => 'GBIF_Occurrence',
        'text' => $syntheticText,
        'authors' => ['GBIF Community'],
        'year' => date('Y'),
    ]], JSON_UNESCAPED_UNICODE);
    
    $updateStmt->execute([':lit' => $litPayload, ':name' => $name]);
    
    $rescued++;
    echo "✅ rescued ({$totalOccurrences} records, " . count($months) . " months, " . count($elevations) . " elevations)\n";
    
    sleep(1); // Rate limit: 1 req/sec
}

echo "\n=== RESULTS ===\n";
echo "Rescued: {$rescued}\n";
echo "No GBIF data: {$noData}\n";
echo "Errors: {$errors}\n";
echo "Remaining no_literature: " . $eqPdo->query("SELECT COUNT(*) FROM queue WHERE status='no_literature'")->fetchColumn() . "\n";
