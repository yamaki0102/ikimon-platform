<?php
// エラーページの詳細取得
$pages = ['post.php', 'corporate_dashboard.php', 'offline.php'];
$base = 'http://localhost:8899/';
$ctx = stream_context_create(['http' => ['ignore_errors' => true, 'timeout' => 5]]);

foreach ($pages as $p) {
    echo "=== {$p} ===" . PHP_EOL;
    $body = @file_get_contents($base . $p, false, $ctx);
    $headers = http_get_last_response_headers() ?: [];
    foreach ($headers as $h) {
        if (preg_match('/^HTTP/', $h)) echo "  STATUS: {$h}" . PHP_EOL;
    }
    if ($body === false) {
        echo "  BODY: (no response)" . PHP_EOL;
    } else {
        // Show only error-related lines
        $lines = explode("\n", $body);
        foreach ($lines as $line) {
            $l = trim($line);
            if (
                stripos($l, 'error') !== false ||
                stripos($l, 'warning') !== false ||
                stripos($l, 'fatal') !== false ||
                stripos($l, 'exception') !== false ||
                stripos($l, 'undefined') !== false ||
                stripos($l, 'stack trace') !== false
            ) {
                echo "  " . strip_tags($l) . PHP_EOL;
            }
        }
        if (strlen($body) < 200) {
            echo "  FULL BODY: " . strip_tags($body) . PHP_EOL;
        }
    }
    echo PHP_EOL;
}
