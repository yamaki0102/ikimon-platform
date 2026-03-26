<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/QuestManager.php';
require_once __DIR__ . '/../libs/HabitEngine.php';
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
    $todayState                 = HabitEngine::getTodayState($currentUser['id']);
    $streakData                 = $todayState['streak'];
}

// Observer Rank data
$_ors          = $userStats['observer_rank'] ?? null;
$orsProgress   = $_ors ? ($_ors['progress'] ?? 0)         : UserStatsService::getProgressToNextRank($userStats['score']);
$orsNextThresh = $_ors ? ($_ors['next_threshold'] ?? null) : UserStatsService::getNextRankTarget($userStats['score']);
$orsRankIcon   = $_ors ? ($_ors['rank']['icon']    ?? '🌱') : '🌱';
$orsRankColor  = $_ors ? ($_ors['rank']['color']   ?? '#8bc34a') : '#8bc34a';
$orsRankName   = $_ors ? ($_ors['rank']['name_ja'] ?? '見習い')  : '見習い';

// Daily Quest
$activeQuests = QuestManager::getActiveQuests($currentUser['id'] ?? null);
$dailyTargets = $activeQuests;
$todayLabels = $todayState['labels'] ?? HabitEngine::getLabels();
$todayTypes = $todayState['today_types'] ?? [];
$todayHabitComplete = !empty($todayState['today_complete']);
$todayTitle = $todayState['title'] ?? '今日の継続を積もう';
$todayMessage = $todayState['message'] ?? '';
$todayRemaining = $todayState['remaining'] ?? [];
$todayReflectionPreview = HabitEngine::previewNote($todayState['reflection_note'] ?? '');
$latestReflectionPreview = HabitEngine::previewNote($todayState['latest_reflection']['note'] ?? '');
$todayCtas = $todayState['cta_options'] ?? HabitEngine::getCtaOptions($todayTypes);

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
                        <?php if (($streakData['current_streak'] ?? 0) > 0): ?>
                            <span class="text-sm text-orange-500 font-bold">🔥 <?= $streakData['current_streak'] ?>日連続</span>
                        <?php endif; ?>
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

        <!-- 2. Today Habit -->
        <?php if ($currentUser): ?>
        <section id="today-habit-card" class="rounded-2xl border p-4 <?= $todayHabitComplete ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200' ?>">
            <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                    <div class="text-token-xs font-black tracking-wide <?= $todayHabitComplete ? 'text-emerald-700' : 'text-amber-700' ?>">TODAY</div>
                    <h2 class="text-base font-black <?= $todayHabitComplete ? 'text-emerald-950' : 'text-amber-950' ?>"><?= $todayTitle ?></h2>
                    <p class="text-xs mt-1 <?= $todayHabitComplete ? 'text-emerald-800/80' : 'text-amber-900/80' ?>"><?= $todayMessage ?></p>
                </div>
                <div class="shrink-0 text-right">
                    <div class="text-2xl"><?= $todayHabitComplete ? '🌿' : '🔥' ?></div>
                    <div class="text-token-xs font-bold <?= $todayHabitComplete ? 'text-emerald-700' : 'text-amber-700' ?>">
                        <?= (int)($streakData['current_streak'] ?? 0) ?>日連続
                    </div>
                </div>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
                <?php foreach ($todayLabels as $type => $label): ?>
                    <?php $isDone = in_array($type, $todayTypes, true); ?>
                    <span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold <?= $isDone ? 'bg-white text-emerald-700 border border-emerald-300' : 'bg-white/70 text-gray-500 border border-white/80' ?>">
                        <span><?= $isDone ? '✓' : '・' ?></span><?= htmlspecialchars($label) ?>
                    </span>
                <?php endforeach; ?>
            </div>

            <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <?php foreach ($todayCtas as $type => $cta): ?>
                    <?php if (($cta['type'] ?? 'link') === 'button'): ?>
                    <button type="button" data-habit-cta="<?= htmlspecialchars($type) ?>" data-reflection-toggle class="rounded-xl bg-white px-3 py-3 text-center border border-white/80 hover:border-border-strong transition">
                        <i data-lucide="<?= htmlspecialchars($cta['icon']) ?>" class="w-5 h-5 mx-auto mb-1 <?= htmlspecialchars($cta['icon_class'] ?? 'text-primary') ?>"></i>
                        <div class="text-xs font-bold text-text"><?= htmlspecialchars($cta['label']) ?></div>
                        <div class="text-[10px] text-muted mt-0.5"><?= htmlspecialchars($cta['detail'] ?? '') ?></div>
                    </button>
                    <?php else: ?>
                    <a href="<?= htmlspecialchars($cta['href'] ?? '#') ?>" data-habit-cta="<?= htmlspecialchars($type) ?>" class="rounded-xl bg-white px-3 py-3 text-center border border-white/80 hover:border-border-strong transition">
                        <i data-lucide="<?= htmlspecialchars($cta['icon']) ?>" class="w-5 h-5 mx-auto mb-1 <?= htmlspecialchars($cta['icon_class'] ?? 'text-primary') ?>"></i>
                        <div class="text-xs font-bold text-text"><?= htmlspecialchars($cta['label']) ?></div>
                        <div class="text-[10px] text-muted mt-0.5"><?= htmlspecialchars($cta['detail'] ?? '') ?></div>
                    </a>
                    <?php endif; ?>
                <?php endforeach; ?>
            </div>

            <?php if ($todayReflectionPreview !== ''): ?>
            <div class="mt-4 rounded-xl bg-white/80 border border-white/80 px-4 py-3">
                <div class="text-[10px] font-black tracking-widest text-emerald-700">TODAY NOTE</div>
                <p class="text-sm text-text mt-1"><?= htmlspecialchars($todayReflectionPreview) ?></p>
            </div>
            <?php elseif ($latestReflectionPreview !== ''): ?>
            <p class="mt-4 text-token-xs text-muted">前回の1分メモ: <?= htmlspecialchars($latestReflectionPreview) ?></p>
            <?php endif; ?>

            <div class="mt-4 rounded-xl bg-white/80 border border-white/80 p-4 hidden" data-reflection-panel>
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-xs font-black text-amber-700">1分メモ</div>
                        <p class="text-[11px] text-muted mt-1">今日は何を見たか、何に気づいたかを一言だけ残す。</p>
                    </div>
                    <button type="button" data-reflection-cancel class="text-[11px] font-bold text-muted hover:text-text transition">閉じる</button>
                </div>
                <textarea data-reflection-note maxlength="120" rows="3" class="mt-3 w-full rounded-xl border border-border bg-white px-3 py-3 text-sm text-text focus:outline-none focus:border-border-strong resize-none" placeholder="例: 雨上がりで鳥の声が増えていた"></textarea>
                <div class="mt-3 flex items-center justify-between gap-3">
                    <p class="text-[11px] text-muted" data-reflection-status>雨の日でも継続は切らさない。</p>
                    <button type="button" data-reflection-submit class="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-black text-white hover:bg-amber-600 transition">
                        <i data-lucide="pen-square" class="w-4 h-4"></i> 保存して継続に加える
                    </button>
                </div>
            </div>

            <?php if (!$todayHabitComplete && !empty($todayRemaining)): ?>
            <p class="mt-3 text-token-xs text-amber-700">
                今日は <?= htmlspecialchars(implode(' / ', array_map(fn($type) => $todayLabels[$type] ?? $type, $todayRemaining))) ?> のどれかで継続成立。
            </p>
            <?php endif; ?>
        </section>
        <?php endif; ?>

        <!-- 3. Quick Actions -->
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

        <!-- 4. Daily Quest -->
        <?php if (!empty($dailyTargets)): ?>
        <section>
            <div class="flex items-center justify-between mb-3">
                <h2 class="text-base font-black text-text">今日のクエスト</h2>
                <a href="explore.php" class="text-xs font-bold text-amber-700 hover:text-amber-800 transition">探しに行く</a>
            </div>
            <div class="grid gap-3 md:grid-cols-3">
                <?php foreach ($dailyTargets as $quest): ?>
                <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center border border-amber-300 shrink-0">
                            <i data-lucide="<?= htmlspecialchars($quest['icon'] ?? 'target') ?>" class="w-5 h-5 text-amber-600"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-token-xs text-amber-700 font-bold tracking-wide">今日のクエスト</div>
                            <div class="text-sm font-black text-gray-900 truncate"><?= htmlspecialchars($quest['title'] ?? 'クエスト') ?></div>
                        </div>
                    </div>
                    <div class="text-xs text-amber-900/80 mb-2"><?= htmlspecialchars($quest['description'] ?? '') ?></div>
                    <div class="text-token-xs text-amber-700 font-bold">+<?= (int)($quest['reward'] ?? 0) ?> pt</div>
                </div>
                <?php endforeach; ?>
            </div>
        </section>
        <?php endif; ?>

        <!-- 5. Category Exploration -->
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

        <!-- 6. Recent Observations -->
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

        <!-- 7. Library Stats -->
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
    <?php if ($currentUser): ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.addEventListener('DOMContentLoaded', function () {
            if (window.ikimonAnalytics) {
                window.ikimonAnalytics.track('today_card_view', {
                    completed: <?= $todayHabitComplete ? 'true' : 'false' ?>,
                    location: 'dashboard',
                    types: <?= json_encode(array_values($todayTypes), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?>
                });
            }

            var card = document.getElementById('today-habit-card');
            var reflectionPanel = card ? card.querySelector('[data-reflection-panel]') : null;
            var reflectionToggle = card ? card.querySelector('[data-reflection-toggle]') : null;
            var reflectionCancel = card ? card.querySelector('[data-reflection-cancel]') : null;
            var reflectionSubmit = card ? card.querySelector('[data-reflection-submit]') : null;
            var reflectionNote = card ? card.querySelector('[data-reflection-note]') : null;
            var reflectionStatus = card ? card.querySelector('[data-reflection-status]') : null;
            var csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

            document.querySelectorAll('[data-habit-cta]').forEach(function (el) {
                el.addEventListener('click', function () {
                    if (window.ikimonAnalytics) {
                        window.ikimonAnalytics.track('today_card_cta', {
                            location: 'dashboard',
                            target: el.getAttribute('data-habit-cta')
                        });
                    }
                });
            });

            if (reflectionToggle && reflectionPanel) {
                reflectionToggle.addEventListener('click', function () {
                    reflectionPanel.classList.remove('hidden');
                    reflectionNote?.focus();
                });
            }

            if (reflectionCancel && reflectionPanel) {
                reflectionCancel.addEventListener('click', function () {
                    reflectionPanel.classList.add('hidden');
                });
            }

            if (reflectionSubmit && reflectionNote) {
                reflectionSubmit.addEventListener('click', async function () {
                    var note = reflectionNote.value.trim();
                    if (!note) {
                        if (reflectionStatus) reflectionStatus.textContent = 'ひとことだけ書いてください。';
                        reflectionNote.focus();
                        return;
                    }

                    reflectionSubmit.disabled = true;
                    if (reflectionStatus) reflectionStatus.textContent = '保存中...';

                    try {
                        var response = await fetch('api/log_reflection.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRF-Token': csrfToken
                            },
                            body: JSON.stringify({
                                note: note,
                                source: 'dashboard'
                            })
                        });

                        var result = await response.json();
                        if (!response.ok || !result.success) {
                            throw new Error(result.message || '保存に失敗しました');
                        }

                        if (window.ikimonAnalytics) {
                            window.ikimonAnalytics.track('reflection_habit_qualified', {
                                location: 'dashboard',
                                note_length: note.length
                            });
                        }

                        if (reflectionStatus) reflectionStatus.textContent = '保存した。今日の継続に加えた。';
                        window.setTimeout(function () {
                            window.location.reload();
                        }, 450);
                    } catch (error) {
                        if (reflectionStatus) reflectionStatus.textContent = error.message || '保存に失敗しました。';
                    } finally {
                        reflectionSubmit.disabled = false;
                    }
                });
            }
        });
    </script>
    <?php endif; ?>
</body>

</html>
