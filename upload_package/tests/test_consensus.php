<?php

/**
 * Consensus Engine Scenario Tests (ASCII output)
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/BioUtils.php';

$pass = 0;
$fail = 0;
$tests = [];

// Status constants for comparison
$ST_CASUAL = 'Casual';
$ST_NEEDS  = '未同定';
$ST_PROP   = '要同定';
$ST_RG     = '研究用';

function make_obs(array $overrides = []): array
{
    return array_merge([
        'id' => 'test',
        'photos' => ['/img/test.jpg'],
        'location_lat' => 34.97,
        'location_lng' => 138.39,
        'observed_at' => '2025-06-01',
        'identifications' => [],
    ], $overrides);
}

function check(string $label, string $expected, array &$obs): void
{
    global $pass, $fail, $tests;
    BioUtils::updateConsensus($obs);
    $actual = $obs['status'] ?? '(empty)';
    $ok = ($actual === $expected);
    if ($ok) {
        $pass++;
    } else {
        $fail++;
    }
    $mark = $ok ? 'PASS' : 'FAIL';
    // Convert to hex for safe display
    $exp_hex = bin2hex($expected);
    $act_hex = bin2hex($actual);
    $tests[] = "$mark | $label | exp_hex=$exp_hex | act_hex=$act_hex";
}

// 1: No photo
$o = make_obs(['photos' => [], 'identifications' => [
    ['user_id' => 'u1', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
]]);
check('no_photo', $ST_CASUAL, $o);

// 2: No location
$o = make_obs(['location_lat' => null, 'location_lng' => null, 'identifications' => [
    ['user_id' => 'u1', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
]]);
check('no_location', $ST_CASUAL, $o);

// 3: No date
$o = make_obs(['observed_at' => null, 'identifications' => [
    ['user_id' => 'u1', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
]]);
check('no_date', $ST_CASUAL, $o);

// 4: Captive
$o = make_obs(['is_captive' => true, 'identifications' => [
    ['user_id' => 'u1', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
    ['user_id' => 'u2', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
    ['user_id' => 'u3', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
]]);
check('captive', $ST_CASUAL, $o);

// 5: Zero IDs
$o = make_obs(['identifications' => []]);
check('zero_ids', $ST_NEEDS, $o);

// 6: 1 ID
$o = make_obs(['identifications' => [
    ['user_id' => 'u1', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
]]);
check('one_id', $ST_PROP, $o);

// 7: 2/2 agree
$o = make_obs(['identifications' => [
    ['user_id' => 'u1', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
    ['user_id' => 'u2', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
]]);
check('2_of_2_agree', $ST_RG, $o);

// 8: 2/3 agree
$o = make_obs(['identifications' => [
    ['user_id' => 'u1', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
    ['user_id' => 'u2', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
    ['user_id' => 'u3', 'taxon_name' => 'B', 'created_at' => '2025-06-01'],
]]);
check('2_of_3_agree', $ST_RG, $o);

// 9: All disagree (1/3 each)
$o = make_obs(['identifications' => [
    ['user_id' => 'u1', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
    ['user_id' => 'u2', 'taxon_name' => 'B', 'created_at' => '2025-06-01'],
    ['user_id' => 'u3', 'taxon_name' => 'C', 'created_at' => '2025-06-01'],
]]);
check('all_disagree', $ST_PROP, $o);

// 10: Same user dedup
$o = make_obs(['identifications' => [
    ['user_id' => 'u1', 'taxon_name' => 'A', 'created_at' => '2025-06-01 10:00'],
    ['user_id' => 'u1', 'taxon_name' => 'B', 'created_at' => '2025-06-01 12:00'],
    ['user_id' => 'u2', 'taxon_name' => 'B', 'created_at' => '2025-06-01'],
]]);
check('same_user_dedup', $ST_RG, $o);

// 11: Open dispute blocks RG
$o = make_obs(['identifications' => [
    ['user_id' => 'u1', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
    ['user_id' => 'u2', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
    ['user_id' => 'u3', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
], 'disputes' => [
    ['id' => 'disp_1', 'status' => 'open', 'type' => 'disagree'],
]]);
check('open_dispute_blocks', $ST_PROP, $o);

// 12: Resolved dispute does NOT block
$o = make_obs(['identifications' => [
    ['user_id' => 'u1', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
    ['user_id' => 'u2', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
], 'disputes' => [
    ['id' => 'disp_1', 'status' => 'resolved', 'type' => 'disagree'],
]]);
check('resolved_dispute_ok', $ST_RG, $o);

// 13: Observer + 1 agreement
$o = make_obs(['user_id' => 'observer1', 'identifications' => [
    ['user_id' => 'observer1', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
    ['user_id' => 'u2', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
]]);
check('observer_plus_one', $ST_RG, $o);

// 14: Pending dispute blocks RG (New)
$o = make_obs(['identifications' => [
    ['user_id' => 'u1', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
    ['user_id' => 'u2', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
    ['user_id' => 'u3', 'taxon_name' => 'A', 'created_at' => '2025-06-01'],
], 'disputes' => [
    ['id' => 'disp_1', 'status' => 'pending', 'type' => 'escalate'],
]]);
check('pending_dispute_blocks', $ST_PROP, $o);

// Output
echo "RESULTS\n";
foreach ($tests as $t) echo "$t\n";
echo "PASS=$pass FAIL=$fail TOTAL=" . ($pass + $fail) . "\n";
exit($fail > 0 ? 1 : 0);
