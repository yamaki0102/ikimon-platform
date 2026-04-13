
// --- Dashboard Sidebar Component (White Theme & Mobile Responsive) ---
function loadDashboardSidebar(activePage) {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) return;

    // Use absolute path or relative from root for links in PHP environment
    const navLinks = [
        { name: 'ダッシュボード', href: '?view=overview', icon: 'layout-dashboard', group: 'Analytics' },
        { name: 'エリア管理', href: '?view=settings', icon: 'map', group: 'Analytics' },
        { name: 'レポート出力', href: '?view=reports', icon: 'file-text', group: 'Analytics' },
        { name: 'イベント管理', href: '?view=events', icon: 'calendar', group: 'Community' },
        { name: '参加者リスト', href: '#', icon: 'users', group: 'Community', disabled: true, badge: '準備中' }
    ];

    const analyticsLinks = navLinks.filter(l => l.group === 'Analytics');
    const communityLinks = navLinks.filter(l => l.group === 'Community');

    const renderLinks = (links) => links.map(link => {
        const urlParams = new URLSearchParams(window.location.search);
        const currentView = urlParams.get('view') || 'overview';
        const linkView = link.href.includes('view=') ? link.href.split('view=')[1] : null;

        const isActive = linkView === currentView;
        // White Theme Active State
        const activeClass = isActive
            ? 'bg-green-50 text-green-700 border-r-2 border-green-500 font-bold'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900';

        const disabledClass = link.disabled ? 'opacity-50 cursor-not-allowed group relative' : '';

        let badgeHtml = '';
        if (link.badge) {
            badgeHtml = `
                <span class="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white rounded text-xs whitespace-nowrap hidden group-hover:block z-50 shadow-lg">
                    ${link.badge}
                </span>
            `;
        }

        return `
            <a href="${link.href}" class="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all ${activeClass} ${disabledClass}">
                <i data-lucide="${link.icon}" class="w-5 h-5"></i>
                ${link.name}
                ${badgeHtml}
            </a>
        `;
    }).join('');

    const html = `
    <!-- Mobile Backdrop -->
    <div x-show="sidebarOpen" 
         x-transition.opacity 
         @click="sidebarOpen = false"
         class="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"></div>

    <!-- Sidebar (White Theme) -->
    <aside 
        class="fixed md:static inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-50 transition-transform duration-300 transform shadow-xl md:shadow-none"
        :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'"
    >
        <!-- Logo Area -->
        <div class="h-16 md:h-20 flex items-center justify-between px-6 border-b border-gray-100 bg-white">
            <a href="index.php" class="flex items-center gap-2 group">
                <div class="relative w-8 h-8 flex items-center justify-center bg-green-600 rounded-full overflow-hidden shadow-sm text-white">
                    <span class="font-bold text-sm tracking-tighter">ik</span>
                </div>
                <span class="font-bold text-lg tracking-tight text-gray-900">ikimon Biz</span>
            </a>
            <!-- Mobile Close Button -->
            <button @click="sidebarOpen = false" class="md:hidden text-gray-400 hover:text-gray-600 p-2">
                <i data-lucide="x" class="w-6 h-6"></i>
            </button>
        </div>

        <!-- Navigation -->
        <div class="flex-1 overflow-y-auto py-6 space-y-8 custom-scrollbar">
            <div>
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-6">Analytics</div>
                <nav class="space-y-1">
                    ${renderLinks(analyticsLinks)}
                </nav>
            </div>

            <div>
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-6">Community</div>
                <nav class="space-y-1">
                    ${renderLinks(communityLinks)}
                </nav>
            </div>

            <div>
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-6">System</div>
                <nav class="space-y-1">
                    <a href="corporate_dashboard.php" class="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 border-l-2 border-transparent">
                        <i data-lucide="arrow-left" class="w-5 h-5"></i>
                        法人ダッシュボードへ戻る
                    </a>
                </nav>
            </div>
        </div>

        <!-- User Profile -->
        <div class="p-4 border-t border-gray-100 bg-gray-50/50">
            <div class="flex items-center gap-3 px-2">
                <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=100&auto=format&fit=crop"
                    class="w-10 h-10 rounded-full border border-gray-200 shadow-sm">
                <div class="min-w-0">
                    <div class="text-sm font-bold text-gray-900 truncate">Demo User</div>
                    <div class="text-xs text-gray-500 truncate">${window.siteData ? window.siteData.owner : '株式会社グリーン'}</div>
                </div>
            </div>
        </div>
    </aside>
    `;

    sidebarContainer.innerHTML = html;
    lucide.createIcons();
}

// --- Dashboard Header Component (White Theme & Mobile Responsive) ---
function loadDashboardHeader() {
    const headerContainer = document.getElementById('dashboard-header-container');
    if (!headerContainer) return;

    const siteName = window.siteData ? window.siteData.name : '浜松・企業の森';

    const html = `
    <header class="h-16 md:h-20 border-b border-gray-200 flex items-center justify-between px-4 md:px-8 bg-white/90 backdrop-blur sticky top-0 z-30 w-full shadow-sm md:shadow-none">
        <div class="flex items-center gap-4 min-w-0">
            <!-- Hamburger Menu (Mobile Only) -->
            <button 
                @click="sidebarOpen = !sidebarOpen" 
                class="md:hidden p-2 -ml-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                aria-label="Toggle Menu"
            >
                <i data-lucide="menu" class="w-6 h-6"></i>
            </button>

            <div class="min-w-0">
                <h1 class="text-lg md:text-xl font-bold text-gray-900 truncate flex items-center gap-2">
                    ${siteName}
                    <span class="inline-flex md:hidden w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                </h1>
                <div class="hidden md:flex items-center gap-2 text-xs text-green-600 mt-0.5 font-medium">
                    <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    モニタリング進行中
                </div>
            </div>
        </div>

        <div class="flex items-center gap-2 md:gap-4 shrink-0">
             <!-- Report Button (Icon only on mobile) -->
            <button
                class="px-3 md:px-4 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-bold border border-green-200 hover:bg-green-100 hover:border-green-300 transition flex items-center gap-2 shadow-sm">
                <i data-lucide="download" class="w-4 h-4"></i>
                <span class="hidden md:inline">認定レポート出力</span>
                <span class="md:hidden">DL</span>
            </button>
        </div>
    </header>
    `;

    headerContainer.innerHTML = html;
    lucide.createIcons();
}
