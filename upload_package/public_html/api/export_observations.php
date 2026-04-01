<?php

/**
 * api/export_observations.php — Observation Data Export (CSV/Darwin Core)
 * 要素9+10: B2B データエクスポート
 * 
 * Usage:
 *   GET /api/export_observations.php?format=csv
 *   GET /api/export_observations.php?format=dwc
 *   GET /api/export_observations.php?format=csv&site_id=XXX
 */
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/BioUtils.php';
require_once __DIR__ . '/../../libs/RedList.php';

Auth::init();
if (!Auth::user()) {
    http_response_code(401);
    echo json_encode(['error' => 'Authentication required'], JSON_HEX_TAG);
    exit;
}

$format = $_GET['format'] ?? 'csv';
$siteId = $_GET['site_id'] ?? null;

// Load observations
$observations = DataStore::fetchAll('observations');

// Filter by site if specified
if ($siteId) {
    $observations = array_filter($observations, function ($obs) use ($siteId) {
        return ($obs['site_id'] ?? '') === $siteId;
    });
    $observations = array_values($observations);
}

// Apply PrivacyFilter: obscure GPS for red-listed species before export
foreach ($observations as &$obs) {
    if (isset($obs['taxon']['name'])) {
        $rl = RedList::check($obs['taxon']['name']);
        if ($rl) {
            $obscured = BioUtils::getObscuredLocation($obs['lat'], $obs['lng'], $rl['category']);
            $obs['lat'] = $obscured['lat'];
            $obs['lng'] = $obscured['lng'];
            $obs['gps_accuracy'] = $obscured['radius'];
            $obs['is_obscured'] = true;
        }
    }
}
unset($obs);

if ($format === 'dwc') {
    // Darwin Core format
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="ikimon_dwc_export_' . date('Ymd') . '.csv"');

    $out = fopen('php://output', 'w');
    // Darwin Core headers
    fputcsv($out, [
        'occurrenceID',
        'basisOfRecord',
        'eventDate',
        'decimalLatitude',
        'decimalLongitude',
        'coordinateUncertaintyInMeters',
        'scientificName',
        'vernacularName',
        'kingdom',
        'taxonRank',
        'identificationQualifier',
        'recordedBy',
        'occurrenceRemarks',
        'license',
        'datasetName',
        'institutionCode',
        'collectionCode'
    ]);

    foreach ($observations as $obs) {
        $taxonName = $obs['taxon']['name'] ?? $obs['species_name'] ?? '';
        $sciName = $obs['taxon']['scientific_name'] ?? '';
        fputcsv($out, [
            $obs['id'] ?? '',
            'HumanObservation',
            $obs['observed_at'] ?? '',
            $obs['lat'] ?? '',
            $obs['lng'] ?? '',
            $obs['gps_accuracy'] ?? '',
            $sciName,
            $taxonName,
            'Animalia',
            $obs['taxon']['rank'] ?? '',
            ($obs['status'] ?? '') === 'confirmed' ? '' : 'cf.',
            $obs['user']['name'] ?? $obs['user_id'] ?? 'Anonymous',
            $obs['note'] ?? '',
            'CC BY 4.0',
            'ikimon.life',
            'IKIMON',
            'OBS'
        ]);
    }
    fclose($out);
} else {
    // Simple CSV
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="ikimon_observations_' . date('Ymd') . '.csv"');

    $out = fopen('php://output', 'w');
    // BOM for Excel UTF-8
    fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF));

    fputcsv($out, [
        'ID',
        '観察日時',
        '種名',
        '学名',
        '緯度',
        '経度',
        'GPS精度(m)',
        '状態',
        '野生/飼育',
        '観察者',
        'メモ',
        'ライセンス'
    ]);

    foreach ($observations as $obs) {
        $taxonName = $obs['taxon']['name'] ?? $obs['species_name'] ?? '';
        $sciName = $obs['taxon']['scientific_name'] ?? '';
        fputcsv($out, [
            $obs['id'] ?? '',
            $obs['observed_at'] ?? '',
            $taxonName,
            $sciName,
            $obs['lat'] ?? '',
            $obs['lng'] ?? '',
            $obs['gps_accuracy'] ?? '',
            $obs['status'] ?? 'unconfirmed',
            $obs['cultivation'] ?? 'wild',
            $obs['user']['name'] ?? $obs['user_id'] ?? 'Anonymous',
            $obs['note'] ?? '',
            'CC BY 4.0'
        ]);
    }
    fclose($out);
}
