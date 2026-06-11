<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/EventObservationQuery.php';

$tmpRoot = sys_get_temp_dir() . '/ikimon_event_observation_query_' . bin2hex(random_bytes(4));
mkdir($tmpRoot . '/observations', 0777, true);
DataStore::setPath($tmpRoot);

$observations = [
    [
        'id' => 'obs_event_tag',
        'event_tag' => 'BIO123',
        'observed_at' => '2026-06-12T10:00:00+09:00',
        'lat' => 35.0000,
        'lng' => 139.0000,
        'taxon' => ['name' => 'スズメ'],
    ],
    [
        'id' => 'obs_radius_only',
        'observed_at' => '2026-06-12T10:05:00+09:00',
        'lat' => 35.0001,
        'lng' => 139.0001,
        'taxon' => ['name' => 'ヒヨドリ'],
    ],
    [
        'id' => 'obs_outside_time',
        'event_tag' => 'BIO123',
        'observed_at' => '2026-06-12T18:00:00+09:00',
        'lat' => 35.0000,
        'lng' => 139.0000,
        'taxon' => ['name' => 'カラス'],
    ],
];

file_put_contents(
    $tmpRoot . '/observations/2026-06.json',
    json_encode($observations, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
    LOCK_EX
);

$event = [
    'id' => 'evt_test',
    'event_code' => 'BIO123',
    'event_date' => '2026-06-12',
    'start_time' => '10:00',
    'end_time' => '11:00',
    'location' => [
        'lat' => 35.0000,
        'lng' => 139.0000,
        'radius_m' => 200,
    ],
];

$summary = EventObservationQuery::collect($event, EventObservationQuery::MODE_SUMMARY);
$official = EventObservationQuery::collect($event, EventObservationQuery::MODE_OFFICIAL);

$summaryIds = array_column($summary, 'id');
$officialIds = array_column($official, 'id');

$assert = function (bool $condition, string $message): void {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
};

$assert(in_array('obs_event_tag', $summaryIds, true), 'summary includes event-tagged observation');
$assert(in_array('obs_radius_only', $summaryIds, true), 'summary includes radius-only observation');
$assert(!in_array('obs_outside_time', $summaryIds, true), 'summary excludes outside-time observation');
$assert(in_array('obs_event_tag', $officialIds, true), 'official includes event-tagged observation');
$assert(!in_array('obs_radius_only', $officialIds, true), 'official excludes radius-only observation');
$assert(!in_array('obs_outside_time', $officialIds, true), 'official excludes outside-time observation');

array_map('unlink', glob($tmpRoot . '/observations/*.json') ?: []);
rmdir($tmpRoot . '/observations');
rmdir($tmpRoot);

echo "OK\n";
