<?php
// ikimon_digitizer_gemini.php
// Production Script: Digitize Field Guides using Google Gemini Pro Vision
// Usage: php ikimon_digitizer_gemini.php [image_dir] [api_key]

echo "=== IKIMON Legacy Digitizer (Powered by Gemini 1.5 Pro) ===\n";

$targetDir = $argv[1] ?? __DIR__ . '/../data/legacy_ingest';
$apiKey = $argv[2] ?? getenv('GEMINI_API_KEY');

if (!$apiKey) {
    die("Error: logical API Key is missing. Pass it as the 2nd argument or set GEMINI_API_KEY env var.\n");
}

$files = glob($targetDir . '/*.jpg'); 
if (empty($files)) {
    $files = glob($targetDir . '/*.[jJ][pP][gG]');
}

echo "Target: $targetDir\n";
echo "Found " . count($files) . " images.\n";

foreach ($files as $index => $imagePath) {
    $filename = basename($imagePath);
    $outputFile = __DIR__ . "/../data/legacy_ingest/processed_" . pathinfo($filename, PATHINFO_FILENAME) . ".json";

    // Skip if already exists (resume capability)
    if (file_exists($outputFile)) {
        echo "[$index] Skipping $filename (Already processed)\n";
        continue;
    }

    echo "[$index] Processing $filename ... ";

    // Prepare JSON Payload
    $base64Image = base64_encode(file_get_contents($imagePath));
    $promptText = <<<EOT
Analyze this field guide page to extract biological data.

EXTRACT JSON:
1. FACTS: Biological facts (size, season, distribution text).
2. HIGHER_TAXONOMY: Family/Order details if present.
3. IMPLICIT_FEATURES: Visual/Layout cues (e.g. "Detailed leg diagram suggests...").
4. IMPLICIT_DISTRIBUTION: Distribution info READ FROM MAPS (e.g. "Map excludes Hokkaido").

JSON STRUCTURE:
{
  "species_entries": [
    {
      "name_ja_old": "...",
      "facts": { "size": "...", "distribution_text": "...", "distribution_implicit": "..." },
      "generated_content": { "implicit_features": ["..."] }
    }
  ]
}
EOT;

    $payload = [
        "contents" => [
            [
                "parts" => [
                    ["text" => $promptText],
                    ["inline_data" => [
                        "mime_type" => "image/jpeg",
                        "data" => $base64Image
                    ]]
                ]
            ]
        ],
        "generationConfig" => [
            "response_mime_type" => "application/json"
        ]
    ];

    $ch = curl_init("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=$apiKey");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $json = json_decode($response, true);
        $content = $json['candidates'][0]['content']['parts'][0]['text'] ?? null;
        
        if ($content) {
            // Add Affiliate Metadata locally
            $finalData = json_decode($content, true);
            $finalData['source_metadata'] = ['filename' => $filename];
            $finalData['affiliate_data'] = [
                "amazon_link" => "https://amazon.co.jp/search?q=" . urlencode("クワガタムシハンドブック"),
                "attribution" => "Support the author by buying the book."
            ];

            file_put_contents($outputFile, json_encode($finalData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo "Done.\n";
        } else {
            echo "Failed (No content).\n";
        }
    } else {
        echo "Error ($httpCode)\n";
    }

    // Rate limit handling (Gemini free tier: 2 RPM, Pay-as-you-go: 60 RPM)
    // Sleep 4 seconds to be safe or adjust based on tier.
    sleep(4); 
}
EOT;
