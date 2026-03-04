<?php
// Phase 2: Bento Dashboard Component
// "Quest Selection" Interface - Asymmetrical Oribe Grid

// Mock Data for Mission Tiles (In real app, fetch from QuestManager)
$missions = [
    [
        'id' => 'insect',
        'label' => '昆虫',
        'sub' => '昆虫',
        'icon' => 'pest_control',
        'color' => 'emerald',
        'count_done' => 12,
        'count_total' => 450,
        'grid_area' => 'span 2 / span 2',
    ],
    [
        'id' => 'bird',
        'label' => '鳥類',
        'sub' => '鳥類',
        'icon' => 'flight',
        'color' => 'cyan',
        'count_done' => 45,
        'count_total' => 120,
        'grid_area' => 'span 1 / span 2',
    ],
    [
        'id' => 'plant',
        'label' => '植物',
        'sub' => '植物',
        'icon' => 'local_florist',
        'color' => 'emerald',
        'count_done' => 102,
        'count_total' => 1200,
        'grid_area' => 'span 1 / span 1',
    ],
    [
        'id' => 'herps',
        'label' => '両爬',
        'sub' => '両爬',
        'icon' => 'pets',
        'color' => 'cyan',
        'count_done' => 3,
        'count_total' => 45,
        'grid_area' => 'span 1 / span 1',
    ]
];
?>

