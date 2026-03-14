<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';

Auth::init();
header('Content-Type: application/json; charset=utf-8');

if (!Auth::isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'Login required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$user = Auth::user();
$userId = $user['id'];

// Fetch latest observation for this user
// We can use the Indexer if available, or scan recent partitions.
// Since we want the *very last* one, searching via user index is best, 
// but for MVP, scanning the global latest list is "okay" if traffic is low, 
// OR better: use DataStore::getLatest and filter by user_id? No, that's inefficient.
// Best approach for Scalability: Use Indexer "user_{id}_observations".

// However, assuming Indexer isn't fully robust for *writes* yet in my previous step,
// I'll check if I implemented user-index updating in DataStore::append. 
// Yes, I did: Indexer::addToIndex("user_{$item['user_id']}_{$resource}", ...

// Let's try to get from Index first.
require_once __DIR__ . '/../../libs/Indexer.php';

// The index structure for user is: "user_{id}_observations" -> ["2025-12", "id"] ?? 
// Actually Indexer::addToIndex logic was: $indexData[$key][] = $value;
// DataStore::append logic: Indexer::addToIndex("user_{...}", $date, $item['id']);
// This pushes "$date" (filename) to the index key "id"? 
// Wait, Indexer::addToIndex($indexName, $key, $value)
// In DataStore: Indexer::addToIndex("user_{$item['user_id']}_{$resource}", $date, $item['id']);
// This means: Index File = "user_{...}.json". Key = $date (e.g. 2025-12). Value = $item['id'].
// This seems weird. Usually Key=ID, Value=File. 
// Let's look at legacy DataStore::find logic: search all.

// Simpler Legacy-Compatible Approach for "Last One":
// Just fetch user's last post from "observations" (filtered).
// Since we have fetchAll, we can use it, but it's heavy.
// Let's try `DataStore::getLatest` but that's global.

// Let's implement a quick efficient search: 
// 1. Get partitions (newest first).
// 2. Scan for user_id match.
// 3. Return first match.

$partitions = glob(DATA_DIR . '/observations/*.json');
rsort($partitions); // Newest first

$lastObs = null;

// Search partitions
foreach ($partitions as $file) {
    if ($lastObs) break;
    $data = json_decode(file_get_contents($file), true) ?: [];
    $data = array_reverse($data); // Newest in file first
    foreach ($data as $obs) {
        /** @phpstan-ignore-line */
        if (isset($obs['user_id']) && $obs['user_id'] === $userId) {
            $lastObs = $obs;
            break 2;
        }
    }
}

// 4. Fallback to legacy if needed
if (!$lastObs) {
    $legacy = DataStore::get('observations');
    $legacy = array_reverse($legacy);
    foreach ($legacy as $obs) {
        if (isset($obs['user_id']) && $obs['user_id'] === $userId) {
            $lastObs = $obs;
            break;
        }
    }
}

if ($lastObs) {
    // Return only necessary fields for presets
    echo json_encode([
        'success' => true,
        'data' => [
            'observed_at' => $lastObs['observed_at'] ?? '',
            'lat' => $lastObs['lat'] ?? '',
            'lng' => $lastObs['lng'] ?? '',
            'cultivation' => $lastObs['cultivation'] ?? 'wild',
            'organism_origin' => $lastObs['organism_origin'] ?? (($lastObs['cultivation'] ?? 'wild') === 'cultivated' ? 'cultivated' : 'wild'),
            'managed_context' => $lastObs['managed_context'] ?? null,
            // 'note' is usually specific, don't copy
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
} else {
    echo json_encode(['success' => false, 'message' => 'No history found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
}
