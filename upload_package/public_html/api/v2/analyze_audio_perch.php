<?php
/**
 * analyze_audio_perch.php — Dual-Engine 音声分析ブリッジ (Perch v2 + BirdNET)
 *
 * ブラウザから音声スニペットを受け取り、VPS上の Perch v2 と BirdNET に並列転送。
 * 両エンジンの結果をマージして精度向上。
 *
 * POST /api/v2/analyze_audio_perch.php
 *   - audio: 音声ファイル (webm/mp4/wav, max 5MB)
 *   - lat: 緯度 (float)
 *   - lng: 経度 (float)
 *
 * レスポンス:
 *   { success: true, data: { detections: [{scientific_name, common_name, japanese_name, confidence, engine, engines}] } }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/BioUtils.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('Method not allowed', 405);
}

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Unauthorized', 401);
}

if (!api_rate_limit('analyze_audio_perch', 20, 60)) {
    api_error('Rate limit exceeded', 429);
}

if (!isset($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
    api_error('No audio file', 400);
}

$file = $_FILES['audio'];
if ($file['size'] > 5 * 1024 * 1024) {
    api_error('Audio too large (max 5MB)', 413);
}

$lat = (float)($_POST['lat'] ?? 35.0);
$lng = (float)($_POST['lng'] ?? 139.0);
$minConf = 0.1;

$merged = _dualEngineClassify($file['tmp_name'], $file['type'] ?: 'audio/webm', $file['name'] ?: 'audio.webm', $lat, $lng, $minConf);

api_success($merged);

// ---------------------------------------------------------------------------
// Dual-engine parallel execution
// ---------------------------------------------------------------------------

function _dualEngineClassify(string $audioPath, string $mimeType, string $fileName, float $lat, float $lng, float $minConf): array
{
    $mh = curl_multi_init();

    // Perch v2
    $ch_perch = curl_init();
    $perchFile = new CURLFile($audioPath, $mimeType, $fileName);
    curl_setopt_array($ch_perch, [
        CURLOPT_URL            => 'http://127.0.0.1:8765/classify',
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => ['file' => $perchFile, 'lat' => $lat, 'lng' => $lng],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_CONNECTTIMEOUT => 2,
    ]);

    // BirdNET
    $ch_birdnet = curl_init();
    $birdnetFile = new CURLFile($audioPath, $mimeType, $fileName);
    curl_setopt_array($ch_birdnet, [
        CURLOPT_URL            => 'http://127.0.0.1:8100/analyze',
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => ['audio' => $birdnetFile, 'lat' => $lat, 'lng' => $lng, 'min_conf' => $minConf],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_CONNECTTIMEOUT => 2,
    ]);

    curl_multi_add_handle($mh, $ch_perch);
    curl_multi_add_handle($mh, $ch_birdnet);

    do {
        $status = curl_multi_exec($mh, $running);
        if ($running) {
            curl_multi_select($mh, 0.1);
        }
    } while ($running > 0 && $status === CURLM_OK);

    $perchBody     = curl_multi_getcontent($ch_perch);
    $perchHttp     = curl_getinfo($ch_perch, CURLINFO_HTTP_CODE);
    $perchErr      = curl_error($ch_perch);

    $birdnetBody   = curl_multi_getcontent($ch_birdnet);
    $birdnetHttp   = curl_getinfo($ch_birdnet, CURLINFO_HTTP_CODE);
    $birdnetErr    = curl_error($ch_birdnet);

    curl_multi_remove_handle($mh, $ch_perch);
    curl_multi_remove_handle($mh, $ch_birdnet);
    curl_close($ch_perch);
    curl_close($ch_birdnet);
    curl_multi_close($mh);

    $perchResult   = _parsePerchResponse($perchBody, $perchHttp);
    $birdnetResult = _parseBirdnetResponse($birdnetBody, $birdnetHttp);

    $enginesUsed = [];
    if (!empty($perchResult))   $enginesUsed[] = 'perch_v2';
    if (!empty($birdnetResult)) $enginesUsed[] = 'birdnet_v3';

    if (empty($enginesUsed)) {
        $enginesUsed[] = 'none';
    }

    $merged = _mergeResults($perchResult, $birdnetResult, $minConf);

    $segmentsAnalyzed = 0;
    if ($perchBody) {
        $decoded = json_decode($perchBody, true);
        $segmentsAnalyzed = is_array($decoded['results'] ?? null) ? count($decoded['results']) : 0;
    }

    return [
        'detections'        => $merged,
        'engine'            => count($enginesUsed) > 1 ? 'dual' : ($enginesUsed[0] ?? 'none'),
        'engines_used'      => $enginesUsed,
        'segments_analyzed' => $segmentsAnalyzed,
    ];
}

// ---------------------------------------------------------------------------
// Parse Perch v2 response
// ---------------------------------------------------------------------------

function _parsePerchResponse(?string $body, int $httpCode): array
{
    if ($body === null || $body === false || $body === '' || $httpCode !== 200) {
        return [];
    }

    $result = json_decode($body, true);
    if (!is_array($result) || !isset($result['results'])) {
        return [];
    }

    $detections = [];
    foreach ($result['results'] as $segment) {
        foreach ($segment['predictions'] ?? [] as $pred) {
            $conf = (float)($pred['confidence'] ?? 0);
            if ($conf < 0.1) continue;

            $sciName = $pred['species'] ?? '';
            $commonName = $pred['common_name'] ?? $sciName;
            $jaName = $pred['japanese_name'] ?? null;

            if ($jaName === null && $sciName !== '') {
                $resolved = BioUtils::resolveJaName($sciName);
                $jaName = ($resolved !== $sciName) ? $resolved : null;
            }

            $detections[] = [
                'scientific_name' => $sciName,
                'common_name'     => $commonName,
                'japanese_name'   => $jaName,
                'confidence'      => $conf,
                'engine'          => 'perch_v2',
            ];
        }
    }

    return $detections;
}

// ---------------------------------------------------------------------------
// Parse BirdNET response
// ---------------------------------------------------------------------------

function _parseBirdnetResponse(?string $body, int $httpCode): array
{
    if ($body === null || $body === false || $body === '' || $httpCode !== 200) {
        return [];
    }

    $result = json_decode($body, true);
    if (!is_array($result)) {
        return [];
    }

    $rawDetections = $result['detections'] ?? $result['results'] ?? [];
    if (!is_array($rawDetections)) {
        return [];
    }

    $detections = [];
    foreach ($rawDetections as $det) {
        $conf = (float)($det['confidence'] ?? 0);
        if ($conf < 0.1) continue;

        $sciName = $det['scientific_name'] ?? $det['species'] ?? '';
        $commonName = $det['common_name'] ?? $sciName;
        $jaName = $det['japanese_name'] ?? null;

        if ($jaName === null && $sciName !== '') {
            $resolved = BioUtils::resolveJaName($sciName);
            $jaName = ($resolved !== $sciName) ? $resolved : null;
        }
        if ($jaName === null && $commonName !== '' && $commonName !== $sciName) {
            $resolved = BioUtils::resolveJaName($commonName);
            $jaName = ($resolved !== $commonName) ? $resolved : null;
        }

        $detections[] = [
            'scientific_name' => $sciName,
            'common_name'     => $commonName,
            'japanese_name'   => $jaName,
            'confidence'      => $conf,
            'engine'          => 'birdnet_v3',
        ];
    }

    return $detections;
}

// ---------------------------------------------------------------------------
// Merge results from both engines
// ---------------------------------------------------------------------------

function _mergeResults(array $perchResults, array $birdnetResults, float $minConf = 0.1): array
{
    $perchBySci   = [];
    foreach ($perchResults as $d) {
        $key = strtolower(trim($d['scientific_name']));
        if ($key === '') continue;
        if (!isset($perchBySci[$key]) || $d['confidence'] > $perchBySci[$key]['confidence']) {
            $perchBySci[$key] = $d;
        }
    }

    $birdnetBySci = [];
    foreach ($birdnetResults as $d) {
        $key = strtolower(trim($d['scientific_name']));
        if ($key === '') continue;
        if (!isset($birdnetBySci[$key]) || $d['confidence'] > $birdnetBySci[$key]['confidence']) {
            $birdnetBySci[$key] = $d;
        }
    }

    $allKeys = array_unique(array_merge(array_keys($perchBySci), array_keys($birdnetBySci)));
    $merged = [];

    foreach ($allKeys as $key) {
        $inPerch   = isset($perchBySci[$key]);
        $inBirdnet = isset($birdnetBySci[$key]);

        $engines = [];

        if ($inPerch && $inBirdnet) {
            $p = $perchBySci[$key];
            $b = $birdnetBySci[$key];

            $engines[] = ['engine' => 'perch_v2',   'confidence' => $p['confidence'], 'scientific_name' => $p['scientific_name']];
            $engines[] = ['engine' => 'birdnet_v3', 'confidence' => $b['confidence'], 'scientific_name' => $b['scientific_name']];

            $boosted = min(max($p['confidence'], $b['confidence']) + 0.1, 0.99);

            $base = ($p['confidence'] >= $b['confidence']) ? $p : $b;
            $merged[] = [
                'scientific_name' => $base['scientific_name'],
                'common_name'     => $base['common_name'],
                'japanese_name'   => $base['japanese_name'] ?? $p['japanese_name'] ?? $b['japanese_name'] ?? null,
                'confidence'      => round($boosted, 4),
                'engine'          => 'dual_agree',
                'engines'         => $engines,
            ];
        } elseif ($inPerch) {
            $p = $perchBySci[$key];
            $engines[] = ['engine' => 'perch_v2', 'confidence' => $p['confidence'], 'scientific_name' => $p['scientific_name']];
            $merged[] = [
                'scientific_name' => $p['scientific_name'],
                'common_name'     => $p['common_name'],
                'japanese_name'   => $p['japanese_name'],
                'confidence'      => $p['confidence'],
                'engine'          => 'perch_v2',
                'engines'         => $engines,
            ];
        } else {
            $b = $birdnetBySci[$key];
            $engines[] = ['engine' => 'birdnet_v3', 'confidence' => $b['confidence'], 'scientific_name' => $b['scientific_name']];
            $merged[] = [
                'scientific_name' => $b['scientific_name'],
                'common_name'     => $b['common_name'],
                'japanese_name'   => $b['japanese_name'],
                'confidence'      => $b['confidence'],
                'engine'          => 'birdnet_v3',
                'engines'         => $engines,
            ];
        }
    }

    usort($merged, fn($a, $b) => $b['confidence'] <=> $a['confidence']);

    $merged = array_filter($merged, fn($d) => $d['confidence'] >= $minConf);

    return array_values(array_slice($merged, 0, 5));
}
