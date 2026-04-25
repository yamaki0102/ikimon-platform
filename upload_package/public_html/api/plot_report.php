<?php

header('Content-Type: application/json; charset=utf-8');
http_response_code(410);

echo json_encode([
    'success' => false,
    'message' => 'Legacy PHP plot report is disabled. Use the platform_v2 plot monitoring API.',
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
