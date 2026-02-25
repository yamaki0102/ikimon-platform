<?php

/**
 * ikimon.life E2E Full Test v5 — 完全版
 *
 * 全ページ・全API・認証フロー・投稿テストを包括的にテスト
 *
 * Usage: php tools/e2e_full.php [--base=http://localhost:8899] [--smoke]
 *
 * Options:
 *   --base=URL    Base URL to test against (default: http://localhost:8899)
 *   --smoke       Smoke test mode: Phase 1 only (public pages HTTP status check, ~3s)
 */

error_reporting(E_ALL & ~E_DEPRECATED);

$baseUrl = 'http://localhost:8899';
$smokeMode = false;
foreach ($argv as $arg) {
    if (strpos($arg, '--base=') === 0) {
        $baseUrl = substr($arg, 7);
    }
    if ($arg === '--smoke') {
        $smokeMode = true;
    }
}

echo "╔══════════════════════════════════════════════════╗\n";
echo "║  ikimon.life E2E Full Test v5                    ║\n";
echo "╠══════════════════════════════════════════════════╣\n";
echo "║  Base URL: " . str_pad($baseUrl, 37) . "║\n";
echo "║  Mode:     " . str_pad($smokeMode ? '🚬 SMOKE (Phase 1 only)' : '🔥 FULL', 37) . "║\n";
echo "║  Time:     " . str_pad(date('Y-m-d H:i:s'), 37) . "║\n";
echo "╚══════════════════════════════════════════════════╝\n\n";

$pass = 0;
$fail = 0;
$skip = 0;
$warnings = [];
$errors = [];

// ─── HTTP Helpers ───────────────────────────────

$responseTimes = []; // path => ms
$slowThreshold = 1000; // ms

function http_get(string $url, ?string $cookie = null): array
{
    global $responseTimes;
    $headers = "User-Agent: ikimon-e2e/5.0\r\n";
    if ($cookie) $headers .= "Cookie: {$cookie}\r\n";
    $ctx = stream_context_create(['http' => [
        'timeout' => 15,
        'method' => 'GET',
        'ignore_errors' => true,
        'header' => $headers,
        'follow_location' => 0,
    ]]);
    $start = microtime(true);
    $body = @file_get_contents($url, false, $ctx);
    $elapsed = round((microtime(true) - $start) * 1000);
    $path = parse_url($url, PHP_URL_PATH) ?: $url;
    $responseTimes[$path] = $elapsed;
    $result = parse_response($body, http_get_last_response_headers() ?? []);
    $result['time_ms'] = $elapsed;
    return $result;
}

function http_post(string $url, array $data, ?string $cookie = null, string $contentType = 'form'): array
{
    $content = ($contentType === 'json') ? json_encode($data) : http_build_query($data);
    $ct = ($contentType === 'json') ? 'application/json' : 'application/x-www-form-urlencoded';
    $headers = "Content-Type: {$ct}\r\nUser-Agent: ikimon-e2e/4.0\r\n";
    if ($cookie) $headers .= "Cookie: {$cookie}\r\n";
    $ctx = stream_context_create(['http' => [
        'timeout' => 15,
        'method' => 'POST',
        'ignore_errors' => true,
        'header' => $headers,
        'content' => $content,
        'follow_location' => 0,
    ]]);
    $body = @file_get_contents($url, false, $ctx);
    return parse_response($body, http_get_last_response_headers() ?? []);
}

function http_follow(string $baseUrl, array $response, ?string $cookie = null): array
{
    if (in_array($response['status'], [301, 302]) && $response['location']) {
        $target = $response['location'];
        if (strpos($target, 'http') !== 0) $target = $baseUrl . '/' . ltrim($target, '/');
        $newCookie = extractCookie($response, $cookie);
        return http_get($target, $newCookie);
    }
    return $response;
}

