<?php
// Nav Component — Design System v2 (tokens.css v2 unified)
?>
<nav x-data="{ show: true, lastScroll: 0 }"
    @scroll.window="const current = window.pageYOffset; show = current < lastScroll || current < 50; lastScroll = current"
    x-init="$watch('show', value => $dispatch('header-visibility', value))"
    :class="show ? 'translate-y-0' : '-translate-y-full'"
    class="fixed top-0 left-0 w-full z-50 glass-nav transition-transform duration-300 pt-[var(--safe-top)]">

    <div class="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-[var(--nav-height)]">
        <!-- Logo -->
        <a href="index.php" class="flex items-center gap-2 group">
            <img src="assets/img/icon-192.png" alt="ikimon" class="w-10 h-10 rounded-md shadow-md group-hover:scale-105 transition duration-500">
            <span class="text-lg font-black tracking-tight font-heading text-text">ikimon</span>
        </a>

        <!-- Center Search (Desktop only) -->
        <div class="hidden md:block flex-1 max-w-lg mx-8" x-data="globalSearch()" @click.outside="showResults = false">
            <div class="relative group">
                <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-faint"></i>
                <input type="text"
                    x-model="q"
                    @input.debounce.300ms="search()"
                    @focus="if(results.length) showResults = true"
                    @keydown.enter="goFirst()"
                    @keydown.escape="showResults = false"
                    placeholder="<?php echo __('nav.search_placeholder'); ?>"
                    class="w-full rounded-full pl-12 pr-4 py-2.5 text-sm transition bg-surface border border-border-strong text-text">

                <!-- Search Results Dropdown -->
                <div x-show="showResults && results.length > 0"
                    x-transition
                    x-cloak
                    class="absolute top-full left-0 right-0 mt-2 bg-elevated rounded-xl border border-border-strong shadow-xl overflow-hidden max-h-80 overflow-y-auto z-50">
                    <template x-for="r in results" :key="r.name + r.type">
                        <button @click="goTo(r)" class="w-full text-left px-4 py-3 hover:bg-surface border-b border-border last:border-0 transition flex items-start gap-3">
                            <span class="text-base mt-0.5 flex-shrink-0" x-text="r.icon || '🔍'"></span>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-bold text-text truncate" x-text="r.name || r.common_name"></p>
                                <p class="text-xs text-muted truncate" x-text="searchLabel(r)"></p>
                            </div>
                            <span class="text-token-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface text-faint flex-shrink-0"
                                x-text="r.type === 'taxon' ? '種名' : (r.type === 'site' ? 'サイト' : '場所')"></span>
                        </button>
                    </template>
                </div>
            </div>
        </div>

        <!-- Links & CTA -->
        <div class="flex items-center gap-4 md:gap-6">
            <!-- Discover Dropdown -->
            <div class="hidden md:block relative group hover-show-dropdown">
                <button class="flex items-center gap-1 text-sm font-bold transition text-muted hover:text-primary py-2">
                    <i data-lucide="compass" class="w-4 h-4"></i>
                    <?php echo __('nav.explore'); ?> <i data-lucide="chevron-down" class="w-3 h-3 opacity-60"></i>
                </button>
                <div class="absolute left-0 top-full -mt-2 w-48 z-50 origin-top-left bg-elevated rounded-xl border border-border-strong shadow-lg py-2 opacity-0 invisible scale-95 transition-all duration-200 group-hover:opacity-100 group-hover:visible group-hover:scale-100 group-hover:translate-y-2">
                    <a href="explore.php" class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-muted hover:bg-surface hover:text-text transition"><i data-lucide="search" class="w-4 h-4 text-faint"></i> すべて探す</a>
                    <a href="map.php" class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-muted hover:bg-surface hover:text-text transition"><i data-lucide="map" class="w-4 h-4 text-faint"></i> フィールドマップ</a>
                    <a href="zukan.php" class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-muted hover:bg-surface hover:text-text transition"><i data-lucide="book-open" class="w-4 h-4 text-faint"></i> いきもの図鑑</a>
                    <a href="compass.php" class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-muted hover:bg-surface hover:text-text transition"><i data-lucide="globe" class="w-4 h-4 text-faint"></i> ランキング</a>
                </div>
            </div>

            <!-- Community Dropdown -->
            <div class="hidden md:block relative group hover-show-dropdown">
                <button class="flex items-center gap-1 text-sm font-bold transition text-muted hover:text-accent py-2">
                    <i data-lucide="users" class="w-4 h-4"></i>
                    共創する <i data-lucide="chevron-down" class="w-3 h-3 opacity-60"></i>
                </button>
                <div class="absolute left-0 top-full -mt-2 w-52 z-50 origin-top-left bg-elevated rounded-xl border border-border-strong shadow-lg py-2 opacity-0 invisible scale-95 transition-all duration-200 group-hover:opacity-100 group-hover:visible group-hover:scale-100 group-hover:translate-y-2">
                    <a href="needs_id.php" class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-muted hover:bg-surface hover:text-accent transition"><i data-lucide="sparkles" class="w-4 h-4 text-faint"></i> The Missing Matrix</a>
                    <a href="id_workbench.php" class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-muted hover:bg-surface hover:text-text transition"><i data-lucide="microscope" class="w-4 h-4 text-faint"></i> IDセンター (同定)</a>
                    <a href="site_dashboard.php" class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-muted hover:bg-surface hover:text-text transition"><i data-lucide="shield-check" class="w-4 h-4 text-faint"></i> 共生サイト</a>
                    <a href="events.php" class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-muted hover:bg-surface hover:text-text transition"><i data-lucide="calendar" class="w-4 h-4 text-faint"></i> イベント</a>
                    <a href="survey.php" class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-muted hover:bg-surface hover:text-text transition"><i data-lucide="clipboard-list" class="w-4 h-4 text-faint"></i> 調査に参加</a>
                </div>
            </div>

            <div class="h-6 w-px hidden md:block bg-border-strong"></div>

            <?php
            require_once __DIR__ . '/../../libs/Auth.php';
            $currentUser = Auth::user();
            ?>

            <?php if ($currentUser): ?>
                <!-- Notifications -->
                <div class="relative" x-data="notifications()">
                    <button @click="toggle()" class="relative p-2 transition text-muted hover:text-text" aria-label="通知">
                        <i data-lucide="bell" class="w-5 h-5"></i>
                        <template x-if="unreadCount > 0">
                            <span class="absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-white bg-[var(--color-orange)]"></span>
                        </template>
                    </button>

                    <!-- Notifications Dropdown -->
                    <div x-show="open"
                        x-cloak
                        @click.outside="open = false"
                        x-transition:enter="transition ease-out duration-100"
                        x-transition:enter-start="opacity-0 scale-95"
                        x-transition:enter-end="opacity-100 scale-100"
                        class="absolute right-0 top-14 w-80 z-50 origin-top-right overflow-hidden bg-elevated rounded-lg border border-border-strong shadow-lg">

                        <div class="px-4 py-3 flex items-center justify-between border-b border-border">
                            <p class="text-xs font-black uppercase tracking-widest text-muted"><?php echo __('nav.notifications'); ?></p>
                            <div class="flex items-center gap-2">
                                <template x-if="unreadCount > 0">
                                    <span class="badge badge-green text-token-xs" x-text="unreadCount"></span>
                                </template>
                                <template x-if="unreadCount > 0">
                                    <button @click="markAsRead()" class="text-token-xs font-bold transition text-primary hover:underline">すべて既読</button>
                                </template>
                            </div>
                        </div>

                        <div class="max-h-96 overflow-y-auto">
                            <template x-for="item in list" :key="item.id">
                                <a :href="item.link || '#'" @click="markItemRead(item)" class="block p-4 transition hover:bg-surface border-b border-border" :class="item.is_read ? 'opacity-60' : ''">
                                    <div class="flex items-start gap-3">
                                        <span class="text-lg flex-shrink-0" x-text="getTypeIcon(item.type)"></span>
                                        <div class="flex-1 min-w-0">
                                            <p class="text-xs font-bold mb-1 text-primary" x-text="item.title"></p>
                                            <p class="text-sm font-bold truncate text-secondary" x-text="item.message"></p>
                                            <p class="text-token-xs mt-1 text-faint" x-text="formatTime(item.created_at)"></p>
                                        </div>
                                        <template x-if="!item.is_read">
                                            <span class="w-2 h-2 rounded-full flex-shrink-0 mt-1 animate-pulse text-primary bg-primary"></span>
                                        </template>
                                    </div>
                                </a>
                            </template>
                            <template x-if="list.length === 0">
                                <div class="p-8 text-center">
                                    <div class="text-3xl mb-2">🔔</div>
                                    <p class="text-xs font-bold text-faint">まだ通知はないよ</p>
                                    <p class="text-token-xs mt-1 text-faint">記録や同定すると、ここに届くよ！</p>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>

                <!-- User Menu -->
                <div class="relative hidden md:block" x-data="{ open: false }">
                    <button @click="open = !open" @click.outside="open = false"
                        class="w-9 h-9 rounded-full overflow-hidden border-2 transition border-border-strong hover:border-primary"
                        aria-label="ユーザーメニュー">
                        <img src="<?php echo htmlspecialchars($currentUser['avatar']); ?>" class="w-full h-full object-cover" alt="ユーザーアバター">
                    </button>

                    <!-- Dropdown Menu -->
                    <div x-show="open"
                        x-cloak
                        x-transition:enter="transition ease-out duration-100"
                        x-transition:enter-start="opacity-0 scale-95"
                        x-transition:enter-end="opacity-100 scale-100"
                        x-transition:leave="transition ease-in duration-75"
                        x-transition:leave-start="opacity-100 scale-100"
                        x-transition:leave-end="opacity-0 scale-95"
                        class="absolute right-0 top-14 w-60 p-2 z-50 origin-top-right bg-elevated rounded-lg border border-border-strong shadow-lg">

                        <div class="px-3 py-3 mb-2 border-b border-border">
                            <p class="font-bold truncate text-text"><?php echo htmlspecialchars($currentUser['name']); ?></p>
                            <p class="text-xs font-bold text-muted"><?php echo htmlspecialchars(Auth::getRankLabel($currentUser)); ?></p>
                        </div>

                        <!-- 個人セクション -->
                        <a href="profile.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-muted hover:bg-surface hover:text-text">
                            <i data-lucide="user" class="w-4 h-4"></i> <?php echo __('nav.profile'); ?>
                        </a>
                        <a href="id_workbench.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-muted hover:bg-surface hover:text-text md:hidden">
                            <i data-lucide="microscope" class="w-4 h-4"></i> <?php echo __('nav.id_center'); ?>
                        </a>

                        <!-- 探索セクション (Mobile Only) -->
                        <div class="border-t border-border mt-1 pt-1 md:hidden">
                            <p class="px-3 py-1.5 text-token-xs font-black uppercase tracking-widest text-faint">探す・共創する</p>
                            <a href="zukan.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-muted hover:bg-surface hover:text-text">
                                <i data-lucide="book-open" class="w-4 h-4"></i> <?php echo __('nav.zukan'); ?>
                            </a>
                            <a href="compass.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-muted hover:bg-surface hover:text-text">
                                <i data-lucide="globe" class="w-4 h-4"></i> <?php echo __('nav.ranking'); ?>
                            </a>
                            <a href="events.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-muted hover:bg-surface hover:text-text">
                                <i data-lucide="calendar" class="w-4 h-4"></i> <?php echo __('nav.events'); ?>
                            </a>
                            <a href="ikimon_walk.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-muted hover:bg-surface hover:text-text">
                                <i data-lucide="footprints" class="w-4 h-4"></i> <?php echo __('nav.my_field'); ?>
                            </a>
                            <a href="survey.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-muted hover:bg-surface hover:text-text">
                                <i data-lucide="microscope" class="w-4 h-4"></i> 🔬 調査
                            </a>
                        </div>

                        <!-- 管理セクション -->
                        <div class="border-t border-border mt-1 pt-1">
                            <a href="site_dashboard.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-muted hover:bg-surface hover:text-text md:hidden">
                                <i data-lucide="shield-check" class="w-4 h-4"></i> <?php echo __('nav.site_dashboard'); ?>
                            </a>
                            <?php if (Auth::hasRole('Analyst')): ?>
                                <a href="admin/index.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-primary hover:bg-primary-surface">
                                    <i data-lucide="shield-alert" class="w-4 h-4"></i> <?php echo __('nav.admin'); ?>
                                </a>
                            <?php endif; ?>
                        </div>

                        <!-- その他 -->
                        <div class="border-t border-border mt-1 pt-1">
                            <a href="guidelines.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-muted hover:bg-surface hover:text-text">
                                <i data-lucide="book-open" class="w-4 h-4"></i> <?php echo __('nav.guidelines'); ?>
                            </a>
                            <a href="faq.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-muted hover:bg-surface hover:text-text">
                                <i data-lucide="help-circle" class="w-4 h-4"></i> <?php echo __('nav.faq'); ?>
                            </a>
                            <a href="about.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-muted hover:bg-surface hover:text-text">
                                <i data-lucide="info" class="w-4 h-4"></i> <?php echo __('nav.about'); ?>
                            </a>
                            <a href="pricing.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-muted hover:bg-surface hover:text-text">
                                <i data-lucide="credit-card" class="w-4 h-4"></i> 料金プラン
                            </a>
                            <a href="for-business/" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-muted hover:bg-surface hover:text-text">
                                <i data-lucide="building-2" class="w-4 h-4"></i> 企業・研究者の方へ
                            </a>
                            <a href="dashboard_municipality.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-primary hover:bg-primary-surface">
                                <i data-lucide="globe-2" class="w-4 h-4"></i> 自治体ダッシュボード
                            </a>
                            <a href="dashboard_portfolio.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-primary hover:bg-primary-surface">
                                <i data-lucide="briefcase" class="w-4 h-4"></i> 企業ポートフォリオ (Global)
                            </a>
                            <a href="logout.php" class="block px-3 py-2 text-sm font-bold transition flex items-center gap-2 rounded-md text-danger hover:bg-danger-surface">
                                <i data-lucide="log-out" class="w-4 h-4"></i> <?php echo __('nav.logout'); ?>
                            </a>
                        </div>
                    </div>
                </div>

                <a href="post.php" class="btn-primary flex items-center gap-2 text-sm">
                    <i data-lucide="camera" class="w-4 h-4"></i>
                    <span class="hidden md:inline"><?php echo __('nav.post'); ?></span>
                </a>
            <?php else: ?>
                <a href="login.php" class="btn-secondary flex items-center gap-1.5 text-sm font-bold">
                    <i data-lucide="log-in" class="w-4 h-4"></i>
                    <?php echo __('nav.login'); ?>
                </a>
                <a href="login.php" class="btn-primary flex items-center gap-1.5 text-sm font-bold">
                    <i data-lucide="camera" class="w-4 h-4"></i>
                    <span class="hidden md:inline"><?php echo __('nav.post'); ?></span>
                </a>
            <?php endif; ?>

            <!-- Language Toggle (Desktop) -->
            <a href="?lang=<?php echo Lang::get('nav.toggle_lang') == 'English' ? 'en' : 'ja'; ?>" class="hidden md:block text-xs font-bold transition text-muted hover:text-text">
                <?php echo __('nav.toggle_lang'); ?>
            </a>
        </div>
    </div>
