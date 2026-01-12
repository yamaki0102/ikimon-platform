<?php
// Nav Component
?>
<nav x-data="{ show: true, lastScroll: 0 }" 
     @scroll.window="const current = window.pageYOffset; show = current < lastScroll || current < 50; lastScroll = current"
     x-init="$watch('show', value => $dispatch('header-visibility', value))"
     :class="show ? 'translate-y-0' : '-translate-y-full'"
     class="fixed top-0 left-0 w-full z-50 bg-[var(--color-bg-base)]/90 backdrop-blur-md border-b border-white/5 transition-transform duration-300">
    
    <div class="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
        <!-- Logo -->
        <a href="index.php" class="flex items-center gap-2 group">
            <div class="w-10 h-10 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] rounded-xl flex items-center justify-center text-[#05070a] font-black text-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] group-hover:scale-105 transition duration-500">
                i
            </div>
            <span class="text-2xl font-black tracking-tight font-heading">ikimon</span>
        </a>

        <!-- Center Search (Hidden on Mobile) -->
        <div class="hidden md:block flex-1 max-w-lg mx-8">
            <div class="relative group">
                <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition"></i>
                <input type="text" 
                       placeholder="<?php echo __('nav.search_placeholder'); ?>" 
                       class="w-full bg-white/5 border border-white/5 rounded-full pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:bg-white/10 transition">
            </div>
        </div>

        <!-- Links & CTA -->
        <div class="flex items-center gap-6">
            <a href="explore.php" class="hidden md:flex items-center gap-2 text-sm font-bold text-gray-300 hover:text-white transition">
                <i data-lucide="map" class="w-4 h-4"></i>
                <?php echo __('nav.explore'); ?>
            </a>
            <a href="ranking.php" class="hidden md:flex items-center gap-2 text-sm font-bold text-gray-300 hover:text-white transition">
                <i data-lucide="users" class="w-4 h-4"></i>
                <?php echo __('nav.ranking'); ?>
            </a>
            
            <div class="h-6 w-px bg-white/10 hidden md:block"></div>

            <?php 
            require_once __DIR__ . '/../../libs/Auth.php';
            $currentUser = Auth::user();
            ?>

            <?php if ($currentUser): ?>
            <!-- Notifications -->
            <div class="relative group" x-data="notifications()">
                <button @click="toggle()" class="p-2 text-gray-400 hover:text-white transition relative">
                    <i data-lucide="bell" class="w-5 h-5"></i>
                    <template x-if="unreadCount > 0">
                        <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#05070a]"></span>
                    </template>
                </button>

                <!-- Notifications Dropdown -->
                <div x-show="open" 
                     x-cloak
                     @click.outside="open = false"
                     x-transition:enter="transition ease-out duration-100"
                     x-transition:enter-start="opacity-0 scale-95"
                     x-transition:enter-end="opacity-100 scale-100"
                     class="absolute right-0 top-14 w-80 glass-card rounded-2xl border border-white/10 shadow-2xl z-50 origin-top-right overflow-hidden">
                    
                    <div class="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                        <p class="text-xs font-black uppercase tracking-widest text-gray-300"><?php echo __('nav.notifications'); ?></p>
                        <template x-if="unreadCount > 0">
                            <span class="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold" x-text="unreadCount"></span>
                        </template>
                    </div>

                    <div class="max-h-96 overflow-y-auto">
                        <template x-for="item in list" :key="item.id">
                            <a :href="item.link || '#'" class="block p-4 hover:bg-white/5 border-b border-white/5 last:border-0 transition" :class="item.is_read ? 'opacity-60' : ''">
                                <p class="text-xs font-bold text-[var(--color-primary)] mb-1" x-text="item.title"></p>
                                <p class="text-sm font-bold text-gray-200" x-text="item.message"></p>
                                <p class="text-[10px] text-gray-400 mt-2" x-text="formatTime(item.created_at)"></p>
                            </a>
                        </template>
                        <template x-if="list.length === 0">
                            <div class="p-8 text-center">
                                <p class="text-xs text-gray-300 italic">新しい通知はありません</p>
                            </div>
                        </template>
                    </div>
                </div>
            </div>

            <!-- User Menu -->
            <div class="relative group" x-data="{ open: false }">
                <button @click="open = !open" @click.outside="open = false" class="w-10 h-10 rounded-full overflow-hidden border border-white/10 hover:border-[var(--color-primary)] transition ring-2 ring-transparent hover:ring-[var(--color-primary)]/50 bg-white/5">
                    <img src="<?php echo htmlspecialchars($currentUser['avatar']); ?>" class="w-full h-full object-cover">
                </button>
                
                <!-- Dropdown Menu -->
                <div x-show="open" 
                     x-transition:enter="transition ease-out duration-100"
                     x-transition:enter-start="opacity-0 scale-95"
                     x-transition:enter-end="opacity-100 scale-100"
                     x-transition:leave="transition ease-in duration-75"
                     x-transition:leave-start="opacity-100 scale-100"
                     x-transition:leave-end="opacity-0 scale-95"
                     class="absolute right-0 top-14 w-60 glass-card rounded-2xl border border-white/10 shadow-2xl p-2 z-50 origin-top-right">
                    
                    <div class="px-3 py-3 border-b border-white/10 mb-2">
                        <p class="font-bold truncate"><?php echo htmlspecialchars($currentUser['name']); ?></p>
                    <p class="text-xs text-gray-400 font-bold"><?php echo htmlspecialchars(Auth::getRankLabel($currentUser)); ?></p>
                    </div>

                    <a href="profile.php" class="block px-3 py-2 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/10 transition flex items-center gap-2">
                        <i data-lucide="user" class="w-4 h-4"></i> <?php echo __('nav.profile'); ?>
                    </a>
                    <a href="id_workbench.php" class="block px-3 py-2 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/10 transition flex items-center gap-2">
                        <i data-lucide="microscope" class="w-4 h-4"></i> <?php echo __('nav.id_center'); ?>
                    </a>
                    <a href="guidelines.php" class="block px-3 py-2 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/10 transition flex items-center gap-2">
                        <i data-lucide="book-open" class="w-4 h-4"></i> <?php echo __('nav.guidelines'); ?>
                    </a>
                    
                    <?php if (Auth::hasRole('Analyst')): ?>
                    <a href="admin_dashboard.php" class="block px-3 py-2 rounded-xl text-sm font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition flex items-center gap-2 border border-[var(--color-primary)]/20 my-1">
                        <i data-lucide="shield-alert" class="w-4 h-4"></i> 管理ダッシュボード
                    </a>
                    <?php endif; ?>

                    <a href="logout.php" class="block px-3 py-2 rounded-xl text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition flex items-center gap-2 mt-1 border-t border-white/5">
                        <i data-lucide="log-out" class="w-4 h-4"></i> ログアウト
                    </a>
                </div>
            </div>

            <a href="post.php" class="btn-primary flex items-center gap-2 text-sm">
                <i data-lucide="camera" class="w-4 h-4"></i>
                <span class="hidden md:inline"><?php echo __('nav.post'); ?></span>
            </a>
            <?php else: ?>
            <a href="login.php" class="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-bold transition flex items-center gap-2">
                <i data-lucide="log-in" class="w-4 h-4"></i>
                <?php echo __('nav.login'); ?>
            </a>
            <a href="login.php" class="btn-primary text-sm font-bold">
                <?php echo __('nav.post'); ?>
            </a>
            <?php endif; ?>


            <!-- Language Toggle (Desktop) -->
             <a href="?lang=<?php echo Lang::get('nav.toggle_lang') == 'English' ? 'en' : 'ja'; ?>" class="hidden md:block text-xs font-bold text-gray-300 hover:text-white transition">
                <?php echo __('nav.toggle_lang'); ?>
            </a>
        </div>
    </div>
