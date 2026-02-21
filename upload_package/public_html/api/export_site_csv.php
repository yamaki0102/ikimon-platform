<?php

/**
 * Phase 16A: Raw Data CSV Export Engine (B2B/B2G Proof Engine)
 * 
 * Generates a clean, analytical CSV file of all observations within a given site.
 * Essential for corporate ESG reporting, TNFD disclosures, and government subsidy evidence.
 * 
 * Usage: api/export_site_csv.php?site_id=aikan_hq
 * Output: CSV file download
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/SiteManager.php';
require_once __DIR__ . '/../../libs/RedListManager.php';

// --- Initialization ---
$siteId = $_GET['site_id'] ?? null;
$startDate = $_GET['start_date'] ?? null; // YYYY-MM-DD
$endDate = $_GET['end_date'] ?? null;     // YYYY-MM-DD

if (!$siteId) {
    http_response_code(400);
    die("Error: site_id is required.");
}

$site = SiteManager::load($siteId);
if (!$site) {
    http_response_code(404);
    die("Error: Site not found.");
}

$redListManager = new RedListManager();
$sitePrefecture = $site['prefecture'] ?? null;

// --- Data Collection ---
$allObs = DataStore::fetchAll('observations');
$siteObs = [];

foreach ($allObs as $obs) {
    $obsDate = $obs['observed_at'] ?? ($obs['created_at'] ?? null);
    if ($obsDate) {
        $dateOnly = substr($obsDate, 0, 10);
        if ($startDate && $dateOnly < $startDate) continue;
        if ($endDate && $dateOnly > $endDate) continue;
    }

    if (($obs['site_id'] ?? null) === $siteId) {
        $siteObs[] = $obs;
    } elseif (isset($obs['location']['lat'], $obs['location']['lon'])) {
        if (isset($site['geometry']) && SiteManager::isPointInGeometry(
            floatval($obs['location']['lat']),
            floatval($obs['location']['lon']),
            $site['geometry']
        )) {
            $siteObs[] = $obs;
        }
    }
}

// Ensure consistent sorting (newest first)
usort($siteObs, function ($a, $b) {
    $timeA = strtotime($a['observed_at'] ?? ($a['created_at'] ?? '0'));
    $timeB = strtotime($b['observed_at'] ?? ($b['created_at'] ?? '0'));
    return $timeB <=> $timeA;
});

// --- CSV Generation ---
$filename = "ikimon_proof_data_{$siteId}_" . date('Ymd') . ".csv";

// Set headers to trigger file download
header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');
header('Expires: 0');

// Open memory stream for output
$output = fopen('php://output', 'w');

// Add BOM for Excel UTF-8 compatibility
fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));

// Define CSV headers
$headers = [
    '観察ID',
    '観察日時(UTC)',
    '種名',
    '学名',
    '分類群',
    '緯度',
    '経度',
    '環境省レッドリスト',
    '県別レッドリスト',
    '発見者',
    '証拠写真URL',
    'データ品質'
];
fputcsv($output, $headers);

// Populate rows
foreach ($siteObs as $obs) {
    $name = $obs['taxon']['name'] ?? ($obs['species_name'] ?? '不明');
    $sciName = $obs['taxon']['scientific_name'] ?? ($obs['scientific_name'] ?? '');
    $taxonGroup = $obs['taxon']['class'] ?? ($obs['taxon']['kingdom'] ?? '未分類');

    // Red List Checks
    $nationalStatus = $redListManager->getNationalStatus($sciName) ?: '';
    $prefStatus = '';
    if ($sitePrefecture) {
        $prefStatus = $redListManager->getPrefecturalStatus($sitePrefecture, $sciName) ?: '';
    }

    // Photo URL (take the first one)
    $photoUrl = '';
    if (!empty($obs['images']) && is_array($obs['images'])) {
        $photoUrl = $obs['images'][0] ?? '';
    } elseif (!empty($obs['image_url'])) {
        $photoUrl = $obs['image_url'];
    }

    // Data Quality
    $quality = 'Needs ID'; // Default logic placeholder
    if (($obs['identifications_count'] ?? 0) > 1) {
        $quality = 'Research Grade';
    }

    $row = [
        $obs['id'] ?? '',
        $obs['observed_at'] ?? ($obs['created_at'] ?? ''),
        $name,
        $sciName,
        $taxonGroup,
        floatval($obs['location']['lat'] ?? 0),
        floatval($obs['location']['lon'] ?? 0),
        $nationalStatus,
        $prefStatus,
        $obs['user_name'] ?? ($obs['user_id'] ?? '匿名ユーザー'),
        $photoUrl,
        $quality
    ];

    fputcsv($output, $row);
}

fclose($output);
exit;