</nav>

<script nonce="<?= CspNonce::attr() ?>">
    function notifications() {
        return {
            open: false,
            unreadCount: 0,
            list: [],
            async init() {
                await this.fetchNotifications();
                setInterval(() => this.fetchNotifications(), 30000);
            },
            async fetchNotifications() {
                try {
                    const res = await fetch('api/get_notifications.php');
                    const result = await res.json();
                    if (result.success) {
                        this.list = result.notifications || [];
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
                    const res = await fetch('api/mark_notifications_read.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({})
                    });
                    const result = await res.json();
                    if (result.success) {
                        this.unreadCount = result.unread_count || 0;
                        this.list.forEach(n => n.is_read = true);
                    }
                } catch (e) {
                    console.error(e);
                }
            },
            markItemRead(item) {
                if (item.is_read) return;
                item.is_read = true;
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                fetch('api/mark_notifications_read.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        id: item.id
                    })
                }).catch(e => console.error(e));
            },
            formatTime(ts) {
                const date = new Date(ts);
                return date.toLocaleString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            },
            getTypeIcon(type) {
                const icons = {
                    'identification': '🏷️',
                    'like': '❤️',
                    'footprint': '👣',
                    'ghost': '👻',
                    'badge': '🏅',
                    'rg_upgrade': '🏆',
                    'comment': '💬',
                    'welcome': '🌟'
                };
                return icons[type] || '🔔';
            }
        }
    }

    function globalSearch() {
        return {
            q: '',
            results: [],
            showResults: false,
            _controller: null,

            async search() {
                if (this.q.length < 2) {
                    this.results = [];
                    this.showResults = false;
                    return;
                }

                if (this._controller) this._controller.abort();
                this._controller = new AbortController();

                try {
                    const res = await fetch(`api/search.php?q=${encodeURIComponent(this.q)}&limit=8`, {
                        signal: this._controller.signal
                    });
                    const data = await res.json();
                    this.results = data.results || [];
                    this.showResults = this.results.length > 0;
                } catch (e) {
                    if (e.name !== 'AbortError') console.error(e);
                }
            },

            goFirst() {
                if (this.results.length > 0) {
                    this.goTo(this.results[0]);
                } else if (this.q.length > 0) {
                    // Fallback: search on map
                    window.location.href = `map.php?q=${encodeURIComponent(this.q)}`;
                }
            },

            goTo(r) {
                this.showResults = false;
                if (r.type === 'taxon') {
                    window.location.href = `zukan.php?q=${encodeURIComponent(r.scientific_name || r.name)}`;
                } else if (r.type === 'site') {
                    window.location.href = `site_dashboard.php?id=${r.id}`;
                } else if (r.type === 'place') {
                    window.location.href = `map.php?lat=${r.lat}&lng=${r.lng}&zoom=14`;
                }
            },

            searchLabel(r) {
                if (r.type === 'taxon') return r.scientific_name || r.group || '';
                if (r.type === 'site') return '登録サイト';
                if (r.type === 'place') return '観察場所';
                return '';
            }
        }
    }

    function mobileSearch() {
        return {
            open: false,
            q: '',
            results: [],
            loading: false,
            _controller: null,

            openSearch() {
                this.open = true;
                document.body.style.overflow = 'hidden';
                this.$nextTick(() => {
                    this.$refs.mobileSearchInput?.focus();
                    lucide.createIcons();
                });
            },

            closeSearch() {
                this.open = false;
                document.body.style.overflow = '';
            },

            async search() {
                if (this.q.length < 2) {
                    this.results = [];
                    return;
                }

                if (this._controller) this._controller.abort();
                this._controller = new AbortController();
                this.loading = true;

                try {
                    const res = await fetch(`api/search.php?q=${encodeURIComponent(this.q)}&limit=10`, {
                        signal: this._controller.signal
                    });
                    const data = await res.json();
                    this.results = data.results || [];
                } catch (e) {
                    if (e.name !== 'AbortError') console.error(e);
                } finally {
                    this.loading = false;
                }
            },

            goFirst() {
                if (this.results.length > 0) {
                    this.goTo(this.results[0]);
                }
            },

            goTo(r) {
                if (r.type === 'taxon') {
                    window.location.href = `zukan.php?q=${encodeURIComponent(r.scientific_name || r.name)}`;
                } else if (r.type === 'site') {
                    window.location.href = `site_dashboard.php?id=${r.id}`;
                } else if (r.type === 'place') {
                    window.location.href = `map.php?lat=${r.lat}&lng=${r.lng}&zoom=14`;
                }
            },

            searchLabel(r) {
                if (r.type === 'taxon') return r.scientific_name || r.group || '';
                if (r.type === 'site') return '登録サイト';
                if (r.type === 'place') return '観察場所';
                return '';
            }
        }
    }

    function mobileMenu() {
        return {
            open: false,
            openMenu() {
                this.open = true;
                document.body.style.overflow = 'hidden';
                this.$nextTick(() => {
                    lucide.createIcons();
                });
            },
            closeMenu() {
                this.open = false;
                document.body.style.overflow = '';
            }
        }
    }