function parse_response(?string $body, array $responseHeaders): array
{
    $status = 0;
    $cookies = [];
    $location = null;
    foreach ($responseHeaders as $h) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $h, $m)) $status = (int)$m[1];
        if (preg_match('/^Set-Cookie:\s*([^;]+)/i', $h, $m)) $cookies[] = $m[1];
        if (preg_match('/^Location:\s*(.+)/i', $h, $m)) $location = trim($m[1]);
    }
    return ['status' => $status, 'body' => $body ?: '', 'cookies' => $cookies, 'location' => $location];
}

function extractCookie(array $response, ?string $existing = null): ?string
{
    $parts = [];
    if ($existing) {
        foreach (explode('; ', $existing) as $c) {
            $pair = explode('=', $c, 2);
            if (count($pair) === 2) $parts[$pair[0]] = $pair[1];
        }
    }
    foreach ($response['cookies'] as $c) {
        $pair = explode('=', $c, 2);
        if (count($pair) === 2) $parts[$pair[0]] = $pair[1];
    }
    if (empty($parts)) return null;
    $result = [];
    foreach ($parts as $k => $v) $result[] = "{$k}={$v}";
    return implode('; ', $result);
}

function extractCsrf(string $html): ?string
{
    // 1. HTML form hidden input
    if (preg_match('/name=["\']csrf_token["\'][^>]*value=["\']([^"\']+)["\']/', $html, $m)) {
        return $m[1];
    }
    // 2. Reverse order (value before name)
    if (preg_match('/value=["\']([a-f0-9]{32,})["\'][^>]*name=["\']csrf_token["\']/', $html, $m)) {
        return $m[1];
    }
    // 3. JavaScript variable: csrfToken: 'xxx' or csrfToken: "xxx"
    if (preg_match("/csrfToken:\s*'([a-f0-9]{32,})'/", $html, $m)) {
        return $m[1];
    }
    if (preg_match('/csrfToken:\s*"([a-f0-9]{32,})"/', $html, $m)) {
        return $m[1];
    }
    // 4. Meta tag
    if (preg_match('/meta\s+name=["\']csrf-token["\'][^>]*content=["\']([^"\']+)["\']/', $html, $m)) {
        return $m[1];
    }
    return null;
}

function test(string $name, bool $condition, string $detail = ''): bool
{
    global $pass, $fail, $errors;
    if ($condition) {
        echo "  ✅ {$name}\n";
        $pass++;
    } else {
        echo "  ❌ {$name}" . ($detail ? " — {$detail}" : "") . "\n";
        $fail++;
        $errors[] = $name . ($detail ? ": {$detail}" : "");
    }
    return $condition;
}

function checkPHPErrors(string $body, string $page): void
{
    global $warnings;
    if (preg_match('/<b>(Fatal error|Parse error)<\/b>/', $body)) {
        test("  ↳ No PHP Fatal in {$page}", false, "PHP error detected");
    }
    if (preg_match('/<b>Warning<\/b>:\s/', $body)) {
        $warnings[] = $page;
        echo "  ⚠️  PHP Warning in {$page}\n";
    }
}

// ═══════════════════════════════════════
// PHASE 1: パブリックページ（非認証）
// ═══════════════════════════════════════
echo "── Phase 1: パブリックページ ──────────────────\n";

