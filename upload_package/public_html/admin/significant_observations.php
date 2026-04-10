<?php
/**
 * Admin: 重要観察アラート
 * AdminAlertManager が critical と判定した観察を一覧表示し、既読管理を行う。
 */
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/AdminAlertManager.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/CspNonce.php';

Auth::init();
Auth::requireRole('Analyst');
CspNonce::sendHeader();

$currentUser = Auth::user();

// 既読処理
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['mark_read'])) {
    $alertId = trim((string)($_POST['mark_read'] ?? ''));
    if ($alertId !== '') {
        AdminAlertManager::markRead($alertId);
    }
    header('Location: significant_observations.php');
    exit;
}

// アラート一覧取得
$showAll   = isset($_GET['all']);
$alerts    = AdminAlertManager::list(['status' => $showAll ? 'all' : 'unread', 'limit' => 100]);
$unreadCount = AdminAlertManager::unreadCount();

// sidebar 向け
$pendingFlags = 0;
$bizPending   = 0;
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php $adminTitle = '重要観察アラート';
    include __DIR__ . '/components/head.php'; ?>
    <script src="/assets/js/tailwind.3.4.17.min.js"></script>
</head>
<body class="flex h-screen overflow-hidden">
    <?php $adminPage = 'significant';
    include __DIR__ . '/components/sidebar.php'; ?>

    <main class="flex-1 overflow-y-auto p-8">
        <header class="flex justify-between items-center mb-8">
            <div>
                <h1 class="text-2xl font-bold flex items-center gap-3">
                    <i data-lucide="alert-triangle" class="w-6 h-6 text-amber-400"></i>
                    重要観察アラート
                    <?php if ($unreadCount > 0): ?>
                        <span class="bg-red-500 text-white text-sm px-2.5 py-0.5 rounded-full font-bold"><?php echo $unreadCount; ?></span>
                    <?php endif; ?>
                </h1>
                <p class="text-slate-400 text-sm mt-1">significance_score ≥ 60 の critical 観察。希少種・地域初記録・外来種が対象。</p>
            </div>
            <div class="flex gap-3">
                <?php if ($showAll): ?>
                    <a href="significant_observations.php" class="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-bold hover:bg-slate-600 transition">未読のみ表示</a>
                <?php else: ?>
                    <a href="?all=1" class="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-bold hover:bg-slate-600 transition">全件表示</a>
                <?php endif; ?>
            </div>
        </header>

        <?php if (empty($alerts)): ?>
            <div class="bg-slate-800 rounded-2xl border border-slate-700 p-12 text-center">
                <i data-lucide="check-circle-2" class="w-12 h-12 text-emerald-400 mx-auto mb-4"></i>
                <p class="text-slate-400">
                    <?php echo $showAll ? '重要観察アラートはまだありません。' : '未読の重要観察アラートはありません。'; ?>
                </p>
                <?php if (!$showAll): ?>
                    <a href="?all=1" class="text-sm text-emerald-400 hover:underline mt-2 inline-block">既読を含む全件を見る →</a>
                <?php endif; ?>
            </div>
        <?php else: ?>
            <div class="space-y-4">
                <?php foreach ($alerts as $alert):
                    $isUnread    = ($alert['status'] ?? 'unread') === 'unread';
                    $score       = (int)($alert['significance_score'] ?? 0);
                    $redlistCat  = $alert['redlist_category'] ?? null;
                    $distRarity  = $alert['distribution_rarity'] ?? null;
                    $isInvasive  = (bool)($alert['is_invasive'] ?? false);
                    $obsId       = $alert['observation_id'] ?? '';
                    $taxon       = htmlspecialchars($alert['taxon_name'] ?? '不明', ENT_QUOTES, 'UTF-8');
                    $pref        = htmlspecialchars($alert['prefecture'] ?? '', ENT_QUOTES, 'UTF-8');
                    $municipality = htmlspecialchars($alert['municipality'] ?? '', ENT_QUOTES, 'UTF-8');
                    $observedAt  = htmlspecialchars($alert['observed_at'] ?? '', ENT_QUOTES, 'UTF-8');
                    $createdAt   = htmlspecialchars($alert['created_at'] ?? '', ENT_QUOTES, 'UTF-8');

                    $borderColor = $score >= 80 ? 'border-red-500/50' : ($score >= 60 ? 'border-amber-500/50' : 'border-slate-700');
                    $badgeColor  = $score >= 80 ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300';
                ?>
                <div class="bg-slate-800 rounded-2xl border <?php echo $borderColor; ?> p-6 <?php echo $isUnread ? 'ring-1 ring-amber-500/30' : 'opacity-70'; ?>">
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-3 flex-wrap mb-2">
                                <?php if ($isUnread): ?>
                                    <span class="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                                <?php endif; ?>
                                <span class="text-lg font-bold text-white truncate"><?php echo $taxon; ?></span>

                                <!-- significance score バッジ -->
                                <span class="text-xs font-bold px-2.5 py-1 rounded-full <?php echo $badgeColor; ?>">
                                    Score <?php echo $score; ?>
                                </span>

                                <!-- RedList バッジ -->
                                <?php if ($redlistCat): ?>
                                    <?php $rlColors = ['CR' => 'bg-red-600 text-white', 'EN' => 'bg-orange-500 text-white', 'CR+EN' => 'bg-red-600 text-white', 'VU' => 'bg-yellow-500 text-slate-900', 'NT' => 'bg-green-600 text-white', 'DD' => 'bg-slate-500 text-white']; ?>
                                    <span class="text-xs font-bold px-2 py-0.5 rounded <?php echo $rlColors[$redlistCat] ?? 'bg-slate-600 text-white'; ?>">
                                        <?php echo htmlspecialchars($redlistCat, ENT_QUOTES, 'UTF-8'); ?>
                                    </span>
                                <?php endif; ?>

                                <!-- 地域希少性バッジ -->
                                <?php if ($distRarity === 'area_first'): ?>
                                    <span class="text-xs font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">地域初記録候補</span>
                                <?php elseif ($distRarity === 'rare'): ?>
                                    <span class="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">地域希少</span>
                                <?php endif; ?>

                                <!-- 外来種バッジ -->
                                <?php if ($isInvasive): ?>
                                    <span class="text-xs font-bold px-2 py-0.5 rounded bg-rose-600/20 text-rose-300">外来種</span>
                                <?php endif; ?>
                            </div>

                            <!-- 場所・日時 -->
                            <p class="text-slate-400 text-sm mb-3">
                                <?php echo $municipality; ?><?php echo $pref ? ' ' . $pref : ''; ?>
                                <?php if ($observedAt): ?> ・ <?php echo $observedAt; ?><?php endif; ?>
                            </p>

                            <!-- 判定理由 -->
                            <?php if (!empty($alert['reasons'])): ?>
                                <div class="flex flex-wrap gap-2">
                                    <?php foreach (array_slice($alert['reasons'], 0, 4) as $reason): ?>
                                        <span class="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded"><?php echo htmlspecialchars($reason, ENT_QUOTES, 'UTF-8'); ?></span>
                                    <?php endforeach; ?>
                                </div>
                            <?php endif; ?>
                        </div>

                        <!-- アクションボタン -->
                        <div class="flex flex-col gap-2 shrink-0">
                            <?php if ($obsId): ?>
                                <a href="../observation_detail.php?id=<?php echo urlencode($obsId); ?>"
                                   target="_blank"
                                   class="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition text-center">
                                    観察を確認
                                </a>
                            <?php endif; ?>
                            <?php if ($isUnread): ?>
                                <form method="POST">
                                    <input type="hidden" name="mark_read" value="<?php echo htmlspecialchars($alert['id'] ?? '', ENT_QUOTES, 'UTF-8'); ?>">
                                    <button type="submit" class="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-lg transition">
                                        既読にする
                                    </button>
                                </form>
                            <?php else: ?>
                                <span class="text-xs text-slate-600 text-center px-3 py-2">既読</span>
                            <?php endif; ?>
                        </div>
                    </div>

                    <div class="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-600">
                        アラート登録: <?php echo $createdAt; ?>
                        <?php if (!empty($alert['read_at'])): ?> ・ 既読: <?php echo htmlspecialchars($alert['read_at'], ENT_QUOTES, 'UTF-8'); ?><?php endif; ?>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>
</html>