</script>

<!-- Mobile Bottom Nav (App Shell) -->
<nav class="md:hidden bottom-nav" aria-label="モバイル ナビゲーション">
    <a href="index.php"
        <?php if (basename($_SERVER['PHP_SELF']) == 'index.php'): ?> @click.prevent="window.scrollTo({top: 0, behavior: 'smooth'})" <?php endif; ?>
        class="bottom-nav__item <?php echo basename($_SERVER['PHP_SELF']) == 'index.php' ? 'bottom-nav__item--active' : ''; ?>">
        <i data-lucide="home" class="w-6 h-6"></i>
        <span><?php echo __('nav.home'); ?></span>
    </a>
    <button @click="$dispatch('open-mobile-search')" class="bottom-nav__item">
        <i data-lucide="search" class="w-6 h-6"></i>
        <span>検索</span>
    </button>

    <!-- Raised Center Button -->
    <div class="bottom-nav__center">
        <?php if ($currentUser): ?>
            <a href="post.php" class="bottom-nav__center-btn" aria-label="<?php echo __('nav.post'); ?>">
                <i data-lucide="camera" class="w-7 h-7"></i>
            </a>
        <?php else: ?>
            <a href="login.php" class="bottom-nav__center-btn" aria-label="<?php echo __('nav.post'); ?>">
                <i data-lucide="camera" class="w-7 h-7"></i>
            </a>
        <?php endif; ?>
    </div>

    <a href="ikimon_walk.php"
        <?php if (basename($_SERVER['PHP_SELF']) == 'ikimon_walk.php'): ?> @click.prevent="window.scrollTo({top: 0, behavior: 'smooth'})" <?php endif; ?>
        class="bottom-nav__item <?php echo basename($_SERVER['PHP_SELF']) == 'ikimon_walk.php' ? 'bottom-nav__item--active' : ''; ?>">
        <i data-lucide="footprints" class="w-6 h-6"></i>
        <span>さんぽ</span>
    </a>
    <button @click="$dispatch('open-mobile-menu')" class="bottom-nav__item">
        <i data-lucide="menu" class="w-6 h-6"></i>
        <span>メニュー</span>
    </button>
