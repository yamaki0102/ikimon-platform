<?php

/**
 * Page Health Check — Verify all pages render completely (</html> tag present)
 * Usage: php tools/page_health_check.php [base_url]
 * Default: http://localhost:8899
 */
error_reporting(0); // Check for --auth flag and remove it from args to not confuse URL parser
$args = $argv;
$useAuth = false;
$key = array_search('--auth', $args);
if ($key !== false) {
    $useAuth = true;
    unset($args[$key]);
}
// Re-index array
$args = array_values($args);

// Base URL (default to local dev server)
$baseUrl = $args[1] ?? 'http://localhost:8899';

$pages = [
    '/',
    '/post.php',
    '/explore.php',
    '/map.php',
    '/login.php',
    '/about.php',
    '/zukan.php',
    '/site_dashboard.php',
    '/profile.php',
    '/id_workbench.php',
    '/review_queue.php',
    '/create_event.php',
    '/events.php',
    '/event_detail.php?id=test', // needs id param
    '/survey.php',
    '/wellness.php',
    '/corporate_dashboard.php',
    '/observation_detail.php?id=test', // needs id param, 404 expected if no test data
    '/profile_edit.php',  // 302 redirect to login is OK (auth required)
    '/my_field_dashboard.php',
];

// NOTE: Pages requiring authentication return 302 → login.php
// This is EXPECTED behavior. The redirect target contains </html>, so they pass.

// Check for --auth flag
$useAuth = in_array('--auth', $argv);

// Configuration for test user (must match tools/ensure_test_user.php)
$testEmail = 'health_check_user@ikimon.life';
$testPass = 'HealthCheckPass2026!';

$cookies = [];

$logFile = __DIR__ . '/health_check_debug.log';
file_put_contents($logFile, "=== Health Check Start: " . date('Y-m-d H:i:s') . " ===\n");

function logMsg($msg)
{
    global $logFile;
    file_put_contents($logFile, $msg . "\n", FILE_APPEND);
    echo $msg . "\n";
}

if ($useAuth) {
    logMsg("🔐 Authenticating as $testEmail...");

    // 1. Initial GET to get CSRF token (if needed) and session cookie
    $loginUrl = rtrim($baseUrl, '/') . '/login.php';
    logMsg("   -> GET $loginUrl");

    // Create context to capture cookies
    $opts = [
        'http' => [
            'method' => 'GET',
            'timeout' => 10,
            'ignore_errors' => true,
            'follow_location' => false, // Don't follow yet, we need headers
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
        ]
    ];
    $ctx = stream_context_create($opts);
    $resp = file_get_contents($loginUrl, false, $ctx); // Removed @ for debug

    if ($resp === false) {
        $error = error_get_last();
        logMsg("❌ Connectivity Error (GET login.php): " . ($error['message'] ?? 'Unknown error'));
        exit(1);
    }

    // Parse cookies from GET response
    $headers = $http_response_header ?? [];
    foreach ($headers as $h) {
        if (preg_match('/^Set-Cookie:\s*([^;]+)/i', $h, $m)) {
            $cookies[] = $m[1];
            logMsg("   -> Cookie found: {$m[1]}");
        }
    }

    // Extract CSRF token
    $csrfToken = '';
    if (preg_match('/name="csrf_token"\s+value="([^"]+)"/i', $resp, $m)) {
        $csrfToken = $m[1];
        logMsg("   -> CSRF Token found: " . substr($csrfToken, 0, 10) . "...");
    } else {
        logMsg("⚠️  CSRF Token NOT found in login page.");
    }

    // 2. POST login
    $postData = http_build_query([
        'email' => $testEmail,
        'password' => $testPass,
        'csrf_token' => $csrfToken,
        'action' => 'login',
        'login' => '1' // Backwards compatibility if needed, though 'action' is key
    ]);

    logMsg("   -> POST $loginUrl (Data length: " . strlen($postData) . ")");

    $cookieHeader = implode('; ', $cookies);

    $opts['http']['method'] = 'POST';
    $opts['http']['header'] = "Content-Type: application/x-www-form-urlencoded\r\n" .
        "Cookie: $cookieHeader\r\n";
    $opts['http']['content'] = $postData;

    $ctx = stream_context_create($opts);
    $resp = file_get_contents($loginUrl, false, $ctx); // Removed @

    if ($resp === false) {
        $error = error_get_last();
        logMsg("❌ Connectivity Error (POST login.php): " . ($error['message'] ?? 'Unknown error'));
        exit(1);
    }

    // Parse cookies from POST response (Session regeneration, Remember Me)
    $headers = $http_response_header ?? [];
    $loginCookies = [];
    foreach ($headers as $h) {
        if (preg_match('/^Set-Cookie:\s*([^;]+)/i', $h, $m)) {
            $loginCookies[] = $m[1];
            logMsg("   -> New Cookie: {$m[1]}");
        }
    }

    // Merge new cookies with existing ones (e.g. CSRF cookie might persist, Session ID changes)
    // Simple strategy: prefer new cookies, keep old if not overwritten
    // Actually, simple array merge/replace for "Name=Value" strings is tricky.
    // For now, just appending new ones usually works with PHP stream context as it sends multiple Cookie headers or one combined.
    // Better: Update $cookies array.
    foreach ($loginCookies as $nc) {
        $name = explode('=', $nc)[0];
        // Remove old cookie with same name
        $cookies = array_filter($cookies, function ($c) use ($name) {
            return strpos($c, $name . '=') !== 0;
        });
        $cookies[] = $nc;
    }

    // Check for success: Did we get a session cookie? Or updated session?
    // Also check if response is a redirect (302) to index.php or specified redirect
    // If login fails, it usually renders login.php again with error (200 OK)

    $httpCode = 0;
    if (!empty($headers[0]) && preg_match('/(\d{3})/', $headers[0], $m)) {
        $httpCode = (int)$m[1];
    }

    if ($httpCode === 302) {
        logMsg("✅ Login successful (Redirect detected via HTTP $httpCode). Session captured.");
    } elseif ($httpCode === 200 && strpos($resp, 'logout') !== false) {
        // Already logged in or auto-login? Unlikely for POST.
        logMsg("✅ Login successful (Content check). Session captured.");
    } else {
        logMsg("⚠️  Login might have failed (HTTP $httpCode). Proceeding anyway to check.");
        // Debug: output part of response
        // echo substr($resp, 0, 500) . "\n";
        // Debug: output part of response if failing
        if ($httpCode !== 302) {
            logMsg("   Response Snippet: " . substr(strip_tags($resp), 0, 200));
        }
    }
}

