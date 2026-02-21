<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/BioUtils.php';
require_once __DIR__ . '/../../libs/RedList.php';
require_once __DIR__ . '/../../libs/ApiGate.php';
require_once __DIR__ . '/../../libs/CorporateSites.php';

// Auth / Gate Check (Requires at least 'researcher' or corporate level access)
// For this portfolio MVP, we assume the user has the right to export the enterprise data.
$gate = ApiGate::check('researcher');

// Output format: csv (default) or archive (ZIP with meta.xml + eml.xml + occurrence.csv)
$format = ($_GET['format'] ?? 'csv') === 'archive' ? 'archive' : 'csv';

// Define Darwin Core headers
$headers = [
    'occurrenceID',
    'basisOfRecord',
    'license',
    'rightsHolder',
    'eventDate',
    'scientificName',
    'taxonRank',
    'recordedBy',
    'decimalLatitude',
    'decimalLongitude',
    'coordinateUncertaintyInMeters',
    'country',
    'stateProvince',
    'municipality',
    'establishmentMeans',
    'associatedMedia',
    'occurrenceRemarks',
    'identificationVerificationStatus',
    'taxonConceptID',
    'informationWithheld',
    'habitat',
    'lifeStage',
    'associatedTaxa',
    'associatedReferences',
    'dynamicProperties',
    'locationRemarks' // Use this to output the specific site name
];

// Fetch all observations
$observations = DataStore::fetchAll('observations');

// Define Portfolio Site IDs
$portfolioSiteIds = array_keys(CorporateSites::SITES);

// Filter observations: must belong to a portfolio site AND be Research Grade/研究用
$researchGradeObs = array_filter($observations, function ($obs) use ($gate, $portfolioSiteIds) {
    if (empty($obs['site_id']) || !in_array($obs['site_id'], $portfolioSiteIds)) {
        return false;
    }
    
    $isRG = ($obs['quality_grade'] ?? '') === 'Research Grade' || ($obs['status'] ?? '') === '研究用';
    if (!$isRG) return false;

    if ($gate['tier'] === 'researcher') {
        $license = $obs['license'] ?? 'CC-BY';
        return in_array($license, ['CC0', 'CC-BY']);
    }
    return true;
});

// Domain for media URLs
$domain = 'https://ikimon.life/';

// License mapping for DwC
$licenseMap = [
    'CC0'     => 'http://creativecommons.org/publicdomain/zero/1.0/',
    'CC-BY'   => 'https://creativecommons.org/licenses/by/4.0/',
    'CC-BY-NC' => 'https://creativecommons.org/licenses/by-nc/4.0/',
];

/**
 * Build a single DwC row from an observation
 */
