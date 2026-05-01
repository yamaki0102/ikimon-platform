<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/BadgeManager.php';
require_once __DIR__ . '/../libs/StreakTracker.php';
require_once __DIR__ . '/../libs/SurveyorManager.php';
require_once __DIR__ . '/../libs/PlaceRevisitLoop.php';
require_once __DIR__ . '/../libs/Lang.php';

require_once __DIR__ . '/../libs/Services/EventLogService.php';
require_once __DIR__ . '/../libs/Services/SurveyLogService.php';
require_once __DIR__ . '/components/experience_loop.php';

Auth::init();
Lang::init();
$user = Auth::user();
$documentLang = 'ja';
if (method_exists('Lang', 'current')) {
    $documentLang = Lang::current();
} elseif (!empty($_SESSION['lang'])) {
    $documentLang = (string) $_SESSION['lang'];
} elseif (!empty($_GET['lang'])) {
    $documentLang = (string) $_GET['lang'];
}

// Redirect if not logged in
if (!$user) {
    header('Location: login.php');
    exit;
}

$my_badges = BadgeManager::getUserBadges($user['id']);
$profileStreak = StreakTracker::getStreak($user['id']);


$all_obs = DataStore::fetchAll('observations');

// Filter user's observations (Strict Mode)
$user_obs = array_filter($all_obs, function ($o) use ($user) {
    return isset($o['user_id']) && (string)$o['user_id'] === (string)$user['id'];
});
$placeBuckets = PlaceRevisitLoop::buildBuckets($user_obs);
$recentRevisitPlaces = PlaceRevisitLoop::recent($placeBuckets, 3);
$staleRevisitPlaces = PlaceRevisitLoop::stale($placeBuckets, 3, 21);

