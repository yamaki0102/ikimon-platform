<?php
// ikimon_digitizer.php
// Prototyping the Legacy Book Digitization Pipeline
// Usage: php ikimon_digitizer.php [path_to_image]

require_once __DIR__ . '/../libs/BioUtils.php';
// require_once __DIR__ . '/../libs/Taxon.php'; // Future integration

echo "=== IKIMON Legacy Digitizer Prototype ===\n";
echo "Mode: Fact Extraction & Historical Mapping\n\n";

// 1. Image Ingestion
$targetDir = $argv[1] ?? __DIR__ . '/../data/legacy_ingest';
$files = [];

if (is_dir($targetDir)) {
    echo "[1] Scanning directory: $targetDir\n";
    // Simple glob for robustness in this prototype environment
    $files = glob($targetDir . '/*.jpg'); 
    if (empty($files)) {
         // Fallback for different casing or extension
         $files = glob($targetDir . '/*.[jJ][pP][gG]');
    }
} else {
    $files[] = $targetDir;
}

echo "    Found " . count($files) . " images to process.\n";

foreach ($files as $index => $imagePath) {
    echo "\n--- Processing Image [" . ($index + 1) . "/" . count($files) . "]: " . basename($imagePath) . " ---\n";

    // 2. LLM Prompt Construction (Enhanced)
    $systemPrompt = <<<PROMPT
You are a biological data extractor with a deep understanding of layout design.
Analyze this field guide page.

EXTRACT:
1. FACTS (Measurements, Dates, Locations)
2. HIGHER TAXONOMY (Family/Order details)
3. IMPLICIT FEATURES (What does the diagram emphasize? What is the 'mood' of the layout?)
4. IMPLICIT DISTRIBUTION (Crucial: Read the map illustrations! e.g., 'Shaded area covers Honshu and Kyushu'.)

APPEND:
- Affiliate Links for the book.

OUTPUT: JSON structure:
{
  ...,
  "species_entries": [
    {
       ...,
       "facts": {
          "distribution_text": "...",
          "distribution_implicit": "EXTRACTED FROM MAP: [Region A, Region B]"
       }
    }
  ]
}
PROMPT;

    // 3. Mock LLM Response (Simulating enhanced extraction)
    echo "[3] Analyzing 'Use implied info' & 'Layout features'...\n";
    usleep(500000); // 0.5s

    // Dynamic mock based on filename (simple simulation)
    $filename = basename($imagePath);
    $speciesName = '不明な種';
    if (strpos($filename, 'okuwa') !== false) { $speciesName = 'オオクワガタ'; }
    elseif (strpos($filename, 'saw') !== false) { $speciesName = 'ノコギリクワガタ'; }
    elseif (strpos($filename, 'handbook') !== false) { $speciesName = 'クワガタムシ全般'; }

    $mockJson = '{
      "source_metadata": {
        "book_title": "クワガタムシハンドブック 増補改訂版",
        "processed_file": "' . $filename . '"
      },
      "species_entries": [
        {
          "name_ja_old": "' . $speciesName . '",
          "facts": { 
             "size": "30-76mm", 
             "season": "Summer",
             "distribution_text": "本州・四国・九州",
             "distribution_implicit": "EXTRACTED FROM MAP: [伊豆諸島の一部を含むが、北海道は空白]"
          },
          "generated_content": {
            "summary": "基本データとしての概要。",
            "implicit_features": [
               "背景色が淡いグリーンで統一されており、森林環境での生息を視覚的に強調している。",
               "大顎の比率図がページの30%を占めており、形態的変異の重要性を訴えるレイアウトとなっている。"
            ]
          },
          "affiliate_data": {
             "amazon_link": "https://www.amazon.co.jp/dp/SampleBookID?tag=ikimon-22",
             "rakuten_link": "https://books.rakuten.co.jp/rb/SampleBookID/?scid=af_pc_etc",
             "attribution_text": "本書を購入して著者を応援する"
          }
        }
      ]
    }';

    $data = json_decode($mockJson, true);
    
    // 4. Output
    $outputFile = __DIR__ . "/../data/legacy_ingest/processed_" . pathinfo($filename, PATHINFO_FILENAME) . ".json";
    if (!is_dir(dirname($outputFile))) { mkdir(dirname($outputFile), 0777, true); }
    file_put_contents($outputFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo "[4] Saved rich data to: " . basename($outputFile) . "\n";
}
echo "\n=== Batch Complete ===\n";
