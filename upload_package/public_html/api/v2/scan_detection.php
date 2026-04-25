<?php

/**
 * API v2: Scan Detection Receiver
 *
 * スキャンモードからの視覚検出バッチを受信する。
 * 写真付きの検出結果を処理し、観察レコードとして保存する。
 *
 * POST /api/v2/scan_detection.php
 * Content-Type: multipart/form-data
 *
 * Fields:
 *   detections (JSON): [{
 *     "taxon_name": "アゲハチョウ",
 *     "scientific_name": "Papilio xuthus",
 *     "confidence": 0.87,
 *     "lat": 35.6762,
 *     "lng": 139.6503,
 *     "timestamp": "2026-03-19T10:30:00+09:00",
 *     "model": "yolo_nature_v1",
 *     "photo_index": 0    // photos[] の何番目か
 *   }]
 *   session (JSON): {duration_sec, distance_m, device, app_version}
 *   photos[]: 写真ファイル（multipart）
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/DataQuality.php';
require_once ROOT_DIR . '/libs/DataStageManager.php';
require_once ROOT_DIR . '/libs/PrivacyFilter.php';
require_once ROOT_DIR . '/libs/PassiveObservationEngine.php';
require_once ROOT_DIR . '/libs/CanonicalStore.php';
require_once ROOT_DIR . '/libs/CanonicalMachineObservationPolicy.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Authentication required.', 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('POST method required.', 405);
}

if (!api_rate_limit('scan_detection', 5, 60)) {
    api_error('Rate limit exceeded.', 429);
}

$userId = Auth::getUserId();

// JSON フィールドをパース
$detections = json_decode($_POST['detections'] ?? '[]', true) ?: [];
$sessionMeta = json_decode($_POST['session'] ?? '{}', true) ?: [];
$canonicalPolicy = CanonicalMachineObservationPolicy::evaluate($sessionMeta);

if (empty($detections)) {
    api_error('No detections provided.', 400);
}

if (count($detections) > 100) {
    api_error('Too many detections. Max 100 per scan.', 400);
}

// 写真ファイルの処理
$photoFiles = $_FILES['photos'] ?? [];
$savedPhotos = [];

if (!empty($photoFiles['name']) && is_array($photoFiles['name'])) {
    $uploadDir = ROOT_DIR . '/data/uploads/scan/' . date('Y-m') . '/';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0755, true);
    }

    for ($i = 0; $i < count($photoFiles['name']); $i++) {
        if ($photoFiles['error'][$i] !== UPLOAD_ERR_OK) continue;

        $tmpFile = $photoFiles['tmp_name'][$i];
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($tmpFile);

        if (!in_array($mimeType, ['image/jpeg', 'image/png', 'image/webp'], true)) continue;

        $ext = match ($mimeType) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'jpg',
        };

        $filename = 'scan_' . bin2hex(random_bytes(8)) . '.' . $ext;
        $destPath = $uploadDir . $filename;

        if (move_uploaded_file($tmpFile, $destPath)) {
            $savedPhotos[$i] = [
                'path' => 'uploads/scan/' . date('Y-m') . '/' . $filename,
                'url' => '/uploads/scan/' . date('Y-m') . '/' . $filename,
            ];
        }
    }
}

// 検出イベントに変換
$events = [];
foreach ($detections as $det) {
    $photoIndex = $det['photo_index'] ?? null;
    $photoRef = ($photoIndex !== null && isset($savedPhotos[$photoIndex]))
        ? $savedPhotos[$photoIndex]['path']
        : null;

    $events[] = [
        'type' => 'visual',
        'taxon_name' => trim($det['taxon_name'] ?? ''),
        'scientific_name' => trim($det['scientific_name'] ?? ''),
        'taxon_key' => $det['taxon_key'] ?? null,
        'confidence' => max(0.0, min(1.0, (float) ($det['confidence'] ?? 0))),
        'lat' => isset($det['lat']) ? (float) $det['lat'] : null,
        'lng' => isset($det['lng']) ? (float) $det['lng'] : null,
        'timestamp' => $det['timestamp'] ?? date('c'),
        'model' => $det['model'] ?? 'yolo_nature',
        'photo_ref' => $photoRef,
    ];
}

$validEvents = array_filter($events, fn($e) => !empty($e['taxon_name']));

if (empty($validEvents)) {
    api_error('No valid detections after validation.', 400);
}

// エンジンで処理
$result = PassiveObservationEngine::processEventBatch(array_values($validEvents), $userId, $sessionMeta);

$parentEventId = null;
$canonicalSavedCount = 0;

try {
    $lats = array_filter(array_column($result['observations'], 'lat'), fn($v) => $v !== null && $v !== 0.0);
    $lngs = array_filter(array_column($result['observations'], 'lng'), fn($v) => $v !== null && $v !== 0.0);
    $centerLat = !empty($lats) ? array_sum($lats) / count($lats) : null;
    $centerLng = !empty($lngs) ? array_sum($lngs) / count($lngs) : null;

    if ($canonicalPolicy['enabled']) {
        $parentEventId = CanonicalStore::createEvent([
            'event_date' => date('c'),
            'decimal_latitude' => $centerLat,
            'decimal_longitude' => $centerLng,
            'sampling_protocol' => 'scan-visual',
            'sampling_effort' => [
                'duration_sec' => (int) ($sessionMeta['duration_sec'] ?? 0),
                'distance_m' => (float) ($sessionMeta['distance_m'] ?? 0),
                'photo_count' => count($savedPhotos),
                'detection_count' => count($detections),
            ],
            'capture_device' => $sessionMeta['device'] ?? null,
            'recorded_by' => $userId,
            'session_mode' => 'scan',
            'complete_checklist_flag' => 0,
            'target_taxa_scope' => 'visual',
        ]);
    }
} catch (Throwable $e) {
    error_log('[scan_detection] Session event creation error: ' . $e->getMessage());
}

// 観察に写真を紐付けて保存
$savedCount = 0;
foreach ($result['observations'] as $obs) {
    // 写真がある場合は photos 配列に追加
    if (!empty($obs['photo_ref']) && isset($savedPhotos)) {
        $obs['photos'] = [['path' => $obs['photo_ref'], 'url' => '/' . $obs['photo_ref']]];
        // 写真あり+位置あり → Grade B に昇格
        if ($obs['lat'] && $obs['lng']) {
            $obs['data_quality'] = 'B';
        }
    }

    if (DataStore::append('observations', $obs)) {
        $savedCount++;

        if ($parentEventId && $canonicalPolicy['enabled']) {
            try {
                $childEventId = CanonicalStore::createEvent([
                    'parent_event_id' => $parentEventId,
                    'event_date' => $obs['observed_at'] ?? date('c'),
                    'decimal_latitude' => $obs['lat'] ?? null,
                    'decimal_longitude' => $obs['lng'] ?? null,
                    'sampling_protocol' => 'scan-visual',
                    'recorded_by' => $userId,
                    'capture_device' => $sessionMeta['device'] ?? null,
                    'session_mode' => 'scan',
                    'coordinate_uncertainty_m' => $obs['location_uncertainty_m'] ?? null,
                    'sampling_effort' => [
                        'photo_ref' => $obs['photo_ref'] ?? null,
                        'source_device' => $obs['source_device'] ?? null,
                    ],
                ]);

                $occurrenceId = CanonicalStore::createOccurrence([
                    'event_id' => $childEventId,
                    'scientific_name' => $obs['taxon']['scientific_name'] ?? null,
                    'vernacular_name' => $obs['taxon']['name'] ?? ($obs['species_name'] ?? null),
                    'taxon_rank' => $obs['taxon']['rank'] ?? 'species',
                    'basis_of_record' => 'MachineObservation',
                    'evidence_tier' => !empty($obs['photo_ref']) ? 2 : 1,
                    'evidence_tier_by' => 'scan_detection',
                    'data_quality' => $obs['data_quality'] ?? 'C',
                    'observation_source' => 'scan',
                    'original_observation_id' => $obs['id'] ?? null,
                    'detection_confidence' => $obs['detection_confidence'] ?? null,
                    'confidence_context' => [
                        'photo_ref' => $obs['photo_ref'] ?? null,
                        'detection_count' => $obs['detection_count'] ?? 1,
                    ],
                    'detection_model' => $obs['detection_model'] ?? null,
                    'occurrence_status' => 'present',
                    'ai_version' => $obs['ai_version'] ?? null,
                ]);

                if (!empty($obs['photo_ref'])) {
                    CanonicalStore::addEvidence([
                        'occurrence_id' => $occurrenceId,
                        'media_type' => 'photo',
                        'media_path' => $obs['photo_ref'],
                        'capture_timestamp' => $obs['observed_at'] ?? date('c'),
                        'metadata' => [
                            'source' => 'scan_detection',
                            'source_device' => $obs['source_device'] ?? null,
                        ],
                    ]);
                }

                $canonicalSavedCount++;
            } catch (Throwable $e) {
                error_log('[scan_detection] Canonical occurrence error: ' . $e->getMessage());
            }
        }
    }
}

if ($savedCount === 0 && $parentEventId && $canonicalPolicy['enabled']) {
    try {
        CanonicalStore::createOccurrence([
            'event_id' => $parentEventId,
            'basis_of_record' => 'MachineObservation',
            'evidence_tier' => 0,
            'observation_source' => 'scan',
            'occurrence_status' => 'absent',
        ]);
    } catch (Throwable $e) {
        error_log('[scan_detection] Absence record error: ' . $e->getMessage());
    }
}

// セッションログ
DataStore::append('passive_sessions', [
    'session_id' => $result['session_id'],
    'user_id' => $userId,
    'mode' => 'scan',
    'detections_received' => count($detections),
    'photos_saved' => count($savedPhotos),
    'observations_created' => $savedCount,
    'summary' => $result['summary'],
    'canonical_policy' => $canonicalPolicy,
    'canonical_event_id' => $parentEventId,
    'created_at' => date('c'),
]);

api_success([
    'session_id' => $result['session_id'],
    'observations_created' => $savedCount,
    'photos_saved' => count($savedPhotos),
    'summary' => $result['summary'],
    'qa_summary' => [
        'detections_received' => count($detections),
        'events_valid' => count($validEvents),
        'observations_created' => $savedCount,
        'canonical_enabled' => (bool) $canonicalPolicy['enabled'],
        'canonical_skip_reason' => $canonicalPolicy['reason'],
        'canonical_occurrences_created' => $canonicalSavedCount,
    ],
], [
    'canonical' => $canonicalPolicy + [
        'parent_event_id' => $parentEventId,
        'occurrences_created' => $canonicalSavedCount,
    ],
]);
