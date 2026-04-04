<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BadgeManager.php';
require_once __DIR__ . '/../libs/StreakTracker.php';
require_once __DIR__ . '/../libs/EventLog.php';
require_once __DIR__ . '/../libs/ObserverRank.php';

Auth::init();
$currentUser = Auth::user();
if (!$currentUser) {
    header('Location: login.php');
    exit;
}

$userId = $currentUser['id'];
$badges = BadgeManager::getUserBadges($userId);
$allBadges = BadgeManager::getDefinitions();
$streak = StreakTracker::getStreak($userId);
$recentEvents = EventLog::getRecent($userId, 30);
$orsData = $currentUser['observer_rank'] ?? null;

// Monthly posts (last 6 months)
$observations = DataStore::fetchAll('observations');
$monthlyPosts = [];
for ($i = 5; $i >= 0; $i--) {
    $ym = date('Y-m', strtotime("-{$i} months"));
    $monthlyPosts[$ym] = 0;
}
foreach ($observations as $obs) {
    if (($obs['user_id'] ?? '') !== $userId) continue;
    $ym = substr($obs['created_at'] ?? '', 0, 7);
    if (isset($monthlyPosts[$ym])) $monthlyPosts[$ym]++;
}
$maxPosts = max($monthlyPosts ?: [0]);
if ($maxPosts <= 0) $maxPosts = 1;

$earnedIds = array_column($badges, 'id');
$earnedSet = array_fill_keys($earnedIds, true);
$badgeTotal = count($allBadges);
$badgeEarned = count($earnedIds);

$orsRank = $orsData['rank'] ?? ['icon' => '🌱', 'name_ja' => '見習い', 'name_en' => 'Apprentice', 'color' => '#8bc34a'];
$orsLevel = $orsData['level'] ?? 1;
$orsProgress = $orsData['progress'] ?? 0;
$orsAxes = $orsData['axes'] ?? ['recorder' => 0, 'identifier' => 0, 'fieldwork' => 0];
$recentActivity = $streak['recent_activity'] ?? [];
$habitTypeLabels = [
    'post' => ['label' => '記録', 'emoji' => '📸'],
    'identification' => ['label' => '同定', 'emoji' => '🔎'],
    'walk' => ['label' => 'さんぽ', 'emoji' => '🥾'],
    'reflection' => ['label' => '1分メモ', 'emoji' => '📝'],
];
$recentHabitDays = [];
for ($i = 6; $i >= 0; $i--) {
    $date = date('Y-m-d', strtotime("-{$i} days"));
    $dayActivity = $recentActivity[$date] ?? [];
    $types = array_values($dayActivity['types'] ?? []);
    $recentHabitDays[] = [
        'date' => $date,
        'label' => date('n/j', strtotime($date)),
        'weekday' => ['日', '月', '火', '水', '木', '金', '土'][(int)date('w', strtotime($date))],
        'types' => $types,
        'is_today' => $date === date('Y-m-d'),
    ];
}

$meta_title = 'マイ統計';
$meta_description = 'あなたの観察活動、バッジ、ランク進捗をまとめて確認。';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>

