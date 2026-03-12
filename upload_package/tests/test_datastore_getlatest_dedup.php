<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';

$pass = 0;
$fail = 0;

function assertSameLatest(string $label, $actual, $expected): void
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

$base = sys_get_temp_dir() . '/ikimon_datastore_' . bin2hex(random_bytes(4));
$resource = 'observations_latest_test_' . bin2hex(random_bytes(3));
@mkdir($base . '/' . $resource, 0777, true);

$originalBasePath = DataStore::getBasePath();
DataStore::setPath($base);

$partitionRows = [
    ['id' => 'dup-1', 'created_at' => '2026-03-10 10:00:00', 'taxon' => ['name' => '新しい観察', 'id' => 'gbif:1']],
    ['id' => 'unique-1', 'created_at' => '2026-03-09 10:00:00', 'taxon' => ['name' => '別観察', 'id' => 'gbif:2']],
];
$legacyRows = [
    ['id' => 'dup-1', 'created_at' => '2026-03-01 09:00:00', 'taxon' => null],
    ['id' => 'legacy-1', 'created_at' => '2026-02-28 09:00:00', 'taxon' => ['name' => '古い観察', 'id' => 'gbif:3']],
];

file_put_contents($base . '/' . $resource . '/2026-03.json', json_encode($partitionRows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
file_put_contents($base . '/' . $resource . '.json', json_encode($legacyRows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

$latest = DataStore::getLatest($resource, 10);
$ids = array_map(fn($row) => $row['id'] ?? null, $latest);

assertSameLatest('dedup_count', count(array_values(array_filter($ids, fn($id) => $id === 'dup-1'))), 1);
assertSameLatest('dedup_first_keeps_partition_order', $latest[0]['taxon']['name'] ?? null, '別観察');
assertSameLatest('dedup_preserves_other_rows', $ids, ['unique-1', 'dup-1', 'legacy-1']);

DataStore::setPath($originalBasePath);

echo "PASS={$pass} FAIL={$fail}\n";
exit($fail > 0 ? 1 : 0);
