<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/ManagedSiteRegistry.php';

$pass = 0;
$fail = 0;

function assertSameManaged(string $label, $actual, $expected): void
{
    global $pass, $fail;
    if ($actual === $expected) {
        $pass++;
        echo "PASS {$label}\n";
        return;
    }

    $fail++;
    echo "FAIL {$label} expected=" . json_encode($expected, JSON_UNESCAPED_UNICODE) . " actual=" . json_encode($actual, JSON_UNESCAPED_UNICODE) . "\n";
}

$normalized = ManagedSiteRegistry::normalizeObservationContext([
    'cultivation' => 'wild',
    'organism_origin' => 'captive',
    'managed_context_type' => 'zoo',
    'managed_site_name' => '浜松市動物園',
    'managed_context_note' => '温室展示エリア',
]);

assertSameManaged('origin_kept', $normalized['organism_origin'], 'captive');
assertSameManaged('context_type', $normalized['managed_context']['type'], 'zoo');
assertSameManaged('site_name', $normalized['managed_context']['site_name'], '浜松市動物園');
assertSameManaged('wild_like_false', ManagedSiteRegistry::isWildLike('captive'), false);
assertSameManaged('wild_like_true', ManagedSiteRegistry::isWildLike('naturalized'), true);

$fallback = ManagedSiteRegistry::normalizeObservationContext([
    'cultivation' => 'cultivated',
    'managed_context_type' => 'unknown_value',
]);

assertSameManaged('fallback_origin', $fallback['organism_origin'], 'cultivated');
assertSameManaged('invalid_context_filtered', $fallback['managed_context']['type'], null);

echo "PASS={$pass} FAIL={$fail}\n";
exit($fail > 0 ? 1 : 0);
