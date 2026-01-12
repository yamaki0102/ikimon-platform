
// --- Dashboard Sidebar Component ---
function loadDashboardSidebar(activePage) {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) return;

    // Use absolute path or relative from root for links in PHP environment
    // Assuming showcase.php?view=... structure
    const navLinks = [
        { name: 'ダッシュボード', href: '?view=overview', icon: 'layout-dashboard', group: 'Analytics' },
        { name: 'エリア管理', href: '?view=settings', icon: 'map', group: 'Analytics' },
        { name: 'レポート出力', href: '?view=reports', icon: 'file-text', group: 'Analytics' },
        { name: 'イベント管理', href: '?view=events', icon: 'calendar', group: 'Community' },
        { name: '参加者リスト', href: '#', icon: 'users', group: 'Community', disabled: true, badge: '準備中' }
    ];

    // Group links
    const analyticsLinks = navLinks.filter(l => l.group === 'Analytics');
    const communityLinks = navLinks.filter(l => l.group === 'Community');

    const renderLinks = (links) => links.map(link => {
        // Simple active check: if href contains the view param
        const urlParams = new URLSearchParams(window.location.search);
        const currentView = urlParams.get('view') || 'overview';
        const linkView = link.href.includes('view=') ? link.href.split('view=')[1] : null;

        const isActive = linkView === currentView;
        const activeClass = isActive ? 'bg-green-500/10 text-green-400 border-r-2 border-green-500' : 'text-gray-400 hover:bg-white/5 hover:text-white';
        const disabledClass = link.disabled ? 'opacity-50 cursor-not-allowed group relative' : '';

        let badgeHtml = '';
        if (link.badge) {
            badgeHtml = `
                <span class="absolute left-full ml-2 px-2 py-1 bg-black border border-white/20 rounded text-xs whitespace-nowrap hidden group-hover:block z-50">
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
    <aside class="w-64 bg-[#0d1611] border-r border-white/10 flex flex-col h-full">
        <div class="h-20 flex items-center px-6 border-b border-white/10">
            <a href="index.php" class="flex items-center gap-2 group">
                <div class="relative w-8 h-8 flex items-center justify-center bg-white rounded-full overflow-hidden">
                    <span class="font-['Montserrat'] font-black text-sm text-black tracking-tighter">ik</span>
                </div>
                <span class="font-['Montserrat'] font-bold text-lg tracking-tight text-white">ikimon Biz</span>
            </a>
        </div>

        <div class="flex-1 overflow-y-auto py-6 space-y-8">
            <div>
                <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-6">Analytics</div>
                <nav class="space-y-1">
                    ${renderLinks(analyticsLinks)}
                </nav>
            </div>

            <div>
                <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-6">Community</div>
                <nav class="space-y-1">
                    ${renderLinks(communityLinks)}
                </nav>
            </div>

            <div>
                <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-6">System</div>
                <nav class="space-y-1">
                    <a href="admin/corporate.php" class="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all text-gray-400 hover:bg-white/5 hover:text-white">
                        <i data-lucide="arrow-left" class="w-5 h-5"></i>
                        企業管理へ戻る
                    </a>
                </nav>
            </div>
        </div>

        <div class="p-4 border-t border-white/10">
            <div class="flex items-center gap-3 px-2">
                <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=100&auto=format&fit=crop"
                    class="w-10 h-10 rounded-full border border-white/20">
                <div>
                    <div class="text-sm font-bold text-white">山田 健太</div>
                    <div class="text-xs text-gray-400">株式会社グリーン</div>
                </div>
            </div>
        </div>
    </aside>
    `;

    sidebarContainer.innerHTML = html;
    lucide.createIcons();
}

// --- Dashboard Header Component ---
function loadDashboardHeader() {
    const headerContainer = document.getElementById('dashboard-header-container');
    if (!headerContainer) return;

    // Get site name from PHP embedded global or DOM if possible, otherwise hardcode
    // For now hardcoded or generic

    const html = `
    <header class="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-[#0a0a0a]">
        <div>
            <h1 class="text-xl font-bold text-white">浜松・企業の森プロジェクト</h1>
            <div class="flex items-center gap-2 text-xs text-green-400 mt-1">
                <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                モニタリング進行中
            </div>
        </div>
        <div class="flex items-center gap-4">
            <button
                class="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm font-bold border border-green-500/30 hover:bg-green-500/30 transition flex items-center gap-2">
                <i data-lucide="download" class="w-4 h-4"></i>
                認定用レポート出力
            </button>
        </div>
    </header>
    `;

    headerContainer.innerHTML = html;
    lucide.createIcons();
}
