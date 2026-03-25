<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/QuestManager.php';
require_once __DIR__ . '/../libs/CSRF.php';

Auth::init();
$currentUser = Auth::user();
$meta_title = 'マイゴール | ikimon.life';

$fieldSignals = $currentUser ? QuestManager::getScanQuests($currentUser['id']) : [];
$communitySignals = $currentUser ? QuestManager::getCommunitySignals($currentUser['id']) : [];
$goalsWithProgress = $currentUser ? QuestManager::getActiveGoalsWithProgress($currentUser['id']) : [];
$goalCatalog = QuestManager::getGoalCatalog();
$recommendedGoals = $currentUser ? QuestManager::getRecommendedGoals($currentUser['id']) : [];
$csrfToken = CSRF::generate();

$activeGoalIds = [];
if ($currentUser) {
    $userData = QuestManager::getUserGoals($currentUser['id']);
    $activeGoalIds = $userData['active_goals'] ?? [];
}

$categories = [
    'observation' => ['label' => '観察', 'icon' => 'eye'],
    'identification' => ['label' => '同定', 'icon' => 'microscope'],
    'exploration' => ['label' => '探索', 'icon' => 'compass'],
    'phenology' => ['label' => 'フェノロジー', 'icon' => 'calendar'],
    'specialization' => ['label' => '専門特化', 'icon' => 'target'],
];

$significanceTexts = [
    'redlist' => [
        'why' => '絶滅危惧種の生息確認は、保全行政の基礎データです。あなたの1枚の写真が、この種の保護区域設定や環境影響評価に使われる可能性があります。',
        'icon' => 'shield-alert',
    ],
    'area_first' => [
        'why' => '新しい場所での種の記録は、分布域の変化を追跡する科学データになります。気候変動や都市化が生物の分布にどう影響しているかを知る手がかりです。',
        'icon' => 'map-pin-plus',
    ],
    'id_challenge' => [
        'why' => 'AIが科名レベルまで絞った生物の種名を特定することは、機械学習モデルの訓練データにもなります。人間とAIの協働で同定精度が上がります。',
        'icon' => 'microscope',
    ],
    'evidence_upgrade' => [
        'why' => '写真証拠が加わることで、AI単独検出（Tier 1）からコミュニティ検証可能（Tier 2）にデータグレードが上がります。',
        'icon' => 'trending-up',
    ],
];

$badgeColors = [
    'redlist'          => 'bg-red-100 text-red-700 border-red-200',
    'area_first'       => 'bg-amber-100 text-amber-700 border-amber-200',
    'id_challenge'     => 'bg-purple-100 text-purple-700 border-purple-200',
    'evidence_upgrade' => 'bg-blue-100 text-blue-700 border-blue-200',
];

$bgGradients = [
    'redlist'          => 'from-red-50 to-rose-50',
    'area_first'       => 'from-amber-50 to-orange-50',
    'id_challenge'     => 'from-purple-50 to-violet-50',
    'evidence_upgrade' => 'from-blue-50 to-sky-50',
];
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
</head>
<body class="bg-background text-text">
<?php include __DIR__ . '/components/nav.php'; ?>

