<?php
/**
 * nature_score.php — 自然浴スコア API
 *
 * セッションデータから「自然浴スコア」(0-10) を算出。
 * 種の多様性 × 音風景の質 × 環境の自然度
 *
 * POST JSON:
 *   species_count: int
 *   duration_sec: int
 *   distance_m: int
 *   area_type: string (forest|park|river|urban|unknown)
 *   acoustic_ndsi: float|null  (BioScan のみ。Web は null)
 *   detections: array           (optional)
 *
 * Response:
 *   { success: true, data: { score, breakdown: {diversity, soundscape, environment}, message } }
 */

require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_success(['success' => false, 'error' => 'POST required'], 405);
}

$body = json_decode(file_get_contents('php://input'), true) ?: [];

$speciesCount = (int)($body['species_count'] ?? 0);
$durationSec  = (int)($body['duration_sec'] ?? 0);
$distanceM    = (int)($body['distance_m'] ?? 0);
$areaType     = $body['area_type'] ?? 'unknown';
$acousticNdsi = isset($body['acoustic_ndsi']) ? (float)$body['acoustic_ndsi'] : null;

// --- 1. 種の多様性スコア (0-10) ---
// 30分で10種 = 十分に豊か = 10点
// 比例換算 + 時間補正
$minutesFactor = max(1, $durationSec / 60);
$speciesRate = $speciesCount / $minutesFactor * 30; // 30分換算の種数
$diversityScore = min(10, $speciesRate);

// --- 2. 音風景スコア (0-10) ---
if ($acousticNdsi !== null) {
    // BioScan: NDSI 実測値 (-1 to 1 → 0 to 10)
    $soundscapeScore = min(10, max(0, ($acousticNdsi + 1) * 5));
} else {
    // Web版: area_type から推定
    $soundscapeEstimates = [
        'forest' => 8.0,
        'park'   => 6.0,
        'river'  => 7.0,
        'urban'  => 3.0,
        'unknown'=> 5.0,
    ];
    $soundscapeScore = $soundscapeEstimates[$areaType] ?? 5.0;
}

// --- 3. 環境の自然度スコア (0-10) ---
$environmentEstimates = [
    'forest' => 9.0,
    'park'   => 7.0,
    'river'  => 8.0,
    'urban'  => 3.0,
    'unknown'=> 5.0,
];
$environmentScore = $environmentEstimates[$areaType] ?? 5.0;

// --- 総合スコア ---
$totalScore = round(
    $diversityScore * 0.4 +
    $soundscapeScore * 0.3 +
    $environmentScore * 0.3,
    1
);

// --- メッセージ ---
$messages = [
    [9, '最高の自然浴でした！'],
    [7, '豊かな自然を楽しめたさんぽでした'],
    [5, 'いい散歩でしたね。次はもう少し緑の多い場所も試してみて'],
    [3, '街なかでも発見がありましたね'],
    [0, '短い散歩でも立派な記録です'],
];
$message = '記録ありがとう';
foreach ($messages as [$threshold, $msg]) {
    if ($totalScore >= $threshold) {
        $message = $msg;
        break;
    }
}

api_success([
    'score' => $totalScore,
    'breakdown' => [
        'diversity'   => round($diversityScore, 1),
        'soundscape'  => round($soundscapeScore, 1),
        'environment' => round($environmentScore, 1),
    ],
    'message' => $message,
    'species_rate_per_30min' => round($speciesRate, 1),
]);
