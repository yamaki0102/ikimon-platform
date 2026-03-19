<?php
/**
 * ID Center — 同定者ファースト ランディングページ
 *
 * 同定者向けのパーソナライズドダッシュボード。
 * スマートキューで最適な同定候補を提示し、
 * 同定者のモチベーションを可視化する。
 *
 * Phase 15B: Identifier-First UI
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/DataQuality.php';
require_once __DIR__ . '/../libs/DataStageManager.php';
require_once __DIR__ . '/../libs/TrustLevel.php';
require_once __DIR__ . '/../libs/IdentifierQueue.php';

Auth::init();
$currentUser = Auth::user();

if (!$currentUser) {
    header('Location: login.php');
    exit;
}

$userId = $currentUser['id'] ?? '';

// --- データ取得 ---

// ユーザーの同定実績
$allObs = DataStore::fetchAll('observations');
$myIdCount = 0;
$myAgreedCount = 0;
$myRecentIds = [];

foreach ($allObs as $obs) {
    if (($obs['user_id'] ?? '') === $userId) continue;
    foreach ($obs['identifications'] ?? [] as $id) {
        if (($id['user_id'] ?? '') !== $userId) continue;
        $myIdCount++;
        $consensusTaxon = $obs['taxon']['name'] ?? '';
        $idTaxon = $id['taxon_name'] ?? '';
        if ($consensusTaxon && $idTaxon && $consensusTaxon === $idTaxon) {
            $myAgreedCount++;
        }
        $myRecentIds[] = [
            'obs_id' => $obs['id'] ?? '',
            'taxon' => $idTaxon,
            'date' => $id['created_at'] ?? $obs['observed_at'] ?? '',
            'agreed' => $consensusTaxon === $idTaxon,
            'photo' => ($obs['photos'][0]['url'] ?? $obs['photos'][0]['path'] ?? '') ?: null,
        ];
    }
}
usort($myRecentIds, fn($a, $b) => strcmp($b['date'], $a['date']));
$myRecentIds = array_slice($myRecentIds, 0, 5);

$agreementRate = $myIdCount > 0 ? round($myAgreedCount / $myIdCount * 100) : 0;

// ランクとエキスパティーズ
$trustLevel = TrustLevel::calculate($userId);
$rank = TrustLevel::getRankInfo($trustLevel);
$expertise = DataQuality::getUserExpertise($userId);
$topExpertise = array_slice($expertise, 0, 5, true);

// キュー統計
$queueStats = IdentifierQueue::getQueueStats();

// パーソナライズドキュー（トップ5のプレビュー）
$queue = IdentifierQueue::buildQueue($userId, 5);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php
    $meta_title = "同定センター | ikimon.life";
    include __DIR__ . '/components/meta.php';
    ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
</head>
<body class="bg-[#050505] text-white min-h-screen">

<?php include __DIR__ . '/components/navbar.php'; ?>

<main class="max-w-5xl mx-auto px-4 py-6 space-y-6">

    <!-- ヘッダー -->
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-xl font-black tracking-tight flex items-center gap-2">
                <i data-lucide="scan-search" class="w-6 h-6 text-[var(--color-primary)]"></i>
                同定センター
            </h1>
            <p class="text-sm text-gray-500 mt-1">キミの目が、データの品質を決める</p>
        </div>
        <a href="id_workbench.php" class="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-bold rounded-lg hover:opacity-90 transition flex items-center gap-2">
            <i data-lucide="layout-dashboard" class="w-4 h-4"></i>
            ワークベンチを開く
        </a>
    </div>

    <!-- ユーザー同定カード -->
    <div class="bg-[#0a0d14] rounded-2xl border border-white/5 p-5">
        <div class="flex items-center gap-4 mb-4">
            <div class="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-purple-600 flex items-center justify-center text-2xl">
                <?= $rank['icon'] ?>
            </div>
            <div>
                <div class="font-bold text-lg"><?= htmlspecialchars($currentUser['display_name'] ?? $currentUser['username'] ?? 'User', ENT_QUOTES) ?></div>
                <div class="text-sm <?= $rank['color'] ?>"><?= $rank['icon'] ?> <?= htmlspecialchars($rank['label'], ENT_QUOTES) ?></div>
            </div>
        </div>

        <div class="grid grid-cols-3 gap-4 text-center">
            <div class="bg-white/5 rounded-xl p-3">
                <div class="text-2xl font-black"><?= number_format($myIdCount) ?></div>
                <div class="text-xs text-gray-500">同定数</div>
            </div>
            <div class="bg-white/5 rounded-xl p-3">
                <div class="text-2xl font-black <?= $agreementRate >= 70 ? 'text-green-400' : ($agreementRate >= 50 ? 'text-amber-400' : 'text-gray-400') ?>"><?= $agreementRate ?>%</div>
                <div class="text-xs text-gray-500">合意率</div>
            </div>
            <div class="bg-white/5 rounded-xl p-3">
                <div class="text-2xl font-black text-amber-400"><?= number_format($queueStats['total_needs_id']) ?></div>
                <div class="text-xs text-gray-500">同定待ち</div>
            </div>
        </div>

        <?php if (!empty($topExpertise)): ?>
        <div class="mt-4">
            <div class="text-xs text-gray-500 mb-2">得意分類群</div>
            <div class="flex flex-wrap gap-2">
                <?php foreach ($topExpertise as $order => $score): ?>
                    <span class="text-xs px-2 py-1 bg-white/5 border border-white/10 rounded-full text-gray-300">
                        <?= htmlspecialchars($order, ENT_QUOTES) ?>
                        <span class="text-gray-600 ml-1"><?= $score ?></span>
                    </span>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>
    </div>

    <!-- スマートキュー プレビュー -->
    <section>
        <div class="flex items-center justify-between mb-3">
            <h2 class="font-bold flex items-center gap-2">
                <i data-lucide="sparkles" class="w-4 h-4 text-amber-400"></i>
                キミにおすすめ
            </h2>
            <?php if ($queueStats['near_rg'] > 0): ?>
                <span class="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">
                    あと1人でRG: <?= $queueStats['near_rg'] ?>件
                </span>
            <?php endif; ?>
        </div>

        <?php if (empty($queue)): ?>
            <div class="bg-[#0a0d14] rounded-2xl border border-white/5 p-8 text-center">
                <i data-lucide="check-circle-2" class="w-10 h-10 mx-auto mb-2 text-green-500"></i>
                <p class="text-gray-400">現在おすすめの同定候補はありません</p>
                <p class="text-xs text-gray-600 mt-1">新しい観察が投稿されるとここに表示されます</p>
            </div>
        <?php else: ?>
            <div class="space-y-2">
                <?php foreach ($queue as $item):
                    $obs = $item['observation'];
                    $photo = $obs['photos'][0]['url'] ?? $obs['photos'][0]['path'] ?? null;
                ?>
                    <a href="observation_detail.php?id=<?= urlencode($obs['id'] ?? '') ?>"
                       class="block bg-[#0a0d14] rounded-xl border border-white/5 hover:border-white/15 transition p-3 group">
                        <div class="flex items-center gap-3">
                            <?php if ($photo): ?>
                                <img src="<?= htmlspecialchars($photo, ENT_QUOTES) ?>"
                                     class="w-14 h-14 rounded-lg object-cover shrink-0" loading="lazy" alt="">
                            <?php else: ?>
                                <div class="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                    <i data-lucide="image-off" class="w-5 h-5 text-gray-700"></i>
                                </div>
                            <?php endif; ?>
                            <div class="flex-1 min-w-0">
                                <div class="font-medium text-sm truncate group-hover:text-[var(--color-primary)] transition">
                                    <?= htmlspecialchars($obs['species_name'] ?? $obs['taxon']['name'] ?? '未同定', ENT_QUOTES) ?>
                                </div>
                                <div class="text-xs text-gray-500 truncate">
                                    <?= htmlspecialchars($obs['taxon']['scientific_name'] ?? '', ENT_QUOTES) ?>
                                </div>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <?php foreach ($item['reasons'] as $reason): ?>
                                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500"><?= htmlspecialchars($reason, ENT_QUOTES) ?></span>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                            <div class="text-right shrink-0">
                                <div class="text-xs text-gray-600"><?= htmlspecialchars(substr($obs['observed_at'] ?? '', 0, 10), ENT_QUOTES) ?></div>
                                <div class="text-xs font-mono text-amber-500/70 mt-0.5">score <?= $item['score'] ?></div>
                            </div>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
            <a href="id_workbench.php" class="block text-center text-sm text-gray-500 hover:text-white mt-3 py-2 transition">
                もっと見る →
            </a>
        <?php endif; ?>
    </section>

    <!-- 最近の同定 -->
    <?php if (!empty($myRecentIds)): ?>
    <section>
        <h2 class="font-bold mb-3 flex items-center gap-2">
            <i data-lucide="history" class="w-4 h-4 text-gray-500"></i>
            最近の同定
        </h2>
        <div class="bg-[#0a0d14] rounded-2xl border border-white/5 divide-y divide-white/5">
            <?php foreach ($myRecentIds as $rid): ?>
                <a href="observation_detail.php?id=<?= urlencode($rid['obs_id']) ?>" class="flex items-center gap-3 p-3 hover:bg-white/5 transition">
                    <?php if ($rid['photo']): ?>
                        <img src="<?= htmlspecialchars($rid['photo'], ENT_QUOTES) ?>" class="w-10 h-10 rounded-lg object-cover" loading="lazy" alt="">
                    <?php else: ?>
                        <div class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                            <i data-lucide="image-off" class="w-4 h-4 text-gray-700"></i>
                        </div>
                    <?php endif; ?>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm truncate"><?= htmlspecialchars($rid['taxon'], ENT_QUOTES) ?></div>
                        <div class="text-xs text-gray-600"><?= htmlspecialchars(substr($rid['date'], 0, 10), ENT_QUOTES) ?></div>
                    </div>
                    <?php if ($rid['agreed']): ?>
                        <span class="text-green-500 text-xs">✓ 合意</span>
                    <?php else: ?>
                        <span class="text-gray-600 text-xs">保留中</span>
                    <?php endif; ?>
                </a>
            <?php endforeach; ?>
        </div>
    </section>
    <?php endif; ?>

    <!-- 分類群別キュー統計 -->
    <?php if (!empty($queueStats['by_group'])): ?>
    <section>
        <h2 class="font-bold mb-3 flex items-center gap-2">
            <i data-lucide="bar-chart-3" class="w-4 h-4 text-gray-500"></i>
            分類群別 同定待ち
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            <?php foreach (array_slice($queueStats['by_group'], 0, 8) as $group => $count): ?>
                <div class="bg-[#0a0d14] rounded-xl border border-white/5 p-3 text-center">
                    <div class="text-lg font-bold text-amber-400"><?= number_format($count) ?></div>
                    <div class="text-xs text-gray-500 truncate"><?= htmlspecialchars($group, ENT_QUOTES) ?></div>
                </div>
            <?php endforeach; ?>
        </div>
    </section>
    <?php endif; ?>

</main>

<?php include __DIR__ . '/components/footer.php'; ?>

<script>
    lucide.createIcons();
</script>
</body>
</html>