<main class="max-w-lg mx-auto px-4 pb-24" style="padding-top:calc(var(--nav-height,56px) + 1.5rem)"
      x-data="goalsPage()" x-init="init()">

    <!-- Hero -->
    <div class="text-center mb-6">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-blue-100 border border-emerald-200 mb-3">
            <i data-lucide="target" class="w-8 h-8 text-emerald-600"></i>
        </div>
        <h1 class="text-2xl font-black">マイゴール</h1>
        <p class="text-sm text-muted mt-1">自分のペースで、自分の目標を</p>
    </div>

    <?php if (!$currentUser): ?>
    <div class="bg-surface border border-border rounded-2xl p-6 text-center">
        <i data-lucide="lock" class="w-8 h-8 text-muted mx-auto mb-3"></i>
        <p class="text-sm text-muted mb-4">ログインするとマイゴールが解放されます</p>
        <a href="login.php?redirect=quests.php" class="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-6 py-3 text-sm transition">ログイン</a>
    </div>
    <?php else: ?>

    <!-- ===== マイシグナル（自分のスキャンから・無期限） ===== -->
    <?php if (!empty($fieldSignals)): ?>
    <section class="mb-8">
        <div class="flex items-center gap-2 mb-4">
            <i data-lucide="radio" class="w-5 h-5 text-emerald-600"></i>
            <h2 class="text-base font-black">マイシグナル</h2>
            <span class="text-[10px] text-muted ml-auto">自分のスキャンから・無期限</span>
        </div>
        <div class="space-y-3">
            <?php foreach ($fieldSignals as $sq):
                $trigger = $sq['trigger'] ?? 'id_challenge';
                $badge = $badgeColors[$trigger] ?? $badgeColors['id_challenge'];
                $bg = $bgGradients[$trigger] ?? $bgGradients['id_challenge'];
                $sig = $significanceTexts[$trigger] ?? null;
                $cta = $sq['cta_text'] ?? '記録する';
            ?>
            <div class="bg-gradient-to-br <?= $bg ?> rounded-2xl p-5 border border-gray-200">
                <?php $sqArea = $sq['area_label'] ?? ''; ?>
                <div class="flex items-center justify-between mb-3">
                    <span class="text-[10px] font-bold px-2.5 py-1 rounded-md border <?= $badge ?>">
                        <?= htmlspecialchars($sq['rarity_label'] ?? $trigger, ENT_QUOTES, 'UTF-8') ?>
                    </span>
                    <div class="flex items-center gap-2">
                        <?php if ($sqArea): ?>
                        <span class="text-[10px] text-gray-500 flex items-center gap-1">
                            <i data-lucide="map-pin" class="w-3 h-3"></i>
                            <?= htmlspecialchars($sqArea, ENT_QUOTES, 'UTF-8') ?>
                        </span>
                        <?php endif; ?>
                        <span class="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                            <i data-lucide="infinity" class="w-3 h-3"></i>
                            無期限
                        </span>
                    </div>
                </div>
                <h3 class="text-base font-black text-gray-900 mb-2"><?= htmlspecialchars($sq['title'] ?? '', ENT_QUOTES, 'UTF-8') ?></h3>
                <?php if (!empty($sq['progress_hint'])): ?>
                <div class="text-xs text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2 mb-3">
                    <?= htmlspecialchars($sq['progress_hint'], ENT_QUOTES, 'UTF-8') ?>
                </div>
                <?php endif; ?>
                <p class="text-xs text-gray-600 leading-relaxed mb-3"><?= htmlspecialchars($sq['description'] ?? '', ENT_QUOTES, 'UTF-8') ?></p>
                <?php if ($sig): ?>
                <details class="mb-4">
                    <summary class="text-[11px] text-blue-600 cursor-pointer hover:text-blue-700 transition flex items-center gap-1">
                        <i data-lucide="info" class="w-3 h-3"></i>
                        なぜ重要？
                    </summary>
                    <div class="mt-2 text-[11px] text-gray-600 leading-relaxed bg-white/70 rounded-lg p-3 border border-gray-100">
                        <?= htmlspecialchars($sig['why'], ENT_QUOTES, 'UTF-8') ?>
                    </div>
                </details>
                <?php endif; ?>
                <div class="flex items-center gap-3">
                    <a href="post.php?species=<?= urlencode($sq['species_name'] ?? '') ?>&from=field_signal&quest_id=<?= urlencode($sq['id'] ?? '') ?>"
                       class="flex-1 text-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-3 text-sm transition">
                        <?= htmlspecialchars($cta, ENT_QUOTES, 'UTF-8') ?>
                    </a>
                    <span class="text-sm text-amber-600 font-black">+<?= (int)($sq['reward'] ?? 0) ?>pt</span>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </section>
    <?php endif; ?>

    <!-- ===== コミュニティシグナル（他人のスキャンから・先着5名） ===== -->
    <?php if (!empty($communitySignals)): ?>
    <section class="mb-8">
        <div class="flex items-center gap-2 mb-4">
            <i data-lucide="users" class="w-5 h-5 text-blue-500"></i>
            <h2 class="text-base font-black">コミュニティシグナル</h2>
            <span class="text-[10px] text-blue-500 font-bold ml-auto flex items-center gap-1">
                <span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                近くの発見
            </span>
        </div>
        <div class="space-y-3">
            <?php foreach ($communitySignals as $cs):
                $trigger = $cs['trigger'] ?? 'id_challenge';
                $hoursLeft = max(0, (int)round((strtotime($cs['expires_at'] ?? 'now') - time()) / 3600));
                $badge = $badgeColors[$trigger] ?? $badgeColors['id_challenge'];
                $remaining = (int)($cs['remaining_slots'] ?? 0);
                $distKm = $cs['distance_km'] ?? null;
                $areaLabel = $cs['area_label'] ?? '';
                $cta = $cs['cta_text'] ?? '記録する';
            ?>
            <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-200">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-[10px] font-bold px-2.5 py-1 rounded-md border <?= $badge ?>">
                        <?= htmlspecialchars($cs['rarity_label'] ?? $trigger, ENT_QUOTES, 'UTF-8') ?>
                    </span>
                    <div class="flex items-center gap-2">
                        <?php if ($areaLabel): ?>
                        <span class="text-[10px] text-gray-500"><?= htmlspecialchars($areaLabel, ENT_QUOTES, 'UTF-8') ?></span>
                        <?php endif; ?>
                        <?php if ($distKm !== null): ?>
                        <span class="text-[10px] text-blue-600 font-bold">~<?= $distKm ?>km</span>
                        <?php endif; ?>
                    </div>
                </div>
                <h3 class="text-base font-black text-gray-900 mb-2"><?= htmlspecialchars($cs['title'] ?? '', ENT_QUOTES, 'UTF-8') ?></h3>
                <p class="text-xs text-gray-600 leading-relaxed mb-3"><?= htmlspecialchars($cs['description'] ?? '', ENT_QUOTES, 'UTF-8') ?></p>
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] text-blue-600 font-bold bg-blue-100 px-2 py-0.5 rounded">残り<?= $remaining ?>枠</span>
                        <span class="text-[10px] text-gray-400 flex items-center gap-1">
                            <i data-lucide="clock" class="w-3 h-3"></i>
                            残り<?= $hoursLeft ?>時間
                        </span>
                    </div>
                    <span class="text-sm text-amber-600 font-black">+<?= (int)($cs['reward'] ?? 0) ?>pt</span>
                </div>
                <a href="post.php?species=<?= urlencode($cs['species_name'] ?? '') ?>&from=community_signal&signal_id=<?= urlencode($cs['id'] ?? '') ?>"
                   class="block text-center bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl py-3 text-sm transition">
                    <?= htmlspecialchars($cta, ENT_QUOTES, 'UTF-8') ?>
                </a>
            </div>
            <?php endforeach; ?>
        </div>
    </section>
    <?php endif; ?>

    <!-- ===== マイゴール ===== -->
    <section class="mb-8">
        <div class="flex items-center gap-2 mb-4">
            <i data-lucide="flag" class="w-5 h-5 text-emerald-600"></i>
            <h2 class="text-base font-black">マイゴール</h2>
            <span class="text-[10px] text-muted ml-auto">期限なし・いつでも達成</span>
        </div>

        <?php if (!empty($goalsWithProgress)): ?>
        <div class="space-y-3">
            <?php foreach ($goalsWithProgress as $gp):
                $goal = $gp['goal'];
                $progress = $gp['progress'];
                $milestones = $progress['milestones'] ?? [];
                $target = $progress['target'];
                $current = $progress['current'];
                $percent = $progress['percent'];
                $completedMs = $progress['milestones_completed'] ?? [];
                $totalMs = $progress['total_milestones'];
                $currentMs = $progress['current_milestone'];
                $isComplete = $progress['completed'];
            ?>
            <div class="bg-surface border border-border rounded-2xl p-4 <?= $isComplete ? 'ring-2 ring-emerald-300' : '' ?>">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 <?= $isComplete ? 'bg-emerald-500/20' : 'bg-emerald-500/10 border border-emerald-500/20' ?>">
                        <?php if ($isComplete): ?>
                            <i data-lucide="trophy" class="w-5 h-5 text-emerald-500"></i>
                        <?php else: ?>
                            <i data-lucide="<?= htmlspecialchars($goal['icon'] ?? 'target', ENT_QUOTES, 'UTF-8') ?>" class="w-5 h-5 text-emerald-600"></i>
                        <?php endif; ?>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-bold"><?= htmlspecialchars($goal['title'] ?? '', ENT_QUOTES, 'UTF-8') ?></div>
                        <div class="text-xs text-muted mt-0.5"><?= $current ?> / <?= $target ?></div>
                    </div>
                    <div class="text-right shrink-0">
                        <div class="text-[10px] text-emerald-600 font-bold">+<?= (int)($goal['reward_per_milestone'] ?? 100) ?>pt/達成</div>
                        <div class="text-[10px] text-muted"><?= $currentMs ?>/<?= $totalMs ?> マイルストーン</div>
                    </div>
                </div>

                <!-- Progress bar with milestone markers -->
                <div class="mt-3 relative">
                    <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-500 <?= $isComplete ? 'bg-emerald-400' : 'bg-emerald-500' ?>"
                             style="width:<?= $percent ?>%"></div>
                    </div>
                    <?php if (!empty($milestones) && $target > 0): ?>
                    <div class="flex justify-between mt-1">
                        <?php foreach ($milestones as $m):
                            $mPercent = min(100, ($m / $target) * 100);
                            $reached = in_array($m, $completedMs, true);
                        ?>
                        <span class="text-[9px] <?= $reached ? 'text-emerald-600 font-bold' : 'text-gray-400' ?>"><?= $m ?></span>
                        <?php endforeach; ?>
                    </div>
                    <?php endif; ?>
                </div>

                <!-- Remove goal button -->
                <div class="mt-2 flex justify-end">
                    <button @click="deactivateGoal('<?= htmlspecialchars($goal['id'], ENT_QUOTES, 'UTF-8') ?>')"
                            class="text-[10px] text-gray-400 hover:text-red-400 transition">
                        ゴール解除（進捗は保持）
                    </button>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
        <?php else: ?>
        <div class="bg-surface border border-border rounded-2xl p-6 text-center">
            <i data-lucide="plus-circle" class="w-8 h-8 text-muted mx-auto mb-3"></i>
            <p class="text-sm text-muted mb-2">まだゴールを選んでいません</p>
            <p class="text-xs text-muted">下のカタログから、気になるゴールを追加してみよう</p>
        </div>
        <?php endif; ?>

        <?php if (count($activeGoalIds) < QuestManager::MAX_ACTIVE_GOALS): ?>
        <div class="mt-3 text-center">
            <button @click="showCatalog = !showCatalog"
                    class="text-sm text-emerald-600 hover:text-emerald-700 font-bold transition flex items-center gap-1 mx-auto">
                <i data-lucide="plus" class="w-4 h-4"></i>
                ゴールを追加（あと<?= QuestManager::MAX_ACTIVE_GOALS - count($activeGoalIds) ?>個）
            </button>
        </div>
        <?php endif; ?>
    </section>

    <!-- ===== ゴールカタログ ===== -->
    <section x-show="showCatalog" x-transition class="mb-8">
        <div class="flex items-center gap-2 mb-4">
            <i data-lucide="book-open" class="w-5 h-5 text-blue-600"></i>
            <h2 class="text-base font-black">ゴールカタログ</h2>
        </div>

        <!-- おすすめ -->
        <?php if (!empty($recommendedGoals)): ?>
        <div class="mb-4">
            <div class="text-xs font-bold text-amber-600 mb-2 flex items-center gap-1">
                <i data-lucide="sparkles" class="w-3 h-3"></i>
                おすすめ
            </div>
            <div class="space-y-2">
                <?php foreach ($recommendedGoals as $rg):
                    $isActive = in_array($rg['id'], $activeGoalIds, true);
                ?>
                <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                    <div class="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <i data-lucide="<?= htmlspecialchars($rg['icon'] ?? 'target', ENT_QUOTES, 'UTF-8') ?>" class="w-4 h-4 text-amber-600"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-bold"><?= htmlspecialchars($rg['title'] ?? '', ENT_QUOTES, 'UTF-8') ?></div>
                        <div class="text-[11px] text-gray-500"><?= htmlspecialchars($rg['description'] ?? '', ENT_QUOTES, 'UTF-8') ?></div>
                    </div>
                    <?php if (!$isActive): ?>
                    <button @click="activateGoal('<?= htmlspecialchars($rg['id'], ENT_QUOTES, 'UTF-8') ?>')"
                            class="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg px-3 py-1.5 transition">
                        追加
                    </button>
                    <?php else: ?>
                    <span class="text-[10px] text-emerald-600 font-bold shrink-0">追加済み</span>
                    <?php endif; ?>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>

        <!-- カテゴリ別 -->
        <?php foreach ($categories as $catKey => $catInfo):
            $catGoals = array_filter($goalCatalog, fn($g) => ($g['category'] ?? '') === $catKey);
            if (empty($catGoals)) continue;
        ?>
        <details class="mb-3 group">
            <summary class="flex items-center gap-2 cursor-pointer p-3 bg-surface border border-border rounded-xl hover:bg-gray-50 transition">
                <i data-lucide="<?= $catInfo['icon'] ?>" class="w-4 h-4 text-gray-500"></i>
                <span class="text-sm font-bold"><?= $catInfo['label'] ?></span>
                <span class="text-[10px] text-muted ml-auto"><?= count($catGoals) ?>個</span>
                <i data-lucide="chevron-down" class="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180"></i>
            </summary>
            <div class="mt-2 space-y-2 pl-2">
                <?php foreach ($catGoals as $g):
                    $isActive = in_array($g['id'], $activeGoalIds, true);
                    $diff = $g['difficulty'] ?? 'medium';
                    $diffLabel = match($diff) { 'easy' => '初級', 'hard' => '上級', default => '中級' };
                    $diffColor = match($diff) { 'easy' => 'text-emerald-600', 'hard' => 'text-red-600', default => 'text-amber-600' };
                ?>
                <div class="bg-surface border border-border rounded-xl p-3 flex items-center gap-3">
                    <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <i data-lucide="<?= htmlspecialchars($g['icon'] ?? 'target', ENT_QUOTES, 'UTF-8') ?>" class="w-4 h-4 text-gray-500"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-bold"><?= htmlspecialchars($g['title'] ?? '', ENT_QUOTES, 'UTF-8') ?></div>
                        <div class="text-[11px] text-gray-500 mt-0.5"><?= htmlspecialchars($g['description'] ?? '', ENT_QUOTES, 'UTF-8') ?></div>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-[10px] <?= $diffColor ?> font-bold"><?= $diffLabel ?></span>
                            <span class="text-[10px] text-gray-400">+<?= (int)($g['reward_per_milestone'] ?? 100) ?>pt/マイルストーン</span>
                        </div>
                    </div>
                    <?php if (!$isActive): ?>
                    <button @click="activateGoal('<?= htmlspecialchars($g['id'], ENT_QUOTES, 'UTF-8') ?>')"
                            class="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg px-3 py-1.5 transition">
                        追加
                    </button>
                    <?php else: ?>
                    <span class="text-[10px] text-emerald-600 font-bold shrink-0">追加済み</span>
                    <?php endif; ?>
                </div>
                <?php endforeach; ?>
            </div>
        </details>
        <?php endforeach; ?>
    </section>

    <!-- ===== なぜマイゴール？ ===== -->
    <section class="mb-8">
        <div class="flex items-center gap-2 mb-4">
            <i data-lucide="lightbulb" class="w-5 h-5 text-blue-600"></i>
            <h2 class="text-base font-black">マイゴールの哲学</h2>
        </div>
        <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
            <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <i data-lucide="heart" class="w-4 h-4 text-emerald-600"></i>
                </div>
                <div>
                    <div class="text-sm font-bold text-gray-900 mb-1">キミが選ぶ、キミのペース</div>
                    <div class="text-xs text-gray-600 leading-relaxed">期限なし。焦る必要はありません。自分で選んだ目標だからこそ、達成した時の喜びも格別です。</div>
                </div>
            </div>
            <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <i data-lucide="layers" class="w-4 h-4 text-amber-600"></i>
                </div>
                <div>
                    <div class="text-sm font-bold text-gray-900 mb-1">マイルストーンで小さな達成感</div>
                    <div class="text-xs text-gray-600 leading-relaxed">大きなゴールも、途中のマイルストーンで一歩ずつ報酬がもらえます。進捗は永久に保存されます。</div>
                </div>
            </div>
            <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                    <i data-lucide="radio" class="w-4 h-4 text-red-600"></i>
                </div>
                <div>
                    <div class="text-sm font-bold text-gray-900 mb-1">フィールドシグナルだけが時限</div>
                    <div class="text-xs text-gray-600 leading-relaxed">絶滅危惧種や地域初記録など、科学的に本当に急ぐものだけに期限があります。それ以外は、すべて無期限です。</div>
                </div>
            </div>
        </div>
    </section>

    <!-- ===== フィールドへの導線 ===== -->
    <?php if (empty($fieldSignals)): ?>
    <section class="mb-8">
        <div class="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-6 text-center border border-emerald-200">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 mb-3">
                <i data-lucide="radio" class="w-6 h-6 text-emerald-600"></i>
            </div>
            <h3 class="text-base font-black text-gray-900 mb-2">フィールドシグナルを受信しよう</h3>
            <p class="text-xs text-gray-600 mb-4">ライブスキャンで周囲を探索すると、<br>科学的に重要な発見がシグナルとして届きます</p>
            <a href="/field_research.php" class="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-6 py-3 text-sm transition">
                いきものサーチを始める
            </a>
        </div>
    </section>
    <?php endif; ?>

    <?php endif; ?>