$publicPages = [
    // [path, expected_statuses (array), content_check (optional)]
    ['/', [200], '生き物'],
    ['/index.php', [200], null],
    ['/login.php', [200], 'ログイン'],
    ['/explore.php', [200], null],
    ['/zukan.php', [200], '図鑑'],
    ['/about.php', [200], 'ikimon'],
    ['/for-business.php', [200], '企業'],
    ['/for-researcher.php', [200], null],
    ['/for-citizen.php', [200], null],
    ['/faq.php', [200], null],
    ['/terms.php', [200], null],
    ['/privacy.php', [200], null],
    ['/guidelines.php', [200], null],
    ['/post.php', [200], null],
    ['/field_research.php', [200], null],
    ['/events.php', [200], null],
    ['/ranking.php', [200, 301, 302], null],     // May redirect to compass.php
    ['/heatmap.php', [200, 301, 302], null],     // May redirect to map.php
    ['/compass.php', [200], null],
    ['/reference_layer.php', [200], null],
    ['/id_center.php', [200, 302], null],        // May require login
    ['/id_wizard.php', [200], null],
    ['/showcase.php', [200], null],
    ['/sitemap.php', [200], null],
    ['/offline.php', [200], null],
    ['/map.php', [200], null],
    ['/species.php', [200, 302], null],          // May redirect to zukan.php
    ['/team.php', [200], null],
    ['/survey.php', [200, 302], null],           // May require login
    ['/csr_showcase.php', [200, 302], null],     // May require login
    ['/corporate_dashboard.php', [200], null],
    ['/site_dashboard.php', [200], null],
    ['/my_organisms.php', [200, 302], null],     // May require login
    // Error pages
    ['/403.php', [403], null],
    ['/404.php', [404], null],
];

foreach ($publicPages as [$path, $expectedStatuses, $contentCheck]) {
    $url = $baseUrl . $path;
    $r = http_get($url);
    $statusOk = in_array($r['status'], $expectedStatuses);
    $timeLabel = isset($r['time_ms']) ? " ({$r['time_ms']}ms)" : '';
    $slowTag = (isset($r['time_ms']) && $r['time_ms'] > $slowThreshold) ? ' 🐢' : '';
    test(
        "GET {$path} [{$r['status']}]{$timeLabel}{$slowTag}",
        $statusOk,
        "Expected " . implode('|', $expectedStatuses) . ", got {$r['status']}"
    );

    if ($r['status'] === 200) {
        if ($contentCheck) {
            test(
                "  ↳ Contains '{$contentCheck}'",
                mb_strpos($r['body'], $contentCheck) !== false
            );
        }
        checkPHPErrors($r['body'], $path);
    }
}

// ═══════════════════════════════════════
// SMOKE MODE: Early exit after Phase 1
// ═══════════════════════════════════════
if ($smokeMode) {
    $total = $pass + $fail + $skip;
    $passRate = $total > 0 ? round($pass / $total * 100, 1) : 0;

    echo "\n╔══════════════════════════════════════════════════╗\n";
    echo "║  🚬 Smoke Test Report                            ║\n";
    echo "╠══════════════════════════════════════════════════╣\n";
    printf("║  ✅ Pass: %-39s║\n", $pass);
    printf("║  ❌ Fail: %-39s║\n", $fail);
    printf("║  Total: %-40s║\n", $total);
    printf("║  Rate:  %-40s║\n", "{$passRate}%");
    echo "╚══════════════════════════════════════════════════╝\n";

    // Performance summary for smoke mode
    if (!empty($responseTimes)) {
        $times = array_values($responseTimes);
        sort($times);
        $count = count($times);
        $p50 = $times[(int)($count * 0.5)] ?? 0;
        $p90 = $times[(int)($count * 0.9)] ?? 0;
        $max = max($times);
        $avg = round(array_sum($times) / $count);
        printf("\n⚡ avg: %dms | p50: %dms | p90: %dms | max: %dms\n", $avg, $p50, $p90, $max);

        $slowPages = array_filter($responseTimes, fn($t) => $t > $slowThreshold);
        if (!empty($slowPages)) {
            arsort($slowPages);
            echo "🐢 Slow (>{$slowThreshold}ms): ";
            echo implode(', ', array_map(fn($p, $t) => "{$p} ({$t}ms)", array_keys($slowPages), $slowPages));
            echo "\n";
        }
    }

    echo "\n" . ($fail === 0 ? "🎉 SMOKE TEST PASSED!" : "⚠️  {$fail} FAILURE(S)") . "\n";
    exit($fail > 0 ? 1 : 0);
}

