<?php
/**
 * EXIF Debug Logger — ベータ期間中のみ使用
 * クライアントのEXIF抽出結果をログファイルに記録
 */
require_once __DIR__ . '/../../config/config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['ok' => false]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    echo json_encode(['ok' => false]);
    exit;
}

$logEntry = [
    'timestamp' => date('Y-m-d H:i:s'),
    'ip' => substr($_SERVER['REMOTE_ADDR'] ?? '', 0, 15),
    'file_type' => $input['file_type'] ?? '',
    'file_size' => $input['file_size'] ?? 0,
    'file_name' => substr($input['file_name'] ?? '', 0, 100),
    'exif_lat' => $input['exif_lat'],
    'exif_lng' => $input['exif_lng'],
    'exif_date' => $input['exif_date'] ?? null,
    'orientation' => $input['orientation'] ?? null,
    'location_source' => $input['location_source'] ?? '',
    'device_gps' => $input['device_gps'] ?? null,
    'ua' => substr($input['ua'] ?? '', 0, 200),
];

$logFile = DATA_DIR . '/exif_debug.log';
file_put_contents($logFile, json_encode($logEntry, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);

echo json_encode(['ok' => true]);
