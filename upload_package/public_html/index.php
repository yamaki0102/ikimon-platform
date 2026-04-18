<?php
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
// QuestManager moved to dashboard
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/PrivacyFilter.php';
require_once __DIR__ . '/../libs/FollowManager.php';
require_once __DIR__ . '/../libs/HabitEngine.php';
require_once __DIR__ . '/../libs/SurveyorManager.php';
require_once __DIR__ . '/../libs/PlaceRevisitLoop.php';
require_once __DIR__ . '/../libs/Lang.php';

Auth::init();
Lang::init();
$currentUser = Auth::user();
$documentLang = 'ja';
if (method_exists('Lang', 'current')) {
    $documentLang = Lang::current();
} elseif (!empty($_SESSION['lang'])) {
    $documentLang = (string) $_SESSION['lang'];
} elseif (!empty($_GET['lang'])) {
    $documentLang = (string) $_GET['lang'];
}

// Fetch Data for Feed with Filters
$filter = $_GET['filter'] ?? 'all';
$followedUserIds = ($currentUser && $filter === 'following') ? FollowManager::getFollowedUserIds($currentUser['id']) : [];
$latest_obs = DataStore::getLatest('observations', 12, function ($item) use ($filter, $currentUser, $followedUserIds) {
    // Exclude test/E2E users, guest users, and broken images
    $userName = $item['user_name'] ?? '';
    if (strpos($userName, 'E2E_') === 0) return false;
    if (preg_match('/^gues$/i', $userName)) return false;
    if (preg_match('/^Guest$/i', $userName)) return false;
    $photo = $item['photos'][0] ?? '';
    if (empty($photo) || strpos($photo, 'sample_') !== false) return false;
    if (!preg_match('/^uploads\//', $photo)) return false;

    if ($filter === 'unidentified') {
        return !BioUtils::hasResolvedTaxon($item);
    }
    if ($filter === 'mine') {
        return isset($item['user_id']) && isset($currentUser['id']) && $item['user_id'] === $currentUser['id'];
    }
    if ($filter === 'following') {
        return isset($item['user_id']) && in_array($item['user_id'], $followedUserIds);
    }
    return true;
});

// Stats for hero (企業サイト・seed・FieldScanテストを除外)
$allObs = array_filter(DataStore::fetchAll('observations'), function ($o) {
    if (!empty($o['site_id'])) return false;
    $uid = $o['user_id'] ?? '';
    if (str_starts_with($uid, 'user_69548f9a55') || str_starts_with($uid, 'install_')) return false;
    return true;
});
$totalObs = count($allObs);
$uniqueSpecies = count(array_unique(array_filter(array_map(function ($o) {
    $name = $o['taxon']['name'] ?? '';
    if (!$name || $name === '未同定') return null;
    return $o['taxon']['key'] ?? $o['taxon']['scientific_name'] ?? $name;
}, $allObs))));
unset($allObs);

// Knowledge nuggets: 1種1行の豆知識をフィードカードに表示
$feedNuggets = [];
if (!empty($latest_obs)) {
    try {
        require_once ROOT_DIR . 'libs/OmoikaneDB.php';
        $sciNames = [];
        foreach ($latest_obs as $_o) {
            $sn = $_o['taxon']['scientific_name'] ?? '';
            if ($sn) $sciNames[] = $sn;
        }
        if (!empty($sciNames)) {
            $odb = new OmoikaneDB();
            $feedNuggets = $odb->getBatchNuggets(array_unique($sciNames));
        }
    } catch (\Throwable $e) { /* non-fatal */ }
}

