<?php
/**
 * Merge Nats accounts into one.
 *
 * Primary:   user_69be85c688371 (Nats2) → renamed to "Nats"
 * Absorbed:  user_69a01379b962e (Nats, legacy, 51 obs + 1 id)
 * Absorbed:  user_69be85ed81804 (natsuki ishikawa, 0 obs, Google OAuth)
 *
 * Steps:
 *   1. Backup users.json
 *   2. Migrate observations (legacy + partitions) user_id/user_name/user_avatar
 *   3. Migrate identifications inside observations
 *   4. Rename primary to "Nats"
 *   5. Link second Google OAuth to primary
 *   6. Merge scores/badges/stats (sum post_count, recalc)
 *   7. Merge quest_log
 *   8. Mark absorbed accounts as merged
 *   9. Clear cache
 *
 * Usage: php scripts/merge_nats_accounts.php [--dry-run]
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/UserStore.php';
require_once __DIR__ . '/../libs/Cache.php';

$dryRun = in_array('--dry-run', $argv ?? []);
if ($dryRun) echo "*** DRY RUN MODE ***\n\n";

$primaryId = 'user_69be85c688371';    // Nats2 (Google auth)
$absorbIds = [
    'user_69a01379b962e',              // Nats (legacy, 51 obs)
    'user_69be85ed81804',              // natsuki ishikawa (Google, 0 obs)
];
$newName = 'Nats';

echo "=== Nats Account Merge ===\n";
echo "Primary: {$primaryId}\n";
echo "Absorb:  " . implode(', ', $absorbIds) . "\n";
echo "New name: {$newName}\n\n";

// Load primary user
$primary = UserStore::findById($primaryId);
if (!$primary) {
    echo "ERROR: Primary user not found!\n";
    exit(1);
}

// Load absorbed users
$absorbed = [];
foreach ($absorbIds as $aid) {
    $u = UserStore::findById($aid);
    if (!$u) {
        echo "WARNING: {$aid} not found, skipping\n";
        continue;
    }
    $absorbed[$aid] = $u;
}

// --- Step 1: Backup ---
echo "[1] Backing up users.json...\n";
$usersPath = DATA_DIR . '/users.json';
$backupPath = DATA_DIR . '/users_backup_' . date('Ymd_His') . '.json';
if (!$dryRun) {
    copy($usersPath, $backupPath);
}
echo "    Backup: {$backupPath}\n";

// --- Step 2+3: Migrate observations (user_id + identifications) ---
echo "\n[2] Migrating observations...\n";
$primaryAvatar = $primary['avatar'] ?? '';
$totalObsMigrated = 0;
$totalIdMigrated = 0;

function migrateObsFile(string $path, string $primaryId, string $newName, string $avatar, array $absorbIds, bool $dryRun): array {
    if (!file_exists($path)) return [0, 0];
    $data = json_decode(file_get_contents($path), true);
    if (!is_array($data)) return [0, 0];

    $obsChanged = 0;
    $idChanged = 0;

    foreach ($data as $i => $obs) {
        // Migrate observation ownership
        if (in_array($obs['user_id'] ?? '', $absorbIds)) {
            $data[$i]['user_id'] = $primaryId;
            $data[$i]['user_name'] = $newName;
            if ($avatar) $data[$i]['user_avatar'] = $avatar;
            $obsChanged++;
        }

        // Migrate identifications within observations
        $identifications = $obs['identifications'] ?? [];
        if (is_array($identifications)) {
            foreach ($identifications as $j => $ident) {
                if (is_array($ident) && in_array($ident['user_id'] ?? '', $absorbIds)) {
                    $data[$i]['identifications'][$j]['user_id'] = $primaryId;
                    $data[$i]['identifications'][$j]['user_name'] = $newName;
                    if ($avatar) $data[$i]['identifications'][$j]['user_avatar'] = $avatar;
                    $idChanged++;
                }
            }
        }
    }

    if (($obsChanged > 0 || $idChanged > 0) && !$dryRun) {
        file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }

    return [$obsChanged, $idChanged];
}

// Legacy observations.json
$legacyPath = DATA_DIR . '/observations.json';
[$oc, $ic] = migrateObsFile($legacyPath, $primaryId, $newName, $primaryAvatar, $absorbIds, $dryRun);
echo "    observations.json: obs={$oc}, ids={$ic}\n";
$totalObsMigrated += $oc;
$totalIdMigrated += $ic;

// Partition files
$partDir = DATA_DIR . '/observations';
if (is_dir($partDir)) {
    foreach (glob($partDir . '/*.json') as $file) {
        if (strpos($file, '.bak') !== false) continue;
        [$oc, $ic] = migrateObsFile($file, $primaryId, $newName, $primaryAvatar, $absorbIds, $dryRun);
        if ($oc > 0 || $ic > 0) {
            echo "    " . basename($file) . ": obs={$oc}, ids={$ic}\n";
        }
        $totalObsMigrated += $oc;
        $totalIdMigrated += $ic;
    }
}
echo "    Total: obs={$totalObsMigrated}, ids={$totalIdMigrated}\n";

// --- Step 4: Rename + merge stats ---
echo "\n[3] Updating primary user profile...\n";

// Combine stats
$totalPosts = ($primary['post_count'] ?? 0);
$totalScore = ($primary['score'] ?? 0);
$totalIdCount = ($primary['id_count'] ?? 0);
$totalSpecies = ($primary['species_count'] ?? 0);
$allBadges = $primary['badges'] ?? [];

foreach ($absorbed as $aid => $u) {
    $totalPosts += ($u['post_count'] ?? 0);
    $totalScore += ($u['score'] ?? 0);
    $totalIdCount += ($u['id_count'] ?? 0);
    $totalSpecies += ($u['species_count'] ?? 0);
    foreach (($u['badges'] ?? []) as $badge) {
        if (!in_array($badge, $allBadges)) {
            $allBadges[] = $badge;
        }
    }
}

echo "    Combined: posts={$totalPosts}, score={$totalScore}, ids={$totalIdCount}, species={$totalSpecies}\n";
echo "    Badges: " . implode(', ', $allBadges) . "\n";

// --- Step 5: Link second Google OAuth ---
echo "\n[4] Linking additional Google OAuth...\n";
$oauthProviders = $primary['oauth_providers'] ?? [];
if (empty($oauthProviders) && !empty($primary['oauth_id'])) {
    $oauthProviders[] = [
        'provider' => $primary['auth_provider'] ?? 'google',
        'oauth_id' => $primary['oauth_id'],
        'linked_at' => $primary['created_at'] ?? date('Y-m-d H:i:s'),
    ];
}

foreach ($absorbed as $aid => $u) {
    if (!empty($u['oauth_id'])) {
        $exists = false;
        foreach ($oauthProviders as $op) {
            if (($op['oauth_id'] ?? '') === $u['oauth_id']) {
                $exists = true;
                break;
            }
        }
        if (!$exists) {
            $oauthProviders[] = [
                'provider' => $u['auth_provider'] ?? 'google',
                'oauth_id' => $u['oauth_id'],
                'linked_at' => date('Y-m-d H:i:s'),
            ];
            echo "    Linked: {$u['auth_provider']} ({$u['email']})\n";
        }
    }
    // Collect emails
    $emails = $primary['emails'] ?? [];
    if (!empty($u['email']) && !in_array($u['email'], $emails)) {
        $emails[] = $u['email'];
    }
}

// --- Step 6: Merge quest_log ---
echo "\n[5] Merging quest logs...\n";
$mergedQuests = [];
if (is_array($primary['quest_log'] ?? null)) {
    $mergedQuests = $primary['quest_log'];
}
foreach ($absorbed as $aid => $u) {
    $ql = $u['quest_log'] ?? [];
    if (is_array($ql)) {
        foreach ($ql as $date => $quests) {
            if (!isset($mergedQuests[$date])) {
                $mergedQuests[$date] = $quests;
            } else {
                if (is_array($quests)) {
                    $mergedQuests[$date] = array_merge($mergedQuests[$date], $quests);
                }
            }
        }
    }
}
echo "    Quest dates: " . count($mergedQuests) . "\n";

// --- Apply primary update ---
$emails = $primary['emails'] ?? [];
foreach ($absorbed as $aid => $u) {
    if (!empty($u['email']) && !in_array($u['email'], $emails)) {
        $emails[] = $u['email'];
    }
}

$updateData = [
    'name' => $newName,
    'post_count' => $totalPosts,
    'score' => $totalScore,
    'id_count' => $totalIdCount,
    'species_count' => $totalSpecies,
    'badges' => $allBadges,
    'oauth_providers' => $oauthProviders,
    'emails' => $emails,
    'quest_log' => $mergedQuests,
];

echo "\n[6] Saving primary user update...\n";
if (!$dryRun) {
    UserStore::update($primaryId, $updateData);
}
echo "    OK: {$primaryId} → \"{$newName}\"\n";

// --- Step 7: Mark absorbed as merged ---
echo "\n[7] Marking absorbed accounts...\n";
foreach ($absorbIds as $aid) {
    if (!$dryRun) {
        UserStore::update($aid, [
            'merged_into' => $primaryId,
            'merged_at' => date('Y-m-d H:i:s'),
            'banned' => true,
        ]);
    }
    echo "    {$aid} → merged + banned\n";
}

// --- Step 8: Clear cache ---
echo "\n[8] Clearing cache...\n";
if (!$dryRun) {
    Cache::Init();
    $cacheDir = DATA_DIR . '/cache';
    if (is_dir($cacheDir)) {
        foreach (glob($cacheDir . '/*') as $f) @unlink($f);
    }
}
echo "    Done\n";

// --- Verify ---
echo "\n=== Verification ===\n";
if (!$dryRun) {
    $updated = UserStore::findById($primaryId);
    echo "Name: {$updated['name']}\n";
    echo "Posts: {$updated['post_count']}\n";
    echo "Score: {$updated['score']}\n";
    echo "IDs: {$updated['id_count']}\n";
    echo "Species: {$updated['species_count']}\n";
    echo "Badges: " . implode(', ', $updated['badges'] ?? []) . "\n";
    echo "OAuth providers: " . count($updated['oauth_providers'] ?? []) . "\n";
    echo "Emails: " . implode(', ', $updated['emails'] ?? []) . "\n";

    // Count observations
    $all = DataStore::fetchAll('observations');
    $count = 0;
    foreach ($all as $o) {
        if (($o['user_id'] ?? '') === $primaryId) $count++;
    }
    echo "Total observations owned: {$count}\n";
} else {
    echo "(skipped in dry-run)\n";
}

echo "\n=== Merge " . ($dryRun ? "DRY RUN " : "") . "Complete ===\n";
