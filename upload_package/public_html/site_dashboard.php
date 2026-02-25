<?php

/**
 * Site Dashboard - Premium Business Analytics View
 * 
 * Enterprise-grade biodiversity dashboard with:
 * - Credit Reference Score (β) with arc gauge
 * - Shannon-Wiener Diversity Index
 * - Chao1 Species Richness Estimation
 * - Seasonal Phenology Matrix
 * - TNFD/30by30 context
 * 
 * Usage: site_dashboard.php?site=ikan_hq
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/SiteManager.php';
require_once __DIR__ . '/../libs/RedListManager.php';
require_once __DIR__ . '/../libs/DataQuality.php';

Auth::init();

$siteId = $_GET['site'] ?? '';
$site = null;
$stats = null;
$geojson = null;
$allSites = SiteManager::listAll();
$redListSpecies = [];
$dqaCounts = ['A' => 0, 'B' => 0, 'C' => 0, 'D' => 0];
$dqaTotal = 0;

if ($siteId) {
    $site = SiteManager::load($siteId);
    if ($site) {
        $stats = SiteManager::getSiteStats($siteId);
        $geojson = SiteManager::getGeoJSON($siteId);

        if (!empty($stats['top_species'])) {
            $rlm = new RedListManager();
            $redListSpecies = $rlm->lookupMultiple(array_keys($stats['top_species']), 'shizuoka');
        }

        // DQA grade distribution
        $siteObservations = SiteManager::getObservationsInSite($siteId);
        // Reset counts for specific site
        $dqaCounts = ['A' => 0, 'B' => 0, 'C' => 0, 'D' => 0];
        foreach ($siteObservations as $obs) {
            $g = $obs['data_quality'] ?? DataQuality::calculate($obs);
            if (isset($dqaCounts[$g])) $dqaCounts[$g]++;
        }
        $dqaTotal = array_sum($dqaCounts);
    }
}

$meta_title = $site ? $site['name'] . ' ダッシュボード' : 'サイトダッシュボード';

// Rank color mapping
// Rank color mapping - aligned with design_db ID:11 (Biodiversity Field)
$rankColors = [
    'A' => ['var(--color-primary-dark)', 'bg-primary-surface border border-primary-glow text-primary-dark'],
    'B' => ['var(--color-secondary)', 'bg-secondary-surface border border-secondary/20 text-secondary'],
    'C' => ['var(--color-accent)', 'bg-accent-surface border border-accent/20 text-accent'],
    'D' => ['var(--color-orange)', 'bg-orange/10 border border-orange/20 text-orange-400'],
    'E' => ['var(--color-danger)', 'bg-danger/10 border border-danger/20 text-danger'],
];
$rank = $stats ? ($stats['credit_rank'] ?? 'C') : 'C';
$rankColor = $rankColors[$rank][0] ?? 'var(--color-text-muted)';
$rankBadge = $rankColors[$rank][1] ?? 'bg-muted/10 text-muted';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <style>
        /* Premium Dashboard Styles - Premium Light Theme (Cyber-Natural Aligned) */
        .glass-card {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(16, 185, 129, 0.1);
            border-radius: var(--radius-lg);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
            transition: transform var(--duration-normal), box-shadow var(--duration-normal), border-color var(--duration-normal);
        }

        .glass-card:hover {
            border-color: rgba(16, 185, 129, 0.3);
            box-shadow: 0 8px 30px rgba(16, 185, 129, 0.1);
        }

        .glass-card-accent {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(14, 165, 233, 0.05));
            border: 1px solid rgba(16, 185, 129, 0.2);
        }

        /* Animated gradient text - Biodiversity Field Palette */
        .stat-value {
            font-variant-numeric: tabular-nums;
            color: #10b981;
            /* フォールバック: グラデーション非対応ブラウザ用 */
            background: linear-gradient(135deg, #10b981, #0ea5e9);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        /* Score Arc Gauge */
        .score-arc {
            transform: rotate(-90deg);
        }

        .score-arc-track {
            fill: none;
            stroke: #f1f5f9;
            /* Slate 100 */
            stroke-width: 12;
            stroke-linecap: round;
        }

        .score-arc-fill {
            fill: none;
            stroke-width: 12;
            stroke-linecap: round;
            transition: stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Phenology heatmap cell */
        .phenology-cell {
            transition: transform 0.15s, opacity 0.15s;
            border-radius: 3px;
        }

        .phenology-cell:hover {
            transform: scale(1.3);
            z-index: 10;
        }

        /* Pulse ring */
        .pulse-ring {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
            animation: pulse-ring 2s infinite;
        }

        @keyframes pulse-ring {
            0% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
            }

            70% {
                box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
            }

            100% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
            }
        }

        /* Trend chart animation */
        .trend-line {
            stroke-dasharray: 1000;
            stroke-dashoffset: 1000;
            animation: draw-line 2s ease forwards 0.5s;
        }

        @keyframes draw-line {
            to {
                stroke-dashoffset: 0;
            }
        }

        .trend-dot {
            opacity: 0;
            animation: dot-appear 0.3s ease forwards;
        }

        /* Bar chart */
        .bar-fill {
            transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* Species badge hover */
        .species-badge:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        /* Map container */
        #site-map {
            border-radius: 1rem;
            overflow: hidden;
        }

        /* Info tooltip */
        .info-tip {
            position: relative;
            cursor: help;
        }

        .info-tip::after {
            content: attr(data-tip);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: #1a2e1f;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            white-space: nowrap;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s;
            z-index: 50;
        }

        .info-tip:hover::after {
            opacity: 1;
            visibility: visible;
        }

        /* TNFD section */
        .tnfd-card {
            background: linear-gradient(135deg, #f8faf9, #eef2f0);
            border: 1px solid rgba(16, 185, 129, 0.1);
            color: #1a2e1f;
        }

        /* PWA safe-area-inset */
        body {
            padding-top: env(safe-area-inset-top);
        }

        /* Print styles */
        @media print {
            .glass-card {
                background: white !important;
                color: black !important;
                border: 1px solid #e5e7eb !important;
            }

            nav,
            .no-print {
                display: none !important;
            }
        }
    </style>
</head>

<body class="js-loading bg-[#f8faf9] text-[#1a2e1f] font-body">
    <?php include('components/nav.php'); ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <?php if (!$site): ?>
        <!-- Site Selection Screen -->
        <main class="min-h-screen pt-20 pb-8 px-4 md:px-8">
            <div class="max-w-4xl mx-auto">
                <div class="text-center mb-12">
                    <div class="inline-flex items-center gap-2 text-primary text-xs font-bold tracking-[0.2em] uppercase mb-4">
                        <i data-lucide="shield-check" class="w-4 h-4"></i> ikimon for Business
                    </div>
                    <h1 class="text-3xl md:text-4xl font-bold mb-3">サイトダッシュボード</h1>
                    <p class="text-[#1a2e1f]/60">自然共生サイトのモニタリングデータをリアルタイムで可視化</p>
                </div>

                <?php if (empty($allSites)): ?>
                    <div class="glass-card p-10 text-center bg-[#1a2e1f]/[0.02] border-dashed border-2 border-primary/20">
                        <div class="w-20 h-20 bg-primary-surface/50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                            <i data-lucide="map-pin" class="w-10 h-10 text-primary"></i>
                        </div>
                        <h2 class="text-2xl font-bold mb-3 text-[#1a2e1f]">最初のサイトを登録しましょう</h2>
                        <p class="text-[#1a2e1f]/60 text-sm mb-6 leading-relaxed max-w-md mx-auto">
                            あなたのフィールドを登録して、生物多様性のモニタリングを始めましょう。<br>
                            蓄積されたデータはここで美しいレポートとして可視化されます。
                        </p>
                        <a href="site_editor.php" class="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary hover:bg-primary-dark text-white font-bold transition shadow-lg shadow-primary/20">
                            <i data-lucide="plus"></i> サイトを追加する
                        </a>
                    </div>
                <?php else: ?>
                    <div class="grid gap-4 md:grid-cols-2">
                        <?php foreach ($allSites as $s): ?>
                            <a href="?site=<?php echo urlencode($s['id']); ?>"
                                class="glass-card p-6 group hover:border-primary/30 bg-[#1a2e1f]/[0.02] transition duration-300 block">
                                <div class="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 class="font-bold text-lg group-hover:text-primary transition text-[#1a2e1f]">
                                            <?php echo htmlspecialchars($s['name']); ?>
                                        </h3>
                                        <p class="text-xs text-[#1a2e1f]/50"><?php echo htmlspecialchars($s['address']); ?></p>
                                    </div>
                                    <span class="text-xs px-2 py-1 rounded-full <?php echo $s['status'] === 'draft' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-primary/10 text-primary border border-primary/20'; ?>">
                                        <?php echo $s['status'] === 'draft' ? 'Draft' : 'Active'; ?>
                                    </span>
                                </div>
                                <p class="text-sm text-[#1a2e1f]/60 line-clamp-2"><?php echo htmlspecialchars($s['description']); ?></p>
                                <div class="mt-4 flex items-center text-xs text-[#1a2e1f]/60 group-hover:text-primary transition">
                                    <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition"></i>
                                    <span class="ml-1">ダッシュボードを開く</span>
                                </div>
                            </a>
                        <?php endforeach; ?>

                        <a href="site_editor.php"
                            class="glass-card p-6 group hover:border-secondary/30 bg-[#1a2e1f]/[0.02] transition duration-300 flex flex-col items-center justify-center min-h-[140px] border-dashed border-2 border-[#1a2e1f]/10">
                            <div class="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition">
                                <i data-lucide="plus" class="w-6 h-6 text-secondary"></i>
                            </div>
                            <p class="text-sm font-bold text-[#1a2e1f]/60 group-hover:text-secondary transition">新しいサイトを追加</p>
                        </a>
                    </div>
                <?php endif; ?>
            </div>
        </main>

    <?php else: ?>
        <!-- ===== PREMIUM BUSINESS DASHBOARD ===== -->
        <main class="min-h-screen pt-20 pb-12 px-4 md:px-8 bg-[#f8faf9]" x-data="siteDashboard()">
            <div class="max-w-6xl mx-auto">

                <!-- ① Header -->
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                    <div>
                        <div class="flex items-center gap-3 mb-1">
                            <a href="site_dashboard.php" class="text-[#1a2e1f]/60 hover:text-emerald-600 transition">
                                <i data-lucide="arrow-left" class="w-5 h-5"></i>
                            </a>
                            <h1 class="text-2xl md:text-3xl font-black text-[#1a2e1f] whitespace-nowrap"><?php echo htmlspecialchars($site['name']); ?></h1>
                            <span class="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-100">
                                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                モニタリング中
                            </span>
                        </div>
                        <p class="text-sm text-[#1a2e1f]/50 ml-8"><?php echo htmlspecialchars($site['address']); ?></p>
                    </div>
                    <div class="flex items-center gap-2 ml-8 md:ml-0 overflow-x-auto pb-2" style="white-space: nowrap; -webkit-overflow-scrolling: touch;">
                        <?php if (Auth::isLoggedIn()): ?>
                            <a href="site_editor.php?site=<?php echo urlencode($siteId); ?>"
                                class="text-xs px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-gray-600 hover:text-emerald-600 font-bold border border-gray-200 shadow-sm transition flex items-center gap-1.5 no-print">
                                <i data-lucide="pencil" class="w-3.5 h-3.5"></i> エリア編集
                            </a>
                        <?php endif; ?>
                        <a href="api/export_site_csv.php?site_id=<?php echo urlencode($siteId); ?>" target="_blank"
                            class="text-xs px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-emerald-600 font-bold border border-emerald-200 shadow-sm transition flex items-center gap-1.5 no-print">
                            <i data-lucide="table" class="w-3.5 h-3.5"></i> 生データCSV
                        </a>
                        <button type="button" @click="openPrModal('<?php echo htmlspecialchars($siteId); ?>')"
                            class="text-xs px-4 py-2 rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-sm transition flex items-center gap-1.5 no-print">
                            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> PR原案作成
                        </button>
                        <a href="api/download_proof_package.php?site_id=<?php echo urlencode($siteId); ?>" target="_blank"
                            class="text-xs px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-200 shadow-sm transition flex items-center gap-1.5 no-print" title="ESG/TNFD報告用 信憑性証明パッケージ (JSON)">
                            <i data-lucide="file-json" class="w-3.5 h-3.5"></i> 暗号証明PKG
                        </a>

                        <!-- B2B API Previews -->
                        <?php
                        $previewLat = $site['center'][1] ?? 0;
                        $previewLng = $site['center'][0] ?? 0;
                        $testApiKey = 'test_enterprise_940245a9f27112fb6'; // Test Enterprise Key for preview
                        $previewQs = http_build_query(['lat' => $previewLat, 'lng' => $previewLng, 'radius' => 2000, 'api_key' => $testApiKey]);
                        ?>
                        <div class="hidden md:flex items-center gap-1 border-l border-gray-200 pl-3 ml-1">
                            <a href="api/v2/30by30_report.php?<?php echo htmlspecialchars($previewQs); ?>" target="_blank"
                                class="text-xs px-3 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold border border-teal-200 shadow-sm transition flex items-center gap-1 no-print">
                                <i data-lucide="external-link" class="w-3.5 h-3.5"></i> 30by30
                            </a>
                            <a href="api/v2/tnfd_leap_report.php?<?php echo htmlspecialchars($previewQs); ?>" target="_blank"
                                class="text-xs px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 shadow-sm transition flex items-center gap-1 no-print">
                                <i data-lucide="external-link" class="w-3.5 h-3.5"></i> TNFD
                            </a>
                        </div>

                        <a href="api/generate_report.php?site_id=<?php echo urlencode($siteId); ?>&from=2000-01-01" target="_blank"
                            class="text-xs px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold transition shadow-lg shadow-teal-200 flex items-center gap-1.5 no-print" title="生物多様性レポート (HTML/印刷可)">
                            <i data-lucide="file-text" class="w-3.5 h-3.5"></i> 生物多様性レポート
                        </a>
                        <a href="api/generate_site_report.php?site_id=<?php echo urlencode($siteId); ?>&from=2000-01-01" target="_blank"
                            class="text-xs px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-lg shadow-emerald-200 flex items-center gap-1.5 no-print">
                            <i data-lucide="download" class="w-3.5 h-3.5"></i> 認定用エビデンス
                        </a>
                    </div>
                </div>

                <!-- ② KPI Cards -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                    <div class="glass-card p-4 md:p-5">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-[#1a2e1f]/50 font-bold">総観察数</span>
                            <i data-lucide="camera" class="w-4 h-4 text-emerald-500/40"></i>
                        </div>
                        <div class="stat-value text-2xl md:text-3xl font-black count-up" data-target="<?php echo $stats['total_observations']; ?>">0</div>
                        <div class="mt-1" style="font-size: var(--text-xs);">
                            <span class="<?php echo $stats['days_since_last_obs'] <= 7 ? 'text-emerald-600' : ($stats['days_since_last_obs'] <= 30 ? 'text-amber-600' : 'text-rose-600'); ?>">
                                <?php if ($stats['days_since_last_obs'] <= 7): ?>
                                    <i data-lucide="activity" class="inline w-3 h-3"></i> 順調に更新中
                                <?php elseif ($stats['days_since_last_obs'] <= 30): ?>
                                    <i data-lucide="clock" class="inline w-3 h-3"></i> 最終更新: <?php echo $stats['days_since_last_obs']; ?>日前
                                <?php else: ?>
                                    <i data-lucide="alert-circle" class="inline w-3 h-3"></i> 更新停止 (<?php echo $stats['days_since_last_obs']; ?>日)
                                <?php endif; ?>
                            </span>
                        </div>
                    </div>
                    <div class="glass-card p-4 md:p-5">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-[#1a2e1f]/50 font-bold">確認種数</span>
                            <i data-lucide="flower-2" class="w-4 h-4 text-emerald-500/40"></i>
                        </div>
                        <div class="stat-value text-2xl md:text-3xl font-black count-up" data-target="<?php echo $stats['total_species']; ?>">0</div>
                        <div class="text-[#1a2e1f]/60 mt-1" style="font-size: var(--text-xs);">
                            推定 <?php echo $stats['chao1_estimate']; ?> 種中
                        </div>
                    </div>
                    <div class="glass-card p-4 md:p-5 border-rose-100 bg-rose-50/10">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-rose-600 font-bold">保全重要種</span>
                            <i data-lucide="shield-alert" class="w-4 h-4 text-rose-500/40"></i>
                        </div>
                        <div class="text-2xl md:text-3xl font-black text-rose-600 count-up" data-target="<?php echo $stats['redlist_count']; ?>">0</div>
                        <div class="text-rose-600/60 mt-1" style="font-size: var(--text-xs);">レッドリスト該当種</div>
                    </div>
                    <div class="glass-card p-4 md:p-5">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-[#1a2e1f]/50 font-bold">参加ユーザー</span>
                            <i data-lucide="users" class="w-4 h-4 text-emerald-500/40"></i>
                        </div>
                        <div class="stat-value text-2xl md:text-3xl font-black count-up" data-target="<?php echo $stats['total_observers']; ?>">0</div>
                        <div class="text-[#1a2e1f]/60 mt-1" style="font-size: var(--text-xs);"><?php echo $stats['active_months']; ?> ヶ月活動</div>
                    </div>
                </div>

                <!-- ③ Credit Score Section -->
                <div class="glass-card bg-emerald-50/30 border-emerald-100 p-6 md:p-8 mb-6 shadow-sm">
                    <div class="flex flex-col md:flex-row md:items-center gap-6">
                        <div class="flex-1">
                            <h2 class="text-sm font-bold text-[#1a2e1f]/60 mb-1 flex items-center gap-2">
                                クレジット参考スコア (β)
                                <span class="info-tip text-[#1a2e1f]/50" data-tip="種多様性・保全重要種・観察努力を複合評価した参考スコアです">
                                    <i data-lucide="info" class="w-3.5 h-3.5"></i>
                                </span>
                            </h2>
                            <div class="flex items-baseline gap-3 mb-3">
                                <span class="text-5xl md:text-6xl font-black stat-value count-up" data-target="<?php echo $stats['credit_score']; ?>">0</span>
                                <span class="text-xs px-3 py-1.5 rounded-full font-bold <?php echo $rankBadge; ?> bg-white border border-[#1a2e1f]/10 shadow-sm">
                                    <?php echo $rank; ?>ランク相当
                                </span>
                            </div>

                            <!-- Detailed Breakdown -->
                            <?php if (isset($stats['biodiversity_score'])):
                                $bd = $stats['biodiversity_score']['breakdown'];
                            ?>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                    <?php
                                    $axisColors = [
                                        'richness'           => ['bar' => 'bg-emerald-500', 'text' => 'text-emerald-400'],
                                        'data_confidence'    => ['bar' => 'bg-sky-500',     'text' => 'text-sky-400'],
                                        'conservation_value' => ['bar' => 'bg-red-500',     'text' => 'text-red-400'],
                                        'taxonomic_coverage' => ['bar' => 'bg-amber-500',   'text' => 'text-amber-400'],
                                        'monitoring_effort'  => ['bar' => 'bg-purple-500',  'text' => 'text-purple-400'],
                                    ];
                                    foreach ($bd as $key => $axis):
                                        $colors = $axisColors[$key] ?? ['bar' => 'bg-gray-500', 'text' => 'text-gray-400'];
                                        $weightPct = round(($axis['weight'] ?? 0) * 100);
                                    ?>
                                        <div>
                                            <div class="flex justify-between mb-1" style="font-size: var(--text-xs);">
                                                <span class="font-bold text-[#1a2e1f]/60"><?php echo $axis['label']; ?> (<?php echo $weightPct; ?>%)</span>
                                                <span class="<?php echo $colors['text']; ?> font-bold"><?php echo $axis['score']; ?>pt</span>
                                            </div>
                                            <div class="h-1.5 bg-[#1a2e1f]/5 rounded-full overflow-hidden">
                                                <div class="h-full <?php echo $colors['bar']; ?> rounded-full" style="width: <?php echo $axis['score']; ?>%"></div>
                                            </div>
                                            <p class="text-[#1a2e1f]/60 mt-0.5" style="font-size: var(--text-xs);"><?php echo $axis['raw_label']; ?></p>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            <?php else: ?>
                                <p class="text-xs text-gray-500 leading-relaxed">
                                    種多様性・保全重要種・観察努力を組み合わせた0〜100の参考スコアです。<br>
                                    ※正式なクレジット単位ではなく、方向性を見るための参考値です。
                                </p>
                            <?php endif; ?>
                        </div>
                        <div class="flex-shrink-0 flex items-center justify-center">
                            <svg width="160" height="160" viewBox="0 0 160 160" class="score-arc">
                                <circle cx="80" cy="80" r="68" class="score-arc-track" />
                                <?php
                                $circumference = 2 * M_PI * 68;
                                $scoreOffset = $circumference - ($circumference * ($stats['credit_score'] / 100));
                                ?>
                                <circle cx="80" cy="80" r="68"
                                    class="score-arc-fill"
                                    stroke="<?php echo $rankColor; ?>"
                                    stroke-dasharray="<?php echo $circumference; ?>"
                                    stroke-dashoffset="<?php echo $scoreOffset; ?>"
                                    data-full="<?php echo $circumference; ?>"
                                    data-target="<?php echo $scoreOffset; ?>" />
                                <text x="80" y="78" text-anchor="middle" fill="#1a2e1f"
                                    font-size="36" font-weight="900" class="score-arc"
                                    style="transform: rotate(90deg); transform-origin: 80px 80px;">
                                    <?php echo $stats['credit_score']; ?>
                                </text>
                                <text x="80" y="100" text-anchor="middle" fill="#1a2e1f" opacity="0.4"
                                    font-size="11" font-weight="600"
                                    style="transform: rotate(90deg); transform-origin: 80px 80px;">
                                    スコア
                                </text>
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- ③.5 Data Quality Grade Distribution -->
                <?php if ($dqaTotal > 0): ?>
                    <div class="glass-card p-5 mb-6">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h3 class="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                                    <i data-lucide="shield-check" class="w-4 h-4 text-emerald-500/60"></i>
                                    データ品質グレード分布
                                </h3>
                                <p class="text-gray-600 mt-0.5" style="font-size: var(--text-xs);">観察データの品質グレード（A: 最高〜D: 要改善）</p>
                            </div>
                            <span class="text-xs text-gray-500"><?php echo $dqaTotal; ?> 件</span>
                        </div>

                        <!-- Stacked Bar -->
                        <div class="flex h-6 rounded-lg overflow-hidden mb-3">
                            <?php
                            $dqaColors = [
                                'A' => 'bg-emerald-500',
                                'B' => 'bg-blue-500',
                                'C' => 'bg-amber-500',
                                'D' => 'bg-red-500',
                            ];
                            foreach ($dqaCounts as $g => $cnt):
                                if ($cnt <= 0) continue;
                                $pct = round($cnt / $dqaTotal * 100, 1);
                            ?>
                                <div class="<?php echo $dqaColors[$g]; ?> relative group cursor-default transition-all hover:brightness-110"
                                    style="width: <?php echo $pct; ?>%"
                                    title="Grade <?php echo $g; ?>: <?php echo $cnt; ?>件 (<?php echo $pct; ?>%)">
                                    <?php if ($pct >= 8): ?>
                                        <span class="absolute inset-0 flex items-center justify-center font-black text-white" style="font-size: var(--text-xs);">
                                            <?php echo $g; ?>
                                        </span>
                                    <?php endif; ?>
                                </div>
                            <?php endforeach; ?>
                        </div>

                        <!-- Legend -->
                        <div class="flex flex-wrap gap-x-5 gap-y-1">
                            <?php
                            $dqaLabels = ['A' => '研究用', 'B' => '要検証', 'C' => '要補足', 'D' => '不完全'];
                            $dqaDots = ['A' => 'bg-emerald-500', 'B' => 'bg-blue-500', 'C' => 'bg-amber-500', 'D' => 'bg-red-500'];
                            foreach ($dqaCounts as $g => $cnt):
                                // @phpstan-ignore-next-line
                                $pct = $dqaTotal > 0 ? round($cnt / $dqaTotal * 100, 1) : 0;
                            ?>
                                <div class="flex items-center gap-1.5" style="font-size: var(--text-xs);">
                                    <span class="w-2 h-2 rounded-full <?php echo $dqaDots[$g]; ?>"></span>
                                    <span class="text-gray-400 font-bold"><?php echo $g; ?> <?php echo $dqaLabels[$g]; ?></span>
                                    <span class="text-gray-600"><?php echo $cnt; ?> (<?php echo $pct; ?>%)</span>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                <?php endif; ?>

                <!-- ④ Analytics Cards (3 columns) -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6">
                    <!-- Shannon-Wiener -->
                    <div class="glass-card p-5">
                        <div class="flex items-center justify-between mb-3">
                            <div>
                                <h3 class="text-xs font-bold text-[#1a2e1f]/50 underline decoration-primary/30 underline-offset-4">種多様性インデックス</h3>
                                <p class="text-[#1a2e1f]/50 mt-1" style="font-size: var(--text-xs);">Shannon-Wiener H'</p>
                            </div>
                            <i data-lucide="dna" class="w-5 h-5 text-primary/40"></i>
                        </div>
                        <div class="flex items-baseline gap-1">
                            <span class="text-3xl font-black stat-value"><?php echo $stats['shannon_wiener']; ?></span>
                            <span class="text-sm text-[#1a2e1f]/60">/ 3.5</span>
                        </div>
                        <div class="mt-2 h-1.5 bg-[#1a2e1f]/5 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-primary to-secondary rounded-full bar-fill"
                                style="width: <?php echo min(100, round($stats['shannon_wiener'] / 3.5 * 100)); ?>%"></div>
                        </div>
                    </div>

                    <!-- Chao1 & Completeness -->
                    <div class="glass-card p-5">
                        <div class="flex items-center justify-between mb-3">
                            <div>
                                <h3 class="text-xs font-bold text-[#1a2e1f]/50 underline decoration-secondary/30 underline-offset-4">観察充足率</h3>
                                <p class="text-[#1a2e1f]/50 mt-1" style="font-size: var(--text-xs);">Chao1推定種数ベース</p>
                            </div>
                            <i data-lucide="target" class="w-5 h-5 text-secondary/40"></i>
                        </div>
                        <div class="flex items-baseline gap-1">
                            <span class="text-3xl font-black stat-value"><?php echo $stats['completeness_pct']; ?></span>
                            <span class="text-sm text-[#1a2e1f]/60">%</span>
                        </div>
                        <p class="text-[#1a2e1f]/60 mt-1" style="font-size: var(--text-xs);">
                            <?php echo $stats['total_species']; ?> 種発見 / 推定 <?php echo $stats['chao1_estimate']; ?> 種
                        </p>
                    </div>

                    <!-- Conservation Score -->
                    <div class="glass-card p-5 border-danger/20">
                        <div class="flex items-center justify-between mb-3">
                            <div>
                                <h3 class="text-xs font-bold text-danger/70 underline decoration-danger/30 underline-offset-4">保全重要種確認数</h3>
                                <p class="text-[#1a2e1f]/50 mt-1" style="font-size: var(--text-xs);">RL掲載種など</p>
                            </div>
                            <i data-lucide="shield" class="w-5 h-5 text-danger/40"></i>
                        </div>
                        <div class="flex items-baseline gap-1">
                            <span class="text-3xl font-black text-danger/90"><?php echo $stats['redlist_count']; ?></span>
                            <span class="text-sm text-[#1a2e1f]/60">種</span>
                        </div>
                        <p class="text-primary/60 mt-1" style="font-size: var(--text-xs);">
                            <?php if ($stats['redlist_count'] > 0): ?>
                                <i data-lucide="info" class="inline w-3 h-3"></i> レッドリスト該当種含む
                            <?php else: ?>
                                まだ発見されていません / 継続調査中
                            <?php endif; ?>
                        </p>
                    </div>
                </div>

                <!-- ⑤ Regional Contribution Share (Regional Baseline Benchmark) -->
                <?php if (!empty($stats['regional_total_redlist']) && $stats['regional_total_redlist'] > 0): ?>
                    <div class="glass-card p-5 md:p-6 mb-6 border-l-4 border-emerald-500">
                        <div class="flex flex-col md:flex-row gap-6 items-center">
                            <div class="flex-1">
                                <h3 class="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2">
                                    <i data-lucide="globe" class="w-4 h-4"></i> 地域貢献度（Regional Contribution Share）
                                </h3>
                                <p class="text-xs text-[#1a2e1f]/70 leading-relaxed">
                                    このサイトは、プラットフォーム全体で確認されている保全重要種（<span class="font-bold"><?php echo $stats['regional_total_redlist']; ?>種</span>）のうち、<strong class="text-emerald-700 text-sm"><?php echo $stats['redlist_count']; ?>種</strong>の生息を支えています。これは地域全体の生物多様性保全において、極めて重要な貢献（シェア）を示しています。
                                </p>
                            </div>
                            <div class="w-full md:w-64 flex-shrink-0 bg-white/50 rounded-xl p-4 border border-emerald-100">
                                <div class="mb-2 flex justify-between items-end">
                                    <span class="text-xs font-bold text-emerald-800/60">保全貢献シェア</span>
                                    <div class="flex items-baseline gap-0.5">
                                        <span class="text-3xl font-black text-emerald-600"><?php echo round($stats['redlist_count'] / $stats['regional_total_redlist'] * 100, 1); ?></span>
                                        <span class="text-sm font-bold text-emerald-600/70">%</span>
                                    </div>
                                </div>
                                <div class="h-2.5 bg-emerald-100 rounded-full overflow-hidden">
                                    <div class="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                                        style="width: <?php echo min(100, round($stats['redlist_count'] / $stats['regional_total_redlist'] * 100)); ?>%">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                <?php endif; ?>

                <!-- ⑥ Trend Chart + ⑦ Map -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6">
                    <!-- Monthly Trend Chart -->
                    <?php if (!empty($stats['monthly_trend'])): ?>
                        <div class="glass-card p-5 md:p-6">
                            <h2 class="text-xs font-bold tracking-[0.15em] text-gray-400 uppercase mb-4 flex items-center gap-2">
                                <i data-lucide="trending-up" class="w-4 h-4"></i> 観察数の推移
                            </h2>
                            <?php
                            $trendData = $stats['monthly_trend'];
                            $maxVal = max($trendData);
                            $months = array_keys($trendData);
                            $values = array_values($trendData);
                            $chartW = 100;
                            $chartH = 60;
                            $n = count($months);
                            $points = [];
                            $areaPoints = [];
                            for ($i = 0; $i < $n; $i++) {
                                $x = $n > 1 ? ($i / ($n - 1)) * $chartW : $chartW / 2;
                                $y = $maxVal > 0 ? $chartH - ($values[$i] / $maxVal * ($chartH - 5)) : $chartH;
                                $points[] = "$x,$y";
                                $areaPoints[] = "$x,$y";
                            }
                            $pathD = 'M ' . implode(' L ', $points);
                            $areaD = 'M 0,' . $chartH . ' L ' . implode(' L ', $areaPoints) . " L $chartW,$chartH Z";
                            ?>
                            <svg viewBox="0 0 <?php echo $chartW; ?> <?php echo $chartH + 15; ?>" class="w-full" style="height: 180px;">
                                <defs>
                                    <linearGradient id="trendGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stop-color="var(--color-primary-light)" stop-opacity="0.3" />
                                        <stop offset="100%" stop-color="var(--color-primary-light)" stop-opacity="0" />
                                    </linearGradient>
                                </defs>
                                <!-- Grid lines -->
                                <?php for ($g = 0; $g < 4; $g++): ?>
                                    <line x1="0" y1="<?php echo ($chartH / 3) * $g; ?>" x2="<?php echo $chartW; ?>"
                                        y2="<?php echo ($chartH / 3) * $g; ?>" stroke="rgba(26,46,31,0.06)" stroke-width="0.3" />
                                <?php endfor; ?>
                                <!-- Area fill -->
                                <path d="<?php echo $areaD; ?>" fill="url(#trendGrad)" />
                                <!-- Line -->
                                <path d="<?php echo $pathD; ?>" fill="none" stroke="var(--color-primary-light)"
                                    stroke-width="1.5" class="trend-line" />
                                <!-- Dots + Labels -->
                                <?php for ($i = 0; $i < $n; $i++):
                                    $x = $n > 1 ? ($i / ($n - 1)) * $chartW : $chartW / 2;
                                    $y = $maxVal > 0 ? $chartH - ($values[$i] / $maxVal * ($chartH - 5)) : $chartH;
                                ?>
                                    <circle cx="<?php echo $x; ?>" cy="<?php echo $y; ?>" r="2"
                                        fill="var(--color-primary-light)" stroke="#0f172a" stroke-width="1"
                                        class="trend-dot" style="animation-delay: <?php echo 0.6 + $i * 0.1; ?>s" />
                                    <text x="<?php echo $x; ?>" y="<?php echo $chartH + 10; ?>"
                                        text-anchor="middle" fill="#4b5563" font-size="3" font-weight="600">
                                        <?php echo substr($months[$i], 5); ?>
                                    </text>
                                    <text x="<?php echo $x; ?>" y="<?php echo $y - 4; ?>"
                                        text-anchor="middle" fill="#9ca3af" font-size="2.5" font-weight="600"
                                        class="trend-dot" style="animation-delay: <?php echo 0.6 + $i * 0.1; ?>s">
                                        <?php echo $values[$i]; ?>
                                    </text>
                                <?php endfor; ?>
                            </svg>
                        </div>
                    <?php endif; ?>

                    <!-- Inline Map -->
                    <div class="glass-card p-3 md:p-4">
                        <h2 class="text-xs font-bold tracking-[0.15em] text-gray-400 uppercase mb-3 px-2 flex items-center gap-2">
                            <i data-lucide="map" class="w-4 h-4"></i> サイトエリア
                        </h2>
                        <div id="site-map" style="height: 240px;" class="rounded-xl"></div>
                    </div>
                </div>

                <!-- ⑦ Taxonomic Groups + ⑧ Top Species -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6">
                    <?php if (!empty($stats['taxonomic_groups'])): ?>
                        <div class="glass-card p-5">
                            <h2 class="text-xs font-bold tracking-[0.15em] text-gray-400 uppercase mb-4 flex items-center gap-2">
                                <i data-lucide="layers" class="w-4 h-4"></i> 分類群
                            </h2>
                            <?php
                            $maxGroup = max($stats['taxonomic_groups']);
                            $groupColors = ['植物' => '#059669', '鳥類' => '#0EA5E9', '昆虫' => '#f59e0b', '両生爬虫類' => '#8b5cf6', '哺乳類' => '#f97316'];
                            foreach ($stats['taxonomic_groups'] as $group => $count):
                                $pct = $maxGroup > 0 ? round($count / $maxGroup * 100) : 0;
                                $color = $groupColors[$group] ?? '#6b7280';
                            ?>
                                <div class="mb-3">
                                    <div class="flex justify-between text-xs mb-1">
                                        <span class="text-gray-600 font-medium"><?php echo htmlspecialchars($group); ?></span>
                                        <span class="text-gray-500"><?php echo number_format($count); ?> 件</span>
                                    </div>
                                    <div class="h-2 bg-[#1a2e1f]/5 rounded-full overflow-hidden">
                                        <div class="h-full rounded-full bar-fill" style="width: <?php echo $pct; ?>%; background: <?php echo $color; ?>"></div>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($stats['top_species'])): ?>
                        <div class="glass-card p-5">
                            <h2 class="text-xs font-bold tracking-[0.15em] text-gray-400 uppercase mb-3 flex items-center gap-2">
                                <i data-lucide="bug" class="w-4 h-4"></i> 確認種 TOP 10
                            </h2>
                            <div class="space-y-1">
                                <?php $rank = 1;
                                foreach ($stats['top_species'] as $name => $count): ?>
                                    <div class="flex items-center gap-2 text-sm species-badge p-2 rounded-lg hover:bg-[#1a2e1f]/5 transition cursor-default">
                                        <span class="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 font-black flex items-center justify-center shrink-0" style="font-size: var(--text-xs);"><?php echo $rank++; ?></span>
                                        <span class="flex-1 truncate"><?php echo htmlspecialchars($name); ?></span>
                                        <?php if (isset($redListSpecies[$name])): ?>
                                            <span class="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold shrink-0" style="font-size: var(--text-xs);">RL</span>
                                        <?php endif; ?>
                                        <span class="text-xs text-gray-500 shrink-0"><?php echo $count; ?></span>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endif; ?>
                </div>

                <!-- ⑨ Phenology Matrix -->
                <?php if (!empty($stats['phenology_matrix'])): ?>
                    <div class="glass-card p-5 md:p-6 mb-6">
                        <h2 class="text-xs font-bold tracking-[0.15em] text-gray-400 uppercase mb-4 flex items-center gap-2">
                            <i data-lucide="calendar" class="w-4 h-4"></i> 季節フェノロジー
                            <span class="info-tip text-gray-600" data-tip="月ごと×分類群の観察分布ヒートマップ">
                                <i data-lucide="info" class="w-3 h-3"></i>
                            </span>
                        </h2>
                        <?php
                        $allGroups = array_keys($stats['taxonomic_groups']);
                        $monthNames = [
                            '1' => '1月',
                            '2' => '2月',
                            '3' => '3月',
                            '4' => '4月',
                            '5' => '5月',
                            '6' => '6月',
                            '7' => '7月',
                            '8' => '8月',
                            '9' => '9月',
                            '10' => '10月',
                            '11' => '11月',
                            '12' => '12月'
                        ];
                        $maxCell = 0;
                        for ($m = 1; $m <= 12; $m++) {
                            foreach ($allGroups as $g) {
                                $v = $stats['phenology_matrix'][$m][$g] ?? 0;
                                if ($v > $maxCell) $maxCell = $v;
                            }
                        }
                        ?>
                        <div class="overflow-x-auto">
                            <table class="w-full" style="font-size: var(--text-xs);">
                                <thead>
                                    <tr>
                                        <th class="text-left text-gray-500 pb-2 pr-2 font-normal"></th>
                                        <?php for ($m = 1; $m <= 12; $m++): ?>
                                            <th class="text-center text-gray-500 pb-2 font-normal w-8"><?php echo $m; ?>月</th>
                                        <?php endfor; ?>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php foreach ($allGroups as $g): ?>
                                        <tr>
                                            <td class="text-gray-400 pr-2 py-1 whitespace-nowrap"><?php echo htmlspecialchars($g); ?></td>
                                            <?php for ($m = 1; $m <= 12; $m++):
                                                $v = $stats['phenology_matrix'][$m][$g] ?? 0;
                                                $intensity = $maxCell > 0 ? $v / $maxCell : 0;
                                                $opacity = $v > 0 ? 0.15 + ($intensity * 0.85) : 0;
                                                $color = $groupColors[$g] ?? '#059669';
                                            ?>
                                                <td class="text-center py-1">
                                                    <div class="phenology-cell w-6 h-6 md:w-7 md:h-7 mx-auto flex items-center justify-center"
                                                        style="background: <?php echo $color; ?>; opacity: <?php echo $opacity; ?>"
                                                        title="<?php echo htmlspecialchars($g) . ' ' . $m . '月: ' . $v . '件'; ?>">
                                                        <?php if ($v > 0): ?>
                                                            <span class="text-white font-bold" style="font-size: 8px;"><?php echo $v; ?></span>
                                                        <?php endif; ?>
                                                    </div>
                                                </td>
                                            <?php endfor; ?>
                                        </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                <?php endif; ?>

                <!-- ⑩ Red List Species -->
                <?php if (!empty($redListSpecies)): ?>
                    <div class="glass-card p-5 mb-6">
                        <h2 class="text-xs font-bold tracking-[0.15em] text-gray-400 uppercase mb-3 flex items-center gap-2">
                            <span class="text-red-400">⚠️</span> レッドリスト該当種
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <?php foreach ($redListSpecies as $name => $lists): ?>
                                <div class="flex items-center gap-2 text-sm p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                                    <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-red-400 shrink-0"></i>
                                    <span class="flex-1 truncate text-red-300 font-medium"><?php echo htmlspecialchars($name); ?></span>
                                    <?php foreach ($lists as $listId => $entry): ?>
                                        <?php
                                        $cat = $entry['category'] ?? '';
                                        $color = $entry['category_color'] ?? '#6b7280';
                                        ?>
                                        <span class="px-1.5 py-0.5 rounded font-bold shrink-0"
                                            style="font-size: var(--text-xs); background: <?php echo $color; ?>20; color: <?php echo $color; ?>">
                                            <?php echo htmlspecialchars($cat); ?>
                                        </span>
                                    <?php endforeach; ?>
                                </div>
                            <?php endforeach; ?>
                        </div>
                        <p class="text-gray-500 mt-3" style="font-size: var(--text-xs);">出典: 環境省レッドリスト / 静岡県レッドデータブック2020</p>
                    </div>
                <?php endif; ?>

                <!-- ⑪ TNFD Context Section -->
                <div class="tnfd-card rounded-2xl p-6 md:p-8 mb-6">
                    <h2 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <i data-lucide="book-open" class="w-4 h-4 text-emerald-600"></i>
                        クレジット関連指標について
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600 leading-relaxed">
                        <div>
                            <h3 class="text-slate-800 font-bold mb-2">これらの指標は何ですか？</h3>
                            <p class="mb-3">市民の観察データのみから算出した、生物多様性クレジットや自然共生サイト評価の「参考指標」です。世界のクレジットスキームで重視される「種の豊富さ・絶滅危惧種・観察努力」を簡易的に数値化しています。</p>

                            <h3 class="text-slate-800 font-bold mb-2">⚠️ 重要な注意事項</h3>
                            <ul class="space-y-1 text-slate-500">
                                <li>• これらは正式なクレジット単位ではありません</li>
                                <li>• 正式な算定には専門家による現地調査が必要です</li>
                                <li>• 社内共有用の「たたき台」としてご利用ください</li>
                            </ul>
                        </div>
                        <div>
                            <h3 class="text-slate-800 font-bold mb-2">世界標準との関係</h3>
                            <p class="mb-3">TNFD・IUCNが推奨する生物多様性評価の基本要素を参考にしています:</p>
                            <div class="space-y-2">
                                <div class="flex items-center gap-2">
                                    <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    <span class="text-slate-700">種の多様性 (Shannon-Wiener指数)</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <div class="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                    <span class="text-slate-700">保全重要種の存在</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <div class="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                    <span class="text-slate-700">地域社会のモニタリング参画</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <div class="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                    <span class="text-slate-700">外来種の管理状況</span>
                                </div>
                            </div>
                            <p class="mt-3 text-gray-600" style="font-size: var(--text-xs);">将来的には専門家の知見を組み合わせ、クレジット算定の基礎データとして機能拡充予定。</p>
                        </div>
                    </div>
                </div>

                <!-- ⑫ Scientific Integrity Disclaimer (Anti-Greenwashing) -->
                <div class="mt-8 p-5 md:p-6 bg-gray-50/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl no-print">
                    <div class="flex items-start gap-4">
                        <div class="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100">
                            <i data-lucide="shield-alert" class="w-5 h-5 text-gray-400"></i>
                        </div>
                        <div>
                            <h4 class="text-sm font-bold text-gray-700 mb-2">【重要】データの科学的誠実性に関する免責事項 (Anti-Greenwashing Policy)</h4>
                            <p class="text-xs text-gray-500 leading-relaxed mb-2">
                                本ダッシュボードに表示される指標およびデータは、ikimon.lifeの市民科学（Citizen Science）ならびに専門家による継続的な「確認データ（Presence-only data）」に基づいています。<strong>特定の種の絶対的な生息密度や増減を完全に保証するものではありません。</strong>
                            </p>
                            <p class="text-xs text-gray-500 leading-relaxed">
                                当プラットフォームは、企業や地域コミュニティによる<span class="text-emerald-600 font-bold">「継続的な自然観察の努力」</span>と、それに伴う<span class="text-emerald-600 font-bold">「確かな生息のエビデンス（写真・GPS・日時）」</span>を客観的に可視化するものです。TNFD開示等の公式なESG報告に本データを使用される際は、定性的なインパクト証明・補完データとしてご活用いただき、必要に応じて専門家のレビューを含めることを推奨します。
                            </p>
                        </div>
                    </div>
                </div>


                <!-- PR Auto-Crafter Modal -->
                <div x-show="isPrModalOpen" style="display: none;"
                    class="fixed inset-0 z-50 overflow-y-auto"
                    x-transition:enter="transition ease-out duration-300"
                    x-transition:enter-start="opacity-0"
                    x-transition:enter-end="opacity-100"
                    x-transition:leave="transition ease-in duration-200"
                    x-transition:leave-start="opacity-100"
                    x-transition:leave-end="opacity-0">
                    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="closePrModal()"></div>
                    <div class="relative min-h-screen flex items-center justify-center p-4">
                        <div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden" @click.stop>
                            <div class="p-6 md:p-8">
                                <div class="flex items-center justify-between mb-6">
                                    <h3 class="text-lg font-black text-[#1a2e1f] flex items-center gap-2">
                                        <i data-lucide="sparkles" class="w-5 h-5 text-emerald-500"></i> AI環境貢献PR (Auto-Crafter)
                                    </h3>
                                    <button @click="closePrModal()" class="text-gray-400 hover:text-gray-600 transition">
                                        <i data-lucide="x" class="w-5 h-5"></i>
                                    </button>
                                </div>

                                <div x-show="isPrGenerating" class="flex flex-col items-center justify-center py-12">
                                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
                                    <p class="text-sm font-bold text-gray-600 animate-pulse">観測データに基づき、PR原案を生成しています...</p>
                                    <p class="text-xs text-gray-400 mt-2">※数秒〜十数秒かかる場合があります</p>
                                </div>

                                <div x-show="prError" class="p-4 bg-red-50 text-red-600 text-sm rounded-xl mb-4" x-text="prError"></div>

                                <div x-show="!isPrGenerating && prContent" style="display: none;">
                                    <div class="prose prose-sm prose-emerald max-w-none bg-gray-50 p-6 rounded-xl border border-gray-100 max-h-[60vh] overflow-y-auto whitespace-pre-wrap select-all" x-text="prContent">
                                    </div>
                                    <div class="mt-6 flex justify-end gap-3">
                                        <button @click="copyPrContent()" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition flex items-center gap-2">
                                            <i data-lucide="copy" class="w-4 h-4"></i> コピーする
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </main>

        <script nonce="<?= CspNonce::attr() ?>">
            function siteDashboard() {
                return {
                    map: null,

                    init() {
                        setTimeout(() => this.initMap(), 100);
                        this.animateCounters();
                    },

                    // Animated counters
                    animateCounters() {
                        document.querySelectorAll('.count-up').forEach(el => {
                            const target = parseInt(el.dataset.target) || 0;
                            const isDecimal = el.dataset.target?.includes('.');
                            const duration = 1500;
                            const start = performance.now();

                            const tick = (now) => {
                                const elapsed = now - start;
                                const progress = Math.min(elapsed / duration, 1);
                                const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
                                const current = Math.round(eased * target);
                                el.textContent = isDecimal ?
                                    (eased * parseFloat(el.dataset.target)).toFixed(1) :
                                    current.toLocaleString();
                                if (progress < 1) requestAnimationFrame(tick);
                            };
                            requestAnimationFrame(tick);
                        });
                    },

                    initMap() {
                        const center = <?php echo json_encode($site['center']); ?>;

                        this.map = new maplibregl.Map({
                            container: 'site-map',
                            style: 'https://tile.openstreetmap.jp/styles/maptiler-basic-ja/style.json',
                            center: center,
                            zoom: 15,
                            attributionControl: false
                        });

                        this.map.addControl(new maplibregl.AttributionControl({
                            compact: true
                        }));
                        this.map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

                        this.map.on('load', () => {
                            const geojson = <?php echo json_encode($geojson); ?>;

                            if (geojson) {
                                this.map.addSource('site-boundary', {
                                    type: 'geojson',
                                    data: geojson
                                });

                                this.map.addLayer({
                                    id: 'site-fill',
                                    type: 'fill',
                                    source: 'site-boundary',
                                    paint: {
                                        'fill-color': '#059669',
                                        'fill-opacity': 0.15
                                    }
                                });

                                this.map.addLayer({
                                    id: 'site-border-glow',
                                    type: 'line',
                                    source: 'site-boundary',
                                    paint: {
                                        'line-color': '#059669',
                                        'line-width': 6,
                                        'line-opacity': 0.3,
                                        'line-blur': 3
                                    }
                                });

                                this.map.addLayer({
                                    id: 'site-border',
                                    type: 'line',
                                    source: 'site-boundary',
                                    paint: {
                                        'line-color': '#059669',
                                        'line-width': 2.5,
                                        'line-opacity': 0.9,
                                        'line-dasharray': [2, 1]
                                    }
                                });

                                const bounds = new maplibregl.LngLatBounds();
                                const coords = geojson.features[0]?.geometry?.coordinates;
                                if (coords) {
                                    const ring = coords[0];
                                    ring.forEach(c => bounds.extend(c));
                                    this.map.fitBounds(bounds, {
                                        padding: 40
                                    });
                                }
                            }

                            this.loadSiteObservations();
                        });
                    },

                    async loadSiteObservations() {
                        try {
                            const res = await fetch('api/get_observations.php?limit=200');
                            const result = await res.json();
                            const obs = result.data || [];

                            const geojson = <?php echo json_encode($geojson); ?>;
                            if (!geojson || !geojson.features[0]) return;

                            const polygon = geojson.features[0].geometry.coordinates[0];

                            const inSite = obs.filter(o => {
                                const lat = parseFloat(o.lat);
                                const lng = parseFloat(o.lng);
                                return this.pointInPolygon(lat, lng, polygon);
                            });

                            const features = inSite.map(o => ({
                                type: 'Feature',
                                properties: {
                                    id: o.id,
                                    name: o.taxon?.name || o.species_name || '未同定'
                                },
                                geometry: {
                                    type: 'Point',
                                    coordinates: [parseFloat(o.lng), parseFloat(o.lat)]
                                }
                            }));

                            this.map.addSource('site-observations', {
                                type: 'geojson',
                                data: {
                                    type: 'FeatureCollection',
                                    features
                                },
                                cluster: true,
                                clusterMaxZoom: 16,
                                clusterRadius: 40
                            });

                            this.map.addLayer({
                                id: 'site-obs-clusters',
                                type: 'circle',
                                source: 'site-observations',
                                filter: ['has', 'point_count'],
                                paint: {
                                    'circle-color': '#0EA5E9',
                                    'circle-radius': 16,
                                    'circle-stroke-width': 2,
                                    'circle-stroke-color': '#fff'
                                }
                            });

                            this.map.addLayer({
                                id: 'site-obs-count',
                                type: 'symbol',
                                source: 'site-observations',
                                filter: ['has', 'point_count'],
                                layout: {
                                    'text-field': '{point_count_abbreviated}',
                                    'text-font': ['Noto Sans Regular'],
                                    'text-size': 11
                                },
                                paint: {
                                    'text-color': '#ffffff'
                                }
                            });

                            this.map.addLayer({
                                id: 'site-obs-points',
                                type: 'circle',
                                source: 'site-observations',
                                filter: ['!', ['has', 'point_count']],
                                paint: {
                                    'circle-color': '#06b6d4',
                                    'circle-radius': 6,
                                    'circle-stroke-width': 2,
                                    'circle-stroke-color': '#ffffff'
                                }
                            });

                        } catch (e) {
                            console.error('Failed to load observations:', e);
                        }
                    },

                    pointInPolygon(lat, lng, polygon) {
                        let inside = false;
                        const x = lng,
                            y = lat;
                        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                            const xi = polygon[i][0],
                                yi = polygon[i][1];
                            const xj = polygon[j][0],
                                yj = polygon[j][1];
                            if (((yi < y && yj >= y) || (yj < y && yi >= y)) && (xi <= x || xj <= x)) {
                                if (xi + (y - yi) / (yj - yi) * (xj - xi) < x) {
                                    inside = !inside;
                                }
                            }
                        }
                        return inside;
                    },

                    // PR Auto-Crafter
                    isPrModalOpen: false,
                    isPrGenerating: false,
                    prContent: null,
                    prError: null,

                    async openPrModal(siteId) {
                        this.isPrModalOpen = true;

                        if (this.prContent) return;

                        this.isPrGenerating = true;
                        this.prError = null;

                        try {
                            const res = await fetch('api/generate_pr.php', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    site_id: siteId
                                })
                            });

                            const data = await res.json();
                            if (data.success) {
                                this.prContent = data.content;
                            } else {
                                this.prError = data.message || '生成に失敗しました。';
                            }
                        } catch (e) {
                            this.prError = '通信エラーが発生しました。';
                        } finally {
                            this.isPrGenerating = false;
                        }
                    },

                    closePrModal() {
                        this.isPrModalOpen = false;
                    },

                    copyPrContent() {
                        if (this.prContent) {
                            navigator.clipboard.writeText(this.prContent).then(() => {
                                alert('クリップボードにコピーしました');
                            });
                        }
                    }
                };
            }
            lucide.createIcons();
        </script>
    <?php endif; ?>
    <?php include __DIR__ . '/components/badge_notification.php'; ?>
</body>

</html>