<?php

/**
 * B2B LP マルチユーザー E2E テスト
 * 
 * 5ペルソナがそれぞれ異なるユーザージャーニーで全ページを巡回。
 * リンク整合性、レスポンスコード、コンテンツ検証、レポートAPI動作を包括テスト。
 * 
 * Usage: php tests/e2e_b2b_lp_test.php [local|prod]
 */

$env = ($argv[1] ?? 'prod') === 'local' ? 'local' : 'prod';
$baseUrl = $env === 'local' ? 'http://localhost:8899' : 'https://ikimon.life';

echo "╔══════════════════════════════════════════════╗\n";
echo "║  B2B LP マルチユーザー E2E テスト             ║\n";
echo "║  Environment: {$env}                         ║\n";
echo "║  Base URL: {$baseUrl}                        ║\n";
echo "╚══════════════════════════════════════════════╝\n\n";

$results = ['pass' => 0, 'fail' => 0, 'warn' => 0];
$failures = [];

function http_get(string $url, bool $followRedirect = true): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => $followRedirect,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HEADER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_USERAGENT => 'ikimon-e2e-test/1.0',
    ]);
    if (!$followRedirect) {
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $headers = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);
    $finalUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    $time = curl_getinfo($ch, CURLINFO_TOTAL_TIME);
    curl_close($ch);
    return compact('httpCode', 'headers', 'body', 'finalUrl', 'time');
}

function assert_test(string $name, bool $condition, string $detail = ''): void
{
    global $results, $failures;
    if ($condition) {
        echo "  ✅ {$name}\n";
        $results['pass']++;
    } else {
        echo "  ❌ {$name}" . ($detail ? " — {$detail}" : "") . "\n";
        $results['fail']++;
        $failures[] = $name . ($detail ? ": {$detail}" : "");
    }
}

function assert_warn(string $name, bool $condition, string $detail = ''): void
{
    global $results;
    if ($condition) {
        echo "  ✅ {$name}\n";
        $results['pass']++;
    } else {
        echo "  ⚠️  {$name}" . ($detail ? " — {$detail}" : "") . "\n";
        $results['warn']++;
    }
}

// ═══════════════════════════════════════════════════
// Persona 1: 企業CSR担当者 (初回訪問、トップ→デモ→料金→申込)
// ═══════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "👤 Persona 1: 企業CSR担当者 — セールスファネル完走\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

// Step 1: トップページ到達
$r = http_get("{$baseUrl}/for-business/");
assert_test('P1-01: index.php HTTP 200', $r['httpCode'] === 200, "Got {$r['httpCode']}");
assert_test('P1-02: レスポンス 1KB超', strlen($r['body']) > 1000, strlen($r['body']) . ' bytes');
assert_test('P1-03: ヒーローテキスト表示', str_contains($r['body'], '生物多様性'));
assert_test('P1-04: CTAボタン存在（デモ）', str_contains($r['body'], 'demo.php'));
assert_test('P1-05: CTAボタン存在（料金）', str_contains($r['body'], 'pricing.php'));
assert_test('P1-06: CTAボタン存在（申込）', str_contains($r['body'], 'apply.php'));
assert_test('P1-07: viewport meta', str_contains($r['body'], 'viewport'));
assert_test('P1-08: OGP/title存在', str_contains($r['body'], '<title>'));
assert_warn('P1-09: ロード時間 < 3秒', $r['time'] < 3.0, round($r['time'], 2) . 's');

// Step 2: デモページへ遷移
$r = http_get("{$baseUrl}/for-business/demo.php");
assert_test('P1-10: demo.php HTTP 200', $r['httpCode'] === 200, "Got {$r['httpCode']}");
assert_test('P1-11: デモリンク表示（site_id付き）', str_contains($r['body'], 'site_id='));
assert_test('P1-12: 「サンプルサイトなし」が表示されない', !str_contains($r['body'], 'サンプルサイトなし'));
assert_test('P1-13: レポートカード6種表示', substr_count($r['body'], 'demo-card') >= 6);

