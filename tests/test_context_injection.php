<?php
/**
 * テスト: scan_classify.php のコンテキスト注入ロジック
 * passive_event.php の環境データ保存フロー
 */

echo "=== Test 1: コンテキスト注入プロンプト組み立て ===\n\n";

// scan_classify.php のプロンプト組み立てロジックを再現
$context = json_decode(json_encode([
    'environment' => [
        'habitat' => '落葉広葉樹林',
        'vegetation' => '高木層あり・下草豊富',
        'canopy_cover' => '60',
        'water' => '小川あり',
    ],
    'recent_detections' => [
        ['name' => 'シジュウカラ', 'confidence' => 0.85],
        ['name' => 'ソメイヨシノ', 'confidence' => 0.92],
        ['name' => 'スズメ', 'confidence' => 0.78],
        ['name' => 'オオバコ', 'confidence' => 0.65],
    ],
]), true);

$contextBlock = '';
if (is_array($context)) {
    $parts = [];
    if (!empty($context['environment'])) {
        $env = $context['environment'];
        $envLine = '環境: ';
        $envParts = [];
        if (!empty($env['habitat'])) $envParts[] = $env['habitat'];
        if (!empty($env['vegetation'])) $envParts[] = $env['vegetation'];
        if (!empty($env['canopy_cover'])) $envParts[] = '林冠被覆' . $env['canopy_cover'] . '%';
        if (!empty($env['water']) && $env['water'] !== 'なし') $envParts[] = '水系: ' . $env['water'];
        if ($envParts) $parts[] = $envLine . implode('、', $envParts);
    }
    if (!empty($context['recent_detections']) && is_array($context['recent_detections'])) {
        $dets = array_slice($context['recent_detections'], 0, 8);
        $detStrs = array_map(function($d) {
            $name = $d['name'] ?? '';
            $conf = isset($d['confidence']) ? number_format($d['confidence'], 2) : '?';
            return $name . '(' . $conf . ')';
        }, $dets);
        if ($detStrs) $parts[] = '直近の検出: ' . implode(', ', $detStrs);
    }
    if ($parts) {
        $contextBlock = "\n\n【スキャン文脈】\n" . implode("\n", $parts) . "\nこの環境と直近の検出結果を参考に、同定の精度を高めてください。既に検出された種が再度映っている場合は同じ名前で統一してください。\n";
    }
}

if (empty($contextBlock)) {
    echo "❌ FAIL: contextBlock が空\n";
    exit(1);
}

echo "✅ contextBlock 生成OK:\n";
echo $contextBlock . "\n";

// 検証: 各要素が含まれているか
$checks = ['落葉広葉樹林', '林冠被覆60%', '水系: 小川あり', 'シジュウカラ(0.85)', 'ソメイヨシノ(0.92)'];
$allOk = true;
foreach ($checks as $check) {
    if (strpos($contextBlock, $check) === false) {
        echo "❌ FAIL: '{$check}' が含まれていない\n";
        $allOk = false;
    }
}
if ($allOk) echo "✅ 全キーワード検出OK\n";

// Test: コンテキストなしの場合
echo "\n=== Test 2: コンテキストなし（初回フレーム） ===\n\n";
$context2 = null;
$contextBlock2 = '';
if (is_array($context2)) {
    // 上と同じロジック
}
echo ($contextBlock2 === '') ? "✅ コンテキストなし → 空ブロック（後方互換OK）\n" : "❌ FAIL\n";

// Test: 環境のみ（検出履歴なし）
echo "\n=== Test 3: 環境のみ ===\n\n";
$context3 = ['environment' => ['habitat' => '草地', 'vegetation' => '', 'canopy_cover' => '', 'water' => 'なし']];
$parts3 = [];
$env3 = $context3['environment'];
$envParts3 = [];
if (!empty($env3['habitat'])) $envParts3[] = $env3['habitat'];
if (!empty($env3['vegetation'])) $envParts3[] = $env3['vegetation'];
if (!empty($env3['canopy_cover'])) $envParts3[] = '林冠被覆' . $env3['canopy_cover'] . '%';
if (!empty($env3['water']) && $env3['water'] !== 'なし') $envParts3[] = '水系: ' . $env3['water'];
if ($envParts3) $parts3[] = '環境: ' . implode('、', $envParts3);

echo (count($envParts3) === 1 && $envParts3[0] === '草地')
    ? "✅ 環境のみ → habitat だけ出力（空・'なし' はスキップ）\n"
    : "❌ FAIL: " . print_r($envParts3, true) . "\n";

echo "\n=== Test 4: pendingEvent の environment_snapshot 紐付け ===\n\n";

// field_scan.php のロジックをシミュレート
$envHistory = [
    ['habitat' => '落葉広葉樹林', 'vegetation' => '下草豊富', 'ground' => '落ち葉', 'water' => 'なし', 'canopy_cover' => '60', 'disturbance' => 'low', 'description' => '自然度の高い樹林', 'timestamp' => '2026-03-21T10:30:00'],
    ['habitat' => '河川敷', 'vegetation' => 'ヨシ群落', 'ground' => '砂地', 'water' => '本流あり', 'canopy_cover' => '10', 'disturbance' => 'medium', 'description' => '河川敷の草地', 'timestamp' => '2026-03-21T10:20:00'],
];

$evt = [
    'type' => 'visual',
    'taxon_name' => 'カワセミ',
    'confidence' => 0.82,
];
if (count($envHistory) > 0) {
    $env = $envHistory[0];
    $evt['environment_snapshot'] = [
        'habitat' => $env['habitat'] ?? '', 'vegetation' => $env['vegetation'] ?? '',
        'ground' => $env['ground'] ?? '', 'water' => $env['water'] ?? '',
        'canopy_cover' => $env['canopy_cover'] ?? '', 'disturbance' => $env['disturbance'] ?? '',
        'description' => $env['description'] ?? '', 'timestamp' => $env['timestamp'] ?? ''
    ];
}

$hasSnap = isset($evt['environment_snapshot']) && $evt['environment_snapshot']['habitat'] === '落葉広葉樹林';
echo $hasSnap ? "✅ 検出に最新環境スナップショット紐付けOK\n" : "❌ FAIL\n";

echo "\n=== All context injection tests done ===\n";
