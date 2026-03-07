<?php
/**
 * Municipality Dashboard - 自治体（管轄エリア）向けダッシュボード
 * 観測ベースの参考集計を確認するためのデモ画面
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/SiteManager.php';
require_once __DIR__ . '/../libs/DataStore.php';

Auth::init();

// Mock municipality context for MVP
$municipalityId = $_GET['area'] ?? 'shizuoka_city';
$municipalityName = '静岡県 静岡市'; // In real app, fetch from DB
$totalAreaKm2 = 1411.90; // 静岡市の面積 (sq km)
$target30by30Km2 = $totalAreaKm2 * 0.3;

// GetAll sites to mock "sites in this municipality"
$allSites = SiteManager::listAll();
// Mock filter: assume all sites are in this municipality for demo
$sites = $allSites; 

$totalSites = count($sites);
$totalObs = 0;
$totalMembers = 0;
$totalSpecies = 0;
$sumScore = 0;
$coverageReferenceKm2 = 0; // Demo-only reference area, not an official protected-area figure.

foreach ($sites as $site) {
    $siteStats = SiteManager::getSiteStats($site['id']);
    $totalObs += $siteStats['total_observations'];
    $totalMembers += $siteStats['total_observers'];
    $totalSpecies += $siteStats['total_species'];
    $sumScore += $siteStats['credit_score'] ?? 0;
    // Demo-only proxy to show how site-level monitoring could be aggregated.
    $coverageReferenceKm2 += ($siteStats['credit_score'] ?? 50) * 0.5;
}

$avgReferenceScore = $totalSites > 0 ? round($sumScore / $totalSites, 1) : 0;
$progress30by30Pct = $target30by30Km2 > 0 ? round(($coverageReferenceKm2 / $target30by30Km2) * 100, 1) : 0;
$pageTitle = '自治体ダッシュボード | ikimon.life';
$_SERVER['HTTP_HOST'] = $_SERVER['HTTP_HOST'] ?? parse_url(BASE_URL, PHP_URL_HOST) ?? 'ikimon.life';
$_SERVER['REQUEST_URI'] = $_SERVER['REQUEST_URI'] ?? '/dashboard_municipality.php?area=' . urlencode($municipalityId);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <meta name="robots" content="noindex, nofollow">
    <title><?= $pageTitle ?></title>
    <style>
        .glass-card {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(16, 185, 129, 0.15);
            border-radius: 1.5rem;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
            transition: all 0.3s ease;
        }
        .glass-card:hover {
            border-color: rgba(16, 185, 129, 0.4);
            box-shadow: 0 8px 32px rgba(16, 185, 129, 0.12);
        }
        .stat-value {
            font-variant-numeric: tabular-nums;
            background: linear-gradient(135deg, #059669, #0284c7);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        body {
            background-color: #f0fdf4;
            color: #1f2937;
            font-family: 'Zen Maru Gothic', sans-serif;
            padding-top: env(safe-area-inset-top);
        }
        
        /* Reference progress bar */
        .progress-track {
            background: #e5e7eb;
            border-radius: 999px;
            overflow: hidden;
            height: 12px;
        }
        .progress-fill {
            background: linear-gradient(90deg, #10b981, #3b82f6);
            height: 100%;
            border-radius: 999px;
            transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        /* Hexagon shape for reference score */
        .hex-score {
            clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
            background: linear-gradient(135deg, #a7f3d0, #bae6fd);
        }
    </style>
</head>
<body class="pb-24">
    <?php include('components/nav.php'); ?>

    <div class="max-w-6xl mx-auto px-4 md:px-8 mt-20">
        <!-- Header -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
            <div>
                <div class="flex items-center gap-2 mb-2">
                    <span class="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-200">LOCAL GOVERNMENT DEMO</span>
                    <span class="text-gray-500 text-sm">観測ベースの参考集計</span>
                </div>
                <h1 class="text-3xl md:text-4xl font-black text-gray-900"><?= htmlspecialchars($municipalityName) ?> <span class="text-xl text-gray-500 font-normal">管轄エリアの観測ダッシュボード</span></h1>
                <p class="text-sm text-gray-500 mt-2">この画面はデモです。保護区面積、OECM認定、30x30進捗を示す公式集計ではありません。</p>
            </div>
            <div class="flex gap-2 w-full md:w-auto">
                <button class="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-bold shadow-sm hover:bg-gray-50 transition flex items-center justify-center gap-2">
                    <i data-lucide="download" class="w-4 h-4"></i> 参考レポート出力
                </button>
            </div>
        </div>

        <!-- Reference Coverage Section -->
        <div class="glass-card p-6 md:p-10 mb-8 border-t-4 border-t-emerald-500">
            <div class="flex flex-col md:flex-row gap-8 items-center">
                <div class="flex-1 w-full">
                    <div class="flex justify-between items-end mb-3">
                        <div>
                            <h2 class="text-lg font-black text-gray-800 flex items-center gap-2">
                                <i data-lucide="globe-2" class="w-5 h-5 text-emerald-600"></i>
                                30x30関連の参考カバレッジ
                            </h2>
                            <p class="text-sm text-gray-500 mt-1">サイト観測を面積に見立てて集計したデモ値です。公式な面積算定ではありません。</p>
                        </div>
                        <div class="text-right">
                            <span class="text-4xl font-black stat-value"><?= $progress30by30Pct ?></span><span class="text-xl font-bold text-gray-400">%</span>
                        </div>
                    </div>
                    
                    <div class="progress-track mb-3">
                        <div class="progress-fill" style="width: 0%" x-data x-init="setTimeout(() => { $el.style.width = '<?= min(100, $progress30by30Pct) ?>%' }, 300)"></div>
                    </div>
                    
                    <div class="flex justify-between text-xs font-bold text-gray-500">
                        <span>参考集計: <?= number_format($coverageReferenceKm2, 1) ?> km²</span>
                        <span>30%相当: <?= number_format($target30by30Km2, 1) ?> km²</span>
                        <span>全体: <?= number_format($totalAreaKm2, 1) ?> km²</span>
                    </div>
                </div>
                
                <div class="hidden md:block w-px h-24 bg-gray-200"></div>
                
                <div class="w-full md:w-64 text-center">
                    <div class="text-xs text-gray-500 font-bold mb-2 tracking-widest">集計対象サイト数</div>
                    <div class="text-4xl font-black text-gray-800"><?= $totalSites ?> <span class="text-lg text-gray-400 font-normal border-l border-gray-300 pl-2 ml-1">箇所</span></div>
                    <a href="#sites" class="inline-block mt-3 text-sm text-emerald-600 font-bold hover:underline">内訳を見る →</a>
                </div>
            </div>
        </div>

        <!-- KPIs Matrix -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="glass-card p-5">
                <div class="text-gray-500 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5"><i data-lucide="leaf" class="w-4 h-4 text-emerald-500/50"></i> 平均参考指標</div>
                <div class="text-3xl font-black stat-value"><?= $avgReferenceScore ?></div>
                <div class="text-xs text-emerald-600 mt-2 bg-emerald-50 inline-block px-2 py-0.5 rounded font-bold">観測量と種数からみた内部参考値</div>
            </div>
            <div class="glass-card p-5">
                <div class="text-gray-500 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5"><i data-lucide="bug" class="w-4 h-4 text-blue-500/50"></i> エリア内 確認種</div>
                <div class="text-3xl font-black text-gray-800"><?= number_format($totalSpecies) ?></div>
                <div class="text-xs text-gray-400 mt-2 font-bold">観測記録ベースの延べ集計です</div>
            </div>
            <div class="glass-card p-5 border-l-4 border-l-rose-400">
                <div class="text-rose-500 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5"><i data-lucide="alert-triangle" class="w-4 h-4 text-rose-500/50"></i> 重点確認候補</div>
                <div class="text-3xl font-black text-rose-600"><?= min($totalSpecies, max(0, (int) round($totalSites * 0.6))) ?></div>
                <div class="text-xs text-rose-500 mt-2 bg-rose-50 inline-block px-2 py-0.5 rounded font-bold">要現地確認・公開資料照合</div>
            </div>
            <div class="glass-card p-5">
                <div class="text-gray-500 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5"><i data-lucide="users" class="w-4 h-4 text-orange-500/50"></i> 市民参加者</div>
                <div class="text-3xl font-black text-gray-800"><?= number_format($totalMembers) ?></div>
                <div class="text-xs text-gray-400 mt-2 font-bold">累計データ送信: <?= number_format($totalObs) ?> 件</div>
            </div>
        </div>

        <!-- Sites List -->
        <h2 id="sites" class="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
            <i data-lucide="map-pin" class="w-6 h-6 text-emerald-600"></i>
            管轄エリア内の観測サイト一覧
        </h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <?php foreach ($sites as $site):
                $siteStats = SiteManager::getSiteStats($site['id']);
                $score = $siteStats['credit_score'] ?? 0;
            ?>
                <div class="glass-card overflow-hidden hover:-translate-y-1">
                    <div class="h-24 bg-gradient-to-br from-emerald-100 to-blue-50 relative p-4 flex justify-between items-start">
                        <div class="px-2 py-1 bg-white/80 backdrop-blur rounded text-xs font-bold text-gray-700 border border-white/50 shadow-sm">
                            観測サイト
                        </div>
                        <div class="hex-score w-14 h-14 flex items-center justify-center border-2 border-white shadow-lg relative">
                            <span class="font-black text-emerald-800 text-lg relative z-10"><?= $score ?></span>
                        </div>
                    </div>
                    <div class="p-5">
                        <h3 class="font-black text-gray-800 text-lg mb-1 truncate"><?= htmlspecialchars($site['name']) ?></h3>
                        <p class="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed"><?= htmlspecialchars($site['description'] ?: '説明がありません。') ?></p>
                        
                        <div class="grid grid-cols-2 gap-3 mb-4">
                            <div class="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
                                <div class="text-xs text-gray-400 font-bold mb-0.5">参考指標</div>
                                <div class="text-sm font-black text-gray-700"><?= $score ?></div>
                            </div>
                            <div class="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
                                <div class="text-xs text-gray-400 font-bold mb-0.5">種数</div>
                                <div class="text-sm font-black text-gray-700"><?= $siteStats['total_species'] ?></div>
                            </div>
                        </div>
                        
                        <a href="site_dashboard.php?site=<?= urlencode($site['id']) ?>" class="block w-full text-center py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition shadow-md shadow-emerald-200">
                            詳細データを見る
                        </a>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>

    <!-- Script to init icons -->
    <script src="https://unpkg.com/lucide@0.477.0/dist/umd/lucide.min.js"></script>
    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>
</html>