$todayState = $currentUser ? HabitEngine::getTodayState($currentUser['id']) : HabitEngine::getTodayState(null);
$todayLabels = $todayState['labels'];
$streakData = $todayState['streak'];
$todayTypes = $todayState['today_types'];
$todayHabitComplete = !empty($todayState['today_complete']);
$todayRemaining = $todayState['remaining'];
$todayReflectionPreview = HabitEngine::previewNote($todayState['reflection_note'] ?? '');
$latestReflectionPreview = HabitEngine::previewNote($todayState['latest_reflection']['note'] ?? '');
$todayCtas = $todayState['cta_options'];
$natureTimeline = $todayState['nature_timeline'] ?? null;
$homeRevisitRecent = [];
$homeRevisitStale = [];
if ($currentUser) {
    $userObservations = array_values(array_filter(DataStore::fetchAll('observations'), function ($o) use ($currentUser) {
        return isset($o['user_id']) && (string)$o['user_id'] === (string)$currentUser['id'];
    }));
    $homePlaceBuckets = PlaceRevisitLoop::buildBuckets($userObservations);
    $homeRevisitRecent = PlaceRevisitLoop::recent($homePlaceBuckets, 2);
    $homeRevisitStale = PlaceRevisitLoop::stale($homePlaceBuckets, 2, 21);
}
$allPublicSurveyors = SurveyorManager::listPublicSurveyors();
$featuredSurveyors = array_slice($allPublicSurveyors, 0, 3);
$publicSurveyorCount = count($allPublicSurveyors);
$meta_title = __('landing.meta_title', 'ikimon — Save nearby nature and revisit it later');
$meta_description = __('landing.meta_description', 'See a little more each time you walk. Keep going in the same place and seasonal differences and local character become easier to notice.');
$recordHref = $currentUser ? 'post.php' : 'login.php?redirect=post.php';
$recordLabel = $currentUser ? __('landing.primary_cta_user', 'Save what caught your eye') : __('landing.primary_cta_guest', 'Sign in to save');
$myPlacesHref = $currentUser ? 'profile.php' : 'login.php?redirect=profile.php';
$heroBenefits = [
    ['icon' => '🚶', 'text' => __('landing.benefit_1', 'Easy to start on your own')],
    ['icon' => '🌿', 'text' => __('landing.benefit_2', 'Gives you one more reason to walk')],
    ['icon' => '📍', 'text' => __('landing.benefit_3', 'Easier to compare seasons later')],
];
$enjoyModes = [
    ['icon' => 'footprints', 'title' => __('landing.mode_1_title', 'Take a photo when it catches your eye'), 'body' => __('landing.mode_1_body', 'You can save the find before you know its name.')],
    ['icon' => 'sparkles', 'title' => __('landing.mode_2_title', 'Learn a little later'), 'body' => __('landing.mode_2_body', 'If the photo and place stay together, it is easier to review later.')],
    ['icon' => 'map-pinned', 'title' => __('landing.mode_3_title', 'Makes you want to look again'), 'body' => __('landing.mode_3_body', 'Keeping to the same route makes changes easier to spot.')],
];
$homeUiText = [
    'today' => __('home.today_label', 'Today'),
    'streak_suffix' => __('home.streak_suffix', ' days in a row'),
    'nature_connection' => __('home.nature_connection', 'Connection to nature'),
    'progress' => __('home.progress_label', 'Progress'),
    'story_label' => __('home.story_label', 'My place over time'),
    'story_title' => __('home.story_title', 'My natural history'),
    'story_badge' => __('home.story_badge', 'Flow'),
    'today_note' => __('home.today_note_label', 'Today’s note'),
    'last_note' => __('home.last_note_label', 'Last 1-minute note'),
    'minute_note' => __('home.minute_note_label', '1-minute note'),
    'minute_note_body' => __('home.minute_note_body', 'Leave one short line about what you saw and noticed today.'),
    'close' => __('nav.close', 'Close'),
    'minute_note_placeholder' => __('home.minute_note_placeholder', 'Example: Sparrows were lively even after the rain'),
    'minute_note_status_idle' => __('home.minute_note_status_idle', 'Even on days you cannot go outside, the connection can stay alive.'),
    'minute_note_submit' => __('home.minute_note_submit', 'Save and add to the streak'),
    'remaining_prefix' => __('home.remaining_prefix', 'Remaining'),
    'feed_title' => __('home.feed_title', 'Nearby finds'),
    'feed_count_suffix' => __('home.feed_count_suffix', ' new records'),
    'hero_count_suffix' => __('home.hero_count_suffix', ''),
    'feed_filter_label' => __('home.feed_filter_label', 'Timeline filter'),
    'feed_tab_all' => __('home.feed_tab_all', 'All records'),
    'feed_tab_id' => __('home.feed_tab_id', 'Help identify'),
    'feed_tab_places' => __('home.feed_tab_places', 'My places'),
    'feed_empty_title' => __('home.feed_empty_title', 'Leave the first record'),
    'feed_empty_body' => __('home.feed_empty_body', 'There are no records in this area yet. The first one becomes the start of that place’s story.'),
    'feed_empty_cta' => __('home.feed_empty_cta', 'Record it'),
    'feed_more_cta' => __('home.feed_more_cta', 'See more records'),
    'numbers_title' => __('home.numbers_title', 'ikimon by the numbers'),
    'numbers_observations' => __('home.numbers_observations', 'Observation records'),
    'numbers_species' => __('home.numbers_species', 'Confirmed species'),
    'numbers_stable' => __('home.numbers_stable', 'Stable records'),
    'numbers_people' => __('home.numbers_people', 'Participants'),
    'surveyors_label' => __('home.surveyors_label', 'Surveyors'),
    'surveyors_title' => __('home.surveyors_title', 'Talk to surveyors'),
    'surveyors_body' => __('home.surveyors_body', 'Only surveyors who passed interviews and background checks are public. They can help with field consultations and organizing records.'),
    'surveyors_view' => __('home.surveyors_view', 'View surveyors'),
    'surveyors_request' => __('home.surveyors_request', 'Request a survey'),
    'surveyor_badge' => __('home.surveyor_badge', 'Certified surveyor'),
    'surveyor_headline_fallback' => __('home.surveyor_headline_fallback', 'Surveyors supporting local observation records'),
    'surveyor_official_records' => __('home.surveyor_official_records', 'Official records'),
    'surveyor_species' => __('home.surveyor_species', 'Confirmed species'),
    'surveyor_avatar_suffix' => __('home.surveyor_avatar_suffix', ' avatar'),
    'org_title' => __('home.org_title', 'For organizations'),
    'org_body' => __('home.org_body', 'Use it to keep nature records for companies and regions in a way that is easy to revisit later.'),
    'org_company_title' => __('home.org_company_title', 'For companies and groups'),
    'org_company_subtitle' => __('home.org_company_subtitle', 'Site records / engagement / sustainable operations'),
    'org_company_point_1' => __('home.org_company_point_1', 'Save things found on-site or nearby as place-based records'),
    'org_company_point_2' => __('home.org_company_point_2', 'Easy to use for observation events and seasonal reviews'),
    'org_company_point_3' => __('home.org_company_point_3', 'Connect walks and nature observation to internal activities'),
    'org_public_title' => __('home.org_public_title', 'For municipalities and schools'),
    'org_public_subtitle' => __('home.org_public_subtitle', 'Local records / school partnerships / entry point'),
    'org_public_point_1' => __('home.org_public_point_1', 'Archive local nature little by little through citizen participation'),
    'org_public_point_2' => __('home.org_public_point_2', 'Easy to revisit seasonal differences and local character'),
    'org_public_point_3' => __('home.org_public_point_3', 'Connect with schools and observation events to create an easy entry point'),
    'details' => __('home.details', 'Learn more'),
    'reflection_short_required' => __('home.reflection_short_required', 'Please write one short line.'),
    'reflection_saving' => __('home.reflection_saving', 'Saving...'),
    'reflection_save_failed' => __('home.reflection_save_failed', 'Saving failed.'),
    'reflection_saved' => __('home.reflection_saved', 'Saved. Added to today’s streak.'),
    'revisit_title' => __('profile_page.revisit_title', 'Places to return to'),
    'revisit_body' => __('profile_page.revisit_body', 'Look back at the places where the flow is already moving and the ones that are ready for another dated trace.'),
    'revisit_recent_title' => __('profile_page.revisit_recent_title', 'Recently revisited'),
    'revisit_recent_count' => __('profile_page.revisit_recent_count', '{count} traces are already here'),
    'revisit_stale_title' => __('profile_page.revisit_stale_title', 'Ready to revisit'),
    'revisit_stale_gap' => __('profile_page.revisit_stale_gap', '{days} days since the last trace'),
    'revisit_latest_date' => __('profile_page.revisit_latest_date', 'Latest: {date}'),
    'revisit_view_latest' => __('profile_page.revisit_view_latest', 'View latest trace'),
    'revisit_record_again' => __('profile_page.revisit_record_again', 'Record here again'),
];
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang) ?>">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>

    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json" nonce="<?= CspNonce::attr() ?>">
        {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "ikimon.life",
            "alternateName": <?= json_encode(__('meta.organization_alt_name', 'ikimon'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>,
            "url": "https://ikimon.life/",
            "description": <?= json_encode(__('meta.website_description', 'A place to save nearby nature records and revisit them later by place.'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>,
            "inLanguage": <?= json_encode($documentLang, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>,
            "potentialAction": {
                "@type": "SearchAction",
                "target": "https://ikimon.life/zukan.php?q={search_term_string}",
                "query-input": "required name=search_term_string"
            },
            "publisher": {
                "@type": "Organization",
                "name": "ikimon Project",
                "url": "https://ikimon.life/",
                "logo": "https://ikimon.life/assets/img/icon-512.png"
            }
        }
    </script>

    <style>
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }

        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }

        .lazy-img {
            background: linear-gradient(135deg, var(--md-surface-variant) 0%, var(--md-outline-variant) 50%, var(--md-surface-variant) 100%);
            background-size: 200% 200%;
            animation: shimmer 1.5s ease-in-out infinite;
        }

        /* M3 Filter Chip */
        .m3-chip {
            position: relative; overflow: hidden;
            display: inline-flex; align-items: center; gap: 6px;
            padding: 6px 16px; border-radius: var(--shape-full);
            border: 1px solid var(--md-outline);
            background: transparent; color: var(--md-on-surface-variant);
            font-size: var(--type-label-lg); font-weight: 600;
            white-space: nowrap; cursor: pointer; text-decoration: none;
            transition: background var(--motion-short) var(--motion-std),
                        color var(--motion-short) var(--motion-std);
        }
        .m3-chip::before {
            content: ''; position: absolute; inset: 0;
            background: currentColor; opacity: 0; border-radius: inherit;
            transition: opacity var(--motion-short) var(--motion-std);
            pointer-events: none;
        }
        .m3-chip:hover::before { opacity: 0.08; }
        .m3-chip:active::before { opacity: 0.12; }
        .m3-chip.selected {
            background: var(--md-secondary-container);
            color: var(--md-on-secondary-container);
            border-color: transparent;
        }

        @keyframes shimmer {
            0% {
                background-position: 200% 0;
            }

            100% {
                background-position: -200% 0;
            }
        }

        .hero-section {
            position: relative;
            overflow: hidden;
            border-bottom: 1px solid rgba(15, 23, 42, 0.08);
            background:
                radial-gradient(circle at top left, rgba(16, 185, 129, 0.10), transparent 34%),
                radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 28%),
                linear-gradient(180deg, #f8fbff 0%, #ffffff 58%, #f7faf8 100%);
        }

        .hero-shell {
            max-width: 1100px;
            margin: 0 auto;
            padding: clamp(3.75rem, 9vw, 7rem) 1.5rem clamp(3rem, 8vw, 5.5rem);
        }

        .hero-section h1 {
            font-size: clamp(2rem, 5vw, 4rem);
            line-height: 1.05;
            letter-spacing: -0.045em;
            color: #0f172a;
        }

        .hero-section .hero-sub {
            font-size: clamp(1rem, 2.3vw, 1.2rem);
            line-height: 1.75;
            color: #475569;
        }

        .hero-metric {
            background: rgba(255, 255, 255, 0.88);
            border: 1px solid rgba(15, 23, 42, 0.08);
            box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
        }
    </style>
</head>

<body class="pb-24 md:pb-0 font-body bg-base text-text" x-data="pullToRefresh()">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <?php include __DIR__ . '/components/onboarding_modal.php'; ?>

    <!-- PTR Indicator -->
    <div class="fixed top-24 left-0 w-full flex justify-center pointer-events-none z-30 transition-transform duration-200"
        :style="`opacity: ${pullY > 0 ? Math.min(pullY / 50, 1) : 0}; transform: translateY(${pullY * 0.5}px)`"
        x-cloak>
        <div class="rounded-full p-3 flex items-center justify-center bg-elevated/80 backdrop-blur-xl border border-border-strong shadow-lg">
            <i data-lucide="loader-2" class="w-6 h-6 transition-transform text-primary"
                :class="refreshing ? 'animate-spin' : ''"
                :style="`transform: rotate(${pullY * 3}deg)`"></i>
        </div>
    </div>

    <!-- ===== App Shell: Main Content ===== -->
    <main id="main-content" class="w-full min-h-[100dvh] transition-transform duration-200 ease-out pt-14"
        @touchstart="start($event)"
        @touchmove="move($event)"
        @touchend="end()"
        :style="`transform: translateY(${pullY}px)`">

        <!-- ==================== HERO SECTION ==================== -->
        <section class="hero-section relative">
            <div class="hero-shell relative z-10">
                <div class="mx-auto max-w-3xl text-center">
                    <div class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-1.5 text-[11px] font-bold tracking-[0.02em] text-slate-600 shadow-sm" style="margin-bottom:var(--phi-md)">
                        <span class="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                        <?= htmlspecialchars(__('landing.eyebrow', 'Nearby finds')) ?> · <?php echo number_format($totalObs); ?> <?= htmlspecialchars($homeUiText['hero_count_suffix']) ?>
                    </div>

                    <h1 class="font-black" style="margin-bottom:var(--phi-sm)">
                        <?php
                        $heroTitle = __('landing.hero_title', 'Make your usual route a little more interesting.');
                        $heroTitleParts = explode('、', $heroTitle, 2);
                        ?>
                        <?php if (count($heroTitleParts) === 2): ?>
                            <?= htmlspecialchars($heroTitleParts[0] . '、') ?><br class="md:hidden"><span class="text-emerald-600"><?= htmlspecialchars($heroTitleParts[1]) ?></span>
                        <?php else: ?>
                            <span class="text-emerald-600"><?= htmlspecialchars($heroTitle) ?></span>
                        <?php endif; ?>
                    </h1>
                    <p class="hero-sub mx-auto max-w-2xl" style="margin-bottom:var(--phi-md)">
                        <?= htmlspecialchars(__('landing.hero_lead', 'See a little more each time you walk. Keep going in the same place and seasonal differences and local character become easier to notice.')) ?>
                    </p>

                    <div class="flex flex-wrap items-center justify-center gap-2" style="margin-bottom:var(--phi-md)">
                        <?php foreach ($heroBenefits as $benefit): ?>
                            <span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
                                <span><?= htmlspecialchars($benefit['icon']) ?></span><?= htmlspecialchars($benefit['text']) ?>
                            </span>
                        <?php endforeach; ?>
                    </div>

                    <div class="flex flex-col items-center justify-center gap-3 sm:flex-row" style="margin-bottom:var(--phi-md)">
                        <a href="<?= htmlspecialchars($recordHref) ?>" class="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-full bg-slate-900 px-7 py-3.5 text-sm font-black text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-800">
                            <i data-lucide="camera" class="w-5 h-5"></i>
                            <?= htmlspecialchars($recordLabel) ?>
                        </a>
                        <a href="explore.php" class="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-7 py-3.5 text-sm font-bold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:text-slate-900">
                            <i data-lucide="compass" class="w-4 h-4"></i>
                            <?= htmlspecialchars(__('landing.secondary_cta', 'Look nearby')) ?>
                        </a>
                    </div>

                    <a href="<?= htmlspecialchars($myPlacesHref) ?>" class="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 transition hover:text-emerald-900">
                        <i data-lucide="map-pinned" class="w-4 h-4"></i>
                        <?= htmlspecialchars(__('landing.my_places_cta', 'View my places')) ?>
                    </a>
                </div>

                <div class="mt-10 grid gap-4 md:grid-cols-3">
                    <div class="hero-metric rounded-[28px] p-5 text-left">
                        <p class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400"><?= htmlspecialchars(__('landing.card_today_label', 'Today')) ?></p>
                        <p class="mt-2 text-lg font-black text-slate-900"><?= htmlspecialchars(__('landing.card_today_title', 'Find something each time you walk')) ?></p>
                        <p class="mt-2 text-sm leading-7 text-slate-600"><?= htmlspecialchars(__('landing.card_today_body', 'Even one thing that catches your eye can change how the same route feels.')) ?></p>
                    </div>
                    <div class="hero-metric rounded-[28px] p-5 text-left">
                        <p class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400"><?= htmlspecialchars(__('landing.card_season_label', 'Season')) ?></p>
                        <p class="mt-2 text-lg font-black text-slate-900"><?= htmlspecialchars(__('landing.card_season_title', 'Seasonal differences are easier to notice')) ?></p>
                        <p class="mt-2 text-sm leading-7 text-slate-600"><?= htmlspecialchars(__('landing.card_season_body', 'Comparing the same place makes spring and summer easier to separate.')) ?></p>
                    </div>
                    <div class="hero-metric rounded-[28px] p-5 text-left">
                        <p class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400"><?= htmlspecialchars(__('landing.card_later_label', 'Later')) ?></p>
                        <p class="mt-2 text-lg font-black text-slate-900"><?= htmlspecialchars(__('landing.card_later_title', 'What changed stays visible')) ?></p>
                        <p class="mt-2 text-sm leading-7 text-slate-600"><?= htmlspecialchars(__('landing.card_later_body', 'Looking back later makes a place’s character and changes easier to understand.')) ?></p>
                    </div>
                </div>
            </div>
        </section>

        <?php if ($currentUser): ?>
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-top:var(--phi-lg);margin-bottom:var(--phi-xl)">
            <div id="today-habit-card-home" class="p-5 md:p-6" style="border-radius:var(--shape-xl);box-shadow:var(--elev-1);background:var(--md-primary-container);<?= $todayHabitComplete ? 'border-left:4px solid var(--color-primary);' : '' ?>">
                <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div class="min-w-0">
                        <div class="text-token-xs font-black tracking-widest text-primary"><?= htmlspecialchars($homeUiText['today']) ?></div>
                        <h2 class="text-xl font-black text-text mt-1"><?= htmlspecialchars($todayState['title'] ?? __('home.today_title_default', 'One record is enough today. Keep the flow going.')) ?></h2>
                        <p class="text-sm mt-2 text-gray-700">
                            <?= htmlspecialchars($todayState['message'] ?? '') ?>
                        </p>
                    </div>
                    <div class="shrink-0 px-4 py-3" style="background:var(--md-surface-container-low);border-radius:var(--shape-lg);">
                        <div class="text-2xl"><?= $todayHabitComplete ? '🌿' : '🔥' ?></div>
                        <div class="text-sm font-black text-text"><?= (int)($streakData['current_streak'] ?? 0) ?><?= htmlspecialchars($homeUiText['streak_suffix']) ?></div>
                        <div class="text-token-xs text-muted"><?= htmlspecialchars($homeUiText['nature_connection']) ?></div>
                    </div>
                </div>

                <div class="mt-4 flex flex-wrap gap-2">
                    <?php foreach ($todayLabels as $type => $label): ?>
                    <?php $isDone = in_array($type, $todayTypes, true); ?>
                    <span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold <?= $isDone ? 'bg-white text-primary border border-emerald-200' : 'bg-white/70 text-gray-500 border border-white/80' ?>">
                        <span><?= $isDone ? '✓' : '・' ?></span><?= htmlspecialchars($label) ?>
                    </span>
                    <?php endforeach; ?>
                </div>

                <?php if (!empty($todayState['progress_line'])): ?>
                <div class="mt-4 p-4" style="background:var(--md-surface-container-low);border-radius:var(--shape-xl);">
                    <div class="text-token-xs font-black tracking-widest text-primary"><?= htmlspecialchars($homeUiText['progress']) ?></div>
                    <p class="text-sm text-text mt-1"><?= htmlspecialchars($todayState['progress_line']) ?></p>
                </div>
                <?php endif; ?>

                <?php if (!empty($natureTimeline['items']) && is_array($natureTimeline['items'])): ?>
                <div class="mt-4 p-4 md:p-5" style="background:var(--md-surface-container-low);border-radius:var(--shape-xl);">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <div class="text-token-xs font-black tracking-widest text-primary"><?= htmlspecialchars($homeUiText['story_label']) ?></div>
                            <h3 class="text-base font-black text-text mt-1"><?= htmlspecialchars($homeUiText['story_title']) ?></h3>
                            <?php if (!empty($natureTimeline['headline'])): ?>
                            <p class="text-sm text-text/80 mt-1"><?= htmlspecialchars($natureTimeline['headline']) ?></p>
                            <?php endif; ?>
                        </div>
                        <div class="shrink-0 rounded-full px-3 py-1 text-token-xs font-bold bg-primary/10 text-primary">
                            <?= htmlspecialchars($homeUiText['story_badge']) ?>
                        </div>
                    </div>

                    <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <?php foreach ($natureTimeline['items'] as $item): ?>
                        <div class="p-4" style="background:var(--md-surface-container-high);border-radius:var(--shape-xl);">
                            <div class="flex items-center gap-2 text-xs font-black tracking-widest <?= $todayHabitComplete ? 'text-emerald-700' : 'text-amber-700' ?>">
                                <i data-lucide="<?= htmlspecialchars($item['icon'] ?? 'leaf') ?>" class="w-4 h-4"></i>
                                <?= htmlspecialchars($item['label'] ?? '') ?>
                            </div>
                            <div class="text-sm md:text-base font-black mt-2 leading-snug" style="color:#1a2e1f;">
                                <?= htmlspecialchars($item['value'] ?? '') ?>
                            </div>
                            <p class="text-token-xs mt-2" style="color:#4b5563;"><?= htmlspecialchars($item['detail'] ?? '') ?></p>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
                <?php endif; ?>

                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
                    <?php foreach ($todayCtas as $type => $cta): ?>
                        <?php if (($cta['type'] ?? 'link') === 'button'): ?>
                        <button type="button" data-habit-cta="<?= htmlspecialchars($type) ?>" data-reflection-toggle class="p-4 transition text-left" style="background:var(--md-surface-container-low);border-radius:var(--shape-xl);border:none;cursor:pointer;width:100%;">
                            <div class="flex items-center gap-3">
                                <i data-lucide="<?= htmlspecialchars($cta['icon']) ?>" class="w-5 h-5 <?= htmlspecialchars($cta['icon_class'] ?? 'text-primary') ?>"></i>
                                <div>
                                    <div class="text-sm font-black text-text"><?= htmlspecialchars($cta['label']) ?></div>
                                    <div class="text-token-xs text-muted"><?= htmlspecialchars($cta['detail'] ?? '') ?></div>
                                </div>
                            </div>
                        </button>
                        <?php else: ?>
                        <a href="<?= htmlspecialchars($cta['href'] ?? '#') ?>" data-habit-cta="<?= htmlspecialchars($type) ?>" class="p-4 transition" style="display:block;background:var(--md-surface-container-low);border-radius:var(--shape-xl);text-decoration:none;">
                            <div class="flex items-center gap-3">
                                <i data-lucide="<?= htmlspecialchars($cta['icon']) ?>" class="w-5 h-5 <?= htmlspecialchars($cta['icon_class'] ?? 'text-primary') ?>"></i>
                                <div>
                                    <div class="text-sm font-black text-text"><?= htmlspecialchars($cta['label']) ?></div>
                                    <div class="text-token-xs text-muted"><?= htmlspecialchars($cta['detail'] ?? '') ?></div>
                                </div>
                            </div>
                        </a>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </div>

                <?php if ($todayReflectionPreview !== ''): ?>
                <div class="mt-4 p-4" style="background:var(--md-surface-container-low);border-radius:var(--shape-xl);">
                    <div class="text-token-xs font-black tracking-widest text-emerald-700"><?= htmlspecialchars($homeUiText['today_note']) ?></div>
                    <p class="text-sm text-text mt-1"><?= htmlspecialchars($todayReflectionPreview) ?></p>
                </div>
                <?php elseif ($latestReflectionPreview !== ''): ?>
                <p class="mt-4 text-token-xs text-muted"><?= htmlspecialchars($homeUiText['last_note']) ?>: <?= htmlspecialchars($latestReflectionPreview) ?></p>
                <?php endif; ?>

                <div class="mt-4 p-4 hidden" style="background:var(--md-surface-container-low);border-radius:var(--shape-xl);" data-reflection-panel>
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <div class="text-token-xs font-black tracking-widest text-amber-700"><?= htmlspecialchars($homeUiText['minute_note']) ?></div>
                            <p class="text-sm text-text mt-1"><?= htmlspecialchars($homeUiText['minute_note_body']) ?></p>
                        </div>
                        <button type="button" data-reflection-cancel class="text-xs font-bold text-muted hover:text-text transition"><?= htmlspecialchars($homeUiText['close']) ?></button>
                    </div>
                    <textarea data-reflection-note maxlength="120" rows="3" class="mt-3 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text focus:outline-none focus:border-border-strong resize-none" placeholder="<?= htmlspecialchars($homeUiText['minute_note_placeholder']) ?>"></textarea>
                    <div class="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p class="text-token-xs text-muted" data-reflection-status><?= htmlspecialchars($homeUiText['minute_note_status_idle']) ?></p>
                        <button type="button" data-reflection-submit style="display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 20px;background:var(--md-tertiary);color:var(--md-on-tertiary);border:none;border-radius:var(--shape-full);font-size:var(--type-label-lg);font-weight:700;cursor:pointer;">
                            <i data-lucide="pen-square" class="w-4 h-4"></i> <?= htmlspecialchars($homeUiText['minute_note_submit']) ?>
                        </button>
                    </div>
                </div>

                <?php if (!$todayHabitComplete && !empty($todayRemaining)): ?>
                <p class="mt-4 text-token-xs text-amber-700">
                    <?= htmlspecialchars($homeUiText['remaining_prefix']) ?>: <?= htmlspecialchars(implode(' / ', array_map(fn($type) => $todayLabels[$type] ?? $type, $todayRemaining))) ?>
                </p>
                <?php endif; ?>
            </div>

            <?php if (!empty($homeRevisitRecent) || !empty($homeRevisitStale)): ?>
            <div class="mt-4 grid gap-3 md:grid-cols-2">
                <?php if (!empty($homeRevisitRecent)): ?>
                <div class="p-4" style="background:var(--md-surface-container-low);border-radius:var(--shape-xl);">
                    <div class="text-token-xs font-black tracking-widest text-emerald-700"><?= htmlspecialchars($homeUiText['revisit_recent_title']) ?></div>
                    <div class="mt-3 space-y-2">
                        <?php foreach ($homeRevisitRecent as $place): ?>
                            <?php
                            $recordAgainHref = 'post.php?' . http_build_query([
                                'return' => 'index.php',
                                'lat' => $place['lat'] !== null ? number_format((float)$place['lat'], 6, '.', '') : null,
                                'lng' => $place['lng'] !== null ? number_format((float)$place['lng'], 6, '.', '') : null,
                                'location_name' => $place['label'],
                            ]);
                            ?>
                            <div class="rounded-2xl border border-emerald-200/70 bg-white px-3 py-3">
                                <div class="flex items-start justify-between gap-3">
                                    <div class="min-w-0">
                                        <p class="text-sm font-bold text-text truncate"><?php echo htmlspecialchars($place['label']); ?></p>
                                        <p class="mt-1 text-[11px] text-emerald-800"><?=
                                            htmlspecialchars(__('profile_page.revisit_recent_count', '{count} traces are already here', ['count' => (string)($place['count'] ?? 0)]))
                                        ?></p>
                                    </div>
                                    <span class="text-[10px] font-bold text-muted"><?=
                                        htmlspecialchars(__('profile_page.revisit_latest_date', 'Latest: {date}', ['date' => date('Y.m.d', (int)$place['latest_at'])]))
                                    ?></span>
                                </div>
                                <div class="mt-2 flex flex-wrap gap-2">
                                    <a href="observation_detail.php?id=<?php echo urlencode((string)$place['latest_obs_id']); ?>" class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1.5 text-[11px] font-bold text-emerald-800">
                                        <?= htmlspecialchars($homeUiText['revisit_view_latest']) ?>
                                    </a>
                                    <?php if ($place['lat'] !== null && $place['lng'] !== null): ?>
                                    <a href="<?php echo htmlspecialchars($recordAgainHref); ?>" class="inline-flex items-center rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white">
                                        <?= htmlspecialchars($homeUiText['revisit_record_again']) ?>
                                    </a>
                                    <?php endif; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
                <?php endif; ?>

                <?php if (!empty($homeRevisitStale)): ?>
                <div class="p-4" style="background:var(--md-surface-container-low);border-radius:var(--shape-xl);">
                    <div class="text-token-xs font-black tracking-widest text-amber-700"><?= htmlspecialchars($homeUiText['revisit_stale_title']) ?></div>
                    <div class="mt-3 space-y-2">
                        <?php foreach ($homeRevisitStale as $place): ?>
                            <?php
                            $daysSince = (int)floor((time() - (int)$place['latest_at']) / 86400);
                            $recordAgainHref = 'post.php?' . http_build_query([
                                'return' => 'index.php',
                                'lat' => $place['lat'] !== null ? number_format((float)$place['lat'], 6, '.', '') : null,
                                'lng' => $place['lng'] !== null ? number_format((float)$place['lng'], 6, '.', '') : null,
                                'location_name' => $place['label'],
                            ]);
                            ?>
                            <div class="rounded-2xl border border-amber-200/70 bg-white px-3 py-3">
                                <div class="flex items-start justify-between gap-3">
                                    <div class="min-w-0">
                                        <p class="text-sm font-bold text-text truncate"><?php echo htmlspecialchars($place['label']); ?></p>
                                        <p class="mt-1 text-[11px] text-amber-800"><?=
                                            htmlspecialchars(__('profile_page.revisit_stale_gap', '{days} days since the last trace', ['days' => (string)$daysSince]))
                                        ?></p>
                                    </div>
                                    <span class="text-[10px] font-bold text-muted"><?=
                                        htmlspecialchars(__('profile_page.revisit_latest_date', 'Latest: {date}', ['date' => date('Y.m.d', (int)$place['latest_at'])]))
                                    ?></span>
                                </div>
                                <div class="mt-2 flex flex-wrap gap-2">
                                    <a href="observation_detail.php?id=<?php echo urlencode((string)$place['latest_obs_id']); ?>" class="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-3 py-1.5 text-[11px] font-bold text-amber-800">
                                        <?= htmlspecialchars($homeUiText['revisit_view_latest']) ?>
                                    </a>
                                    <?php if ($place['lat'] !== null && $place['lng'] !== null): ?>
                                    <a href="<?php echo htmlspecialchars($recordAgainHref); ?>" class="inline-flex items-center rounded-full bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-white">
                                        <?= htmlspecialchars($homeUiText['revisit_record_again']) ?>
                                    </a>
                                    <?php endif; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
                <?php endif; ?>
            </div>
            <?php endif; ?>
        </section>
        <?php endif; ?>

        <!-- Daily Quest & Survey Panel → moved to dashboard.php -->

        <!-- ==================== HOW-TO SECTION (Non-logged-in) ==================== -->
        <?php if (!$currentUser): ?>
            <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-bottom:var(--phi-2xl)">
                <div class="bg-gradient-to-br from-primary-surface to-secondary-surface rounded-3xl border border-primary/10" style="padding:var(--phi-xl) var(--phi-lg)">
                    <h2 class="font-black text-text text-center" style="font-size:var(--text-xl);margin-bottom:var(--phi-sm)"><?= htmlspecialchars(__('landing.how_title', 'The flow is simple')) ?></h2>
                    <p class="text-token-sm text-muted text-center max-w-2xl mx-auto" style="margin-bottom:var(--phi-lg)">
                        <?= htmlspecialchars(__('landing.how_lead', 'Save what caught your eye, then review the same place later. That is enough.')) ?>
                    </p>

                    <div class="grid grid-cols-1 md:grid-cols-3" style="gap:var(--phi-lg)">
                        <?php foreach ($enjoyModes as $mode): ?>
                            <div class="flex flex-col rounded-3xl bg-white/75 border border-white/70 shadow-sm" style="padding:var(--phi-lg)">
                                <div class="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-md text-primary">
                                    <i data-lucide="<?= htmlspecialchars($mode['icon']) ?>" class="w-7 h-7"></i>
                                </div>
                                <h3 class="text-lg font-black text-text mt-4"><?= htmlspecialchars($mode['title']) ?></h3>
                                <p class="text-sm text-muted leading-relaxed mt-3"><?= htmlspecialchars($mode['body']) ?></p>
                            </div>
                        <?php endforeach; ?>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3" style="margin-top:var(--phi-lg);gap:var(--phi-md)">
                        <a href="<?= htmlspecialchars($recordHref) ?>" class="block rounded-2xl border border-primary/10 bg-white/80 hover:bg-white transition" style="padding:var(--phi-md)">
                            <div class="text-token-xs font-black tracking-widest text-primary" style="color:#059669;">1</div>
                            <div class="text-base font-black mt-1" style="color:#0f172a;"><?= htmlspecialchars(__('landing.step_1_title', 'Save it when it catches your eye')) ?></div>
                            <p class="text-sm mt-2" style="color:#64748b;"><?= htmlspecialchars(__('landing.step_1_body', 'You do not need the name on the spot.')) ?></p>
                        </a>
                        <a href="explore.php" class="block rounded-2xl border border-primary/10 bg-white/80 hover:bg-white transition" style="padding:var(--phi-md)">
                            <div class="text-token-xs font-black tracking-widest text-primary" style="color:#059669;">2</div>
                            <div class="text-base font-black mt-1" style="color:#0f172a;"><?= htmlspecialchars(__('landing.step_2_title', 'Review it a little later')) ?></div>
                            <p class="text-sm mt-2" style="color:#64748b;"><?= htmlspecialchars(__('landing.step_2_body', 'If the photo and place stay together, it is easy to look back later.')) ?></p>
                        </a>
                        <a href="<?= htmlspecialchars($myPlacesHref) ?>" class="block rounded-2xl border border-primary/10 bg-white/80 hover:bg-white transition" style="padding:var(--phi-md)">
                            <div class="text-token-xs font-black tracking-widest text-primary" style="color:#059669;">3</div>
                            <div class="text-base font-black mt-1" style="color:#0f172a;"><?= htmlspecialchars(__('landing.step_3_title', 'Walk the same route again')) ?></div>
                            <p class="text-sm mt-2" style="color:#64748b;"><?= htmlspecialchars(__('landing.step_3_body', 'When differences start to show, it gives you a reason to keep going.')) ?></p>
                        </a>
                    </div>
                </div>
            </section>
        <?php endif; ?>

        <!-- Exploration Map → moved to explore.php -->

        <!-- ==================== FEED SECTION ==================== -->
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-top:var(--phi-2xl);margin-bottom:var(--phi-2xl)">

            <!-- Regional Completion Meter (Compact) -->
            <div class="mb-6" x-data="regionalCompletion('compact')">
                <?php include __DIR__ . '/components/regional_completion.php'; ?>
            </div>

            <!-- Feed Header & Filter Tabs -->
            <div class="flex flex-col gap-3 mb-6">
                <div class="flex items-baseline justify-between">
                    <h2 class="text-2xl font-black tracking-tight text-text"><?= htmlspecialchars($homeUiText['feed_title']) ?></h2>
                    <p class="text-sm text-muted"><?php echo count($latest_obs); ?> <?= htmlspecialchars($homeUiText['feed_count_suffix']) ?></p>
                </div>
                <div class="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1" role="tablist" aria-label="<?= htmlspecialchars($homeUiText['feed_filter_label']) ?>">
                    <a href="?filter=all" role="tab" aria-selected="<?php echo $filter === 'all' ? 'true' : 'false'; ?>" class="m3-chip <?php echo $filter === 'all' ? 'selected' : ''; ?>"><?= htmlspecialchars($homeUiText['feed_tab_all']) ?></a>
                    <a href="id_workbench.php" role="tab" aria-selected="false" class="m3-chip">
                        <i data-lucide="search-check" class="w-4 h-4" style="pointer-events:none;"></i>
                        <?= htmlspecialchars($homeUiText['feed_tab_id']) ?>
                    </a>
                    <?php if ($currentUser): ?>
                        <a href="/profile.php" role="tab" aria-selected="false" class="m3-chip"><?= htmlspecialchars($homeUiText['feed_tab_places']) ?></a>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Feed Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style="gap:var(--phi-lg)">
                <?php foreach ($latest_obs as $obs):
                    $obsReactDir = DATA_DIR . '/reactions/' . $obs['id'];
                    $obsReactTypes = ['footprint', 'like', 'suteki', 'manabi'];
                    $obsReactions = [];
                    $obsTotalReactions = 0;
                    foreach ($obsReactTypes as $_rt) {
                        $_rf = $obsReactDir . '/' . $_rt . '.json';
                        $_rl = file_exists($_rf) ? (json_decode(file_get_contents($_rf), true) ?: []) : [];
                        $obsReactions[$_rt] = [
                            'count' => count($_rl),
                            'reacted' => $currentUser && in_array($currentUser['id'], $_rl),
                        ];
                        $obsTotalReactions += count($_rl);
                    }
                    if ($obsTotalReactions === 0) {
                        $_legacyFile = DATA_DIR . '/likes/' . $obs['id'] . '.json';
                        if (file_exists($_legacyFile)) {
                            $_ll = json_decode(file_get_contents($_legacyFile), true) ?: [];
                            $obsReactions['footprint']['count'] = count($_ll);
                            $obsReactions['footprint']['reacted'] = $currentUser && in_array($currentUser['id'], $_ll);
                            $obsTotalReactions = count($_ll);
                        }
                    }
                    // コンポーネント変数をセット
                    $cardObs              = $obs;
                    $cardReactionsJson    = json_encode($obsReactions, JSON_HEX_TAG | JSON_HEX_AMP);
                    $cardObsTotalReactions = $obsTotalReactions;
                    $cardLoggedIn         = (bool)$currentUser;
                    $cardNugget           = $feedNuggets[$obs['taxon']['scientific_name'] ?? ''] ?? null;
                    include PUBLIC_DIR . '/components/observation_feed_card.php';
                ?>
                <?php endforeach; ?>
            </div>

            <!-- More / Empty -->
            <?php if (empty($latest_obs)): ?>
                <div class="py-12 text-center">
                    <i data-lucide="leaf" class="w-12 h-12 mx-auto mb-4 text-primary-surface"></i>
                    <p class="text-sm font-bold mb-1 text-muted"><?= htmlspecialchars($homeUiText['feed_empty_title']) ?></p>
                    <p class="text-xs text-faint"><?= htmlspecialchars($homeUiText['feed_empty_body']) ?></p>
                    <a href="post.php" class="btn-primary inline-flex items-center gap-2 mt-4 px-6 py-2.5 text-sm active:scale-95 transition">
                        <i data-lucide="camera" class="w-4 h-4"></i> <?= htmlspecialchars($homeUiText['feed_empty_cta']) ?>
                    </a>
                </div>
            <?php else: ?>
                <div class="pt-8 text-center">
                    <a href="explore.php?source=post" class="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-primary/10 text-primary-dark font-bold text-sm border border-primary/20 hover:bg-primary/20 hover:scale-105 active:scale-95 transition-all">
                        <i data-lucide="camera" class="w-4 h-4"></i>
                        <?= htmlspecialchars($homeUiText['feed_more_cta']) ?>
                        <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </a>
                </div>
            <?php endif; ?>
        </section>

        <!-- ==================== 数字で見る ikimon ==================== -->
        <?php
        $allObs = array_filter(DataStore::fetchAll('observations'), function ($o) {
            if (!empty($o['site_id'])) return false;
            $uid = $o['user_id'] ?? '';
            if (str_starts_with($uid, 'user_69548f9a55') || str_starts_with($uid, 'install_')) return false;
            return true;
        });
        $totalObservations = count($allObs);
        $speciesSet = [];
        $rgCount = 0;
        $userSet = [];
        $uidMap = [
            'user_69a01379b962e' => 'nats', 'user_69be85c688371' => 'nats',
            'user_admin_001' => 'yamaki', 'user_ya_001' => 'yamaki', 'user_69bc926c2eca4' => 'yamaki',
        ];
        foreach ($allObs as $o) {
            if (!empty($o['taxon']['name'])) $speciesSet[$o['taxon']['name']] = true;
            if (BioUtils::isResearchGradeLike($o['status'] ?? ($o['quality_grade'] ?? ''))) $rgCount++;
            $uid = $o['user_id'] ?? '';
            if (!empty($uid) && !str_starts_with($uid, 'guest_')) {
                $userSet[$uidMap[$uid] ?? $uid] = true;
            }
        }
        $totalSpecies = count($speciesSet);
        $rgRate = $totalObservations > 0 ? round($rgCount / $totalObservations * 100) : 0;
        $totalUsers = count($userSet);
        ?>
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-bottom:var(--phi-xl)">
            <div class="bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/10 rounded-3xl" style="padding:var(--phi-xl) var(--phi-lg)">
                <h2 class="font-black text-text text-center" style="font-size:var(--text-lg);margin-bottom:var(--phi-md)"><?= htmlspecialchars($homeUiText['numbers_title']) ?></h2>
                <div class="grid grid-cols-2 md:grid-cols-4" style="gap:var(--phi-md)">
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black text-primary-dark" style="font-size:var(--text-xl)"><?= number_format($totalObservations) ?></p>
                        <p class="text-token-xs text-muted mt-1"><?= htmlspecialchars($homeUiText['numbers_observations']) ?></p>
                    </div>
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black" style="font-size:var(--text-xl);color:#0369a1"><?= number_format($totalSpecies) ?></p>
                        <p class="text-token-xs text-muted mt-1"><?= htmlspecialchars($homeUiText['numbers_species']) ?></p>
                    </div>
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black" style="font-size:var(--text-xl);color:#92400e"><?= $rgRate ?>%</p>
                        <p class="text-token-xs text-muted mt-1"><?= htmlspecialchars($homeUiText['numbers_stable']) ?></p>
                    </div>
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black" style="font-size:var(--text-xl);color:#0369a1"><?= number_format($totalUsers) ?></p>
                        <p class="text-token-xs text-muted mt-1"><?= htmlspecialchars($homeUiText['numbers_people']) ?></p>
                    </div>
                </div>
            </div>
        </section>

        <?php if (!empty($featuredSurveyors)): ?>
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-bottom:var(--phi-xl)">
            <div class="rounded-3xl border border-sky-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_50%,#ecfeff_100%)]" style="padding:var(--phi-xl) var(--phi-lg)">
                <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4" style="margin-bottom:var(--phi-md)">
                    <div>
                        <p class="text-token-xs font-black tracking-widest text-sky-700"><?= htmlspecialchars($homeUiText['surveyors_label']) ?></p>
                        <h2 class="font-black text-text" style="font-size:var(--text-lg)"><?= htmlspecialchars($homeUiText['surveyors_title']) ?></h2>
                        <p class="text-token-sm text-muted mt-2"><?= htmlspecialchars($homeUiText['surveyors_body']) ?></p>
                    </div>
                    <div class="flex flex-col sm:flex-row gap-2">
                        <a href="surveyors.php" class="inline-flex items-center gap-2 text-sm font-bold text-sky-700 hover:text-sky-800">
                            <?= htmlspecialchars($homeUiText['surveyors_view']) ?>
                            <i data-lucide="arrow-right" class="w-4 h-4"></i>
                        </a>
                        <a href="request_survey.php" class="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800">
                            <?= htmlspecialchars($homeUiText['surveyors_request']) ?>
                            <i data-lucide="send" class="w-4 h-4"></i>
                        </a>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <?php foreach ($featuredSurveyors as $surveyor): ?>
                        <a href="surveyor_profile.php?id=<?= urlencode($surveyor['id']) ?>" class="block rounded-2xl border border-white bg-white/90 hover:shadow-lg transition" style="padding:var(--phi-md)">
                            <div class="flex items-start gap-3">
                                <img src="<?= htmlspecialchars($surveyor['avatar']) ?>" alt="<?= htmlspecialchars(($surveyor['name'] ?? '') . $homeUiText['surveyor_avatar_suffix']) ?>" class="w-14 h-14 rounded-2xl object-cover border border-sky-100">
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <p class="font-black text-text"><?= htmlspecialchars($surveyor['name']) ?></p>
                                        <span class="text-[10px] font-black text-sky-700 bg-sky-50 border border-sky-100 rounded-full px-2 py-0.5"><?= htmlspecialchars($homeUiText['surveyor_badge']) ?></span>
                                    </div>
                                    <p class="text-xs text-muted mt-1"><?= htmlspecialchars($surveyor['headline'] ?: $homeUiText['surveyor_headline_fallback']) ?></p>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2 mt-4">
                                <div class="rounded-xl bg-sky-50 px-3 py-3 text-center">
                                    <div class="text-lg font-black text-sky-700"><?= number_format($surveyor['official_record_count']) ?></div>
                                    <div class="text-[10px] text-muted"><?= htmlspecialchars($homeUiText['surveyor_official_records']) ?></div>
                                </div>
                                <div class="rounded-xl bg-emerald-50 px-3 py-3 text-center">
                                    <div class="text-lg font-black text-emerald-700"><?= number_format($surveyor['species_count']) ?></div>
                                    <div class="text-[10px] text-muted"><?= htmlspecialchars($homeUiText['surveyor_species']) ?></div>
                                </div>
                            </div>
                        </a>
                    <?php endforeach; ?>
                </div>
            </div>
        </section>
        <?php endif; ?>

        <!-- B2B/G Section (Rich) -->
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-bottom:var(--phi-2xl)">
            <div class="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-3xl" style="padding:var(--phi-xl) var(--phi-lg)">
                <h2 class="font-black text-text text-center" style="font-size:var(--text-lg);margin-bottom:var(--phi-sm)">🏢 <?= htmlspecialchars($homeUiText['org_title']) ?></h2>
                <p class="text-token-sm text-muted text-center" style="margin-bottom:var(--phi-lg)"><?= htmlspecialchars($homeUiText['org_body']) ?></p>
                <div class="grid grid-cols-1 md:grid-cols-2" style="gap:var(--phi-sm)">
                    <a href="for-business.php" class="bg-white rounded-2xl border border-slate-100 hover:shadow-lg hover:border-blue-200 transition group" style="padding:var(--phi-md)">
                        <div class="flex items-center mb-3" style="gap:var(--phi-sm)">
                            <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                <i data-lucide="building-2" class="w-5 h-5 text-blue-600"></i>
                            </div>
                            <div>
                                <p class="font-black text-text" style="font-size:var(--text-base)"><?= htmlspecialchars($homeUiText['org_company_title']) ?></p>
                                <p class="text-token-xs text-muted"><?= htmlspecialchars($homeUiText['org_company_subtitle']) ?></p>
                            </div>
                        </div>
                        <ul class="space-y-1.5 text-xs text-muted">
                            <li class="flex items-start gap-1.5"><span class="text-blue-700 mt-0.5">✓</span> <?= htmlspecialchars($homeUiText['org_company_point_1']) ?></li>
                            <li class="flex items-start gap-1.5"><span class="text-blue-700 mt-0.5">✓</span> <?= htmlspecialchars($homeUiText['org_company_point_2']) ?></li>
                            <li class="flex items-start gap-1.5"><span class="text-blue-700 mt-0.5">✓</span> <?= htmlspecialchars($homeUiText['org_company_point_3']) ?></li>
                        </ul>
                        <div class="mt-3 text-xs font-bold text-blue-600 group-hover:text-blue-700 flex items-center gap-1 transition">
                            <?= htmlspecialchars($homeUiText['details']) ?> <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                        </div>
                    </a>
                    <!-- 自治体向け -->
                    <a href="for-business.php#government" class="bg-white rounded-2xl border border-slate-100 hover:shadow-lg hover:border-emerald-200 transition group" style="padding:var(--phi-md)">
                        <div class="flex items-center mb-3" style="gap:var(--phi-sm)">
                            <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <i data-lucide="landmark" class="w-5 h-5 text-emerald-600"></i>
                            </div>
                            <div>
                                <p class="font-black text-text" style="font-size:var(--text-base)"><?= htmlspecialchars($homeUiText['org_public_title']) ?></p>
                                <p class="text-token-xs text-muted"><?= htmlspecialchars($homeUiText['org_public_subtitle']) ?></p>
                            </div>
                        </div>
                        <ul class="space-y-1.5 text-xs text-muted">
                            <li class="flex items-start gap-1.5"><span class="text-emerald-500 mt-0.5">✓</span> <?= htmlspecialchars($homeUiText['org_public_point_1']) ?></li>
                            <li class="flex items-start gap-1.5"><span class="text-emerald-500 mt-0.5">✓</span> <?= htmlspecialchars($homeUiText['org_public_point_2']) ?></li>
                            <li class="flex items-start gap-1.5"><span class="text-emerald-500 mt-0.5">✓</span> <?= htmlspecialchars($homeUiText['org_public_point_3']) ?></li>
                        </ul>
                        <div class="mt-3 text-xs font-bold text-emerald-600 group-hover:text-emerald-700 flex items-center gap-1 transition">
                            <?= htmlspecialchars($homeUiText['details']) ?> <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                        </div>
                    </a>
                </div>
            </div>
        </section>

        <!-- Footer -->
        <?php include __DIR__ . '/components/footer.php'; ?>

    </main><!-- End App Shell Main -->

    <script nonce="<?= CspNonce::attr() ?>">
        function pullToRefresh() {
            return {
                pullY: 0,
                startY: 0,
                refreshing: false,
                crossedThreshold: false,

                start(e) {
                    if (window.scrollY > 0) return;
                    const y = e.touches[0].clientY;
                    // ボトムナビ領域（画面下部80px）からのタッチはPTRを無視
                    if (y > window.innerHeight - 80) return;
                    this.startY = y;
                },

                move(e) {
                    if (window.scrollY > 0 || !this.startY) return;
                    const y = e.touches[0].clientY;
                    const diff = y - this.startY;
                    if (diff > 0) {
                        this.pullY = Math.pow(diff, 0.8);
                        if (e.cancelable) e.preventDefault();

                        if (this.pullY > 100 && !this.crossedThreshold) {
                            if (window.HapticEngine) HapticEngine.medium();
                            this.crossedThreshold = true;
                        } else if (this.pullY < 100) {
                            this.crossedThreshold = false;
                        }
                    }
                },

                end() {
                    if (!this.startY) return;
                    if (this.pullY > 100) {
                        this.refreshing = true;
                        this.pullY = 60;
                        if (window.SoundManager) SoundManager.play('success');
                        setTimeout(() => {
                            window.location.reload();
                        }, 800);
                    } else {
                        this.pullY = 0;
                        this.refreshing = false;
                    }
                    this.startY = 0;
                }
            }
        }

        lucide.createIcons();

        // Intersection Observer for Feed Cards
        (function() {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px',
                threshold: 0.1
            });
            document.querySelectorAll('.feed-card').forEach(card => observer.observe(card));
        })();

        // Auto-Sync Offline Data
        document.addEventListener('DOMContentLoaded', () => {
            if (window.offlineManager && navigator.onLine) {
                window.offlineManager.sync();
            }
            window.addEventListener('online', () => {
                window.offlineManager.sync();
            });

            <?php if ($currentUser): ?>
            if (window.ikimonAnalytics) {
                window.ikimonAnalytics.track('today_card_view', {
                    completed: <?= $todayHabitComplete ? 'true' : 'false' ?>,
                    location: 'home',
                    types: <?= json_encode(array_values($todayTypes), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?>
                });
            }

            document.querySelectorAll('[data-habit-cta]').forEach((el) => {
                el.addEventListener('click', () => {
                    if (window.ikimonAnalytics) {
                        window.ikimonAnalytics.track('today_card_cta', {
                            location: 'home',
                            target: el.getAttribute('data-habit-cta')
                        });
                    }
                });
            });

            const habitCard = document.getElementById('today-habit-card-home');
            const reflectionPanel = habitCard?.querySelector('[data-reflection-panel]');
            const reflectionToggle = habitCard?.querySelector('[data-reflection-toggle]');
            const reflectionCancel = habitCard?.querySelector('[data-reflection-cancel]');
            const reflectionSubmit = habitCard?.querySelector('[data-reflection-submit]');
            const reflectionNote = habitCard?.querySelector('[data-reflection-note]');
            const reflectionStatus = habitCard?.querySelector('[data-reflection-status]');
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

            reflectionToggle?.addEventListener('click', () => {
                reflectionPanel?.classList.remove('hidden');
                reflectionNote?.focus();
            });

            reflectionCancel?.addEventListener('click', () => {
                reflectionPanel?.classList.add('hidden');
            });

            reflectionSubmit?.addEventListener('click', async () => {
                const note = reflectionNote?.value?.trim() || '';
                if (!note) {
                    if (reflectionStatus) reflectionStatus.textContent = <?= json_encode($homeUiText['reflection_short_required'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
                    reflectionNote?.focus();
                    return;
                }

                reflectionSubmit.disabled = true;
                if (reflectionStatus) reflectionStatus.textContent = <?= json_encode($homeUiText['reflection_saving'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;

                try {
                    const response = await fetch('api/log_reflection.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken
                        },
                        body: JSON.stringify({
                            note,
                            source: 'home'
                        })
                    });
                    const result = await response.json();
                    if (!response.ok || !result.success) {
                        throw new Error(result.message || <?= json_encode($homeUiText['reflection_save_failed'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>);
                    }

                    if (window.ikimonAnalytics) {
                        window.ikimonAnalytics.track('reflection_habit_qualified', {
                            location: 'home',
                            note_length: note.length
                        });
                    }

                    if (reflectionStatus) reflectionStatus.textContent = <?= json_encode($homeUiText['reflection_saved'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
                    window.setTimeout(() => window.location.reload(), 450);
                } catch (error) {
                    if (reflectionStatus) reflectionStatus.textContent = error.message || <?= json_encode($homeUiText['reflection_save_failed'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
                } finally {
                    reflectionSubmit.disabled = false;
                }
            });
            <?php endif; ?>
        });
    </script>
    <script src="js/ToastManager.js"></script>
    <?php include __DIR__ . '/components/badge_notification.php'; ?>
</body>

</html>
