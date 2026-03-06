<?php

/**
 * csr_showcase.php — CSR Biodiversity Showcase (Public)
 *
 * Public-facing page for corporate sites to display their biodiversity data.
 * Designed for embedding in corporate sustainability reports and websites.
 *
 * Usage: csr_showcase.php?site_id=xxx
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/SiteManager.php';
require_once __DIR__ . '/../libs/RedListManager.php';

$siteId = $_GET['site_id'] ?? '';
if (!$siteId) {
    header('Location: index.php');
    exit;
}

$site = SiteManager::load($siteId);
if (!$site) {
    header('Location: index.php');
    exit;
}

$siteName = $site['properties']['name'] ?? $site['name'] ?? $siteId;
$siteNameEn = $site['properties']['name_en'] ?? '';

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

foreach ($siteObs as $obs) {
    $name = $obs['taxon']['name'] ?? ($obs['species_name'] ?? '不明');
    $sciName = $obs['taxon']['scientific_name'] ?? ($obs['scientific_name'] ?? '');
    $taxonGroup = $obs['taxon']['lineage']['order'] ?? ($obs['taxon_group'] ?? '');
    $taxonGroupJa = $groupMap[$taxonGroup] ?? ($taxonGroup ?: 'その他');

    if (!isset($speciesMap[$name])) {
        $speciesMap[$name] = ['count' => 0, 'sci_name' => $sciName, 'group' => $taxonGroupJa];
    }
    $speciesMap[$name]['count']++;

    $date = $obs['observed_at'] ?? ($obs['created_at'] ?? null);
    if ($date) {
        $ts = strtotime($date);
        if ($ts) {
            $ym = date('Y-m', $ts);
            $monthlyTrend[$ym] = ($monthlyTrend[$ym] ?? 0) + 1;
        }
    }

    $taxonomyBreakdown[$taxonGroupJa] = ($taxonomyBreakdown[$taxonGroupJa] ?? 0) + 1;

    $status = $obs['quality_grade'] ?? ($obs['status'] ?? '');
    if (in_array($status, ['Research Grade', '研究用'])) {
        $researchGradeCount++;
    }

    $uid = $obs['user_id'] ?? '';
    if ($uid) $observerSet[$uid] = true;
}

ksort($monthlyTrend);
arsort($taxonomyBreakdown);

// Sort species by count desc
uasort($speciesMap, fn($a, $b) => $b['count'] - $a['count']);

$totalObs = count($siteObs);
$totalSpecies = count($speciesMap);
$rgPercent = $totalObs > 0 ? round(($researchGradeCount / $totalObs) * 100, 1) : 0;
/** @phpstan-ignore-line */

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
            'label' => $first['category_label'] ?? $first['category'],
            'color' => $first['category_color'] ?? '#dc2626',
        ];
    }
}

// --- BIS Score ---
$bisDiversity = min(40, $totalSpecies * 1.5);
$bisQuality = min(25, $rgPercent * 0.25);
$bisRedList = min(20, count($redListSpecies) * 4);
$bisTaxonomy = min(15, count($taxonomyBreakdown) * 3);
$bis = round(min(100, $bisDiversity + $bisQuality + $bisRedList + $bisTaxonomy), 1);

// Top species (max 12)
$topSpecies = array_slice($speciesMap, 0, 12, true);

