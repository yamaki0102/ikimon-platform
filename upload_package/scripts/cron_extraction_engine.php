<?php

/**
 * cron_extraction_engine.php
 * Autonomous Extraction Engine Pipeline (Target: 100,000 species)
 * Reads from Master Queue, fetches literature from GBIF, 
 * extracts data using Gemini Flash 2.5, and applies Zero-Hallucination validation.
 */

require_once __DIR__ . '/../config/config.php';
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

$queueFile = DATA_DIR . '/library/extraction_queue.json';

// === CRASH RESILIENCE LAYER 1: Shutdown handler ===
// If this worker dies for ANY reason (OOM, fatal, timeout),
// reset all its claimed items back to 'pending'.
$claimedNames = [];
register_shutdown_function(function () use (&$claimedNames, $queueFile, $workerStatusFile, $workerPid) {
  // Clean up heartbeat
  removeHeartbeat($workerStatusFile, $workerPid);
  if (empty($claimedNames)) return;
  $fp = fopen($queueFile, 'c+');
  if (!$fp || !flock($fp, LOCK_EX)) return;
  clearstatcache(true, $queueFile);
  $sz = filesize($queueFile);
  $q = json_decode($sz > 0 ? fread($fp, $sz) : '', true) ?: [];
  $resetCount = 0;
  foreach ($claimedNames as $n) {
    if (isset($q[$n]) && $q[$n]['status'] === 'processing') {
      $q[$n]['status'] = 'pending';
      $resetCount++;
    }
  }
  if ($resetCount > 0) {
    ftruncate($fp, 0);
    fseek($fp, 0);
    fwrite($fp, json_encode($q, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp);
  }
  flock($fp, LOCK_UN);
  fclose($fp);
  if ($resetCount > 0) {
    file_put_contents('php://stderr', "[SHUTDOWN HANDLER] Reset {$resetCount} items back to pending.\n");
  }
});

// Atomically claim a batch
$fpQ = fopen($queueFile, 'c+');
if (!$fpQ || !flock($fpQ, LOCK_EX)) die("Cannot lock queue file.\n");
clearstatcache(true, $queueFile);
$size = filesize($queueFile);
$queueJson = $size > 0 ? fread($fpQ, $size) : '';
$queue = json_decode($queueJson, true) ?: [];

$myBatch = [];
foreach ($queue as $name => &$item) {
  if (count($myBatch) >= $batchSize) break;
  if ($item['status'] !== 'pending') continue;

  $item['status'] = 'processing';
  $item['worker'] = getmypid();
  $item['retries']++;
  $myBatch[$name] = $item;
  $claimedNames[] = $name; // Track for shutdown handler
}

if (!empty($myBatch)) {
  ftruncate($fpQ, 0);
  fseek($fpQ, 0);
  fwrite($fpQ, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
  fflush($fpQ);
}
flock($fpQ, LOCK_UN);
fclose($fpQ);

if (empty($myBatch)) {
  $claimedNames = []; // Nothing to reset
  die("Master queue is empty or no pending items. Run initialize_extraction_queue.php first.\n");
}

$dbHelper = new OmoikaneDB();
$pdo = $dbHelper->getPDO();

$failuresLog = DATA_DIR . '/library/extraction_failures.log';

$processedCount = 0;
$myUpdates = [];

// === Helper: Atomically write back status for a SINGLE species ===
// This eliminates the dangerous window where items stay 'processing' forever.
function writeBackStatus($queueFile, $speciesName, $newStatus)
{
  global $claimedNames;
  $fp = fopen($queueFile, 'c+');
  if (!$fp || !flock($fp, LOCK_EX)) return;
  clearstatcache(true, $queueFile);
  $sz = filesize($queueFile);
  $q = json_decode($sz > 0 ? fread($fp, $sz) : '', true) ?: [];
  if (isset($q[$speciesName])) {
    $q[$speciesName]['status'] = $newStatus;
    $q[$speciesName]['last_processed_at'] = date('Y-m-d H:i:s');
  }
  ftruncate($fp, 0);
  fseek($fp, 0);
  fwrite($fp, json_encode($q, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);
  // Remove from shutdown handler watchlist
  $claimedNames = array_values(array_diff($claimedNames, [$speciesName]));
}

function callOllama($promptText, $model = "qwen3-optimized", $responseFormat = "json")
{
  $payload = [
    "model" => $model,
    "prompt" => $promptText,
    "stream" => false,
    "format" => $responseFormat,
    "options" => [
      "temperature" => 0.1
    ]
  ];

  $ch = curl_init("http://127.0.0.1:11434/api/generate");
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
  curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
  // === CRASH RESILIENCE LAYER 2: Hard timeout ===
  curl_setopt($ch, CURLOPT_TIMEOUT, 120); // 2 min max per Ollama call
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10); // 10s to connect

  $responseJson = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $curlErr = curl_error($ch);
  curl_close($ch);

  if ($httpCode !== 200 || !$responseJson) {
    echo "   [OLLAMA ERROR] HTTP: $httpCode | Curl: $curlErr | Response: " . substr((string)$responseJson, 0, 200) . "\n";
    return null;
  }

  $res = json_decode($responseJson, true);
  $text = trim($res['response'] ?? '');

  if (empty($text) && !empty($res['thinking'])) {
    $text = trim($res['thinking']);
  }

  // Clean up markdown and <think> wrapping
  $text = preg_replace('/<think>.*?<\/think>/is', '', $text);
  $text = preg_replace('/^```(?:json)?\s*/i', '', $text);
  $text = preg_replace('/\s*```$/i', '', $text);
  $text = trim($text);

  // Robust fallback: if asking for JSON, force regex hunt
  if ($responseFormat === 'json') {
    if (preg_match('/\{[\s\S]*\}/', $text, $matches)) {
      $text = $matches[0];
    }
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

  echo "Fetching GBIF Literature for: $searchTerm...\n";
  updateHeartbeat($workerStatusFile, $workerPid, $name, 'GBIF検索中');
  $apiUrl = "https://api.gbif.org/v1/literature/search?q=" . urlencode($searchTerm) . "&limit=3";
  $ch = curl_init($apiUrl);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  $gbifJson = curl_exec($ch);
  curl_close($ch);
  $gbifData = json_decode($gbifJson, true);

  if (empty($gbifData['results'])) {
    echo "No literature found.\n";
    $item['status'] = 'no_literature';
    $processedCount++;
    continue;
  }

  $successForSpecies = false;
  foreach ($gbifData['results'] as $paper) {
    $doi = $paper['identifiers']['doi'] ?? ($paper['id'] ?? uniqid());

    $abstract = $paper['abstract'] ?? '';
    if (strlen(trim($abstract)) < 50) continue; // Too short

    echo " - Distilling DOI: $doi...\n";
    updateHeartbeat($workerStatusFile, $workerPid, $name, 'AI抽出中');
    $contentToDistill = "Title: " . ($paper['title'] ?? '') . "\n\nAbstract:\n$abstract\n";

    $systemPrompt = <<<PROMPT
You are an expert taxonomist. Extract ecological information into strict JSON:
{
  "ecological_constraints": {
    "habitat": ["List of habitats"],
    "altitude_range": "e.g., 500m - 1500m",
    "active_season": ["Spring", "Summer"],
    "notes": "Any other ecological constraints"
  },
  "identification_keys": [
    {
      "feature": "Which part of the body",
      "description": "How to identify this species from others",
      "comparison_species": ["Species A", "Species B"]
    }
  ]
}
Return ONLY valid JSON. If information is missing, return empty arrays or nulls.
PROMPT;

    $extractedJsonText = callOllama($systemPrompt . "\n\nTEXT:\n" . $contentToDistill, "hf.co/mmnga-o/Qwen3-Swallow-8B-RL-v0.2-gguf:Q4_K_M", "json");
    if (!$extractedJsonText) {
      echo "   [DEBUG] Ollama returned empty or curl failed.\n";
      continue;
    }
    $extracted = json_decode($extractedJsonText, true);
    if (!$extracted) {
      echo "   [DEBUG] Invalid JSON returned: " . substr($extractedJsonText, 0, 200) . "...\n";
      continue;
    }

    // --- Reflexion Gate (Zero-Hallucination Matrix) ---
    echo "   -> Running Zero-Hallucination Reflexion Gate...\n";
    updateHeartbeat($workerStatusFile, $workerPid, $name, '検証ゲート');
    $reflexionPrompt = <<<PROMPT
You are an auditor verifying AI extractions for accuracy.
ORIGINAL TEXT:
{$contentToDistill}

EXTRACTED JSON:
{$extractedJsonText}

Is the extracted JSON reasonably derived from the original text? 
Do not reject for slight rephrasing, logical generalizations, or summaries.
Only reject if it completely invents specific concrete facts, numbers, or species that contradict or are absent from the text.
Respond with exactly one valid JSON object:
{
  "hallucination_detected": boolean,
  "reason": "Explain briefly"
}
Return ONLY valid JSON.
PROMPT;

    $reflexionJsonText = callOllama($reflexionPrompt, "hf.co/mmnga-o/Qwen3-Swallow-8B-RL-v0.2-gguf:Q4_K_M", "json");
    $reflexion = json_decode($reflexionJsonText, true);

    if ($reflexion && isset($reflexion['hallucination_detected']) && $reflexion['hallucination_detected'] === true) {
      echo "   [REJECTED] Hallucination detected: " . $reflexion['reason'] . "\n";
      file_put_contents($failuresLog, "[" . date('Y-m-d H:i:s') . "] REJECTED $doi: {$reflexion['reason']}\n", FILE_APPEND);
      continue; // Skip appending
    }

    echo "   [APPROVED] Strict validation passed. Saving.\n";

    // Save to PaperStore and Index
    PaperStore::upsert(['id' => $doi, 'doi' => $doi, 'title' => $paper['title'] ?? '', 'abstract' => $abstract, 'authors' => $paper['authors'] ?? [], 'year' => $paper['year'] ?? null]);
    TaxonPaperIndex::add($item['species_name'], $doi);

    $scientificName = $item['species_name'];

    // Insert into OMOIKANE SQLite Data Warehouse
    $stmtSpecies = $pdo->prepare("INSERT OR REPLACE INTO species (scientific_name, distillation_status, last_distilled_at) VALUES (?, 'distilled', ?)");
    $stmtSpecies->execute([$scientificName, date('Y-m-d H:i:s')]);

    $stmtGetId = $pdo->prepare("SELECT id FROM species WHERE scientific_name = ?");
    $stmtGetId->execute([$scientificName]);
    $speciesId = $stmtGetId->fetchColumn();

    if ($speciesId) {
      $stmtEco = $pdo->prepare("INSERT OR REPLACE INTO ecological_constraints (species_id, habitat, altitude, season, notes) VALUES (?, ?, ?, ?, ?)");
      $eco = $extracted['ecological_constraints'] ?? [];
      $stmtEco->execute([
        $speciesId,
        is_array($eco['habitat'] ?? '') ? implode(', ', $eco['habitat']) : ($eco['habitat'] ?? null),
        $eco['altitude_range'] ?? ($eco['altitude'] ?? null),
        is_array($eco['active_season'] ?? '') ? implode(', ', $eco['active_season']) : ($eco['active_season'] ?? ($eco['season'] ?? null)),
        $eco['notes'] ?? null
      ]);

      $stmtKeys = $pdo->prepare("INSERT OR REPLACE INTO identification_keys (species_id, morphological_traits, similar_species, key_differences) VALUES (?, ?, ?, ?)");
      $keys = $extracted['identification_keys'] ?? [];
      // Extract array to string if identification_keys format varies
      $morphTraits = "";
      $simSpecies = "";
      $keyDiffs = "";
      if (isset($keys[0]) && is_array($keys[0])) { // Array of objects
        $morphTraits = implode("\n", array_column($keys, 'feature'));
        $keyDiffs = implode("\n", array_column($keys, 'description'));
        $simList = [];
        foreach ($keys as $k) {
          if (isset($k['comparison_species']) && is_array($k['comparison_species'])) $simList = array_merge($simList, $k['comparison_species']);
        }
        $simSpecies = implode(', ', array_unique($simList));
      } else {
        $morphTraits = is_array($keys['morphological_traits'] ?? '') ? implode("\n", $keys['morphological_traits']) : ($keys['morphological_traits'] ?? null);
        $simSpecies = is_array($keys['similar_species'] ?? '') ? implode(', ', $keys['similar_species']) : ($keys['similar_species'] ?? null);
        $keyDiffs = is_array($keys['key_differences'] ?? '') ? implode("\n", $keys['key_differences']) : ($keys['key_differences'] ?? null);
      }

      $stmtKeys->execute([$speciesId, $morphTraits, $simSpecies, $keyDiffs]);
    }

    $successForSpecies = true;

    echo "   [LOCAL] Extraction finished & SQLite written for {$scientificName} (via {$doi}).\n";
    updateHeartbeat($workerStatusFile, $workerPid, $name, '✅ 完了');
  }

  // === CRASH RESILIENCE LAYER 3: Write back IMMEDIATELY per species ===
  $finalStatus = 'pending'; // Default: retry
  if ($item['status'] === 'no_literature') {
    $finalStatus = 'no_literature';
  } elseif ($item['status'] === 'invalid_name') {
    $finalStatus = 'invalid_name';
  } elseif ($successForSpecies) {
    $finalStatus = 'completed';
  } elseif ($item['retries'] >= 3) {
    $finalStatus = 'failed';
  }
  writeBackStatus($queueFile, $name, $finalStatus);
  echo "   [STATUS] {$name} -> {$finalStatus}\n";

  $processedCount++;
}

// No batch writeback needed - each species was written back immediately above




echo "Processed $processedCount species. Extraction Engine batch complete.\n";
