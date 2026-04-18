<?php

/**
 * Site Dashboard - Organization Record Board
 * 
 * Organization-facing view for:
 * - site-level observation archive
 * - seasonal review
 * - participation and continuity checks
 * - optional external-reference handoff
 * 
 * Usage: site_dashboard.php?site=ikan_hq
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CorporateAccess.php';
require_once __DIR__ . '/../libs/CorporatePlanGate.php';
require_once __DIR__ . '/../libs/SiteManager.php';
require_once __DIR__ . '/../libs/RedListManager.php';
require_once __DIR__ . '/../libs/DataQuality.php';

Auth::init();

$siteId = $_GET['site'] ?? '';
$isDemoMode = isset($_GET['demo']) && $_GET['demo'] === '1';
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

        $siteCorporation = CorporatePlanGate::resolveCorporationForSite($siteId);
        $canRevealSpeciesDetails = CorporatePlanGate::canRevealSpeciesDetails($siteCorporation);
        if ($canRevealSpeciesDetails && !empty($stats['top_species'])) {
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
$corpId = ($siteId !== '') ? (CorporateAccess::resolveCorporationIdForSite($siteId) ?? '') : '';
$corporation = $corpId !== '' ? CorporatePlanGate::resolveCorporationForSite($siteId) : null;
$planLabel = $corporation ? CorporateManager::getPlanDefinition((string)($corporation['plan'] ?? 'community'))['label'] : 'Personal';
$canUseAdvancedOutputs = CorporatePlanGate::canUseAdvancedOutputs($corporation);
$canRevealSpeciesDetails = CorporatePlanGate::canRevealSpeciesDetails($corporation);
$isCommunityWorkspace = CorporatePlanGate::isCommunityWorkspace($corporation);

$meta_title = $site ? $site['name'] . ' 記録ボード' : 'サイトの記録ボード';

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

$scoreDetails = $stats['biodiversity_score'] ?? null;
$scoreBreakdown = $scoreDetails['breakdown'] ?? [];
$monitoringSummary = [];
$recommendedActions = [];
$referenceLinks = [
    [
        'label' => 'TNFD Recommendations (2023)',
        'url' => 'https://tnfd.global/publication/recommendations-of-the-taskforce-on-nature-related-financial-disclosures/',
    ],
    [
        'label' => 'CBD GBF Target 15',
        'url' => 'https://www.cbd.int/gbf/targets/15',
    ],
    [
        'label' => 'CBD GBF Target 3 (30x30)',
        'url' => 'https://www.cbd.int/gbf/targets/3',
    ],
    [
        'label' => 'SBTN Step 1: Assess',
        'url' => 'https://sciencebasedtargetsnetwork.org/companies/take-action/assess/',
    ],
];

if ($stats) {
    $researchGradePct = $dqaTotal > 0 ? round(($dqaCounts['A'] / $dqaTotal) * 100) : null;
    $monitoredMonths = count($stats['monthly_trend'] ?? []);
    $taxonomicGroupCount = count($stats['taxonomic_groups'] ?? []);

    $monitoringSummary[] = [
        'title' => 'いま分かること',
        'body' => sprintf(
            '%d件の観察から%d種を確認。直近%d日以内の更新で、継続モニタリングの有無を把握できます。',
            $stats['total_observations'],
            $stats['total_species'],
            $stats['days_since_last_obs']
        ),
    ];
    $monitoringSummary[] = [
        'title' => '注意して読む点',
        'body' => sprintf(
            'この画面は存在記録ベースです。個体数や不在は直接わからず、観測努力の偏りも受けます。月別カバーは%d/12か月です。',
            $monitoredMonths
        ),
    ];
    $monitoringSummary[] = [
        'title' => '保全シグナル',
        'body' => $canRevealSpeciesDetails
            ? ($stats['redlist_count'] > 0
                ? sprintf('レッドリスト該当種が%d種あります。現場計画と照合し、扱いを慎重に確認する対象です。', $stats['redlist_count'])
                : '現時点でレッドリスト該当種の確認はありません。未確認イコール不在ではないため、継続観測が必要です。')
            : 'Community ワークスペースでは、配慮が必要な種の詳細は公開しません。必要な確認や出力は Public プランで扱います。',
    ];

    if ($stats['days_since_last_obs'] > 30 || $monitoredMonths < 6) {
        $recommendedActions[] = [
            'title' => '観測の空白月を埋める',
            'body' => '季節によって見える種が変わるため、更新が空いた月や未観測月を優先して追加観測すると解像度が上がります。',
        ];
    }

    if ($researchGradePct !== null && $researchGradePct < 60) {
        $recommendedActions[] = [
            'title' => '記録品質のルールを揃える',
            'body' => sprintf('品質Aは現在%d%%です。写真の複数カット、位置情報、観察日時、同定コメントの運用を揃えると再利用しやすくなります。', $researchGradePct),
        ];
    }

    if ($taxonomicGroupCount < 4) {
        $recommendedActions[] = [
            'title' => '観察対象の偏りを減らす',
            'body' => sprintf('現在の分類群カバーは%d群です。植物だけ、鳥だけに偏っている場合は、昆虫・菌類・水辺生物など補完対象を決めると全体像が読みやすくなります。', $taxonomicGroupCount),
        ];
    }

    if ($stats['completeness_pct'] < 70) {
        $recommendedActions[] = [
            'title' => '追加調査の優先度を決める',
            'body' => sprintf('観測充足率は%d%%です。Chao1は未観測種の残りがあり得ることを示す参考値なので、季節別・生息環境別に不足箇所を埋めると改善します。', $stats['completeness_pct']),
        ];
    }

    if ($stats['redlist_count'] > 0) {
        $recommendedActions[] = [
            'title' => '重要種の扱いを実務に接続する',
            'body' => '工事、草刈り、照明、動線変更などの現場計画と重要種の確認記録を照合し、必要に応じて専門家レビューや保護措置の検討につなげます。',
        ];
    }

    $recommendedActions = array_slice($recommendedActions, 0, 3);
}
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <?php include __DIR__ . '/components/map_config.php'; ?>
    <style>
        /* Premium Dashboard Styles - Premium Light Theme (Cyber-Natural Aligned) */
        .glass-card {
            background: var(--md-surface-container);
            border: 1px solid var(--md-outline-variant);
            border-radius: var(--shape-xl);
            box-shadow: var(--elev-1);
            transition: transform var(--motion-short, 200ms), box-shadow var(--motion-short, 200ms), border-color var(--motion-short, 200ms);
        }

        .glass-card:hover {
            border-color: var(--md-primary);
            box-shadow: var(--elev-2);
        }

        .glass-card-accent {
            background: var(--md-primary-container);
            border: 1px solid var(--md-outline-variant);
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
            stroke: var(--md-outline-variant);
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
            background: var(--md-surface-container-high);
            color: var(--md-on-surface);
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
            background: var(--md-surface-container-low);
            border: 1px solid var(--md-outline-variant);
            color: var(--md-on-surface);
        }

        /* PWA safe-area-inset */
        body {
            padding-top: env(safe-area-inset-top);
        }

        /* Print styles */
        @media print {
            .glass-card {
                background: white !important;
                color: var(--md-on-surface) !important;
                border: 1px solid #e5e7eb !important;
            }

            nav,
            .no-print {
                display: none !important;
            }
        }
    </style>
