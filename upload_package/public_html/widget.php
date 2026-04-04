<?php

/**
 * ikimon.life - The Living Data Feed (ESG Widget)
 * 
 * Iframe-able widget for corporate sponsors to embed on their CSR pages.
 * Displays real-time biodiversity metrics for a specific site.
 * 
 * Usage: <iframe src="https://ikimon.life/widget.php?site_id=ikan_hq&theme=light" width="100%" height="300" frameborder="0"></iframe>
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/SiteManager.php';
require_once __DIR__ . '/../libs/BiodiversityScorer.php';
require_once __DIR__ . '/../libs/CspNonce.php';

$siteId = $_GET['site_id'] ?? null;
$theme = $_GET['theme'] ?? 'light'; // 'light' or 'transparent'

if (!$siteId) {
    die("Site ID is required.");
}

$site = SiteManager::load($siteId);
if (!$site) {
    die("Site not found.");
}

CspNonce::sendHeader();

// Ensure the site has a sponsor to display (though we display it either way for MVP)
$sponsorName = $site['sponsor']['name'] ?? 'ikimon.life Community';

// Fetch stats using the monitoring reference scorer.
$stats = MonitoringReferenceScorer::calculateSiteStats($siteId);

// Handle specific theme styles
$bgClass = $theme === 'light' ? 'bg-white/80 border-gray-100 shadow-sm' : 'bg-[#1a2e1f]/[0.02] border-emerald-500/10 backdrop-blur-md';
$textColor = $theme === 'light' ? 'text-gray-800' : 'text-[#1a2e1f]';

?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ikimon.life Living Data Feed</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@0.477.0/dist/umd/lucide.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&family=Noto+Sans+JP:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', 'Noto Sans JP', sans-serif;
            background: transparent;
            margin: 0;
            padding: 1rem;
        }

        .stat-number {
            font-family: 'Outfit', sans-serif;
        }

        .pulse-dot {
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% {
                transform: scale(0.95);
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
            }

            70% {
                transform: scale(1);
                box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
            }

            100% {
                transform: scale(0.95);
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
            }
        }

        /* Custom scrollbar for iframe */
        ::-webkit-scrollbar {
            width: 4px;
        }

        ::-webkit-scrollbar-track {
            background: transparent;
        }

        ::-webkit-scrollbar-thumb {
            background: rgba(16, 185, 129, 0.2);
            border-radius: 4px;
        }
    </style>
</head>

<body class="overflow-hidden">

    <div class="relative w-full max-w-sm mx-auto rounded-2xl border p-5 <?php echo $bgClass; ?>">
        <!-- Header -->
        <div class="flex items-start justify-between mb-4">
            <div>
                <div class="flex items-center gap-1.5 mb-1">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 pulse-dot"></span>
                    <span class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Live Monitoring</span>
                </div>
                <h2 class="text-base font-black <?php echo $textColor; ?> leading-tight line-clamp-1">
                    <?php echo htmlspecialchars($site['name']); ?>
                </h2>
                <p class="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                    <i data-lucide="award" class="w-3 h-3 text-emerald-500"></i>
                    Supported by <strong><?php echo htmlspecialchars($sponsorName); ?></strong>
                </p>
            </div>
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-2 gap-3 mb-4">
            <!-- Obs Count -->
            <div class="bg-white/50 rounded-xl p-3 border border-gray-100">
                <div class="flex items-center gap-1.5 mb-1 text-gray-400">
                    <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                    <span class="text-[10px] font-bold">総観察数</span>
                </div>
                <div class="text-2xl font-black text-emerald-600 stat-number">
                    <?php echo number_format($stats['total_observations']); ?>
                </div>
            </div>

            <!-- Species Count -->
            <div class="bg-white/50 rounded-xl p-3 border border-gray-100">
                <div class="flex items-center gap-1.5 mb-1 text-gray-400">
                    <i data-lucide="flower-2" class="w-3.5 h-3.5"></i>
                    <span class="text-[10px] font-bold">確認種数</span>
                </div>
                <div class="text-2xl font-black text-emerald-600 stat-number">
                    <?php echo number_format($stats['total_species']); ?>
                </div>
            </div>
        </div>

        <!-- Red List Highlight -->
        <?php if ($stats['redlist_count'] > 0): ?>
            <div class="flex items-center gap-3 bg-rose-50/50 rounded-xl p-3 border border-rose-100 mb-4">
                <div class="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="shield-alert" class="w-4 h-4 text-rose-500"></i>
                </div>
                <div>
                    <p class="text-[10px] font-bold text-rose-500">保全重要種 (レッドリスト等)</p>
                    <p class="text-sm font-black text-rose-600 stat-number"><?php echo number_format($stats['redlist_count']); ?> 種確認</p>
                </div>
            </div>
        <?php else: ?>
            <div class="flex items-center gap-3 bg-emerald-50/50 rounded-xl p-3 border border-emerald-100 mb-4">
                <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="activity" class="w-4 h-4 text-emerald-500"></i>
                </div>
                <div>
                    <p class="text-[10px] font-bold text-emerald-600">最新アクティビティ</p>
                    <p class="text-xs font-bold text-gray-600 stat-number">直近7日間で順調に更新中</p>
                </div>
            </div>
        <?php endif; ?>

        <!-- Footer / Branding -->
        <div class="pt-3 border-t border-gray-100 flex items-center justify-between">
            <div class="flex flex-col">
                <a href="https://ikimon.life/site_dashboard.php?site=<?php echo urlencode($siteId); ?>" target="_blank" rel="noopener noreferrer" class="text-[10px] text-gray-400 hover:text-emerald-500 transition font-bold flex items-center gap-1">
                    詳細レポートを見る <i data-lucide="external-link" class="w-3 h-3"></i>
                </a>
                <span class="text-[8px] text-gray-400 mt-0.5 leading-tight">*市民観測に基づく参考データ</span>
            </div>
            <a href="https://ikimon.life" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition pl-2">
                <img src="https://ikimon.life/assets/images/logo_icon.svg" alt="ikimon.life" class="w-4 h-4" onerror="this.style.display='none'">
                <span class="text-[10px] font-black text-gray-800 tracking-tight stat-number">ikimon.life</span>
            </a>
        </div>
    </div>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>
