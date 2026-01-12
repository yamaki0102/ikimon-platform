<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php 
    $meta_title = "ランキング";
    include __DIR__ . '/components/meta.php'; 
    ?>
    <style>
        .font-brand { font-family: 'Montserrat', sans-serif; }
    </style>
</head>
<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">
    <?php include('components/nav.php'); ?>
    <script>document.body.classList.remove('js-loading');</script>

    <main class="max-w-7xl mx-auto px-4 md:px-6 pt-20 pb-32 md:pt-24">
        <div class="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
            <div>
                <h1 class="text-3xl md:text-5xl font-black mb-2 md:mb-4">みんなの活動</h1>
                <p class="text-gray-400">競争ではなく、共生。仲間の発見を楽しもう。</p>
            </div>
            
            <!-- H008: Time Range Toggle -->
            <div class="flex bg-white/5 p-1 rounded-xl">
                <?php $range = $_GET['range'] ?? 'all'; ?>
                <a href="?range=weekly" class="px-6 py-2 rounded-lg font-bold text-sm transition <?php echo $range === 'weekly' ? 'bg-[var(--color-primary)] text-black' : 'text-gray-400 hover:text-white'; ?>">Weekly</a>
                <a href="?range=monthly" class="px-6 py-2 rounded-lg font-bold text-sm transition <?php echo $range === 'monthly' ? 'bg-[var(--color-primary)] text-black' : 'text-gray-400 hover:text-white'; ?>">Monthly</a>
                <a href="?range=all" class="px-6 py-2 rounded-lg font-bold text-sm transition <?php echo $range === 'all' ? 'bg-[var(--color-primary)] text-black' : 'text-gray-400 hover:text-white'; ?>">All Time</a>
            </div>
        </div>

        <?php
        $range = $_GET['range'] ?? 'all'; 
        
        // --- Dynamic Stats Calculation (Cached) ---
        // Cache key includes range to separate weekly/monthly/all stats
        $stats_cache_key = 'ranking_stats_' . $range;
        
        $stats = DataStore::getCached($stats_cache_key, 3600, function() use ($range) {
            // Use fetchAll to gather data from all partitions
            $all_obs = DataStore::fetchAll('observations');
            
            // Filter by range
            if ($range !== 'all') {
                $now = new DateTime();
                $all_obs = array_filter($all_obs, function($o) use ($range, $now) {
                    $obsDate = new DateTime($o['observed_at']);
                    $diff = $now->diff($obsDate)->days;
                    if ($range === 'weekly') return $diff <= 7;
                    if ($range === 'monthly') return $diff <= 30;
                    return true;
                });
            }

            $total_obs = count($all_obs);
            $unique_species = [];
            $research_grade_count = 0;
            $user_stats = [];

            foreach ($all_obs as $obs) {
                // Count unique species
                if (isset($obs['taxon']['name'])) {
                    $unique_species[$obs['taxon']['name']] = true;
                }

                // Research Grade stats
                if (($obs['status'] ?? '') === 'Research Grade') {
                    $research_grade_count++;
                }

                // User stats aggregator
                $uid = $obs['user_id'] ?? 'unknown';
                if (!isset($user_stats[$uid])) {
                    $user_stats[$uid] = [
                        'id' => $uid,
                        'name' => $obs['user_name'] ?? 'Unknown',
                        'avatar' => $obs['user_avatar'] ?? 'https://i.pravatar.cc/150?u=default',
                        'rank' => $obs['user_rank'] ?? 'Observer',
                        'count' => 0,
                        'score' => 0 // Dummy score logic
                    ];
                }
                $user_stats[$uid]['count']++;
                $user_stats[$uid]['score'] += 10;
            }

            // Sort users by count
            usort($user_stats, function($a, $b) {
                return $b['count'] <=> $a['count'];
            });
            
            return [
                'total_obs' => $total_obs,
                'total_species' => count($unique_species),
                'rg_rate' => $total_obs > 0 ? round(($research_grade_count / $total_obs) * 100) : 0,
                'top_users' => array_slice($user_stats, 0, 100) // Keep top 100 in cache
            ];
        });

        $total_obs = $stats['total_obs'];
        $total_species = $stats['total_species'];
        $rg_rate = $stats['rg_rate'];
        $top_users = array_slice($stats['top_users'], 0, 5); // Display top 5
        ?>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            <!-- Left: Global Mission -->
            <div class="lg:col-span-2 space-y-12">
                <section class="glass-card p-10 rounded-[3rem] border-white/5 relative overflow-hidden bg-gradient-to-br from-green-600/10 to-transparent">
                    <div class="relative z-10">
                        <div class="flex items-center gap-4 mb-6">
                            <div class="px-4 py-1 rounded-full bg-green-500 text-black text-[10px] font-black uppercase tracking-widest">Global Mission</div>
                            <span class="text-gray-400 text-xs font-bold">Expires in 12 days</span>
                        </div>
                        <h2 class="text-4xl font-black mb-4">浜松の秋を見つけよう！</h2>
                        <p class="text-gray-300 mb-8 max-w-xl leading-relaxed">
                            秋の指標種（ヒガンバナ、アキアカネなど）を1000件観察しよう。
                            現在 <?php echo $total_obs; ?>件 / 1000件
                        </p>
                        
                        <!-- Progress Bar (Dynamic) -->
                        <div class="h-4 bg-white/5 rounded-full overflow-hidden mb-4">
                            <div class="h-full bg-gradient-to-r from-green-500 to-emerald-400 shadow-[0_0_15px_rgba(34,197,94,0.5)]" style="width: <?php echo min(100, ($total_obs / 1000) * 100); ?>%"></div>
                        </div>
                        <div class="flex justify-between text-xs font-bold tracking-widest uppercase">
                            <span class="text-green-400"><?php echo $total_obs; ?> Success</span>
                            <span class="text-gray-600">Goal 1000</span>
                        </div>
                    </div>
                </section>

                <!-- Top Contributors (Podium Layout) -->
                <section>
                    <h3 class="text-2xl font-bold mb-8 flex items-center gap-3">
                        <i data-lucide="users" class="text-[var(--color-primary)]"></i>
                         Top Contributors
                    </h3>
                    
                    <?php if (count($top_users) >= 3): ?>
                    <!-- Podium -->
                    <div class="flex items-end justify-center gap-4 mb-12 px-4">
                        <!-- 2nd Place -->
                        <div class="flex-1 flex flex-col items-center">
                            <div class="relative mb-4">
                                <img src="<?php echo $top_users[1]['avatar']; ?>" class="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-slate-300 shadow-[0_0_20px_rgba(203,213,225,0.4)]">
                                <div class="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-300 text-slate-900 text-[10px] font-black uppercase rounded-full tracking-widest">2nd</div>
                            </div>
                            <h4 class="font-bold text-sm text-center mb-1 truncate w-full max-w-[100px]"><?php echo htmlspecialchars($top_users[1]['name']); ?></h4>
                            <p class="text-[var(--color-primary)] font-black text-xs"><?php echo $top_users[1]['count']; ?> Obs</p>
                            <div class="w-full h-24 bg-gradient-to-t from-slate-500/20 to-slate-500/5 rounded-t-2xl mt-4 border-t border-slate-500/30"></div>
                        </div>
                        
                        <!-- 1st Place -->
                        <div class="flex-1 flex flex-col items-center z-10 -mx-2">
                             <div class="relative mb-6">
                                <div class="absolute inset-0 bg-yellow-500 rounded-full blur-xl opacity-40 animate-pulse"></div>
                                <img src="<?php echo $top_users[0]['avatar']; ?>" class="relative w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)]">
                                <div class="absolute -top-6 left-1/2 -translate-x-1/2">
                                    <i data-lucide="crown" class="w-8 h-8 text-yellow-400 fill-yellow-400/20"></i>
                                </div>
                                <div class="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-black uppercase rounded-full tracking-widest shadow-lg">1st</div>
                            </div>
                            <h4 class="font-bold text-base text-center mb-1 truncate w-full max-w-[120px]"><?php echo htmlspecialchars($top_users[0]['name']); ?></h4>
                            <p class="text-[var(--color-primary)] font-black text-sm"><?php echo $top_users[0]['count']; ?> Obs</p>
                            <div class="w-full h-32 bg-gradient-to-t from-yellow-500/20 to-yellow-500/5 rounded-t-2xl mt-4 border-t border-yellow-500/30 shadow-[0_-10px_30px_rgba(250,204,21,0.1)]"></div>
                        </div>

                        <!-- 3rd Place -->
                        <div class="flex-1 flex flex-col items-center">
                            <div class="relative mb-4">
                                <img src="<?php echo $top_users[2]['avatar']; ?>" class="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.4)]">
                                <div class="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-orange-400 text-orange-900 text-[10px] font-black uppercase rounded-full tracking-widest">3rd</div>
                            </div>
                            <h4 class="font-bold text-sm text-center mb-1 truncate w-full max-w-[100px]"><?php echo htmlspecialchars($top_users[2]['name']); ?></h4>
                            <p class="text-[var(--color-primary)] font-black text-xs"><?php echo $top_users[2]['count']; ?> Obs</p>
                            <div class="w-full h-16 bg-gradient-to-t from-orange-500/20 to-orange-500/5 rounded-t-2xl mt-4 border-t border-orange-500/30"></div>
                        </div>
                    </div>
                    <?php endif; ?>

                    <!-- List 4th+ -->
                    <div class="space-y-4">
                        <?php foreach (array_slice($top_users, 3) as $idx => $u): ?>
                        <div class="glass-card p-6 rounded-3xl border-white/5 flex items-center gap-6 hover:bg-white/5 transition">
                            <div class="w-8 flex justify-center font-brand font-black text-gray-600 italic">
                                #<?php echo $idx + 4; ?>
                            </div>
                            <div class="w-10 h-10 rounded-full overflow-hidden border border-white/10">
                                <img src="<?php echo $u['avatar']; ?>" class="w-full h-full object-cover">
                            </div>
                            <div class="flex-1">
                                <h4 class="font-bold text-sm"><?php echo htmlspecialchars($u['name']); ?></h4>
                            </div>
                            <div class="text-right">
                                <p class="text-base font-brand font-black text-gray-300"><?php echo $u['count']; ?> <span class="text-[10px] text-gray-500 normal-case">Obs</span></p>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </section>
            </div>

            <!-- Right: Hall of Fame / Stats -->
            <div class="space-y-12">
                <section class="glass-card p-8 rounded-[2.5rem] border-white/5">
                    <h3 class="text-xl font-bold mb-8">Quick Stats</h3>
                    <div class="space-y-6">
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-400">Total Observations</span>
                            <span class="font-brand font-black text-xl"><?php echo number_format($total_obs); ?></span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-400">Unique Species</span>
                            <span class="font-brand font-black text-xl"><?php echo number_format($total_species); ?></span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-400">Research Grade Rate</span>
                            <span class="font-brand font-black text-xl text-green-400"><?php echo $rg_rate; ?>%</span>
                        </div>
                    </div>
                </section>

                <section class="glass-card p-8 rounded-[2.5rem] bg-emerald-500 text-black">
                    <h3 class="text-xl font-black mb-4 tracking-tight">Support the Mission</h3>
                    <p class="text-sm font-medium mb-8 leading-relaxed opacity-80">
                        あなたのデータ提供と専門知識が、未来の自然を救う直接的な力になります。
                    </p>
                    <a href="post.php" class="block w-full text-center py-4 bg-black text-white rounded-full font-bold hover:bg-white hover:text-black transition shadow-xl">
                        今すぐ投稿する
                    </a>
                </section>
            </div>
        </div>
    </main>

    <?php
    // Determine My Rank
    $myRankData = null;
    $myRank = null;
    if ($currentUser) {
        foreach ($stats['top_users'] as $idx => $u) {
            if ($u['id'] == $currentUser['id']) {
                $myRankData = $u;
                $myRank = $idx + 1;
                break;
            }
        }
    }
    ?>

    <?php if ($myRankData): ?>
    <!-- Sticky My Rank Footer -->
    <div x-data="{ show: sessionStorage.getItem('hide_rank_banner') !== 'true' }" 
         x-show="show" 
         x-transition:leave="transition ease-in duration-300"
         x-transition:leave-start="opacity-100 translate-y-0"
         x-transition:leave-end="opacity-0 translate-y-10"
         class="fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] md:bottom-8 left-0 w-full z-40 pointer-events-none px-4">
        
        <div class="max-w-3xl mx-auto glass-card bg-[var(--color-bg-surface)]/95 backdrop-blur-xl border border-[var(--color-primary)]/30 p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-4 pointer-events-auto relative">
            
            <!-- Close Button -->
            <button @click="show = false; sessionStorage.setItem('hide_rank_banner', 'true')" class="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-black border border-white/20 text-gray-400 hover:text-white flex items-center justify-center shadow-lg active:scale-90 transition">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>

            <a href="profile.php" class="flex items-center gap-4 flex-1">
                <div class="w-12 flex flex-col items-center justify-center border-r border-white/10 pr-4">
                    <span class="text-[10px] uppercase text-gray-500 font-bold">順位</span>
                    <span class="font-brand font-black text-xl italic text-white flex items-center gap-0.5"><span class="text-xs text-gray-500 not-italic align-top">#</span><?php echo $myRank; ?></span>
                </div>
                <div class="flex items-center gap-3">
                    <img src="<?php echo $myRankData['avatar']; ?>" class="w-10 h-10 rounded-full border-2 border-[var(--color-primary)]">
                    <div>
                        <p class="font-bold text-sm text-white">あなた</p>
                        <p class="text-xs text-green-400 font-bold"><?php echo $myRankData['count']; ?> 観察</p>
                    </div>
                </div>
            </a>
            
            <div class="hidden md:block mr-8">
                <p class="text-xs text-gray-400">さらに探索してトップ3を目指そう！</p>
            </div>
            
            <a href="profile.php" class="p-2 rounded-full bg-white/5 hover:bg-white/10 transition">
                <i data-lucide="chevron-right" class="text-gray-400"></i>
            </a>
        </div>
    </div>
    <?php endif; ?>

    <script>
        lucide.createIcons();
    </script>
</body>
</html>
