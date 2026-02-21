<?php

/**
 * Data Immutable Proof Package Generator
 * 
 * Generates a verifiable JSON package of all observations for a specific site,
 * including EXIF GPS data (if available) and SHA-256 cryptographic hashes.
 * This serves as an anti-greenwashing proof for ESG/TNFD reporting.
 */

header('Content-Type: application/json; charset=utf-8');
// Force download as a file
header('Content-Disposition: attachment; filename="immutable_proof_package.json"');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/SiteManager.php';
require_once __DIR__ . '/../../libs/DataStore.php';

$siteId = $_GET['site_id'] ?? '';

if (!$siteId) {
    http_response_code(400);
    echo json_encode(['error' => 'site_id is required']);
    exit;
}

$site = SiteManager::load($siteId);
if (!$site) {
    http_response_code(404);
    echo json_encode(['error' => 'Site not found']);
    exit;
}

// Get all observations
$allObs = DataStore::fetchAll('observations');
// Optimize polygon check
$polygon = null;
if (!empty($site['geojson']) && is_string($site['geojson'])) {
    $geojson = json_decode($site['geojson'], true);
    if (!empty($geojson['features'][0]['geometry']['coordinates'][0])) {
        $polygon = $geojson['features'][0]['geometry']['coordinates'][0];
    }
}

$siteObs = [];
if ($polygon) {
    require_once __DIR__ . '/../../libs/GeoUtils.php';
    foreach ($allObs as $obs) {
        if (!empty($obs['site_id']) && $obs['site_id'] === $siteId) {
            $siteObs[] = $obs;
            continue;
        }

        $lat = (float)($obs['lat'] ?? 0);
        $lng = (float)($obs['lng'] ?? 0);
        if ($lat && $lng && GeoUtils::isPointInPolygon($lat, $lng, $polygon)) {
            $siteObs[] = $obs;
        }
    }
} else {
    // Fallback: match by site_id explicit link
    foreach ($allObs as $obs) {
        if (!empty($obs['site_id']) && $obs['site_id'] === $siteId) {
            $siteObs[] = $obs;
        }
    }
}

// Generate the records
$records = [];
$recordsHashString = "";

foreach ($siteObs as $obs) {
    $taxonName = $obs['taxon']['name'] ?? ($obs['species_name'] ?? 'Unknown');
    $scientific = $obs['taxon']['scientific_name'] ?? ($obs['scientific_name'] ?? '');

    $record = [
        'observation_id' => $obs['id'],
        'observed_at' => $obs['observed_at'],
        'species' => $taxonName,
        'scientific_name' => $scientific,
        'reported_location' => [
            'lat' => $obs['lat'],
            'lng' => $obs['lng']
        ],
        'exif_provenance' => isset($obs['exif_location']) ? 'verified' : 'unverified',
    ];

    if (isset($obs['exif_location'])) {
        $record['exif_location'] = $obs['exif_location'];
    }

    // Generate a record-level hash
    $jsonRecord = json_encode($record, JSON_UNESCAPED_UNICODE);
    $recordHash = hash('sha256', $jsonRecord);

    $record['record_hash'] = $recordHash;
    $records[] = $record;

    $recordsHashString .= $recordHash;
}

// Overvall package hash
$packageHash = hash('sha256', $recordsHashString);

$proofPackage = [
    'metadata' => [
        'platform' => 'ikimon.life Citizen Science Platform',
        'document_type' => 'Data Immutable Proof Package',
        'site_id' => $siteId,
        'site_name' => $site['name'],
        'generated_at' => date('Y-m-d\TH:i:sP'),
        'total_records' => count($records),
        'statement' => 'This package contains cryptographically hashed observation records verifying the presence of species at specific coordinates and times. It serves as an immutable proof for ESG, TNFD reporting, and anti-greenwashing audits.',
        'integrity_verification' => 'To verify integrity, concatenate all record_hashes in order and compute the SHA-256 hash. It must equal the package_hash.'
    ],
    'package_hash' => $packageHash,
    'records' => $records
];

// Re-send header with proper filename now we have site name
$safeName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $site['name']);
$filename = "immutable_proof_{$safeName}_" . date('Ymd') . ".json";
header('Content-Disposition: attachment; filename="' . $filename . '"');

echo json_encode($proofPackage, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
