<?php

/**
 * get_showcase_data.php — CSR Showcase Data API
 *
 * Returns aggregated biodiversity data for a site in JSON format.
 * Used by showcase.php and showcase_embed.php.
 *
 * GET params:
 *   - site_id (str): required
 *
 * Response: JSON with site stats, species list, trends, observation-based reference index
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // Allow iframe embedding

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/SiteManager.php';
require_once __DIR__ . '/../../libs/RedListManager.php';
require_once __DIR__ . '/../../libs/BioUtils.php';

$siteId = $_GET['site_id'] ?? '';
if (!$siteId) {
    echo json_encode(['success' => false, 'message' => 'site_id is required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$site = SiteManager::load($siteId);
if (!$site) {
    echo json_encode(['success' => false, 'message' => 'Site not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// --- Data Collection ---
$siteObs = SiteManager::getObservationsInSite($siteId);

// --- Compute Statistics ---
$speciesMap = [];
$taxonomyBreakdown = [];
$monthlyTrend = [];
$researchGradeCount = 0;
$observerSet = [];

foreach ($siteObs as $obs) {
    $name = $obs['taxon']['name'] ?? ($obs['species_name'] ?? '不明');
    $sciName = $obs['taxon']['scientific_name'] ?? ($obs['scientific_name'] ?? '');
    $taxonGroup = $obs['taxon']['lineage']['order'] ?? ($obs['taxon_group'] ?? '');

    // Map taxon groups to Japanese
    $groupMap = [
        'Lepidoptera' => 'チョウ・ガ',
        'Coleoptera' => '甲虫',
        'Hymenoptera' => 'ハチ・アリ',
        'Diptera' => 'ハエ・アブ',
        'Hemiptera' => 'カメムシ',
        'Orthoptera' => 'バッタ・コオロギ',
        'Odonata' => 'トンボ',
        'Aves' => '鳥類',
        'Mammalia' => '哺乳類',
        'Reptilia' => '爬虫類',
        'Amphibia' => '両生類',
        'Actinopterygii' => '魚類',
        'Plantae' => '植物',
        'Fungi' => '菌類',
    ];
    $taxonGroupJa = $groupMap[$taxonGroup] ?? ($taxonGroup ?: 'その他');

    if (!isset($speciesMap[$name])) {
        $speciesMap[$name] = ['count' => 0, 'sci_name' => $sciName, 'group' => $taxonGroupJa];
    }
    $speciesMap[$name]['count']++;

    // Date tracking
    $date = $obs['observed_at'] ?? ($obs['created_at'] ?? null);
    if ($date) {
        $ym = date('Y-m', strtotime($date));
        $monthlyTrend[$ym] = ($monthlyTrend[$ym] ?? 0) + 1;
    }

    // Taxonomy breakdown
    $taxonomyBreakdown[$taxonGroupJa] = ($taxonomyBreakdown[$taxonGroupJa] ?? 0) + 1;

    // Research-usable
    if (BioUtils::isResearchGradeObservation($obs)) {
        $researchGradeCount++;
    }

    // Unique observers
    $uid = $obs['user_id'] ?? '';
    if ($uid) $observerSet[$uid] = true;
}

ksort($monthlyTrend);
arsort($taxonomyBreakdown);

$totalObs = count($siteObs);
$totalSpecies = count($speciesMap);
$rgPercent = $totalObs > 0 ? round(($researchGradeCount / $totalObs) * 100, 1) : 0;

// --- Red List ---
$rlManager = new RedListManager();
$redListSpecies = [];
foreach (array_keys($speciesMap) as $sp) {
    $rl = $rlManager->lookup($sp);
    if ($rl) {
        $first = reset($rl);
        $redListSpecies[] = [
            'name' => $sp,
            'category' => $first['category'],
            'category_label' => $first['category_label'] ?? $first['category'],
        ];
    }
}

// --- Observation-based reference index ---
$referenceIndexDiversity = min(40, $totalSpecies * 1.5);
$referenceIndexQuality = min(25, $rgPercent * 0.25);
$referenceIndexRedList = min(20, count($redListSpecies) * 4);
$referenceIndexTaxonomy = min(15, count($taxonomyBreakdown) * 3);
$monitoringReferenceIndex = round(min(100, $referenceIndexDiversity + $referenceIndexQuality + $referenceIndexRedList + $referenceIndexTaxonomy), 1);

// --- Response ---
$siteName = $site['properties']['name'] ?? $site['name'] ?? $siteId;

echo json_encode([
    'success' => true,
    'limitations' => [
        'Presence-only observation data; absence and abundance are not estimated.',
        'Use as a public-facing monitoring summary, not as a standalone disclosure conclusion.',
    ],
    'site' => [
        'id' => $siteId,
        'name' => $siteName,
        'name_en' => $site['properties']['name_en'] ?? '',
    ],
    'stats' => [
        'total_observations' => $totalObs,
        'total_species' => $totalSpecies,
        'research_grade_count' => $researchGradeCount,
        'research_grade_percent' => $rgPercent,
        'total_observers' => count($observerSet),
        'monitoring_reference_index' => $monitoringReferenceIndex,
    ],
    'taxonomy_breakdown' => $taxonomyBreakdown,
    'monthly_trend' => $monthlyTrend,
    'red_list_species' => $redListSpecies,
    'top_species' => array_slice(
        array_map(fn($name, $data) => [
            'name' => $name,
            'scientific_name' => $data['sci_name'],
            'count' => $data['count'],
            'group' => $data['group'],
        ], array_keys($speciesMap), array_values($speciesMap)),
        0,
        20
    ),
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);