// ═══════════════════════════════════════
// PHASE 2: API GETエンドポイント（非認証）
// ═══════════════════════════════════════
echo "\n── Phase 2: API GETエンドポイント ──────────────\n";

$getApis = [
    ['/api/health.php', [200], true],
    ['/api/get_observations.php', [200], true],
    ['/api/get_events.php', [200], true],
    ['/api/taxon_index.php', [200], true],
    ['/api/get_exploration_stats.php', [200], true],
    ['/api/region_list.php', [200], true],
    ['/api/list_sites.php', [200], true],
    ['/api/search.php?q=test', [200], true],
    ['/api/search_taxon.php?q=test', [200], true],
    ['/api/heatmap_data.php', [200], true],
    ['/api/get_regional_stats.php', [200], true],
    ['/api/get_showcase_data.php', [200], true],
    ['/api/get_completeness.php', [200], true],
    ['/api/verify_config.php', [200], false],
    ['/api/taxon_suggest.php?q=a', [200], true],
    ['/api/get_impact_stats.php', [200], true],
    // Admin-only
    ['/api/get_analytics_summary.php', [403], true],
];

foreach ($getApis as [$path, $expectedStatuses, $expectJson]) {
    $url = $baseUrl . $path;
    $r = http_get($url);
    $statusOk = in_array($r['status'], $expectedStatuses);
    test(
        "API GET {$path} [{$r['status']}]",
        $statusOk,
        "Expected " . implode('|', $expectedStatuses) . ", got {$r['status']}"
    );

    if ($statusOk && $expectJson) {
        $json = json_decode($r['body'], true);
        test(
            "  ↳ Valid JSON",
            $json !== null,
            "Invalid: " . substr($r['body'], 0, 80)
        );
    }
}

// ═══════════════════════════════════════
// PHASE 3: ユーザー登録 + ログイン
// ═══════════════════════════════════════
echo "\n── Phase 3: ユーザー登録 & ログイン ────────────\n";

$sessionCookie = null;

$loginPage = http_get($baseUrl . '/login.php?tab=register');
$sessionCookie = extractCookie($loginPage);
$csrfToken = extractCsrf($loginPage['body']);
test("Login page loads", $loginPage['status'] === 200);
test("Session cookie obtained", $sessionCookie !== null);
test("CSRF token extracted", $csrfToken !== null);

$testEmail = 'e2e_test_' . time() . '@example.com';
$testPass = 'TestPass123!';
$testName = 'E2E Tester ' . date('His');
$loggedIn = false;
$testUserId = null;

if ($csrfToken && $sessionCookie) {
    $regResult = http_post($baseUrl . '/login.php', [
        'action' => 'register',
        'name' => $testName,
        'email' => $testEmail,
        'password' => $testPass,
        'password_confirm' => $testPass,
        'csrf_token' => $csrfToken,
        'redirect' => 'index.php',
    ], $sessionCookie);

    $sessionCookie = extractCookie($regResult, $sessionCookie);
    $regOk = $regResult['status'] === 302;
    test(
        "User registration [302]",
        $regOk,
        "Status: {$regResult['status']}"
    );

    if ($regOk) {
        $afterReg = http_follow($baseUrl, $regResult, $sessionCookie);
        $sessionCookie = extractCookie($afterReg, $sessionCookie);

        $profileR = http_get($baseUrl . '/profile.php', $sessionCookie);
        $sessionCookie = extractCookie($profileR, $sessionCookie);
        $loggedIn = $profileR['status'] === 200 &&
            (mb_strpos($profileR['body'], $testName) !== false ||
                mb_strpos($profileR['body'], 'ログアウト') !== false ||
                mb_strpos($profileR['body'], 'profile-avatar') !== false);
        test("Auto-logged in after registration", $loggedIn);
    }

    if (!$loggedIn) {
        $lg = http_get($baseUrl . '/login.php?tab=login', $sessionCookie);
        $sessionCookie = extractCookie($lg, $sessionCookie);
        $csrf2 = extractCsrf($lg['body']);
        if ($csrf2) {
            $loginR = http_post($baseUrl . '/login.php', [
                'action' => 'login',
                'email' => $testEmail,
                'password' => $testPass,
                'csrf_token' => $csrf2,
                'redirect' => 'index.php',
            ], $sessionCookie);
            $sessionCookie = extractCookie($loginR, $sessionCookie);
            $loggedIn = ($loginR['status'] === 302);
            test("Explicit login [302]", $loggedIn, "Status: {$loginR['status']}");
            if ($loggedIn) {
                $afterLogin = http_follow($baseUrl, $loginR, $sessionCookie);
                $sessionCookie = extractCookie($afterLogin, $sessionCookie);
            }
        }
    }
} else {
    echo "  ⚠️  CSRF/Cookie取得失敗\n";
    $skip += 4;
}

