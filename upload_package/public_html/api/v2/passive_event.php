<?php

/**
 * API v2: Passive Event Receiver
 *
 * ポケットモード/スキャンモードからのパッシブ検出イベントを受信する。
 * バッチ送信対応。端末側は Wi-Fi 接続時にまとめて送る。
 *
 * POST /api/v2/passive_event.php
 * Body: {
 *   "events": [
 *     {
 *       "type": "audio",           // audio | visual | sensor
 *       "taxon_name": "シジュウカラ",
 *       "scientific_name": "Parus minor",
 *       "confidence": 0.87,
 *       "lat": 35.6762,
 *       "lng": 139.6503,
 *       "timestamp": "2026-03-19T10:30:00+09:00",
 *       "model": "birdnet_lite_v2",
 *       "audio_snippet_hash": "a1b2c3..."  // 音声の場合
 *     }
 *   ],
 *   "session": {
 *     "duration_sec": 1800,
 *     "distance_m": 1200,
 *     "device": "Pixel 10 Pro",
 *     "app_version": "1.0.0",
 *     "route_polyline": "encoded_polyline..."
 *   }
 * }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/DataQuality.php';
require_once ROOT_DIR . '/libs/DataStageManager.php';
require_once ROOT_DIR . '/libs/PrivacyFilter.php';
require_once ROOT_DIR . '/libs/PassiveObservationEngine.php';
require_once ROOT_DIR . '/libs/CanonicalStore.php';
require_once ROOT_DIR . '/libs/GeoUtils.php';
require_once ROOT_DIR . '/libs/MeshCode.php';
require_once ROOT_DIR . '/libs/MeshAggregator.php';
require_once ROOT_DIR . '/libs/GeoPlausibility.php';
require_once ROOT_DIR . '/libs/CanonicalMachineObservationPolicy.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('POST method required.', 405);
}

// 認証（セッション OR install_id トークン）
Auth::init();
$userId = null;
$userName = 'Unknown';
$userAvatar = null;

if (Auth::isLoggedIn()) {
    $user = Auth::user();
    $userId = $user['id'] ?? null;
    $userName = $user['name'] ?? '';
    $userAvatar = $user['avatar'] ?? null;
} else {
    // FieldScanアプリからのinstall_id認証
    $installId = $_GET['install_id'] ?? null;
    if ($installId) {
        require_once ROOT_DIR . '/libs/UserStore.php';
        $installs = DataStore::get('fieldscan_installs') ?? [];
        $matched = null;
        foreach ($installs as $inst) {
            if (($inst['install_id'] ?? '') === $installId && ($inst['status'] ?? 'active') === 'active') {
                $matched = $inst;
                break;
            }
        }
        if ($matched) {
            $userId = $matched['user_id'];
            $freshUser = UserStore::findById($userId);
            if ($freshUser) {
                $userName = $freshUser['name'] ?? 'Unknown';
                $userAvatar = $freshUser['avatar'] ?? null;
            }
        } else {
            api_error('Invalid install_id. Register your device at ikimon.life/profile.', 401);
        }
    } else {
        api_error('Authentication required.', 401);
    }
}

if (empty($userId)) {
    api_error('Authentication required.', 401);
}

if (empty($userName) || $userName === 'Unknown') {
    require_once ROOT_DIR . '/libs/UserStore.php';
    $freshUser = UserStore::findById($userId);
    if ($freshUser && !empty($freshUser['name'])) {
        $userName = $freshUser['name'];
        $userAvatar = $freshUser['avatar'] ?? $userAvatar;
    }
}
if (empty($userName)) $userName = 'Unknown';

// レート制限（パッシブは大量バッチなので緩め）
if (!api_rate_limit('passive_event', 10, 60)) {
    api_error('Rate limit exceeded. Max 10 batches per minute.', 429);
}
$body = api_json_body();

$events = $body['events'] ?? [];
$sessionMeta = $body['session'] ?? [];
$envHistory = $body['env_history'] ?? [];
$qaSessionIntent  = $sessionMeta['session_intent'] ?? 'official';
$qaOfficialRecord = $sessionMeta['official_record'] ?? true;
$qaTestProfile    = $sessionMeta['test_profile'] ?? 'field';
$canonicalPolicy = CanonicalMachineObservationPolicy::evaluate($sessionMeta);

if (empty($events)) {
    api_error('No events provided.', 400);
}

if (count($events) > 500) {
    api_error('Too many events. Max 500 per batch.', 400);
}

// ホモサピエンス（撮影者自身）として誤検出される大分類を除外
const EXCLUDED_HIGHER_GROUPS = ['哺乳類', 'Mammal', '人間', 'Human', 'Person', 'People'];

// イベントバリデーション
$validEvents = [];
$qaFiltered = ['invalid_format' => 0, 'low_confidence' => 0, 'excluded_taxon' => 0];
foreach ($events as $i => $event) {
    if (empty($event['type']) || empty($event['taxon_name'])) { $qaFiltered['invalid_format']++; continue; }
    if (!in_array($event['type'], ['audio', 'visual', 'sensor'], true)) { $qaFiltered['invalid_format']++; continue; }
    if ((float)($event['confidence'] ?? 0) < 0.20) { $qaFiltered['low_confidence']++; continue; }
    // 哺乳類大分類は除外（ほぼ撮影者本人のホモサピエンス誤検出）
    if (in_array(trim($event['taxon_name']), EXCLUDED_HIGHER_GROUPS, true)) { $qaFiltered['excluded_taxon']++; continue; }

    $validEvents[] = [
        'type'               => $event['type'],
        'taxon_name'         => trim($event['taxon_name']),
        'scientific_name'    => trim($event['scientific_name'] ?? ''),
        'taxon_key'          => $event['taxon_key'] ?? null,
        'confidence'         => max(0.0, min(1.0, (float) ($event['confidence'] ?? 0))),
        'lat'                => isset($event['lat']) ? (float) $event['lat'] : null,
        'lng'                => isset($event['lng']) ? (float) $event['lng'] : null,
        'timestamp'          => $event['timestamp'] ?? date('c'),
        'model'              => $event['model'] ?? 'unknown',
        'audio_snippet_hash' => $event['audio_snippet_hash'] ?? null,
        'audio_evidence_path' => $event['audio_evidence_path'] ?? null,
        'photo_ref'          => $event['photo_ref'] ?? null,
        'environment_snapshot' => $event['environment_snapshot'] ?? null,
        'frame_ref'          => $event['frame_ref'] ?? null,
        'speed_kmh'          => isset($event['speed_kmh']) ? (float) $event['speed_kmh'] : null,
        'ai_version'         => $event['ai_version'] ?? null,
        'taxonomic_class'    => $event['taxonomic_class'] ?? null,
        'taxonomic_order'    => $event['taxonomic_order'] ?? null,
        'taxon_rank'         => $event['taxon_rank'] ?? 'species',
        'engine_source'      => $event['engine'] ?? 'unknown',
        'engine_conflict'    => !empty($event['engine_conflict']),
    ];
}

if (empty($validEvents)) {
    api_error('No valid events after validation.', 400);
}

// 地理妥当性フィルタ（日本固定: FieldScanは日本向けツール）
$geoImplausibleCount = 0;
$validEvents = array_values(array_filter($validEvents, function($ev) use (&$geoImplausibleCount) {
    $geo = GeoPlausibility::assess($ev, ['country' => 'japan']);
    if ($geo['status'] === 'implausible') {
        $geoImplausibleCount++;
        return false;
    }
    return true;
}));

// パッシブ観察エンジンで処理
$result = PassiveObservationEngine::processEventBatch($validEvents, $userId, $sessionMeta);

$scanMode = $sessionMeta['scan_mode'] ?? 'walk';
$isLiveScan = ($scanMode === 'live-scan');
$isIncremental = !empty($sessionMeta['is_incremental']);
$isFinal = !empty($sessionMeta['is_final']);
$clientSessionId = $sessionMeta['session_id_client'] ?? null;

// ─── 増分バッチ: client_session_id で論理統合 ───
$existingSessionLog = null;
$mergedSessionId = $result['session_id'];
if ($clientSessionId && $isIncremental) {
    // 全件ロードを避け、パーティションを逆順で探索（最新バッチは直近月にある）
    $found = false;
    $partitions = glob(DATA_DIR . 'passive_sessions/????-??.json');
    rsort($partitions);
    foreach ($partitions as $partFile) {
        $sessions = json_decode(file_get_contents($partFile), true) ?: [];
        foreach (array_reverse($sessions) as $s) {
            if (($s['client_session_id'] ?? '') === $clientSessionId) {
                $existingSessionLog = $s;
                $mergedSessionId = $s['session_id'] ?? $mergedSessionId;
                $found = true;
                break 2;
            }
        }
    }
}

// ─── Canonical Schema: 1セッション = 1 parent event ───
$parentEventId = null;
$savedCount = 0;

try {
    $lats = array_filter(array_column($result['observations'], 'lat'), fn($v) => $v !== null && $v !== 0.0);
    $lngs = array_filter(array_column($result['observations'], 'lng'), fn($v) => $v !== null && $v !== 0.0);
    $centerLat = !empty($lats) ? array_sum($lats) / count($lats) : null;
    $centerLng = !empty($lngs) ? array_sum($lngs) / count($lngs) : null;

    $samplingEffort = [
        'duration_sec'  => (int) ($sessionMeta['duration_sec'] ?? 0),
        'distance_m'    => (float) ($sessionMeta['distance_m'] ?? 0),
        'route_polyline' => $sessionMeta['route_polyline'] ?? null,
        'env_history'   => !empty($envHistory) ? $envHistory : null,
    ];

    if ($canonicalPolicy['enabled']) {
        $parentEventId = CanonicalStore::createEvent([
            'event_date'              => date('c'),
            'decimal_latitude'        => $centerLat,
            'decimal_longitude'       => $centerLng,
            'sampling_protocol'       => $isLiveScan ? 'live-scan' : 'walk-audio',
            'sampling_effort'         => $samplingEffort,
            'capture_device'          => $sessionMeta['device'] ?? null,
            'recorded_by'             => $userId,
            'session_mode'            => $sessionMeta['scan_mode'] ?? $scanMode,
            'complete_checklist_flag' => (int) ($sessionMeta['complete_checklist'] ?? 0),
            'target_taxa_scope'       => $sessionMeta['target_taxa_scope'] ?? null,
            'movement_mode'           => $sessionMeta['movement_mode'] ?? null,
            'movement_mode_log'       => $sessionMeta['movement_mode_log'] ?? null,
            'route_hash'              => $sessionMeta['route_hash'] ?? null,
        ]);
    }
} catch (Exception $e) {
    error_log('[passive_event] Session event creation error: ' . $e->getMessage());
}

// 逆ジオコーディング（セッション重心で1回だけ実行、全obs共有）
$sessionGeo = null;
{
    $firstObs = $result['observations'][0] ?? [];
    $geoLat = (float)($firstObs['lat'] ?? $centerLat ?? 0);
    $geoLng = (float)($firstObs['lng'] ?? $centerLng ?? 0);
    if ($geoLat != 0 && $geoLng != 0) {
        $sessionGeo = GeoUtils::reverseGeocode($geoLat, $geoLng);
    } else {
        $sessionGeo = ['municipality' => '', 'prefecture' => '', 'country' => ''];
    }
}

foreach ($result['observations'] as $obs) {
    // プライバシーフィルタ（保護種チェック）
    if (!empty($obs['taxon']['scientific_name']) && class_exists('PrivacyFilter')) {
        if (PrivacyFilter::isProtectedSpecies($obs['taxon']['scientific_name'])) {
            $obs['privacy_layer'] = PrivacyFilter::LAYER_PRIVATE;
        }
    }

    $obs['user_name'] = $userName;
    $obs['user_avatar'] = $userAvatar;
    $obs['observation_source'] = $scanMode;
    // record_source: 3ソースを完全に区別するフィールド
    //   'fieldscan'    → Android APK (install_id 認証)
    //   'ikimon_sensor' → ブラウザ版AIレンズ (session 認証)
    $obs['record_source'] = isset($installId) ? 'fieldscan' : 'ikimon_sensor';

    if (!empty($sessionGeo['municipality'])) {
        $obs['municipality'] = $sessionGeo['municipality'];
    }

    // フィード用 DataStore に保存（ウォーク・ライブスキャン両方）
    $obs['passive_session_id'] = $mergedSessionId;

    // メッシュコード付与（プライバシー保護 + 大量データ集計用）
    $obsLat = (float)($obs['lat'] ?? $obs['location']['lat'] ?? 0);
    $obsLng = (float)($obs['lng'] ?? $obs['location']['lng'] ?? 0);
    if ($obsLat && $obsLng) {
        $meshInfo = MeshCode::fromLatLng($obsLat, $obsLng);
        $obs['mesh_code3'] = $meshInfo['mesh3'];
        $obs['mesh_code4'] = $meshInfo['mesh4'];
    }

    // higher_group: イベントの type が audio = 鳥類確定、visual = Gemini が返した値を使う
    if (empty($obs['higher_group'])) {
        $obs['higher_group'] = MeshAggregator::inferHigherGroup($obs);
    }

    DataStore::append('observations', $obs);

    // メッシュ集計を差分更新（ノーブロッキング・失敗しても観察保存に影響しない）
    try {
        MeshAggregator::addObservation($obs);
    } catch (Throwable $e) {
        error_log('[passive_event] MeshAggregator error: ' . $e->getMessage());
    }

    // 全モード → Canonical Schema（デジタルツインに蓄積）
    if ($parentEventId && $canonicalPolicy['enabled']) {
        try {
            // 検出時点の環境スナップショットを sampling_effort に格納
            $envSnap = $obs['environment_snapshot'] ?? null;
            $childEffort = null;
            if ($envSnap) {
                $childEffort = json_encode(['environment' => $envSnap], JSON_UNESCAPED_UNICODE);
            }

            // 個別検出の child event（精密な位置・時刻を持つ）
            $childEventId = CanonicalStore::createEvent([
                'parent_event_id'  => $parentEventId,
                'event_date'       => $obs['observed_at'] ?? date('c'),
                'decimal_latitude' => $obs['lat'] ?? null,
                'decimal_longitude'=> $obs['lng'] ?? null,
                'sampling_protocol'=> $isLiveScan ? 'live-scan' : 'walk-audio',
                'sampling_effort'  => $childEffort,
                'recorded_by'      => $userId,
                'capture_device'   => $sessionMeta['device'] ?? null,
                'session_mode'     => $sessionMeta['scan_mode'] ?? $scanMode,
                'coordinate_uncertainty_m' => $obs['gps_accuracy'] ?? null,
            ]);

            $confContext = [];
            if ($envSnap) {
                $confContext['environment_at_detection'] = $envSnap;
            }
            $frameRef = $obs['photo_ref'] ?? null;
            if ($frameRef) {
                $confContext['frame_ref'] = $frameRef;
            }
            if (empty($confContext)) $confContext = null;

            CanonicalStore::createOccurrence([
                'event_id'            => $childEventId,
                'scientific_name'     => $obs['taxon']['scientific_name'] ?? null,
                'vernacular_name'     => $obs['taxon']['name'] ?? $obs['species_name'] ?? null,
                'basis_of_record'     => 'MachineObservation',
                'evidence_tier'       => $frameRef ? 2 : 1,
                'observation_source'  => $scanMode,
                'detection_confidence'=> $obs['detection_confidence'] ?? null,
                'confidence_context'  => $confContext,
                'detection_model'     => $obs['detection_model'] ?? null,
                'original_observation_id' => $obs['id'] ?? null,
                'occurrence_status'   => 'present',
                'speed_kmh'           => $obs['speed_kmh'] ?? null,
                'ai_version'          => $obs['ai_version'] ?? null,
            ]);
            $savedCount++;
        } catch (Exception $e) {
            error_log('[passive_event] Canonical occurrence error: ' . $e->getMessage());
        }
    }
}

// 検出ゼロでもセッション event は残す（不在データ = 努力したが見つからなかった記録）
if ($savedCount === 0 && $parentEventId && $canonicalPolicy['enabled']) {
    try {
        CanonicalStore::createOccurrence([
            'event_id'           => $parentEventId,
            'basis_of_record'    => 'MachineObservation',
            'evidence_tier'      => 0,
            'observation_source' => $scanMode,
            'occurrence_status'  => 'absent',
        ]);
    } catch (Exception $e) {
        error_log('[passive_event] Absence record error: ' . $e->getMessage());
    }
    error_log('[passive_event] Zero detections session recorded as absence data: ' . $parentEventId);
}

// セッションログを保存（バッチごとにレコード追加、client_session_id で論理統合）
$sessionLog = [
    'id' => 'ps_' . bin2hex(random_bytes(6)),
    'session_id' => $mergedSessionId,
    'client_session_id' => $clientSessionId,
    'user_id' => $userId,
    'scan_mode' => $scanMode,
    'events_received' => count($events),
    'events_valid' => count($validEvents),
    'observations_created' => $savedCount,
    'summary' => $result['summary'],
    'session_meta' => $sessionMeta,
    'env_observation_count' => count($envHistory),
    'is_incremental' => $isIncremental,
    'is_final' => $isFinal,
    'batch_index' => $existingSessionLog ? (($existingSessionLog['batch_index'] ?? 0) + 1) : 0,
    'started_at' => $existingSessionLog ? ($existingSessionLog['started_at'] ?? date('c')) : date('c'),
    'ended_at' => $isFinal ? date('c') : null,
    'canonical_policy' => $canonicalPolicy,
    'created_at' => date('c'),
];
DataStore::append('passive_sessions', $sessionLog);

// 環境観測ログを独立保存（100年後の環境変化追跡用）
if (!empty($envHistory)) {
    $envLog = [
        'session_id' => $result['session_id'],
        'canonical_event_id' => $parentEventId,
        'user_id' => $userId,
        'center_lat' => $centerLat,
        'center_lng' => $centerLng,
        'municipality' => $sessionGeo['municipality'] ?? '',
        'prefecture' => $sessionGeo['prefecture'] ?? '',
        'scan_date' => date('Y-m-d'),
        'duration_sec' => (int) ($sessionMeta['duration_sec'] ?? 0),
        'observations' => $envHistory,
        'observation_count' => count($envHistory),
        'created_at' => date('c'),
    ];
    DataStore::append('environment_logs', $envLog);
}

// スキャンクエスト生成（拡張: 検出メタデータを種別に集約）
$scanQuests = [];
$questShown = false;
if ($isLiveScan && !empty($result['summary']['species'])) {
    require_once ROOT_DIR . '/libs/QuestManager.php';

    $speciesDetail = [];
    foreach ($validEvents as $ev) {
        $name = $ev['taxon_name'] ?? '';
        if (empty($name)) continue;
        if (!isset($speciesDetail[$name])) {
            $speciesDetail[$name] = [
                'count' => 0,
                'scientific_name' => $ev['scientific_name'] ?? '',
                'max_confidence' => 0,
                'category' => $ev['category'] ?? '',
                'source' => $ev['type'] ?? 'visual',
            ];
        }
        $speciesDetail[$name]['count']++;
        $speciesDetail[$name]['max_confidence'] = max(
            $speciesDetail[$name]['max_confidence'],
            (float)($ev['confidence'] ?? 0)
        );
    }

    $extendedSummary = $result['summary'];
    $extendedSummary['species_detail'] = $speciesDetail;

    $questSessionMeta = array_merge($sessionMeta, [
        'session_id' => $result['session_id'],
        'center_lat' => $centerLat,
        'center_lng' => $centerLng,
    ]);
    $scanQuests = QuestManager::generateFromScan($userId, $extendedSummary, $questSessionMeta);
    QuestManager::saveScanQuests($userId, $scanQuests);
    $questShown = !empty($scanQuests);

    foreach ($scanQuests as $sq) {
        QuestManager::publishCommunitySignal($userId, $sq, $centerLat, $centerLng);
    }
}

api_success([
    'session_id' => $mergedSessionId,
    'observations_created' => $savedCount,
    'summary' => $result['summary'],
    'scan_quests' => $scanQuests,
    'quest_shown' => $questShown,
    'is_incremental' => $isIncremental,
    'qa_summary' => [
        'events_received'           => count($events),
        'events_valid'              => count($validEvents),
        'filtered_invalid_format'   => $qaFiltered['invalid_format'],
        'filtered_low_confidence'   => $qaFiltered['low_confidence'],
        'filtered_excluded_taxon'   => $qaFiltered['excluded_taxon'],
        'filtered_geo_implausible'  => $geoImplausibleCount,
        'observations_created'      => $savedCount,
        'session_intent'            => $qaSessionIntent,
        'official_record'           => (bool) $qaOfficialRecord,
        'test_profile'              => $qaTestProfile,
        'canonical_enabled'         => (bool) $canonicalPolicy['enabled'],
        'canonical_skip_reason'     => $canonicalPolicy['reason'],
    ],
], [
    'events_received' => count($events),
    'events_valid' => count($validEvents),
    'batch_merged' => $existingSessionLog !== null,
    'canonical' => $canonicalPolicy,
]);