</nav>

<!-- Mobile Fullscreen Search Modal -->
<div x-data="mobileSearch()"
    @open-mobile-search.window="openSearch()"
    x-show="open"
    x-cloak
    class="fixed inset-0 z-[100] bg-[var(--color-bg-base)] flex flex-col md:hidden"
    x-transition:enter="transition ease-out duration-200"
    x-transition:enter-start="opacity-0 translate-y-4"
    x-transition:enter-end="opacity-100 translate-y-0"
    x-transition:leave="transition ease-in duration-150"
    x-transition:leave-start="opacity-100 translate-y-0"
    x-transition:leave-end="opacity-0 translate-y-4">

    <!-- Search Header -->
    <div class="flex items-center gap-3 px-4 pt-[calc(var(--safe-top,0px)+12px)] pb-3 border-b border-[var(--color-border)]">
        <button @click="closeSearch()" class="p-2 rounded-full text-[var(--color-muted)] hover:bg-[var(--color-bg-faint)] transition flex-shrink-0">
            <i data-lucide="arrow-left" class="w-5 h-5"></i>
        </button>
        <div class="relative flex-1">
            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-faint)]"></i>
            <input type="text"
                x-ref="mobileSearchInput"
                x-model="q"
                @input.debounce.300ms="search()"
                @keydown.enter="goFirst()"
                @keydown.escape="closeSearch()"
                placeholder="種名・場所で検索..."
                class="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-[var(--color-surface)] border border-[var(--color-border-strong)] text-[var(--color-text)] placeholder-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
            <button x-show="q.length > 0" @click="q = ''; results = []" class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--color-faint)] hover:text-[var(--color-text)]">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        </div>
    </div>

    <!-- Quick Links (empty state) -->
    <div x-show="results.length === 0 && q.length < 2" class="flex-1 overflow-y-auto px-4 py-4">
        <p class="text-xs font-bold uppercase tracking-wider text-[var(--color-faint)] mb-3">よく使うページ</p>
        <a href="explore.php" class="flex items-center gap-3 py-3 border-b border-[var(--color-border)] text-[var(--color-text)]" style="text-decoration:none">
            <span class="text-lg">🧭</span>
            <span class="text-sm font-bold"><?php echo __('nav.explore'); ?></span>
        </a>
        <a href="map.php" class="flex items-center gap-3 py-3 border-b border-[var(--color-border)] text-[var(--color-text)]" style="text-decoration:none">
            <span class="text-lg">🗺️</span>
            <span class="text-sm font-bold"><?php echo __('nav.field_map'); ?></span>
        </a>
        <a href="zukan.php" class="flex items-center gap-3 py-3 border-b border-[var(--color-border)] text-[var(--color-text)]" style="text-decoration:none">
            <span class="text-lg">📖</span>
            <span class="text-sm font-bold"><?php echo __('nav.zukan'); ?></span>
        </a>
        <a href="compass.php" class="flex items-center gap-3 py-3 border-b border-[var(--color-border)] text-[var(--color-text)]" style="text-decoration:none">
            <span class="text-lg">🌍</span>
            <span class="text-sm font-bold"><?php echo __('nav.ranking'); ?></span>
        </a>
        <a href="survey.php" class="flex items-center gap-3 py-3 border-b border-[var(--color-border)] text-[var(--color-text)]" style="text-decoration:none">
            <span class="text-lg">🔬</span>
            <span class="text-sm font-bold">フィールド調査</span>
        </a>
    </div>

    <!-- Search Results -->
    <div x-show="results.length > 0" class="flex-1 overflow-y-auto">
        <template x-for="r in results" :key="r.name + r.type">
            <button @click="goTo(r)" class="w-full text-left px-4 py-3.5 border-b border-[var(--color-border)] flex items-start gap-3 active:bg-[var(--color-bg-faint)] transition">
                <span class="text-lg mt-0.5 flex-shrink-0" x-text="r.icon || '🔍'"></span>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-[var(--color-text)] truncate" x-text="r.name || r.common_name"></p>
                    <p class="text-xs text-[var(--color-muted)] truncate" x-text="searchLabel(r)"></p>
                </div>
                <span class="text-token-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-surface)] text-[var(--color-faint)] flex-shrink-0 mt-1"
                    x-text="r.type === 'taxon' ? '種名' : (r.type === 'site' ? 'サイト' : '場所')"></span>
            </button>
        </template>
    </div>

    <!-- Loading -->
    <div x-show="loading" class="flex-1 flex items-center justify-center">
        <div class="animate-spin w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full"></div>
    </div>

    <!-- No results -->
    <div x-show="q.length >= 2 && results.length === 0 && !loading" class="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <span class="text-4xl mb-3">🔍</span>
        <p class="text-sm font-bold text-[var(--color-muted)]">「<span x-text="q"></span>」の結果が見つかりません</p>
        <p class="text-xs text-[var(--color-faint)] mt-1">別のキーワードを試してみてね</p>
    </div>