echo "  → Logged in: " . ($loggedIn ? 'YES ✨' : 'NO ⚠️') . "\n";

// ═══════════════════════════════════════
// PHASE 4: 認証必須ページ
// ═══════════════════════════════════════
echo "\n── Phase 4: 認証必須ページ ────────────────────\n";

$authPages = [
    '/profile.php',
    '/profile_edit.php',
    '/wellness.php',
    '/my_field_dashboard.php',
    '/review_queue.php',
    '/id_workbench.php',
    '/id_form.php',
];

foreach ($authPages as $path) {
    $r = http_get($baseUrl . $path, $sessionCookie);
    test(
        "AUTH GET {$path} [{$r['status']}]",
        in_array($r['status'], [200, 302]),
        "Status: {$r['status']}"
    );
    if ($r['status'] === 200) checkPHPErrors($r['body'], $path);
}

// ═══════════════════════════════════════
// PHASE 5: 認証必須 API (GET)
// ═══════════════════════════════════════
echo "\n── Phase 5: 認証必須 API (GET) ────────────────\n";

$authApis = [
    ['/api/get_notifications.php', [200]],
    ['/api/get_personal_report.php', [200]],
    ['/api/get_wellness_summary.php', [200, 401]],
    ['/api/get_tracks.php', [200, 400, 401]],
    ['/api/get_field_sessions.php', [200, 400, 401]],
];

foreach ($authApis as [$path, $allowed]) {
    $r = http_get($baseUrl . $path, $sessionCookie);
    test(
        "AUTH API GET {$path} [{$r['status']}]",
        in_array($r['status'], $allowed),
        "Expected " . implode('|', $allowed) . ", got {$r['status']}"
    );
}

// ═══════════════════════════════════════
// PHASE 6: POST API (CSRF対応)
// ═══════════════════════════════════════
echo "\n── Phase 6: POST API (投稿テスト) ──────────────\n";

$observationId = null;

