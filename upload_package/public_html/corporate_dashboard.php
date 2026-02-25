<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/SiteManager.php';
require_once __DIR__ . '/../libs/CorporateManager.php';

Auth::init();

// Mock corporate context for demo
$corpId = 'aikan_corp';
$corp = CorporateManager::get($corpId);

if (!$corp) {
    die("Corporate data not found.");
}

$sites = SiteManager::getByOwnerOrg($corpId);
$totalSites = count($sites);
$totalObs = 0;
$totalMembers = 0;
$totalSpecies = 0;
$sumScore = 0;

foreach ($sites as $site) {
    $siteStats = SiteManager::getSiteStats($site['id']);
    $totalObs += $siteStats['total_observations'];
    $totalMembers += $siteStats['total_observers'];
    $totalSpecies += $siteStats['total_species'];
    $sumScore += $siteStats['credit_score'] ?? 0;
}

$avgScore = $totalSites > 0 ? round($sumScore / $totalSites, 1) : 0;
$pageTitle = 'Corporate Dashboard | I-kan';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <title><?= $pageTitle ?></title>
    <style>
        /* Premium Dashboard Styles — tokens.css のグローバルトークンを使用 */

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

        .stat-value {
            font-variant-numeric: tabular-nums;
            color: #10b981;
            /* フォールバック: グラデーション非対応ブラウザ用 */
            background: linear-gradient(135deg, #10b981, #0ea5e9);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        body {
            padding-top: env(safe-area-inset-top);
            background-color: #f8faf9;
            color: #1a2e1f;
            font-size: var(--text-base);
            line-height: 1.618;
            letter-spacing: var(--tracking);
            overflow-x: hidden;
        }

        /* Golden Ratio Layout Utilities */
        .section-gap {
            margin-bottom: var(--phi-xl);
        }

        /* 55px — セクション間 */
        .block-gap {
            margin-bottom: var(--phi-lg);
        }

        /* 34px — ブロック間 */
        .element-gap {
            margin-bottom: var(--phi-md);
        }

        /* 21px — 要素間 */
        .phi-pad {
            padding: var(--phi-lg);
        }

        /* 34px — 主要パディング */
        .phi-pad-sm {
            padding: var(--phi-md);
        }

        /* 21px */
        .phi-gap {
            gap: var(--phi-md);
        }

        /* 21px */
        .phi-gap-sm {
            gap: var(--phi-sm);
        }

        /* 13px */

        /* KPI Card Inner Rhythm */
        .kpi-card {
            padding: var(--phi-md) var(--phi-md);
            /* 21px */
        }

        @media (min-width: 768px) {
            .kpi-card {
                padding: var(--phi-md) var(--phi-lg);
                /* 21px 34px */
            }
        }

        /* Site Card Content Area */
        .site-card-body {
            padding: var(--phi-md);
            /* 21px */
        }

        @media (min-width: 768px) {
            .site-card-body {
                padding: var(--phi-md) var(--phi-lg);
                /* 21px 34px */
            }
        }

        /* Team Section Padding */
        .team-section {
            padding: var(--phi-md);
            /* 21px */
        }

        @media (min-width: 768px) {
            .team-section {
                padding: var(--phi-lg);
                /* 34px */
            }
        }

        /* Showcase Card Padding */
        .showcase-card {
            padding: var(--phi-md);
            /* 21px */
        }

        @media (min-width: 768px) {
            .showcase-card {
                padding: var(--phi-lg) var(--phi-xl);
                /* 34px 55px */
            }
        }

        /* Add New Site Card */
        .add-site-card {
            padding: var(--phi-md);
        }

        @media (min-width: 768px) {
            .add-site-card {
                padding: var(--phi-lg) var(--phi-xl);
            }
        }

        /* Mobile overflow prevention */
        * {
            box-sizing: border-box;
        }

        .dashboard-container {
            max-width: 100%;
            overflow-x: hidden;
        }

        @media (max-width: 767px) {
            .dashboard-container {
                padding-left: var(--phi-sm) !important;
                padding-right: var(--phi-sm) !important;
            }
        }
    </style>
</head>

<body class="bg-[#f8faf9] text-[#1a2e1f] font-body">
    <?php include('components/nav.php'); ?>

    <div class="dashboard-container mx-auto" style="padding: var(--phi-lg) var(--phi-md); padding-bottom: 96px; margin-top: 64px;">

        <!-- Header -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center section-gap" style="gap: var(--phi-md);">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full border border-emerald-200">ENTERPRISE</span>
                    <span style="font-size: var(--text-sm);" class="text-[#1a2e1f]/60">ID: <?= htmlspecialchars($corp['id']) ?></span>
                </div>
                <h1 class="text-2xl md:text-3xl font-black text-[#1a2e1f]"><?= htmlspecialchars($corp['name']) ?></h1>
                <p class="text-sm md:text-base text-[#1a2e1f]/50 mt-1">Nature Positive Dashboard</p>
            </div>
            <div class="flex gap-2 w-full md:w-auto">
                <button class="flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs md:text-sm font-bold shadow-sm hover:bg-gray-50 transition">
                    <i data-lucide="settings" class="w-4 h-4 mr-1 inline-block"></i> 設定
                </button>
                <button class="flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs md:text-sm font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition">
                    <i data-lucide="file-text" class="w-4 h-4 mr-1 inline-block"></i> レポート
                </button>
            </div>
        </div>

        <!-- KPI Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 section-gap" style="gap: var(--phi-sm);">
            <!-- Sites -->
            <div class="glass-card kpi-card">
                <div class="text-[#1a2e1f]/60 font-bold tracking-wider uppercase mb-2" style="font-size: var(--text-sm);">Active Sites</div>
                <div class="font-black text-[#1a2e1f]" style="font-size: clamp(var(--text-lg), 4vw, var(--text-xl));"><?= number_format($totalSites) ?></div>
                <div class="text-emerald-600 mt-1 flex items-center" style="font-size: var(--text-xs);">
                    <i data-lucide="map-pin" class="w-3 h-3 mr-1"></i> 登録拠点数
                </div>
            </div>
            <!-- Observations -->
            <div class="glass-card kpi-card">
                <div class="text-[#1a2e1f]/60 font-bold tracking-wider uppercase mb-2" style="font-size: var(--text-sm);">Total Impact</div>
                <div class="font-black text-[#1a2e1f]" style="font-size: clamp(var(--text-lg), 4vw, var(--text-xl));"><?= number_format($totalObs) ?></div>
                <div class="text-blue-500 mt-1 flex items-center" style="font-size: var(--text-xs);">
                    <i data-lucide="camera" class="w-3 h-3 mr-1"></i> データ収集数
                </div>
            </div>
            <!-- Score -->
            <div class="glass-card kpi-card">
                <div class="text-[#1a2e1f]/60 font-bold tracking-wider uppercase mb-2" style="font-size: var(--text-sm);">Avg. Score</div>
                <div class="font-black stat-value" style="font-size: clamp(var(--text-lg), 4vw, var(--text-xl));"><?= $avgScore ?></div>
                <div class="text-[#1a2e1f]/60 mt-1 flex items-center" style="font-size: var(--text-xs);">
                    <i data-lucide="trending-up" class="w-3 h-3 mr-1"></i> 平均スコア
                </div>
            </div>
            <!-- Members -->
            <div class="glass-card kpi-card">
                <div class="text-[#1a2e1f]/60 font-bold tracking-wider uppercase mb-2" style="font-size: var(--text-sm);">Participants</div>
                <div class="font-black text-[#1a2e1f]" style="font-size: clamp(var(--text-lg), 4vw, var(--text-xl));"><?= number_format($totalMembers) ?></div>
                <div class="text-orange-500 mt-1 flex items-center" style="font-size: var(--text-xs);">
                    <i data-lucide="users" class="w-3 h-3 mr-1"></i> 参加従業員数
                </div>
            </div>
        </div>

        <!-- Visual Innovation Showcase Link -->
        <div class="glass-card showcase-card section-gap border-emerald-200 bg-emerald-50/30 overflow-hidden relative group">
            <div class="absolute right-0 top-0 w-40 md:w-64 h-40 md:h-64 bg-emerald-500/5 rounded-full -mr-10 md:-mr-20 -mt-10 md:-mt-20 blur-3xl group-hover:bg-emerald-500/10 transition-colors"></div>
            <div class="relative flex flex-col md:flex-row items-start md:items-center justify-between" style="gap: var(--phi-md);">
                <div class="flex-1 min-w-0">
                    <div class="inline-flex items-center gap-2 text-emerald-600 font-black uppercase tracking-widest mb-2" style="font-size: var(--text-xs);">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> PREMIUM
                    </div>
                    <h2 class="text-xl md:text-2xl font-black text-[#1a2e1f] mb-2">3Dインパクトショーケース</h2>
                    <p class="text-xs md:text-sm text-[#1a2e1f]/60 leading-relaxed line-clamp-3 md:line-clamp-none">
                        MapLibre 3Dエンジンとネイチャーデータを融合させた、次世代の生物多様性可視化を体験。
                    </p>
                    <a href="showcase.php?site=ikan_hq" class="w-full md:w-auto text-center px-5 py-3 rounded-xl bg-[#1a2e1f] text-white font-bold text-sm hover:bg-[#1a2e1f]/90 transition shadow-xl shadow-emerald-900/10 flex items-center justify-center gap-2">
                        <i data-lucide="layout-template" class="w-4 h-4"></i>
                        デモを起動
                    </a>
                </div>
            </div>
        </div>

        <!-- Wellness KPI Section -->
        <div class="glass-card section-gap" style="padding: var(--phi-md);" x-data="siteWellness()" x-init="loadWellness()">
            <div class="flex items-center justify-between element-gap">
                <h2 class="text-lg font-black text-[#1a2e1f] flex items-center">
                    <span class="mr-2">🌿</span> Employee Wellness Impact
                </h2>
                <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full" x-show="loaded" x-cloak x-text="'全 ' + participantCount + ' 名'"></span>
            </div>

            <div x-show="!loaded" class="flex justify-center py-6">
                <div class="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>

            <div x-show="loaded" x-cloak>
                <div class="grid grid-cols-2 md:grid-cols-4" style="gap: var(--phi-sm);">
                    <div class="bg-emerald-50/50 rounded-xl text-center" style="padding: var(--phi-sm);">
                        <div class="text-2xl md:text-3xl font-black text-emerald-600" x-text="avgNatureMin + '分'"></div>
                        <div class="text-[#1a2e1f]/60 font-bold mt-1" style="font-size: var(--text-xs);">🌳 平均自然時間</div>
                        <div class="text-[#1a2e1f]/50 mt-1 leading-snug" style="font-size: 10px;">参加者1人あたり月間平均の屋外活動時間</div>
                    </div>
                    <div class="bg-blue-50/50 rounded-xl text-center" style="padding: var(--phi-sm);">
                        <div class="text-2xl md:text-3xl font-black text-blue-600" x-text="achievementRate + '%'"></div>
                        <div class="text-[#1a2e1f]/60 font-bold mt-1" style="font-size: var(--text-xs);">🎯 120分達成率</div>
                        <div class="text-[#1a2e1f]/50 mt-1 leading-snug" style="font-size: 10px;">WHO推奨の週120分自然接触を達成した割合</div>
                    </div>
                    <div class="bg-amber-50/50 rounded-xl text-center" style="padding: var(--phi-sm);">
                        <div class="text-2xl md:text-3xl font-black text-amber-600" x-text="avgCognitive"></div>
                        <div class="text-[#1a2e1f]/60 font-bold mt-1" style="font-size: var(--text-xs);">🧠 認知エンゲージメント</div>
                        <div class="text-[#1a2e1f]/50 mt-1 leading-snug" style="font-size: 10px;">観察密度・種多様性・新発見の複合参考指標</div>
                    </div>
                    <div class="bg-purple-50/50 rounded-xl text-center" style="padding: var(--phi-sm);">
                        <div class="text-2xl md:text-3xl font-black text-purple-600" x-text="totalSessions + '回'"></div>
                        <div class="text-[#1a2e1f]/60 font-bold mt-1" style="font-size: var(--text-xs);">🥾 フィールドセッション</div>
                        <div class="text-[#1a2e1f]/50 mt-1 leading-snug" style="font-size: 10px;">全サイト合計の野外観察セッション数</div>
                    </div>
                </div>

                <div class="mt-4 space-y-2">
                    <div class="p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-100">
                        <p class="text-xs text-[#1a2e1f]/60 leading-relaxed">
                            <strong class="text-emerald-700">📚 自然時間・達成率:</strong>
                            週120分以上の自然接触は健康・ウェルビーイングの有意な向上と関連。
                            <span class="text-[#1a2e1f]/60 italic">(White et al., 2019, Scientific Reports)</span>
                        </p>
                    </div>
                    <div class="p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
                        <p class="text-xs text-[#1a2e1f]/60 leading-relaxed">
                            <strong class="text-amber-700">📚 認知エンゲージメント:</strong>
                            歩行中の認知課題（デュアルタスク）は認知機能維持に有効。種の識別行為は前頭前野を活性化。
                            本指標は複数の学術知見に基づく<strong>参考指標</strong>であり、臨床的に検証されたスコアではありません。
                            <span class="text-[#1a2e1f]/60 italic">(Shimada et al., 2018; Soga & Gaston, 2020)</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Sites List -->
        <h2 class="text-xl font-black text-[#1a2e1f] flex items-center element-gap">
            <i data-lucide="map" class="w-6 h-6 mr-2 text-emerald-600"></i>
            管理拠点一覧
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 section-gap" style="gap: var(--phi-md);">
            <?php foreach ($sites as $site):
                $siteStats = SiteManager::getSiteStats($site['id']);
                $score = $siteStats['credit_score'] ?? 0;
                $rank = $siteStats['credit_rank'] ?? 'E';
            ?>
                <div class="glass-card overflow-hidden group relative">
                    <!-- Map Placeholder or Thumbnail -->
                    <div class="h-28 md:h-32 bg-emerald-50 relative overflow-hidden">
                        <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-500/20 opacity-50"></div>
                        <div class="absolute inset-0 flex items-center justify-center text-emerald-600/20">
                            <i data-lucide="map" class="w-12 h-12"></i>
                        </div>

                        <!-- Score Badge -->
                        <div class="absolute top-3 right-3 flex items-center gap-1.5">
                            <span class="bg-white/90 backdrop-blur text-[#1a2e1f] font-bold px-2.5 py-1 rounded-lg border border-gray-100 shadow-sm" style="font-size: var(--text-xs);">
                                Score: <span class="text-emerald-600 text-sm font-black"><?= $score ?></span>
                            </span>
                            <span class="bg-[#1a2e1f] text-white font-black px-2.5 py-1.5 rounded-lg shadow-sm" style="font-size: var(--text-xs);">
                                Rank <?= $rank ?>
                            </span>
                        </div>
                    </div>

                    <div class="site-card-body">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="font-bold text-[#1a2e1f] group-hover:text-emerald-600 transition-colors line-clamp-1">
                                <?= htmlspecialchars($site['name']) ?>
                            </h3>
                        </div>
                        <p class="text-xs text-[#1a2e1f]/50 line-clamp-2 mb-4 h-8 leading-relaxed">
                            <?= htmlspecialchars($site['description']) ?>
                        </p>

                        <!-- Mini Stats -->
                        <div class="grid grid-cols-3 border-t border-gray-100" style="gap: var(--phi-sm); padding: var(--phi-sm) 0;">
                            <div class="text-center">
                                <div class="text-[#1a2e1f]/60 uppercase font-bold tracking-wider" style="font-size: var(--text-xs);">Species</div>
                                <div class="font-bold text-[#1a2e1f]"><?= $siteStats['total_species'] ?></div>
                            </div>
                            <div class="text-center border-l border-gray-100">
                                <div class="text-[#1a2e1f]/60 uppercase font-bold tracking-wider" style="font-size: var(--text-xs);">Users</div>
                                <div class="font-bold text-[#1a2e1f]"><?= $siteStats['total_observers'] ?></div>
                            </div>
                            <div class="text-center border-l border-gray-100">
                                <div class="text-[#1a2e1f]/60 uppercase font-bold tracking-wider" style="font-size: var(--text-xs);">Observations</div>
                                <div class="font-bold text-[#1a2e1f]"><?= $siteStats['total_observations'] ?></div>
                            </div>
                        </div>

                        <div class="flex" style="gap: var(--phi-xs); margin-top: var(--phi-md);">
                            <a href="site_dashboard.php?site=<?= urlencode($site['id']) ?>" class="flex-1 bg-emerald-50 hover:bg-emerald-100 text-center py-2.5 rounded-xl text-xs font-bold text-emerald-700 transition-colors border border-emerald-100">
                                インサイトを見る
                            </a>
                            <a href="showcase.php?site=<?= urlencode($site['id']) ?>" class="px-3 bg-white hover:bg-gray-50 text-center py-2.5 rounded-xl text-xs font-bold text-gray-400 transition-colors border border-gray-100" title="Premium View">
                                <i data-lucide="eye" class="w-4 h-4"></i>
                            </a>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>

            <!-- Add New Site Card -->
            <a href="site_editor.php" class="glass-card add-site-card border-dashed border-2 border-gray-200 flex flex-col items-center justify-center hover:bg-emerald-50/30 transition-colors text-gray-400 hover:text-emerald-600 h-full min-h-[200px] md:min-h-[250px] group">
                <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                    <i data-lucide="plus" class="w-6 h-6"></i>
                </div>
                <span class="text-sm font-bold">管理拠点・サイトを追加</span>
            </a>
        </div>

        <!-- Team Members Preview -->
        <div class="glass-card team-section border-gray-100">
            <div class="flex items-center justify-between element-gap">
                <h2 class="text-lg font-black text-[#1a2e1f] flex items-center">
                    <i data-lucide="users" class="w-5 h-5 mr-2 text-orange-500"></i> 参加プロジェクトメンバー
                </h2>
                <a href="#" class="text-xs font-bold text-emerald-600 hover:underline">全員を表示</a>
            </div>
            <div class="flex -space-x-3 overflow-hidden">
                <?php
                // Mock members for preview
                $members = [
                    ['name' => 'Ichiro Suzuki', 'initials' => 'IS', 'color' => 'bg-blue-500'],
                    ['name' => 'Jane Doe', 'initials' => 'JD', 'color' => 'bg-emerald-500'],
                    ['name' => 'Kenji Yamaki', 'initials' => 'KY', 'color' => 'bg-orange-500'],
                    ['name' => 'Ai Kan', 'initials' => 'AK', 'color' => 'bg-purple-500'],
                ];
                foreach ($members as $member):
                ?>
                    <div class="inline-flex items-center justify-center w-10 h-10 rounded-full <?= $member['color'] ?> text-white text-xs font-bold border-2 border-white ring-2 ring-transparent hover:ring-emerald-200 transition" title="<?= $member['name'] ?>">
                        <?= $member['initials'] ?>
                    </div>
                <?php endforeach; ?>
                <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-400 text-xs font-bold border-2 border-white">
                    +<?= max(0, $totalMembers - 4) ?>
                </div>
            </div>
        </div>

        <script nonce="<?= CspNonce::attr() ?>">
            // Wellness KPI Alpine component
            function siteWellness() {
                return {
                    loaded: false,
                    participantCount: 0,
                    avgNatureMin: 0,
                    achievementRate: 0,
                    avgCognitive: 0,
                    totalSessions: 0,
                    async loadWellness() {
                        const siteIds = <?= json_encode(array_column($sites, 'id')) ?>;
                        if (!siteIds.length) {
                            this.loaded = true;
                            return;
                        }

                        let totalParticipants = 0,
                            totalNatureMin = 0,
                            totalAchRate = 0;
                        let totalCog = 0,
                            totalSess = 0,
                            validSites = 0;

                        const fetches = siteIds.map(id =>
                            fetch(`api/get_site_wellness.php?site_id=${encodeURIComponent(id)}&period=month`)
                            .then(r => r.json()).catch(() => null)
                        );
                        const results = await Promise.all(fetches);

                        results.forEach(r => {
                            if (!r || !r.success) return;
                            const d = r.data;
                            totalParticipants += d.participant_count || 0;
                            totalNatureMin += d.aggregate.avg_nature_minutes || 0;
                            totalAchRate += d.aggregate.weekly_120min_achievement_rate || 0;
                            totalCog += d.aggregate.avg_cognitive_score || 0;
                            totalSess += d.aggregate.total_sessions || 0;
                            validSites++;
                        });

                        this.participantCount = totalParticipants;
                        this.avgNatureMin = validSites > 0 ? Math.round(totalNatureMin / validSites) : 0;
                        this.achievementRate = validSites > 0 ? Math.round(totalAchRate / validSites) : 0;
                        this.avgCognitive = validSites > 0 ? Math.round(totalCog / validSites) : 0;
                        this.totalSessions = totalSess;
                        this.loaded = true;
                    }
                };
            }

            // Init Lucide icons
            lucide.createIcons();
        </script>
    </div>
</body>

</html>