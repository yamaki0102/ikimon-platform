<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/UserStore.php';
require_once __DIR__ . '/../../libs/Moderation.php';
Auth::init();
Auth::requireRole('Analyst');

$currentUser = Auth::user();

// Get moderation data
$modStats = Moderation::getStats();
$pendingFlags = Moderation::getFlags('pending');
$resolvedFlags = Moderation::getFlags('resolved');
$bannedIds = Moderation::getBannedUserIds();

// Tab
$tab = $_GET['tab'] ?? 'flags';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php $adminTitle = 'モデレーション';
    include __DIR__ . '/components/head.php'; ?>
</head>

<body class="flex h-screen overflow-hidden">

    <?php $adminPage = 'moderation';
    $pendingFlags_count = count($pendingFlags);
    include __DIR__ . '/components/sidebar.php'; ?>

    <!-- Main -->
    <main class="flex-1 overflow-y-auto p-6 md:p-8">
        <header class="mb-6">
            <h1 class="text-2xl font-bold">モデレーション</h1>
            <p class="text-sm text-slate-400 mt-1">通報管理・コンテンツ非表示・ShadowBan</p>
        </header>

        <!-- Stats Row -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p class="text-xs text-slate-400 font-bold uppercase">未処理通報</p>
                <p class="text-2xl font-black <?php echo count($pendingFlags) > 0 ? 'text-red-400' : 'text-slate-500'; ?>"><?php echo count($pendingFlags); ?></p>
            </div>
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p class="text-xs text-slate-400 font-bold uppercase">解決済み</p>
                <p class="text-2xl font-black text-emerald-400"><?php echo count($resolvedFlags); ?></p>
            </div>
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p class="text-xs text-slate-400 font-bold uppercase">非表示コンテンツ</p>
                <p class="text-2xl font-black text-yellow-400"><?php echo $modStats['hidden_content'] ?? 0; ?></p>
            </div>
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <p class="text-xs text-slate-400 font-bold uppercase">ShadowBan中</p>
                <p class="text-2xl font-black text-slate-400"><?php echo count($bannedIds); ?></p>
            </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-4 mb-6 border-b border-slate-700">
            <a href="?tab=flags" class="px-4 py-3 text-sm font-bold transition <?php echo $tab === 'flags' ? 'text-white border-b-2 border-emerald-500' : 'text-slate-400 hover:text-white'; ?>">
                通報 <?php if (count($pendingFlags) > 0): ?><span class="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full"><?php echo count($pendingFlags); ?></span><?php endif; ?>
            </a>
            <a href="?tab=banned" class="px-4 py-3 text-sm font-bold transition <?php echo $tab === 'banned' ? 'text-white border-b-2 border-emerald-500' : 'text-slate-400 hover:text-white'; ?>">
                BAN中ユーザー (<?php echo count($bannedIds); ?>)
            </a>
            <a href="?tab=resolved" class="px-4 py-3 text-sm font-bold transition <?php echo $tab === 'resolved' ? 'text-white border-b-2 border-emerald-500' : 'text-slate-400 hover:text-white'; ?>">
                解決済み (<?php echo count($resolvedFlags); ?>)
            </a>
        </div>

        <!-- Tab: Pending Flags -->
        <?php if ($tab === 'flags'): ?>
            <?php if (empty($pendingFlags)): ?>
                <div class="flex flex-col items-center justify-center h-48 text-slate-500">
                    <i data-lucide="shield-check" class="w-16 h-16 mb-4 opacity-30"></i>
                    <p class="font-bold">未処理の通報はありません</p>
                    <p class="text-sm mt-1">Great job keeping the community safe! 🎉</p>
                </div>
            <?php else: ?>
                <div class="space-y-4">
                    <?php foreach ($pendingFlags as $flag): ?>
                        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700" x-data="{ processing: false, resolved: false }" x-show="!resolved" x-transition>
                            <div class="flex items-start gap-4">
                                <div class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                                    <i data-lucide="alert-triangle" class="w-5 h-5"></i>
                                </div>
                                <div class="flex-1">
                                    <div class="flex items-center gap-3 mb-2">
                                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-700 text-slate-300"><?php echo htmlspecialchars($flag['target_type'] ?? 'unknown'); ?></span>
                                        <span class="text-xs text-slate-500"><?php echo date('Y-m-d H:i', strtotime($flag['created_at'] ?? 'now')); ?></span>
                                    </div>
                                    <h3 class="font-bold mb-1">理由: <span class="text-red-400"><?php echo htmlspecialchars($flag['reason'] ?? '未指定'); ?></span></h3>
                                    <?php if (!empty($flag['details'])): ?>
                                        <p class="text-sm text-slate-400 mb-2"><?php echo htmlspecialchars($flag['details']); ?></p>
                                    <?php endif; ?>
                                    <p class="text-xs text-slate-500 mb-4">
                                        対象ID: <a href="../observation_detail.php?id=<?php echo $flag['target_id'] ?? ''; ?>" target="_blank" class="underline hover:text-white"><?php echo htmlspecialchars($flag['target_id'] ?? ''); ?></a>
                                        | 通報者: <?php echo htmlspecialchars($flag['reporter_id'] ?? 'anonymous'); ?>
                                    </p>
                                    <div class="flex gap-3">
                                        <button @click="if(!confirm('コンテンツを非表示にしますか？')) return;
                                processing = true;
                                fetch('../api/admin_action.php', {
                                    method: 'POST', headers: {'Content-Type': 'application/json'},
                                    body: JSON.stringify({action: 'hide', flag_id: '<?php echo $flag['id']; ?>'})
                                }).then(r=>r.json()).then(d=>{
                                    if(d.success) resolved = true; else alert(d.message||'Error');
                                    processing = false;
                                }).catch(()=>{ alert('Network error'); processing = false; });"
                                            :disabled="processing"
                                            class="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-bold transition flex items-center gap-2 disabled:opacity-50">
                                            <i data-lucide="eye-off" class="w-4 h-4"></i>
                                            <span x-text="processing ? '処理中...' : '非表示にする'"></span>
                                        </button>
                                        <button @click="if(!confirm('この通報を棄却しますか？')) return;
                                processing = true;
                                fetch('../api/admin_action.php', {
                                    method: 'POST', headers: {'Content-Type': 'application/json'},
                                    body: JSON.stringify({action: 'dismiss', flag_id: '<?php echo $flag['id']; ?>'})
                                }).then(r=>r.json()).then(d=>{
                                    if(d.success) resolved = true; else alert(d.message||'Error');
                                    processing = false;
                                }).catch(()=>{ alert('Network error'); processing = false; });"
                                            :disabled="processing"
                                            class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-bold transition flex items-center gap-2 disabled:opacity-50">
                                            <i data-lucide="check" class="w-4 h-4"></i> 棄却
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        <?php endif; ?>

        <!-- Tab: Banned Users -->
        <?php if ($tab === 'banned'): ?>
            <?php if (empty($bannedIds)): ?>
                <div class="flex flex-col items-center justify-center h-48 text-slate-500">
                    <i data-lucide="users" class="w-16 h-16 mb-4 opacity-30"></i>
                    <p class="font-bold">BAN中のユーザーはいません</p>
                </div>
            <?php else: ?>
                <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-slate-400 uppercase bg-slate-900/50">
                            <tr>
                                <th class="px-4 py-3">ユーザーID</th>
                                <th class="px-4 py-3">BAN理由</th>
                                <th class="px-4 py-3">BAN日時</th>
                                <th class="px-4 py-3">操作</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-700">
                            <?php foreach ($bannedIds as $bannedUserId): ?>
                                <?php $banRecord = Moderation::getBanRecord($bannedUserId); ?>
                                <tr x-data="{ unbanning: false }">
                                    <td class="px-4 py-3 font-bold"><?php echo htmlspecialchars($bannedUserId); ?></td>
                                    <td class="px-4 py-3 text-slate-400"><?php echo htmlspecialchars($banRecord['reason'] ?? '—'); ?></td>
                                    <td class="px-4 py-3 text-slate-400 text-xs"><?php echo isset($banRecord['banned_at']) ? date('Y-m-d H:i', strtotime($banRecord['banned_at'])) : '—'; ?></td>
                                    <td class="px-4 py-3">
                                        <button @click="if(!confirm('ShadowBanを解除しますか？')) return;
                                unbanning = true;
                                fetch('../api/admin/toggle_ban.php', {
                                    method: 'POST', headers: {'Content-Type': 'application/json'},
                                    body: JSON.stringify({user_id: '<?php echo $bannedUserId; ?>', action: 'unban'})
                                }).then(r=>r.json()).then(d=>{
                                    if(d.success) location.reload(); else alert(d.message||'Error');
                                    unbanning = false;
                                }).catch(()=>{ alert('Network error'); unbanning = false; });"
                                            :disabled="unbanning"
                                            class="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-xs font-bold transition disabled:opacity-50">
                                            <span x-text="unbanning ? '処理中...' : '解除'"></span>
                                        </button>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
        <?php endif; ?>

        <!-- Tab: Resolved -->
        <?php if ($tab === 'resolved'): ?>
            <?php if (empty($resolvedFlags)): ?>
                <div class="flex flex-col items-center justify-center h-48 text-slate-500">
                    <p class="font-bold">解決済みの通報はありません</p>
                </div>
            <?php else: ?>
                <div class="space-y-3">
                    <?php foreach (array_slice($resolvedFlags, 0, 20) as $flag): ?>
                        <div class="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                    <i data-lucide="check-circle" class="w-4 h-4"></i>
                                </div>
                                <div class="flex-1">
                                    <p class="text-sm font-bold"><?php echo htmlspecialchars($flag['reason'] ?? '—'); ?></p>
                                    <p class="text-xs text-slate-500">
                                        <?php echo htmlspecialchars($flag['target_type'] ?? ''); ?> |
                                        解決: <?php echo htmlspecialchars($flag['resolution'] ?? '—'); ?> |
                                        <?php echo date('Y-m-d', strtotime($flag['resolved_at'] ?? $flag['created_at'] ?? 'now')); ?>
                                    </p>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        <?php endif; ?>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>