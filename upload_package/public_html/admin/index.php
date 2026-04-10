<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/UserStore.php';
require_once __DIR__ . '/../../libs/Moderation.php';
require_once __DIR__ . '/../../libs/BioUtils.php';
require_once __DIR__ . '/../../libs/BusinessApplicationManager.php';
require_once __DIR__ . '/../../libs/AdminAlertManager.php';
Auth::init();

Auth::requireRole('Analyst');

$currentUser = Auth::user();
$observations = DataStore::fetchAll('observations');
usort($observations, function ($a, $b) {
    return strtotime($b['observed_at'] ?? 0) <=> strtotime($a['observed_at'] ?? 0);
});
$totalObservations = count($observations);
$pendingCount = count(array_filter($observations, function ($o) {
    return BioUtils::displayStatus($o, '') === '要同定';
}));
$rgCount = count(array_filter($observations, function ($o) {
    return BioUtils::isResearchGradeObservation($o);
}));
$thisMonthCount = count(array_filter($observations, function ($o) {
    return date('Y-m', strtotime($o['observed_at'] ?? '2000-01-01')) === date('Y-m');
}));
$recentObservations = array_slice($observations, 0, 10);

$users = UserStore::getAll(false);
$totalUsers = count($users);
$specialistCount = count(array_filter($users, function ($u) {
    $role = Auth::getRole($u);
    return in_array($role, ['Specialist', 'Analyst', 'Admin'], true);
}));

// Moderation stats
$modStats = Moderation::getStats();
$pendingFlags = $modStats['active_flags'] ?? 0;
$bannedCount = $modStats['active_bans'] ?? 0;
$bizStats = BusinessApplicationManager::stats();
$bizPending = ($bizStats['statuses']['new'] ?? 0) + ($bizStats['statuses']['reviewing'] ?? 0);
$significantAlertCount = AdminAlertManager::unreadCount();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php $adminTitle = 'System Overview';
    include __DIR__ . '/components/head.php'; ?>
</head>

<body class="flex h-screen overflow-hidden">

    <?php $adminPage = 'index';
    include __DIR__ . '/components/sidebar.php'; ?>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto p-8">
        <header class="flex justify-between items-center mb-8">
            <h1 class="text-2xl font-bold">System Overview</h1>
            <div class="flex gap-4">
                <button class="px-4 py-2 bg-slate-800 rounded-lg text-sm font-bold hover:bg-slate-700 transition">Settings</button>
            </div>
        </header>

        <!-- KPI Cards Row 1 -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">総観察数</p>
                <p class="text-3xl font-black text-emerald-400"><?php echo number_format($totalObservations); ?></p>
            </div>
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">今月の投稿</p>
                <p class="text-3xl font-black text-cyan-400"><?php echo number_format($thisMonthCount); ?></p>
            </div>
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">研究利用可以上</p>
                <p class="text-3xl font-black text-green-400"><?php echo number_format($rgCount); ?></p>
                <p class="text-xs text-slate-500 mt-1"><?php echo $totalObservations > 0 ? round($rgCount / $totalObservations * 100) : 0; ?>%</p>
            </div>
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">同定待ち</p>
                <p class="text-3xl font-black <?php echo $pendingCount > 10 ? 'text-yellow-400' : 'text-white'; ?>"><?php echo $pendingCount; ?></p>
            </div>
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">B2B新規受付</p>
                <p class="text-3xl font-black <?php echo $bizPending > 0 ? 'text-emerald-400' : 'text-slate-500'; ?>"><?php echo $bizPending; ?></p>
                <a href="business_applications.php" class="text-xs text-emerald-400 hover:underline mt-1 inline-block">確認 →</a>
            </div>
        </div>
        <!-- KPI Cards Row 2 -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-slate-800 p-5 rounded-2xl border <?php echo $significantAlertCount > 0 ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-slate-700'; ?>">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">重要観察アラート</p>
                <p class="text-3xl font-black <?php echo $significantAlertCount > 0 ? 'text-amber-400' : 'text-slate-500'; ?>"><?php echo $significantAlertCount; ?></p>
                <?php if ($significantAlertCount > 0): ?>
                    <a href="significant_observations.php" class="text-xs text-amber-400 hover:underline mt-1 inline-block">確認 →</a>
                <?php else: ?>
                    <p class="text-xs text-slate-600 mt-1">未読なし</p>
                <?php endif; ?>
            </div>
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">総ユーザー数</p>
                <p class="text-3xl font-black text-blue-400"><?php echo number_format($totalUsers); ?></p>
            </div>
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">専門家</p>
                <p class="text-3xl font-black text-violet-400"><?php echo $specialistCount; ?></p>
            </div>
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">未処理通報</p>
                <p class="text-3xl font-black <?php echo $pendingFlags > 0 ? 'text-red-400' : 'text-slate-500'; ?>"><?php echo $pendingFlags; ?></p>
                <?php if ($pendingFlags > 0): ?>
                    <a href="moderation.php" class="text-xs text-red-400 hover:underline mt-1 inline-block">確認 →</a>
                <?php endif; ?>
            </div>
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">ShadowBan</p>
                <p class="text-3xl font-black text-slate-500"><?php echo $bannedCount; ?></p>
            </div>
        </div>

        <!-- Recent Activity Table -->
        <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div class="p-6 border-b border-slate-700">
                <h3 class="font-bold">Recent System Activity</h3>
            </div>
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-slate-400 uppercase bg-slate-900/50">
                    <tr>
                        <th class="px-6 py-4">Time</th>
                        <th class="px-6 py-4">User</th>
                        <th class="px-6 py-4">Action</th>
                        <th class="px-6 py-4">Status</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-700">
                    <?php if (count($recentObservations) === 0): ?>
                        <tr>
                            <td class="px-6 py-6 text-slate-500" colspan="4">Recent activity will appear here once observations are posted.</td>
                        </tr>
                    <?php else: ?>
                        <?php foreach (array_slice($recentObservations, 0, 6) as $obs): ?>
                            <?php $displayStatus = BioUtils::displayStatus($obs, 'Pending'); ?>
                            <tr>
                                <td class="px-6 py-4 text-slate-400"><?php echo htmlspecialchars($obs['observed_at'] ?? '-'); ?></td>
                                <td class="px-6 py-4 font-bold"><?php echo htmlspecialchars($obs['user_name'] ?? 'Unknown'); ?></td>
                                <td class="px-6 py-4">Uploaded <span class="text-slate-300"><?php echo htmlspecialchars($obs['taxon']['name'] ?? 'Unknown'); ?></span></td>
                                <td class="px-6 py-4">
                                    <?php if (BioUtils::isResearchGradeObservation($obs)): ?>
                                        <span class="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-bold"><?php echo htmlspecialchars($displayStatus); ?></span>
                                    <?php else: ?>
                                        <span class="px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 text-xs font-bold"><?php echo htmlspecialchars($displayStatus); ?></span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>
