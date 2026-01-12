<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';

// Auth Check (Optional: Allow public export or require simple auth?)
// For now, require login to prevent heavy bot scraping
Auth::init();
if (!Auth::isLoggedIn()) {
    header('HTTP/1.0 403 Forbidden');
    echo 'Login required for data export.';
    exit;
}

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=ikimon_observations_dwc_' . date('Ymd') . '.csv');

$output = fopen('php://output', 'w');

// Darwin Core Header (Simple)
$header = [
    'occurrenceID',
    'basisOfRecord',
    'eventDate',
    'scientificName',
    'vernacularName',
    'decimalLatitude',
    'decimalLongitude',
    'coordinateUncertaintyInMeters',
    'geodeticDatum',
    'countryCode',
    'stateProvince',
    'rightsHolder',
    'license',
    'establishmentMeans', // wild or cultivated
    'occurrenceStatus',   // present
    'datasetName'
];
fputcsv($output, $header);

// Fetch all observations (Pagination loop needed for huge dataset, simplified for MVP)
// Assuming we can load recent 1000 for this MVP or use DataStore::getAll() if available
// Since DataStore::get('observations') might be too big, we'll iterate through partitions if implemented.
// For now, let's look at DataStore implementation. It likely only loads the current active set or we need a helper.
// We will iterate through Partition files if we want ALL data.
// For MVP, let's check `observations_index.json` or just scan the dir.

$data_dir = __DIR__ . '/../../data/observations';
$files = glob($data_dir . '/*.json');

foreach ($files as $file) {
    $obs_list = json_decode(file_get_contents($file), true);
    if (!is_array($obs_list)) continue;

    foreach ($obs_list as $obs) {
        // Skip hidden (endangered) if user is not admin
        // For public export, we must obscure endangered species
        // Check RedList logic here? Or just export what is publicly visible?
        // Detailed compliance requires masking coordinates.
        
        $lat = $obs['lat'] ?? '';
        $lng = $obs['lng'] ?? '';
        
        // Simple masking for now if 'status' is hidden
        if (($obs['status'] ?? '') === 'hidden') {
            continue; // Skip hidden records completely in public export
        }

        $row = [
            'ikimon:obs:' . ($obs['id'] ?? uniqid()),
            'HumanObservation',
            $obs['observed_at'] ?? '',
            $obs['scientific_name'] ?? '',
            $obs['species_name'] ?? '',
            round((float)$lat, 6),
            round((float)$lng, 6),
            '30', // Estimated accuracy
            'WGS84',
            'JP',
            'Shizuoka', // Hardcoded for this region MVP
            $obs['user_name'] ?? 'ikimon user',
            'CC-BY-NC 4.0',
            ($obs['cultivation'] ?? 'wild') === 'wild' ? 'native' : 'managed',
            'present',
            'ikimon Citizen Science'
        ];
        fputcsv($output, $row);
    }
}

fclose($output);
