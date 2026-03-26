<?php
$input = file_get_contents('php://input');
$data = json_decode($input, true);
if ($data && !empty($data['msg'])) {
    $line = date('c') . ' | ' . ($data['msg'] ?? '') . ' | ' . ($data['ua'] ?? '') . "\n";
    $dir = __DIR__ . '/../../../data/client_logs';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    file_put_contents($dir . '/voice_guide_debug.log', $line, FILE_APPEND | LOCK_EX);
}
http_response_code(204);
