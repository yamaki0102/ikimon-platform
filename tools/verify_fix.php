<?php
$pages = ['post.php', 'corporate_dashboard.php', 'offline.php'];
foreach ($pages as $p) {
    $ctx = stream_context_create(['http' => ['timeout' => 10, 'ignore_errors' => true]]);
    $body = @file_get_contents('http://localhost:8899/' . $p, false, $ctx);
    $headers = http_get_last_response_headers();
    $status = $headers[0] ?? 'UNKNOWN';
    $size = strlen($body);
    $hasFatal = strpos($body, 'Fatal error') !== false;
    $hasWarn = strpos($body, 'Warning:') !== false;
    echo str_pad($p, 35) . ' => ' . trim($status) . ' (' . number_format($size) . 'B)';
    if ($hasFatal) echo ' [FATAL]';
    if ($hasWarn) echo ' [WARN]';
    echo PHP_EOL;
}