// Meta
$meta_title = htmlspecialchars($siteName) . ' 生物多様性ショーケース — ikimon.life';
$meta_description = $siteName . 'の生物多様性データ: ' . $totalSpecies . '種・' . $totalObs . '件の観察記録';
$meta_canonical = BASE_URL . '/csr_showcase.php?site_id=' . urlencode($siteId);
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>

    <!-- JSON-LD -->
    <script type="application/ld+json" nonce="<?= CspNonce::attr() ?>">
        <?php echo json_encode([
            '@context' => 'https://schema.org',
            '@type' => 'WebPage',
            'name' => $siteName . ' 生物多様性ショーケース',
            'description' => $meta_description,
            'url' => $meta_canonical,
            'publisher' => [
                '@type' => 'Organization',
                'name' => 'ikimon.life',
                'url' => BASE_URL,
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT); ?>
    </script>

    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;700;900&display=swap');

        :root {
            --sc-primary: #10b981;
            --sc-dark: #064e3b;
            --sc-bg: #f0fdf4;
            --sc-card: #ffffff;
            --sc-border: #d1fae5;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans JP', system-ui, sans-serif;
            background: var(--sc-bg);
            color: #1f2937;
            line-height: 1.6;
        }

        /* --- Hero --- */
        .sc-hero {
            background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%);
            color: white;
            padding: 3rem 1.5rem 4rem;
            position: relative;
            overflow: hidden;
        }

        .sc-hero::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -20%;
            width: 60%;
            height: 200%;
            background: radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%);
            pointer-events: none;
        }

        .sc-hero-inner {
            max-width: 900px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
        }

        .sc-brand {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            font-weight: 700;
            opacity: 0.6;
            margin-bottom: 1rem;
            letter-spacing: 0.15em;
            text-transform: uppercase;
        }

        .sc-site-name {
            font-size: 2rem;
            font-weight: 900;
            letter-spacing: -0.5px;
            line-height: 1.2;
        }

        .sc-site-name-en {
            font-size: 0.875rem;
            opacity: 0.5;
            font-weight: 300;
            margin-top: 0.25rem;
        }

        .sc-compliance {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 1rem;
            padding: 6px 14px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 100px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.1em;
        }

        /* --- Stats Grid --- */
        .sc-stats-grid {
            max-width: 900px;
            margin: -2.5rem auto 0;
            padding: 0 1.5rem;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 0.75rem;
            position: relative;
            z-index: 10;
        }

        .sc-stat-card {
            background: var(--sc-card);
            border-radius: 16px;
            padding: 1.25rem 1rem;
            text-align: center;
            border: 1px solid var(--sc-border);
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .sc-stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
        }

        .sc-stat-card.bis {
            background: var(--sc-primary);
            color: white;
            border-color: var(--sc-primary);
        }

        .sc-stat-val {
            font-size: 1.75rem;
            font-weight: 900;
            line-height: 1.1;
        }

        .sc-stat-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            opacity: 0.7;
            margin-top: 4px;
            font-weight: 700;
        }

        /* --- Sections --- */
        .sc-section {
            max-width: 900px;
            margin: 2rem auto;
            padding: 0 1.5rem;
        }

        .sc-section-title {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            color: var(--sc-primary);
            margin-bottom: 0.75rem;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .sc-card {
            background: var(--sc-card);
            border-radius: 16px;
            padding: 1.5rem;
            border: 1px solid var(--sc-border);
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
        }

        /* --- Taxonomy Bars --- */
        .sc-taxo-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 0;
        }

        .sc-taxo-label {
            font-size: 12px;
            font-weight: 600;
            min-width: 100px;
            text-align: right;
        }

        .sc-taxo-fill {
            height: 22px;
            border-radius: 6px;
            background: linear-gradient(90deg, #10b981, #34d399);
            transition: width 0.6s ease;
            min-width: 4px;
        }

        .sc-taxo-count {
            font-size: 11px;
            font-weight: 700;
            color: #6b7280;
            min-width: 30px;
        }

        /* --- Species Grid --- */
        .sc-species-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 0.5rem;
        }

        .sc-species-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            font-size: 13px;
            transition: all 0.2s;
            text-decoration: none;
            color: inherit;
        }

        .sc-species-item:hover {
            border-color: var(--sc-primary);
            background: #ecfdf5;
            transform: translateX(2px);
        }

        .sc-species-count {
            min-width: 30px;
            height: 30px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 12px;
            background: #f3f4f6;
            color: #6b7280;
            flex-shrink: 0;
        }

        .sc-species-name {
            font-weight: 700;
            color: #111827;
        }

        .sc-species-sci {
            font-size: 10px;
            color: #9ca3af;
            font-style: italic;
        }

        /* --- Red List --- */
        .sc-rl-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 6px 12px;
            border-radius: 100px;
            font-size: 11px;
            font-weight: 700;
        }

        /* --- Trend Chart --- */
        .sc-trend-chart {
            height: 200px;
        }

        /* --- Footer --- */
        .sc-footer {
            max-width: 900px;
            margin: 3rem auto;
            padding: 2rem 1.5rem;
            text-align: center;
            color: #9ca3af;
            font-size: 11px;
            border-top: 1px solid #e5e7eb;
        }

        .sc-footer a {
            color: var(--sc-primary);
            text-decoration: none;
            font-weight: 700;
        }

        .sc-footer a:hover {
            text-decoration: underline;
        }

        /* --- Mobile --- */
        @media (max-width: 640px) {
            .sc-stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }

            .sc-species-grid {
                grid-template-columns: 1fr;
            }

            .sc-site-name {
                font-size: 1.5rem;
            }

            .sc-taxo-label {
                min-width: 80px;
                font-size: 11px;
            }
        }
    </style>
</head>