// Step 3: 料金ページへ遷移
$r = http_get("{$baseUrl}/for-business/pricing.php");
assert_test('P1-14: pricing.php HTTP 200', $r['httpCode'] === 200, "Got {$r['httpCode']}");
assert_test('P1-15: 料金表示', str_contains($r['body'], '¥'));
assert_test('P1-16: 申込ボタン存在', str_contains($r['body'], 'apply.php'));

// Step 4: 申込ページへ遷移
$r = http_get("{$baseUrl}/for-business/apply.php");
assert_test('P1-17: apply.php HTTP 200', $r['httpCode'] === 200, "Got {$r['httpCode']}");
assert_test('P1-18: フォーム要素存在', str_contains($r['body'], 'mailto:') || str_contains($r['body'], '<form'));

echo "\n";

// ═══════════════════════════════════════════════════
// Persona 2: 自治体環境課職員 (旧URLからリダイレクト→トップ)
// ═══════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "👤 Persona 2: 自治体職員 — 旧URL経由アクセス\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

// Step 1: 旧URLでアクセス（301リダイレクト確認）
$r = http_get("{$baseUrl}/for-business.php", false);
assert_test('P2-01: 旧URL 301リダイレクト', $r['httpCode'] === 301, "Got {$r['httpCode']}");
assert_test('P2-02: リダイレクト先がfor-business/', str_contains($r['headers'], 'for-business/'));

// Step 2: リダイレクト後の到着確認
$r = http_get("{$baseUrl}/for-business.php", true);
assert_test('P2-03: リダイレクト後 200到達', $r['httpCode'] === 200, "Got {$r['httpCode']}");
assert_test('P2-04: 最終URLが/for-business/', str_contains($r['finalUrl'], '/for-business/'));

// Step 3: フッターリンクチェック
assert_test('P2-05: ikimonホームリンク', str_contains($r['body'], '../index.php') || str_contains($r['body'], 'index.php'));
assert_test('P2-06: 利用規約リンク', str_contains($r['body'], 'terms.php'));
assert_test('P2-07: プライバシーポリシーリンク', str_contains($r['body'], 'privacy.php'));
assert_test('P2-08: お問い合わせリンク', str_contains($r['body'], 'contact@ikimon.life'));

echo "\n";

// ═══════════════════════════════════════════════════
// Persona 3: 環境コンサルタント (デモページのAPI全件チェック)
// ═══════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "👤 Persona 3: 環境コンサル — 全レポートAPI検証\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

$apis = [
    'generate_site_report' => 'サイトレポート',
    'generate_tnfd_report' => 'TNFD LEAP',
    'generate_activity_report' => '活動報告書',
    'generate_csr_report' => 'サステナビリティ',
    'generate_executive_summary' => 'エグゼクティブ',
    'generate_photo_digest' => '写真ダイジェスト',
];

// まずデモページからsite_idを取得
$demo = http_get("{$baseUrl}/for-business/demo.php");
preg_match('/site_id=([a-zA-Z0-9_]+)/', $demo['body'], $m);
$siteId = $m[1] ?? 'unknown';
assert_test("P3-01: デモsite_id取得 ({$siteId})", $siteId !== 'unknown');

$i = 2;
foreach ($apis as $api => $label) {
    $r = http_get("{$baseUrl}/api/{$api}.php?site_id={$siteId}");
    $num = str_pad($i, 2, '0', STR_PAD_LEFT);
    assert_test("P3-{$num}: {$label} API HTTP 200", $r['httpCode'] === 200, "Got {$r['httpCode']}");
    $i++;
    $num = str_pad($i, 2, '0', STR_PAD_LEFT);
    assert_test("P3-{$num}: {$label} レスポンス非空", strlen($r['body']) > 100, strlen($r['body']) . ' bytes');
    $i++;
}

echo "\n";

