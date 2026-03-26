<?php
/**
 * テスト: passive_event.php に環境データ付きリクエストを送り、
 * Canonical DB と environment_logs への保存を検証する
 */

// ikimon.life のブートストラップ相当
require_once __DIR__ . '/../upload_package/config/config.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/DataQuality.php';
require_once ROOT_DIR . '/libs/DataStageManager.php';
require_once ROOT_DIR . '/libs/PrivacyFilter.php';
require_once ROOT_DIR . '/libs/PassiveObservationEngine.php';
require_once ROOT_DIR . '/libs/CanonicalStore.php';
require_once ROOT_DIR . '/libs/GeoUtils.php';

echo "=== Test: 環境データ付き passive_event フロー ===\n\n";

// ── モックデータ作成 ──
$envHistory = [
    [
        'habitat' => '都市公園',
        'vegetation' => 'ソメイヨシノ並木・芝生',
        'ground' => '舗装路',
        'water' => 'なし',
        'canopy_cover' => '40',
        'disturbance' => 'medium',
        'description' => '桜並木のある都市公園',
        'timestamp' => '2026-03-21T10:30:00+09:00',
    ],
    [
        'habitat' => '河川敷',
        'vegetation' => 'ヨシ群落・ススキ',
        'ground' => '砂地',
        'water' => '本流あり',
        'canopy_cover' => '5',
        'disturbance' => 'low',
        'description' => '多摩川河川敷の草地',
        'timestamp' => '2026-03-21T10:20:00+09:00',
    ],
    [
        'habitat' => '住宅街',
        'vegetation' => '植栽・庭木',
        'ground' => 'コンクリート',
        'water' => 'なし',
        'canopy_cover' => '15',
        'disturbance' => 'high',
        'description' => '住宅地の街路',
        'timestamp' => '2026-03-21T10:10:00+09:00',
    ],
];

$events = [
    [
        'type' => 'visual',
        'taxon_name' => 'ソメイヨシノ',
        'scientific_name' => 'Cerasus × yedoensis',
        'confidence' => 0.92,
        'lat' => 35.6762,
        'lng' => 139.6503,
        'timestamp' => '2026-03-21T10:31:00+09:00',
        'model' => 'gemini-vision',
        'environment_snapshot' => $envHistory[0],
        'frame_ref' => 'scan_frames/2026-03/ls_test123/f_abc123.jpg',
    ],
    [
        'type' => 'audio',
        'taxon_name' => 'シジュウカラ',
        'scientific_name' => 'Parus minor',
        'confidence' => 0.85,
        'lat' => 35.6763,
        'lng' => 139.6504,
        'timestamp' => '2026-03-21T10:32:00+09:00',
        'model' => 'birdnet-v2.4',
        'environment_snapshot' => $envHistory[0],
    ],
    [
        'type' => 'visual',
        'taxon_name' => 'カワセミ',
        'scientific_name' => 'Alcedo atthis',
        'confidence' => 0.78,
        'lat' => 35.6770,
        'lng' => 139.6510,
        'timestamp' => '2026-03-21T10:22:00+09:00',
        'model' => 'gemini-vision',
        'environment_snapshot' => $envHistory[1],
    ],
];

$sessionMeta = [
    'duration_sec' => 1200,
    'distance_m' => 850,
    'route_polyline' => '35.676200,139.650300;35.677000,139.651000',
    'device' => 'test_runner',
    'app_version' => 'test_1.0',
    'scan_mode' => 'live-scan',
];

$userId = 'test_env_' . date('His');

// ── Step 1: PassiveObservationEngine でイベントバッチ処理 ──
echo "Step 1: PassiveObservationEngine::processEventBatch()\n";
$result = PassiveObservationEngine::processEventBatch($events, $userId, $sessionMeta);

echo "  session_id: {$result['session_id']}\n";
echo "  observations: " . count($result['observations']) . "件\n";
echo "  species: " . implode(', ', array_keys($result['summary']['species'])) . "\n";

// environment_snapshot が observation に継承されているか
$allHaveEnv = true;
foreach ($result['observations'] as $obs) {
    if (empty($obs['environment_snapshot'])) {
        echo "  ❌ FAIL: {$obs['species_name']} に environment_snapshot なし\n";
        $allHaveEnv = false;
    }
}
echo $allHaveEnv ? "  ✅ 全 observation に environment_snapshot あり\n" : "";

// frame_ref が継承されているか
$sakuraObs = null;
foreach ($result['observations'] as $obs) {
    if ($obs['species_name'] === 'ソメイヨシノ') $sakuraObs = $obs;
}
$hasFrameRef = $sakuraObs && !empty($sakuraObs['photo_ref']) && strpos($sakuraObs['photo_ref'], 'scan_frames/') === 0;
echo $hasFrameRef
    ? "  ✅ ソメイヨシノに frame_ref 紐付けOK ({$sakuraObs['photo_ref']})\n"
    : "  ❌ FAIL: ソメイヨシノに frame_ref なし\n";

// ── Step 2: Canonical Schema に保存 ──
echo "\nStep 2: Canonical Schema 保存\n";

