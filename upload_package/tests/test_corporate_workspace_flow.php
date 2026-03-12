<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BusinessApplicationManager.php';
require_once __DIR__ . '/../libs/CorporateInviteManager.php';
require_once __DIR__ . '/../libs/CorporateManager.php';

function assertWorkspaceTrue(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assertWorkspaceSame($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        throw new RuntimeException($message . ' expected=' . var_export($expected, true) . ' actual=' . var_export($actual, true));
    }
}

function setupWorkspaceSandbox(): string
{
    $base = sys_get_temp_dir() . '/ikimon-workspace-' . bin2hex(random_bytes(4));
    @mkdir($base, 0777, true);
    DataStore::setPath($base);
    DataStore::save('corporations', []);
    DataStore::save('corporate_invites', []);
    DataStore::save('business_applications', []);
    return $base;
}

setupWorkspaceSandbox();

$application = BusinessApplicationManager::create([
    'company' => 'Test City',
    'contact_name' => 'Owner User',
    'email' => 'owner@example.com',
    'site_name' => 'Main Park',
    'plan' => 'public',
]);

$application = BusinessApplicationManager::provisionCorporation((string)$application['id'], 'tester');
$corpId = (string)($application['workspace']['corporation_id'] ?? '');
assertWorkspaceTrue($corpId !== '', 'provision should create a corporation');
assertWorkspaceSame('onboarding', $application['status'] ?? null, 'provision keeps onboarding status');

$claimed = BusinessApplicationManager::claimWorkspace((string)$application['reference'], 'owner@example.com', [
    'id' => 'user_owner',
    'email' => 'owner@example.com',
]);
assertWorkspaceSame('active', $claimed['status'] ?? null, 'claim should activate workspace');
$corporation = CorporateManager::get($corpId);
assertWorkspaceSame('owner', $corporation['members']['user_owner']['role'] ?? null, 'first claimant should become owner');

$invite = CorporateInviteManager::create($corpId, 'editor@example.com', 'editor', 'user_owner');
assertWorkspaceTrue(!empty($invite['token']), 'invite should include raw token');

$accepted = CorporateInviteManager::accept((string)$invite['token'], [
    'id' => 'user_editor',
    'email' => 'editor@example.com',
]);
assertWorkspaceSame(true, $accepted['success'] ?? false, 'invite should accept with matching email');
$corporation = CorporateManager::get($corpId);
assertWorkspaceSame('editor', $corporation['members']['user_editor']['role'] ?? null, 'accepted invite should add member with invite role');

$rejected = CorporateInviteManager::accept((string)$invite['token'], [
    'id' => 'user_other',
    'email' => 'other@example.com',
]);
assertWorkspaceSame(false, $rejected['success'] ?? true, 'accepted invite cannot be reused');

echo "OK\n";
