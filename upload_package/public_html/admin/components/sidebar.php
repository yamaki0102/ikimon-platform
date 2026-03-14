<?php

/**
 * Admin Sidebar Component
 * 
 * Usage: 
 *   $adminPage = 'index'; // 'index', 'applications', 'observations', 'moderation', 'verification', 'users', 'surveyors', 'corporate'
 *   include __DIR__ . '/components/sidebar.php';
 *
 * Required: $currentUser (from Auth::user()) and $pendingFlags (int, optional)
 */
$adminPage = $adminPage ?? 'index';
$pendingFlags = $pendingFlags ?? 0;
$currentUser = $currentUser ?? Auth::user();
?>
<aside class="w-64 bg-slate-900 border-r border-slate-800 hidden md:flex flex-col">
    <div class="p-6 flex items-center gap-3">
        <div class="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-brand font-black text-slate-900">i</div>
        <span class="font-brand font-black text-xl tracking-tight">ikimon <span class="text-xs text-slate-500 font-normal">Admin</span></span>
    </div>

    <nav class="flex-1 px-4 space-y-2">
        <?php
        $navItems = [
            ['id' => 'index',        'href' => 'index.php',        'icon' => 'layout-dashboard', 'label' => 'Dashboard'],
            ['id' => 'applications', 'href' => 'business_applications.php', 'icon' => 'inbox',  'label' => '申込み管理'],
            ['id' => 'observations', 'href' => 'observations.php', 'icon' => 'eye',              'label' => '観察管理'],
            ['id' => 'moderation',   'href' => 'moderation.php',   'icon' => 'shield-alert',     'label' => 'モデレーション', 'badge' => $pendingFlags],
            ['id' => 'verification', 'href' => 'verification.php', 'icon' => 'check-circle-2',   'label' => '検証キュー'],
            ['id' => 'users',        'href' => 'users.php',        'icon' => 'users',            'label' => 'ユーザー管理'],
            ['id' => 'surveyors',    'href' => 'surveyors.php',    'icon' => 'badge-check',      'label' => '調査員管理'],
            ['id' => 'corporate',    'href' => 'corporate.php',    'icon' => 'building-2',       'label' => '契約団体'],
        ];
        foreach ($navItems as $item):
            $isActive = ($adminPage === $item['id']);
            $activeClass = $isActive
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white';
        ?>
            <a href="<?php echo $item['href']; ?>" class="flex items-center gap-3 px-4 py-3 <?php echo $activeClass; ?> rounded-xl font-bold transition">
                <i data-lucide="<?php echo $item['icon']; ?>" class="w-5 h-5"></i>
                <?php echo $item['label']; ?>
                <?php if (!empty($item['badge']) && $item['badge'] > 0): ?>
                    <span class="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full"><?php echo $item['badge']; ?></span>
                <?php endif; ?>
            </a>
        <?php endforeach; ?>
    </nav>

    <div class="p-4 border-t border-slate-800">
        <?php if ($currentUser): ?>
            <div class="flex items-center gap-3 px-4 py-2">
                <img src="<?php echo htmlspecialchars($currentUser['avatar'] ?? ''); ?>" alt="<?php echo htmlspecialchars($currentUser['name'] ?? 'ユーザー'); ?>のアバター" class="w-8 h-8 rounded-full bg-slate-700">
                <div class="overflow-hidden">
                    <p class="text-sm font-bold truncate"><?php echo htmlspecialchars($currentUser['name'] ?? ''); ?></p>
                    <p class="text-xs text-slate-500 truncate"><?php echo htmlspecialchars(Auth::getRankLabel($currentUser)); ?></p>
                </div>
            </div>
        <?php endif; ?>
        <a href="../index.php" class="flex items-center gap-2 text-xs text-slate-500 hover:text-white transition px-4 py-2 mt-1">
            <i data-lucide="arrow-left" class="w-4 h-4"></i> サイトに戻る
        </a>
    </div>
</aside>
