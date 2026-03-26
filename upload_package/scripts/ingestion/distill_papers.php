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
require_once __DIR__ . '/../libs/OmoikaneDB.php';
require_once __DIR__ . '/../libs/TaxonPaperIndex.php';

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
    // --- JSON ストレージ保存 ---
    DataStore::save($distilledStore, $distilledData);
    echo "\nSaved $processed new distilled records to JSON.\n";

    // --- SQLite 永続化 ---
    echo "Persisting to SQLite (OmoikaneDB)...\n";
    try {
        $db = new OmoikaneDB();
        $pdo = $db->getPDO();
        $sqliteOk = 0;
        $sqliteErr = 0;

        foreach ($distilledData as $doi => $item) {
            if (($item['status'] ?? '') !== 'distilled') continue;
            $data = $item['data'] ?? [];
            $eco = $data['ecological_constraints'] ?? [];
            $idKeys = $data['identification_keys'] ?? [];

            // 関連する学名を TaxonPaperIndex から取得
            $taxonKeys = [];
            $allIndex = TaxonPaperIndex::getIndex();
            foreach ($allIndex as $taxon => $dois) {
                if (in_array($doi, $dois, true)) {
                    $taxonKeys[] = $taxon;
                }
            }
            if (empty($taxonKeys)) continue;

            foreach ($taxonKeys as $taxonKey) {
                try {
                    // species テーブルで species_id を取得（なければ作成）
                    $stmt = $pdo->prepare("INSERT OR IGNORE INTO species (scientific_name) VALUES (:name)");
                    $stmt->execute([':name' => $taxonKey]);
                    $speciesId = $pdo->query("SELECT id FROM species WHERE scientific_name = " . $pdo->quote($taxonKey))->fetchColumn();
                    if (!$speciesId) continue;

                    // ecological_constraints テーブル（UPSERT）
                    if (!empty($eco['habitat']) || !empty($eco['altitude_range']) || !empty($eco['active_season'])) {
                        $habitat = is_array($eco['habitat'] ?? null) ? implode(', ', $eco['habitat']) : ($eco['habitat'] ?? '');
                        $altitude = $eco['altitude_range'] ?? '';
                        $season = is_array($eco['active_season'] ?? null) ? implode(', ', $eco['active_season']) : ($eco['active_season'] ?? '');
                        $notes = $eco['notes'] ?? '';

                        $stmt = $pdo->prepare("
                            INSERT INTO ecological_constraints (species_id, habitat, altitude, season, notes)
                            VALUES (:sid, :habitat, :altitude, :season, :notes)
                            ON CONFLICT(species_id) DO UPDATE SET
                                habitat = CASE WHEN excluded.habitat != '' THEN excluded.habitat ELSE habitat END,
                                altitude = CASE WHEN excluded.altitude != '' THEN excluded.altitude ELSE altitude END,
                                season = CASE WHEN excluded.season != '' THEN excluded.season ELSE season END,
                                notes = CASE WHEN excluded.notes != '' THEN excluded.notes ELSE notes END
                        ");
                        $stmt->execute([':sid' => $speciesId, ':habitat' => $habitat, ':altitude' => $altitude, ':season' => $season, ':notes' => $notes]);
                    }

                    // identification_keys テーブル（UPSERT）
                    if (!empty($idKeys)) {
                        $morphTraits = [];
                        $similarSp = [];
                        $keyDiffs = [];
                        foreach ($idKeys as $key) {
                            if (!empty($key['feature']) && !empty($key['description'])) {
                                $morphTraits[] = $key['feature'] . ': ' . $key['description'];
                            }
                            foreach ($key['comparison_species'] ?? [] as $sp) {
                                if ($sp && !in_array($sp, $similarSp, true)) {
                                    $similarSp[] = $sp;
                                }
                            }
                        }

                        $stmt = $pdo->prepare("
                            INSERT INTO identification_keys (species_id, morphological_traits, similar_species, key_differences)
                            VALUES (:sid, :morph, :similar, :diffs)
                            ON CONFLICT(species_id) DO UPDATE SET
                                morphological_traits = excluded.morphological_traits,
                                similar_species = excluded.similar_species,
                                key_differences = excluded.key_differences
                        ");
                        $stmt->execute([
                            ':sid' => $speciesId,
                            ':morph' => implode("\n", $morphTraits),
                            ':similar' => implode(', ', $similarSp),
                            ':diffs' => '',
                        ]);
                    }

                    // distilled_knowledge テーブル
                    $reviewedBy = ($item['review_status'] === 'approved') ? ($item['reviewed_by'] ?? null) : null;

                    // ecological_constraint エントリ
                    if (!empty($eco['habitat']) || !empty($eco['altitude_range'])) {
                        $stmt = $pdo->prepare("
                            INSERT OR IGNORE INTO distilled_knowledge (doi, taxon_key, knowledge_type, content, confidence, reviewed_by)
                            VALUES (:doi, :taxon, 'ecological_constraint', :content, :conf, :reviewer)
                        ");
                        $stmt->execute([
                            ':doi' => $doi,
                            ':taxon' => $taxonKey,
                            ':content' => json_encode($eco, JSON_UNESCAPED_UNICODE),
                            ':conf' => $item['review_confidence'] ?? 0.0,
                            ':reviewer' => $reviewedBy,
                        ]);
                    }

                    // identification_key エントリ
                    if (!empty($idKeys)) {
                        $stmt = $pdo->prepare("
                            INSERT OR IGNORE INTO distilled_knowledge (doi, taxon_key, knowledge_type, content, confidence, reviewed_by)
                            VALUES (:doi, :taxon, 'identification_key', :content, :conf, :reviewer)
                        ");
                        $stmt->execute([
                            ':doi' => $doi,
                            ':taxon' => $taxonKey,
                            ':content' => json_encode($idKeys, JSON_UNESCAPED_UNICODE),
                            ':conf' => $item['review_confidence'] ?? 0.0,
                            ':reviewer' => $reviewedBy,
                        ]);
                    }

                    // papers テーブルの distill_status を更新
                    $stmt = $pdo->prepare("UPDATE papers SET distill_status = 'distilled', distilled_at = :at WHERE doi = :doi");
                    $stmt->execute([':at' => date('c'), ':doi' => $doi]);

                    $sqliteOk++;
                } catch (PDOException $e) {
                    echo " [SQLite ERROR] {$taxonKey}: " . $e->getMessage() . "\n";
                    $sqliteErr++;
                }
            }
        }
        echo "SQLite: {$sqliteOk} records persisted, {$sqliteErr} errors.\n";
    } catch (Throwable $e) {
        echo "SQLite init failed: " . $e->getMessage() . "\n";
    }
} else {
    echo "No new papers needed distillation.\n";
}

echo "Semantic Extraction Pipeline complete.\n";