</div>

<!-- Mobile Fullscreen Menu Modal -->
<div x-data="mobileMenu()"
    @open-mobile-menu.window="openMenu()"
    x-show="open"
    x-cloak
    class="fixed inset-0 z-[100] bg-[var(--color-bg-base)] flex flex-col md:hidden"
    x-transition:enter="transition ease-out duration-200"
    x-transition:enter-start="opacity-0 translate-y-4"
    x-transition:enter-end="opacity-100 translate-y-0"
    x-transition:leave="transition ease-in duration-150"
    x-transition:leave-start="opacity-100 translate-y-0"
    x-transition:leave-end="opacity-0 translate-y-4">

    <!-- Menu Header -->
    <div class="flex items-center justify-between px-4 pt-[calc(var(--safe-top,0px)+12px)] pb-3 border-b border-[var(--color-border)]">
        <p class="font-bold text-[var(--color-text)]">メニュー</p>
        <button @click="closeMenu()" class="p-2 rounded-full text-[var(--color-muted)] hover:bg-[var(--color-bg-faint)] transition flex-shrink-0">
            <i data-lucide="x" class="w-5 h-5"></i>
        </button>
    </div>

    <!-- Menu Content -->
    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-6 pb-32">
        <?php if ($currentUser): ?>
            <!-- User Info -->
            <div class="flex items-center gap-4 p-4 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]">
                <img src="<?php echo htmlspecialchars($currentUser['avatar']); ?>" class="w-12 h-12 rounded-full object-cover border border-[var(--color-border-strong)]">
                <div>
                    <p class="font-bold text-[var(--color-text)]"><?php echo htmlspecialchars($currentUser['name']); ?></p>
                    <p class="text-xs font-bold text-[var(--color-muted)]"><?php echo htmlspecialchars(Auth::getRankLabel($currentUser)); ?></p>
                </div>
            </div>

            <!-- Personal Links -->
            <div>
                <p class="text-xs font-black uppercase tracking-wider text-[var(--color-faint)] mb-2 px-2">パーソナル</p>
                <a href="profile.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                    <i data-lucide="user" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold"><?php echo __('nav.profile'); ?></span>
                </a>
                <a href="dashboard.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                    <i data-lucide="settings" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">ダッシュボード・設定</span>
                </a>
                <a href="my_organisms.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                    <i data-lucide="library" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">捕まえた生き物</span>
                </a>
                <a href="wellness.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                    <i data-lucide="heart" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">ウェルネス & インパクト</span>
                </a>
            </div>
        <?php else: ?>
            <div class="p-4 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] text-center">
                <p class="text-sm font-bold text-[var(--color-text)] mb-3">ログインしてikimonをもっと楽しもう！</p>
                <a href="login.php" class="btn-primary block w-full py-2">ログイン / 新規登録</a>
            </div>
        <?php endif; ?>

        <!-- Discover / Community Links -->
        <div>
            <p class="text-xs font-black uppercase tracking-wider text-[var(--color-faint)] mb-2 px-2">探す・共創する</p>
            <a href="explore.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                <i data-lucide="search" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">すべて探す</span>
            </a>
            <a href="map.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                <i data-lucide="map" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">フィールドマップ</span>
            </a>
            <a href="zukan.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                <i data-lucide="book-open" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">いきもの図鑑</span>
            </a>
            <a href="compass.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                <i data-lucide="globe" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">ランキング</span>
            </a>
            <a href="needs_id.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                <i data-lucide="sparkles" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">The Missing Matrix</span>
            </a>
            <a href="id_workbench.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                <i data-lucide="microscope" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">IDセンター (同定)</span>
            </a>
            <a href="site_dashboard.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                <i data-lucide="shield-check" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">共生サイト</span>
            </a>
            <a href="events.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                <i data-lucide="calendar" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">イベント</span>
            </a>
            <a href="ikimon_walk.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                <i data-lucide="footprints" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold"><?php echo __('nav.my_field'); ?></span>
            </a>
            <a href="survey.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                <i data-lucide="clipboard-list" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">調査に参加</span>
            </a>
        </div>

        <!-- Info / Admin -->
        <div>
            <p class="text-xs font-black uppercase tracking-wider text-[var(--color-faint)] mb-2 px-2">その他</p>
            <a href="about.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                <i data-lucide="info" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">ikimonについて</span>
            </a>
            <a href="pricing.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                <i data-lucide="credit-card" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">料金プラン</span>
            </a>
            <a href="for-business/" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-text)]">
                <i data-lucide="building-2" class="w-5 h-5 text-[var(--color-muted)]"></i> <span class="text-sm font-bold">企業・研究者の方へ</span>
            </a>
            <a href="dashboard_municipality.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-primary)]">
                <i data-lucide="globe-2" class="w-5 h-5 text-[var(--color-primary)]"></i> <span class="text-sm font-bold text-[var(--color-primary)]">自治体ダッシュボード</span>
            </a>
            <a href="dashboard_portfolio.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-primary)]">
                <i data-lucide="briefcase" class="w-5 h-5 text-[var(--color-primary)]"></i> <span class="text-sm font-bold text-[var(--color-primary)]">企業ポートフォリオ (Global)</span>
            </a>
            <?php if ($currentUser && Auth::hasRole('Analyst')): ?>
                <a href="admin/index.php" class="flex items-center gap-3 py-3 px-2 border-b border-[var(--color-border)] text-[var(--color-primary)]">
                    <i data-lucide="shield-alert" class="w-5 h-5"></i> <span class="text-sm font-bold text-[var(--color-primary)]">管理者ダッシュボード</span>
                </a>
            <?php endif; ?>
            <?php if ($currentUser): ?>
                <a href="logout.php" class="flex items-center gap-3 py-3 px-2 text-[var(--color-danger)] mt-4">
                    <i data-lucide="log-out" class="w-5 h-5"></i> <span class="text-sm font-bold">ログアウト</span>
                </a>
            <?php endif; ?>
        </div>
    </div>