</nav>

<script>
    function notifications() {
        return {
            open: false,
            unreadCount: 0,
            list: [],
            async init() {
                await this.fetchNotifications();
                // Check every 30 seconds
                setInterval(() => this.fetchNotifications(), 30000);
            },
            async fetchNotifications() {
                try {
                    const res = await fetch('api/get_notifications.php');
                    const result = await res.json();
                    if (result.success) {
                        this.list = result.data;
                        this.unreadCount = result.unread_count;
                    }
                } catch (e) {
                    console.error(e);
                }
            },
            async toggle() {
                this.open = !this.open;
                if (this.open && this.unreadCount > 0) {
                    await this.markAsRead();
                }
            },
            async markAsRead() {
                try {
                    const res = await fetch('api/mark_notifications_read.php');
                    const result = await res.json();
                    if (result.success) {
                        this.unreadCount = 0;
                        this.list.forEach(n => n.is_read = true);
                    }
                } catch (e) {
                    console.error(e);
                }
            },
            formatTime(ts) {
                const date = new Date(ts);
                return date.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
        }
    }
</script>

<!-- Mobile Bottom Nav -->
<div class="md:hidden fixed bottom-0 left-0 w-full bg-[var(--color-bg-base)]/90 backdrop-blur-xl border-t border-white/5 z-50 px-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] flex items-center justify-between">
    <a href="index.php" 
       <?php if (basename($_SERVER['PHP_SELF']) == 'index.php'): ?> @click.prevent="window.scrollTo({top: 0, behavior: 'smooth'})" <?php endif; ?>
       class="flex flex-col items-center gap-1 transition active:scale-95 <?php echo basename($_SERVER['PHP_SELF']) == 'index.php' ? 'text-[var(--color-primary)]' : 'text-gray-300 hover:text-gray-300'; ?>">
        <i data-lucide="home" class="w-6 h-6"></i>
        <span class="text-[10px] font-bold uppercase tracking-tight"><?php echo __('nav.home'); ?></span>
    </a>
    <a href="explore.php" 
       <?php if (basename($_SERVER['PHP_SELF']) == 'explore.php'): ?> @click.prevent="window.scrollTo({top: 0, behavior: 'smooth'})" <?php endif; ?>
       class="flex flex-col items-center gap-1 transition active:scale-95 <?php echo basename($_SERVER['PHP_SELF']) == 'explore.php' ? 'text-[var(--color-primary)]' : 'text-gray-300 hover:text-gray-300'; ?>">
        <i data-lucide="map" class="w-6 h-6"></i>
        <span class="text-[10px] font-bold uppercase tracking-tight"><?php echo __('nav.explore'); ?></span>
    </a>
    
    <!-- Center Action Button -->
    <a href="post.php" class="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] text-[#05070a] shadow-[0_0_20px_rgba(16,185,129,0.4)] -mt-8 border-4 border-[#05070a] transition active:scale-90 active:rotate-90">
        <i data-lucide="plus" class="w-8 h-8"></i>
    </a>

    <a href="ranking.php" 
       <?php if (basename($_SERVER['PHP_SELF']) == 'ranking.php'): ?> @click.prevent="window.scrollTo({top: 0, behavior: 'smooth'})" <?php endif; ?>
       class="flex flex-col items-center gap-1 transition active:scale-95 <?php echo basename($_SERVER['PHP_SELF']) == 'ranking.php' ? 'text-[var(--color-primary)]' : 'text-gray-300 hover:text-gray-300'; ?>">
        <i data-lucide="trophy" class="w-6 h-6"></i>
        <span class="text-[10px] font-bold uppercase tracking-tight"><?php echo __('nav.ranking'); ?></span>
    </a>
    <a href="profile.php" 
       <?php if (basename($_SERVER['PHP_SELF']) == 'profile.php'): ?> @click.prevent="window.scrollTo({top: 0, behavior: 'smooth'})" <?php endif; ?>
       class="flex flex-col items-center gap-1 transition active:scale-95 <?php echo basename($_SERVER['PHP_SELF']) == 'profile.php' ? 'text-[var(--color-primary)]' : 'text-gray-300 hover:text-gray-300'; ?>">
        <i data-lucide="user" class="w-6 h-6"></i>
        <span class="text-[10px] font-bold uppercase tracking-tight"><?php echo __('nav.profile'); ?></span>
    </a>
</div>
