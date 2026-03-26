<?php
/**
 * Merge duplicate Google OAuth accounts.
 *
 * Scenario: User had admin account (user_admin_001) + Google login created
 * a separate account (user_69bd41455eeba). This script links the Google
 * OAuth to the admin account and migrates observations.
 *
 * Usage: php scripts/merge_accounts.php
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/UserStore.php';

$primaryId = 'user_admin_001';
$duplicateId = 'user_69bd41455eeba';
$googleOAuthId = '109612154557351287473';
$googleEmail = 'yamaki0102@gmail.com';

echo "=== Account Merge ===\n\n";

// 1. Link Google OAuth to primary account
echo "[1] Linking Google OAuth to primary account...\n";
$result = UserStore::linkOAuth($primaryId, 'google', $googleOAuthId);
if ($result) {
    echo "    OK: auth_provider = {$result['auth_provider']}\n";
    echo "    oauth_providers = " . json_encode($result['oauth_providers'] ?? []) . "\n";
} else {
    echo "    FAILED\n";
    exit(1);
}

// 2. Update primary account email (add Google email as secondary)
echo "\n[2] Adding Google email to primary account...\n";
$primary = UserStore::findById($primaryId);
$emails = $primary['emails'] ?? [];
if (!in_array($googleEmail, $emails)) {
    $emails[] = $googleEmail;
}
UserStore::update($primaryId, [
    'emails' => $emails,
    'google_email' => $googleEmail,
]);
echo "    OK: emails = " . json_encode($emails) . "\n";

// 3. Migrate observations from duplicate to primary
echo "\n[3] Migrating observations...\n";
$allObs = DataStore::fetchAll('observations');
$migrated = 0;
foreach ($allObs as $i => $obs) {
    if (($obs['user_id'] ?? '') === $duplicateId) {
        $allObs[$i]['user_id'] = $primaryId;
        $allObs[$i]['user_name'] = $primary['name'];
        $migrated++;
    }
}
if ($migrated > 0) {
    DataStore::save('observations', $allObs);
}
echo "    Migrated: {$migrated} observations\n";

// 4. Mark duplicate as merged (don't delete, keep audit trail)
echo "\n[4] Marking duplicate as merged...\n";
UserStore::update($duplicateId, [
    'merged_into' => $primaryId,
    'merged_at' => date('Y-m-d H:i:s'),
    'banned' => true, // Prevent login to duplicate
]);
echo "    OK: {$duplicateId} marked as merged into {$primaryId}\n";

echo "\n=== Merge Complete ===\n";
echo "Primary: {$primaryId} ({$primary['name']})\n";
echo "Duplicate: {$duplicateId} (banned, merged)\n";
echo "Observations migrated: {$migrated}\n";
