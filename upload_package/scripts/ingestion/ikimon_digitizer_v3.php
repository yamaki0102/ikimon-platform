<?php
// ikimon_digitizer_v3.php
// V3 Production Engine: Scalable, Type-Strict, Bio-Navigator Ready.
// Usage: php ikimon_digitizer_v3.php [image_dir] [api_key]

require_once __DIR__ . '/../libs/BioUtils.php'; // Hypothetical lib for schema validation

echo "=== IKIMON Legacy Digitizer V3 (Schema: Scalable Bio-Akinator) ===\n";

$targetDir = $argv[1] ?? __DIR__ . '/../data/legacy_ingest';
$apiKey = $argv[2] ?? getenv('GEMINI_API_KEY');

// Schema Definition (Reflecting "Bio-Akinator" MVP Requirements)
$schemaDefinition = <<<SCHEMA
{
  "schema_version": "3.1-akinator-mvp",
  "source_metadata": { "page_number": "int", "page_type": "string" },
  "species_entries": [
    {
      "identity": {
        "modern_taxon_id": "int?", 
        "scientific_name": "string",
        "japanese_name": "string",
        "synonyms": "string[]",
        "confidence_score": "float"
      },
      "traits": {
        "morphology": {
          "size": { "length_cm": "float", "wingspan_cm": "float", "weight_g": "float", "size_class": "string (e.g. Sparrow-sized)" },
          "colors": { "head": "string", "breast": "string", "belly": "string", "back": "string", "wing": "string" },
          "features": { "beak_shape": "string", "leg_color": "string", "eye_color": "string" }
        },
        "ecology": {
          "habitat_macro": "string[] (e.g. River, Forest)",
          "habitat_micro": "string[] (e.g. Reed bed, Mid-stream)",
          "behavior": "string[] (e.g. Tail-wagging, Diving)",
          "activity_time": "string (Day/Night)"
        },
        "phenology": {
          "season_months": "int[]",
          "residency": "string (Resident/Migrant/Winter/Summer)"
        }
      },
      "confusion_set": [
        {
           "target_species": "string",
           "difference_key": "string",
           "condition_this": "string",
           "condition_other": "string"
        }
      ],
      "bio_navigator": {
        "questions": [
           { 
             "question_text": "string (e.g. eyes_color_is_red?)",
             "answer_type": "string (Yes/No/Select)",
             "relevant_trait": "string",
             "priority_score": "int (1-10)"
           }
        ]
      },
      "visual_semantics": { 
        "roi_box": "[x,y,w,h]", 
        "highlighted_features": "string[]" 
      }
    }
  ],
  "curation": { "citation": { "text": "string" }, "monetization": { "affiliate_asin": "string" } }
}
SCHEMA;

$files = glob($targetDir . '/*.jpg'); 
if (empty($files)) $files = glob($targetDir . '/*.[jJ][pP][gG]');

echo "Target: $targetDir\n";
echo "Found " . count($files) . " files.\n";

foreach ($files as $index => $imagePath) {
    if ($index > 0 && !$apiKey) break; // In mock mode, only do 1 to show structure

    $filename = basename($imagePath);
    $outputFile = __DIR__ . "/../data/legacy_ingest/v3_processed_" . pathinfo($filename, PATHINFO_FILENAME) . ".json";

    echo "[$index] Processing $filename ... ";

    if ($apiKey) {
        // --- REAL AI MODE ---
        $base64Image = base64_encode(file_get_contents($imagePath));
        $promptText = "Analyze this page strictly according to the V3 SCHEMA (Bio-Akinator MVP):\n" . $schemaDefinition;
        
        // Use Gemini 1.5 Pro Vision
        $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=" . $apiKey;
        $data = [
            "contents" => [
                [
                    "parts" => [
                        ["text" => $promptText],
                        [
                            "inline_data" => [
                                "mime_type" => "image/jpeg",
                                "data" => $base64Image
                            ]
                        ]
                    ]
                ]
            ],
            "generationConfig" => [
                "response_mime_type" => "application/json"
            ]
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        
        try {
            $response = curl_exec($ch);
            if (curl_errno($ch)) throw new Exception(curl_error($ch));
            $json = json_decode($response, true);
            
            // Extract text from Gemini response
            $rawContent = $json['candidates'][0]['content']['parts'][0]['text'] ?? '{}';
            $parsedContent = json_decode($rawContent, true);
            
            if (!$parsedContent) throw new Exception("Failed to parse JSON from AI");

            file_put_contents($outputFile, json_encode($parsedContent, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo "Done (AI Generated).\n";

        } catch (Exception $e) {
            echo "Error: " . $e->getMessage() . "\n";
        }
        curl_close($ch);
        
    } else {
        // --- MOCK MODE (Bio-Akinator V3 High Fidelity) ---
        // Simulating extraction for a Bird Page (e.g. Seguro-Sekirei vs Haku-Sekirei)
        $mockData = [
            "schema_version" => "3.1-akinator-mvp",
            "source_metadata" => [
                "book_slug" => basename($targetDir),
                "processed_file" => $filename,
                "classification" => "visual_index"
            ],
            "species_entries" => [
                [
                    "identity" => [
                        "scientific_name" => "Motacilla grandis",
                        "japanese_name" => "セグロセキレイ",
                        "synonyms" => ["Japanese Wagtail"],
                        "confidence_score" => 0.99
                    ],
                    "traits" => [
                        "morphology" => [
                            "size" => ["length_cm" => 21.0, "size_class" => "Sparrow+"],
                            "colors" => ["head" => "black", "breast" => "black", "belly" => "white", "back" => "black", "wing" => "black_and_white"],
                            "features" => ["beak_shape" => "thin_needle", "eye_color" => "black", "eyebrow" => "white"]
                        ],
                        "ecology" => [
                           "habitat_macro" => ["Rivers", "Lakes"],
                           "habitat_micro" => ["Mid-stream rocks", "Banks"],
                           "behavior" => ["Tail-wagging", "Ground_walking"],
                           "activity_time" => "Day"
                        ],
                        "phenology" => [
                            "season_months" => [1,2,3,4,5,6,7,8,9,10,11,12],
                            "residency" => "Resident"
                        ]
                    ],
                    "confusion_set" => [
                        [
                            "target_species" => "ハクセキレイ",
                            "difference_key" => "cheek_color",
                            "condition_this" => "Black (黒い頬)",
                            "condition_other" => "White (白い頬)"
                        ],
                        [
                            "target_species" => "ハクセキレイ",
                            "difference_key" => "back_color",
                            "condition_this" => "Deep Black",
                            "condition_other" => "Grey (often)"
                        ]
                    ],
                    "bio_navigator" => [
                        "questions" => [
                            [
                                "question_text" => "頬（ほっぺた）の色は黒いですか？",
                                "answer_type" => "Yes/No",
                                "relevant_trait" => "morphology.face_pattern",
                                "priority_score" => 10
                            ],
                            [
                                "question_text" => "水辺の石の上にいますか？",
                                "answer_type" => "Yes/No",
                                "relevant_trait" => "ecology.habitat",
                                "priority_score" => 8
                            ]
                        ]
                    ],
                    "visual_semantics" => [
                        "roi_box" => [100, 200, 500, 400], 
                        "highlighted_features" => ["black_cheek", "black_back"]
                    ]
                ]
            ],
            "curation" => [
                "citation" => [
                    "text" => "原色日本野鳥生態図鑑 (198x)",
                ],
                "monetization" => ["affiliate_asin" => "B0000000"]
            ]
        ];
        
        file_put_contents($outputFile, json_encode($mockData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo "Saved V3 Akinator Mock.\n";
    }
}
