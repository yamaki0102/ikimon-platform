<?php
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/UserStore.php';
Auth::init();

// Protect this area
Auth::requireRole('Analyst'); // Analysts and above can verify

$currentUser = Auth::user();
$observations = DataStore::fetchAll('observations');
usort($observations, function($a, $b) {
    return strtotime($b['observed_at'] ?? 0) <=> strtotime($a['observed_at'] ?? 0);
});
$totalObservations = count($observations);
$pendingCount = count(array_filter($observations, function($o) {
    return ($o['status'] ?? '') === 'Needs ID';
}));
$recentObservations = array_slice($observations, 0, 10);

$users = UserStore::getAll(false);
$specialistCount = count(array_filter($users, function($u) {
    $role = Auth::getRole($u);
    return in_array($role, ['Specialist', 'Analyst', 'Admin'], true);
}));
$tnfdReports = 0;
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ikimon Admin</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Montserrat:wght@800&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <style>
        body { font-family: 'Inter', sans-serif; background: #0f172a; color: #f1f5f9; }
        .font-brand { font-family: 'Montserrat', sans-serif; }
    </style>
</head>
<body class="flex h-screen overflow-hidden">
    
    <!-- Sidebar -->
    <aside class="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div class="p-6 flex items-center gap-3">
            <div class="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-brand font-black text-slate-900">i</div>
            <span class="font-brand font-black text-xl tracking-tight">ikimon <span class="text-xs text-slate-500 font-normal">Admin</span></span>
        </div>

        <nav class="flex-1 px-4 space-y-2">
            <a href="index.php" class="flex items-center gap-3 px-4 py-3 bg-slate-800 text-white rounded-xl font-bold transition">
                <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
                Dashboard
            </a>
            <a href="verification.php" class="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-bold transition">
                <i data-lucide="check-circle-2" class="w-5 h-5"></i>
                Verification
                <span class="ml-auto bg-emerald-500 text-black text-[10px] px-2 py-0.5 rounded-full">12</span>
            </a>
            <a href="users.php" class="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-bold transition">
                <i data-lucide="users" class="w-5 h-5"></i>
                Users & Roles
            </a>
            <a href="corporate.php" class="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-bold transition">
                <i data-lucide="building-2" class="w-5 h-5"></i>
                Corporate (TNFD)
            </a>
        </nav>

        <div class="p-4 border-t border-slate-800">
            <div class="flex items-center gap-3 px-4 py-2">
                <img src="<?php echo $currentUser['avatar']; ?>" class="w-8 h-8 rounded-full bg-slate-700">
                <div class="overflow-hidden">
                    <p class="text-sm font-bold truncate"><?php echo $currentUser['name']; ?></p>
                    <p class="text-xs text-slate-500 truncate"><?php echo htmlspecialchars(Auth::getRankLabel($currentUser)); ?></p>
                </div>
            </div>
            <a href="../logout.php" class="block mt-2 text-xs text-red-400 hover:text-red-300 px-4">Log Out</a>
        </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto p-8">
        <header class="flex justify-between items-center mb-8">
            <h1 class="text-2xl font-bold">System Overview</h1>
            <div class="flex gap-4">
                <button class="px-4 py-2 bg-slate-800 rounded-lg text-sm font-bold hover:bg-slate-700 transition">Settings</button>
            </div>
        </header>

        <!-- KPI Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">Pending Verifications</p>
                <p class="text-3xl font-black text-white"><?php echo $pendingCount; ?></p>
            </div>
            <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">Total Observations</p>
                <p class="text-3xl font-black text-emerald-400"><?php echo number_format($totalObservations); ?></p>
            </div>
            <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">Active Specialists</p>
                <p class="text-3xl font-black text-blue-400"><?php echo $specialistCount; ?></p>
            </div>
            <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">TNFD Reports</p>
                <p class="text-3xl font-black text-purple-400"><?php echo $tnfdReports; ?></p>
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
                    <tr>
                        <td class="px-6 py-4 text-slate-400"><?php echo htmlspecialchars($obs['observed_at'] ?? '-'); ?></td>
                        <td class="px-6 py-4 font-bold"><?php echo htmlspecialchars($obs['user_name'] ?? 'Unknown'); ?></td>
                        <td class="px-6 py-4">Uploaded <span class="text-slate-300"><?php echo htmlspecialchars($obs['taxon']['name'] ?? 'Unknown'); ?></span></td>
                        <td class="px-6 py-4">
                            <?php if (($obs['status'] ?? '') === 'Research Grade'): ?>
                                <span class="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-bold">Research</span>
                            <?php else: ?>
                                <span class="px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 text-xs font-bold"><?php echo htmlspecialchars($obs['status'] ?? 'Pending'); ?></span>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

    </main>

    <script>
        lucide.createIcons();
    </script>
</body>
</html>
