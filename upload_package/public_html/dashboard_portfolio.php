<?php
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/libs/Auth.php';
require_once __DIR__ . '/libs/SiteManager.php';
require_once __DIR__ . '/libs/CorporateSites.php';

Auth::init();

// Mock Enterprise/HQ Context for Demo
$enterpriseName = 'ikimon Global Holdings';

// In a real application, we would fetch all sites assigned to the enterprise portfolio.
// For this demo, we'll aggregate all predefined corporate sites.
$allSitesInfo = CorporateSites::SITES;
$totalSites = count($allSitesInfo);
$totalObs = 0;
$totalMembers = 0;
$totalSpecies = 0;
$sumScore = 0;

$portfolioSites = [];

foreach ($allSitesInfo as $siteId => $siteInfo) {
    $siteStats = SiteManager::getSiteStats($siteId);
    $obsCount = $siteStats['total_observations'] ?? ($siteInfo['stats']['obs'] ?? 0);
    $memberCount = $siteStats['total_observers'] ?? ($siteInfo['stats']['users'] ?? 0);
    $speciesCount = $siteStats['total_species'] ?? ($siteInfo['stats']['species'] ?? 0);
    $score = $siteStats['credit_score'] ?? ($siteInfo['stats']['score'] ?? 0);

    $totalObs += $obsCount;
    $totalMembers += $memberCount;
    $totalSpecies += $speciesCount;
    $sumScore += $score;

    $portfolioSites[] = [
        'id' => $siteId,
        'name' => $siteInfo['name'],
        'location' => $siteInfo['location'],
        'obs' => $obsCount,
        'members' => $memberCount,
        'species' => $speciesCount,
        'score' => $score
    ];
}