// ═══════════════════════════════════════════════════
// Persona 4: モバイルユーザー (スマホUA + レスポンシブ確認)
// ═══════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "👤 Persona 4: モバイルユーザー — UA変更レスポンシブ確認\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

$pages = ['index.php', 'demo.php', 'pricing.php', 'apply.php'];
$mobileUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

$i = 1;
foreach ($pages as $page) {
    $ch = curl_init("{$baseUrl}/for-business/{$page}");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_USERAGENT => $mobileUA,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $num = str_pad($i, 2, '0', STR_PAD_LEFT);
    assert_test("P4-{$num}: {$page} モバイルUA HTTP 200", $code === 200, "Got {$code}");
    $i++;
    $num = str_pad($i, 2, '0', STR_PAD_LEFT);
    assert_test("P4-{$num}: {$page} viewport meta存在", str_contains($body, 'width=device-width'));
    $i++;
    $num = str_pad($i, 2, '0', STR_PAD_LEFT);
    assert_test("P4-{$num}: {$page} モバイル用CSS存在", str_contains($body, '@media') || str_contains($body, 'max-width'));
    $i++;
}

echo "\n";

// ═══════════════════════════════════════════════════
// Persona 5: SEOボット (構造化データ + メタ情報 + パフォーマンス)
// ═══════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "👤 Persona 5: SEOボット — メタ情報 & パフォーマンス監査\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

$seoPages = [
    'index.php' => 'メインLP',
    'demo.php' => 'デモ',
    'pricing.php' => '料金',
    'apply.php' => '申込',
];

$i = 1;
foreach ($seoPages as $page => $label) {
    $r = http_get("{$baseUrl}/for-business/{$page}");

    $num = str_pad($i, 2, '0', STR_PAD_LEFT);
    assert_test("P5-{$num}: {$label} DOCTYPE存在", str_contains($r['body'], '<!DOCTYPE html'));
    $i++;

    $num = str_pad($i, 2, '0', STR_PAD_LEFT);
    assert_test("P5-{$num}: {$label} lang=\"ja\"", str_contains($r['body'], 'lang="ja"'));
    $i++;

    $num = str_pad($i, 2, '0', STR_PAD_LEFT);
    assert_test("P5-{$num}: {$label} <title>存在", preg_match('/<title>[^<]+<\/title>/', $r['body']));
    $i++;

    $num = str_pad($i, 2, '0', STR_PAD_LEFT);
    assert_test("P5-{$num}: {$label} meta description", str_contains($r['body'], 'meta name="description"'));
    $i++;

    $num = str_pad($i, 2, '0', STR_PAD_LEFT);
    assert_test("P5-{$num}: {$label} favicon", str_contains($r['body'], 'favicon'));
    $i++;

    $num = str_pad($i, 2, '0', STR_PAD_LEFT);
    assert_warn("P5-{$num}: {$label} ロード < 2秒", $r['time'] < 2.0, round($r['time'], 2) . 's');
    $i++;
}

echo "\n";

// ═══════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════
$total = $results['pass'] + $results['fail'] + $results['warn'];
echo "╔══════════════════════════════════════════════╗\n";
echo "║  テスト結果サマリー                            ║\n";
echo "╠══════════════════════════════════════════════╣\n";
printf("║  ✅ PASS:  %3d / %d                          ║\n", $results['pass'], $total);
printf("║  ❌ FAIL:  %3d / %d                          ║\n", $results['fail'], $total);
printf("║  ⚠️  WARN:  %3d / %d                          ║\n", $results['warn'], $total);
echo "╚══════════════════════════════════════════════╝\n";

if (!empty($failures)) {
    echo "\n❌ 失敗した項目:\n";
    foreach ($failures as $f) {
        echo "  • {$f}\n";
    }
}

$exitCode = $results['fail'] > 0 ? 1 : 0;
echo "\nExit code: {$exitCode}\n";
exit($exitCode);
