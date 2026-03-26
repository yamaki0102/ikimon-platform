<?php

/**
 * cron_extraction_engine.php
 * Autonomous Extraction Engine Pipeline (Target: 100,000 species)
 * Reads from Master Queue, fetches literature from GBIF, 
 * extracts data using Gemini 2.5 Flash-Lite API (v2.0 — Free tier).
 */

require_once __DIR__ . '/../config/config.php';
ini_set('memory_limit', '512M');
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/PaperStore.php';
require_once __DIR__ . '/../libs/TaxonPaperIndex.php';
require_once __DIR__ . '/../libs/OmoikaneDB.php';

echo "Starting Autonomous Extraction Engine...\n";

// === WORKER HEARTBEAT SYSTEM ===
$workerStatusFile = DATA_DIR . '/library/worker_heartbeats.json';
$workerPid = getmypid();

function updateHeartbeat($file, $pid, $species, $phase)
{
  $fp = @fopen($file, 'c+');
  if (!$fp || !flock($fp, LOCK_EX)) return;
  clearstatcache(true, $file);
  $sz = filesize($file);
  $beats = json_decode($sz > 0 ? fread($fp, $sz) : '', true) ?: [];
  $beats[(string)$pid] = [
    'pid' => $pid,
    'species' => $species,
    'phase' => $phase,
    'updated_at' => date('Y-m-d H:i:s')
  ];
  ftruncate($fp, 0);
  fseek($fp, 0);
  fwrite($fp, json_encode($beats, JSON_UNESCAPED_UNICODE));
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);
}

function removeHeartbeat($file, $pid)
{
  $fp = @fopen($file, 'c+');
  if (!$fp || !flock($fp, LOCK_EX)) return;
  clearstatcache(true, $file);
  $sz = filesize($file);
  $beats = json_decode($sz > 0 ? fread($fp, $sz) : '', true) ?: [];
  unset($beats[(string)$pid]);
  ftruncate($fp, 0);
  fseek($fp, 0);
  fwrite($fp, json_encode($beats, JSON_UNESCAPED_UNICODE));
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);
}

$batchSize = isset($argv[2]) ? (int)$argv[2] : 2;

require_once __DIR__ . '/../libs/ExtractionQueue.php';
$eq = ExtractionQueue::getInstance();

// === CRASH RESILIENCE: Shutdown handler ===
$claimedNames = [];
register_shutdown_function(function () use (&$claimedNames, $workerStatusFile, $workerPid) {
  removeHeartbeat($workerStatusFile, $workerPid);
  if (empty($claimedNames)) return;
  // Reset my processing items back to literature_ready
  $eq2 = ExtractionQueue::getInstance();
  $resetCount = $eq2->resetProcessing($workerPid);
  if ($resetCount > 0) {
    file_put_contents('php://stderr', "[SHUTDOWN HANDLER] Reset {$resetCount} items back to literature_ready.\n");
  }
});

// Load already-distilled species from DB
$distilledSet = [];
try {
  $checkPdo = new PDO('sqlite:' . DATA_DIR . '/library/omoikane.sqlite3', null, null, [PDO::ATTR_TIMEOUT => 5]);
  $checkPdo->exec('PRAGMA query_only = ON;');
  $checkPdo->exec('PRAGMA busy_timeout = 5000;');
  $checkPdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $checkPdo->exec('PRAGMA journal_mode=WAL');
  $checkPdo->exec('PRAGMA query_only=ON');
  $stmt = $checkPdo->query("SELECT scientific_name FROM species WHERE distillation_status='distilled'");
  $distilledSet = array_flip($stmt->fetchAll(PDO::FETCH_COLUMN));
  $checkPdo = null;
  echo "[DB] Loaded " . count($distilledSet) . " distilled species for dedup.\n";
} catch (Exception $e) {
  echo "[WARN] Cannot check distilled set: " . $e->getMessage() . "\n";
}

// Claim a batch atomically via SQLite
$myBatch = $eq->claimBatch($batchSize, $workerPid, $distilledSet);
$claimedNames = array_keys($myBatch);

if (empty($myBatch)) {
  $claimedNames = []; // Nothing to reset
  echo "Master queue is empty or no pending items.\n";
  exit(2);
}

// DB writes are fully delegated to daemon_db_writer.php via JSON spool
// Workers no longer access SQLite directly

$failuresLog = DATA_DIR . '/library/extraction_failures.log';

$processedCount = 0;
$myUpdates = [];

