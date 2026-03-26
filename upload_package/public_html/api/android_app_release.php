<?php
require_once __DIR__ . '/../../config/config.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$payload = [
    'versionCode' => 3,
    'versionName' => '0.1.2',
    'apkUrl' => BASE_URL . '/assets/apk/ikimon-shell-v0.1.2-debug.apk',
    'downloadPageUrl' => BASE_URL . '/android-app.php',
    'notes' => [
        'Googleログインを外部ブラウザ経由に修正',
        '画像選択をPhoto Pickerからギャラリー経路へ変更',
        '既存写真のGPS EXIF取得改善を試験中',
    ],
    'publishedAt' => '2026-03-21T19:23:00+09:00',
];

echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
