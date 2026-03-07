<?php
/**
 * CSR Report Generation API
 * 企業向けのストーリー型「CSR成果参考レポート」出力API
 * SDGs Goal15マッピング、写真と数値実績のストーリー型フォーマット
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/SiteManager.php';
require_once __DIR__ . '/../../libs/CorporateManager.php';
require_once __DIR__ . '/../../libs/RedListManager.php';

Auth::init();

header('Content-Type: application/json; charset=utf-8');

$corpId = $_GET['corp_id'] ?? null;
$siteId = $_GET['site_id'] ?? null;
$year = $_GET['year'] ?? date('Y');
$lang = $_GET['lang'] ?? 'ja'; // Multilingual support (M8)

if (!$corpId && !$siteId) {
    echo json_encode(['success' => false, 'error' => 'corp_id or site_id is required']);
    exit;
}

$sites = [];
$reportTargetName = '';

if ($corpId) {
    $corp = CorporateManager::get($corpId);
    if (!$corp) {
        echo json_encode(['success' => false, 'error' => 'Corporate not found']);
        exit;
    }
    $sites = SiteManager::getByOwnerOrg($corpId);
    $reportTargetName = $corp['name'];
} elseif ($siteId) {
    $site = SiteManager::load($siteId);
    if (!$site) {
        echo json_encode(['success' => false, 'error' => 'Site not found']);
        exit;
    }
    $sites = [$site];
    $reportTargetName = $site['name'];
}

$totalObs = 0;
$totalMembers = 0;
$totalSpecies = 0;
$redlistCount = 0;
$sumScore = 0;
$topSpeciesAll = [];

// Collect aggregate stats
foreach ($sites as $site) {
    $stats = SiteManager::getSiteStats($site['id']);
    $totalObs += $stats['total_observations'] ?? 0;
    $totalMembers += $stats['total_observers'] ?? 0;
    $totalSpecies += $stats['total_species'] ?? 0; // rough simple sum, real logic might deduplicate
    $redlistCount += $stats['redlist_count'] ?? 0;
    $sumScore += $stats['credit_score'] ?? 0;
    
    if (isset($stats['top_species'])) {
        foreach ($stats['top_species'] as $name => $count) {
            $topSpeciesAll[$name] = ($topSpeciesAll[$name] ?? 0) + $count;
        }
    }
}

$siteCount = count($sites);
$avgScore = $siteCount > 0 ? round($sumScore / $siteCount, 1) : 0;

// Sort top species globally
arsort($topSpeciesAll);
$highlightSpecies = array_slice(array_keys($topSpeciesAll), 0, 3);

// Generate Narrative Story (Multilingual)
if ($lang === 'en') {
    $reportTitle = "{$reportTargetName} Nature-Positive CSR Report (FY{$year})";
    $storyIntroduction = "In FY{$year}, observation activities at \"{$reportTargetName}\" generated a public-facing monitoring record. Through the co-creation of employees and citizens, a total of $totalObs nature observations were conducted, identifying $totalSpecies species as an observation-based snapshot.";

    $sdg15Text = "This activity directly contributes to SDGs Goal 15: 'Life on Land'. ";
    if ($redlistCount > 0) {
        $sdg15Text .= "Notably, $redlistCount Red List species were recorded. These records should be treated as important conservation signals and reviewed alongside site management and expert input.";
    } else {
        $sdg15Text .= "Through regular monitoring, a system has been established to grasp ecological changes at an early stage.";
    }

    $communityImpact = "A total of $totalMembers participants were involved in the field surveys, reaching an average monitoring reference index of $avgScore. This indicates accumulated participation and observation coverage, not a standalone biodiversity valuation.";

    $topSpeciesNotes = [];
    foreach ($highlightSpecies as $sp) {
        $rlm = new RedListManager();
        $rl = $rlm->lookup($sp, 'shizuoka');
        $statusText = $rl ? "(Conservation Priority: {$rl['category']})" : "";
        $count = $topSpeciesAll[$sp];
        $topSpeciesNotes[] = "- **{$sp}** {$statusText}: Observed {$count} times as a representative species of this area.";
    }
} else {
    $reportTitle = "{$reportTargetName} 自然関連活動 CSR参考レポート ({$year}年度)";
    $storyIntroduction = "{$year}年度の「{$reportTargetName}」では、社員と市民の共創により合計 $totalObs 件の自然観察が行われ、$totalSpecies 種の生物が確認されました。本レポートは、その観測状況を社内外で共有しやすい形に整理した参考資料です。";

    $sdg15Text = "本活動は SDGs 目標15「陸の豊かさも守ろう」に直接的に寄与しています。";
    if ($redlistCount > 0) {
        $sdg15Text .= "特に、$redlistCount 種の絶滅危惧種（レッドリスト掲載種）が記録されています。これらは保全上の重要シグナルであり、現場管理や専門家レビューとあわせて読み解く対象です。";
    } else {
        $sdg15Text .= "定期的なモニタリングを通じ、生態系の変動を早期に把握できる体制が構築されています。";
    }

    $communityImpact = "延べ $totalMembers 名の参加者がフィールド調査に関与し、平均参考インデックスは $avgScore でした。これは参加の広がりと観測の蓄積を示す参考値であり、自然価値そのものを単独で定量化するものではありません。";

    $topSpeciesNotes = [];
    foreach ($highlightSpecies as $sp) {
        $rlm = new RedListManager();
        $rl = $rlm->lookup($sp, 'shizuoka');
        $statusText = $rl ? "（保全重要種: {$rl['category']}）" : "";
        $count = $topSpeciesAll[$sp];
        $topSpeciesNotes[] = "- **{$sp}** {$statusText}: このエリアを代表する生物として {$count} 回観察されました。";
    }
}

$response = [
    'success' => true,
    'report' => [
        'title' => $reportTitle,
        'target' => $reportTargetName,
        'year' => $year,
        'sdgs_mapping' => [
            'goals' => [15],
            'description' => 'Goal 15: Life on Land (陸の豊かさも守ろう)'
        ],
        'metrics' => [
            'total_observations' => $totalObs,
            'total_species' => $totalSpecies,
            'redlist_species' => $redlistCount,
            'participants' => $totalMembers,
            'average_monitoring_reference_index' => $avgScore,
            'active_sites' => $siteCount
        ],
        'story' => [
            'introduction' => $storyIntroduction,
            'sdg_contribution' => $sdg15Text,
            'community_impact' => $communityImpact,
            'highlighted_species_text' => implode("\n", $topSpeciesNotes),
            'highlighted_species_list' => $highlightSpecies
        ],
        'limitations' => [
            'Presence-only observation data; absence and abundance are not estimated.',
            'Use as a CSR or sustainability reporting input, not as a standalone disclosure conclusion.',
        ],
    ]
];

echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