$avgScore = $totalSites > 0 ? round($sumScore / $totalSites, 1) : 0;
$pageTitle = 'Portfolio Dashboard | Enterprise HQ';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <meta name="robots" content="noindex, nofollow">
    <?php include __DIR__ . '/components/map_config.php'; ?>
    <title><?= $pageTitle ?></title>
    <style>
        .glass-card {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(15, 23, 42, 0.1);
            border-radius: var(--radius-lg);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
            transition: all var(--duration-normal);
        }

        .glass-card:hover {
            border-color: rgba(99, 102, 241, 0.3);
            box-shadow: 0 12px 40px rgba(99, 102, 241, 0.1);
        }

        .stat-value {
            font-variant-numeric: tabular-nums;
            background: linear-gradient(135deg, #6366f1, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        body {
            padding-top: env(safe-area-inset-top);
            background-color: #f1f5f9;
            color: #0f172a;
            font-size: var(--text-base);
            font-family: var(--font-body);
            overflow-x: hidden;
        }

        .map-container {
            height: 480px;
            border-radius: var(--radius-lg);
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        }

        @media (max-width: 768px) {
            .map-container {
                height: 300px;
            }
        }
    </style>
</head>

<body class="bg-slate-100 text-slate-900">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 mt-14">

        <!-- Header Section -->
        <header class="mb-10 text-center md:text-left">
            <div class="inline-flex items-center justify-center gap-2 px-3 py-1 mb-4 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-widest border border-indigo-200">
                <i data-lucide="globe" class="w-4 h-4"></i> Global Enterprise
            </div>
            <h1 class="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-3 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">
                <?= htmlspecialchars($enterpriseName) ?>
            </h1>
            <p class="text-slate-500 max-w-2xl text-lg font-medium">
                事業拠点ポートフォリオ全体のネイチャー・ポジティブ（30by30）貢献度ダッシュボード
            </p>
        </header>

        <!-- Global KPI Summary -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10">
            <div class="glass-card p-6 flex flex-col items-center justify-center text-center">
                <div class="text-slate-400 mb-2"><i data-lucide="map-pin" class="w-6 h-6"></i></div>
                <div class="text-3xl md:text-4xl font-black stat-value mb-1"><?= number_format($totalSites) ?></div>
                <div class="text-xs font-bold text-slate-500 uppercase tracking-widest">管理拠点数</div>
            </div>
            <div class="glass-card p-6 flex flex-col items-center justify-center text-center">
                <div class="text-slate-400 mb-2"><i data-lucide="users" class="w-6 h-6"></i></div>
                <div class="text-3xl md:text-4xl font-black stat-value mb-1"><?= number_format($totalMembers) ?></div>
                <div class="text-xs font-bold text-slate-500 uppercase tracking-widest">累計参加者</div>
            </div>
            <div class="glass-card p-6 flex flex-col items-center justify-center text-center">
                <div class="text-slate-400 mb-2"><i data-lucide="camera" class="w-6 h-6"></i></div>
                <div class="text-3xl md:text-4xl font-black stat-value mb-1"><?= number_format($totalObs) ?></div>
                <div class="text-xs font-bold text-slate-500 uppercase tracking-widest">累計観察数</div>
            </div>
            <div class="glass-card p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div class="absolute -right-4 -bottom-4 text-indigo-100 opacity-50">
                    <i data-lucide="trending-up" class="w-24 h-24"></i>
                </div>
                <div class="text-slate-400 mb-2 relative z-10"><i data-lucide="award" class="w-6 h-6 text-indigo-500"></i></div>
                <div class="text-3xl md:text-4xl font-black stat-value mb-1 relative z-10"><?= number_format($avgScore, 1) ?></div>
                <div class="text-xs font-bold text-slate-500 uppercase tracking-widest relative z-10">平均エンゲージメント</div>
            </div>
        </div>

        <!-- Global Map Portfolio -->
        <div class="mb-10">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-xl font-black text-slate-900 flex items-center gap-2">
                    <i data-lucide="map" class="w-5 h-5 text-indigo-500"></i> ポートフォリオ・マップ
                </h2>
                <a href="api/export_portfolio_dwca.php" class="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-full border border-indigo-200 transition flex items-center gap-1">
                    <i data-lucide="download" class="w-4 h-4"></i> 全拠点をDwC-A出力
                </a>
            </div>
            <div id="portfolio-map" class="map-container relative z-0 border border-slate-200"></div>
        </div>

        <!-- Site List -->
        <div>
            <h2 class="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                <i data-lucide="list" class="w-5 h-5 text-indigo-500"></i> 拠点別パフォーマンス
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <?php foreach ($portfolioSites as $site): ?>
                    <a href="site_dashboard.php?site=<?= urlencode($site['id']) ?>" class="glass-card p-6 block group">
                        <h3 class="font-bold text-lg text-slate-900 mb-1 group-hover:text-indigo-600 transition flex items-center justify-between">
                            <?= htmlspecialchars($site['name']) ?>
                            <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-transform group-hover:translate-x-1"></i>
                        </h3>
                        <p class="text-xs text-slate-500 mb-4 flex items-center gap-1">
                            <i data-lucide="map-pin" class="w-3 h-3"></i> <?= $site['location'][1] ?>, <?= $site['location'][0] ?>
                        </p>
                        <div class="grid grid-cols-2 gap-3 mb-4">
                            <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <div class="text-[10px] uppercase font-bold text-slate-400 mb-1">発見種数</div>
                                <div class="font-black text-xl text-slate-700"><?= number_format($site['species']) ?></div>
                            </div>
                            <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <div class="text-[10px] uppercase font-bold text-slate-400 mb-1">スコア</div>
                                <div class="font-black text-xl text-indigo-600"><?= $site['score'] ?></div>
                            </div>
                        </div>
                        <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div class="bg-gradient-to-r from-indigo-400 to-blue-500 h-1.5 rounded-full" style="width: <?= min(100, max(0, $site['score'])) ?>%"></div>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        </div>

    </div>

    <!-- Scripts -->
    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();

        // Initialize MapLibre
        const map = new maplibregl.Map({
            container: 'portfolio-map',
            style: IKIMON_MAP.style('light'),
            center: [137.75, 34.70],
            zoom: 11,
            pitch: 40
        });

        // Add controls
        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        // Sites Data
        const sitesData = <?= json_encode($portfolioSites) ?>;

        map.on('load', () => {
            // Add markers
            const bounds = new maplibregl.LngLatBounds();

            sitesData.forEach(site => {
                const el = document.createElement('div');
                el.className = 'w-6 h-6 bg-indigo-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(99,102,241,0.6)] animate-pulse cursor-pointer';

                new maplibregl.Marker(el)
                    .setLngLat(site.location)
                    .setPopup(new maplibregl.Popup({
                            offset: 25
                        })
                        .setHTML(`
                            <div class="p-2 min-w-[150px]">
                                <h4 class="font-bold text-sm mb-1">${site.name}</h4>
                                <div class="text-xs text-slate-500 mb-2">スコア: <span class="text-indigo-600 font-bold">${site.score}</span></div>
                                <a href="site_dashboard.php?site=${site.id}" class="text-xs text-white bg-indigo-500 px-3 py-1.5 rounded-lg font-bold block text-center">詳細を見る</a>
                            </div>
                        `)
                    )
                    .addTo(map);

                bounds.extend(site.location);
            });

            // Fit map to bounds
            if (!bounds.isEmpty()) {
                map.fitBounds(bounds, {
                    padding: 50,
                    maxZoom: 13
                });
            }
        });
    </script>
</body>

</html>
