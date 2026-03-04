<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/BadgeManager.php';

require_once __DIR__ . '/../libs/Services/EventLogService.php';
require_once __DIR__ . '/../libs/Services/SurveyLogService.php';

Auth::init();
$user = Auth::user();

// Redirect if not logged in
if (!$user) {
    header('Location: login.php');
    exit;
}

$my_badges = BadgeManager::getUserBadges($user['id']);


$all_obs = DataStore::fetchAll('observations');

// Filter user's observations (Strict Mode)
$user_obs = array_filter($all_obs, function ($o) use ($user) {
    return isset($o['user_id']) && (string)$o['user_id'] === (string)$user['id'];
});

// Calculate Life List (Unique Species)
$life_list = [];
foreach ($user_obs as $o) {
    if (isset($o['taxon']['key'])) {
        $life_list[$o['taxon']['key']] = $o['taxon'];
    }
}
?>
<!DOCTYPE html>
<html lang="ja">
<?php
$meta_title = $user['name'] . "のプロフィール";
$meta_description = $user['name'] . "さんのikimonでの活動記録とライフリストです。";
?>

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <!-- Custom CSS -->
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
</head>

<body class="js-loading pt-14 bg-base text-text font-body">
    <?php include('components/nav.php'); ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main class="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-32 pb-32">

        <?php
        require_once __DIR__ . '/../libs/Gamification.php';
        require_once __DIR__ . '/../libs/ObserverRank.php';
        // Recalculate stats on profile view for consistency
        $synced = Gamification::syncUserStats($user['id']);
        if ($synced) $user = $synced;

        // Extract Observer Rank data
        $orsData = $user['observer_rank'] ?? ObserverRank::calculate($user['id'] ?? '');
        $orsRank = $orsData['rank'] ?? ['icon' => '🌱', 'name_ja' => '見習い', 'name_en' => 'Apprentice', 'color' => '#8bc34a'];
        $orsLevel = $orsData['level'] ?? 1;
        $orsScore = $orsData['ors'] ?? 0;
        $orsProgress = $orsData['progress'] ?? 0;
        $orsAxes = $orsData['axes'] ?? ['recorder' => 0, 'identifier' => 0, 'fieldwork' => 0, 'bonus' => 0];
        $orsNextThreshold = $orsData['next_threshold'] ?? null;
        ?>

        <!-- Profile Header -->
        <header class="flex flex-col md:flex-row items-center md:items-start gap-12 mb-20">
            <!-- Left: Avatar (Clickable for Menu) -->
            <div class="relative group" x-data="{ showMenu: false }">
                <div @click="showMenu = !showMenu" class="w-40 h-40 rounded-[var(--radius-lg)] overflow-hidden border-4 border-surface shadow-2xl cursor-pointer hover:border-primary/30 transition active:scale-95 relative z-10">
                    <img src="<?php echo $user['avatar']; ?>" class="w-full h-full object-cover">
                    <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <i data-lucide="more-horizontal" class="text-white w-8 h-8 drop-shadow-md"></i>
                    </div>
                </div>

                <!-- Badges Row -->
                <div class="absolute -bottom-4 right-0 flex gap-1 justify-center w-full z-20 pointer-events-none">
                    <?php
                    $displayed_badges = array_slice($user['badges'] ?? [], -3); // Show last 3
                    foreach ($displayed_badges as $bKey):
                        $badge = Gamification::getBadgeDetails($bKey);
                        if (!$badge) continue;
                    ?>
                        <div class="w-8 h-8 rounded-full bg-[var(--color-bg-base)] border border-<?php echo $badge['color']; ?> flex items-center justify-center text-xs shadow-lg" title="<?php echo $badge['name']; ?>">
                            <?php echo $badge['icon']; ?>
                        </div>
                    <?php endforeach; ?>
                </div>

                <!-- Dropdown Menu -->
                <div x-show="showMenu" @click.away="showMenu = false"
                    x-cloak
                    style="display: none;"
                    x-transition:enter="transition ease-out duration-200"
                    x-transition:enter-end="opacity-100 translate-y-0"
                    class="absolute top-full left-0 mt-4 w-48 bg-elevated border border-border-strong rounded-xl shadow-2xl overflow-hidden z-30">
                    <a href="profile_edit.php" class="block w-full text-left px-4 py-3 text-text hover:bg-surface transition flex items-center gap-3">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                        プロフィール編集
                    </a>
                    <div class="h-px bg-border mx-2"></div>
                    <a href="logout.php" class="block w-full text-left px-4 py-3 text-danger hover:bg-danger/10 transition flex items-center gap-3 font-bold">
                        <i data-lucide="log-out" class="w-4 h-4"></i>
                        ログアウト
                    </a>
                </div>
            </div>

            <!-- Right: User Info -->
            <div class="flex-1 text-center md:text-left">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <!-- Name & Rank -->
                    <div>
                        <h1 class="text-3xl md:text-4xl font-black tracking-tight mb-2 flex flex-col md:flex-row items-center md:items-end gap-3 justify-center md:justify-start text-text">
                            <?php echo $user['name']; ?>
                            <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5" style="background: <?php echo $orsRank['color']; ?>15; border: 1px solid <?php echo $orsRank['color']; ?>40; color: <?php echo $orsRank['color']; ?>;">
                                <span class="text-sm"><?php echo $orsRank['icon']; ?></span>
                                <?php echo $orsRank['name_ja']; ?> Lv.<?php echo $orsLevel; ?>
                            </span>
                        </h1>
                        <p class="text-muted max-w-xl mx-auto md:mx-0 leading-relaxed">
                            <?php echo nl2br(htmlspecialchars($user['bio'] ?? 'まだ自己紹介がありません。')); ?>
                        </p>
                    </div>

                    <!-- Only Show Edit Button on Desktop if needed, or remove completely since it's in the menu now -->
                    <!-- Removing the standalone buttons as per user request "Iran yo" -->
                </div>

                <div class="flex flex-wrap justify-center md:justify-start gap-8 mt-8">
                    <div class="text-center">
                        <p class="text-4xl md:text-5xl font-heading font-black text-primary tracking-tight"><?php echo $user['post_count'] ?? 0; ?></p>
                        <p class="font-bold text-muted uppercase tracking-widest mt-1" style="font-size: var(--text-xs);">記録</p>
                    </div>
                    <div class="text-center">
                        <p class="text-4xl md:text-5xl font-heading font-black text-text tracking-tight"><?php echo $user['species_count'] ?? 0; ?></p>
                        <p class="font-bold text-muted uppercase tracking-widest mt-1" style="font-size: var(--text-xs);">種数</p>
                    </div>
                    <div class="text-center">
                        <p class="text-4xl md:text-5xl font-heading font-black text-secondary tracking-tight"><?php echo $user['score']; ?></p>
                        <p class="font-bold text-muted uppercase tracking-widest mt-1" style="font-size: var(--text-xs);">スコア</p>
                    </div>

                </div>
            </div>

        </header>

        <!-- Ambient Presence Section -->
        <section class="mb-12" x-data="ambientProfile()" x-init="loadData()">
            <!-- Observer Rank Card -->
            <div class="bg-surface border border-border rounded-2xl p-6 mb-4">
                <div class="flex items-center justify-between mb-5">
                    <div class="flex items-center gap-4">
                        <span class="text-4xl" style="filter: drop-shadow(0 2px 8px <?php echo $orsRank['color']; ?>40);"><?php echo $orsRank['icon']; ?></span>
                        <div>
                            <h3 class="text-lg font-black text-text"><?php echo $orsRank['name_ja']; ?></h3>
                            <p class="text-xs text-muted">観察者スコア: <span class="font-bold text-primary"><?php echo number_format($orsScore); ?></span></p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-2xl font-black" style="color: <?php echo $orsRank['color']; ?>;">Lv.<?php echo $orsLevel; ?></span>
                        <?php if ($orsNextThreshold): ?>
                            <p class="text-muted" style="font-size: var(--text-xs);">次のランクまで: <?php echo number_format($orsNextThreshold); ?> ポイント</p>
                        <?php endif; ?>
                    </div>
                </div>
                <!-- Progress Bar -->
                <div class="relative h-3 rounded-full bg-[var(--color-bg-base)] overflow-hidden mb-5">
                    <div class="absolute inset-y-0 left-0 rounded-full transition-all duration-1000" style="width: <?php echo $orsProgress; ?>%; background: linear-gradient(90deg, <?php echo $orsRank['color']; ?>, <?php echo $orsRank['color']; ?>cc);">
                        <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                </div>
                <!-- 3-Axis Breakdown -->
                <div class="grid grid-cols-3 gap-3">
                    <div class="text-center p-3 rounded-xl bg-[var(--color-bg-base)]">
                        <p class="text-lg font-black text-primary"><?php echo number_format($orsAxes['recorder']); ?></p>
                        <p class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">📝 記録者</p>
                    </div>
                    <div class="text-center p-3 rounded-xl bg-[var(--color-bg-base)]">
                        <p class="text-lg font-black text-secondary"><?php echo number_format($orsAxes['identifier']); ?></p>
                        <p class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">🔬 同定者</p>
                    </div>
                    <div class="text-center p-3 rounded-xl bg-[var(--color-bg-base)]">
                        <p class="text-lg font-black text-accent"><?php echo number_format($orsAxes['fieldwork']); ?></p>
                        <p class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">🥾 フィールドワーク</p>
                    </div>
                </div>
            </div>

            <!-- Time Capsule -->
            <div class="bg-surface border border-border rounded-2xl p-6 mb-4" x-show="capsule && capsule.echoes.length > 0">
                <h3 class="text-sm font-black text-text mb-2 flex items-center gap-2">
                    ⏳ 去年のエコー
                </h3>
                <p class="text-xs text-muted mb-3" x-text="capsule?.narrative"></p>
                <div class="flex gap-2 overflow-x-auto pb-2">
                    <template x-for="echo in (capsule?.echoes || []).slice(0, 5)" :key="echo.id">
                        <a :href="'observation_detail.php?id=' + echo.id" class="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-border hover:border-primary/50 transition">
                            <img :src="echo.photo" class="w-full h-full object-cover" loading="lazy" x-show="echo.photo">
                            <div x-show="!echo.photo" class="w-full h-full bg-surface flex items-center justify-center text-muted text-xs">🌿</div>
                        </a>
                    </template>
                </div>
            </div>

            <!-- Wrapped-style Report Link -->
            <a href="#" @click.prevent="showReport = true" class="block bg-gradient-to-r from-primary-surface to-secondary-surface border border-primary-glow rounded-2xl p-4 hover:border-primary/40 transition group">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-black text-text group-hover:text-primary transition">📊 私の足あとレポート</h3>
                        <p class="text-xs text-muted">今年の活動を振り返る</p>
                    </div>
                    <i data-lucide="chevron-right" class="w-5 h-5 text-muted group-hover:text-primary transition"></i>
                </div>
            </a>

            <!-- My Field Link -->
            <a href="ikimon_walk.php" class="block bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 mt-2 hover:border-green-400 transition group">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                            <i data-lucide="map" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-black text-gray-800 group-hover:text-green-700 transition">さんぽ記録</h3>
                            <p class="text-xs text-gray-500">身近なフィールドの状態をチェック</p>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="w-5 h-5 text-gray-400 group-hover:text-green-600 transition"></i>
                </div>
            </a>

            <!-- Nature Wellness Card -->
            <div class="bg-surface border border-border rounded-2xl p-6 mt-2" x-show="wellness" x-cloak>
                <div class="flex items-center justify-between mb-5">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">🌿</span>
                        <div>
                            <h3 class="text-sm font-black text-text">ネイチャーウェルネス</h3>
                            <p class="text-muted" style="font-size: var(--text-xs);">自然がもたらす心身の健康</p>
                        </div>
                    </div>
                    <a href="wellness.php" class="text-xs font-bold text-primary hover:text-primary-dark transition">詳細 →</a>
                </div>

                <!-- Weekly Nature Time Progress -->
                <div class="mb-5">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs font-bold text-muted uppercase tracking-wider">今週の自然時間</span>
                        <span class="text-xs font-black" :class="wellnessCurrentWeekMin >= 120 ? 'text-primary' : 'text-text'" x-text="wellnessCurrentWeekMin + ' / 120分'"></span>
                    </div>
                    <div class="relative h-3 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
                        <div class="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                            :style="'width:' + Math.min(100, (wellnessCurrentWeekMin / 120 * 100)).toFixed(0) + '%; background: linear-gradient(90deg, #66bb6a, #43a047);'">
                            <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                    <p class="text-muted mt-1" style="font-size: var(--text-xs);" x-show="wellnessCurrentWeekMin >= 120">🎉 WHO推奨の週120分を達成！</p>
                </div>

                <!-- 4 Mini Cards -->
                <div class="grid grid-cols-2 gap-3">
                    <div class="text-center p-3 rounded-xl bg-[var(--color-bg-base)]">
                        <p class="text-lg font-black text-primary" x-text="wellnessCurrentWeekMin + '分'"></p>
                        <p class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">🌳 自然時間</p>
                    </div>
                    <div class="text-center p-3 rounded-xl bg-[var(--color-bg-base)]">
                        <p class="text-lg font-black text-secondary" x-text="(wellness?.physical?.session_count ?? 0) + '回'"></p>
                        <p class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">🥾 セッション</p>
                    </div>
                    <div class="text-center p-3 rounded-xl bg-[var(--color-bg-base)]">
                        <p class="text-lg font-black text-accent" x-text="wellness?.cognitive?.cognitive_engagement ?? 0"></p>
                        <p class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">🧠 認知エンゲージメント</p>
                        <p class="text-muted mt-0.5" style="font-size: 9px;">参考指標</p>
                    </div>
                    <div class="text-center p-3 rounded-xl bg-[var(--color-bg-base)]">
                        <p class="text-lg font-black text-text" x-text="(wellness?.emotional?.lifelist_total ?? 0) + '種'"></p>
                        <p class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">📋 ライフリスト</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Stats Grid & Tabs -->
        <?php
        // Load event log data for this user
        $eventHistory = EventLogService::getUserEventHistory($user['id']);
        $eventStats = EventLogService::getUserEventStats($user['id']);
        // Survey data
        $surveyHistory = SurveyLogService::getUserSurveyHistory($user['id']);
        $surveyStats = SurveyLogService::getUserSurveyStats($user['id']);
        ?>
        <div x-data="{ tab: 'observations' }">
            <div class="sticky top-20 z-30 bg-base/95 backdrop-blur-md border-b border-border mb-12 flex gap-6 md:gap-12 pt-4 overflow-x-auto">
                <button @click="tab = 'observations'" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2 whitespace-nowrap" :class="tab === 'observations' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-text'">記録</button>
                <button @click="tab = 'badges'" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2 whitespace-nowrap" :class="tab === 'badges' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-text'">📛 バッジ</button>
                <button @click="tab = 'events'" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2 whitespace-nowrap" :class="tab === 'events' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-text'">📅 観察会</button>
                <button @click="tab = 'lifelist'" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2 whitespace-nowrap" :class="tab === 'lifelist' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-text'">ライフリスト</button>
                <button @click="tab = 'stats'" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2 whitespace-nowrap" :class="tab === 'stats' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-text'">統計</button>
                <button @click="tab = 'surveys'" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2 whitespace-nowrap" :class="tab === 'surveys' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-text'">🔬 調査</button>
            </div>

            <!-- Observations Grid -->
            <div x-show="tab === 'observations'" x-transition>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    <?php if (empty($user_obs)): ?>
                        <p class="col-span-full py-20 text-center text-muted font-bold">まだ観察がありません。投稿してみましょう！</p>
                    <?php else: ?>
                        <?php foreach (array_reverse($user_obs) as $obs): ?>
                            <a href="observation_detail.php?id=<?php echo $obs['id']; ?>" class="group block">
                                <div class="aspect-square rounded-2xl overflow-hidden mb-3 relative">
                                    <img src="<?php echo $obs['photos'][0]; ?>" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                                    <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition"></div>
                                </div>
                                <p class="text-xs font-bold leading-tight truncate"><?php echo $obs['taxon']['name'] ?? '種名募集中'; ?></p>
                                <p class="text-muted mt-1" style="font-size: var(--text-xs);"><?php echo date('Y.m.d', strtotime($obs['observed_at'])); ?></p>
                            </a>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Badge Collection Tab -->
            <div x-show="tab === 'badges'" x-transition>
                <div class="text-center py-12 bg-surface border border-border rounded-3xl mb-8">
                    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-50 text-orange-500 mb-6">
                        <i data-lucide="award" class="w-10 h-10"></i>
                    </div>
                    <h3 class="text-2xl font-black text-text mb-2">バッジコレクション</h3>
                    <p class="text-muted mb-0">あなたの活動の証。コンプリートを目指そう！</p>
                </div>

                <?php
                $all_badges = BadgeManager::getDefinitions();
                // $my_badges is already loaded at line 20
                $my_badge_ids = array_column($my_badges, 'id');
                ?>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <?php foreach ($all_badges as $badge):
                        $is_owned = in_array($badge['id'], $my_badge_ids);
                        // Color handling: Assuming 'color' is a tailwind color name like 'primary' or 'red-500'
                        // If it is 'primary', border-primary works.
                        $badgeColor = $badge['color'] ?? 'primary';
                    ?>
                        <div class="glass-card p-6 rounded-2xl border-border text-center flex flex-col items-center justify-center h-full relative group transition hover:-translate-y-1 hover:shadow-md <?php echo $is_owned ? '' : 'opacity-60 grayscale bg-gray-50/50'; ?>">
                            <div class="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4 shadow-sm <?php echo $is_owned ? 'bg-surface border-2 border-' . $badgeColor : 'bg-gray-100 text-gray-300 border-2 border-dashed border-gray-300'; ?>">
                                <?php echo $badge['icon']; ?>
                            </div>
                            <h4 class="text-sm font-bold text-text mb-2 leading-tight"><?php echo $badge['name']; ?></h4>
                            <p class="text-xs text-muted leading-snug"><?php echo $badge['description']; ?></p>

                            <?php if (!$is_owned): ?>
                                <div class="absolute top-3 right-3 text-muted opacity-30">
                                    <i data-lucide="lock" class="w-4 h-4"></i>
                                </div>
                            <?php else: ?>
                                <div class="absolute top-3 right-3 text-<?php echo $badgeColor; ?> opacity-0 group-hover:opacity-100 transition">
                                    <i data-lucide="check-circle" class="w-4 h-4"></i>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- Event Log (観察会ライフログ) -->
            <div x-show="tab === 'events'" x-transition>
                <?php if ($eventStats['event_count'] > 0): ?>
                    <!-- Summary Stats -->
                    <div class="grid grid-cols-3 gap-4 mb-8">
                        <div class="glass-card p-4 rounded-2xl border-border text-center">
                            <div class="text-3xl font-black text-primary"><?php echo $eventStats['event_count']; ?></div>
                            <div class="font-bold text-muted uppercase tracking-wider mt-1" style="font-size: var(--text-xs);">参加回数</div>
                        </div>
                        <div class="glass-card p-4 rounded-2xl border-border text-center">
                            <div class="text-3xl font-black text-secondary"><?php echo $eventStats['total_observations']; ?></div>
                            <div class="font-bold text-muted uppercase tracking-wider mt-1" style="font-size: var(--text-xs);">観察会で記録</div>
                        </div>
                        <div class="glass-card p-4 rounded-2xl border-border text-center">
                            <div class="text-3xl font-black text-accent"><?php echo $eventStats['unique_species']; ?></div>
                            <div class="font-bold text-muted uppercase tracking-wider mt-1" style="font-size: var(--text-xs);">発見種</div>
                        </div>
                    </div>

                    <!-- Year-by-Year Event Cards -->
                    <?php foreach ($eventHistory as $year => $events): ?>
                        <div class="mb-8">
                            <h3 class="text-sm font-black text-muted uppercase tracking-widest mb-4">📅 <?php echo $year; ?>年</h3>
                            <div class="space-y-4">
                                <?php foreach ($events as $evt):
                                    $evtDate = new DateTime($evt['event_date'] ?? 'now');
                                    $evtDow = ['日', '月', '火', '水', '木', '金', '土'][$evtDate->format('w')];
                                    $userObs = EventLogService::getEventObservations($evt['id'], $user['id']);
                                ?>
                                    <div class="glass-card rounded-2xl border-border overflow-hidden" x-data="{ expanded: false }">
                                        <div @click="expanded = !expanded" class="p-5 cursor-pointer hover:bg-surface transition">
                                            <div class="flex items-start justify-between">
                                                <div>
                                                    <h4 class="text-base font-bold text-text"><?php echo htmlspecialchars($evt['title'] ?? ''); ?></h4>
                                                    <div class="flex items-center gap-3 mt-1 text-xs text-muted">
                                                        <span><?php echo $evtDate->format('n/j'); ?>（<?php echo $evtDow; ?>）</span>
                                                        <span>📍 <?php echo htmlspecialchars($evt['location_name'] ?? ''); ?></span>
                                                    </div>
                                                </div>
                                                <div class="text-right">
                                                    <div class="text-xs font-bold text-primary">📸 <?php echo count($userObs); ?>件</div>
                                                    <span class="material-symbols-outlined text-muted text-sm transition" :class="expanded ? 'rotate-180' : ''">expand_more</span>
                                                </div>
                                            </div>
                                        </div>
                                        <!-- Expanded: Thumbnails -->
                                        <div x-show="expanded" x-transition class="px-5 pb-5">
                                            <?php if (!empty($userObs)): ?>
                                                <div class="grid grid-cols-4 gap-2">
                                                    <?php foreach (array_slice($userObs, 0, 8) as $obs): ?>
                                                        <a href="observation_detail.php?id=<?php echo urlencode($obs['id'] ?? ''); ?>" class="block">
                                                            <?php if (!empty($obs['photos'][0])): ?>
                                                                <img src="<?php echo htmlspecialchars($obs['photos'][0]); ?>" alt="" class="w-full aspect-square object-cover rounded-lg shadow-sm hover:shadow-md transition">
                                                            <?php else: ?>
                                                                <div class="w-full aspect-square bg-surface rounded-lg flex items-center justify-center text-muted">
                                                                    <span class="material-symbols-outlined text-sm">photo_camera</span>
                                                                </div>
                                                            <?php endif; ?>
                                                        </a>
                                                    <?php endforeach; ?>
                                                </div>
                                                <?php if (count($userObs) > 8): ?>
                                                    <p class="text-xs text-muted text-center mt-2">他 <?php echo count($userObs) - 8; ?> 件の記録</p>
                                                <?php endif; ?>
                                            <?php else: ?>
                                                <p class="text-xs text-muted">この観察会での記録はまだありません</p>
                                            <?php endif; ?>
                                            <a href="event_detail.php?id=<?php echo urlencode($evt['id']); ?>" class="inline-block mt-3 text-xs font-bold text-primary hover:text-primary-dark transition">くわしく見る →</a>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>

                    <!-- First Event Badge -->
                    <?php if (!empty($eventStats['first_event_date'])): ?>
                        <div class="text-center text-xs text-muted mt-4">
                            🏆 初回参加: <?php echo date('Y年n月', strtotime($eventStats['first_event_date'])); ?>
                        </div>
                    <?php endif; ?>

                <?php else: ?>
                    <!-- Empty State -->
                    <div class="text-center py-20">
                        <span class="text-5xl block mb-4">🌿</span>
                        <p class="text-muted font-bold mb-2">まだ観察会に参加していません</p>
                        <p class="text-sm text-faint mb-6">観察会に参加して、仲間と一緒に発見しよう！</p>
                        <a href="events.php" class="inline-block bg-gradient-to-r from-primary to-secondary text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition text-sm">
                            📅 観察会カレンダーを見る
                        </a>
                    </div>
                <?php endif; ?>
            </div>

            <!-- Survey Journal Tab -->
            <div x-show="tab === 'surveys'" x-transition>
                <?php if ($surveyStats['survey_count'] > 0): ?>
                    <!-- Summary Stats -->
                    <div class="grid grid-cols-3 gap-4 mb-8">
                        <div class="glass-card p-4 rounded-2xl border-border text-center">
                            <div class="text-3xl font-black text-primary"><?php echo $surveyStats['survey_count']; ?></div>
                            <div class="font-bold text-muted uppercase tracking-wider mt-1" style="font-size: var(--text-xs);">調査回数</div>
                        </div>
                        <div class="glass-card p-4 rounded-2xl border-border text-center">
                            <?php
                            $totalHrs = floor($surveyStats['total_duration_min'] / 60);
                            $totalMins = $surveyStats['total_duration_min'] % 60;
                            ?>
                            <div class="text-3xl font-black text-secondary"><?php echo $totalHrs; ?><span class="text-lg">h</span><?php echo $totalMins; ?><span class="text-lg">m</span></div>
                            <div class="font-bold text-muted uppercase tracking-wider mt-1" style="font-size: var(--text-xs);">累計時間</div>
                        </div>
                        <div class="glass-card p-4 rounded-2xl border-border text-center">
                            <div class="text-3xl font-black text-accent"><?php echo $surveyStats['total_species']; ?></div>
                            <div class="font-bold text-muted uppercase tracking-wider mt-1" style="font-size: var(--text-xs);">発見種</div>
                        </div>
                    </div>

                    <!-- Quality Score & Protocol Breakdown -->
                    <div class="grid grid-cols-2 gap-4 mb-8">
                        <div class="glass-card p-4 rounded-2xl border-border">
                            <div class="text-xs font-bold text-muted uppercase tracking-wider mb-2">平均品質スコア</div>
                            <div class="flex items-center gap-3">
                                <div class="flex-1 bg-surface rounded-full h-3 overflow-hidden">
                                    <div class="h-full rounded-full transition-all duration-500"
                                        style="width: <?php echo $surveyStats['avg_quality_score']; ?>%; background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));"></div>
                                </div>
                                <span class="text-sm font-black text-text"><?php echo $surveyStats['avg_quality_score']; ?></span>
                            </div>
                        </div>
                        <div class="glass-card p-4 rounded-2xl border-border">
                            <div class="text-xs font-bold text-muted uppercase tracking-wider mb-2">プロトコル</div>
                            <div class="flex gap-2">
                                <?php foreach ($surveyStats['protocols'] as $proto => $cnt): ?>
                                    <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold <?php echo $proto === 'traveling' ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'; ?>">
                                        <?php echo $proto === 'traveling' ? '🚶' : '🍃'; ?>
                                        <?php echo $cnt; ?>
                                    </span>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>

                    <!-- Month-by-Month Survey Cards -->
                    <?php foreach ($surveyHistory as $ym => $surveys):
                        $ymParts = explode('-', $ym);
                        $ymLabel = ($ymParts[0] ?? '????') . '年' . ltrim($ymParts[1] ?? '?', '0') . '月';
                    ?>
                        <div class="mb-8">
                            <h3 class="text-sm font-black text-muted uppercase tracking-widest mb-4">🔬 <?php echo $ymLabel; ?> <span class="text-xs font-normal">(<?php echo count($surveys); ?>回)</span></h3>
                            <div class="space-y-3">
                                <?php foreach ($surveys as $srv):
                                    $srvDate = new DateTime($srv['started_at'] ?? 'now');
                                    $srvDow = ['日', '月', '火', '水', '木', '金', '土'][$srvDate->format('w')];
                                    $srvStats = $srv['stats'] ?? [];
                                    $srvCtx = $srv['context'] ?? [];
                                    $qualScore = $srvStats['quality_score'] ?? 50;
                                ?>
                                    <div class="glass-card rounded-2xl border-border overflow-hidden" x-data="{ expanded: false }">
                                        <div @click="expanded = !expanded" class="p-4 cursor-pointer hover:bg-surface transition">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-3">
                                                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg <?php echo ($srv['protocol'] ?? '') === 'traveling' ? 'bg-teal-50' : 'bg-slate-50'; ?>">
                                                        <?php echo ($srv['protocol'] ?? '') === 'traveling' ? '🚶' : '🍃'; ?>
                                                    </div>
                                                    <div>
                                                        <div class="flex items-baseline gap-2">
                                                            <h4 class="text-sm font-bold text-text"><?php echo $srvDate->format('n/j'); ?>（<?php echo $srvDow; ?>）</h4>
                                                            <span class="text-xs text-muted font-mono"><?php echo $srvDate->format('H:i'); ?></span>
                                                        </div>
                                                        <div class="flex items-center gap-3 mt-0.5 text-xs text-muted">
                                                            <span>⏱ <?php echo $srvStats['duration_min'] ?? 0; ?>分</span>
                                                            <span>📷 <?php echo $srvStats['obs_count'] ?? 0; ?></span>
                                                            <span>🌿 <?php echo $srvStats['sp_count'] ?? 0; ?>種</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <?php
                                                    $wt = $srvCtx['weather_type'] ?? ($srvCtx['weather'] ?? '');
                                                    if ($wt): ?>
                                                        <span class="text-sm"><?php echo htmlspecialchars(SurveyLogService::getWeatherLabel($wt)); ?></span>
                                                    <?php endif; ?>
                                                    <span class="material-symbols-outlined text-muted text-sm transition" :class="expanded ? 'rotate-180' : ''">expand_more</span>
                                                </div>
                                            </div>
                                        </div>
                                        <!-- Expanded Details -->
                                        <div x-show="expanded" x-transition class="px-4 pb-4 border-t border-border/50">
                                            <div class="pt-3 space-y-3">
                                                <!-- Quality Score Bar -->
                                                <div>
                                                    <div class="flex justify-between items-center mb-1">
                                                        <span class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">品質スコア</span>
                                                        <span class="text-xs font-black <?php echo $qualScore >= 80 ? 'text-primary' : ($qualScore >= 60 ? 'text-secondary' : 'text-muted'); ?>"><?php echo $qualScore; ?>/100</span>
                                                    </div>
                                                    <div class="bg-surface rounded-full h-2 overflow-hidden">
                                                        <div class="h-full rounded-full transition-all duration-500"
                                                            style="width: <?php echo $qualScore; ?>%; background: linear-gradient(90deg, <?php echo $qualScore >= 80 ? 'var(--color-primary), var(--color-secondary)' : ($qualScore >= 60 ? 'var(--color-secondary), var(--color-accent)' : '#94a3b8, #cbd5e1'); ?>);"></div>
                                                    </div>
                                                </div>
                                                <!-- Context Chips -->
                                                <div class="flex flex-wrap gap-2">
                                                    <?php if (!empty($srvCtx['temp_range'])): ?>
                                                        <span class="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full">
                                                            <?php echo htmlspecialchars(SurveyLogService::getTempRangeLabel($srvCtx['temp_range'])); ?>
                                                        </span>
                                                    <?php endif; ?>
                                                    <?php if (($srv['protocol'] ?? '') === 'traveling'): ?>
                                                        <span class="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-full">🚶 トランセクト</span>
                                                    <?php endif; ?>
                                                </div>
                                                <!-- Notes -->
                                                <?php if (!empty($srvCtx['notes'])): ?>
                                                    <div class="text-xs text-muted bg-surface rounded-xl p-3">
                                                        <span class="font-bold text-text">📝 メモ:</span>
                                                        <?php echo nl2br(htmlspecialchars($srvCtx['notes'])); ?>
                                                    </div>
                                                <?php endif; ?>
                                            </div>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>

                    <!-- First Survey Badge -->
                    <?php if (!empty($surveyStats['first_survey_date'])): ?>
                        <div class="text-center text-xs text-muted mt-4">
                            🏆 初回調査: <?php echo date('Y年n月j日', strtotime($surveyStats['first_survey_date'])); ?>
                        </div>
                    <?php endif; ?>

                <?php else: ?>
                    <!-- Empty State -->
                    <div class="text-center py-20">
                        <span class="text-5xl block mb-4">🔬</span>
                        <p class="text-muted font-bold mb-2">まだ調査を行っていません</p>
                        <p class="text-sm text-faint mb-6">フィールド調査を始めて、発見を科学データとして記録しよう！</p>
                        <a href="survey.php" class="inline-block bg-gradient-to-r from-primary to-secondary text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition text-sm">
                            🔬 調査を始める
                        </a>
                    </div>
                <?php endif; ?>
            </div>

            <!-- Life List (Placeholder for now) -->
            <!-- Life List (Dynamic) -->
            <div x-show="tab === 'lifelist'" x-transition>
                <div class="text-center py-12 bg-surface border border-border rounded-3xl">
                    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mb-6">
                        <i data-lucide="layout-grid" class="w-10 h-10"></i>
                    </div>
                    <h3 class="text-2xl font-black text-text mb-2">デジタル標本箱</h3>
                    <p class="text-muted mb-8 max-w-md mx-auto">あなたが発見した<?php echo count($life_list); ?>種の生き物を<br>美しいコレクションとして閲覧できます。</p>

                    <a href="my_organisms.php" class="inline-flex items-center gap-3 px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition group">
                        <span>コレクションを見る</span>
                        <i data-lucide="arrow-right" class="w-5 h-5 group-hover:translate-x-1 transition"></i>
                    </a>
                </div>

                <?php
                // Group by taxonomy (simple grouping based on name for prototype)
                $kingdoms = [
                    '植物' => ['count' => 0, 'icon' => 'leaf', 'color' => 'text-primary', 'bg' => 'bg-primary/10', 'match' => ['タンポポ', 'ドクダミ', 'オオバコ', 'ススキ', 'ヒメジョオン', 'シロツメクサ', 'ツユクサ', 'アジサイ', 'アサガオ', 'ヒマワリ']],
                    '昆虫' => ['count' => 0, 'icon' => 'bug', 'color' => 'text-accent', 'bg' => 'bg-accent/10', 'match' => ['ゼミ', 'カブト', 'チョウ', 'トンボ', 'バッタ', 'テントウ']],
                    '鳥類' => ['count' => 0, 'icon' => 'feather', 'color' => 'text-secondary', 'bg' => 'bg-secondary/10', 'match' => ['ガラス', 'スズメ', 'ヒヨドリ', 'ハト', 'ツバメ', 'カラ']],
                    '魚類' => ['count' => 0, 'icon' => 'waves', 'color' => 'text-secondary', 'bg' => 'bg-secondary/10', 'match' => ['コイ', 'フナ', 'メダカ', 'ナマズ', 'オイカワ']],
                    '哺乳類' => ['count' => 0, 'icon' => 'paw-print', 'color' => 'text-accent', 'bg' => 'bg-accent/10', 'match' => ['タヌキ', 'アライグマ', 'ネコ', 'イタチ', 'ハクビシン']],
                    'その他' => ['count' => 0, 'icon' => 'help-circle', 'color' => 'text-muted', 'bg' => 'bg-surface', 'match' => []]
                ];

                $species_seen = [];

                foreach ($life_list as $taxon) {
                    $name = $taxon['name'];
                    // Simple text matching for categorization
                    $found = false;
                    foreach ($kingdoms as $k => $data) {
                        if ($k === 'Others') continue;
                        foreach ($data['match'] as $keyword) {
                            if (strpos($name, $keyword) !== false) {
                                $kingdoms[$k]['count']++;
                                $found = true;
                                break 2;
                            }
                        }
                    }
                    if (!$found) $kingdoms['Others']['count']++;
                }
                ?>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <?php foreach ($kingdoms as $name => $k): ?>
                        <?php if ($k['count'] > 0): ?>
                            <div class="glass-card p-5 md:p-8 rounded-3xl border-border flex items-center gap-6">
                                <div class="w-20 h-20 rounded-2xl <?php echo $k['bg']; ?> flex items-center justify-center <?php echo $k['color']; ?>">
                                    <i data-lucide="<?php echo $k['icon']; ?>" class="w-10 h-10"></i>
                                </div>
                                <div>
                                    <p class="text-xs font-bold text-muted uppercase mb-1">分類</p>
                                    <h3 class="text-xl font-bold text-text"><?php echo $name; ?></h3>
                                    <p class="text-sm font-bold <?php echo htmlspecialchars(str_replace('text-', 'text-', $k['color'])); ?> mt-2 opacity-80"><?php echo $k['count']; ?> 種確認</p>
                                </div>
                            </div>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- Stats (Charts placeholder) -->
            <div x-show="tab === 'stats'" x-transition>
                <div class="space-y-12">
                    <!-- Contribution Graph -->
                    <div class="glass-card p-5 md:p-8 rounded-3xl border-border">
                        <div class="flex items-center justify-between mb-8">
                            <h3 class="font-black text-lg text-text">活動ログ</h3>
                            <div class="flex items-center gap-2 font-bold text-muted" style="font-size: var(--text-xs);">
                                <!-- Badges (Dynamic) -->
                                <div class="mt-4 flex flex-wrap gap-2 justify-center">
                                    <?php
                                    $my_badges = [];
                                    foreach ($user['badges'] ?? [] as $bKey) {
                                        $badge = Gamification::getBadgeDetails($bKey);
                                        if ($badge) {
                                            $my_badges[] = $badge;
                                        }
                                    }
                                    ?>
                                    <?php foreach ($my_badges as $badge): ?>
                                        <div class="px-3 py-1 rounded-full border flex items-center gap-1.5 <?php echo $badge['color']; ?>">
                                            <i data-lucide="<?php echo $badge['icon']; ?>" class="w-3 h-3"></i>
                                            <span class="text-xs font-bold"><?php echo $badge['name']; ?></span>
                                        </div>
                                    <?php endforeach; ?>
                                    <?php if (empty($my_badges)): ?>
                                        <div class="px-3 py-1 rounded-full border border-border bg-surface text-muted flex items-center gap-1.5">
                                            <span class="text-xs font-bold">バッジなし</span>
                                        </div>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>

                        <?php
                        // Generate last 180 days data
                        $today = new DateTime();
                        $start = (clone $today)->modify('-180 days');
                        $activity_map = [];
                        foreach ($user_obs as $o) {
                            $d = date('Y-m-d', strtotime($o['observed_at']));
                            if (!isset($activity_map[$d])) $activity_map[$d] = 0;
                            $activity_map[$d]++;
                        }

                        // Weeks grid
                        $weeks = [];
                        $current = clone $start;
                        $week = [];

                        // Fill initial empty days to align Sunday
                        for ($i = 0; $i < $current->format('w'); $i++) {
                            $week[] = null;
                        }

                        while ($current <= $today) {
                            $week[] = [
                                'date' => $current->format('Y-m-d'),
                                'count' => $activity_map[$current->format('Y-m-d')] ?? 0
                            ];
                            $current->modify('+1 day');

                            if (count($week) === 7) {
                                $weeks[] = $week;
                                $week = [];
                            }
                        }
                        if (!empty($week)) $weeks[] = $week; // Last week
                        ?>

                        <div class="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                            <?php foreach ($weeks as $w): ?>
                                <div class="flex flex-col gap-2">
                                    <?php foreach ($w as $day): ?>
                                        <?php if ($day === null): ?>
                                            <div class="w-3 h-3"></div>
                                        <?php else: ?>
                                            <?php
                                            $c = $day['count'];
                                            $color = 'bg-surface border border-border';
                                            if ($c > 0) $color = 'bg-primary-surface border-primary-glow';
                                            if ($c > 2) $color = 'bg-primary/50 border-primary-glow';
                                            if ($c > 4) $color = 'bg-primary border-primary-glow shadow-[0_0_10px_var(--color-primary-glow)]';
                                            ?>
                                            <div class="w-3 h-3 rounded-sm <?php echo $color; ?>" title="<?php echo $day['date'] . ': ' . $c . '件の観察'; ?>"></div>
                                        <?php endif; ?>
                                    <?php endforeach; ?>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        function ambientProfile() {
            return {
                growth: null,
                milestones: [],
                capsule: null,
                showReport: false,
                wellness: null,

                get wellnessCurrentWeekMin() {
                    const wn = this.wellness?.weekly_nature;
                    if (!wn || !wn.length) return 0;
                    return wn[wn.length - 1]?.minutes ?? 0;
                },

                async loadData() {
                    const userId = '<?php echo $user['id'] ?? ''; ?>';
                    try {
                        const [compRes, capsRes, wellRes] = await Promise.all([
                            fetch('api/get_completeness.php?user_id=' + userId),
                            fetch('api/get_time_capsule.php?user_id=' + userId),
                            fetch('api/get_wellness_summary.php?period=week'),
                        ]);
                        const comp = await compRes.json();
                        this.growth = comp.growth;
                        this.milestones = comp.milestones || [];

                        this.capsule = await capsRes.json();

                        const wellData = await wellRes.json();
                        if (wellData.success && wellData.data) {
                            this.wellness = wellData.data;
                        }
                    } catch (e) {
                        console.error('Ambient load error', e);
                    }
                    this.$nextTick(() => lucide.createIcons());
                }
            };
        }

        lucide.createIcons();
    </script>
    <?php include __DIR__ . '/components/footer.php'; ?>
</body>

</html>