if ($loggedIn) {
    // post.phpからCSRFトークンを取得（JS変数 csrfToken: 'xxx'）
    $postPage = http_get($baseUrl . '/post.php', $sessionCookie);
    $sessionCookie = extractCookie($postPage, $sessionCookie);
    $postCsrf = extractCsrf($postPage['body']);
    test(
        "CSRF token from post.php",
        $postCsrf !== null,
        "extractCsrf returned null"
    );

    if ($postCsrf) {
        // 観測投稿（写真なし → バリデーション拒否が正常）
        $obsData = [
            'taxon_name' => 'テスト種（E2E）',
            'lat' => '34.977',
            'lng' => '138.383',
            'observed_at' => date('Y-m-d H:i:s'),
            'notes' => 'E2Eテスト自動投稿 ' . date('YmdHis'),
            'habitat' => 'forest',
            'csrf_token' => $postCsrf,
        ];
        $obsResult = http_post($baseUrl . '/api/post_observation.php', $obsData, $sessionCookie);
        $obsJson = json_decode($obsResult['body'], true);

        // 写真必須なので success=false + 200 が正常
        $obsValidated = ($obsResult['status'] === 200 && ($obsJson['success'] ?? true) === false);
        // もしくは写真なしでも成功するAPI仕様の場合
        $obsCreated = in_array($obsResult['status'], [200, 201]) && ($obsJson['success'] ?? false) === true;

        if ($obsCreated) {
            test("POST /api/post_observation.php [{$obsResult['status']}] ✨ created", true);
            $observationId = $obsJson['id'] ?? ($obsJson['observation_id'] ?? ($obsJson['data']['id'] ?? null));
            test("  ↳ Observation ID returned", $observationId !== null);
        } else {
            // 写真なしバリデーション拒否 = 正常動作
            test(
                "POST /api/post_observation.php — validation OK (photo required)",
                $obsValidated,
                "Status: {$obsResult['status']}, Body: " . substr($obsResult['body'], 0, 120)
            );
        }

        // 同定投稿（observationIdがある場合のみ）
        if ($observationId) {
            $idResult = http_post($baseUrl . '/api/post_identification.php', [
                'observation_id' => $observationId,
                'taxon_name' => 'テスト種（E2E同定）',
                'confidence' => 'high',
                'notes' => 'E2Eテスト同定',
                'csrf_token' => $postCsrf,
            ], $sessionCookie);
            test(
                "POST /api/post_identification.php [{$idResult['status']}]",
                in_array($idResult['status'], [200, 201]),
                substr($idResult['body'], 0, 150)
            );
        }

        // マイフィールド作成
        $fieldResult = http_post($baseUrl . '/api/create_field.php', [
            'name' => 'E2Eテストフィールド ' . date('His'),
            'lat' => '34.977',
            'lng' => '138.383',
            'radius' => 500,
            'csrf_token' => $postCsrf,
        ], $sessionCookie);
        test(
            "POST /api/create_field.php [{$fieldResult['status']}]",
            in_array($fieldResult['status'], [200, 201]),
            substr($fieldResult['body'], 0, 150)
        );

        // いいね（observationIdがある場合のみ）
        if ($observationId) {
            $likeResult = http_post(
                $baseUrl . '/api/toggle_like.php',
                ['observation_id' => $observationId, 'csrf_token' => $postCsrf],
                $sessionCookie
            );
            test(
                "POST /api/toggle_like.php [{$likeResult['status']}]",
                in_array($likeResult['status'], [200, 201]),
                substr($likeResult['body'], 0, 100)
            );
        }

        // 観測詳細ページ（observationIdがある場合のみ）
        if ($observationId) {
            $detailR = http_get($baseUrl . '/observation_detail.php?id=' . $observationId, $sessionCookie);
            test(
                "GET /observation_detail.php?id={$observationId} [{$detailR['status']}]",
                $detailR['status'] === 200
            );
        }
    } else {
        echo "  ⚠️  CSRF取得失敗、投稿テストスキップ\n";
        $skip += 5;
    }
} else {
    echo "  ⚠️  未ログインのためPOSTテストをスキップ\n";
    $skip += 7;
}

// ═══════════════════════════════════════
// PHASE 7: エラーハンドリング
// ═══════════════════════════════════════
echo "\n── Phase 7: エラーハンドリング ─────────────────\n";

// PHP built-in server limitation: no .htaccess support
$err404 = http_get($baseUrl . '/nonexistent_xyz.php');
test(
    "Missing page [{$err404['status']}]",
    in_array($err404['status'], [200, 404]),
    "Status: {$err404['status']}"
);

$errApi = http_get($baseUrl . '/api/get_observations.php?bad_param=xyz');
test(
    "API graceful with bad params [{$errApi['status']}]",
    $errApi['status'] === 200
);

