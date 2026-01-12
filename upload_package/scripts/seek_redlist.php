<?php
/**
 * The Seeker - Automated URL Discovery
 * Searches for Red Lists and generates configs for the Hunter.
 */

// Load Master Municipality CSV
$csvPath = __DIR__ . '/../data/masters/municipalities_jp.csv';
if (!file_exists($csvPath)) {
    die("Error: Master CSV not found at $csvPath\n");
}

$targets = [];
$lines = file($csvPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

// Skip header
array_shift($lines);

foreach ($lines as $line) {
    if (strpos($line, '#') === 0) continue; // Skip comments
    
    $cols = str_getcsv($line);
    // CSV format: code, prefecture, name, name_en
    if (count($cols) < 4) continue;
    
    $muniName = $cols[2]; // e.g., "千代田区"
    $muniNameEn = $cols[3]; // e.g., "Chiyoda Ku"
    
    // Generate Target
    // e.g., "Chiyoda Ku Red List" -> "https://example.com/redlist/town/chiyoda-ku"
    $slug = strtolower(str_replace(' ', '-', $muniNameEn));
    $targets["$muniName Red List"] = "https://example.com/redlist/town/" . $slug;
}

// Add Prefectures (Manual add or separate CSV)
// For now, let's keep the manual prefecture list from before or assume it's covered
$prefList = [
    'Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima',
    'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa',
    'Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu',
    'Shizuoka', 'Aichi', 'Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara',
    'Wakayama', 'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi',
    'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga', 'Nagasaki',
    'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa'
];

foreach ($prefList as $pref) {
    $targets["$pref Red List"] = "https://example.com/redlist/" . strtolower($pref);
}

// Merge with manual mocks if needed, or just use these
$mockSearchResults = $targets;

$configDir = __DIR__ . '/../data/redlists/configs';

echo "Starting The Seeker (MECE Master Grid Mode)...\n";
echo "Targeting " . count($mockSearchResults) . " regions.\n";

foreach ($mockSearchResults as $query => $url) {
    // Limit output for brevity in simulation
    // echo "Searching for '$query'... Found: $url\n";
    
    // Generate Config ID
    $id = 'auto_' . md5($url);
    $filename = $configDir . '/' . $id . '.json';
    
    if (file_exists($filename)) {
        echo "  Config already exists. Skipping.\n";
        continue;
    }
    
    // Create Auto-Discovery Config
    $config = [
        [
            "id" => $id,
            "name" => "$query (Auto-Detected)",
            "url" => $url,
            "type" => "html_table",
            "selectors" => [], // Empty selectors trigger HeuristicParser
            "scope" => "local",
            "authority" => "$query (The Seeker)"
        ]
    ];
    
    file_put_contents($filename, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo "  Generated config: " . basename($filename) . "\n";
}

echo "Seeking Completed.\n";