function buildDwcRow(array $obs, string $domain, array $licenseMap): array
{
    $id = ltrim($obs['id'] ?? '', 'obs_');
    $date = $obs['observed_at'] ?? '';

    $taxon = $obs['taxon'] ?? [];
    $scientificName = $taxon['scientific_name'] ?? $taxon['name'] ?? '';
    $taxonRank = $taxon['rank'] ?? '';
    $taxonId = $taxon['id'] ?? '';

    $lat = (float)($obs['lat'] ?? 0);
    $lng = (float)($obs['lng'] ?? 0);
    $coordinateUncertainty = '';
    $informationWithheld = '';

    // Privacy / Obscuring for Red List species
    if (!empty($taxon['name'])) {
        $rl = RedList::check($taxon['name']);
        if ($rl) {
            $obscured = BioUtils::getObscuredLocation($lat, $lng, $rl['category']);
            $lat = $obscured['lat'];
            $lng = $obscured['lng'];
            $coordinateUncertainty = $obscured['radius'];
            $informationWithheld = 'Coordinate uncertainty increased due to sensitive location (Red List: ' . $rl['category'] . ').';
        }
    }

    $cultivation = $obs['cultivation'] ?? 'wild';
    $establishmentMeans = ($cultivation === 'cultivated') ? 'managed' : 'native';

    $mediaStr = '';
    if (!empty($obs['photos'])) {
        $urls = array_map(function ($path) use ($domain) {
            return rtrim($domain, '/') . '/' . ltrim($path, '/');
        }, $obs['photos']);
        $mediaStr = implode('|', $urls);
    }

    $obsLicense = $obs['license'] ?? 'CC-BY';

    // Phase C: habitat from biome + substrate_tags
    $habitatParts = [];
    $biome = $obs['biome'] ?? '';
    if ($biome && $biome !== 'unknown') {
        $habitatParts[] = $biome;
    }
    $substrateTags = $obs['substrate_tags'] ?? [];
    if (!empty($substrateTags) && is_array($substrateTags)) {
        $habitatParts = array_merge($habitatParts, $substrateTags);
    }
    $habitat = implode('; ', $habitatParts);

    // Phase C: lifeStage
    $lifeStage = $obs['life_stage'] ?? '';
    if ($lifeStage === 'unknown') $lifeStage = '';

    // Phase C: associatedReferences from book citations
    $assocRefs = '';
    $taxonSlug = $taxon['slug'] ?? '';
    if ($taxonSlug) {
        $indexDir = ROOT_DIR . '/data/library/index';
        $indexFile = $indexDir . '/' . $taxonSlug . '.json';
        if (file_exists($indexFile)) {
            $citations = json_decode(file_get_contents($indexFile), true);
            if (is_array($citations)) {
                $refs = [];
                foreach (array_slice($citations, 0, 5) as $c) {
                    $ref = $c['book_title'] ?? '';
                    if (!empty($c['page'])) $ref .= ', p.' . $c['page'];
                    if ($ref) $refs[] = $ref;
                }
                $assocRefs = implode(' | ', $refs);
            }
        }
    }

    // Phase C M7: Data Quality - evidence_tags / Host Plant mapping
    $associatedTaxa = '';
    $dynamicPropertiesData = [];
    $evidenceTags = $obs['evidence_tags'] ?? [];
    if (!empty($evidenceTags) && is_array($evidenceTags)) {
        if (in_array('host_plant', $evidenceTags)) {
            $associatedTaxa = 'host_plant'; // Placeholder, actual host name could be added if collected
        }
        $dynamicPropertiesData['evidence_traits'] = $evidenceTags;
    }
    $dynamicProperties = !empty($dynamicPropertiesData) ? json_encode($dynamicPropertiesData, JSON_UNESCAPED_UNICODE) : '';

    // Portfolio Site Name
    $locationRemarks = $obs['site_name'] ?? '';

    return [
        $id,
        'HumanObservation',
        $licenseMap[$obsLicense] ?? $licenseMap['CC-BY'],
        $obs['user_name'] ?? 'Unknown',
        $date,
        $scientificName,
        $taxonRank,
        $obs['user_name'] ?? 'Unknown',
        $lat,
        $lng,
        $coordinateUncertainty,
        $obs['country'] ?? '',
        $obs['prefecture'] ?? '',
        $obs['municipality'] ?? '',
        $establishmentMeans,
        $mediaStr,
        $obs['note'] ?? '',
        'Research Grade',
        $taxonId,
        $informationWithheld,
        $habitat,
        $lifeStage,
        $associatedTaxa,
        $assocRefs,
        $dynamicProperties,
        $locationRemarks
    ];
}

// ──────────────────────────────────────────────
// Output: ZIP Archive (GBIF-ready DwC-A package)
// ──────────────────────────────────────────────
if ($format === 'archive') {
    $dwcaDir = ROOT_DIR . '/data/dwca';
    $metaXml = $dwcaDir . '/meta.xml';
    $emlXml  = $dwcaDir . '/eml.xml';

    if (!file_exists($metaXml) || !file_exists($emlXml)) {
        http_response_code(500);
        echo json_encode(['error' => true, 'message' => 'Archive metadata files not found.']);
        exit;
    }

    // Build CSV in memory
    $csvStream = fopen('php://temp', 'r+');
    fputcsv($csvStream, $headers);
    foreach ($researchGradeObs as $obs) {
        fputcsv($csvStream, buildDwcRow($obs, $domain, $licenseMap));
    }
    rewind($csvStream);
    $csvContent = stream_get_contents($csvStream);
    fclose($csvStream);

    // Create ZIP
    $zipFile = sys_get_temp_dir() . '/ikimon_portfolio_dwca_' . date('Ymd_His') . '.zip';
    $zip = new ZipArchive();
    if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        http_response_code(500);
        echo json_encode(['error' => true, 'message' => 'Failed to create ZIP archive.']);
        exit;
    }
    $zip->addFromString('occurrence.csv', $csvContent);
    $zip->addFile($metaXml, 'meta.xml');
    $zip->addFile($emlXml, 'eml.xml');
    $zip->close();

    // Send ZIP
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="ikimon_portfolio_dwca_' . date('Ymd_His') . '.zip"');
    header('Content-Length: ' . filesize($zipFile));
    header('Cache-Control: no-cache, no-store, must-revalidate');
    readfile($zipFile);
    @unlink($zipFile);
    exit;
}

// ──────────────────────────────────────────────
// Output: CSV stream (backward compatible)
// ──────────────────────────────────────────────
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="ikimon_portfolio_dwca_export_' . date('Ymd_His') . '.csv"');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$output = fopen('php://output', 'w');
fputs($output, "\xEF\xBB\xBF"); // BOM for Excel
fputcsv($output, $headers);

foreach ($researchGradeObs as $obs) {
    fputcsv($output, buildDwcRow($obs, $domain, $licenseMap));
}

fclose($output);
exit;
