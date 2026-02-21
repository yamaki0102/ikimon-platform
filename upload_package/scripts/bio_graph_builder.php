<?php
// bio_graph_builder.php (Target: Showa 27 Bird Encyclopedia)
require_once __DIR__ . '/../libs/BioUtils.php';

echo "=== ikimon Bio-Graph Builder (Historical Bridge Mode) ===\n";

// Target
$activeBooks = [
    'insect_sound_guide' => 'Sensory Mining',
    'animal_encyclopedia' => 'Patch-Priority Mining',
    'kuwagata_handbook_revised' => 'Logic Mining',
    'river_guide_sagamigawa' => 'Hybrid Map Mining',
    'world_bird_encyclopedia' => 'Dictionary Definition Mining',
    'fish_culture_history' => 'Entity Mining',
    'insectarium_37' => 'Methodology Mining',
    'japan_bird_encyclopedia_showa' => 'Historical Bridge Mining',
    'genshoku_jumoku_zukan' => 'Botanical Art Mining',
    'field_guide_japanese_butterflies' => 'Dimorphism Mining',
    'gakken_zukan_live_insects' => 'High-Density Comparison Mining',
    'world_amphibians_visual' => 'Visual Layout Mining',
];

$dirMap = [
    'insect_sound_guide' => '鳴き声から調べる昆虫図鑑',
    'animal_encyclopedia' => '動物大百科',
    'kuwagata_handbook_revised' => 'クワガタムシハンドブック増補改訂版',
    'river_guide_sagamigawa' => 'リバーガイド相模川の生き物たち',
    'world_bird_encyclopedia' => '世界鳥類事典',
    'fish_culture_history' => '魚の文化史',
    'insectarium_37' => 'インセクタリゥム37',
    'japan_bird_encyclopedia_showa' => '日本鳥類大圖鑑',
    'genshoku_jumoku_zukan' => '原色樹木図鑑',
    'field_guide_japanese_butterflies' => 'フィールドガイド_日本のチョウ',
    'gakken_zukan_live_insects' => '学研の図鑑LIVE_昆虫',
    'world_amphibians_visual' => '世界の両生類_ビジュアル図鑑'
];

foreach ($activeBooks as $slug => $strategy) {
    if (!isset($dirMap[$slug])) continue;
    processBook($slug, $dirMap[$slug], $strategy);
}

function processBook($slug, $dirName, $strategy) {
    echo ">> Processing Book: $dirName [Strategy: $strategy]\n";
    
    $bookDir = __DIR__ . "/../../book/$dirName";
    
    // Use scandir to avoid glob issues with [brackets]
    $allFiles = scandir($bookDir);
    $files = [];
    foreach ($allFiles as $f) {
        if (preg_match('/\.jpg$/i', $f)) {
            $files[] = $f;
        }
    }
    sort($files); 
    
    // Process Full Book (Simulated loop)
    $totalFiles = count($files);
    
    $contextBuffer = "Start of Book ($dirName).";
    $bookData = [];
    
    foreach ($files as $i => $file) {
        $page = basename($file);
        
        $extraction = simulateAgentExtraction($slug, $page, $strategy, $contextBuffer, $i + 1, $dirName);
        
        $contextBuffer = $extraction['page_summary'];
        $bookData[] = $extraction['data'];
        
        if (($i+1) % 50 == 0 || $i+1 == $totalFiles) echo "   > Processed " . ($i+1) . " / $totalFiles pages...\n";
    }
    
    $output = __DIR__ . "/../data/legacy_ingest/v3_graph_{$slug}.json";
    file_put_contents($output, json_encode($bookData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo ">> Saved Bio-Graph to $output\n\n";
}

function simulateAgentExtraction($slug, $page, $strategy, $context, $index, $dirName) {
    $pageNum = $index;
    $data = ['source_metadata' => ['page' => $pageNum, 'book' => $slug]];
    $summary = "";

    // REAL VISION EXTRACTION
    // Instead of simulation, we must extract actual visual data.
    // Since PHP cannot run local Vision models easily, this requires an API limit-aware architectural approach.
    
    // 1. Check if we have cached analysis for this page
    $cacheFile = __DIR__ . "/../data/vision_cache/{$slug}_{$page}.json";
    
    if (file_exists($cacheFile)) {
        $visionData = json_decode(file_get_contents($cacheFile), true);
        $summary = "Vision Cache Hit: " . substr($visionData['description'], 0, 50) . "...";
        $data = $visionData['structured_data'];
    } else {
        // 2. If no cache, mark for "Vision Queue"
        // We cannot process 1000s of pages in one PHP run synchronously without timeouts/costs.
        // We output a "Pending Vision" stub.
        $data = [
            'type' => 'pending_vision_analysis',
            'status' => 'queued',
            'image_path' => $dirName . '/' . $page,
            'strategy' => $strategy
        ];
        $summary = "[WAITING FOR EYES] Queued for Vision Analysis.";
    }

    return [
        'data' => $data,
        'page_summary' => $summary
    ];
}

// TODO: Create a separate 'vision_worker.php' that actually calls the API (GPT-4V / Gemini Pro Vision)
// to process the 'pending_vision_analysis' items one by one.
