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
  ],
  "identification_pitfalls": [
    {
      "pitfall": "A common misidentification trap or confusion point",
      "affected_region": "Region where this is especially relevant (optional, null if global)"
    }
  ],
  "hybridization_info": {
    "known_hybrids": ["List of species that hybridize with the subject"],
    "detection_difficulty": "easy or moderate or hard",
    "notes": "How to detect hybrids, ploidy info, etc."
  },
  "photo_targets": [
    {
      "body_part": "Which part to photograph",
      "reason": "Why this part is diagnostic",
      "timing": "When to photograph (e.g., flowering, molting)"
    }
  ],
  "taxonomy_notes": "Any notes on recent taxonomic revisions, splits, lumps, or reclassifications",
  "cultural_significance": "Cultural, historical, or ethnobiological significance (null if none mentioned)"
}

IMPORTANT RULES:
1. Return ONLY valid JSON, starting with { and ending with }.
2. If the paper lacks this information, return empty arrays or nulls for the respective fields. Do not hallucinate.
3. Be as scientifically accurate as possible based ONLY on the provided text.
4. identification_pitfalls: Focus on cases where species are commonly confused, hybrids look like parents, or regional morphological variation causes errors.
5. photo_targets: What a citizen scientist should photograph to enable expert identification.
6. cultural_significance: Only extract if explicitly mentioned in the text.
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
                    $confidence = (float)($item['review_confidence'] ?? 0.0);
                    $sourceTier = in_array($paper['source'] ?? '', ['cinii', 'jstage', 'crossref', 'gbif_lit'], true) ? 'A' : 'B';

                    // ecological_constraint エントリ（blob として distilled_knowledge に保存）
                    if (!empty($eco['habitat']) || !empty($eco['altitude_range'])) {
                        $stmt = $pdo->prepare("
                            INSERT OR IGNORE INTO distilled_knowledge (doi, taxon_key, knowledge_type, content, confidence, reviewed_by)
                            VALUES (:doi, :taxon, 'ecological_constraint', :content, :conf, :reviewer)
                        ");
                        $stmt->execute([
                            ':doi' => $doi,
                            ':taxon' => $taxonKey,
                            ':content' => json_encode($eco, JSON_UNESCAPED_UNICODE),
                            ':conf' => $confidence,
                            ':reviewer' => $reviewedBy,
                        ]);
                    }

                    // identification_key エントリ（blob として distilled_knowledge に保存）
                    if (!empty($idKeys)) {
                        $stmt = $pdo->prepare("
                            INSERT OR IGNORE INTO distilled_knowledge (doi, taxon_key, knowledge_type, content, confidence, reviewed_by)
                            VALUES (:doi, :taxon, 'identification_key', :content, :conf, :reviewer)
                        ");
                        $stmt->execute([
                            ':doi' => $doi,
                            ':taxon' => $taxonKey,
                            ':content' => json_encode($idKeys, JSON_UNESCAPED_UNICODE),
                            ':conf' => $confidence,
                            ':reviewer' => $reviewedBy,
                        ]);
                    }

                    // --- claims テーブル: sentence-level grounding 用に claim 単位で分解保存 ---
                    // blob を「1主張 = 1行」に分解し、provenance (doi / source_tier) を付ける。
                    // retrieveAssessmentContext() がここを検索して根拠付き chunks を返す。

                    $sourceTitle = $paper['title'] ?? '';
                    $claimInsert = $pdo->prepare("
                        INSERT OR IGNORE INTO claims
                            (taxon_key, claim_type, claim_text, source_tier, doi, source_title, confidence, claim_hash)
                        VALUES (:taxon, :type, :text, :tier, :doi, :title, :conf,
                                lower(hex(randomblob(8))) || '-' || :hash_val)
                        ON CONFLICT(claim_hash) DO NOTHING
                    ");
                    // claim_hash を実行時に計算してバインドするヘルパー
                    $execClaim = function(array $params) use ($claimInsert, $pdo): void {
                        $hash = md5(($params[':taxon'] ?? '') . '|' . ($params[':type'] ?? '') . '|' . ($params[':text'] ?? ''));
                        $params[':hash_val'] = $hash;
                        try { $claimInsert->execute($params); } catch (\PDOException $e) { /* dup */ }
                    };

                    // 生息地 claim
                    if (!empty($eco['habitat'])) {
                        $habitatText = is_array($eco['habitat']) ? implode('、', $eco['habitat']) : $eco['habitat'];
                        $execClaim([
                            ':taxon' => $taxonKey,
                            ':type'  => 'habitat',
                            ':text'  => '生息地: ' . $habitatText,
                            ':tier'  => $sourceTier,
                            ':doi'   => $doi,
                            ':title' => $sourceTitle,
                            ':conf'  => $confidence,
                        ]);
                    }

                    // 活動期 claim
                    $season = is_array($eco['active_season'] ?? null)
                        ? implode('、', $eco['active_season'])
                        : ($eco['active_season'] ?? '');
                    if ($season !== '') {
                        $execClaim([
                            ':taxon' => $taxonKey,
                            ':type'  => 'season',
                            ':text'  => '活動時期: ' . $season,
                            ':tier'  => $sourceTier,
                            ':doi'   => $doi,
                            ':title' => $sourceTitle,
                            ':conf'  => $confidence,
                        ]);
                    }

                    // 高度 claim
                    if (!empty($eco['altitude_range'])) {
                        $execClaim([
                            ':taxon' => $taxonKey,
                            ':type'  => 'habitat',
                            ':text'  => '標高: ' . $eco['altitude_range'],
                            ':tier'  => $sourceTier,
                            ':doi'   => $doi,
                            ':title' => $sourceTitle,
                            ':conf'  => $confidence,
                        ]);
                    }

                    // 備考 claim
                    if (!empty($eco['notes'])) {
                        $execClaim([
                            ':taxon' => $taxonKey,
                            ':type'  => 'habitat',
                            ':text'  => $eco['notes'],
                            ':tier'  => $sourceTier,
                            ':doi'   => $doi,
                            ':title' => $sourceTitle,
                            ':conf'  => $confidence * 0.9,
                        ]);
                    }

                    // 形態同定 claims (identification_keys 各エントリ)
                    foreach ($idKeys as $idKey) {
                        if (empty($idKey['feature']) || empty($idKey['description'])) {
                            continue;
                        }
                        $claimText = $idKey['feature'] . ': ' . $idKey['description'];
                        if (!empty($idKey['comparison_species'])) {
                            $claimText .= '（比較種: ' . implode('、', $idKey['comparison_species']) . '）';
                        }
                        $execClaim([
                            ':taxon' => $taxonKey,
                            ':type'  => 'morphology',
                            ':text'  => $claimText,
                            ':tier'  => $sourceTier,
                            ':doi'   => $doi,
                            ':title' => $sourceTitle,
                            ':conf'  => $confidence,
                        ]);
                    }

                    // --- 新 claim_type: identification_pitfall ---
                    $pitfalls = $data['identification_pitfalls'] ?? [];
                    foreach ($pitfalls as $pf) {
                        $pfText = $pf['pitfall'] ?? '';
                        if (empty($pfText)) continue;
                        $region = $pf['affected_region'] ?? null;
                        $execClaim([
                            ':taxon' => $taxonKey,
                            ':type'  => 'identification_pitfall',
                            ':text'  => $pfText,
                            ':tier'  => $sourceTier,
                            ':doi'   => $doi,
                            ':title' => $sourceTitle,
                            ':conf'  => $confidence,
                        ]);
                        if ($region) {
                            $stmtRegion = $pdo->prepare("UPDATE claims SET region_scope = :region WHERE taxon_key = :taxon AND claim_type = 'identification_pitfall' AND claim_text = :text AND doi = :doi");
                            $stmtRegion->execute([':region' => $region, ':taxon' => $taxonKey, ':text' => $pfText, ':doi' => $doi]);
                        }
                    }

                    // --- 新 claim_type: hybridization ---
                    $hybridInfo = $data['hybridization_info'] ?? [];
                    if (!empty($hybridInfo['known_hybrids']) || !empty($hybridInfo['notes'])) {
                        $hybridParts = [];
                        if (!empty($hybridInfo['known_hybrids'])) {
                            $hybridParts[] = '交雑種: ' . implode('、', $hybridInfo['known_hybrids']);
                        }
                        if (!empty($hybridInfo['detection_difficulty'])) {
                            $hybridParts[] = '判別難易度: ' . $hybridInfo['detection_difficulty'];
                        }
                        if (!empty($hybridInfo['notes'])) {
                            $hybridParts[] = $hybridInfo['notes'];
                        }
                        $execClaim([
                            ':taxon' => $taxonKey,
                            ':type'  => 'hybridization',
                            ':text'  => implode('。', $hybridParts),
                            ':tier'  => $sourceTier,
                            ':doi'   => $doi,
                            ':title' => $sourceTitle,
                            ':conf'  => $confidence,
                        ]);
                    }

                    // --- 新 claim_type: photo_target ---
                    $photoTargets = $data['photo_targets'] ?? [];
                    foreach ($photoTargets as $pt) {
                        if (empty($pt['body_part']) || empty($pt['reason'])) continue;
                        $ptText = $pt['body_part'] . ': ' . $pt['reason'];
                        if (!empty($pt['timing'])) {
                            $ptText .= '（時期: ' . $pt['timing'] . '）';
                        }
                        $execClaim([
                            ':taxon' => $taxonKey,
                            ':type'  => 'photo_target',
                            ':text'  => $ptText,
                            ':tier'  => $sourceTier,
                            ':doi'   => $doi,
                            ':title' => $sourceTitle,
                            ':conf'  => $confidence,
                        ]);
                    }

                    // --- 新 claim_type: taxonomy_note ---
                    $taxonomyNotes = $data['taxonomy_notes'] ?? '';
                    if (!empty($taxonomyNotes) && $taxonomyNotes !== 'null') {
                        $execClaim([
                            ':taxon' => $taxonKey,
                            ':type'  => 'taxonomy_note',
                            ':text'  => $taxonomyNotes,
                            ':tier'  => $sourceTier,
                            ':doi'   => $doi,
                            ':title' => $sourceTitle,
                            ':conf'  => $confidence * 0.9,
                        ]);
                    }

                    // --- 新 claim_type: cultural ---
                    $cultural = $data['cultural_significance'] ?? '';
                    if (!empty($cultural) && $cultural !== 'null') {
                        $execClaim([
                            ':taxon' => $taxonKey,
                            ':type'  => 'cultural',
                            ':text'  => $cultural,
                            ':tier'  => $sourceTier,
                            ':doi'   => $doi,
                            ':title' => $sourceTitle,
                            ':conf'  => $confidence * 0.8,
                        ]);
                    }

                    // papers テーブルの distill_status を更新
                    $stmt = $pdo->prepare("UPDATE papers SET distill_status = 'completed', distilled_at = :at WHERE doi = :doi");
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
