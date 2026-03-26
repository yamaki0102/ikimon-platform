<?php
require_once __DIR__ . '/../libs/VisionProcessor.php';

// CLI Arguments
$bookSlug = $argv[1] ?? null;
$limit = $argv[2] ?? 5; // Safety limit to prevent huge bills

if (!$bookSlug) {
    die("Usage: php run_vision_queue.php <book_slug> [limit]\nExample: php run_vision_queue.php world_amphibians_visual 5\n");
}

$jsonPath = __DIR__ . "/../data/legacy_ingest/v3_graph_{$bookSlug}.json";
$cacheDir = __DIR__ . "/../data/vision_cache";

if (!file_exists($jsonPath)) {
    die("Error: Book JSON not found at $jsonPath\n");
}

if (!file_exists($cacheDir)) {
    mkdir($cacheDir, 0777, true);
}

// Load Data
$data = json_decode(file_get_contents($jsonPath), true);
$processor = new VisionProcessor();

if (!$processor->hasKey()) {
    echo "==================================================\n";
    echo " [STOP] No Google API Key found.\n";
    echo " Please create a .env file in 'upload_package/' with:\n";
    echo " GOOGLE_API_KEY=your_gemini_api_key\n";
    echo "==================================================\n";
    exit(1);
}

echo "=== Processing Vision Queue for '$bookSlug' (Limit: $limit) ===\n";

$count = 0;
$updates = 0;

foreach ($data as $index => &$item) {
    if ($count >= $limit) break;

    // Check if it's a pending item
    if (isset($item['type']) && $item['type'] === 'pending_vision_analysis') {
        $imagePathRelative = $item['image_path'];
        // Fix path: The JSON has "BookName/Page.jpg", reality is "../../../book/BookName/Page.jpg"
        // But wait, where is the 'book' dir relative to this script?
        // Script is in `upload_package/scripts/`. Book is `g:/.../ikimon/ikimon.life/book`
        // So `../../book/`
        
        $realImagePath = __DIR__ . "/../../book/" . $imagePathRelative;
        $pageName = basename($realImagePath);
        $cacheFile = $cacheDir . "/{$bookSlug}_{$pageName}.json";

        echo " [$count] Processing: $pageName ... ";

        // 1. Check Cache first
        if (file_exists($cacheFile)) {
            echo "[CACHE HIT] ";
            $result = json_decode(file_get_contents($cacheFile), true);
        } else {
            // 2. Call API
            try {
                echo "[API CALL] ";
                $result = $processor->analyzeImage($realImagePath, $item['strategy']);
                // Save Cache
                file_put_contents($cacheFile, json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                sleep(2); // Rate limiting (courtesy)
            } catch (Exception $e) {
                echo "[ERROR] " . $e->getMessage() . "\n";
                continue;
            }
        }

        // 3. Update In-Memory Data
        // Replace the "pending" stub with the real data
        if (isset($result['structured_data'])) {
            $item = $result['structured_data'];
            // Preserve source metadata if needed, though Vision result should have it or we merge it
            // ensuring consistency
            $item['source_metadata']['updated_at'] = date('Y-m-d H:i:s');
            echo "Done.\n";
            $updates++;
        } else {
            echo "[INVALID FORMAT] Result missing structured_data.\n";
        }

        $count++;
    }
}

// Save back to JSON if updates happened
if ($updates > 0) {
    file_put_contents($jsonPath, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo ">> Updated $updates pages in $jsonPath\n";
} else {
    echo ">> No pending items processed (or queue empty).\n";
}
