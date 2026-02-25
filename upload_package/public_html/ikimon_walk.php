<?php

/**
 * さんぽ記録 — Walking Activity Dashboard v2
 * 
 * Features:
 * 1. Period tabs (今週 / 今月 / すべて) with reactive stats
 * 2. Week-over-week comparison (↑↓%)
 * 3. Activity streak counter
 * 4. Personal best records
 * 5. CSS-only activity chart (daily/weekly bars, animated)
 * 6. Date-grouped session list
 * 7. Health highlights (calories, period-linked)
 * 8. Legacy field management (collapsed)
 */
require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/Lang.php';
require_once ROOT_DIR . '/libs/MyFieldManager.php';
require_once ROOT_DIR . '/libs/BadgeManager.php';

$user = Auth::user();
$pageTitle = 'さんぽ記録 — ikimon';

// ─────── Data Preparation ───────
$sessions = [];
$fields = [];
$totalDistance = 0;
$totalTimeMin = 0;
$totalObs = 0;

// Period stats
$weekDistance = 0;
$weekTimeMin = 0;
$weekObs = 0;
$weekSessions = 0;
$monthDistance = 0;
$monthTimeMin = 0;
$monthObs = 0;
$monthSessions = 0;
$prevWeekDistance = 0;
$prevWeekTimeMin = 0;
$prevWeekObs = 0;

// Dates
$today = date('Y-m-d');
$weekStart = date('Y-m-d', strtotime('monday this week'));
$prevWeekStart = date('Y-m-d', strtotime('monday last week'));
$monthStart = date('Y-m-01');

// Chart data: past 7 days
$chartDays = [];
$dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
for ($i = 6; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-{$i} days"));
    $dow = (int) date('w', strtotime($d));
    $chartDays[$d] = [
        'label' => $dayLabels[$dow],
        'date' => date('n/j', strtotime($d)),
        'distance' => 0,
        'obs' => 0,
        'count' => 0,
        'isToday' => ($d === $today),
    ];
}

// Monthly chart: past 4 weeks
$chartWeeks = [];
for ($w = 3; $w >= 0; $w--) {
    $ws = date('Y-m-d', strtotime("-{$w} weeks monday"));
    $we = date('Y-m-d', strtotime($ws . ' +6 days'));
    $chartWeeks[] = [
        'label' => date('n/j', strtotime($ws)),
        'start' => $ws,
        'end' => $we,
        'distance' => 0,
        'obs' => 0,
        'count' => 0,
        'isCurrent' => ($ws === $weekStart),
    ];
}

// Date-grouped sessions + tracking
$sessionsByDate = [];
$activeDates = []; // for streak
$bestDistance = 0;
$bestObs = 0;
$bestDistDate = '';
$bestObsDate = '';

if ($user) {
    $sessions = MyFieldManager::getUserTracks($user['id']);

    foreach ($sessions as $s) {
        $dist = $s['total_distance'] ?? 0;
        $dur = ($s['duration_sec'] ?? 0) / 60;
        $obs = $s['observation_count'] ?? 0;
        $startedAt = $s['started_at'] ?? null;
        $dateKey = $startedAt ? date('Y-m-d', strtotime($startedAt)) : null;

        // Global
        $totalDistance += $dist;
        $totalTimeMin += $dur;
        $totalObs += $obs;

        if ($dateKey) {
            // Week
            if ($dateKey >= $weekStart) {
                $weekDistance += $dist;
                $weekTimeMin += $dur;
                $weekObs += $obs;
                $weekSessions++;
            }
            // Previous week (for comparison)
            if ($dateKey >= $prevWeekStart && $dateKey < $weekStart) {
                $prevWeekDistance += $dist;
                $prevWeekTimeMin += $dur;
                $prevWeekObs += $obs;
            }
            // Month
            if ($dateKey >= $monthStart) {
                $monthDistance += $dist;
                $monthTimeMin += $dur;
                $monthObs += $obs;
                $monthSessions++;
            }

            // Chart: daily
            if (isset($chartDays[$dateKey])) {
                $chartDays[$dateKey]['distance'] += $dist;
                $chartDays[$dateKey]['obs'] += $obs;
                $chartDays[$dateKey]['count']++;
            }

            // Chart: weekly
            foreach ($chartWeeks as &$cw) {
                if ($dateKey >= $cw['start'] && $dateKey <= $cw['end']) {
                    $cw['distance'] += $dist;
                    $cw['obs'] += $obs;
                    $cw['count']++;
                }
            }
            unset($cw);

            // Group by date
            $sessionsByDate[$dateKey][] = $s;
            $activeDates[$dateKey] = true;

            // Personal bests (per session)
            if ($dist > $bestDistance) {
                $bestDistance = $dist;
                $bestDistDate = $dateKey;
            }
            if ($obs > $bestObs) {
                $bestObs = $obs;
                $bestObsDate = $dateKey;
            }
        }
    }

    $fields = MyFieldManager::listByUser($user['id']);
}