$noCsrf = http_post(
    $baseUrl . '/api/post_observation.php',
    ['taxon_name' => 'test'],
    $sessionCookie
);
test(
    "POST without CSRF handled [{$noCsrf['status']}]",
    in_array($noCsrf['status'], [200, 400, 403])
);
if ($noCsrf['status'] === 200) {
    $j = json_decode($noCsrf['body'], true);
    test("  ↳ success=false", ($j['success'] ?? true) === false);
}

// ═══════════════════════════════════════
// PHASE 8: 静的アセット
// ═══════════════════════════════════════
echo "\n── Phase 8: 静的アセット ──────────────────────\n";

$assets = [
    '/assets/css/tokens.css',
    '/assets/css/style.css',
    '/assets/css/zukan.css',
    '/assets/css/tactical.css',
    '/assets/js/analytics.js',
    '/assets/js/dashboard.js',
    '/manifest.json',
    '/sw.js',
    '/robots.txt',
];

foreach ($assets as $path) {
    $r = http_get($baseUrl . $path);
    test(
        "ASSET {$path} [{$r['status']}]",
        $r['status'] === 200,
        "Status: {$r['status']}"
    );
}

// ═══════════════════════════════════════
// PHASE 9: ページパラメータ
// ═══════════════════════════════════════
echo "\n── Phase 9: ページパラメータ ───────────────────\n";

$paramPages = [
    ['/species.php?name=test', [200, 302]],              // May redirect to zukan
    ['/site_dashboard.php?id=test456', [200]],
    ['/profile.php?id=user_ya_001', [200]],
    ['/observation_detail.php?id=nonexistent', [200, 404]],
];

foreach ($paramPages as [$path, $expected]) {
    $r = http_get($baseUrl . $path, $sessionCookie);
    test(
        "PARAM {$path} [{$r['status']}]",
        in_array($r['status'], $expected),
        "Expected " . implode('|', $expected) . ", got {$r['status']}"
    );
}

// ═══════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════
echo "\n── Cleanup: テストデータ削除 ──────────────────\n";

require_once __DIR__ . '/../upload_package/config/config.php';
require_once __DIR__ . '/../upload_package/libs/DataStore.php';

$cleanedItems = 0;

// Test user
$usersFile = DATA_DIR . '/users.json';
if (file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true) ?: [];
    foreach ($users as $u) {
        if (($u['email'] ?? '') === $testEmail) {
            $testUserId = $u['id'] ?? null;
            break;
        }
    }
    $before = count($users);
    $users = array_values(array_filter($users, fn($u) => ($u['email'] ?? '') !== $testEmail));
    $diff = $before - count($users);
    if ($diff > 0) {
        file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $cleanedItems += $diff;
    }
    test("Test user removed ({$diff})", true);
}

// User-specific files
if ($testUserId) {
    foreach (['users', 'user_badges', 'notifications'] as $sub) {
        $f = DATA_DIR . "/{$sub}/{$testUserId}.json";
        if (file_exists($f)) {
            unlink($f);
            $cleanedItems++;
        }
    }
    // Remember tokens
    $tokenDir = DATA_DIR . '/remember_tokens';
    if (is_dir($tokenDir)) {
        foreach (glob($tokenDir . '/*.json') as $tf) {
            $td = json_decode(file_get_contents($tf), true);
            if (($td['user_id'] ?? '') === $testUserId) {
                unlink($tf);
                $cleanedItems++;
            }
        }
    }
}

