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
Auth::init();

$authUser = Auth::isLoggedIn() ? Auth::user() : null;
$result = FieldScanInstallRegistry::register($body, $authUser);

api_success($result);
