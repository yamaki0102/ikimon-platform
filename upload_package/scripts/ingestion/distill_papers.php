<?php

/**
 * distill_papers.php
 * Automated pipeline to run semantic extraction using Gemini 2.5 Flash API 
 * on ingested papers to extract Ecological Constraints and Identification Keys.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/PaperStore.php';
require_once __DIR__ . '/../libs/KnowledgeAutoReviewer.php';

$apiKey = getenv('GEMINI_API_KEY');
if (!$apiKey && defined('GEMINI_API_KEY')) {
    $apiKey = GEMINI_API_KEY;
}
if (!$apiKey && isset($argv[1])) {
    $apiKey = $argv[1];
}

if (empty($apiKey)) {
    die("GEMINI_API_KEY is not set. Pass it as the first argument or set the environment variable.\n");
}

echo "Starting Semantic Extraction Pipeline (Phase 2)...\n";

$papers = PaperStore::fetchAll();
if (empty($papers)) {
    die("No papers found in PaperStore to distill.\n");
}

$distilledStore = 'library/distilled_knowledge';
$distilledData = DataStore::get($distilledStore, 0) ?: []; // Cache 0 to get fresh

// Schema defining what we want Gemini to extract
$systemPrompt = <<<PROMPT
You are an expert taxonomist and ecologist reading academic papers to build a biodiversity database for citizen science.
Extract the following information from the provided text into strict JSON format:
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

IMPORTANT RULES:
1. Return ONLY valid JSON, starting with { and ending with }.
2. If the paper lacks this information, return empty arrays or nulls for the respective fields. Do not hallucinate.
3. Be as scientifically accurate as possible based ONLY on the provided text.
PROMPT;

echo "Found " . count($papers) . " potential papers. Checking distillation queue...\n";

$batchSize = 3; // Process 3 papers per run to stay within rate limits and time
$processed = 0;

foreach ($papers as $paper) {
    if ($processed >= $batchSize) break;

    $doi = $paper['doi'];
    if (isset($distilledData[$doi])) {
        // Already distilled
        continue;
    }

    echo "\n-------------------------------------------------\n";
    echo "Distilling Paper: {$paper['title']} (DOI: $doi)\n";

    // Construct the text to send to Gemini
    $contentToDistill = "Title: " . $paper['title'] . "\n\n";
    $contentToDistill .= "Abstract/Content:\n" . $paper['abstract'] . "\n";

    // We can't do much if there's no abstract or text
    if (strlen(trim($paper['abstract'])) < 50) {
        echo " [SKIP] Abstract too short or missing.\n";
        // Mark as distilled (empty) so we don't retry forever
        $distilledData[$doi] = ['status' => 'skipped_no_content'];
        continue;
    }

    // Call Gemini 2.5 Flash
    $payload = [
        "contents" => [
            [
                "role" => "user",
                "parts" => [
                    ["text" => $systemPrompt . "\n\nTEXT TO ANALYZE:\n" . $contentToDistill]
                ]
            ]
        ],
        "generationConfig" => [
            "temperature" => 0.1, // Keep it deterministic for JSON
            "responseMimeType" => "application/json"
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

    if ($httpCode !== 200 || !$responseJson) {
        echo " [ERROR] failed to call Gemini API. HTTP $httpCode\n";
        continue;
    }

    $responseData = json_decode($responseJson, true);
    $generatedText = '';

    if (isset($responseData['candidates'][0]['content']['parts'][0]['text'])) {
        $generatedText = $responseData['candidates'][0]['content']['parts'][0]['text'];
    }

    if (empty($generatedText)) {
        echo " [ERROR] Gemini returned empty text.\n";
        continue;
    }

    // Clean up markdown block if Gemini ignores responseMimeType
    $generatedText = preg_replace('/^```(?:json)?\s*/i', '', $generatedText);
    $generatedText = preg_replace('/\s*```$/i', '', $generatedText);

    $extracted = json_decode($generatedText, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo " [ERROR] Could not parse Gemini response as JSON: " . json_last_msg() . "\n";
        continue;
    }

    echo " [SUCCESS] Extracted semantics for $doi.\n";

    // Auto-review: 信頼ソースは自動承認、問題ありはアラート
    $paperMeta = [
        'doi' => $doi,
        'source' => $paper['source'] ?? 'unknown',
        'year' => $paper['year'] ?? null,
        'title' => $paper['title'] ?? '',
    ];
    $reviewResult = KnowledgeAutoReviewer::review($extracted, $paperMeta, $paper['taxon_key'] ?? '');

    if ($reviewResult['decision'] === 'auto_approved') {
        echo " [AUTO-APPROVED] confidence={$reviewResult['confidence']} — {$reviewResult['reason']}\n";
        $reviewStatus = 'approved';
        $reviewedBy = 'auto_reviewer';
    } else {
        echo " [NEEDS REVIEW] confidence={$reviewResult['confidence']} — {$reviewResult['reason']}\n";
        foreach ($reviewResult['alerts'] as $alert) {
            if ($alert['level'] === 'review' || $alert['level'] === 'warning') {
                echo "   ⚠ [{$alert['code']}] {$alert['message']}\n";
            }
        }
        $reviewStatus = 'needs_review';
        $reviewedBy = null;
    }

    // Save to our structured list
    $distilledData[$doi] = [
        'status' => 'distilled',
        'distilled_at' => date('Y-m-d H:i:s'),
        'data' => $extracted,
        'review_status' => $reviewStatus,
        'reviewed_by' => $reviewedBy,
        'reviewed_at' => $reviewedBy ? date('c') : null,
        'review_confidence' => $reviewResult['confidence'],
        'review_alerts' => $reviewResult['alerts'],
    ];
    $processed++;

    // Small delay to be nice to the API
    sleep(2);
}

if ($processed > 0) {
    DataStore::save($distilledStore, $distilledData);
    echo "Saved $processed new distilled records to $distilledStore.\n";
} else {
    echo "No new papers needed distillation.\n";
}

echo "Semantic Extraction Pipeline complete.\n";
