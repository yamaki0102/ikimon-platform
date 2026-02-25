<?php

/**
 * cron_extraction_engine.php
 * Autonomous Extraction Engine Pipeline (Target: 100,000 species)
 * Reads from Master Queue, fetches literature from GBIF, 
 * extracts data using Gemini Flash 2.5, and applies Zero-Hallucination validation.
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

  updateHeartbeat($workerStatusFile, $workerPid, $name, 'AI抽出中');

  // Verify prefetched literature exists
  if (!isset($item['prefetched_literature']) || empty($item['prefetched_literature'])) {
    echo "No prefetched literature found for: $searchTerm.\n";
    $item['status'] = 'no_literature'; // Shouldn't happen if status was literature_ready, but safety first
    $processedCount++;
    continue;
  }

  $successForSpecies = false;
  foreach ($item['prefetched_literature'] as $paper) {
    $doi = $paper['doi'] ?? uniqid();
    $abstract = $paper['abstract'] ?? '';

    echo " - Distilling DOI: $doi...\n";
    $contentToDistill = "Title: " . ($paper['title'] ?? '') . "\n\nAbstract:\n$abstract\n";

    $systemPrompt = <<<PROMPT
You are an expert taxonomist and ecological data extractor. 
IMPORTANT STRICT RULES:
1. DO NOT extract or deduce any taxonomic classifications (Kingdom, Phylum, Class, Order, Family, Genus) from the literature. Our system relies on GBIF Backbone Taxonomy exclusively.
2. The current TARGET species is: {$item['species_name']}. You MUST extract its ecological data.
3. If the text mentions ANY OTHER species in detail, extract their ecological data as well into "discovered_species". Only include species where concrete ecological or morphological data is present.
4. Extract the information into the following strict JSON format:
{
  "target_species": {
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
  },
  "discovered_species": [
    {
      "scientific_name": "Exact scientific name of the discovered species",
      "ecological_constraints": {
        "habitat": ["..."]
      },
      "identification_keys": [
        {
          "feature": "...",
          "description": "..."
        }
      ]
    }
  ]
}
Return ONLY valid JSON. If `discovered_species` are not present or lack detailed ecological data, return an empty array for it `[]`. If information is missing, return empty arrays or nulls.
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
        echo "   [LOCAL] Extraction finished for Target {$scientificName} (via {$doi}).\n";
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
  writeBackStatus($name, $finalStatus);
  echo "   [STATUS] {$name} -> {$finalStatus}\n";

  $processedCount++;
}

// No batch writeback needed - each species was written back immediately above




echo "Processed $processedCount species. Extraction Engine batch complete.\n";
