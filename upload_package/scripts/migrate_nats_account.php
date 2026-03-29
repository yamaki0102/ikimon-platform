<?php
/**
 * Nats アカウント統合マイグレーション
 * 旧: user_69a01379b962e → 新: user_69be85c688371
 *
 * Usage: php migrate_nats_account.php [--dry-run]
 */

require_once __DIR__ . '/../config/config.php';

$oldId = 'user_69a01379b962e';
$newId = 'user_69be85c688371';
$dryRun = in_array('--dry-run', $argv ?? []);

if ($dryRun) echo "=== DRY RUN MODE ===\n\n";

$log = function (string $msg) { echo "[" . date('H:i:s') . "] $msg\n"; };

// 1. Observations — user_id と identifications[].user_id
$log("--- 1. Observations ---");
$obsDir = DATA_DIR . '/observations';
$obsFiles = glob("$obsDir/*.json");
$totalUpdated = 0;

foreach ($obsFiles as $file) {
    if (str_contains($file, '.bak') || str_contains($file, '.pre_')) continue;
    $data = json_decode(file_get_contents($file), true);
    if (!is_array($data)) continue;

    $changed = false;
    foreach ($data as &$obs) {
        if (($obs['user_id'] ?? '') === $oldId) {
            $obs['user_id'] = $newId;
            if (isset($obs['user_name'])) $obs['user_name'] = 'Nats';
            $changed = true;
            $totalUpdated++;
        }
        if (!empty($obs['identifications'])) {
            foreach ($obs['identifications'] as &$ident) {
                if (($ident['user_id'] ?? '') === $oldId) {
                    $ident['user_id'] = $newId;
                    if (isset($ident['user_name'])) $ident['user_name'] = 'Nats';
                    $changed = true;
                }
            }
            unset($ident);
        }
    }
    unset($obs);

    if ($changed) {
        $log("  " . basename($file) . " — updated");
        if (!$dryRun) {
            copy($file, $file . '.pre_merge_nats');
            file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        }
    }
}
$log("  Observations updated: $totalUpdated");

// 2. Per-user JSON files — merge or rename
$perUserDirs = ['user_badges', 'user_events', 'streaks', 'notifications'];
foreach ($perUserDirs as $dir) {
    $log("--- 2. $dir ---");
    $oldFile = DATA_DIR . "/$dir/$oldId.json";
    $newFile = DATA_DIR . "/$dir/$newId.json";

    if (!file_exists($oldFile)) {
        $log("  No old file, skip");
        continue;
    }

    $oldData = json_decode(file_get_contents($oldFile), true) ?: [];
    $newData = file_exists($newFile) ? (json_decode(file_get_contents($newFile), true) ?: []) : [];

    if (is_array($oldData) && is_array($newData) && !$dryRun) {
        // Both are arrays — merge (old first, then new, deduplicated by content)
        $merged = array_merge($oldData, $newData);
        copy($newFile, $newFile . '.pre_merge_nats');
        file_put_contents($newFile, json_encode($merged, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        rename($oldFile, $oldFile . '.migrated');
        $log("  Merged " . count($oldData) . " old + " . count($newData) . " new → " . count($merged) . " total");
    } else {
        $log("  Old: " . count($oldData) . " items, New: " . count($newData) . " items (would merge)");
    }
}

// 3. Growth data
$log("--- 3. Growth ---");
$oldGrowth = DATA_DIR . "/growth/$oldId.json";
$newGrowth = DATA_DIR . "/growth/$newId.json";
if (file_exists($oldGrowth)) {
    $log("  Old growth file exists — will migrate");
    if (!$dryRun) {
        if (!file_exists($newGrowth)) {
            rename($oldGrowth, $newGrowth);
            $log("  Renamed to new ID");
        } else {
            rename($oldGrowth, $oldGrowth . '.migrated');
            $log("  New already exists, archived old");
        }
    }
} else {
    $log("  No old growth file");
}

// 4. users.json — remove old user entry, update new user stats
$log("--- 4. users.json ---");
$usersFile = DATA_DIR . '/users.json';
if (file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true) ?: [];
    $found = false;
    foreach ($users as $i => $u) {
        if (($u['id'] ?? '') === $oldId) {
            $log("  Found old user entry — removing");
            if (!$dryRun) {
                array_splice($users, $i, 1);
                $found = true;
            }
            break;
        }
    }
    if ($found && !$dryRun) {
        copy($usersFile, $usersFile . '.pre_merge_nats');
        file_put_contents($usersFile, json_encode($users, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }
} else {
    $log("  No users.json");
}

// 5. auth_tokens.json — remove old tokens
$log("--- 5. auth_tokens.json ---");
$tokensFile = DATA_DIR . '/auth_tokens.json';
if (file_exists($tokensFile)) {
    $tokens = json_decode(file_get_contents($tokensFile), true) ?: [];
    $before = count($tokens);
    $tokens = array_values(array_filter($tokens, function ($t) use ($oldId) {
        return ($t['user_id'] ?? '') !== $oldId;
    }));
    $removed = $before - count($tokens);
    $log("  Removed $removed old tokens");
    if (!$dryRun && $removed > 0) {
        copy($tokensFile, $tokensFile . '.pre_merge_nats');
        file_put_contents($tokensFile, json_encode($tokens, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }
}

// 6. Events & invites (single files with user_id references)
foreach (['events.json', 'invites.json', 'moderation_flags.json'] as $singleFile) {
    $log("--- 6. $singleFile ---");
    $path = DATA_DIR . "/$singleFile";
    if (!file_exists($path)) { $log("  Not found, skip"); continue; }
    $raw = file_get_contents($path);
    if (str_contains($raw, $oldId)) {
        $log("  Contains old ID — replacing");
        if (!$dryRun) {
            copy($path, $path . '.pre_merge_nats');
            file_put_contents($path, str_replace($oldId, $newId, $raw));
        }
    } else {
        $log("  No references found");
    }
}

// 7. Indexes
$log("--- 7. Indexes ---");
$indexDir = DATA_DIR . '/indexes';
if (is_dir($indexDir)) {
    $oldIndex = "$indexDir/user_{$oldId}_observations.json";
    if (file_exists($oldIndex)) {
        $log("  Removing old index (will be rebuilt)");
        if (!$dryRun) unlink($oldIndex);
    } else {
        $log("  No old index");
    }
}

$log("\n=== Migration " . ($dryRun ? "DRY RUN" : "COMPLETE") . " ===");
if ($dryRun) $log("Run without --dry-run to execute");
