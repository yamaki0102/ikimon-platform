<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/UserStore.php';
Auth::init();
Auth::requireRole('Analyst');

$currentUser = Auth::user();

// Pagination
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 20;

// Filters
$statusFilter = $_GET['status'] ?? '';
$search = trim($_GET['q'] ?? '');

$observations = DataStore::fetchAll('observations');

// Sort by newest
usort($observations, function ($a, $b) {
    return strtotime($b['observed_at'] ?? 0) <=> strtotime($a['observed_at'] ?? 0);
});

// Apply filters
if ($statusFilter) {
    $observations = array_filter($observations, function ($o) use ($statusFilter) {
        return ($o['status'] ?? '') === $statusFilter;
    });
}
if ($search) {
    $observations = array_filter($observations, function ($o) use ($search) {
        $haystack = strtolower(($o['taxon']['name'] ?? '') . ' ' . ($o['user_name'] ?? '') . ' ' . ($o['id'] ?? ''));
        return strpos($haystack, strtolower($search)) !== false;
    });
}

$total = count($observations);
$totalPages = max(1, ceil($total / $perPage));
$observations = array_slice(array_values($observations), ($page - 1) * $perPage, $perPage);

// Status counts
$allObs = DataStore::fetchAll('observations');
$statusCounts = [];
foreach ($allObs as $o) {
    $s = $o['status'] ?? 'Unknown';
    $statusCounts[$s] = ($statusCounts[$s] ?? 0) + 1;
}
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php $adminTitle = '観察管理';
    include __DIR__ . '/components/head.php'; ?>
</head>