</head>

<body class="js-loading font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
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
                    <h1 class="text-3xl md:text-4xl font-bold mb-3">サイトの記録ボード</h1>
                    <p class="text-[#1a2e1f]/60">その場所の自然の記録と参加の積み上がりを見返すための画面です</p>
                </div>

                <div class="glass-card p-5 md:p-6 mb-6">
                    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <div class="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 mb-2">Enterprise Demo</div>
                            <h2 class="text-xl font-black text-[#0f3d2e]">企業デモはショーケース、契約後の運用はこの画面から</h2>
                            <p class="text-sm text-slate-600 mt-2 leading-7">
                                愛管株式会社「連理の木の下で」を題材にした企業向けデモはショーケースページから確認できます。
                                この画面は、契約後に実サイトを運用するための本番一覧です。
                            </p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <a href="for-business/" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-100 transition">
                                <i data-lucide="sparkles" class="w-4 h-4"></i> サービス概要
                            </a>
                            <?php if (Auth::isLoggedIn()): ?>
                                <a href="corporate_dashboard.php" class="inline-flex items-center gap-2 px-4 py-2 font-bold transition" style="border-radius:var(--shape-full);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
                                    <i data-lucide="building-2"></i> ワークスペース
                                </a>
                            <?php endif; ?>
                            <a href="site_editor.php" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0f3d2e] text-white font-bold hover:bg-[#135843] transition">
                                <i data-lucide="map" class="w-4 h-4"></i> サイト登録へ
                            </a>
                        </div>
                    </div>
                </div>

                <?php if (empty($allSites)): ?>
                    <div class="glass-card p-10 text-center bg-[#1a2e1f]/[0.02] border-dashed border-2 border-primary/20">
                        <div class="w-20 h-20 bg-primary-surface/50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                            <i data-lucide="map-pin" class="w-10 h-10 text-primary"></i>
                        </div>
                        <h2 class="text-2xl font-bold mb-3 text-[#1a2e1f]">最初のサイトを登録しましょう</h2>
                        <p class="text-[#1a2e1f]/60 text-sm mb-6 leading-relaxed max-w-md mx-auto">
                            あなたのフィールドを登録して、自然の記録を残し始めましょう。<br>
                            蓄積されたデータはここで見返しやすく整理されます。
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
                            <h1 class="text-2xl md:text-3xl font-black text-[#1a2e1f] leading-tight" style="text-wrap: balance;"><?php echo htmlspecialchars($site['name']); ?></h1>
                            <span class="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-100">
                                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                記録継続中
                            </span>
                        </div>
                        <p class="text-sm text-[#1a2e1f]/50 ml-8"><?php echo htmlspecialchars($site['address']); ?></p>
                    </div>
                    <div class="flex items-center gap-2 ml-8 md:ml-0 overflow-x-auto pb-2" style="white-space: nowrap; -webkit-overflow-scrolling: touch;">
                        <?php if (Auth::isLoggedIn()): ?>
                            <a href="corporate_dashboard.php?corp=<?php echo urlencode($corpId); ?>"
                                class="text-xs px-4 py-2 font-bold transition flex items-center gap-1.5 no-print" style="border-radius:var(--shape-sm);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
                                <i data-lucide="building-2" class="w-3.5 h-3.5"></i> ワークスペース
                            </a>
                            <a href="corporate_members.php?corp=<?php echo urlencode($corpId); ?>&site=<?php echo urlencode($siteId); ?>"
                                class="text-xs px-4 py-2 font-bold transition flex items-center gap-1.5 no-print" style="border-radius:var(--shape-sm);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
                                <i data-lucide="users" class="w-3.5 h-3.5"></i> メンバー管理
                            </a>
                            <a href="site_editor.php?site=<?php echo urlencode($siteId); ?>"
                                class="text-xs px-4 py-2 font-bold transition flex items-center gap-1.5 no-print" style="border-radius:var(--shape-sm);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
                                <i data-lucide="pencil" class="w-3.5 h-3.5"></i> エリア編集
                            </a>
                            <a href="corporate_settings.php?corp=<?php echo urlencode($corpId); ?>"
                                class="text-xs px-4 py-2 font-bold transition flex items-center gap-1.5 no-print" style="border-radius:var(--shape-sm);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
                                <i data-lucide="settings-2" class="w-3.5 h-3.5"></i> 設定
                            </a>
                        <?php endif; ?>
                        <?php if ($canUseAdvancedOutputs): ?>
                            <a href="api/export_site_csv.php?site_id=<?php echo urlencode($siteId); ?>" target="_blank"
                                class="text-xs px-4 py-2 font-bold transition flex items-center gap-1.5 no-print" style="border-radius:var(--shape-sm);background:var(--md-primary-container);border:1px solid var(--md-outline-variant);color:var(--md-on-primary-container);">
                                <i data-lucide="table" class="w-3.5 h-3.5"></i> 生データCSV
                            </a>
                            <button type="button" @click="openPrModal('<?php echo htmlspecialchars($siteId); ?>')"
                                class="text-xs px-4 py-2 font-bold transition flex items-center gap-1.5 no-print" style="border-radius:var(--shape-sm);background:var(--md-primary-container);border:1px solid var(--md-outline-variant);color:var(--md-on-primary-container);">
                                <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> PR原案作成
                            </button>
                            <a href="api/download_proof_package.php?site_id=<?php echo urlencode($siteId); ?>" target="_blank"
                                class="text-xs px-4 py-2 font-bold transition flex items-center gap-1.5 no-print" style="border-radius:var(--shape-sm);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);" title="観測証跡のJSONパッケージ">
                                <i data-lucide="file-json" class="w-3.5 h-3.5"></i> 観測証跡JSON
                            </a>

                            <div class="hidden md:flex items-center gap-1 border-l border-gray-200 pl-3 ml-1">
                                <a href="api/generate_30by30_report.php?site_id=<?php echo urlencode($siteId); ?>" target="_blank"
                                    class="text-xs px-3 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold border border-teal-200 shadow-sm transition flex items-center gap-1 no-print">
                                    <i data-lucide="external-link" class="w-3.5 h-3.5"></i> 30x30参考
                                </a>
                                <a href="api/generate_tnfd_report.php?site_id=<?php echo urlencode($siteId); ?>" target="_blank"
                                    class="text-xs px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 shadow-sm transition flex items-center gap-1 no-print">
                                    <i data-lucide="external-link" class="w-3.5 h-3.5"></i> TNFD参考
                                </a>
                            </div>

                            <a href="api/generate_report.php?site_id=<?php echo urlencode($siteId); ?>&from=2000-01-01" target="_blank"
                                class="text-xs px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold transition shadow-lg shadow-teal-200 flex items-center gap-1.5 no-print" title="観測サマリーレポート (HTML/印刷可)">
                                <i data-lucide="file-text" class="w-3.5 h-3.5"></i> 観測サマリー
                            </a>
                            <a href="api/generate_site_report.php?site_id=<?php echo urlencode($siteId); ?>&from=2000-01-01" target="_blank"
                                class="text-xs px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-lg shadow-emerald-200 flex items-center gap-1.5 no-print">
                                <i data-lucide="download" class="w-3.5 h-3.5"></i> 観測証跡レポート
                            </a>
                        <?php else: ?>
                            <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 no-print">
                                <div><?= htmlspecialchars($planLabel) ?> では、完全な種一覧・CSV・証跡レポートは表示しません。啓発や運営用の概要確認まで無料、調査や報告の出力は Public で有効になります。</div>
                                <a href="for-business/apply.php?plan=public&amp;source=site_dashboard&amp;site=<?= urlencode($siteId); ?>" class="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-xs font-black text-white hover:bg-amber-700 transition">
                                    <i data-lucide="unlock" class="w-4 h-4"></i> Public へ上げる
                                </a>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>

                <?php if ($isCommunityWorkspace): ?>
                    <div class="mb-6 rounded-3xl border border-sky-200 bg-sky-50 px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <div class="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Community Workspace</div>
                            <div class="text-lg font-black text-sky-950">無料団体モードでは、概要だけを見せて運営できます</div>
                            <p class="text-sm text-slate-600 mt-1">観察数、参加人数、分類群、季節カバーは無料のまま。完全な種一覧や証跡出力は Public だけに絞っています。</p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <a href="for-business/apply.php?plan=public&amp;source=site_dashboard_banner&amp;site=<?= urlencode($siteId); ?>" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-700 text-white font-bold hover:bg-sky-800 transition no-print">
                                <i data-lucide="unlock" class="w-4 h-4"></i> Public を相談
                            </a>
                        </div>
                    </div>
                <?php endif; ?>

                <?php if ($isDemoMode): ?>
                    <div class="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <div class="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Enterprise Demo Detail</div>
                            <div class="text-lg font-black text-[#0f3d2e]">この画面は「愛管株式会社 / 連理の木の下で」の企業デモ詳細です</div>
                            <p class="text-sm text-slate-600 mt-1">観測の偏り、更新状況、重要種の照合結果などを確認できます。社外向けの見せ方は公開ショーケースで確認します。</p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <a href="for-business/" class="inline-flex items-center gap-2 px-4 py-2 font-bold transition" style="border-radius:var(--shape-full);background:var(--md-primary-container);border:1px solid var(--md-outline-variant);color:var(--md-on-primary-container);">
                                <i data-lucide="arrow-left" class="w-4 h-4"></i> サービス概要へ戻る
                            </a>
                            <a href="site_dashboard.php?site=<?php echo urlencode($siteId); ?>" class="inline-flex items-center gap-2 px-4 py-2 font-bold transition" style="border-radius:var(--shape-full);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
                                <i data-lucide="layout-dashboard" class="w-4 h-4"></i> このサイトの本番画面へ
                            </a>
                            <a href="csr_showcase.php?site_id=<?php echo urlencode($siteId); ?>" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition">
                                <i data-lucide="external-link" class="w-4 h-4"></i> 公開向けの見せ方を見る
                            </a>
                        </div>
                    </div>
                <?php endif; ?>

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

                <!-- ③ Plain-language summary -->
                <?php if (!empty($monitoringSummary) || !empty($recommendedActions)): ?>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mb-6">
                        <div class="glass-card p-5 md:p-6">
                            <h2 class="text-sm font-bold text-[#1a2e1f]/70 mb-4 flex items-center gap-2">
                                <i data-lucide="scan-search" class="w-4 h-4 text-emerald-600"></i>
                                まずここを見ればOK
                            </h2>
                            <div class="space-y-3">
                                <?php foreach ($monitoringSummary as $item): ?>
                                    <div class="p-4" style="border-radius:var(--shape-md);background:var(--md-surface-container-low);">
                                        <p class="text-xs font-bold text-[#1a2e1f]/55 mb-1"><?php echo htmlspecialchars($item['title']); ?></p>
                                        <p class="text-sm text-[#1a2e1f]/75 leading-relaxed"><?php echo htmlspecialchars($item['body']); ?></p>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                        <div class="glass-card p-5 md:p-6">
                            <h2 class="text-sm font-bold text-[#1a2e1f]/70 mb-4 flex items-center gap-2">
                                <i data-lucide="list-checks" class="w-4 h-4 text-emerald-600"></i>
                                次にやるとよいこと
                            </h2>
                            <?php if (!empty($recommendedActions)): ?>
                                <div class="space-y-3">
                                    <?php foreach ($recommendedActions as $index => $action): ?>
                                        <div class="p-4" style="border-radius:var(--shape-md);background:var(--md-surface-container-low);">
                                            <div class="flex items-start gap-3">
                                                <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-black flex items-center justify-center shrink-0" style="font-size: var(--text-xs);"><?php echo $index + 1; ?></span>
                                                <div>
                                                    <p class="text-sm font-bold text-[#1a2e1f]"><?php echo htmlspecialchars($action['title']); ?></p>
                                                    <p class="text-sm text-[#1a2e1f]/70 mt-1 leading-relaxed"><?php echo htmlspecialchars($action['body']); ?></p>
                                                </div>
                                            </div>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            <?php else: ?>
                                <p class="text-sm text-[#1a2e1f]/70 leading-relaxed">大きな欠損は見えていません。月別の継続観測と、写真・位置・日時の記録品質を維持するのが基本方針です。</p>
                            <?php endif; ?>
                        </div>
                    </div>
                <?php endif; ?>

                <!-- ④ Record summary memo -->
                <div class="glass-card bg-emerald-50/30 border-emerald-100 p-6 md:p-8 mb-6 shadow-sm">
                    <div class="flex flex-col md:flex-row md:items-center gap-6">
                        <div class="flex-1">
                            <h2 class="text-sm font-bold text-[#1a2e1f]/60 mb-1 flex items-center gap-2">
                                記録のまとまりメモ (β)
                                <span class="info-tip text-[#1a2e1f]/50" data-tip="記録の広がり、継続性、注意して見たい種の有無をまとめた内部向けメモです">
                                    <i data-lucide="info" class="w-3.5 h-3.5"></i>
                                </span>
                            </h2>
                            <?php
                            $bisScore = (int)($stats['credit_score'] ?? 0);
                            $bisGrade = match(true) {
                                $bisScore >= 90 => ['label' => 'S', 'color' => 'bg-emerald-500 text-white', 'desc' => '記録のまとまりが非常に高い水準。継続的な観察が定着しています。'],
                                $bisScore >= 75 => ['label' => 'A', 'color' => 'bg-emerald-100 text-emerald-800', 'desc' => '記録の幅・品質ともに安定。重要種や季節変動の把握が進んでいます。'],
                                $bisScore >= 60 => ['label' => 'B', 'color' => 'bg-sky-100 text-sky-800',     'desc' => '基礎的な記録が蓄積中。観察頻度を上げると次のステップに進めます。'],
                                $bisScore >= 45 => ['label' => 'C', 'color' => 'bg-amber-100 text-amber-800', 'desc' => '記録はあるものの偏りがあります。対象分類群や季節の幅を広げましょう。'],
                                default         => ['label' => 'D', 'color' => 'bg-red-100 text-red-800',    'desc' => '記録がまだ少ない状態です。定期的な観察からはじめましょう。'],
                            };
                            ?>
                            <div class="flex items-baseline gap-3 mb-3">
                                <span class="text-5xl md:text-6xl font-black stat-value count-up" data-target="<?php echo $bisScore; ?>">0</span>
                                <div class="flex flex-col gap-1">
                                    <span class="text-lg font-black px-2.5 py-0.5 rounded-lg <?php echo $bisGrade['color']; ?>">
                                        <?php echo $bisGrade['label']; ?>
                                    </span>
                                    <span class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1a2e1f]/40">Grade</span>
                                </div>
                            </div>
                            <p class="text-sm text-[#1a2e1f]/80 leading-relaxed font-medium mb-2">
                                <?php echo $bisGrade['desc']; ?>
                            </p>
                            <p class="text-xs text-[#1a2e1f]/50 leading-relaxed">
                                記録の広がり・重要種シグナル・記録の揃い方・継続性を組み合わせた内部向けの目安 (0–100)。
                                自然価値そのものや認証可否を示す数値ではなく、どこを見直すと記録が育つかを考えるために使います。
                            </p>

                            <!-- Detailed Breakdown -->
                            <?php if (!empty($scoreBreakdown)): ?>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                    <?php
                                    $axisColors = [
                                        'richness'           => ['bar' => 'bg-emerald-500', 'text' => 'text-emerald-400'],
                                        'data_confidence'    => ['bar' => 'bg-sky-500',     'text' => 'text-sky-400'],
                                        'conservation_value' => ['bar' => 'bg-red-500',     'text' => 'text-red-400'],
                                        'taxonomic_coverage' => ['bar' => 'bg-amber-500',   'text' => 'text-amber-400'],
                                        'monitoring_effort'  => ['bar' => 'bg-purple-500',  'text' => 'text-purple-400'],
                                    ];
                                    foreach ($scoreBreakdown as $key => $axis):
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
                                    記録の広がり・重要種シグナル・観察努力を組み合わせた0〜100の内部メモです。<br>
                                    ※外部評価や認証の代わりではなく、見返し用の表示です。
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
                                    目安
                                </text>
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- ④.5 Data Quality Grade Distribution -->
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
                            $dqaLabels = ['A' => '研究利用候補', 'B' => '要検証', 'C' => '要補足', 'D' => '不完全'];
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

                <!-- ⑥ Regional share -->
                <?php if (!empty($stats['regional_total_redlist']) && $stats['regional_total_redlist'] > 0): ?>
                    <div class="glass-card p-5 md:p-6 mb-6 border-l-4 border-emerald-500">
                        <div class="flex flex-col md:flex-row gap-6 items-center">
                            <div class="flex-1">
                                <h3 class="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2">
                                    <i data-lucide="globe" class="w-4 h-4"></i> 観測上の地域シェア
                                </h3>
                                <p class="text-xs text-[#1a2e1f]/70 leading-relaxed">
                                    このサイトで確認された保全重要種は、プラットフォーム全体で確認されている保全重要種（<span class="font-bold"><?php echo $stats['regional_total_redlist']; ?>種</span>）のうち、<strong class="text-emerald-700 text-sm"><?php echo $stats['redlist_count']; ?>種</strong>に相当します。存在記録ベースの比較なので、地域全体への保全寄与を直接定量化するものではなく、観測上のシグナルとしてご覧ください。
                                </p>
                            </div>
                            <div class="w-full md:w-64 flex-shrink-0 p-4" style="background:var(--md-surface-container-low);border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);">
                                <div class="mb-2 flex justify-between items-end">
                                    <span class="text-xs font-bold text-emerald-800/60">観測シェア</span>
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

                <!-- ⑦ Trend Chart + ⑧ Map -->
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

                <!-- ⑨ Taxonomic Groups + ⑩ Top Species -->
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

                    <?php if ($canRevealSpeciesDetails && !empty($stats['top_species'])): ?>
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
                    <?php elseif (!$canRevealSpeciesDetails): ?>
                        <div class="glass-card p-5 border border-dashed border-slate-200 bg-slate-50/70">
                            <h2 class="text-xs font-bold tracking-[0.15em] text-gray-400 uppercase mb-3 flex items-center gap-2">
                                <i data-lucide="eye-off" class="w-4 h-4"></i> 種一覧は Public で表示
                            </h2>
                            <p class="text-sm leading-7 text-slate-600">
                                無料団体では、分類群や種数の概要だけを公開します。種名一覧、重要種の内訳、証跡ベースの出力は Public プランにまとめています。
                            </p>
                        </div>
                    <?php endif; ?>
                </div>

                <!-- ⑪ Phenology Matrix -->
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

                <!-- ⑫ Red List Species -->
                <?php if ($canRevealSpeciesDetails && !empty($redListSpecies)): ?>
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

                <!-- ⑬ Context and references -->
                <div class="tnfd-card rounded-2xl p-6 md:p-8 mb-6">
                    <h2 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <i data-lucide="book-open" class="w-4 h-4 text-emerald-600"></i>
                        この画面の位置づけ
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600 leading-relaxed">
                        <div>
                            <h3 class="text-slate-800 font-bold mb-2">何のための画面か</h3>
                            <p class="mb-3">企業や拠点の担当者が、その場所で何が記録され、どの季節に動きがあり、どこに記録の薄い部分があるかを見返しやすくするための画面です。外部資料づくりの前段にも使えますが、判定や認証を自動で行うものではありません。</p>

                            <h3 class="text-slate-800 font-bold mb-2">⚠️ 読み方の前提</h3>
                            <ul class="space-y-1 text-slate-500">
                                <li>• これは存在記録ベースの観測ダッシュボードです</li>
                                <li>• 不在、個体数、因果効果を単独で証明するものではありません</li>
                                <li>• 重要な意思決定では、専門家レビューや現地調査と併用してください</li>
                            </ul>
                        </div>
                        <div>
                            <h3 class="text-slate-800 font-bold mb-2">外部資料とのつなぎ方</h3>
                            <p class="mb-3">TNFDやCBD GBFのような外部資料に使う前段として、自然との接点や記録の証跡を見返しやすく整理しています。ここで完結するのではなく、必要に応じて現地確認や専門家レビューにつなぎます。</p>
                            <div class="space-y-2">
                                <div class="flex items-center gap-2">
                                    <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    <span class="text-slate-700">種多様性、保全重要種、季節カバーの把握</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <div class="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                    <span class="text-slate-700">レッドリスト該当種の確認記録と観測証跡</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <div class="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                    <span class="text-slate-700">参加者数、品質グレード、継続観測の可視化</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <div class="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                    <span class="text-slate-700">30x30は面積・保全施策の目標であり、この画面のスコアとは別概念</span>
                                </div>
                            </div>
                            <div class="mt-4 px-4 py-3" style="background:var(--md-surface-container-low);border-radius:var(--shape-md);">
                                <p class="text-slate-800 font-bold mb-2">参考フレームワーク</p>
                                <ul class="space-y-1.5">
                                    <?php foreach ($referenceLinks as $ref): ?>
                                        <li>
                                            <a href="<?php echo htmlspecialchars($ref['url']); ?>" target="_blank" rel="noopener noreferrer" class="text-emerald-700 hover:text-emerald-800 underline underline-offset-2">
                                                <?php echo htmlspecialchars($ref['label']); ?>
                                            </a>
                                        </li>
                                    <?php endforeach; ?>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ⑭ Scientific Integrity Disclaimer (Anti-Greenwashing) -->
                <div class="mt-8 p-5 md:p-6 bg-gray-50/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl no-print">
                    <div class="flex items-start gap-4">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background:var(--md-surface-container-low);box-shadow:var(--elev-1);">
                            <i data-lucide="shield-alert" class="w-5 h-5 text-gray-400"></i>
                        </div>
                        <div>
                            <h4 class="text-sm font-bold text-gray-700 mb-2">【重要】この画面の位置づけ</h4>
                            <p class="text-xs text-gray-500 leading-relaxed mb-2">
                                本ダッシュボードに表示される指標およびデータは、ikimon.lifeの市民科学（Citizen Science）ならびに専門家による継続的な「確認データ（Presence-only data）」に基づいています。<strong>特定の種の絶対的な生息密度や増減を完全に保証するものではありません。</strong>
                            </p>
                            <p class="text-xs text-gray-500 leading-relaxed">
                                当プラットフォームは、企業や地域コミュニティによる<span class="text-emerald-600 font-bold">「継続的な自然観察の努力」</span>と、それに伴う<span class="text-emerald-600 font-bold">「写真・GPS・日時を伴う観測証跡」</span>を整理して見返しやすくするものです。TNFDや社内サステナビリティ報告に使う場合も、まずは補助資料として扱い、重要な判断には専門家レビューや現地確認を加えることを推奨します。
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
                        <div class="w-full max-w-3xl overflow-hidden" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-4);" @click.stop>
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
                            style: IKIMON_MAP.style('light'),
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

                            <?php if ($canRevealSpeciesDetails): ?>
                            this.loadSiteSummary();
                            <?php endif; ?>
                        });
                    },

                    async loadSiteSummary() {
                        try {
                            const res = await fetch('api/get_site_summary.php?site_id=<?php echo rawurlencode($siteId); ?>');
                            const result = await res.json();
                            if (!result.success) return;

                            const points = result.data?.map_points || [];
                            if (!points.length) return;

                            const features = points.map(o => ({
                                type: 'Feature',
                                properties: {
                                    id: o.id,
                                    name: o.name || '未同定'
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
                            console.error('Failed to load site summary:', e);
                        }
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
    <?php include __DIR__ . '/components/footer.php'; ?>
</body>

</html>
