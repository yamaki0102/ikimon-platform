<?php
$html = @file_get_contents('https://ikimon.life/api/generate_site_report.php?site_id=aikan_hq');
if (!$html) {
    echo "FAIL\n";
    exit(1);
}

$checks = ['ゲンジボタル' => 0, 'メダカ' => 0, 'BIS' => 0, 'rl-badge' => 0, '昆虫類' => 0];
foreach ($checks as $k => &$v) {
    $v = str_contains($html, $k) ? 'OK' : 'NG';
}
echo implode(' | ', array_map(fn($k, $v) => "$k:$v", array_keys($checks), $checks)) . "\n";

preg_match('/class="bis-score">(\d+\.?\d*)/', $html, $m);
echo "BIS=" . ($m[1] ?? '?') . "\n";
echo "SIZE=" . strlen($html) . "\n";