<div class="w-full h-full overflow-y-auto pb-24 no-scrollbar">
    <div class="grid grid-cols-2 gap-3 p-4">

        <!-- Header / Context -->
        <div class="col-span-2 mb-2 flex items-end justify-between border-b border-gray-200 pb-2">
            <div>
                <div class="text-[10px] text-gray-400 tracking-widest font-mono">ACTIVE SECTOR</div>
                <div class="text-xl font-display font-bold text-gray-900 tracking-wider">TOKYO AREA 1</div>
            </div>
            <div class="text-right">
                <div class="text-[10px] text-emerald-600 font-mono">季節: 夏</div>
                <div class="text-xs text-gray-500">目標種数: 1,815</div>
            </div>
        </div>

        <?php foreach ($missions as $m): ?>
            <?php
            $progress = ($m['count_done'] / $m['count_total']) * 100;
            $colorClass = $m['color'] === 'emerald' ? 'text-emerald-600' : 'text-cyan-600';
            $bgClass = $m['color'] === 'emerald' ? 'bg-emerald-50 border-emerald-200' : 'bg-cyan-50 border-cyan-200';
            $barClass = $m['color'] === 'emerald' ? 'bg-emerald-500' : 'bg-cyan-500';
            ?>
            <div class="relative group overflow-hidden backdrop-blur-md border hover:shadow-lg transition duration-300 transform hover:scale-[1.02] active:scale-95 rounded-xl <?php echo $bgClass; ?>"
                style="grid-area: <?php echo $m['grid_area']; ?>;">

                <!-- Background Hover -->
                <div class="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition"></div>

                <a href="#" class="block p-4 h-full flex flex-col justify-between relative z-10">
                    <!-- Top Info -->
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="text-[9px] text-gray-400 tracking-widest font-mono mb-1"><?php echo $m['sub']; ?></div>
                            <h3 class="text-2xl font-display font-bold text-gray-900 tracking-tighter leading-none"><?php echo $m['label']; ?></h3>
                        </div>
                        <span class="material-symbols-outlined text-2xl opacity-40 group-hover:opacity-100 transition <?php echo $colorClass; ?>">
                            <?php echo $m['icon']; ?>
                        </span>
                    </div>

                    <!-- Bottom Stats -->
                    <div class="mt-4">
                        <div class="flex justify-between items-end mb-1">
                            <div class="text-3xl font-mono font-bold <?php echo $colorClass; ?>">
                                <?php echo $m['count_total'] - $m['count_done']; ?>
                            </div>
                            <div class="text-[9px] text-gray-400 font-mono text-right">
                                <span class="block text-xs text-gray-700"><?php echo $m['count_done']; ?> 発見</span>
                                記録率 <?php echo number_format(100 - $progress, 1); ?>%
                            </div>
                        </div>

                        <!-- Progress Bar -->
                        <div class="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                            <div class="<?php echo $barClass; ?> h-full" style="width: <?php echo $progress; ?>%"></div>
                        </div>
                        <div class="text-[8px] text-gray-400 mt-1 uppercase tracking-widest text-right">
                            要調査
                        </div>
                    </div>
                </a>
            </div>
        <?php endforeach; ?>

        <!-- Bibliographic Authority (Real Data) -->
        <?php
        // Ensure $bibStats is always defined with safe defaults
        if (!isset($bibStats) || !is_array($bibStats)) {
            $bibStats = ['papers' => 0, 'citations' => 0, 'keys' => 0, 'books' => 0];
        }
        ?>
        <div class="col-span-2 p-4 border border-amber-200 rounded-lg bg-amber-50 relative overflow-hidden group hover:border-amber-300 hover:shadow-md transition">
            <div class="absolute top-0 right-0 w-32 h-32 bg-amber-100 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-amber-200/50 transition"></div>
            <div class="relative z-10">
                <div class="flex items-center gap-2 mb-3">
                    <span class="material-symbols-outlined text-amber-500 text-sm">menu_book</span>
                    <span class="text-[9px] text-amber-700 tracking-widest font-bold">文献権威データベース</span>
                </div>
                <div class="grid grid-cols-4 gap-2">
                    <div class="text-center">
                        <div class="text-xl font-mono font-bold text-cyan-600"><?php echo number_format($bibStats['papers']); ?></div>
                        <div class="text-[8px] text-gray-500 tracking-wider">論文</div>
                        <div class="text-[7px] text-cyan-600 mt-0.5">TIER 1</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-mono font-bold text-amber-600"><?php echo number_format($bibStats['citations']); ?></div>
                        <div class="text-[8px] text-gray-500 tracking-wider">出典</div>
                        <div class="text-[7px] text-amber-600 mt-0.5">TIER 3</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-mono font-bold text-emerald-600"><?php echo $bibStats['keys']; ?></div>
                        <div class="text-[8px] text-gray-500 tracking-wider">検索表</div>
                    </div>
                    <div class="text-center">
                        <div class="text-xl font-mono font-bold text-gray-600"><?php echo $bibStats['books']; ?></div>
                        <div class="text-[8px] text-gray-500 tracking-wider">図鑑</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Daily Target Tile (Gamification Hook) -->
        <?php
        $activeQuests = QuestManager::getActiveQuests();
        $dailyTarget = !empty($activeQuests) ? $activeQuests[0] : null;
        if ($dailyTarget):
        ?>
            <div class="col-span-2 p-4 border border-yellow-300 rounded-lg bg-yellow-50 flex items-center justify-between group hover:bg-yellow-100 transition relative overflow-hidden">
                <!-- Glint Effect -->
                <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-yellow-200/30 to-transparent animate-[pulse_4s_infinite]"></div>

                <div class="flex items-center gap-4 relative z-10">
                    <div class="size-10 bg-yellow-200 rounded-full flex items-center justify-center border border-yellow-400">
                        <span class="material-symbols-outlined text-yellow-600 text-xl animate-bounce">location_searching</span>
                    </div>
                    <div>
                        <div class="text-[9px] text-yellow-700 tracking-widest font-bold mb-0.5">今日のターゲット</div>
                        <div class="text-sm font-black text-gray-900"><?php echo htmlspecialchars($dailyTarget['jp_name']); ?></div>
                    </div>
                </div>

                <a href="#" class="text-[10px] font-bold text-yellow-700 bg-yellow-200 px-3 py-1.5 rounded border border-yellow-400 hover:bg-yellow-400 hover:text-yellow-900 transition">
                    探しに行く
                </a>
            </div>
        <?php else: ?>
            <!-- Collection Complete State -->
            <div class="col-span-2 p-4 border border-emerald-200 rounded-lg bg-emerald-50 flex items-center justify-center gap-3">
                <span class="material-symbols-outlined text-emerald-500">verified</span>
                <div class="text-xs font-bold text-emerald-600">セクタークリア！お疲れ様！</div>
            </div>
        <?php endif; ?>

    </div>
</div>