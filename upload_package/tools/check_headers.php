<?php
$url = "https://ikimon.life/site_dashboard.php?site=ikan_hq";
// User-Agentを設定しないと403になることがあるので設定
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36\r\n"
    ]
]);
$headers = get_headers($url, 1, $context);

if ($headers === false) {
    echo "Failed to fetch headers.\n";
    exit(1);
}

if (isset($headers['Content-Security-Policy'])) {
    echo "Found CSP Header:\n";
    $csp = is_array($headers['Content-Security-Policy']) ? end($headers['Content-Security-Policy']) : $headers['Content-Security-Policy'];
    echo $csp . "\n\n";

    $checks = [
        'worker-src' => "worker-src 'self' blob:",
        'child-src'  => "child-src 'self' blob:",
        'connect-src' => "connect-src",
        'img-src'     => "img-src",
        'style.json'  => "https://tile.openstreetmap.jp"
    ];

    foreach ($checks as $key => $val) {
        if (strpos($csp, $key) !== false) {
            echo "✅ {$key} found\n";
        } else {
            echo "❌ {$key} NOT found\n";
        }
    }
} else {
    echo "❌ No CSP Header Found\n";
    print_r($headers);
}
