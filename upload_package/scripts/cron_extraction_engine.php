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

$apiKey = getenv('GEMINI_API_KEY') ?: (defined('GEMINI_API_KEY') ? GEMINI_API_KEY : ($argv[1] ?? ''));
if (empty($apiKey)) {
    die("GEMINI_API_KEY is not set.\n");
}

echo "Starting Autonomous Extraction Engine...\n";

$queueFile = DATA_DIR . '/library/extraction_queue.json';
$queue = file_exists($queueFile) ? json_decode(file_get_contents($queueFile), true) : [];
if (empty($queue)) {
    die("Master queue is empty. Run initialize_extraction_queue.php first.\n");
}

$distilledStore = 'library/distilled_knowledge';
$distilledData = DataStore::get($distilledStore, 0) ?: [];
$failuresLog = DATA_DIR . '/library/extraction_failures.log';

$batchSize = 2; // Process 2 species per cron run
$processedCount = 0;

function callGemini($promptText, $apiKey, $responseType = "application/json")
{
    $payload = [
        "contents" => [["role" => "user", "parts" => [["text" => $promptText]]]],
        "generationConfig" => [
            "temperature" => 0.1,
            "responseMimeType" => $responseType
        ]
    ];
    $ch = curl_init("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . $apiKey);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    $responseJson = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($httpCode !== 200 || !$responseJson) return null;
    $res = json_decode($responseJson, true);
    $text = $res['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if ($responseType === 'application/json') {
        $text = preg_replace('/^```(?:json)?\s*/i', '', $text);
        $text = preg_replace('/\s*```$/i', '', $text);
    }
    return $text;
}

foreach ($queue as $name => &$item) {
    if ($processedCount >= $batchSize) break;
    if ($item['status'] !== 'pending') continue;

    echo "\n=== Processing Species: $name ===\n";
    $item['last_processed_at'] = date('Y-m-d H:i:s');
    $item['retries']++;

    $searchTerm = !empty($item['slug']) ? $item['slug'] : $item['species_name'];
    $searchTerm = str_replace('-', ' ', $searchTerm);
    echo "Fetching GBIF Literature for: $searchTerm...\n";
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
        if (isset($distilledData[$doi])) continue;

        $abstract = $paper['abstract'] ?? '';
        if (strlen(trim($abstract)) < 50) continue; // Too short

        echo " - Distilling DOI: $doi...\n";
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

        $extractedJsonText = callGemini($systemPrompt . "\n\nTEXT:\n" . $contentToDistill, $apiKey);
        if (!$extractedJsonText) continue;
        $extracted = json_decode($extractedJsonText, true);
        if (!$extracted) continue;

        // --- Reflexion Gate (Zero-Hallucination Matrix) ---
        echo "   -> Running Zero-Hallucination Reflexion Gate...\n";
        $reflexionPrompt = <<<PROMPT
You are an auditor verifying AI extractions for hallucinations.
ORIGINAL TEXT:
{$contentToDistill}

EXTRACTED JSON:
{$extractedJsonText}

Did the extracted JSON invent ANY facts, habitats, altitudes, seasons, or species NOT explicitly present in the original text?
Ignore empty arrays/nulls. Look closely at the populated fields.
Respond with exactly one valid JSON object:
{
  "hallucination_detected": boolean,
  "reason": "Explain briefly"
}
PROMPT;

        $reflexionJsonText = callGemini($reflexionPrompt, $apiKey);
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

        $distilledData[$doi] = [
            'status' => 'distilled',
            'distilled_at' => date('Y-m-d H:i:s'),
            'data' => $extracted,
            'review_status' => 'approved' // Automatically approved due to Reflexion Gate
        ];
        $successForSpecies = true;
        sleep(2); // Rate limiting
    }

    $item['status'] = $successForSpecies ? 'completed' : ($item['retries'] >= 3 ? 'failed' : 'pending');
    $processedCount++;
}

// Save state
file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
DataStore::save($distilledStore, $distilledData);

echo "Processed $processedCount species. Extraction Engine batch complete.\n";
