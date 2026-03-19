<?php
require_once __DIR__ . '/../config/config.php';
$q = json_decode(file_get_contents(DATA_DIR . '/library/extraction_queue.json'), true);

// 1. Show Pica pica status
echo "=== Pica pica entry ===\n";
if (isset($q['Pica pica'])) {
    print_r($q['Pica pica']);
}

// 2. Find all non-biological garbage entries
echo "\n=== Suspicious non-species entries ===\n";
$garbage = [];
foreach ($q as $name => $item) {
    // Flag entries that don't look like binomial nomenclature
    $parts = explode(' ', $name);
    $isGarbage = false;

    // Not capitalized genus
    if (!empty($parts[0]) && $parts[0] !== ucfirst($parts[0])) $isGarbage = true;
    // Contains obviously non-taxonomic words
    $badWords = ['citizen', 'Japan', 'Family', 'Key to', 'Continuation', 'Unknown', 'Order', 'Class'];
    foreach ($badWords as $bw) {
        if (stripos($name, $bw) !== false) {
            $isGarbage = true;
            break;
        }
    }
    // Single word (not binomial)
    if (count($parts) < 2) $isGarbage = true;
    // Parenthetical author names as separate entries
    if (preg_match('/\(.*\)/', $name)) $isGarbage = true;

    if ($isGarbage) {
        $garbage[] = $name . ' [status: ' . ($item['status'] ?? '?') . ']';
    }
}
echo "Found " . count($garbage) . " suspicious entries:\n";
foreach ($garbage as $g) echo "  - $g\n";

// 3. Count how many completed items have retries > 1 (reprocessed)
echo "\n=== Items reprocessed multiple times ===\n";
$reprocessed = 0;
foreach ($q as $name => $item) {
    if (($item['retries'] ?? 0) > 1) {
        $reprocessed++;
        if ($reprocessed <= 10) {
            echo "  - $name (retries: {$item['retries']}, status: {$item['status']})\n";
        }
    }
}
echo "Total items with retries > 1: $reprocessed\n";