<body>

    <!-- Hero -->
    <header class="sc-hero">
        <div class="sc-hero-inner">
            <div class="sc-brand">🌿 ikimon.life Biodiversity Showcase</div>
            <div class="sc-site-name"><?php echo htmlspecialchars($siteName); ?></div>
            <?php if ($siteNameEn): ?>
                <div class="sc-site-name-en"><?php echo htmlspecialchars($siteNameEn); ?></div>
            <?php endif; ?>
            <div class="sc-compliance">✅ 30by30 / TNFD LEAP 対応</div>
        </div>
    </header>

    <!-- Stats Grid -->
    <div class="sc-stats-grid">
        <div class="sc-stat-card bis">
            <div class="sc-stat-val"><?php echo $bis; ?></div>
            <div class="sc-stat-label">BIS Score</div>
        </div>
        <div class="sc-stat-card">
            <div class="sc-stat-val"><?php echo $totalSpecies; ?></div>
            <div class="sc-stat-label">確認種数</div>
        </div>
        <div class="sc-stat-card">
            <div class="sc-stat-val"><?php echo $totalObs; ?></div>
            <div class="sc-stat-label">観察記録</div>
        </div>
        <div class="sc-stat-card">
            <div class="sc-stat-val"><?php echo $rgPercent; ?>%</div>
            <div class="sc-stat-label">研究用達成率</div>
        </div>
        <div class="sc-stat-card">
            <div class="sc-stat-val"><?php echo count($observerSet); ?></div>
            <div class="sc-stat-label">参加者数</div>
        </div>
    </div>

    <!-- Taxonomy Breakdown -->
    <?php if (!empty($taxonomyBreakdown)): ?>
        <div class="sc-section">
            <div class="sc-section-title">📊 分類群 TAXONOMY</div>
            <div class="sc-card">
                <?php
                $maxTaxo = max($taxonomyBreakdown);
                foreach ($taxonomyBreakdown as $group => $count):
                    $pct = $maxTaxo > 0 ? ($count / $maxTaxo) * 100 : 0;
                ?>
                    <div class="sc-taxo-bar">
                        <div class="sc-taxo-label"><?php echo htmlspecialchars($group); ?></div>
                        <div class="sc-taxo-fill" style="width: <?php echo $pct; ?>%"></div>
                        <div class="sc-taxo-count"><?php echo $count; ?></div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    <?php endif; ?>

    <!-- Monthly Trend -->
    <?php if (!empty($monthlyTrend)): ?>
        <div class="sc-section">
            <div class="sc-section-title">📈 月別推移 MONTHLY TREND</div>
            <div class="sc-card">
                <canvas id="trendChart" class="sc-trend-chart"></canvas>
                <script nonce="<?= CspNonce::attr() ?>">
                    document.addEventListener('DOMContentLoaded', () => {
                        const data = <?php echo json_encode($monthlyTrend); ?>;
                        new Chart(document.getElementById('trendChart'), {
                            type: 'bar',
                            data: {
                                labels: Object.keys(data),
                                datasets: [{
                                    label: '観察数',
                                    data: Object.values(data),
                                    backgroundColor: '#10b98140',
                                    borderColor: '#10b981',
                                    borderWidth: 1,
                                    borderRadius: 6,
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        display: false
                                    }
                                },
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        ticks: {
                                            stepSize: 1
                                        }
                                    }
                                }
                            }
                        });
                    });
                </script>
            </div>
        </div>
    <?php endif; ?>

    <!-- Red List Species -->
    <?php if (!empty($redListSpecies)): ?>
        <div class="sc-section">
            <div class="sc-section-title">⚠️ レッドリスト種 RED LIST</div>
            <div class="sc-card">
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    <?php foreach ($redListSpecies as $rl): ?>
                        <div class="sc-rl-badge" style="background: <?php echo htmlspecialchars($rl['color']); ?>18; border: 1px solid <?php echo htmlspecialchars($rl['color']); ?>40; color: <?php echo htmlspecialchars($rl['color']); ?>;">
                            <?php echo htmlspecialchars($rl['category']); ?> — <?php echo htmlspecialchars($rl['name']); ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    <?php endif; ?>

    <!-- Top Species -->
    <div class="sc-section">
        <div class="sc-section-title">🦋 確認種 TOP SPECIES</div>
        <div class="sc-card">
            <div class="sc-species-grid">
                <?php foreach ($topSpecies as $name => $data): ?>
                    <a href="species/<?php echo urlencode($name); ?>" class="sc-species-item">
                        <div class="sc-species-count"><?php echo $data['count']; ?></div>
                        <div>
                            <div class="sc-species-name"><?php echo htmlspecialchars($name); ?></div>
                            <?php if ($data['sci_name']): ?>
                                <div class="sc-species-sci"><?php echo htmlspecialchars($data['sci_name']); ?></div>
                            <?php endif; ?>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <footer class="sc-footer">
        <p>
            Powered by <a href="<?php echo BASE_URL; ?>" target="_blank" rel="noopener noreferrer">ikimon.life</a> — 市民参加型生物多様性プラットフォーム<br>
            データ取得日: <?php echo date('Y年m月d日 H:i'); ?>
        </p>
        <p style="margin-top: 0.5rem;">
            <a href="site/<?php echo urlencode($siteId); ?>">📊 ダッシュボード</a>
            &nbsp;|&nbsp;
            <a href="api/generate_site_report.php?site_id=<?php echo urlencode($siteId); ?>" target="_blank" rel="noopener noreferrer">📄 レポート</a>
        </p>
    </footer>

</body>

</html>