// Calculate Life List (Unique Species)
$life_list = [];
foreach ($user_obs as $o) {
    if (isset($o['taxon']['key'])) {
        $life_list[$o['taxon']['key']] = $o['taxon'];
    }
}
$surveyorApproved = SurveyorManager::isApproved($user);
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang) ?>">
<?php
$meta_title = __('profile_page.meta_title_prefix', 'My places') . " — " . $user['name'];
$meta_description = __('profile_page.meta_description', 'A page where you can review {name}’s records and the flow of each place.', [
    'name' => $user['name'],
]);
?>

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
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
        $orsRankLabel = ObserverRank::getRankLabel((int) $orsLevel, $documentLang);
        ?>

        <!-- Profile Header -->
        <header class="flex flex-col md:flex-row items-center md:items-start gap-12 mb-20">
            <!-- Left: Avatar (Clickable for Menu) -->
            <div class="relative group" x-data="{ showMenu: false }">
                <div @click="showMenu = !showMenu" class="w-40 h-40 rounded-[var(--radius-lg)] overflow-hidden border-4 border-surface shadow-2xl cursor-pointer hover:border-primary/30 transition active:scale-95 relative z-10">
                    <img src="<?php echo $user['avatar']; ?>" alt="<?php echo htmlspecialchars($user['name']); ?>のアバター" class="w-full h-full object-cover">
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
                        <div class="w-8 h-8 rounded-full bg-base border border-<?php echo $badge['color']; ?> flex items-center justify-center text-xs shadow-lg" title="<?php echo $badge['name']; ?>">
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
                    style="position:absolute;top:100%;left:0;margin-top:1rem;width:12rem;background:var(--md-surface-container-high);border-radius:var(--shape-md);box-shadow:var(--elev-3);overflow:hidden;z-index:30;">
                    <a href="profile_edit.php" class="block w-full text-left px-4 py-3 text-text hover:bg-surface transition flex items-center gap-3">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                        <?= __('profile_page.edit_profile', 'Edit profile') ?>
                    </a>
                    <div class="h-px bg-border mx-2"></div>
                    <a href="logout.php" class="block w-full text-left px-4 py-3 text-danger hover:bg-danger/10 transition flex items-center gap-3 font-bold">
                        <i data-lucide="log-out" class="w-4 h-4"></i>
                        <?= __('nav.logout', 'Logout') ?>
                    </a>
                </div>
            </div>

            <!-- Right: User Info -->
            <div class="flex-1 text-center md:text-left">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <!-- Name & Rank -->
                    <div>
                        <p class="mb-2 text-xs font-black uppercase tracking-[0.16em] text-primary"><?= __('profile_page.hero_eyebrow', 'My places') ?></p>
                        <h1 class="text-3xl md:text-4xl font-black tracking-tight mb-2 flex flex-col md:flex-row items-center md:items-end gap-3 justify-center md:justify-start text-text">
                            <?php echo $user['name']; ?>
                            <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5" style="background: <?php echo $orsRank['color']; ?>15; border: 1px solid <?php echo $orsRank['color']; ?>40; color: <?php echo $orsRank['color']; ?>;">
                                <span class="text-sm"><?php echo $orsRank['icon']; ?></span>
                                <?php echo htmlspecialchars($orsRankLabel); ?> Lv.<?php echo $orsLevel; ?>
                            </span>
                        </h1>
                        <p class="text-muted max-w-xl mx-auto md:mx-0 leading-relaxed">
                            <?php echo nl2br(htmlspecialchars($user['bio'] ?? __('profile_page.bio_fallback', 'You can revisit the records you saved nearby, place by place.'))); ?>
                        </p>
                    </div>

                    <!-- Only Show Edit Button on Desktop if needed, or remove completely since it's in the menu now -->
                    <!-- Removing the standalone buttons as per user request "Iran yo" -->
                </div>

                <div class="flex flex-wrap justify-center md:justify-start gap-8 mt-8">
                    <div class="text-center">
                        <p class="text-4xl md:text-5xl font-heading font-black text-primary tracking-tight"><?php echo $user['post_count'] ?? 0; ?></p>
                        <p class="font-bold text-muted uppercase tracking-widest mt-1" style="font-size: var(--text-xs);"><?= __('profile_page.stat_records', 'Records') ?></p>
                    </div>
                    <div class="text-center">
                        <p class="text-4xl md:text-5xl font-heading font-black text-text tracking-tight"><?php echo $user['species_count'] ?? 0; ?></p>
                        <p class="font-bold text-muted uppercase tracking-widest mt-1" style="font-size: var(--text-xs);"><?= __('profile_page.stat_species', 'Species found') ?></p>
                    </div>
                    <div class="text-center">
                        <p class="text-4xl md:text-5xl font-heading font-black text-secondary tracking-tight"><?php echo $user['score']; ?></p>
                        <p class="font-bold text-muted uppercase tracking-widest mt-1" style="font-size: var(--text-xs);"><?= __('profile_page.stat_score', 'Score') ?></p>
                        <?php if (($profileStreak['current_streak'] ?? 0) > 0): ?>
                            <span class="inline-flex items-center gap-1 text-sm text-orange-500 font-bold mt-2">
                                🔥 <?= __('profile_page.streak_days', '{days} days in a row', ['days' => $profileStreak['current_streak']]) ?>
                            </span>
                        <?php endif; ?>
                    </div>

                </div>

                <?php if ($surveyorApproved): ?>
                    <div class="mt-6 inline-flex flex-wrap items-center gap-3 px-4 py-3" style="border-radius:var(--shape-xl);background:var(--md-surface-container);box-shadow:var(--elev-1);">
                        <span class="text-sm font-black text-sky-800"><?= __('profile_page.surveyor_public', 'Public as a certified surveyor') ?></span>
                        <a href="surveyor_profile.php?id=<?= urlencode($user['id']) ?>" class="text-xs font-bold text-sky-700 underline"><?= __('profile_page.surveyor_view', 'View public page') ?></a>
                        <a href="surveyor_profile_edit.php" class="text-xs font-bold text-sky-700 underline"><?= __('profile_page.surveyor_edit', 'Edit surveyor profile') ?></a>
                    </div>
                <?php endif; ?>
            </div>

        </header>

        <?php renderExperienceLoop([
            'current' => 'results',
            'class' => 'mb-12',
            'title' => __('profile_page.loop_title', 'マイページから次の観察へ'),
            'lead' => __('profile_page.loop_lead', 'ここで成果を眺めたら、地図で場所を見直し、足りない記録を足し、ガイドで意味を補えます。'),
            'stat_label' => __('profile_page.loop_stat_label', '記録'),
            'stat_value' => number_format(count($user_obs)),
        ]); ?>

        <!-- Ambient Presence Section -->
        <section class="mb-12" x-data="ambientProfile()" x-init="loadData()">
            <!-- Observer Rank Card -->
            <div style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1.5rem;margin-bottom:1rem;box-shadow:var(--elev-1);">
                <div class="flex items-center justify-between mb-5">
                    <div class="flex items-center gap-4">
                        <span class="text-4xl" style="filter: drop-shadow(0 2px 8px <?php echo $orsRank['color']; ?>40);"><?php echo $orsRank['icon']; ?></span>
                        <div>
                            <h3 class="text-lg font-black text-text"><?= __('profile_page.summary_title', 'Record summary') ?></h3>
                            <p class="text-xs text-muted"><?php echo htmlspecialchars($orsRankLabel); ?> · <?= __('profile_page.stat_score', 'Score') ?> <span class="font-bold text-primary"><?php echo number_format($orsScore); ?></span></p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-2xl font-black" style="color: <?php echo $orsRank['color']; ?>;">Lv.<?php echo $orsLevel; ?></span>
                        <?php if ($orsNextThreshold): ?>
                            <p class="text-muted" style="font-size: var(--text-xs);"><?= __('profile_page.next_rank', 'Next rank in: {points} points', ['points' => number_format($orsNextThreshold)]) ?></p>
                        <?php endif; ?>
                    </div>
                </div>
                <!-- Progress Bar -->
                <div class="relative h-3 rounded-full bg-base overflow-hidden mb-5">
                    <div class="absolute inset-y-0 left-0 rounded-full transition-all duration-1000" style="width: <?php echo $orsProgress; ?>%; background: linear-gradient(90deg, <?php echo $orsRank['color']; ?>, <?php echo $orsRank['color']; ?>cc);">
                        <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                </div>
                <!-- 3-Axis Breakdown -->
                <div class="grid grid-cols-3 gap-3">
                    <div class="text-center p-3" style="border-radius:var(--shape-md);background:var(--md-surface-container-low);">
                        <p class="text-lg font-black text-primary"><?php echo number_format($orsAxes['recorder']); ?></p>
                        <p class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">📝 <?= __('profile_page.axis_record', 'Recording') ?></p>
                    </div>
                    <div class="text-center p-3" style="border-radius:var(--shape-md);background:var(--md-surface-container-low);">
                        <p class="text-lg font-black text-secondary"><?php echo number_format($orsAxes['identifier']); ?></p>
                        <p class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">🔬 <?= __('profile_page.axis_identify', 'Identifier') ?></p>
                    </div>
                    <div class="text-center p-3" style="border-radius:var(--shape-md);background:var(--md-surface-container-low);">
                        <p class="text-lg font-black text-accent"><?php echo number_format($orsAxes['fieldwork']); ?></p>
                        <p class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">🥾 <?= __('profile_page.axis_fieldwork', 'Fieldwork') ?></p>
                    </div>
                </div>
            </div>

            <!-- Time Capsule -->
            <div style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1.5rem;margin-bottom:1rem;box-shadow:var(--elev-1);" x-show="capsule && capsule.echoes.length > 0">
                <h3 class="text-sm font-black text-text mb-2 flex items-center gap-2">
                    ⏳ <?= __('profile_page.echo_title', 'Last year’s echo') ?>
                </h3>
                <p class="text-xs text-muted mb-3" x-text="capsule?.narrative"></p>
                <div class="flex gap-2 overflow-x-auto pb-2">
                    <template x-for="echo in (capsule?.echoes || []).slice(0, 5)" :key="echo.id">
                        <a :href="'observation_detail.php?id=' + echo.id" class="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-border hover:border-primary/50 transition">
                            <img :src="echo.photo" :alt="(echo.taxon_name || echo.name || '観察写真')" class="w-full h-full object-cover" loading="lazy" x-show="echo.photo">
                            <div x-show="!echo.photo" class="w-full h-full bg-surface flex items-center justify-center text-muted text-xs">🌿</div>
                        </a>
                    </template>
                </div>
            </div>

            <!-- Wrapped-style Report Link -->
            <a href="#" @click.prevent="showReport = true" style="display:block;background:var(--md-primary-container);border-radius:var(--shape-xl);padding:1rem;text-decoration:none;box-shadow:var(--elev-1);" class="group transition">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-black text-text group-hover:text-primary transition">📊 <?= __('profile_page.report_title', 'My places report') ?></h3>
                        <p class="text-xs text-muted"><?= __('profile_page.report_body', 'Review records by place') ?></p>
                    </div>
                    <i data-lucide="chevron-right" class="w-5 h-5 text-muted group-hover:text-primary transition"></i>
                </div>
            </a>

            <!-- My Field Link -->
            <a href="ikimon_walk.php" style="display:block;background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1rem;margin-top:0.5rem;text-decoration:none;box-shadow:var(--elev-1);" class="group transition">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                            <i data-lucide="map" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-black text-gray-800 group-hover:text-green-700 transition"><?= __('profile_page.walk_title', 'Field notes') ?></h3>
                            <p class="text-xs text-gray-500"><?= __('profile_page.walk_body', 'Gather records from places you walked') ?></p>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="w-5 h-5 text-gray-400 group-hover:text-green-600 transition"></i>
                </div>
            </a>

            <?php if (!empty($recentRevisitPlaces) || !empty($staleRevisitPlaces)): ?>
                <div style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1.25rem;margin-top:0.75rem;box-shadow:var(--elev-1);">
                    <div class="flex items-start justify-between gap-4 mb-4">
                        <div>
                            <h3 class="text-sm font-black text-text"><?= __('profile_page.revisit_title', 'Revisit loops') ?></h3>
                            <p class="text-xs text-muted mt-1"><?= __('profile_page.revisit_body', 'See where the flow is already moving and which places are ready for one more dated trace.') ?></p>
                        </div>
                    </div>
                    <div class="grid gap-4 md:grid-cols-2">
                        <?php if (!empty($recentRevisitPlaces)): ?>
                            <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                <p class="text-[10px] font-black uppercase tracking-widest text-emerald-700"><?= __('profile_page.revisit_recent_title', 'Recently revisited') ?></p>
                                <div class="mt-3 space-y-3">
                                    <?php foreach ($recentRevisitPlaces as $place): ?>
                                        <?php
                                        $recordAgainHref = 'post.php?' . http_build_query([
                                            'return' => 'profile.php',
                                            'lat' => $place['lat'] !== null ? number_format((float)$place['lat'], 6, '.', '') : null,
                                            'lng' => $place['lng'] !== null ? number_format((float)$place['lng'], 6, '.', '') : null,
                                            'location_name' => $place['label'],
                                        ]);
                                        ?>
                                        <div class="rounded-2xl border border-emerald-200/80 bg-white px-3 py-3">
                                            <div class="flex items-start gap-3">
                                                <?php if (!empty($place['photo'])): ?>
                                                    <img src="<?php echo htmlspecialchars($place['photo']); ?>" alt="<?php echo htmlspecialchars($place['label']); ?>" class="h-14 w-14 rounded-xl object-cover border border-emerald-100">
                                                <?php else: ?>
                                                    <div class="h-14 w-14 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">🌿</div>
                                                <?php endif; ?>
                                                <div class="min-w-0 flex-1">
                                                    <p class="text-sm font-bold text-text truncate"><?php echo htmlspecialchars($place['label']); ?></p>
                                                    <p class="mt-1 text-[11px] text-emerald-800">
                                                        <?= __('profile_page.revisit_recent_count', '{count} dated traces are already here', ['count' => (string)($place['count'] ?? 0)]) ?>
                                                    </p>
                                                    <p class="mt-1 text-[11px] text-muted">
                                                        <?= __('profile_page.revisit_latest_date', 'Latest: {date}', ['date' => date('Y.m.d', (int)$place['latest_at'])]) ?>
                                                    </p>
                                                </div>
                                            </div>
                                            <div class="mt-3 flex flex-wrap gap-2">
                                                <a href="observation_detail.php?id=<?php echo urlencode((string)$place['latest_obs_id']); ?>" class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1.5 text-[11px] font-bold text-emerald-800">
                                                    <?= __('profile_page.revisit_view_latest', 'View latest trace') ?>
                                                </a>
                                                <?php if ($place['lat'] !== null && $place['lng'] !== null): ?>
                                                    <a href="<?php echo htmlspecialchars($recordAgainHref); ?>" class="inline-flex items-center rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white">
                                                        <?= __('profile_page.revisit_record_again', 'Record here again') ?>
                                                    </a>
                                                <?php endif; ?>
                                            </div>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                        <?php endif; ?>

                        <?php if (!empty($staleRevisitPlaces)): ?>
                            <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <p class="text-[10px] font-black uppercase tracking-widest text-amber-700"><?= __('profile_page.revisit_stale_title', 'Ready to revisit') ?></p>
                                <div class="mt-3 space-y-3">
                                    <?php foreach ($staleRevisitPlaces as $place): ?>
                                        <?php
                                        $daysSince = (int)floor((time() - (int)$place['latest_at']) / 86400);
                                        $recordAgainHref = 'post.php?' . http_build_query([
                                            'return' => 'profile.php',
                                            'lat' => $place['lat'] !== null ? number_format((float)$place['lat'], 6, '.', '') : null,
                                            'lng' => $place['lng'] !== null ? number_format((float)$place['lng'], 6, '.', '') : null,
                                            'location_name' => $place['label'],
                                        ]);
                                        ?>
                                        <div class="rounded-2xl border border-amber-200/80 bg-white px-3 py-3">
                                            <div class="flex items-start gap-3">
                                                <?php if (!empty($place['photo'])): ?>
                                                    <img src="<?php echo htmlspecialchars($place['photo']); ?>" alt="<?php echo htmlspecialchars($place['label']); ?>" class="h-14 w-14 rounded-xl object-cover border border-amber-100">
                                                <?php else: ?>
                                                    <div class="h-14 w-14 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">🕰️</div>
                                                <?php endif; ?>
                                                <div class="min-w-0 flex-1">
                                                    <p class="text-sm font-bold text-text truncate"><?php echo htmlspecialchars($place['label']); ?></p>
                                                    <p class="mt-1 text-[11px] text-amber-800">
                                                        <?= __('profile_page.revisit_stale_gap', '{days} days since the last trace', ['days' => (string)$daysSince]) ?>
                                                    </p>
                                                    <p class="mt-1 text-[11px] text-muted">
                                                        <?= __('profile_page.revisit_latest_date', 'Latest: {date}', ['date' => date('Y.m.d', (int)$place['latest_at'])]) ?>
                                                    </p>
                                                </div>
                                            </div>
                                            <div class="mt-3 flex flex-wrap gap-2">
                                                <a href="observation_detail.php?id=<?php echo urlencode((string)$place['latest_obs_id']); ?>" class="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-3 py-1.5 text-[11px] font-bold text-amber-800">
                                                    <?= __('profile_page.revisit_view_latest', 'View latest trace') ?>
                                                </a>
                                                <?php if ($place['lat'] !== null && $place['lng'] !== null): ?>
                                                    <a href="<?php echo htmlspecialchars($recordAgainHref); ?>" class="inline-flex items-center rounded-full bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-white">
                                                        <?= __('profile_page.revisit_record_again', 'Record here again') ?>
                                                    </a>
                                                <?php endif; ?>
                                            </div>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endif; ?>

            <!-- Nature Wellness Card -->
            <div style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1.5rem;margin-top:0.5rem;box-shadow:var(--elev-1);" x-show="wellness" x-cloak>
                <div class="flex items-center justify-between mb-5">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">🌿</span>
                        <div>
                            <h3 class="text-sm font-black text-text"><?= __('profile_page.wellness_title', 'Time in nature') ?></h3>
                            <p class="text-muted" style="font-size: var(--text-xs);"><?= __('profile_page.wellness_body', 'Recent trends visible from your records') ?></p>
                        </div>
                    </div>
                    <a href="wellness.php" class="text-xs font-bold text-primary hover:text-primary-dark transition"><?= __('profile_page.details', 'Details') ?> →</a>
                </div>

                <!-- Weekly Nature Time Progress -->
                <div class="mb-5">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs font-bold text-muted uppercase tracking-wider"><?= __('profile_page.weekly_nature_time', 'This week’s nature time') ?></span>
                        <span class="text-xs font-black" :class="wellnessCurrentWeekMin >= 120 ? 'text-primary' : 'text-text'" x-text="wellnessCurrentWeekMin + ' / 120<?= addslashes(__('profile_page.minutes_suffix', ' min')) ?>'"></span>
                    </div>
                    <div class="relative h-3 rounded-full bg-base overflow-hidden">
                        <div class="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                            :style="'width:' + Math.min(100, (wellnessCurrentWeekMin / 120 * 100)).toFixed(0) + '%; background: linear-gradient(90deg, #66bb6a, #43a047);'">
                            <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                    <p class="text-muted mt-1" style="font-size: var(--text-xs);" x-show="wellnessCurrentWeekMin >= 120">🎉 <?= __('profile_page.weekly_goal_reached', 'Reached the WHO-recommended 120 minutes per week!') ?></p>
                </div>

                <!-- 4 Mini Cards -->
                <div class="grid grid-cols-2 gap-3">
                    <div class="text-center p-3" style="border-radius:var(--shape-md);background:var(--md-surface-container-low);">
                        <p class="text-lg font-black text-primary" x-text="wellnessCurrentWeekMin + '<?= addslashes(__('profile_page.minutes_suffix', ' min')) ?>'"></p>
                        <p class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">🌳 <?= __('profile_page.wellness_nature_time', 'Nature time') ?></p>
                    </div>
                    <div class="text-center p-3" style="border-radius:var(--shape-md);background:var(--md-surface-container-low);">
                        <p class="text-lg font-black text-secondary" x-text="(wellness?.physical?.session_count ?? 0) + '<?= addslashes(__('profile_page.sessions_suffix', ' sessions')) ?>'"></p>
                        <p class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">🥾 <?= __('profile_page.wellness_sessions', 'Sessions') ?></p>
                    </div>
                    <div class="text-center p-3" style="border-radius:var(--shape-md);background:var(--md-surface-container-low);">
                        <p class="text-lg font-black text-accent" x-text="wellness?.cognitive?.cognitive_engagement ?? 0"></p>
                        <p class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">🧠 <?= __('profile_page.wellness_cognitive', 'Cognitive engagement') ?></p>
                        <p class="text-muted mt-0.5" style="font-size: 9px;"><?= __('profile_page.wellness_reference', 'Reference metric') ?></p>
                    </div>
                    <div class="text-center p-3" style="border-radius:var(--shape-md);background:var(--md-surface-container-low);">
                        <p class="text-lg font-black text-text" x-text="(wellness?.emotional?.lifelist_total ?? 0) + '<?= addslashes(__('profile_page.species_suffix', ' species')) ?>'"></p>
                        <p class="font-bold text-muted uppercase tracking-wider" style="font-size: var(--text-xs);">📋 <?= __('profile_page.wellness_my_list', 'My List') ?></p>
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
                <button @click="tab = 'observations'" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2 min-w-0 text-left leading-tight" :class="tab === 'observations' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-text'"><?= __('profile_page.stat_records', 'Records') ?></button>
                <button @click="tab = 'badges'" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2 min-w-0 text-left leading-tight" :class="tab === 'badges' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-text'">📛 <?= __('profile_page.tab_badges', 'Badges') ?></button>
                <button @click="tab = 'events'" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2 min-w-0 text-left leading-tight" :class="tab === 'events' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-text'">📅 <?= __('profile_page.tab_events', 'Events') ?></button>
                <button @click="tab = 'lifelist'" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2 min-w-0 text-left leading-tight" :class="tab === 'lifelist' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-text'"><?= __('profile_page.stat_species', 'Species found') ?></button>
                <button @click="tab = 'stats'" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2 min-w-0 text-left leading-tight" :class="tab === 'stats' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-text'"><?= __('profile_page.tab_review', 'Review') ?></button>
                <button @click="tab = 'surveys'" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2 min-w-0 text-left leading-tight" :class="tab === 'surveys' ? 'text-primary border-primary' : 'text-muted border-transparent hover:text-text'">🔬 <?= __('profile_page.tab_surveys', 'Surveys') ?></button>
            </div>

            <!-- Observations Grid -->
            <div x-show="tab === 'observations'" x-transition>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    <?php if (empty($user_obs)): ?>
                        <div class="col-span-full rounded-3xl border border-border bg-surface px-6 py-12 text-center">
                            <p class="font-bold text-text"><?= __('profile_page.empty_title', 'No records yet') ?></p>
                            <p class="mt-2 text-sm text-muted"><?= __('profile_page.empty_body', 'Try leaving just one record of something you found nearby.') ?></p>
                            <a href="post.php" class="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white">
                                <i data-lucide="camera" class="w-4 h-4"></i>
                                <?= __('profile_page.empty_cta', 'Record it') ?>
                            </a>
                        </div>
                    <?php else: ?>
                        <?php foreach (array_reverse($user_obs) as $obs): ?>
                            <a href="observation_detail.php?id=<?php echo $obs['id']; ?>" class="group block">
                                <div class="aspect-square rounded-2xl overflow-hidden mb-3 relative">
                                    <img src="<?php echo $obs['photos'][0]; ?>" alt="<?php echo htmlspecialchars($obs['taxon']['name'] ?? '観察写真'); ?>" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
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
                <div style="text-align:center;padding:3rem 1rem;background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);" class=" mb-8">
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
                                                                <img src="<?php echo htmlspecialchars($obs['photos'][0]); ?>" alt="<?php echo htmlspecialchars($obs['taxon']['name'] ?? '観察写真'); ?>" class="w-full aspect-square object-cover rounded-lg shadow-sm hover:shadow-md transition">
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
                        <a href="events.php" class="btn-primary">
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
                        <a href="survey.php" class="btn-primary">
                            🔬 調査を始める
                        </a>
                    </div>
                <?php endif; ?>
            </div>

            <!-- Life List (Placeholder for now) -->
            <!-- Life List (Dynamic) -->
            <div x-show="tab === 'lifelist'" x-transition>
                <div style="text-align:center;padding:3rem 1rem;background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);" class="">
                    <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mb-6">
                        <i data-lucide="layout-grid" class="w-10 h-10"></i>
                    </div>
                    <h3 class="text-2xl font-black text-text mb-2">デジタル標本箱</h3>
                    <p class="text-muted mb-8 max-w-md mx-auto">あなたが発見した<?php echo count($life_list); ?>種の生き物を<br>美しいコレクションとして閲覧できます。</p>

                    <a href="my_organisms.php" class="btn-primary gap-3 group">
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

        <!-- Trip Grouping Section -->
        <?php if ($isOwner || ($currentUser && $currentUser['id'] === ($user['id'] ?? ''))): ?>
        <div x-data="tripSection()" x-init="loadTrips()" class="mt-8">
            <div class="flex items-center justify-between mb-4 px-1">
                <h2 class="text-sm font-black text-text flex items-center gap-2">
                    <i data-lucide="map-pin" class="w-4 h-4 text-primary"></i>
                    お出かけ記録
                </h2>
                <span class="text-[10px] text-faint" x-text="trips.length + '件のお出かけ'"></span>
            </div>
            <div class="space-y-3" x-show="trips.length > 0">
                <template x-for="trip in trips" :key="trip.date + trip.center_lat">
                    <div class="bg-surface border border-border rounded-2xl overflow-hidden">
                        <!-- Trip header -->
                        <div class="px-4 py-3 flex items-center justify-between">
                            <div>
                                <p class="text-sm font-bold text-text" x-text="trip.date"></p>
                                <p class="text-[10px] text-muted" x-text="trip.municipality || '場所不明'"></p>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full" x-text="trip.count + '件'"></span>
                                <span class="text-[10px] font-bold bg-secondary/10 text-secondary px-2 py-0.5 rounded-full" x-text="trip.species.length + '種'"></span>
                            </div>
                        </div>
                        <!-- Trip photo mosaic -->
                        <div class="grid gap-0.5" :class="trip.photos.length >= 4 ? 'grid-cols-4' : trip.photos.length >= 2 ? 'grid-cols-2' : 'grid-cols-1'">
                            <template x-for="(photo, pi) in trip.photos.slice(0, 4)" :key="pi">
                                <div class="aspect-square bg-surface overflow-hidden">
                                    <img :src="photo" :alt="'Trip photo'" class="w-full h-full object-cover" loading="lazy">
                                </div>
                            </template>
                        </div>
                        <!-- Trip species list -->
                        <div class="px-4 py-2 flex flex-wrap gap-1.5" x-show="trip.species.length > 0">
                            <template x-for="sp in trip.species.slice(0, 5)" :key="sp">
                                <span class="text-[10px] font-bold bg-surface border border-border px-2 py-0.5 rounded-full text-muted" x-text="sp"></span>
                            </template>
                            <span x-show="trip.species.length > 5" class="text-[10px] text-faint" x-text="'+' + (trip.species.length - 5)"></span>
                        </div>
                    </div>
                </template>
            </div>
            <p x-show="trips.length === 0 && !loading" class="text-sm text-faint text-center py-6">まだお出かけ記録がありません</p>
        </div>
        <?php endif; ?>

    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        function tripSection() {
            return {
                trips: [],
                loading: false,
                async loadTrips() {
                    this.loading = true;
                    try {
                        const res = await fetch('api/get_trips.php?user_id=<?php echo urlencode($user['id'] ?? ''); ?>&limit=10');
                        const json = await res.json();
                        if (json.success) this.trips = json.trips;
                    } catch (e) {}
                    this.loading = false;
                }
            };
        }

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
