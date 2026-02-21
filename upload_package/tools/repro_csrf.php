<?php

/**
 * CSRF Reproduction Script (cURL version)
 * Verifies that the API kicks backend requests without a token,
 * and accepts requests with a valid token pair (cookie + header).
 */

$baseUrl = 'http://localhost:8899/api/post_identification.php';

function test($name, $headers, $cookies, $expectCode, $expectContent = null)
{
    global $baseUrl;
    echo "Testing: $name ... ";

    $ch = curl_init($baseUrl);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['foo' => 'bar']));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true); // Include header in output

    // Set Headers
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    // Set Cookies
    if ($cookies) {
        $cookieStr = [];
        foreach ($cookies as $k => $v) $cookieStr[] = "$k=$v";
        curl_setopt($ch, CURLOPT_COOKIE, implode('; ', $cookieStr));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    // Separate header and body
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $body = substr($response, $headerSize);

    curl_close($ch);

    if ($httpCode === $expectCode) {
        if ($expectContent && strpos($body, $expectContent) === false) {
            echo "FAIL (Code OK, but Content mismatch)\n";
            echo "   Expected content: $expectContent\n";
            echo "   Got: " . substr($body, 0, 100) . "...\n";
            return;
        }
        echo "PASS (Got $httpCode)\n";
    } else {
        echo "FAIL\n";
        echo "   Expected: $expectCode, Got: $httpCode\n";
        echo "   Response: " . substr($body, 0, 100) . "...\n";
    }
}

echo "=== CSRF Enforcement Check (cURL) ===\n";

// 1. No Token at all
test(
    "1. No Token",
    ['Content-Type: application/json'],
    [],
    403
);

// 2. Token mismatch (Cookie set, but Header missing)
test(
    "2. Missing Header",
    ['Content-Type: application/json'],
    ['ikimon_csrf' => 'deadbeefdeadbeef'],
    403
);

// 3. Token mismatch (Cookie set, Header wrong)
test(
    "3. Token Mismatch",
    ['Content-Type: application/json', 'X-CSRF-Token: wrongtoken'],
    ['ikimon_csrf' => 'deadbeefdeadbeef'],
    403
);

// 4. Valid Token Pair
$validToken = str_repeat('a', 64); // 64 chars hex
test(
    "4. Valid Token Pair",
    ['Content-Type: application/json', "X-CSRF-Token: $validToken"],
    ['ikimon_csrf' => $validToken],
    200,
    "Login required" // Expecting to pass CSRF and hit Login check
);