</div>

<!-- PWA Install Banner -->
<div id="pwa-install-banner"
    class="fixed z-[60] flex items-center gap-3 animate-[slideUp_0.5s_ease-out] bg-elevated rounded-lg shadow-lg border border-border-strong p-4 hidden bottom-[calc(var(--bottom-nav-height,64px)+16px)] left-4 right-4 max-w-[480px] mx-auto">
    <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-primary-surface">
        <span class="text-2xl">🌿</span>
    </div>
    <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-text">ikimon をインストール</p>
        <p class="text-xs text-muted">ホーム画面からすぐ起動。フィールドで便利！</p>
    </div>
    <div class="flex gap-2 shrink-0">
        <button onclick="pwaDismiss()" class="text-xs p-1 text-faint hover:text-text">✕</button>
        <button onclick="pwaInstall()" class="btn-primary text-xs px-4 py-2">追加</button>
    </div>
</div>
<style>
    @keyframes slideUp {
        from {
            transform: translateY(100%);
            opacity: 0;
        }

        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
</style>

<!-- CSRF Token Auto-Injection for all fetch() calls -->
<script nonce="<?= CspNonce::attr() ?>">
    (function() {
        const originalFetch = window.fetch;
        const UNSAFE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

        function getCsrfToken() {
            const m = document.cookie.match(/(?:^|;\s*)ikimon_csrf=([a-f0-9]{64})/);
            return m ? m[1] : '';
        }

        window.fetch = function(input, init) {
            init = init || {};
            const method = (init.method || 'GET').toUpperCase();

            if (UNSAFE_METHODS.includes(method)) {
                const token = getCsrfToken();
                if (token) {
                    if (init.headers instanceof Headers) {
                        if (!init.headers.has('X-Csrf-Token')) {
                            init.headers.set('X-Csrf-Token', token);
                        }
                    } else if (typeof init.headers === 'object' && init.headers !== null) {
                        if (!init.headers['X-Csrf-Token']) {
                            init.headers['X-Csrf-Token'] = token;
                        }
                    } else {
                        init.headers = {
                            'X-Csrf-Token': token
                        };
                    }
                }
            }

            return originalFetch.call(this, input, init);
        };
    })();
</script>