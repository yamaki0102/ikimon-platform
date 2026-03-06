<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/QuestManager.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/Services/UserStatsService.php';
require_once __DIR__ . '/../libs/Services/LibraryService.php';

Auth::init();
$currentUser = Auth::user();
$meta_title = 'ダッシュボード';

// Fetch Data
$latest_obs = DataStore::getLatest('observations', 5);

// Bibliographic Authority Stats
$bibStats = [
    'citations' => count(glob(DataStore::getBasePath() . '/library/index/*.json')),
    'papers'    => count(glob(DataStore::getBasePath() . '/library/papers/*.json')),
    'keys'      => count(glob(DataStore::getBasePath() . '/library/keys/*.json')),
    'books'     => count(glob(DataStore::getBasePath() . '/library/references/*.json')),
];

// Stats Calculation
$userStats = [
    'rank'      => '見習い',
    'score'     => 0,
    'territory' => 0.0,
];

if ($currentUser) {
    $userStats['score']         = $currentUser['score'] ?? 0;
    $userStats['rank']          = $currentUser['observer_rank']['rank']['name_ja'] ?? UserStatsService::calculateRank($userStats['score']);
    $userStats['territory']     = UserStatsService::getTerritoryArea($currentUser['id']);
    $userStats['observer_rank'] = $currentUser['observer_rank'] ?? null;
}

// Observer Rank data
$_ors          = $userStats['observer_rank'] ?? null;
$orsProgress   = $_ors ? ($_ors['progress'] ?? 0)         : UserStatsService::getProgressToNextRank($userStats['score']);
$orsNextThresh = $_ors ? ($_ors['next_threshold'] ?? null) : UserStatsService::getNextRankTarget($userStats['score']);
$orsRankIcon   = $_ors ? ($_ors['rank']['icon']    ?? '🌱') : '🌱';
$orsRankColor  = $_ors ? ($_ors['rank']['color']   ?? '#8bc34a') : '#8bc34a';
$orsRankName   = $_ors ? ($_ors['rank']['name_ja'] ?? '見習い')  : '見習い';

// Daily Quest
$activeQuests = QuestManager::getActiveQuests();
$dailyTarget  = !empty($activeQuests) ? $activeQuests[0] : null;

// Category tiles
$missions = [
    ['id' => 'insect', 'label' => '昆虫', 'icon' => 'bug',  'color' => 'emerald', 'count_done' => 12,  'count_total' => 450],
    ['id' => 'bird',   'label' => '鳥類', 'icon' => 'bird', 'color' => 'sky',     'count_done' => 45,  'count_total' => 120],
    ['id' => 'plant',  'label' => '植物', 'icon' => 'leaf', 'color' => 'green',   'count_done' => 102, 'count_total' => 1200],
    ['id' => 'herps',  'label' => '両爬', 'icon' => 'fish', 'color' => 'amber',   'count_done' => 3,   'count_total' => 45],
];
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>