$ok = 0;
$fail = 0;
$failures = [];

// Base context options
$baseOpts = [
    'http' => [
        'method' => 'GET',
        'timeout' => 10,
        'ignore_errors' => true,
        'follow_location' => true, // Follow redirects for pages
    ],
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
    ]
];

foreach ($pages as $page) {
    // Determine expected behavior for auth-required pages
    $isProtected = in_array($page, [
        '/profile.php',
        '/id_workbench.php',
        '/review_queue.php',
        '/create_event.php',
        '/survey.php',
        '/wellness.php',
        '/profile_edit.php'
    ]);

    $url = rtrim($baseUrl, '/') . $page;

    // Add cookies if authenticated
    if ($useAuth && !empty($cookies)) {
        $baseOpts['http']['header'] = "Cookie: " . implode('; ', $cookies) . "\r\n";
    } else {
        unset($baseOpts['http']['header']);
    }

    $ctx = stream_context_create($baseOpts);
    $body = @file_get_contents($url, false, $ctx);

    // Extract HTTP code
    $httpCode = 0;
    if (function_exists('http_get_last_response_headers')) {
        $headers = http_get_last_response_headers();
    } else {
        $headers = $http_response_header ?? [];
    }
    if (!empty($headers[0]) && preg_match('/(\d{3})/', $headers[0], $m)) {
        $httpCode = (int)$m[1];
    }

    if ($body === false) {
        logMsg("❌ $page — CONNECTION FAILED");
        $fail++;
        $failures[] = $page;
        continue;
    }

    $hasClosingTag = stripos($body, '</html>') !== false;
    $bodyLen = strlen($body);

    // Special cases
    $isExpected404 = ($httpCode === 404 && (strpos($page, 'observation_detail') !== false || strpos($page, 'event_detail') !== false));
    $isAdminPage = in_array($page, ['/review_queue.php']);

    // Auth logic:
    // - If guest: Protected pages redirect to login (302) -> OK if login page renders (which has </html>)
    // - If auth: Protected pages should return 200 OK -> Fail if still 302
    // - Exception: Admin pages redirect to home (302) for standard users -> OK

    $statusOk = true;
    if ($useAuth && $isProtected && $httpCode !== 200) {
        if ($isAdminPage && $httpCode === 302) {
            // Admin page redirecting standard user is expected
        } else {
            // Authenticated but got redirect/error
            logMsg("❌ $page (HTTP $httpCode) — Expected 200 (Auth)");
            $statusOk = false;
        }
    }

    if ($statusOk && ($hasClosingTag || $isExpected404)) {
        $extra = $isExpected404 ? ' [expected: no test data]' : '';
        if ($useAuth && $isProtected) {
            if ($isAdminPage && $httpCode === 302) $extra .= ' [Admin Redirect OK]';
            else $extra .= ' [Auth OK]';
        }
        logMsg("✅ $page (HTTP $httpCode, {$bodyLen}B)$extra");
        $ok++;
    } else {
        $lastChars = $bodyLen > 0 ? substr($body, max(0, $bodyLen - 120)) : '(empty)';
        $lastChars = preg_replace('/\s+/', ' ', $lastChars);
        if (!$statusOk) {
            // Already logged error
        } else {
            logMsg("❌ $page (HTTP $httpCode, {$bodyLen}B) — </html> MISSING");
            logMsg("   Last output: " . trim($lastChars));
        }
        $fail++;
        $failures[] = $page;
    }
}

logMsg("\n" . str_repeat('─', 50));
logMsg("Result: $ok OK / $fail FAIL");

if ($fail > 0) {
    logMsg("\n🚨 FAILED PAGES:");
    foreach ($failures as $f) {
        logMsg("  - $f");
    }
    logMsg("\n⚠️  Possible causes:");
    logMsg("  - Authenticated user couldn't access protected page (Session/Auth/Role issue)");
    logMsg("  - PHP Fatal Error mid-render (require_once missing)");
    exit(1);
}

logMsg("\n🎉 ALL PAGES HEALTHY");
exit(0);