// Streak calculation (consecutive days ending at today or yesterday)
$streak = 0;
$checkDate = $today;
// If no activity today, start from yesterday
if (!isset($activeDates[$today])) {
    $checkDate = date('Y-m-d', strtotime('-1 day'));
}
while (isset($activeDates[$checkDate])) {
    $streak++;
    $checkDate = date('Y-m-d', strtotime($checkDate . ' -1 day'));
}

// Chart max for scaling
$chartDayMax = max(1, max(array_column($chartDays, 'distance')));
$chartWeekMax = max(1, max(array_column($chartWeeks, 'distance')));

// Week-over-week change
$wowDistChange = ($prevWeekDistance > 0) ? round(($weekDistance - $prevWeekDistance) / $prevWeekDistance * 100) : null;

// JSON for Alpine.js
$statsJson = json_encode([
    'week' => [
        'distance' => round($weekDistance / 1000, 1),
        'time' => round($weekTimeMin / 60, 1),
        'obs' => $weekObs,
        'sessions' => $weekSessions,
        'kcal' => round(($weekDistance / 1000) * 50),
    ],
    'month' => [
        'distance' => round($monthDistance / 1000, 1),
        'time' => round($monthTimeMin / 60, 1),
        'obs' => $monthObs,
        'sessions' => $monthSessions,
        'kcal' => round(($monthDistance / 1000) * 50),
    ],
    'all' => [
        'distance' => round($totalDistance / 1000, 1),
        'time' => round($totalTimeMin / 60, 1),
        'obs' => $totalObs,
        'sessions' => count($sessions),
        'kcal' => round(($totalDistance / 1000) * 50),
    ],
], JSON_UNESCAPED_UNICODE);

// Biome options
$biomeOptions = [
    'forest' => ['label' => '森林', 'icon' => '🌲'],
    'grassland' => ['label' => '草地', 'icon' => '🌾'],
    'wetland' => ['label' => '湿地', 'icon' => '🦆'],
    'coast' => ['label' => '海岸', 'icon' => '🏖️'],
    'river' => ['label' => '河川', 'icon' => '🏞️'],
    'urban' => ['label' => '都市', 'icon' => '🏙️'],
    'farmland' => ['label' => '農地', 'icon' => '🌻'],
    'mountain' => ['label' => '山岳', 'icon' => '⛰️'],
];

