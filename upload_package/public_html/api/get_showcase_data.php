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
 * Response: JSON with site stats, species list, trends, BIS score
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // Allow iframe embedding

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/SiteManager.php';
require_once __DIR__ . '/../../libs/RedListManager.php';

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
$allObs = DataStore::fetchAll('observations');
$siteObs = [];

foreach ($allObs as $obs) {
    if (($obs['site_id'] ?? null) === $siteId) {
        $siteObs[] = $obs;
    } elseif (!empty($obs['location']['lat']) && !empty($obs['location']['lng'])) {
        $geometry = $site['geometry'] ?? null;
        if ($geometry && SiteManager::isPointInGeometry($obs['location']['lat'], $obs['location']['lng'], $geometry)) {
            $siteObs[] = $obs;
        }
    }
}

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

    // Research Grade
    $status = $obs['quality_grade'] ?? ($obs['status'] ?? '');
    if (in_array($status, ['Research Grade', '研究用'])) {
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

// --- BIS Score ---
$bisDiversity = min(40, $totalSpecies * 1.5);
$bisQuality = min(25, $rgPercent * 0.25);
$bisRedList = min(20, count($redListSpecies) * 4);
$bisTaxonomy = min(15, count($taxonomyBreakdown) * 3);
$bis = round(min(100, $bisDiversity + $bisQuality + $bisRedList + $bisTaxonomy), 1);

// --- Response ---
$siteName = $site['properties']['name'] ?? $site['name'] ?? $siteId;

echo json_encode([
    'success' => true,
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
        'total_observers' => count($observerSet, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG),
        'bis_score' => $bis,
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