</main>

<script src="https://unpkg.com/lucide@0.344.0/dist/umd/lucide.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
<script nonce="<?= CspNonce::attr() ?>">
function goalsPage() {
    return {
        showCatalog: <?= empty($goalsWithProgress) ? 'true' : 'false' ?>,
        csrfToken: '<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>',

        init() {
            lucide.createIcons();
            this.$nextTick(() => lucide.createIcons());
        },

        async activateGoal(goalId) {
            try {
                const res = await fetch('/api/v2/goals.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': this.csrfToken,
                    },
                    body: JSON.stringify({ action: 'activate', goal_id: goalId, csrf_token: this.csrfToken }),
                });
                const data = await res.json();
                if (data.success) {
                    location.reload();
                } else {
                    alert(data.error || 'エラーが発生しました');
                }
            } catch (e) {
                alert('通信エラーが発生しました');
            }
        },

        async deactivateGoal(goalId) {
            if (!confirm('このゴールを解除しますか？進捗は保持されます。')) return;
            try {
                const res = await fetch('/api/v2/goals.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': this.csrfToken,
                    },
                    body: JSON.stringify({ action: 'deactivate', goal_id: goalId, csrf_token: this.csrfToken }),
                });
                const data = await res.json();
                if (data.success) {
                    location.reload();
                } else {
                    alert(data.error || 'エラーが発生しました');
                }
            } catch (e) {
                alert('通信エラーが発生しました');
            }
        }
    };
}
</script>
</body>
</html>
