<?php
/**
 * Fix identifications that were not migrated during account merge.
 * The original merge_accounts.php and fix_user_merge.php only updated
 * observation ownership but missed identifications[].user_id/user_name/user_avatar.
 *
 * Usage: php scripts/fix_merge_identifications.php [--dry-run]
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/UserStore.php';

$dryRun = in_array('--dry-run', $argv ?? []);

$mergeIds = ['user_69bd41455eeba', 'user_69bc926c2eca4', 'user_699f83a08bd2e'];
$targetId = 'user_admin_001';

$primary = UserStore::findById($targetId);
if (!$primary) {
    echo "ERROR: Primary user {$targetId} not found\n";
    exit(1);
}

$targetName = $primary['name'] ?? 'yamakit -A';
$targetAvatar = $primary['avatar'] ?? $primary['user_avatar'] ?? '';

echo "=== Fix Merge Identifications ===\n";
echo "Target: {$targetId} ({$targetName})\n";
echo "Avatar: {$targetAvatar}\n";
echo "Absorb IDs: " . implode(', ', $mergeIds) . "\n";
echo "Mode: " . ($dryRun ? 'DRY RUN' : 'LIVE') . "\n\n";

$totalIdFixed = 0;

function fixFile(string $path, string $targetId, string $targetName, string $targetAvatar, array $mergeIds, bool $dryRun): int {
    if (!file_exists($path)) return 0;

    $data = json_decode(file_get_contents($path), true);
    if (!is_array($data)) return 0;

    $fixed = 0;
    foreach ($data as $i => $obs) {
        $identifications = $obs['identifications'] ?? [];
        if (!is_array($identifications)) continue;

        foreach ($identifications as $j => $ident) {
            if (!is_array($ident)) continue;
            if (in_array($ident['user_id'] ?? '', $mergeIds)) {
                $data[$i]['identifications'][$j]['user_id'] = $targetId;
                $data[$i]['identifications'][$j]['user_name'] = $targetName;
                if ($targetAvatar) {
                    $data[$i]['identifications'][$j]['user_avatar'] = $targetAvatar;
                }
                $fixed++;
                echo "  FIX: obs={$obs['id']} ident={$ident['id']} old_uid={$ident['user_id']}\n";
            }
        }
    }

    if ($fixed > 0 && !$dryRun) {
        file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }

    return $fixed;
}

// Legacy observations.json
$legacyPath = DATA_DIR . '/observations.json';
$c = fixFile($legacyPath, $targetId, $targetName, $targetAvatar, $mergeIds, $dryRun);
if ($c > 0) echo "observations.json: fixed {$c} identifications\n";
$totalIdFixed += $c;

// Partition files
$dir = DATA_DIR . '/observations';
if (is_dir($dir)) {
    foreach (glob($dir . '/*.json') as $file) {
        if (strpos($file, '.bak') !== false) continue;
        $c = fixFile($file, $targetId, $targetName, $targetAvatar, $mergeIds, $dryRun);
        if ($c > 0) echo basename($file) . ": fixed {$c} identifications\n";
        $totalIdFixed += $c;
    }
}

echo "\n=== Done ===\n";
echo "Total identifications fixed: {$totalIdFixed}\n";

if ($dryRun && $totalIdFixed > 0) {
    echo "\nRun without --dry-run to apply changes.\n";
}