<body class="flex h-screen overflow-hidden">

    <?php $adminPage = 'observations';
    include __DIR__ . '/components/sidebar.php'; ?>

    <!-- Main -->
    <main class="flex-1 overflow-y-auto p-6 md:p-8">
        <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-bold">観察管理</h1>
                <p class="text-sm text-slate-400 mt-1">全 <?php echo number_format($total); ?> 件</p>
            </div>
        </header>

        <!-- Filters -->
        <div class="flex flex-wrap gap-3 mb-6">
            <form method="GET" class="flex gap-3 flex-wrap items-center">
                <input type="text" name="q" value="<?php echo htmlspecialchars($search); ?>" placeholder="種名・ユーザー名で検索..." class="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 w-64">
                <select name="status" class="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-500">
                    <option value="">すべてのステータス</option>
                    <?php foreach ($statusCounts as $s => $c): ?>
                        <option value="<?php echo htmlspecialchars($s); ?>" <?php echo $statusFilter === $s ? 'selected' : ''; ?>><?php echo htmlspecialchars($s); ?> (<?php echo $c; ?>)</option>
                    <?php endforeach; ?>
                </select>
                <button type="submit" class="px-4 py-2 bg-emerald-500 text-black rounded-lg text-sm font-bold hover:bg-emerald-400 transition">検索</button>
                <?php if ($search || $statusFilter): ?>
                    <a href="observations.php" class="text-sm text-slate-400 hover:text-white transition">クリア</a>
                <?php endif; ?>
            </form>
        </div>

        <!-- Table -->
        <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-slate-400 uppercase bg-slate-900/50">
                    <tr>
                        <th class="px-4 py-3">写真</th>
                        <th class="px-4 py-3">種名</th>
                        <th class="px-4 py-3">投稿者</th>
                        <th class="px-4 py-3">日時</th>
                        <th class="px-4 py-3">地域</th>
                        <th class="px-4 py-3">ステータス</th>
                        <th class="px-4 py-3">操作</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-700">
                    <?php if (empty($observations)): ?>
                        <tr>
                            <td class="px-4 py-8 text-slate-500 text-center" colspan="7">該当する観察がありません</td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($observations as $obs): ?>
                            <tr class="hover:bg-slate-700/50 transition" x-data="{ deleting: false }">
                                <td class="px-4 py-3">
                                    <?php if (!empty($obs['photos'][0])): ?>
                                        <img src="<?php echo htmlspecialchars($obs['photos'][0]); ?>" alt="<?php echo htmlspecialchars($obs['taxon']['name'] ?? '観察写真'); ?>" class="w-10 h-10 rounded-lg object-cover" onerror="this.src='data:image/svg+xml,...'">
                                    <?php else: ?>
                                        <div class="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-slate-500">
                                            <i data-lucide="camera-off" class="w-4 h-4"></i>
                                        </div>
                                    <?php endif; ?>
                                </td>
                                <td class="px-4 py-3">
                                    <a href="../observation_detail.php?id=<?php echo $obs['id']; ?>" target="_blank" rel="noopener noreferrer" class="font-bold hover:text-emerald-400 transition">
                                        <?php echo htmlspecialchars($obs['taxon']['name'] ?? '未同定'); ?>
                                    </a>
                                    <?php if (!empty($obs['taxon']['common_name_ja'])): ?>
                                        <p class="text-xs text-slate-500"><?php echo htmlspecialchars($obs['taxon']['common_name_ja']); ?></p>
                                    <?php endif; ?>
                                </td>
                                <td class="px-4 py-3">
                                    <span class="text-slate-300"><?php echo htmlspecialchars($obs['user_name'] ?? 'Unknown'); ?></span>
                                </td>
                                <td class="px-4 py-3 text-slate-400 text-xs">
                                    <?php echo date('Y-m-d H:i', strtotime($obs['observed_at'] ?? $obs['created_at'] ?? 'now')); ?>
                                </td>
                                <td class="px-4 py-3 text-slate-400 text-xs">
                                    <?php echo htmlspecialchars($obs['municipality'] ?? $obs['prefecture'] ?? '-'); ?>
                                </td>
                                <td class="px-4 py-3">
                                    <?php
                                    $status = $obs['status'] ?? 'Pending';
                                    $colors = [
                                        'Research Grade' => 'bg-emerald-500/10 text-emerald-400',
                                        '研究用' => 'bg-emerald-500/10 text-emerald-400',
                                        '要同定' => 'bg-yellow-500/10 text-yellow-400',
                                        '未同定' => 'bg-slate-500/10 text-slate-400',
                                        'Needs ID' => 'bg-yellow-500/10 text-yellow-400',
                                        'hidden' => 'bg-red-500/10 text-red-400',
                                    ];
                                    $colorClass = $colors[$status] ?? 'bg-slate-700 text-slate-400';
                                    ?>
                                    <span class="px-2 py-1 rounded text-[10px] font-bold <?php echo $colorClass; ?>"><?php echo htmlspecialchars($status); ?></span>
                                </td>
                                <td class="px-4 py-3">
                                    <div class="flex items-center gap-2">
                                        <a href="../observation_detail.php?id=<?php echo $obs['id']; ?>" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg hover:bg-slate-600 transition text-slate-400 hover:text-white" title="詳細">
                                            <i data-lucide="external-link" class="w-4 h-4"></i>
                                        </a>
                                        <button @click="if(confirm('この観察を非表示にしますか？')) {
                                    deleting = true;
                                    fetch('../api/admin_action.php', {
                                        method: 'POST',
                                        headers: {'Content-Type': 'application/json'},
                                        body: JSON.stringify({action: 'hide', target_id: '<?php echo $obs['id']; ?>', target_type: 'observation'})
                                    }).then(r => r.json()).then(d => {
                                        if(d.success) location.reload();
                                        else { alert(d.message || 'Error'); deleting = false; }
                                    }).catch(() => { alert('Network error'); deleting = false; });
                                }" :disabled="deleting" class="p-1.5 rounded-lg hover:bg-red-500/20 transition text-slate-400 hover:text-red-400 disabled:opacity-50" title="非表示">
                                            <i data-lucide="eye-off" class="w-4 h-4"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <?php if ($totalPages > 1): ?>
            <div class="flex justify-center gap-2 mt-6">
                <?php if ($page > 1): ?>
                    <a href="?page=<?php echo $page - 1; ?>&status=<?php echo urlencode($statusFilter); ?>&q=<?php echo urlencode($search); ?>" class="px-4 py-2 bg-slate-800 rounded-lg text-sm font-bold hover:bg-slate-700 transition">← 前</a>
                <?php endif; ?>
                <span class="px-4 py-2 text-sm text-slate-400"><?php echo $page; ?> / <?php echo $totalPages; ?></span>
                <?php if ($page < $totalPages): ?>
                    <a href="?page=<?php echo $page + 1; ?>&status=<?php echo urlencode($statusFilter); ?>&q=<?php echo urlencode($search); ?>" class="px-4 py-2 bg-slate-800 rounded-lg text-sm font-bold hover:bg-slate-700 transition">次 →</a>
                <?php endif; ?>
            </div>
        <?php endif; ?>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>
