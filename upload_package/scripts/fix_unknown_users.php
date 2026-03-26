<?php
/**
 * Fix observations with 'Unknown' or empty user_name.
 * Looks up user_id → UserStore to restore correct names.
 *
 * Usage: php scripts/fix_unknown_users.php [--dry-run]
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/UserStore.php';

$dryRun = in_array('--dry-run', $argv ?? []);
$totalFixed = 0;
$userCache = [];

function lookupUser(string $userId, array &$cache): ?array {
    if (isset($cache[$userId])) return $cache[$userId];
    $user = UserStore::findById($userId);
    $cache[$userId] = $user;
    return $user;
}

function needsFix(array $obs): bool {
    $name = $obs['user_name'] ?? '';
    return empty($name) || $name === 'Unknown' || $name === 'Guest';
}

// Fix legacy file
$legacyPath = DATA_DIR . '/observations.json';
if (file_exists($legacyPath)) {
    $obs = json_decode(file_get_contents($legacyPath), true) ?: [];
    $c = 0;
    foreach ($obs as $i => $o) {
        if (needsFix($o) && !empty($o['user_id'])) {
            $user = lookupUser($o['user_id'], $userCache);
            if ($user && !empty($user['name'])) {
                $obs[$i]['user_name'] = $user['name'];
                if (!empty($user['avatar'])) $obs[$i]['user_avatar'] = $user['avatar'];
                $c++;
            }
        }
    }
    if ($c > 0) {
        if (!$dryRun) {
            file_put_contents($legacyPath, json_encode($obs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        }
        echo "[legacy] Fixed {$c} observations" . ($dryRun ? ' (dry-run)' : '') . "\n";
        $totalFixed += $c;
    }
}

// Fix partitioned files
$partDir = DATA_DIR . '/observations';
if (is_dir($partDir)) {
    foreach (glob($partDir . '/*.json') as $file) {
        $obs = json_decode(file_get_contents($file), true) ?: [];
        $c = 0;
        foreach ($obs as $i => $o) {
            if (needsFix($o) && !empty($o['user_id'])) {
                $user = lookupUser($o['user_id'], $userCache);
                if ($user && !empty($user['name'])) {
                    $obs[$i]['user_name'] = $user['name'];
                    if (!empty($user['avatar'])) $obs[$i]['user_avatar'] = $user['avatar'];
                    $c++;
                }
            }
        }
        if ($c > 0) {
            if (!$dryRun) {
                file_put_contents($file, json_encode($obs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
            }
            echo "[" . basename($file) . "] Fixed {$c} observations" . ($dryRun ? ' (dry-run)' : '') . "\n";
            $totalFixed += $c;
        }
    }
}

echo "\nTotal fixed: {$totalFixed}" . ($dryRun ? ' (dry-run, no changes written)' : '') . "\n";
