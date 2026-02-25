<?php

/**
 * 本番用デモデータ削除スクリプト
 * サーバーの ~/public_html/ikimon.life/ 直下で実行
 */

// 本番のパスに合わせる
$baseDir = dirname(__DIR__); // ~/public_html/ikimon.life/
require_once $baseDir . '/config/config.php';
require_once $baseDir . '/libs/DataStore.php';

$dryRun = in_array('--dry-run', $argv ?? []);
echo ($dryRun ? "=== DRY RUN ===" : "=== EXECUTING ===") . "\n\n";

$keepUserIds = ['user_ya_001', 'user_admin_001'];
function shouldKeep(string $userId): bool
{
    global $keepUserIds;
    if (in_array($userId, $keepUserIds)) return true;
    if (strpos($userId, 'guest_') === 0) return true;
    return false;
}

$stats = [];

// Users
$usersFile = DATA_DIR . '/users.json';
$users = json_decode(file_get_contents($usersFile), true) ?: [];
$orig = count($users);
$kept = array_values(array_filter($users, fn($u) => shouldKeep($u['id'] ?? '')));
$stats['users'] = $orig . ' -> ' . count($kept);
if (!$dryRun) file_put_contents($usersFile, json_encode($kept, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

// User profile dirs
$usersDir = DATA_DIR . '/users';
if (is_dir($usersDir)) {
    foreach (glob($usersDir . '/*.json') as $uf) {
        $d = json_decode(file_get_contents($uf), true);
        $uid = $d['id'] ?? basename($uf, '.json');
        if (!shouldKeep($uid)) {
            if (!$dryRun) unlink($uf);
        }
    }
}

// Observations
$obsMain = DATA_DIR . '/observations.json';
if (file_exists($obsMain)) {
    $all = json_decode(file_get_contents($obsMain), true) ?: [];
    $orig = count($all);
    $kept = array_values(array_filter($all, fn($o) => shouldKeep($o['user_id'] ?? '')));
    $stats['obs_main'] = $orig . ' -> ' . count($kept);
    if (!$dryRun) file_put_contents($obsMain, json_encode($kept, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}
$obsDir = DATA_DIR . '/observations';
if (is_dir($obsDir)) {
    foreach (glob($obsDir . '/*.json') as $pf) {
        $all = json_decode(file_get_contents($pf), true) ?: [];
        $kept = array_values(array_filter($all, fn($o) => shouldKeep($o['user_id'] ?? '')));
        if (!$dryRun) {
            if (empty($kept)) unlink($pf);
            else file_put_contents($pf, json_encode($kept, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
    }
}

// Identifications
$idFile = DATA_DIR . '/identifications.json';
if (file_exists($idFile)) {
    $all = json_decode(file_get_contents($idFile), true) ?: [];
    $orig = count($all);
    $kept = array_values(array_filter($all, fn($i) => shouldKeep($i['user_id'] ?? '')));
    $stats['identifications'] = $orig . ' -> ' . count($kept);
    if (!$dryRun) file_put_contents($idFile, json_encode($kept, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// Events
$evFile = DATA_DIR . '/events.json';
if (file_exists($evFile)) {
    $all = json_decode(file_get_contents($evFile), true) ?: [];
    $orig = count($all);
    $kept = array_values(array_filter($all, fn($e) => shouldKeep($e['created_by'] ?? ($e['user_id'] ?? ''))));
    $stats['events'] = $orig . ' -> ' . count($kept);
    if (!$dryRun) file_put_contents($evFile, json_encode($kept, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// Badges
$bd = DATA_DIR . '/user_badges';
if (is_dir($bd)) foreach (glob($bd . '/*.json') as $f) {
    $uid = basename($f, '.json');
    if (!shouldKeep($uid) && !$dryRun) unlink($f);
}

// My fields
$fd = DATA_DIR . '/my_fields';
if (is_dir($fd)) foreach (glob($fd . '/*.json') as $f) {
    $d = json_decode(file_get_contents($f), true);
    $uid = $d['user_id'] ?? '';
    if (!shouldKeep($uid) && !$dryRun) unlink($f);
}

// Notifications
$nd = DATA_DIR . '/notifications';
if (is_dir($nd)) foreach (glob($nd . '/*.json') as $f) {
    $uid = basename($f, '.json');
    if (!shouldKeep($uid) && !$dryRun) unlink($f);
}

// Cache
foreach ([DATA_DIR . '/cache', DATA_DIR . '/counts'] as $dir) {
    if (is_dir($dir)) foreach (glob($dir . '/*') as $f) {
        if (is_file($f) && !$dryRun) unlink($f);
    }
}

// Analytics
$ad = DATA_DIR . '/analytics';
if (is_dir($ad)) foreach (glob($ad . '/*.json') as $f) {
    if (!$dryRun) file_put_contents($f, '[]');
}

echo "Stats: " . json_encode($stats) . "\n";
echo ($dryRun ? "DRY RUN COMPLETE\n" : "PURGE COMPLETE\n");