$lats = array_filter(array_column($result['observations'], 'lat'));
$lngs = array_filter(array_column($result['observations'], 'lng'));
$centerLat = !empty($lats) ? array_sum($lats) / count($lats) : null;
$centerLng = !empty($lngs) ? array_sum($lngs) / count($lngs) : null;

$samplingEffort = [
    'duration_sec' => (int)($sessionMeta['duration_sec'] ?? 0),
    'distance_m' => (float)($sessionMeta['distance_m'] ?? 0),
    'route_polyline' => $sessionMeta['route_polyline'] ?? null,
    'env_history' => $envHistory,
];

$parentEventId = CanonicalStore::createEvent([
    'event_date' => date('c'),
    'decimal_latitude' => $centerLat,
    'decimal_longitude' => $centerLng,
    'sampling_protocol' => 'live-scan',
    'sampling_effort' => $samplingEffort,
    'capture_device' => $sessionMeta['device'] ?? null,
    'recorded_by' => $userId,
    'session_mode' => 'live-scan',
]);
echo "  parent_event_id: {$parentEventId}\n";

// parent event の sampling_effort に env_history が入っているか検証
$parentEvent = CanonicalStore::getEvent($parentEventId);
$effort = json_decode($parentEvent['sampling_effort'], true);
$hasEnvHistory = !empty($effort['env_history']) && count($effort['env_history']) === 3;
echo $hasEnvHistory
    ? "  ✅ parent event sampling_effort に env_history 3件あり\n"
    : "  ❌ FAIL: env_history が期待通りでない\n";

// child events + occurrences
$savedCount = 0;
foreach ($result['observations'] as $obs) {
    $envSnap = $obs['environment_snapshot'] ?? null;
    $childEffort = null;
    if ($envSnap) {
        $childEffort = json_encode(['environment' => $envSnap], JSON_UNESCAPED_UNICODE);
    }

    $childEventId = CanonicalStore::createEvent([
        'parent_event_id' => $parentEventId,
        'event_date' => $obs['observed_at'] ?? date('c'),
        'decimal_latitude' => $obs['lat'] ?? null,
        'decimal_longitude' => $obs['lng'] ?? null,
        'sampling_protocol' => 'live-scan',
        'sampling_effort' => $childEffort,
        'recorded_by' => $userId,
        'capture_device' => $sessionMeta['device'] ?? null,
        'session_mode' => 'live-scan',
    ]);

    $confContext = null;
    if ($envSnap) {
        $confContext = ['environment_at_detection' => $envSnap];
    }

    CanonicalStore::createOccurrence([
        'event_id' => $childEventId,
        'scientific_name' => $obs['taxon']['scientific_name'] ?? null,
        'vernacular_name' => $obs['taxon']['name'] ?? $obs['species_name'] ?? null,
        'basis_of_record' => 'MachineObservation',
        'evidence_tier' => 1,
        'observation_source' => 'live-scan',
        'detection_confidence' => $obs['detection_confidence'] ?? null,
        'confidence_context' => $confContext,
        'detection_model' => $obs['detection_model'] ?? null,
        'original_observation_id' => $obs['id'] ?? null,
        'occurrence_status' => 'present',
    ]);

    // child event の sampling_effort に環境データが入っているか
    $childEvent = CanonicalStore::getEvent($childEventId);
    $childEffortParsed = json_decode($childEvent['sampling_effort'] ?? '{}', true);
    $hasChildEnv = !empty($childEffortParsed['environment']['habitat']);
    echo "  child {$obs['species_name']}: " . ($hasChildEnv ? "✅ 環境紐付けOK ({$childEffortParsed['environment']['habitat']})" : "❌ 環境なし") . "\n";

    $savedCount++;
}

echo "\nStep 3: environment_logs 独立保存\n";

$envLog = [
    'session_id' => $result['session_id'],
    'canonical_event_id' => $parentEventId,
    'user_id' => $userId,
    'center_lat' => $centerLat,
    'center_lng' => $centerLng,
    'municipality' => '',
    'prefecture' => '',
    'scan_date' => date('Y-m-d'),
    'duration_sec' => (int)($sessionMeta['duration_sec'] ?? 0),
    'observations' => $envHistory,
    'observation_count' => count($envHistory),
    'created_at' => date('c'),
];
DataStore::append('environment_logs', $envLog);

// 保存されたか確認
$allLogs = DataStore::fetchAll('environment_logs');
$found = false;
foreach ($allLogs as $log) {
    if (($log['session_id'] ?? '') === $result['session_id']) {
        $found = true;
        echo "  ✅ environment_logs に保存済み\n";
        echo "  observation_count: {$log['observation_count']}\n";
        echo "  環境遷移: ";
        foreach ($log['observations'] as $o) {
            echo $o['habitat'] . ' → ';
        }
        echo "（時系列）\n";
        break;
    }
}
if (!$found) echo "  ❌ FAIL: environment_logs に見つからない\n";

echo "\n=== 全テスト完了: {$savedCount} occurrences 保存 ===\n";

// テストデータのクリーンアップ（Canonical DBのテスト行は残す = 無害）
