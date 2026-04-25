<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';

// Auth Check
Auth::init();
$user = Auth::user();

// Require login & High-Level Role (Admin/Analyst)
// Standard users cannot export raw DwC-A data.
if (!$user) {
    header('HTTP/1.0 403 Forbidden');
    echo 'Login required for data export.';
    exit;
}

$isAdmin = Auth::hasRole('Analyst') || Auth::hasRole('Admin');

if (!$isAdmin) {
    header('HTTP/1.0 403 Forbidden');
    echo 'Export feature is restricted to Analyst/Professional plans.';
    exit;
}

// B2B/ToG Feature: Target specific user data
$targetUserId = $_GET['user_id'] ?? null;

// Filename
$filename = 'ikimon_surveys_dwc_' . date('Ymd_His') . '.csv';

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');

$out = fopen('php://output', 'w');

// Darwin Core Event Header
// https://dwc.tdwg.org/terms/#event
$header = [
    'eventID',
    'type', // Event
    'samplingProtocol',
    'eventDate',
    'eventTime',
    'timeZone', // Asia/Tokyo
    'countryCode',
    'stateProvince',
    'locationID',
    'samplingEffort',
    'sampleSizeValue', // duration_min
    'sampleSizeUnit',  // minutes
    'dynamicProperties', // JSON: weather, party, stats
    'fieldNotes',
    'rightsHolder',
    'accessRights',
    'datasetName',
    'recordedBy', // User ID or Name (Anonymized?)
];
fputcsv($out, $header);

// Fetch Logic
// Admin/Analyst can export ALL or Specific User
$surveys = [];
if ($targetUserId) {
    $surveys = DataStore::getLatest('surveys', 1000, function ($item) use ($targetUserId) {
        return ($item['user_id'] ?? '') === $targetUserId && ($item['status'] ?? '') === 'completed';
    });
} else {
    // Export All Recent (Up to 1000)
    $surveys = DataStore::getLatest('surveys', 1000, function ($item) {
        return ($item['status'] ?? '') === 'completed';
    });
}

foreach ($surveys as $s) {
    $context = $s['context'] ?? [];
    $stats = $s['stats'] ?? [];

    // Date/Time
    $startedAt = $s['started_at'] ?? '';
    $ts = strtotime($startedAt);
    $date = $ts ? date('Y-m-d', $ts) : '';
    $time = $ts ? date('H:i:s', $ts) : '';

    // Sampling Effort
    $duration = $stats['duration_min'] ?? 0;
    $protocol = $s['protocol'] ?? 'casual';
    $effort = "$duration minutes ($protocol)";

    // Dynamic Properties (Weather, etc)
    $dyn = [
        'weather_type' => $context['weather_type'] ?? '',
        'temp_range' => $context['temp_range'] ?? '',
        'obs_count' => $stats['obs_count'] ?? 0,
        'sp_count' => $stats['sp_count'] ?? 0,
        'quality_score' => $stats['quality_score'] ?? 0,
        'party_size' => count($s['party']['members'] ?? []) + count($s['party']['guests'] ?? []),
    ];

    // Field Notes
    $notes = $context['notes'] ?? '';
    if (!empty($context['weather'])) { // Legacy fallback
        $notes .= " [Legacy Weather: " . $context['weather'] . "]";
    }

    fputcsv($out, [
        'ikimon:survey:' . ($s['id'] ?? uniqid()),
        'Event',
        $protocol,
        $date,
        $time,
        'Asia/Tokyo',
        'JP',
        'Shizuoka',
        $s['field_id'] ?? '',
        $effort,
        $duration,
        'minutes',
        json_encode($dyn, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        $notes,
        'ikimon.life',
        'Open Data',
        'ikimon Survey Data',
        $s['user_id'] ?? 'unknown',
    ]);
}

fclose($out);
