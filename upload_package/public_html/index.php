<?php
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/QuestManager.php';
require_once __DIR__ . '/../libs/BioUtils.php';

Auth::init();
$currentUser = Auth::user();

// Fetch Data for Feed with Filters
$filter = $_GET['filter'] ?? 'all';
$latest_obs = DataStore::getLatest('observations', 20, function($item) use ($filter, $currentUser) {
    if ($filter === 'unidentified') {
        // Condition: No taxon ID or "unknown" name
        return empty($item['taxon']['id']);
    }
    if ($filter === 'mine') {
        return isset($item['user_id']) && isset($currentUser['id']) && $item['user_id'] === $currentUser['id'];
    }
    return true;
}); 

$dailyQuests = QuestManager::getActiveQuests();
$dailyQuest = $dailyQuests[0] ?? null;

// Calculate Total Reach (Impact)
$total_reach = 0;
if ($currentUser) {
    // This could be expensive. In V4, cache this in user profile or daily aggregate.
    // For MVP, we iterate recent posts or simplified index.
    // Let's use DataStore::getLatest filtered by mine to get a sample, or we need a real user index.
    // Hack: Just get filtered 'mine' observations up to 100 for now to calc reach
    $my_posts = DataStore::getLatest('observations', 100, function($item) use ($currentUser) {
        return isset($item['user_id']) && $item['user_id'] === $currentUser['id'];
    });
    
    foreach ($my_posts as $post) {
        $counts = DataStore::getCounts('observations', $post['id']);
        $total_reach += ($counts['views'] ?? 0);
    }
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
        <?php include __DIR__ . '/components/meta.php'; ?>
    <style>
        /* Hidden Scrollbar for Stories */
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
    </style>
</head>
<body class="js-loading pb-24 md:pb-0 bg-[var(--color-bg-base)] text-[var(--color-text)] font-body" x-data="pullToRefresh()">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script>document.body.classList.remove('js-loading');</script>

    <!-- PTR Indicator -->
    <div class="fixed top-24 left-0 w-full flex justify-center pointer-events-none z-30 transition-transform duration-200"
         :style="`opacity: ${pullY > 0 ? Math.min(pullY / 50, 1) : 0}; transform: translateY(${pullY * 0.5}px)`"
         x-cloak>
         <div class="bg-black/50 backdrop-blur-xl rounded-full p-3 border border-white/10 shadow-2xl flex items-center justify-center">
             <i data-lucide="loader-2" class="w-6 h-6 text-[var(--color-primary)] transition-transform" 
                :class="refreshing ? 'animate-spin' : ''"
                :style="`transform: rotate(${pullY * 3}deg)`"></i>
         </div>
    </div>

    <!-- App Container (Responsive) -->
    <div class="w-full max-w-7xl mx-auto min-h-screen relative bg-[var(--color-bg-base)] transition-transform duration-200 ease-out lg:grid lg:grid-cols-12 lg:gap-8 lg:px-6 pt-20"
         @touchstart="start($event)" 
         @touchmove="move($event)" 
         @touchend="end()"
         :style="`transform: translateY(${pullY}px)`">
        
        <!-- PC Left Sidebar (Nav Placeholder or Extra Menu) -->
        <div class="hidden lg:block lg:col-span-3 sticky top-20 h-fit space-y-6">
             <div class="p-6 rounded-3xl glass-card">
                 <h3 class="font-bold text-gray-400 uppercase tracking-widest text-xs mb-4">Quick Links</h3>
                 <ul class="space-y-3">
                     <li><a href="profile.php" class="flex items-center gap-3 text-sm font-bold text-white hover:text-[var(--color-primary)] transition"><i data-lucide="user" class="w-5 h-5"></i> 繝励Ο繝輔ぅ繝ｼ繝ｫ</a></li>
                     <li><a href="id_workbench.php" class="flex items-center gap-3 text-sm font-bold text-white hover:text-[var(--color-primary)] transition"><i data-lucide="search-check" class="w-5 h-5"></i> 蜷悟ｮ壹そ繝ｳ繧ｿ繝ｼ</a></li>
                     <li><a href="ranking.php" class="flex items-center gap-3 text-sm font-bold text-white hover:text-[var(--color-primary)] transition"><i data-lucide="trophy" class="w-5 h-5"></i> 繝ｩ繝ｳ繧ｭ繝ｳ繧ｰ</a></li>
                 </ul>
             </div>
             <!-- Login Promo for Guest -->
             <?php if (!$currentUser): ?>
             <div class="p-6 rounded-3xl bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-secondary)]/20 border border-[var(--color-primary)]/30">
                 <h3 class="font-black text-lg mb-2 text-white">Join ikimon</h3>
                 <p class="text-xs text-gray-300 mb-4">Explore, Identify, and Contribute to nature.</p>
                 <a href="login.php" class="btn-primary w-full justify-center text-sm">Login / Signup</a>
             </div>
             <?php endif; ?>
        </div>
        
        <!-- Main Feed Column -->
        <div class="w-full md:max-w-xl md:mx-auto lg:col-span-6 lg:mx-0">
        
        <!-- Header Spacer (Nav is fixed) -->
        <!-- Header Spacer (Nav is fixed) - Handled by Container Padding now -->
        <!-- <div class="h-14"></div> -->

        <!-- Filter Tabs (Sticky) -->
        <div x-data="{ headerVisible: true }"
             @header-visibility.window="headerVisible = $event.detail"
             class="sticky z-40 bg-[var(--color-bg-base)]/95 backdrop-blur-md border-b border-white/5 mb-4 transition-[top] duration-300 ease-out"
             :class="headerVisible ? 'top-14' : 'top-0'">
            <div class="flex items-center px-4 overflow-x-auto scrollbar-hide">
                <a href="?filter=all" class="flex-shrink-0 px-4 py-3 text-sm font-bold border-b-2 transition <?php echo $filter === 'all' ? 'border-[var(--color-primary)] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'; ?>">
                    <?php echo __('nav.ranking'); // 'All' translates to 'Everyone/Community' contextually or add specific key ?>
                </a>
                <a href="id_workbench.php" class="flex-shrink-0 px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 <?php echo basename($_SERVER['PHP_SELF']) === 'id_workbench.php' ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-500 hover:text-orange-400/70'; ?>">
                    <i data-lucide="search-check" class="w-4 h-4"></i>
                    <?php echo __('nav.id_center'); ?>
                </a>
                <?php if ($currentUser): ?>
                <a href="?filter=mine" class="flex-shrink-0 px-4 py-3 text-sm font-bold border-b-2 transition <?php echo $filter === 'mine' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-blue-400/70'; ?>">
                    <?php echo __('nav.profile'); ?>
                </a>
                <?php endif; ?>
            </div>
        </div>

        <!-- Quest / Notifications Banner (Stories Style) -->
        <?php if ($filter === 'all'): ?>
        <section class="mb-6 px-4 overflow-x-auto scrollbar-hide flex gap-3 snap-x">
            <?php if ($dailyQuest): ?>
            <!-- Daily Mission Card -->
            <a href="post.php?quest=<?php echo $dailyQuest['id']; ?>" class="snap-start shrink-0 w-64 p-4 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/30 flex items-center gap-3 relative group overflow-hidden active:scale-95 transition-transform">
                <div class="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-black font-black shadow-lg">
                    <i data-lucide="<?php echo $dailyQuest['icon']; ?>" class="w-5 h-5"></i>
                </div>
                <div>
                    <p class="text-[10px] font-black text-yellow-500 uppercase tracking-widest"><?php echo __('home.daily_mission'); ?></p>
                    <p class="text-xs font-bold text-white"><?php echo $dailyQuest['description']; ?></p>
                </div>
                <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition"></div>
            </a>
            <?php endif; ?>

            <!-- Activity Ticker (Converted to Static Cards) -->
            <div class="snap-start shrink-0 w-64 p-4 rounded-2xl glass-card flex items-center gap-3 active:scale-95 transition-transform">
                <div class="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <i data-lucide="activity" class="w-5 h-5"></i>
                </div>
                <div>
                    <p class="text-[10px] font-black text-blue-400 uppercase tracking-widest"><?php echo __('home.activity'); ?></p>
                    <p class="text-xs text-gray-400">縲・・＆繧薙′繝偵ぎ繝ｳ繝舌リ繧堤匱隕具ｼ・/p>
                </div>
            </div>
        </section>
        <?php endif; ?>

        <!-- Main Feed Phase -->
        <main class="px-0 pb-12">
            
            <?php
            // Detroit Status Logic
            $score = $currentUser['score'] ?? 0;
            $d_rank = match(true) {
                $score >= 1000 => 'LEGENDARY',
                $score >= 500 => 'EXPERT',
                $score >= 100 => 'VETERAN',
                $score >= 1000 => __('rank.legendary'),
                $score >= 500 => __('rank.expert'),
                $score >= 100 => __('rank.veteran'),
                default => __('rank.rookie')
            };
            
            // Impact is now based on Total Reach (Views), not just score
            $d_impact = match(true) {
                $total_reach >= 1000 => __('rank.legend'),
                $total_reach >= 500 => __('rank.influencer'),
                $total_reach >= 100 => __('rank.rising_star'),
                default => __('rank.observer')
            };
            ?>

            <!-- Status HUD (Detroit Style) -->
            <div class="px-6 mb-6 flex items-start justify-between animate-fade-in-up">
                <div class="space-y-1">
                    <p class="text-[10px] font-bold text-blue-400 tracking-[0.2em] uppercase opacity-80"><?php echo __('home.community_standing'); ?></p>
                    <div class="flex items-center gap-2">
                        <h2 class="text-3xl font-black text-white tracking-tight italic" style="text-shadow: 0 0 20px rgba(59,130,246,0.5);"><?php echo $d_rank; ?></h2>
                        <div class="flex flex-col items-center">
                            <span class="text-[8px] font-bold text-blue-500 leading-none">笆ｲ</span>
                            <span class="bg-blue-500/20 border border-blue-500/50 text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded leading-none backdrop-blur-md">LV.<?php echo floor($score / 10); ?></span>
                        </div>
                    </div>
                </div>
                <div class="text-right space-y-1">
                    <p class="text-[10px] font-bold text-gray-500 tracking-[0.2em] uppercase"><?php echo __('home.impact_factor'); ?></p>
                    <p class="text-xl font-bold text-white font-mono flex items-center justify-end gap-1">
                        <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        <?php echo $d_impact; ?>
                    </p>
                </div>
            </div>

            <div class="px-6 mb-10">
                <div class="flex items-center justify-between mb-2">
                     <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest"><?php echo __('home.trust_signal'); ?></span>
                     <span class="text-[10px] font-bold text-blue-400"><?php echo __('home.stable'); ?></span>
                </div>
                <div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                     <div class="h-full bg-blue-500 w-[85%] shadow-[0_0_15px_#3b82f6] relative">
                         <div class="absolute right-0 top-0 bottom-0 w-1 bg-white/50 animate-pulse"></div>
                     </div>
                </div>
            </div>
            
            <!-- Notifications / Insights Carousel (New Home for Stats) -->
            <?php if ($total_reach >= 10): ?>
            <div class="mb-8 px-6 overflow-x-auto scrollbar-hide flex gap-3 snap-x">
                 <!-- Milestone Card (Only appears if significant) -->
                 <div class="snap-start shrink-0 w-72 p-5 rounded-2xl bg-gradient-to-br from-indigo-900/40 to-blue-900/20 border border-indigo-500/30 relative overflow-hidden group">
                     <div class="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl group-hover:bg-blue-500/30 transition"></div>
                     
                     <div class="flex items-start gap-3 relative z-10">
                         <div class="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shrink-0">
                             <i data-lucide="bar-chart-2" class="w-5 h-5"></i>
                         </div>
                         <div>
                             <p class="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-1"><?php echo __('home.report'); ?></p>
                             <h4 class="font-bold text-white leading-tight mb-2">
                                 <?php if ($total_reach >= 1000): ?>
                                 Wow! 縺ゅ↑縺溘・謚慕ｨｿ縺ｯ蟒ｶ縺ｹ<br><span class="text-2xl text-yellow-400 font-black"><?php echo number_format($total_reach); ?>蝗・/span> 隕九ｉ繧後∪縺励◆・・
                                 <?php elseif ($total_reach >= 100): ?>
                                 縺吶＃縺・ｼ・br>蜷郁ｨ・<span class="text-lg text-indigo-200 font-bold"><?php echo number_format($total_reach); ?>蝗・/span> 髢ｲ隕ｧ縺輔ｌ縺ｦ縺・∪縺吶・
                                 <?php else: ?>
                                 鬆・ｪｿ縺ｧ縺呻ｼ・br>蜷郁ｨ・<?php echo number_format($total_reach); ?>蝗・髢ｲ隕ｧ縺輔ｌ縺ｦ縺・∪縺吶・
                                 <?php endif; ?>
                             </h4>
                             <p class="text-[10px] text-gray-400">縺ゅ↑縺溘・逋ｺ隕九′縲∬ｪｰ縺九・遏･隴倥↓縺ｪ縺｣縺ｦ縺・∪縺吶・/p>
                         </div>
                     </div>
                 </div>
            </div>
            <?php endif; ?>

            <!-- Feed Header & Filter -->
            <div class="px-6 mb-4 flex items-end justify-between">
                <div>
                     <h2 class="text-3xl font-black italic tracking-tighter text-white/90">
                        <?php echo __('home.timeline'); ?>
                    </h2>
                    <span class="text-xs font-bold text-gray-500"><?php echo count($latest_obs); ?> <?php echo __('home.updates_suffix'); ?></span>
                </div>
            </div>

            <!-- Feed Items -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 md:px-0">
                <?php foreach ($latest_obs as $obs): ?>
                        <article x-data="{ 
                            liked: false, 
                            count: 12, 
                            scale: 1, 
                            lastTap: 0,
                            
                            like(e) { 
                                // Toggle State
                                this.liked = !this.liked; 
                                this.count += this.liked ? 1 : -1; 
                                
                                // Tezawari Feedback
                                if (this.liked) {
                                    if (window.SoundManager) SoundManager.play('pop');
                                    if (window.HapticEngine) HapticEngine.medium();
                                    if (window.MotionEngine && e) MotionEngine.explode(e.clientX, e.clientY);
                                } else {
                                    if (window.SoundManager) SoundManager.play('light-click');
                                    if (window.HapticEngine) HapticEngine.tick();
                                }
                                
                                // Animation
                                this.scale = 1.2; 
                                setTimeout(() => this.scale = 1, 200); 
                            },
                            
                            doubleTap(e) {
                                const now = Date.now();
                                if (now - this.lastTap < 300) {
                                    // Double Tap Detected
                                    if (!this.liked) {
                                        this.like(e); 
                                    } else {
                                        // Just animate heart if already liked
                                        this.scale = 1.3;
                                        if (window.SoundManager) SoundManager.play('pop');
                                        if (window.HapticEngine) HapticEngine.light();
                                        if (window.MotionEngine && e) MotionEngine.explode(e.clientX, e.clientY);
                                        setTimeout(() => this.scale = 1, 200); 
                                    }
                                }
                                this.lastTap = now;
                            }
                         }" 
                         class="bg-[var(--color-bg-base)] border border-white/5 rounded-3xl overflow-hidden relative break-inside-avoid">
                    <!-- Feed Header -->
                    <div class="px-4 py-3 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
                                <?php if (!empty($obs['user_avatar'])): ?>
                                <img src="<?php echo htmlspecialchars($obs['user_avatar']); ?>" class="w-full h-full object-cover" loading="lazy">
                                <?php endif; ?>
                            </div>
                            <div>
                                 <p class="text-sm font-bold leading-none"><?php echo __('home.user_prefix'); ?> <?php echo htmlspecialchars($obs['user_name'] ?? substr($obs['user_id'], 0, 4)); ?></p>
                                <p class="text-[10px] text-gray-500"><?php echo BioUtils::timeAgo($obs['observed_at']); ?> ・ <?php echo htmlspecialchars($obs['location']['name'] ?? '場所不明'); ?></p>
                            </div>
                        </div>
                        <button class="p-2 text-gray-500 hover:text-white transition rounded-full active:bg-white/10">
                            <i data-lucide="more-horizontal" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <!-- Photo (Full Width) -->
                    <div class="aspect-square w-full bg-black/50 relative group select-none"
                         @click="doubleTap($event)">
                        <img src="<?php echo $obs['photos'][0]; ?>" class="w-full h-full object-cover pointer-events-none" loading="lazy">
                        
                        <!-- Heart Animation Overlay -->
                        <div x-show="scale > 1" 
                             x-transition:enter="transition ease-out duration-200" 
                             x-transition:enter-start="opacity-0 scale-0" 
                             x-transition:enter-end="opacity-100 scale-150" 
                             x-transition:leave="transition ease-in duration-200" 
                             x-transition:leave-start="opacity-100 scale-150" 
                             x-transition:leave-end="opacity-0 scale-0" 
                             class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <i data-lucide="heart" class="w-32 h-32 text-white fill-white drop-shadow-2xl opacity-90"></i>
                        </div>
                        
                        <?php if (isset($obs['taxon']['id'])): ?>
                        <!-- Identification Overlay -->
                        <div class="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md flex items-center gap-2 border border-white/10">
                            <i data-lucide="check-circle-2" class="w-3 h-3 text-green-400"></i>
                            <span class="text-xs font-bold text-white"><?php echo htmlspecialchars($obs['taxon']['name']); ?></span>
                        </div>
                        <?php else: ?>
                        <div class="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md flex items-center gap-2 border border-white/10 border-orange-500/50">
                            <i data-lucide="help-circle" class="w-3 h-3 text-orange-400"></i>
                            <span class="text-xs font-bold text-orange-100"><?php echo __('home.identifying'); ?></span>
                        </div>
                        <?php endif; ?>
                    </div>

                    <!-- Actions -->
                    <div class="px-4 py-3 pb-0 flex items-center gap-4">
                        <button @click="like($event)" class="flex items-center gap-1.5 group active:scale-90 transition-transform">
                            <i data-lucide="heart" class="w-6 h-6 transition duration-300" :class="liked ? 'text-amber-400 fill-amber-400' : 'text-white group-hover:text-amber-400'"></i>
                            <span class="text-xs font-bold" x-text="count"></span>
                        </button>
                        <button class="flex items-center gap-1.5 group active:scale-90 transition-transform">
                            <i data-lucide="message-circle" class="w-6 h-6 text-white group-hover:text-blue-500 transition"></i>
                            <span class="text-xs font-bold">4</span>
                        </button>
                        <div class="flex-1"></div>
                        <a href="id_form.php?id=<?php echo $obs['id']; ?>" class="btn-secondary !py-1.5 !px-4 !text-xs !rounded-lg whitespace-nowrap">
                            <i data-lucide="search"></i>
                            隧ｳ邏ｰ繝ｻ蜷悟ｮ壹☆繧・
                        </a>
                    </div>
                    
                    <!-- Caption -->
                    <div class="px-4 py-3">
                         <p class="text-sm text-gray-300 line-clamp-2">
                              <span class="font-bold text-white"><?php echo __('home.user_prefix'); ?> <?php echo htmlspecialchars($obs['user_name'] ?? substr($obs['user_id'], 0, 4)); ?></span>
                             <?php echo htmlspecialchars($obs['note'] ?? '隕ｳ蟇溘＠縺ｾ縺励◆・・); ?>
                         </p>
                    </div>

                </article>
                <?php endforeach; ?>
            </div>
            
            <!-- End of Feed -->
            <div class="py-12 text-center text-gray-500 text-xs">
                <p><?php echo __('home.all_seen'); ?></p>
                <i data-lucide="check" class="w-4 h-4 mx-auto mt-2 opacity-50"></i>
            </div>
        </main>
        
        <!-- Footer -->
        <?php include __DIR__ . '/components/footer.php'; ?>
        </div> <!-- End Main Feed Column -->

        <!-- PC Right Sidebar (Widgets) -->
        <div class="hidden lg:block lg:col-span-3 sticky top-20 h-fit space-y-6">
             <!-- Daily Stats Mockup -->
             <div class="p-6 rounded-3xl glass-card">
                 <h3 class="font-bold text-gray-400 uppercase tracking-widest text-xs mb-4">System Status</h3>
                 <div class="flex items-center justify-between mb-2">
                     <span class="text-sm font-bold">New Species</span>
                     <span class="text-sm font-mono">+12</span>
                 </div>
                 <div class="flex items-center justify-between">
                     <span class="text-sm font-bold">Active Users</span>
                     <span class="text-sm font-mono">1,240</span>
                 </div>
             </div>
             
             <!-- Footer Links -->
             <div class="flex flex-wrap gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest px-2">
                 <a href="#" class="hover:text-white transition">About</a>
                 <span>窶｢</span>
                 <a href="#" class="hover:text-white transition">Privacy</a>
                 <span>窶｢</span>
                 <a href="#" class="hover:text-white transition">Terms</a>
                 <p class="w-full mt-2">ﾂｩ 2026 ikimon Project</p>
             </div>
        </div>

    </div> <!-- End App Container -->

    <!-- Onboarding Modal Removed based on user feedback (Too intrusive) -->
    <?php // include('components/onboarding_modal.php'); ?>

    <script>
        function pullToRefresh() {
            return {
                pullY: 0,
                StartY: 0,
                refreshing: false,
                crossedThreshold: false,
                
                start(e) {
                    if (window.scrollY > 0) return;
                    this.startY = e.touches[0].clientY;
                },
                
                move(e) {
                    if (window.scrollY > 0 || !this.startY) return;
                    const y = e.touches[0].clientY;
                    const diff = y - this.startY;
                    if (diff > 0) {
                        this.pullY = Math.pow(diff, 0.8); // Resistance
                        if (e.cancelable) e.preventDefault(); // Prevent native scroll
                        
                        // Haptic feedback on threshold cross (once)
                        if (this.pullY > 100 && !this.crossedThreshold) {
                            if (window.HapticEngine) HapticEngine.medium();
                            this.crossedThreshold = true;
                        } else if (this.pullY < 100) {
                            this.crossedThreshold = false;
                        }
                    }
                },
                
                end() {
                    if (!this.startY) return;
                    if (this.pullY > 100) {
                        this.refreshing = true;
                        this.pullY = 60; // Snap to loading position
                        if (window.SoundManager) SoundManager.play('success');
                        setTimeout(() => {
                            window.location.reload();
                        }, 800);
                    } else {
                        this.pullY = 0;
                        this.refreshing = false;
                    }
                    this.startY = 0;
                }
            }
        }

        lucide.createIcons();
        
        // Auto-Sync Offline Data
        document.addEventListener('DOMContentLoaded', () => {
             if (window.offlineManager && navigator.onLine) {
                 window.offlineManager.sync();
             }
             window.addEventListener('online', () => {
                 window.offlineManager.sync();
             });
        });
    </script>
    <script src="js/ToastManager.js"></script>
    <script>
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('SW Registered!', reg))
                .catch(err => console.error('SW Failed', err));
        }
    </script>
</body>
</html>


