<?php

require_once __DIR__ . '/../upload_package/config/config.php';
require_once __DIR__ . '/../upload_package/libs/DataStore.php';

$mode = strtolower((string)($argv[1] ?? ''));
if (!in_array($mode, ['on', 'off'], true)) {
    fwrite(STDERR, "Usage: php scripts/set_invite_only_mode.php [on|off] [optional message]\n");
    exit(1);
}

$message = trim(implode(' ', array_slice($argv, 2)));
$existing = DataStore::get('system/access_policy');
if (!is_array($existing)) {
    $existing = [];
}

$policy = array_merge($existing, [
    'invite_only' => $mode === 'on',
]);

if ($message !== '') {
    $policy['invite_message'] = $message;
}

DataStore::save('system/access_policy', $policy);

fwrite(STDOUT, json_encode($policy, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL);