// Test observations
foreach (['observations.json'] as $file) {
    $fp = DATA_DIR . '/' . $file;
    if (file_exists($fp)) {
        $data = json_decode(file_get_contents($fp), true) ?: [];
        $before = count($data);
        $data = array_values(array_filter($data, fn($o) => strpos($o['notes'] ?? '', 'E2Eテスト') === false));
        $diff = $before - count($data);
        if ($diff > 0) {
            file_put_contents($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $cleanedItems += $diff;
        }
    }
}
// Partitioned
$obsDir = DATA_DIR . '/observations';
if (is_dir($obsDir)) {
    foreach (glob($obsDir . '/*.json') as $pf) {
        $d = json_decode(file_get_contents($pf), true) ?: [];
        $b = count($d);
        $d = array_values(array_filter($d, fn($o) => strpos($o['notes'] ?? '', 'E2Eテスト') === false));
        $diff = $b - count($d);
        if ($diff > 0) {
            file_put_contents($pf, json_encode($d, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            $cleanedItems += $diff;
        }
    }
}

// Identifications
$idFile = DATA_DIR . '/identifications.json';
if (file_exists($idFile)) {
    $ids = json_decode(file_get_contents($idFile), true) ?: [];
    $b = count($ids);
    $ids = array_values(array_filter($ids, fn($i) => strpos($i['notes'] ?? '', 'E2Eテスト') === false));
    $diff = $b - count($ids);
    if ($diff > 0) {
        file_put_contents($idFile, json_encode($ids, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $cleanedItems += $diff;
    }
}

// Fields
$fieldsDir = DATA_DIR . '/my_fields';
if (is_dir($fieldsDir)) {
    foreach (glob($fieldsDir . '/*.json') as $ff) {
        $fd = json_decode(file_get_contents($ff), true);
        if (strpos($fd['name'] ?? '', 'E2Eテスト') !== false) {
            unlink($ff);
            $cleanedItems++;
        }
    }
}

test("Cleaned {$cleanedItems} items", true);

// ═══════════════════════════════════════
// REPORT
// ═══════════════════════════════════════
$total = $pass + $fail + $skip;
$passRate = $total > 0 ? round($pass / $total * 100, 1) : 0;

echo "\n╔══════════════════════════════════════════════════╗\n";
echo "║  📊 E2E Test Report v5                           ║\n";
echo "╠══════════════════════════════════════════════════╣\n";
printf("║  ✅ Pass: %-39s║\n", $pass);
printf("║  ❌ Fail: %-39s║\n", $fail);
printf("║  ⏭️  Skip: %-38s║\n", $skip);
printf("║  Total: %-40s║\n", $total);
printf("║  Rate:  %-40s║\n", "{$passRate}%");
echo "╚══════════════════════════════════════════════════╝\n";

// Performance summary
if (!empty($responseTimes)) {
    $times = array_values($responseTimes);
    sort($times);
    $count = count($times);
    $p50 = $times[(int)($count * 0.5)] ?? 0;
    $p90 = $times[(int)($count * 0.9)] ?? 0;
    $p99 = $times[min((int)($count * 0.99), $count - 1)] ?? 0;
    $max = max($times);
    $avg = round(array_sum($times) / $count);

    echo "\n⚡ Performance Summary:\n";
    printf("   avg: %dms | p50: %dms | p90: %dms | p99: %dms | max: %dms\n", $avg, $p50, $p90, $p99, $max);

    // Slow pages report
    $slowPages = array_filter($responseTimes, fn($t) => $t > $slowThreshold);
    if (!empty($slowPages)) {
        arsort($slowPages);
        echo "\n🐢 Slow pages (>{$slowThreshold}ms):\n";
        foreach ($slowPages as $path => $ms) {
            echo "   {$ms}ms — {$path}\n";
        }
    }
}

if (count($warnings) > 0) {
    echo "\n⚠️  PHP Warnings:\n";
    foreach ($warnings as $w) echo "  • {$w}\n";
}

if (count($errors) > 0) {
    echo "\n🚨 Failed:\n";
    foreach ($errors as $e) echo "  • {$e}\n";
}

echo "\n" . ($fail === 0 ? "🎉 ALL TESTS PASSED!" : "⚠️  {$fail} FAILURE(S)") . "\n";
exit($fail > 0 ? 1 : 0);