<body class="js-loading pt-14 bg-base text-text font-body pb-20 md:pb-0">
    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">document.body.classList.remove('js-loading');</script>

    <main class="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <h1 class="sr-only">ダッシュボード</h1>

        <!-- 1. User Rank Card -->
        <?php if ($currentUser): ?>
        <section class="bg-elevated border border-border rounded-2xl p-4">
            <div class="flex items-center gap-4">
                <img src="<?= htmlspecialchars($currentUser['avatar']) ?>"
                     alt="<?= htmlspecialchars($currentUser['name'] ?? 'ユーザー') ?>のアバター"
                     class="w-14 h-14 rounded-xl object-cover border-2 border-border shadow-sm shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xl leading-none"><?= $orsRankIcon ?></span>
                        <span class="font-bold text-text truncate"><?= htmlspecialchars($currentUser['name']) ?></span>
                    </div>
                    <div class="text-xs text-muted mb-2"><?= htmlspecialchars($orsRankName) ?> · <?= number_format($userStats['score']) ?> pt</div>
                    <div class="flex items-center gap-2">
                        <div class="flex-1 h-2 bg-border rounded-full overflow-hidden">
                            <div class="h-full rounded-full transition-all duration-700"
                                 style="width: <?= min(100, round($orsProgress)) ?>%; background: <?= htmlspecialchars($orsRankColor) ?>;"></div>
                        </div>
                        <span class="text-xs text-muted font-mono shrink-0"><?= round($orsProgress) ?>%</span>
                    </div>
                    <?php if ($orsNextThresh): ?>
                    <div class="text-token-xs text-faint mt-1">次のランクまで <?= is_numeric($orsNextThresh) ? number_format($orsNextThresh) : htmlspecialchars($orsNextThresh) ?> pt</div>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Stats Row -->
            <div class="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3 text-center">
                <a href="profile.php" class="hover:bg-primary-surface rounded-xl py-1.5 transition">
                    <div class="text-lg font-black text-text"><?= number_format($userStats['score']) ?></div>
                    <div class="text-token-xs text-faint">スコア</div>
                </a>
                <a href="ikimon_walk.php" class="hover:bg-primary-surface rounded-xl py-1.5 transition">
                    <div class="text-lg font-black text-text"><?= number_format($userStats['territory'], 1) ?></div>
                    <div class="text-token-xs text-faint">km² 探索</div>
                </a>
                <a href="index.php" class="hover:bg-primary-surface rounded-xl py-1.5 transition">
                    <div class="text-lg font-black text-text"><?= count($latest_obs ?? []) ?></div>
                    <div class="text-token-xs text-faint">最新記録</div>
                </a>
            </div>
        </section>
        <?php endif; ?>

        <!-- 2. Quick Actions -->
        <section class="grid grid-cols-3 gap-3">
            <a href="post.php"
               class="flex flex-col items-center gap-2 bg-primary text-white rounded-2xl py-4 px-3 text-center shadow-sm active:scale-95 transition">
                <i data-lucide="camera" class="w-6 h-6"></i>
                <span class="text-xs font-bold">記録する</span>
            </a>
            <a href="ikimon_walk.php"
               class="flex flex-col items-center gap-2 bg-elevated border border-border rounded-2xl py-4 px-3 text-center active:scale-95 transition hover:border-border-strong">
                <i data-lucide="footprints" class="w-6 h-6 text-emerald-600"></i>
                <span class="text-xs font-bold text-text">さんぽ</span>
            </a>
            <a href="explore.php"
               class="flex flex-col items-center gap-2 bg-elevated border border-border rounded-2xl py-4 px-3 text-center active:scale-95 transition hover:border-border-strong">
                <i data-lucide="map" class="w-6 h-6 text-sky-600"></i>
                <span class="text-xs font-bold text-text">探索マップ</span>
            </a>
        </section>

        <!-- 3. Daily Quest -->
        <?php if ($dailyTarget): ?>
        <section class="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center border border-amber-300 shrink-0">
                    <i data-lucide="target" class="w-5 h-5 text-amber-600"></i>
                </div>
                <div>
                    <div class="text-token-xs text-amber-700 font-bold tracking-wide mb-0.5">今日のターゲット</div>
                    <div class="text-sm font-black text-gray-900"><?= htmlspecialchars($dailyTarget['jp_name'] ?? $dailyTarget['name'] ?? '対象種') ?></div>
                </div>
            </div>
            <a href="explore.php"
               class="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-2 rounded-xl border border-amber-300 hover:bg-amber-200 transition whitespace-nowrap active:scale-95">
                探しに行く
            </a>
        </section>
        <?php endif; ?>

        <!-- 4. Category Exploration -->
        <section>
            <h2 class="text-base font-black text-text mb-3">カテゴリ探索</h2>
            <div class="grid grid-cols-2 gap-3">
                <?php
                $colorMap = [
                    'emerald' => ['bg' => 'bg-emerald-50 border-emerald-200', 'bar' => 'bg-emerald-500', 'text' => 'text-emerald-700', 'icon' => 'text-emerald-600'],
                    'sky'     => ['bg' => 'bg-sky-50 border-sky-200',         'bar' => 'bg-sky-500',     'text' => 'text-sky-700',     'icon' => 'text-sky-600'],
                    'green'   => ['bg' => 'bg-green-50 border-green-200',     'bar' => 'bg-green-500',   'text' => 'text-green-700',   'icon' => 'text-green-600'],
                    'amber'   => ['bg' => 'bg-amber-50 border-amber-200',     'bar' => 'bg-amber-500',   'text' => 'text-amber-700',   'icon' => 'text-amber-600'],
                ];
                foreach ($missions as $m):
                    $progress = ($m['count_done'] / $m['count_total']) * 100;
                    $c = $colorMap[$m['color']];
                ?>
                <a href="zukan.php?group=<?= htmlspecialchars($m['id']) ?>"
                   class="<?= $c['bg'] ?> border rounded-2xl p-4 block hover:shadow-md active:scale-95 transition">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-lg font-black text-gray-900"><?= $m['label'] ?></span>
                        <i data-lucide="<?= $m['icon'] ?>" class="w-5 h-5 <?= $c['icon'] ?>"></i>
                    </div>
                    <div class="text-2xl font-black <?= $c['text'] ?> mb-1 leading-none">
                        <?= number_format($m['count_total'] - $m['count_done']) ?>
                    </div>
                    <div class="text-token-xs text-gray-500 mb-2">
                        <?= $m['count_done'] ?> 発見 · 残り <?= number_format(100 - $progress, 0) ?>%
                    </div>
                    <div class="h-1.5 bg-white/70 rounded-full overflow-hidden">
                        <div class="<?= $c['bar'] ?> h-full rounded-full" style="width: <?= number_format($progress, 1) ?>%"></div>
                    </div>
                </a>
                <?php endforeach; ?>
            </div>
        </section>

        <!-- 5. Recent Observations -->
        <?php if (!empty($latest_obs)): ?>
        <section>
            <div class="flex items-center justify-between mb-3">
                <h2 class="text-base font-black text-text mb-3">最新の記録</h2>
                <a href="index.php" class="text-xs text-primary font-bold hover:underline">すべて見る</a>
            </div>
            <div class="space-y-2">
                <?php foreach (array_slice($latest_obs, 0, 5) as $obs):
                    $taxonName = $obs['taxon']['name_ja'] ?? $obs['taxon']['name'] ?? '未同定';
                    $photoUrl  = !empty($obs['photos'][0]) ? 'uploads/photos/' . basename($obs['photos'][0]) : null;
                    $userName  = htmlspecialchars($obs['user_name'] ?? '匿名');
                    $date      = isset($obs['created_at']) ? date('n/j', strtotime($obs['created_at'])) : '';
                ?>
                <a href="observation_detail.php?id=<?= htmlspecialchars($obs['id'] ?? '') ?>"
                   class="flex items-center gap-3 bg-elevated border border-border rounded-xl p-3 active:scale-[0.98] transition hover:border-border-strong group">
                    <?php if ($photoUrl): ?>
                    <img src="<?= htmlspecialchars($photoUrl) ?>"
                         alt="<?= htmlspecialchars($taxonName) ?>"
                         class="w-12 h-12 rounded-lg object-cover shrink-0 bg-border">
                    <?php else: ?>
                    <div class="w-12 h-12 rounded-lg bg-primary-surface flex items-center justify-center shrink-0">
                        <i data-lucide="leaf" class="w-6 h-6 text-primary"></i>
                    </div>
                    <?php endif; ?>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-bold text-text truncate"><?= htmlspecialchars($taxonName) ?></div>
                        <div class="text-xs text-faint"><?= $userName ?> · <?= $date ?></div>
                    </div>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-faint shrink-0 group-hover:text-muted transition"></i>
                </a>
                <?php endforeach; ?>
            </div>
        </section>
        <?php endif; ?>

        <!-- 6. Library Stats -->
        <section class="bg-elevated border border-border rounded-2xl p-4">
            <div class="flex items-center gap-2 mb-3">
                <i data-lucide="book-open" class="w-4 h-4 text-amber-600"></i>
                <span class="text-sm font-black text-text">文献データベース</span>
            </div>
            <div class="grid grid-cols-4 gap-2 text-center">
                <div>
                    <div class="text-lg font-black text-sky-600"><?= number_format($bibStats['papers']) ?></div>
                    <div class="text-token-xs text-faint">論文</div>
                </div>
                <div>
                    <div class="text-lg font-black text-amber-600"><?= number_format($bibStats['citations']) ?></div>
                    <div class="text-token-xs text-faint">出典</div>
                </div>
                <div>
                    <div class="text-lg font-black text-emerald-600"><?= number_format($bibStats['keys']) ?></div>
                    <div class="text-token-xs text-faint">検索表</div>
                </div>
                <div>
                    <div class="text-lg font-black text-gray-600"><?= number_format($bibStats['books']) ?></div>
                    <div class="text-token-xs text-faint">図鑑</div>
                </div>
            </div>
        </section>

        <div class="h-2 md:hidden" aria-hidden="true"></div>

    </main>

    <?php include __DIR__ . '/components/badge_notification.php'; ?>
</body>

</html>