?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css">
    <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <style>
        /* ── Period Tabs ── */
        .period-tabs {
            display: flex;
            gap: 4px;
            background: var(--color-base, #f1f5f9);
            border-radius: 12px;
            padding: 4px;
        }

        .period-tab {
            flex: 1;
            padding: 8px 0;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 700;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
            color: var(--color-muted, #94a3b8);
            border: none;
            background: none;
        }

        .period-tab.active {
            background: white;
            color: var(--color-text, #1e293b);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        /* ── Chart ── */
        .chart-bars {
            display: flex;
            align-items: flex-end;
            gap: 6px;
            height: 120px;
            padding: 0 4px;
        }

        .chart-bar-wrap {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            height: 100%;
            justify-content: flex-end;
        }

        .chart-bar {
            width: 100%;
            max-width: 40px;
            border-radius: 6px 6px 2px 2px;
            background: linear-gradient(180deg, #10b981 0%, #34d399 100%);
            min-height: 4px;
            position: relative;
            animation: barGrow 0.6s ease-out both;
        }

        @keyframes barGrow {
            from {
                transform: scaleY(0);
                transform-origin: bottom;
            }

            to {
                transform: scaleY(1);
                transform-origin: bottom;
            }
        }

        .chart-bar.empty {
            background: #e2e8f0;
            animation: none;
        }

        .chart-bar.today {
            background: linear-gradient(180deg, #059669 0%, #10b981 100%);
            box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
        }

        .chart-bar.has-obs::after {
            content: '';
            position: absolute;
            top: -4px;
            left: 50%;
            transform: translateX(-50%);
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #f59e0b;
        }

        .chart-bar-label {
            font-size: 10px;
            font-weight: 700;
            color: var(--color-muted);
            margin-top: 6px;
        }

        .chart-bar-label.today {
            color: var(--color-primary);
        }

        .chart-bar-date {
            font-size: 9px;
            color: var(--color-muted);
            opacity: 0.7;
        }

        /* ── Stat Cards ── */
        .stat-card {
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
        }

        /* ── Streak / Best ── */
        .highlight-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 700;
        }

        /* ── Comparison Badge ── */
        .wow-badge {
            font-size: 10px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 6px;
            display: inline-flex;
            align-items: center;
            gap: 2px;
        }

        .wow-up {
            background: rgba(16, 185, 129, 0.15);
            color: #059669;
        }

        .wow-down {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
        }

        /* ── Day Group ── */
        .day-header {
            position: sticky;
            top: 56px;
            z-index: 5;
            background: var(--color-base, #f8fafc);
            padding: 8px 0;
        }

        /* ── Activity Card ── */
        .activity-card {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .activity-card:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-md);
        }

        .track-minimap {
            width: 100%;
            height: 140px;
            background: #f1f5f9;
            border-bottom: 1px solid var(--color-border);
        }

        /* ── FAB ── */
        .fab-start {
            position: fixed;
            bottom: calc(var(--bottom-nav-height) + 20px);
            right: 20px;
            background: var(--color-primary);
            color: white;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
            z-index: 50;
            transition: transform 0.2s;
        }

        .fab-start:active {
            transform: scale(0.95);
        }

        /* ── Legacy Map ── */
        #create-map {
            width: 100%;
            height: 240px;
            border-radius: var(--radius-md);
            border: 1px solid var(--color-border);
        }
    </style>
</head>

<body x-data="{ searchOpen: false, menuOpen: false }" class="bg-base text-text" style="padding-bottom: var(--bottom-nav-height);">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <!-- Mobile FAB -->
    <a href="field_research.php" class="fab-start md:hidden">
        <i data-lucide="play" class="w-8 h-8 fill-current"></i>
    </a>

    <main class="max-w-5xl mx-auto px-4 md:px-6 pt-24 pb-16"
        x-data="walkDashboard()"
        x-init="init()">

        <!-- ── Header ── -->
        <div class="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
            <div>
                <span class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary mb-2">
                    <i data-lucide="footprints" class="w-4 h-4"></i>
                    FIELD NOTE
                </span>
                <h1 class="text-3xl font-black tracking-tight text-text">さんぽ記録</h1>
                <p class="text-sm text-muted mt-1">歩くことは、見つけること。</p>
            </div>
            <?php if ($user): ?>
                <a href="field_research.php"
                    class="hidden md:inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-white shadow-lg shadow-emerald-500/30 transition hover:shadow-xl hover:-translate-y-0.5"
                    style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                    <i data-lucide="play-circle" class="w-5 h-5"></i> ウォークを開始
                </a>
            <?php endif; ?>
        </div>

        <?php if (!$user): ?>
            <div class="bg-surface border border-border rounded-2xl text-center p-12">
                <div class="text-5xl mb-4">🔐</div>
                <h2 class="text-xl font-bold mb-2">ログインが必要です</h2>
                <a href="login.php" class="text-primary font-bold underline">ログインして記録を開始</a>
            </div>
        <?php else: ?>

            <!-- ── Streak & Best ── -->
            <?php if ($streak > 0 || $bestDistance > 0): ?>
                <div class="flex flex-wrap gap-2 mb-6">
                    <?php if ($streak > 0): ?>
                        <span class="highlight-pill bg-amber-50 text-amber-700 border border-amber-200">
                            🔥 <?php echo $streak; ?>日連続
                        </span>
                    <?php endif; ?>
                    <?php if ($bestDistance > 0): ?>
                        <span class="highlight-pill bg-blue-50 text-blue-700 border border-blue-200">
                            🏆 最長 <?php echo number_format($bestDistance / 1000, 1); ?> km
                            <span class="text-[10px] opacity-60"><?php echo date('n/j', strtotime($bestDistDate)); ?></span>
                        </span>
                    <?php endif; ?>
                    <?php if ($bestObs > 1): ?>
                        <span class="highlight-pill bg-purple-50 text-purple-700 border border-purple-200">
                            👁️ 最多 <?php echo $bestObs; ?>観察
                            <span class="text-[10px] opacity-60"><?php echo date('n/j', strtotime($bestObsDate)); ?></span>
                        </span>
                    <?php endif; ?>
                </div>
            <?php endif; ?>

            <!-- ── Period Tabs ── -->
            <div class="period-tabs mb-6">
                <button class="period-tab" :class="{ active: period === 'week' }" @click="period = 'week'">今週</button>
                <button class="period-tab" :class="{ active: period === 'month' }" @click="period = 'month'">今月</button>
                <button class="period-tab" :class="{ active: period === 'all' }" @click="period = 'all'">すべて</button>
            </div>

            <!-- ── Summary Stats ── -->
            <div class="grid grid-cols-3 gap-3 mb-6">
                <div class="bg-surface border border-border rounded-2xl p-4 text-center stat-card">
                    <div class="text-2xl font-black text-primary" x-text="stats[period].distance"></div>
                    <div class="text-[10px] font-bold text-muted mt-1">距離 (km)</div>
                    <?php if ($wowDistChange !== null): ?>
                        <div class="mt-1" x-show="period === 'week'">
                            <span class="wow-badge <?php echo $wowDistChange >= 0 ? 'wow-up' : 'wow-down'; ?>">
                                <?php echo $wowDistChange >= 0 ? '↑' : '↓'; ?><?php echo abs($wowDistChange); ?>%
                            </span>
                        </div>
                    <?php endif; ?>
                </div>
                <div class="bg-surface border border-border rounded-2xl p-4 text-center stat-card">
                    <div class="text-2xl font-black text-secondary" x-text="stats[period].time"></div>
                    <div class="text-[10px] font-bold text-muted mt-1">時間 (h)</div>
                </div>
                <div class="bg-surface border border-border rounded-2xl p-4 text-center stat-card">
                    <div class="text-2xl font-black text-accent" x-text="stats[period].obs"></div>
                    <div class="text-[10px] font-bold text-muted mt-1">観察数</div>
                </div>
            </div>

            <!-- ── Weekly Chart (7 days) ── -->
            <div class="bg-surface border border-border rounded-2xl p-5 mb-2" x-show="period === 'week'" x-transition.opacity>
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-sm font-bold text-text flex items-center gap-2">
                        <i data-lucide="bar-chart-3" class="w-4 h-4 text-primary"></i>
                        日別アクティビティ
                    </h3>
                    <span class="text-xs text-muted flex items-center gap-1">
                        <span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> 観察あり
                    </span>
                </div>
                <div class="chart-bars">
                    <?php $barDelay = 0;
                    foreach ($chartDays as $day): ?>
                        <?php $pct = round(($day['distance'] / $chartDayMax) * 100); ?>
                        <div class="chart-bar-wrap">
                            <div class="chart-bar <?php echo $day['distance'] == 0 ? 'empty' : ''; ?> <?php echo $day['isToday'] ? 'today' : ''; ?> <?php echo $day['obs'] > 0 ? 'has-obs' : ''; ?>"
                                style="height: <?php echo max(4, $pct); ?>%; animation-delay: <?php echo $barDelay * 80; ?>ms;">
                            </div>
                            <div class="chart-bar-label <?php echo $day['isToday'] ? 'today' : ''; ?>"><?php echo $day['label']; ?></div>
                            <div class="chart-bar-date"><?php echo $day['date']; ?></div>
                        </div>
                    <?php $barDelay++;
                    endforeach; ?>
                </div>
            </div>

            <!-- ── Monthly Chart (4 weeks) ── -->
            <div class="bg-surface border border-border rounded-2xl p-5 mb-2" x-show="period === 'month'" x-transition.opacity>
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-sm font-bold text-text flex items-center gap-2">
                        <i data-lucide="bar-chart-3" class="w-4 h-4 text-primary"></i>
                        週別アクティビティ
                    </h3>
                    <span class="text-xs text-muted"><?php echo date('n月'); ?></span>
                </div>
                <div class="chart-bars" style="height: 100px;">
                    <?php $barDelay = 0;
                    foreach ($chartWeeks as $cw): ?>
                        <?php $pct = round(($cw['distance'] / $chartWeekMax) * 100); ?>
                        <div class="chart-bar-wrap">
                            <div class="chart-bar <?php echo $cw['distance'] == 0 ? 'empty' : ''; ?> <?php echo $cw['isCurrent'] ? 'today' : ''; ?> <?php echo $cw['obs'] > 0 ? 'has-obs' : ''; ?>"
                                style="height: <?php echo max(4, $pct); ?>%; animation-delay: <?php echo $barDelay * 120; ?>ms;">
                            </div>
                            <div class="chart-bar-label <?php echo $cw['isCurrent'] ? 'today' : ''; ?>"><?php echo $cw['label']; ?>〜</div>
                            <?php if ($cw['count'] > 0): ?>
                                <div class="chart-bar-date"><?php echo number_format($cw['distance'] / 1000, 1); ?>km</div>
                            <?php endif; ?>
                        </div>
                    <?php $barDelay++;
                    endforeach; ?>
                </div>
            </div>

            <!-- ── All-time mini summary (no chart) ── -->
            <div class="bg-surface border border-border rounded-2xl p-5 mb-6" x-show="period === 'all'" x-transition.opacity>
                <div class="flex items-center gap-3 text-sm">
                    <i data-lucide="trending-up" class="w-5 h-5 text-primary"></i>
                    <span class="font-bold">合計 <span x-text="stats.all.sessions"></span> 回のウォーク</span>
                    <span class="text-muted">·</span>
                    <span class="text-muted">平均
                        <span class="font-bold text-text" x-text="stats.all.sessions > 0 ? (stats.all.distance / stats.all.sessions).toFixed(1) : '0'"></span> km/回
                    </span>
                </div>
            </div>

            <!-- ── Health Card ── -->
            <div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-8 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <i data-lucide="heart-pulse" class="w-5 h-5 text-emerald-600"></i>
                    </div>
                    <div>
                        <div class="text-xs font-bold text-emerald-700">推定消費カロリー</div>
                        <div class="text-[10px] text-emerald-500">歩行距離 × 50 kcal/km</div>
                    </div>
                </div>
                <div class="text-2xl font-black text-emerald-700 stat-card">
                    <span x-text="stats[period].kcal">0</span>
                    <span class="text-sm font-bold">kcal</span>
                </div>
            </div>

            <!-- ── Session List ── -->
            <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
                <span class="w-1.5 h-5 bg-primary rounded-full"></span>
                記録一覧
                <span class="text-xs font-bold text-muted ml-auto" x-text="'(' + stats[period].sessions + '件)'"></span>
            </h2>

            <?php if (empty($sessions)): ?>
                <div class="bg-surface border border-border rounded-2xl p-10 text-center mb-12">
                    <div class="text-4xl mb-4">🐾</div>
                    <h3 class="text-lg font-bold text-muted">まだ記録がありません</h3>
                    <p class="text-sm text-text-secondary mt-2 mb-6">
                        「ウォークを開始」ボタンから、記録を始めましょう！
                    </p>
                    <a href="field_research.php" class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm">
                        <i data-lucide="play" class="w-4 h-4"></i> 今すぐ開始
                    </a>
                </div>
            <?php else: ?>
                <div class="space-y-2 mb-12">
                    <?php
                    $mapIdx = 0;
                    foreach ($sessionsByDate as $dateKey => $daySessions):
                        $dateTs = strtotime($dateKey);
                        $dayLabel = date('n月j日', $dateTs) . '（' . $dayLabels[(int)date('w', $dateTs)] . '）';
                        $dayTotalDist = array_sum(array_column($daySessions, 'total_distance'));
                        $dayTotalObs = array_sum(array_column($daySessions, 'observation_count'));
                    ?>
                        <div x-show="period === 'all' || (period === 'week' && '<?php echo $dateKey; ?>' >= '<?php echo $weekStart; ?>') || (period === 'month' && '<?php echo $dateKey; ?>' >= '<?php echo $monthStart; ?>')"
                            x-transition.opacity>
                            <div class="day-header flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-black text-text"><?php echo $dayLabel; ?></span>
                                    <?php if ($today === $dateKey): ?>
                                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">今日</span>
                                    <?php endif; ?>
                                </div>
                                <div class="flex items-center gap-3 text-xs text-muted font-bold">
                                    <span><?php echo number_format($dayTotalDist / 1000, 1); ?> km</span>
                                    <?php if ($dayTotalObs > 0): ?>
                                        <span class="text-amber-500"><?php echo $dayTotalObs; ?> 観察</span>
                                    <?php endif; ?>
                                </div>
                            </div>

                            <div class="space-y-3 mt-2 mb-6">
                                <?php foreach ($daySessions as $session): ?>
                                    <div class="activity-card bg-surface border border-border rounded-2xl overflow-hidden">
                                        <div class="track-minimap" id="map-<?php echo $mapIdx; ?>"
                                            data-points='<?php echo json_encode($session['points'] ?? []); ?>'></div>
                                        <div class="p-4">
                                            <div class="flex items-center justify-between mb-3">
                                                <div class="flex items-center gap-2">
                                                    <?php if (!empty($session['field_name']) && ($session['field_name'] ?? '') !== 'Free Roam'): ?>
                                                        <span class="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                                            🌿 <?php echo htmlspecialchars($session['field_name']); ?>
                                                        </span>
                                                    <?php else: ?>
                                                        <span class="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                                            👣 自由探索
                                                        </span>
                                                    <?php endif; ?>
                                                    <span class="text-xs text-muted"><?php echo date('H:i', strtotime($session['started_at'])); ?></span>
                                                </div>
                                                <a href="field_research.php?session_id=<?php echo urlencode($session['session_id']); ?><?php echo !empty($session['field_id']) ? '&field_id=' . urlencode($session['field_id']) : ''; ?>"
                                                    class="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                                    <i data-lucide="rotate-ccw" class="w-3 h-3"></i> リプレイ
                                                </a>
                                            </div>
                                            <div class="grid grid-cols-3 gap-2 text-center">
                                                <div>
                                                    <div class="text-sm font-black stat-card"><?php echo number_format(($session['total_distance'] ?? 0) / 1000, 2); ?></div>
                                                    <div class="text-[10px] text-muted font-bold">km</div>
                                                </div>
                                                <div>
                                                    <div class="text-sm font-black stat-card"><?php echo gmdate('H:i:s', $session['duration_sec'] ?? 0); ?></div>
                                                    <div class="text-[10px] text-muted font-bold">時間</div>
                                                </div>
                                                <div>
                                                    <div class="text-sm font-black stat-card"><?php echo $session['observation_count'] ?? 0; ?></div>
                                                    <div class="text-[10px] text-muted font-bold">観察</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <?php $mapIdx++; ?>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

            <!-- ── Legacy Fields ── -->
            <div x-data="{ open: false }" class="mb-16">
                <button @click="open = !open" class="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-base hover:bg-surface transition">
                    <span class="font-bold text-muted flex items-center gap-2">
                        <i data-lucide="archive" class="w-4 h-4"></i> 保存済みフィールド (<?php echo count($fields); ?>)
                    </span>
                    <i data-lucide="chevron-down" class="w-4 h-4 transition-transform" :class="{'rotate-180': open}"></i>
                </button>
                <div x-show="open" x-collapse x-cloak class="mt-4">
                    <div class="space-y-4 mb-8">
                        <?php foreach ($fields as $field): ?>
                            <div class="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <span class="text-2xl"><?php echo $biomeOptions[$field['biome_type']]['icon'] ?? '🌍'; ?></span>
                                    <div>
                                        <h4 class="font-bold text-sm"><?php echo htmlspecialchars($field['name']); ?></h4>
                                        <p class="text-xs text-muted">半径 <?php echo $field['radius']; ?>m</p>
                                    </div>
                                </div>
                                <a href="field_research.php?field=<?php echo urlencode($field['id']); ?>"
                                    class="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold hover:bg-emerald-100">出発</a>
                            </div>
                        <?php endforeach; ?>
                    </div>
                    <div class="bg-surface border border-border rounded-2xl p-6">
                        <h3 class="font-bold mb-4">新しいフィールドを登録</h3>
                        <form action="api/create_field.php" method="POST" x-data="fieldCreator()" @submit.prevent="submit()">
                            <div id="create-map" class="mb-4 relative"></div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <input type="text" name="name" x-model="name" required placeholder="フィールド名" class="w-full px-4 py-2 border border-border rounded-lg bg-base">
                                <select name="biome" x-model="biome" required class="w-full px-4 py-2 border border-border rounded-lg bg-base">
                                    <option value="">バイオーム選択</option>
                                    <?php foreach ($biomeOptions as $k => $o): ?>
                                        <option value="<?php echo $k; ?>"><?php echo $o['icon'] . ' ' . $o['label']; ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </div>
                            <div class="grid grid-cols-2 gap-4 mb-4">
                                <input type="number" step="any" name="lat" x-model="lat" required placeholder="緯度" class="w-full px-4 py-2 border border-border rounded-lg bg-base">
                                <input type="number" step="any" name="lng" x-model="lng" required placeholder="経度" class="w-full px-4 py-2 border border-border rounded-lg bg-base">
                            </div>
                            <input type="hidden" name="radius_m" value="500">
                            <div class="flex gap-2">
                                <button type="button" @click="useGPS()" class="px-4 py-2 border border-border rounded-lg text-xs font-bold">GPS</button>
                                <button type="submit" class="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-bold text-sm">作成</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

        <?php endif; ?>
    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        function walkDashboard() {
            return {
                period: 'week',
                stats: <?php echo $statsJson; ?>,
                init() {
                    this.$nextTick(() => {
                        lucide.createIcons();
                        this.renderMiniMaps();
                    });
                },
                renderMiniMaps() {
                    document.querySelectorAll('.track-minimap').forEach(el => {
                        const points = JSON.parse(el.dataset.points || '[]');
                        if (!points.length) return;
                        const bounds = new maplibregl.LngLatBounds();
                        points.forEach(p => bounds.extend([p[0], p[1]]));
                        const map = new maplibregl.Map({
                            container: el,
                            style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
                            center: bounds.getCenter(),
                            zoom: 13,
                            interactive: false,
                            attributionControl: false
                        });
                        map.on('load', () => {
                            map.addSource('track', {
                                type: 'geojson',
                                data: {
                                    type: 'Feature',
                                    geometry: {
                                        type: 'LineString',
                                        coordinates: points.map(p => [p[0], p[1]])
                                    }
                                }
                            });
                            map.addLayer({
                                id: 'track-line',
                                type: 'line',
                                source: 'track',
                                paint: {
                                    'line-color': '#10b981',
                                    'line-width': 3,
                                    'line-opacity': 0.8
                                }
                            });
                            map.fitBounds(bounds, {
                                padding: 40,
                                animate: false
                            });
                        });
                    });
                }
            };
        }

        function fieldCreator() {
            let map = null,
                marker = null;
            return {
                name: '',
                biome: '',
                lat: '',
                lng: '',
                init() {
                    this.$nextTick(() => {
                        const container = document.getElementById('create-map');
                        if (!container) return;
                        map = new maplibregl.Map({
                            container: 'create-map',
                            style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
                            center: [137.73, 34.71],
                            zoom: 10
                        });
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(pos => {
                                map.flyTo({
                                    center: [pos.coords.longitude, pos.coords.latitude],
                                    zoom: 13,
                                    duration: 1200
                                });
                            }, () => {}, {
                                timeout: 5000
                            });
                        }
                        map.on('click', e => {
                            this.lat = e.lngLat.lat.toFixed(6);
                            this.lng = e.lngLat.lng.toFixed(6);
                            if (marker) marker.remove();
                            marker = new maplibregl.Marker().setLngLat(e.lngLat).addTo(map);
                        });
                    });
                },
                useGPS() {
                    navigator.geolocation.getCurrentPosition(pos => {
                        this.lat = pos.coords.latitude.toFixed(6);
                        this.lng = pos.coords.longitude.toFixed(6);
                        if (map) {
                            map.flyTo({
                                center: [pos.coords.longitude, pos.coords.latitude],
                                zoom: 14
                            });
                            if (marker) marker.remove();
                            marker = new maplibregl.Marker().setLngLat([pos.coords.longitude, pos.coords.latitude]).addTo(map);
                        }
                    });
                },
                async submit() {
                    this.$el.submit();
                }
            }
        }
    </script>
</body>

</html>