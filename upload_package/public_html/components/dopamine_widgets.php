<?php
// Phase 3: Dopamine Widgets (Family Science Edition)
// Concepts: Field Log (Memory), Researcher Grade (Growth), Fellow Explorers (Community)

// Real Data (Inherited from dashboard.php scope)
$territory_coverage = isset($userStats['territory']) ? number_format($userStats['territory'], 2) : '0.00';
$current_score = $userStats['score'] ?? 0;

// Observer Rank integration
$_ors = $userStats['observer_rank'] ?? null;
$next_rank_progress = $_ors ? ($_ors['progress'] ?? 0) : UserStatsService::getProgressToNextRank($current_score);
$next_rank_target = $_ors ? ($_ors['next_threshold'] ?? '—') : UserStatsService::getNextRankTarget($current_score);
$_ors_rank_name = $_ors ? ($_ors['rank']['name_ja'] ?? '—') : '';
$_ors_rank_icon = $_ors ? ($_ors['rank']['icon'] ?? '🌱') : '🎓';
$_ors_rank_color = $_ors ? ($_ors['rank']['color'] ?? '#8bc34a') : '#facc15';

// Mock Community Data (for now)
$active_explorer_count = rand(2, 5);
?>

<!-- Widget A: Field Log (Shared Footprints) -->
<div class="fixed top-24 left-4 z-20 pointer-events-auto animate-slide-up" style="animation-delay: 0.2s">
    <div class="oribe-panel p-2 pl-3 border-l-4 border-emerald-500 rounded-r-xl bg-white/80 backdrop-blur-md backdrop-saturate-150 shadow-lg group hover:bg-white transition duration-300">
        <div class="flex items-center gap-3">
            <!-- Icon: Badge Style (Friendly) -->
            <div class="size-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-inner relative overflow-hidden ring-2 ring-emerald-400/30">
                <span class="material-symbols-outlined text-white text-[20px] drop-shadow-md">map</span>
                <div class="absolute inset-0 bg-gradient-to-tr from-transparent to-white/20"></div>
            </div>

            <div>
                <div class="text-[10px] text-emerald-700 font-sans font-bold tracking-wider mb-0.5">フィールドログ</div>
                <div class="font-mono text-gray-900 text-lg font-bold leading-none tracking-tight flex items-baseline">
                    <?php echo $territory_coverage; ?><span class="text-xs ml-0.5 text-emerald-600 font-sans font-normal">km²</span>
                </div>
                <div class="text-[10px] text-gray-500 mt-0.5 group-hover:text-emerald-600 transition font-medium">
                    探索済みエリア
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Widget B: Fellow Explorers (Global Connection) -->
<div class="fixed top-36 right-4 z-20 pointer-events-auto animate-slide-up" style="animation-delay: 0.4s">
    <div class="flex items-center gap-2 justify-end bg-white/70 backdrop-blur-sm px-4 py-1.5 rounded-full border border-cyan-200 shadow-sm hover:bg-white/90 transition duration-500 group">
        <div class="text-right">
            <div class="text-[9px] text-cyan-700 font-bold tracking-wide group-hover:text-cyan-600 transition">近くの観察者</div>
            <div class="text-[10px] text-gray-500">
                <span class="text-gray-900 font-bold text-xs mr-0.5"><?php echo $active_explorer_count; ?></span>人
            </div>
        </div>
        <!-- Pulse Icon -->
        <div class="size-8 rounded-full bg-cyan-100 flex items-center justify-center relative">
            <span class="material-symbols-outlined text-cyan-600 text-sm">groups</span>
            <div class="absolute inset-0 border border-cyan-400/30 rounded-full animate-ping opacity-50"></div>
        </div>
    </div>
</div>

<!-- Widget C: Observer Rank (Growth) -->
<div class="fixed bottom-24 left-4 right-4 md:w-auto md:left-1/2 md:-translate-x-1/2 z-20 pointer-events-none flex justify-center animate-slide-up" style="animation-delay: 0.6s">
    <div class="flex items-center gap-3 bg-white/90 backdrop-blur-lg rounded-2xl pl-3 pr-4 py-2 border border-gray-200 shadow-xl pointer-events-auto hover:scale-105 transition-transform duration-300">
        <!-- Rank Icon -->
        <div class="size-8 rounded-lg rotate-3 flex items-center justify-center shadow-lg text-lg" style="background: <?php echo $_ors_rank_color; ?>;">
            <?php echo $_ors_rank_icon; ?>
        </div>

        <div class="flex flex-col min-w-[120px]">
            <div class="flex justify-between items-baseline mb-1">
                <span class="text-[10px] text-gray-500 font-bold tracking-wider"><?php echo $_ors_rank_name ?: '次のランク'; ?> (<?php echo is_numeric($next_rank_target) ? number_format($next_rank_target) : $next_rank_target; ?> pt)</span>
                <span class="text-[10px] font-mono font-bold" style="color: <?php echo $_ors_rank_color; ?>;"><?php echo round($next_rank_progress); ?>%</span>
            </div>
            <!-- Progress Bar -->
            <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden ring-1 ring-gray-200">
                <div class="h-full rounded-full" style="width: <?php echo $next_rank_progress; ?>%; background: linear-gradient(90deg, <?php echo $_ors_rank_color; ?>, <?php echo $_ors_rank_color; ?>cc);"></div>
            </div>
        </div>
    </div>
</div>