// === Helper: Update queue status for a SINGLE species ===
function writeBackStatus($speciesName, $newStatus)
{
  global $claimedNames, $eq;
  $eq->updateStatus($speciesName, $newStatus);
  $claimedNames = array_values(array_diff($claimedNames, [$speciesName]));
}

// Mark discovered species as completed
function markDiscoveredSpeciesCompleted($discoveredNames)
{
  if (empty($discoveredNames)) return;
  global $eq;
  foreach ($discoveredNames as $name) {
    $eq->updateStatus($name, 'completed', 'Extracted serendipitously via another species.');
  }
}

function callGemini($promptText)
{
  $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' . GEMINI_API_KEY;

  $payload = [
    'contents' => [['parts' => [['text' => $promptText]]]],
    'generationConfig' => [
      'responseMimeType' => 'application/json',
      'temperature' => 0.1,
      'maxOutputTokens' => 16384
    ]
  ];

  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
  curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
  curl_setopt($ch, CURLOPT_TIMEOUT, 60);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);

  $responseJson = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $curlErr = curl_error($ch);
  curl_close($ch);

  if ($httpCode === 429 || $httpCode === 503) {
    echo "   [RATE LIMIT] Sleeping 10s...\n";
    sleep(10);
    return callGemini($promptText); // Retry once
  }

  if ($httpCode !== 200 || !$responseJson) {
    echo "   [GEMINI ERROR] HTTP: $httpCode | Curl: $curlErr | Response: " . substr((string)$responseJson, 0, 300) . "\n";
    return null;
  }

  $res = json_decode($responseJson, true);
  $text = trim($res['candidates'][0]['content']['parts'][0]['text'] ?? '');

  // Check if output was truncated
  $finishReason = $res['candidates'][0]['finishReason'] ?? '';
  if ($finishReason === 'MAX_TOKENS') {
    // Try to fix truncated JSON by closing brackets
    $text = rtrim($text, ', \n\t');
    $openBraces = substr_count($text, '{') - substr_count($text, '}');
    $openBrackets = substr_count($text, '[') - substr_count($text, ']');
    for ($i = 0; $i < $openBrackets; $i++) $text .= ']';
    for ($i = 0; $i < $openBraces; $i++) $text .= '}';
  }

  if (empty($text)) {
    echo "   [GEMINI] Empty response\n";
    return null;
  }

  return $text;
}