<body class="js-loading pt-14 pb-20 font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">document.body.classList.remove('js-loading');</script>

    <main class="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h1 class="sr-only">マイ統計</h1>

        <!-- 1. Rank Progress Card -->
        <section style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1rem;border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                    <span class="text-3xl"><?= $orsRank['icon']; ?></span>
                    <div>
                        <p class="text-xs text-muted">現在のランク</p>
                        <p class="text-lg font-black text-text"><?= htmlspecialchars($orsRank['name_ja']); ?> Lv.<?= $orsLevel; ?></p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-xs text-muted">次のランクまで</p>
                    <p class="text-sm font-bold text-primary"><?= (int)round($orsProgress); ?>%</p>
                </div>
            </div>
            <div class="h-2 bg-border rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full" style="width: <?= min(100, max(0, (int)$orsProgress)); ?>%;"></div>
            </div>

            <div class="mt-4 space-y-3">
                <?php
                $axisLabels = [
                    'recorder' => 'Recorder',
                    'identifier' => 'Identifier',
                    'fieldwork' => 'Fieldwork'
                ];
                foreach ($axisLabels as $key => $label):
                    $val = (int)($orsAxes[$key] ?? 0);
                    $val = max(0, min(100, $val));
                ?>
                <div>
                    <div class="flex items-center justify-between text-xs mb-1">
                        <span class="text-muted font-bold"><?= $label; ?></span>
                        <span class="text-text font-bold"><?= $val; ?></span>
                    </div>
                    <div class="h-2 bg-border rounded-full overflow-hidden">
                        <div class="h-full bg-secondary rounded-full" style="width: <?= $val; ?>%;"></div>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </section>

        <!-- 2. Streak & Score -->
        <section style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1rem;border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="text-center md:text-left">
                    <p class="text-xs text-muted font-bold">現在の連続日数</p>
                    <p class="text-4xl font-black text-orange-500 mt-2">🔥 <?= (int)($streak['current_streak'] ?? 0); ?>日</p>
                </div>
                <div class="text-center">
                    <p class="text-xs text-muted font-bold">最長記録</p>
                    <p class="text-3xl font-black text-text mt-2"><?= (int)($streak['longest_streak'] ?? 0); ?>日</p>
                </div>
                <div class="text-center md:text-right">
                    <p class="text-xs text-muted font-bold">総スコア</p>
                    <p class="text-3xl font-black text-primary mt-2"><?= number_format($currentUser['score'] ?? 0); ?> pt</p>
                </div>
            </div>
        </section>

        <!-- 3. Habit Week -->
        <section style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1rem;border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h2 class="text-base font-black text-text">直近7日の継続</h2>
                    <p class="text-xs text-muted">記録・同定・さんぽがどの日に積めているか</p>
                </div>
                <a href="dashboard.php" class="text-xs font-bold text-primary hover:underline">今日の導線を見る</a>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-7 gap-3">
                <?php foreach ($recentHabitDays as $day): ?>
                <?php $hasTypes = !empty($day['types']); ?>
                <div class="rounded-xl border p-3 <?= $hasTypes ? 'bg-emerald-50 border-emerald-200' : 'bg-base border-border'; ?>">
                    <div class="flex items-center justify-between mb-2">
                        <div>
                            <div class="text-xs font-bold <?= $day['is_today'] ? 'text-primary' : 'text-muted'; ?>"><?= htmlspecialchars($day['weekday']); ?></div>
                            <div class="text-[10px] text-faint"><?= htmlspecialchars($day['label']); ?></div>
                        </div>
                        <div class="text-lg"><?= $hasTypes ? '✓' : '・' ?></div>
                    </div>
                    <div class="flex flex-wrap gap-1">
                        <?php if ($hasTypes): ?>
                            <?php foreach ($day['types'] as $type): ?>
                                <?php $meta = $habitTypeLabels[$type] ?? ['label' => $type, 'emoji' => '•']; ?>
                                <span class="inline-flex items-center gap-1 rounded-full bg-white border border-emerald-200 px-2 py-1 text-[10px] font-bold text-emerald-700">
                                    <span><?= htmlspecialchars($meta['emoji']); ?></span><?= htmlspecialchars($meta['label']); ?>
                                </span>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <span class="text-[10px] text-faint">未達成</span>
                        <?php endif; ?>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </section>

        <!-- 4. Badge Collection -->
        <section style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1rem;border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
            <div class="flex items-center justify-between mb-3">
                <h2 class="text-base font-black text-text">バッジコレクション</h2>
                <span class="text-xs text-muted font-bold"><?= $badgeEarned; ?> / <?= $badgeTotal; ?> バッジ獲得</span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <?php foreach ($allBadges as $badge):
                    $earned = !empty($earnedSet[$badge['id'] ?? '']);
                ?>
                <div class="rounded-xl border border-border p-3 flex items-center gap-2 <?= $earned ? 'bg-base' : 'bg-border/40 opacity-60'; ?>">
                    <span class="text-xl"><?= htmlspecialchars($badge['icon'] ?? '🏅'); ?></span>
                    <div class="min-w-0">
                        <p class="text-sm font-bold text-text truncate"><?= htmlspecialchars($badge['name_ja'] ?? $badge['name'] ?? ''); ?></p>
                        <?php if (!$earned): ?>
                            <p class="text-[10px] text-faint">🔒 未獲得</p>
                        <?php endif; ?>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </section>

        <!-- 5. Monthly Posts Chart -->
        <section style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1rem;border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
            <h2 class="text-base font-black text-text mb-4">月別投稿</h2>
            <div class="flex items-end gap-3 h-40">
                <?php foreach ($monthlyPosts as $ym => $count):
                    $height = (int)round(($count / $maxPosts) * 100);
                ?>
                <div class="flex-1 flex flex-col items-center gap-2">
                    <div class="w-full bg-border rounded-lg overflow-hidden flex items-end" style="height: 100px;">
                        <div class="w-full bg-primary" style="height: <?= $height; ?>%;"></div>
                    </div>
                    <div class="text-[10px] text-muted font-mono"><?= htmlspecialchars($ym); ?></div>
                    <div class="text-xs font-bold text-text"><?= (int)$count; ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        </section>

        <!-- 6. Recent Events -->
        <section style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1rem;border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
            <h2 class="text-base font-black text-text mb-4">最近のイベント</h2>
            <div class="space-y-3">
                <?php
                $events = array_slice($recentEvents, 0, 20);
                foreach ($events as $evt):
                    $type = $evt['type'] ?? '';
                    $icon = '🔔';
                    if ($type === 'badge_earned') $icon = '🏆';
                    if ($type === 'rank_up') $icon = '⬆️';
                    if ($type === 'quest_complete') $icon = '✅';
                    $dt = $evt['created_at'] ?? '';
                ?>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-base border border-border flex items-center justify-center">
                        <span class="text-lg"><?= $icon; ?></span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-text truncate"><?= htmlspecialchars($type); ?></p>
                        <p class="text-xs text-muted"><?= htmlspecialchars($dt); ?></p>
                    </div>
                </div>
                <?php endforeach; ?>
                <?php if (empty($events)): ?>
                    <p class="text-sm text-muted">まだイベントがありません。</p>
                <?php endif; ?>
            </div>
        </section>
    </main>
    <?php include __DIR__ . '/components/footer.php'; ?>
</body>
</html>
