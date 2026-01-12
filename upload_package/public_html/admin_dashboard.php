<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/Auth.php';

Auth::init();

// Simple Admin Check (For MVP: Allow Analyst or specific ID)
// Real implementation should have 'role' in user data
$user = Auth::user();
if (!$user || !in_array($user['rank'] ?? '', ['Analyst', 'Specialist'])) {
    // In production, return 403. For demo debug, maybe just redirect
    header('Location: index.php');
    exit;
}

$flags = DataStore::get('flags');
// Filter pending
$pending_flags = array_filter($flags, function($f) {
    return ($f['status'] ?? 'pending') === 'pending';
});
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php 
    $meta_title = "管理ダッシュボード";
    include __DIR__ . '/components/meta.php'; 
    ?>
</head>
<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">
    <div class="flex h-screen overflow-hidden">
        <!-- Sidebar -->
        <aside class="w-64 bg-white/5 border-r border-white/10 hidden md:flex flex-col">
            <div class="p-6">
                <h1 class="text-xl font-black italic tracking-tighter">ikimon <span class="text-[var(--color-primary)]">Admin</span></h1>
            </div>
            <nav class="flex-1 px-4 space-y-2">
                <a href="#" class="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 text-white font-bold">
                    <i data-lucide="flag" class="w-5 h-5"></i>
                    Reports
                    <span class="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full"><?php echo count($pending_flags); ?></span>
                </a>
                <a href="#" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 font-bold transition">
                    <i data-lucide="users" class="w-5 h-5"></i>
                    Users
                </a>
                <a href="#" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 font-bold transition">
                    <i data-lucide="settings" class="w-5 h-5"></i>
                    Settings
                </a>
            </nav>
            <div class="p-6 border-t border-white/10">
                <a href="index.php" class="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition">
                    <i data-lucide="arrow-left" class="w-4 h-4"></i> Back to App
                </a>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 overflow-y-auto p-8 md:p-12">
            <header class="flex items-center justify-between mb-12">
                <h2 class="text-3xl font-bold">Content Reports</h2>
                <div class="flex items-center gap-4">
                    <span class="text-sm font-bold text-gray-400"><?php echo $user['name']; ?> (Admin)</span>
                    <img src="<?php echo $user['avatar']; ?>" class="w-10 h-10 rounded-full border border-white/20">
                </div>
            </header>

            <?php if (empty($pending_flags)): ?>
            <div class="flex flex-col items-center justify-center h-64 text-gray-500">
                <i data-lucide="check-circle" class="w-16 h-16 mb-4 opacity-50"></i>
                <p class="font-bold">No pending reports.</p>
                <p class="text-sm">Great job keeping the community safe!</p>
            </div>
            <?php else: ?>
            <div class="space-y-4">
                <?php foreach ($pending_flags as $flag): ?>
                <div class="glass-card p-6 rounded-2xl flex items-start gap-6" x-data="{ 
                    processing: false,
                    resolved: false,
                    async action(type) {
                        if(!confirm('Are you sure?')) return;
                        this.processing = true;
                        try {
                            const res = await fetch('api/admin_action.php', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ action: type, flag_id: '<?php echo $flag['id']; ?>' })
                            });
                            const data = await res.json();
                            if(data.success) {
                                this.resolved = true;
                            } else {
                                alert('Error: ' + data.message);
                            }
                        } catch(e) {
                            alert('Network error');
                        } finally {
                            this.processing = false;
                        }
                    }
                }" x-show="!resolved" x-transition>
                    <div class="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                        <i data-lucide="alert-triangle"></i>
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between mb-2">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/10 text-gray-400">
                                <?php echo htmlspecialchars($flag['target_type']); ?>
                            </span>
                            <span class="text-sm text-gray-500"><?php echo date('Y-m-d H:i', strtotime($flag['created_at'])); ?></span>
                        </div>
                        <h3 class="font-bold text-lg text-white mb-2">Reason: <span class="text-red-400"><?php echo htmlspecialchars($flag['reason']); ?></span></h3>
                        <p class="text-sm text-gray-400 mb-4">Target ID: <a href="observation_detail.php?id=<?php echo $flag['target_id']; ?>" target="_blank" class="underline hover:text-white"><?php echo $flag['target_id']; ?></a></p>
                        
                        <div class="flex gap-4">
                            <button @click="action('hide')" :disabled="processing" class="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-bold transition flex items-center gap-2 disabled:opacity-50">
                                <i data-lucide="eye-off" class="w-4 h-4"></i>
                                <span x-text="processing ? 'Processing...' : 'Hide Content'"></span>
                            </button>
                            <button @click="action('dismiss')" :disabled="processing" class="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition flex items-center gap-2 disabled:opacity-50">
                                <i data-lucide="check" class="w-4 h-4"></i> Dismiss
                            </button>
                        </div>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </main>
    </div>
    <script>
        lucide.createIcons();
    </script>
</body>
</html>