foreach ($myBatch as $name => &$item) {
  echo "\n=== Processing Species: $name ===\n";
  $item['last_processed_at'] = date('Y-m-d H:i:s');

  $searchTerm = !empty($item['slug']) ? $item['slug'] : $item['species_name'];
  $searchTerm = str_replace('-', ' ', $searchTerm);

  // Hard-skip non-taxa artifacts from literature parsing
  $isInvalid = false;
  $invalidKeywords = ['Key to ', 'Unknown', '不明', '概説続き', '系統分類', '出典', '参考文献'];
  foreach ($invalidKeywords as $kw) {
    if (stripos($searchTerm, $kw) !== false) {
      $isInvalid = true;
      break;
    }
  }

  if ($isInvalid) {
    echo "Skipping non-taxonomic header: $searchTerm\n";
    $item['status'] = 'invalid_name';
    $processedCount++;
    continue;
  }

  updateHeartbeat($workerStatusFile, $workerPid, $name, 'AI抽出中');

  // Verify prefetched literature exists
  if (!isset($item['prefetched_literature']) || empty($item['prefetched_literature'])) {
    echo "No prefetched literature found for: $searchTerm.\n";
    $item['status'] = 'no_literature'; // Shouldn't happen if status was literature_ready, but safety first
    $processedCount++;
    continue;
  }

  $successForSpecies = false;

  // === OPTIMIZATION: Consolidate all paper texts into a single LLM call ===
  $allTexts = [];
  $allDois = [];
  $trustedSourceCount = 0;
  $totalSourceCount = 0;
  $trustedSources = ['Wikipedia_JA', 'Wikipedia_EN', 'Wikidata', 'GBIF'];

  foreach ($item['prefetched_literature'] as $paper) {
    $doi = $paper['doi'] ?? uniqid();
    $text = $paper['text'] ?? $paper['abstract'] ?? '';
    $source = $paper['source'] ?? '';
    $title = $paper['title'] ?? '';
    $totalSourceCount++;

    if (in_array($source, $trustedSources)) {
      $trustedSourceCount++;
    }

    if (empty($text)) continue;

    // Truncate individual paper text for context budget (GTX 1660 constraint)
    if (mb_strlen($text) > 6000) {
      $text = mb_substr($text, 0, 6000) . '...';
    }

    $allTexts[] = "--- Source: {$source} | Title: {$title} ---\n{$text}";
    $allDois[] = $doi;

    // Save to PaperStore and Index
    PaperStore::upsert(['id' => $doi, 'doi' => $doi, 'title' => $title, 'abstract' => $text, 'authors' => $paper['authors'] ?? [], 'year' => $paper['year'] ?? null]);
    TaxonPaperIndex::add($item['species_name'], $doi);
  }

  if (empty($allTexts)) {
    echo " No usable text in literature.\n";
    writeBackStatus($name, 'no_literature');
    $processedCount++;
    continue;
  }

  $consolidatedText = implode("\n\n", $allTexts);

  // Context budget: 30000 chars (Gemini Flash-Lite handles 1M tokens easily)
  if (mb_strlen($consolidatedText) > 30000) {
    $consolidatedText = mb_substr($consolidatedText, 0, 30000) . "\n[...truncated]";
  }

  echo " - Consolidated " . count($allTexts) . " papers (" . mb_strlen($consolidatedText) . " chars). Single LLM call...\n";
  updateHeartbeat($workerStatusFile, $workerPid, $name, 'AI抽出中');

  $systemPrompt = <<<PROMPT
You are an expert taxonomist and ecologist. Extract ALL available biological data for {$item['species_name']} from the literature below.

EXTRACTION RULES:
1. Extract EVERY biological fact: ecology, morphology, behavior, distribution, conservation.
2. Never return empty arrays/null when the text contains relevant information.
3. Do NOT extract taxonomic hierarchy (Kingdom/Phylum/Class/Order/Family).

HABITAT QUALITY RULES (CRITICAL):
- Describe the ECOLOGICAL ENVIRONMENT, not just geographic regions.
- BAD: ["North America"], ["marine"], ["Japan"]
- GOOD: ["temperate deciduous forests", "riparian zones along mountain streams", "subtropical coral reefs at 5-30m depth"]
- Include: biome type, vegetation, substrate, water conditions, microhabitat preferences.
- Geographic range can be added to notes, NOT to habitat.

CRITICAL COMPLETENESS RULES:
- NEVER leave altitude_range or active_season empty. Use your expert knowledge to infer if the literature doesn't state explicitly.
- For altitude_range: infer from habitat type (e.g. alpine meadow → "2000-3000m", coastal mangrove → "0-10m", temperate forest → "200-1500m").
- For active_season: infer from climate zone, life cycle (e.g. temperate beetle → ["May-September"], tropical → ["year-round"], migratory bird → ["April-October (breeding)"]).
- Mark inferred data with "(inferred)" suffix if not explicitly stated in text.

FIELD INSTRUCTIONS:
- habitat: ecological environments (biome, vegetation, substrate, microhabitat). Be specific and detailed.
- altitude_range: elevation range. REQUIRED — infer from habitat/distribution if not explicit. Examples: "500-2000m", "lowland to 800m", "0-50m (coastal, inferred)".
- active_season: months/seasons/phenology. REQUIRED — infer from taxonomy and biogeography if not explicit. Examples: ["May-August"], ["year-round (tropical, inferred)"].
- notes: diet, host plants, behavior, conservation status, life history, geographic range, any other facts.
- identification_keys: body measurements, coloration patterns, structural features, diagnostic characters.
  Each key MUST include comparison_species. For every feature, name at least 1-2 species in the same genus or family that differ. If the literature does not mention comparisons explicitly, infer from your taxonomic knowledge which closely related species look similar and how they differ.

JSON OUTPUT FORMAT:
{"target_species":{"ecological_constraints":{"habitat":["specific ecological descriptions"],"altitude_range":"elevation if mentioned","active_season":["temporal activity"],"notes":"all other biological facts combined"},"identification_keys":[{"feature":"trait name","description":"detailed morphological description","comparison_species":["species for comparison"]}]},"discovered_species":[]}
PROMPT;

  $extractedJsonText = callGemini($systemPrompt . "\n\nTEXT:\n" . $consolidatedText);
  if (!$extractedJsonText) {
    echo "   [DEBUG] Gemini returned empty or curl failed.\n";
    writeBackStatus($name, ($item['retries'] ?? 0) >= 3 ? 'failed' : 'pending');
    $processedCount++;
    continue;
  }
  $extracted = json_decode($extractedJsonText, true);
  if (!$extracted) {
    echo "   [DEBUG] Invalid JSON returned: " . substr($extractedJsonText, 0, 200) . "...\n";
    writeBackStatus($name, ($item['retries'] ?? 0) >= 3 ? 'failed' : 'pending');
    $processedCount++;
    continue;
  }




  // === QUALITY GATE: Reject completely empty extractions ===
  $targetData = $extracted['target_species'] ?? [];
  $ecoData = $targetData['ecological_constraints'] ?? [];
  $keysData = $targetData['identification_keys'] ?? [];
  $hasHabitat = !empty($ecoData['habitat']) && $ecoData['habitat'] !== [];
  $hasSeason = !empty($ecoData['active_season']) && $ecoData['active_season'] !== [];
  $hasNotes = !empty($ecoData['notes']);
  $hasAltitude = !empty($ecoData['altitude_range']);
  $hasKeys = !empty($keysData) && $keysData !== [];
  $hasAnyData = $hasHabitat || $hasSeason || $hasNotes || $hasAltitude || $hasKeys;

  if (!$hasAnyData && ($item['retries'] ?? 0) <= 2) {
    echo "   [EMPTY DATA] No ecological or morphological data extracted. Retrying later.\n";
    file_put_contents($failuresLog, "[" . date('Y-m-d H:i:s') . "] EMPTY $name: All fields empty despite having literature\n", FILE_APPEND);
    writeBackStatus($name, 'literature_ready');
    $processedCount++;
    continue;
  }

  // Prepare species to be inserted
  $speciesToProcess = [];
  if (isset($extracted['target_species'])) {
    $speciesToProcess[] = [
      'name' => $item['species_name'],
      'data' => $extracted['target_species'],
      'is_target' => true
    ];
  }
  if (isset($extracted['discovered_species']) && is_array($extracted['discovered_species'])) {
    foreach ($extracted['discovered_species'] as $disc) {
      if (!empty($disc['scientific_name'])) {
        $speciesToProcess[] = [
          'name' => $disc['scientific_name'],
          'data' => $disc,
          'is_target' => false
        ];
      }
    }
  }

  $discoveredNames = [];
  foreach ($speciesToProcess as $sp) {
    $scientificName = $sp['name'];
    $spData = $sp['data'];

    // === JSON SPOOL (all DB writes delegated to daemon_db_writer.php) ===
    $spoolDir = __DIR__ . '/../data/spool';
    if (!is_dir($spoolDir)) @mkdir($spoolDir, 0777, true);

    $spoolData = [
      'scientific_name' => $scientificName,
      'is_target' => $sp['is_target'],
      'extracted_data' => $spData,
      'source_citations' => $item['source_citations'] ?? null,
      'specimen_records' => $item['specimen_records'] ?? [],
      'timestamp' => date('Y-m-d H:i:s'),
      'queue_update' => [
        'species_name' => $scientificName,
        'status' => $sp['is_target'] ? 'completed' : null
      ]
    ];

    $safeName = preg_replace('/[^a-zA-Z0-9]+/', '_', strtolower($scientificName));
    $spoolFile = $spoolDir . '/' . time() . '_' . substr(microtime(), 2, 6) . '_' . $safeName . '.json';
    file_put_contents($spoolFile, json_encode($spoolData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    // Remove from shutdown handler watchlist (spool written = safe to let DB Writer handle)
    $claimedNames = array_values(array_diff($claimedNames, [$name]));

    if ($sp['is_target']) {
      $successForSpecies = true;
      // Immediately mark queue as completed (don't wait for DB Writer)
      writeBackStatus($name, 'completed');
      echo "   [LOCAL] Extraction finished for {$scientificName}.\n";
      updateHeartbeat($workerStatusFile, $workerPid, $name, '✅ 完了');
    } else {
      $discoveredNames[] = $scientificName;
      echo "   [LOCAL] Found Serendipity Species: {$scientificName}.\n";
    }
  }

  // Mark discovered species as completed in the queue
  if (!empty($discoveredNames)) {
    markDiscoveredSpeciesCompleted($discoveredNames);
  }

  // === CRASH RESILIENCE LAYER 3: Write back IMMEDIATELY per species ===
  if (!$successForSpecies) {
    $finalStatus = 'pending'; // Default: retry
    if (($item['status'] ?? '') === 'no_literature') {
      $finalStatus = 'no_literature';
    } elseif (($item['status'] ?? '') === 'invalid_name') {
      $finalStatus = 'invalid_name';
    } elseif (($item['retries'] ?? 0) >= 3) {
      $finalStatus = 'failed';
    }
    writeBackStatus($name, $finalStatus);
    echo "   [STATUS] {$name} -> {$finalStatus}\n";
  }

  $processedCount++;
}

// No batch writeback needed - each species was written back immediately above




echo "Processed $processedCount species. Extraction Engine batch complete.\n";
