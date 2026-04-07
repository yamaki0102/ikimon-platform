<?php

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/UserStore.php';
require_once ROOT_DIR . '/libs/FieldScanInstallRegistry.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('POST method required.', 405);
}

if (!api_rate_limit('fieldscan_install', 20, 60)) {
    api_error('Rate limit exceeded.', 429);
}

$body = api_json_body();
if (!is_array($body)) {
    api_error('Invalid request body.', 400);
}

if (isset($body['device']) && mb_strlen((string)$body['device']) > 100) {
    api_error('Device name too long.', 400);
}
if (isset($body['app_version']) && !preg_match('/^[\d.\-a-zA-Z]{1,30}$/', (string)$body['app_version'])) {
    api_error('Invalid app_version format.', 400);
}
if (isset($body['platform']) && !in_array((string)$body['platform'], ['android', 'ios', 'web'], true)) {
    $body['platform'] = 'android';
}

Auth::init();

$authUser = Auth::isLoggedIn() ? Auth::user() : null;
$result = FieldScanInstallRegistry::register($body, $authUser);

api_success($result);
