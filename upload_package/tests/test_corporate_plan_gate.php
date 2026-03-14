<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/CorporateManager.php';
require_once __DIR__ . '/../libs/CorporatePlanGate.php';

function assertPlanTrue(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assertPlanSame($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        throw new RuntimeException($message . ' expected=' . var_export($expected, true) . ' actual=' . var_export($actual, true));
    }
}

$base = sys_get_temp_dir() . '/ikimon-plan-gate-' . bin2hex(random_bytes(4));
@mkdir($base, 0777, true);
DataStore::setPath($base);
DataStore::save('corporations', []);

$communityId = CorporateManager::register('Community Org');
$publicId = CorporateManager::register('Public Org', 'public');
$legacyId = CorporateManager::register('Legacy Pro Org', 'pro');

$community = CorporateManager::get($communityId);
$public = CorporateManager::get($publicId);
$legacy = CorporateManager::get($legacyId);

assertPlanSame('community', $community['plan'] ?? null, 'default corporation plan should be community');
assertPlanSame('public', $public['plan'] ?? null, 'explicit public plan should stay public');
assertPlanSame('public', $legacy['plan'] ?? null, 'legacy pro plan should normalize to public');

assertPlanTrue(!CorporatePlanGate::canUseAdvancedOutputs($community), 'community should not export advanced outputs');
assertPlanTrue(!CorporatePlanGate::canRevealSpeciesDetails($community), 'community should hide species details');
assertPlanTrue(CorporatePlanGate::canUseAdvancedOutputs($public), 'public should export advanced outputs');
assertPlanTrue(CorporatePlanGate::canRevealSpeciesDetails($public), 'public should reveal species details');

echo "OK\n";
