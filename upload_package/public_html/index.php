<?php
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
// QuestManager moved to dashboard
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/PrivacyFilter.php';
require_once __DIR__ . '/../libs/FollowManager.php';
require_once __DIR__ . '/../libs/HabitEngine.php';
require_once __DIR__ . '/../libs/SurveyorManager.php';

Auth::init();
$currentUser = Auth::user();

// Fetch Data for Feed with Filters
$filter = $_GET['filter'] ?? 'all';
$followedUserIds = ($currentUser && $filter === 'following') ? FollowManager::getFollowedUserIds($currentUser['id']) : [];
$latest_obs = DataStore::getLatest('observations', 6, function ($item) use ($filter, $currentUser, $followedUserIds) {
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
$allPublicSurveyors = SurveyorManager::listPublicSurveyors();
$featuredSurveyors = array_slice($allPublicSurveyors, 0, 3);
$publicSurveyorCount = count($allPublicSurveyors);
$meta_title = 'ikimon — 散歩×生きもの観察で自然を守りながら健康に';
$meta_description = 'スマホで写真を撮って、名前を調べて、地図に記録。小学生から大人まで、だれでも参加できる生きもの観察プラットフォームです。';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>

    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json" nonce="<?= CspNonce::attr() ?>">
        {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "ikimon.life",
            "alternateName": "いきもんライフ",
            "url": "https://ikimon.life/",
            "description": "市民参加型 生物多様性プラットフォーム — 観察・同定・保全",
            "inLanguage": "ja",
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
            background: linear-gradient(135deg, var(--color-bg-surface) 0%, var(--color-border) 50%, var(--color-bg-surface) 100%);
            background-size: 200% 200%;
            animation: shimmer 1.5s ease-in-out infinite;
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
            background: linear-gradient(135deg, #064e3b 0%, #065f46 25%, #047857 50%, #059669 75%, #0d9488 100%);
            position: relative;
            overflow: hidden;
        }
        .hero-section::before {
            content: '';
            position: absolute;
            inset: 0;
            background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") repeat;
        }

        .hero-section h1 {
            font-size: clamp(1.75rem, 5vw, 2.5rem);
            line-height: 1.15;
            letter-spacing: -0.02em;
        }

        .hero-section .hero-sub {
            font-size: var(--text-base);
            line-height: 1.618;
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
    <main class="w-full min-h-[100dvh] transition-transform duration-200 ease-out pt-14"
        @touchstart="start($event)"
        @touchmove="move($event)"
        @touchend="end()"
        :style="`transform: translateY(${pullY}px)`">

        <!-- ==================== HERO SECTION ==================== -->
        <section class="hero-section relative">
            <!-- Decorative elements -->
            <div class="absolute top-10 left-10 w-48 h-48 rounded-full blur-3xl bg-white/10"></div>
            <div class="absolute bottom-10 right-10 w-64 h-64 rounded-full blur-3xl bg-emerald-300/10"></div>
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl bg-teal-400/5"></div>

            <div class="max-w-5xl mx-auto px-6 text-center relative z-10" style="padding-top:var(--phi-2xl);padding-bottom:var(--phi-xl)">
                <!-- Eyebrow Badge -->
                <div class="inline-flex items-center gap-2 rounded-full px-4 py-1.5 bg-white/15 backdrop-blur-sm border border-white/20" style="margin-bottom:var(--phi-md)">
                    <span class="w-2 h-2 rounded-full animate-pulse bg-emerald-300"></span>
                    <span class="text-token-xs font-bold text-white/90"><?php echo number_format($totalObs); ?> 件の観察記録 · <?php echo number_format($uniqueSpecies); ?> 種を確認</span>
                </div>

                <!-- Main Copy -->
                <h1 class="font-black text-white" style="margin-bottom:var(--phi-sm)">
                    歩いて、見つけて、<br class="md:hidden"><span class="text-emerald-300">守る</span>。
                </h1>
                <p class="hero-sub max-w-xl mx-auto text-white/80" style="margin-bottom:var(--phi-lg)">
                    <span class="inline-block">散歩×生きもの観察で、</span><span class="inline-block">自然を守りながら健康に。</span><br class="md:hidden">
                    <span class="inline-block">あなたの一歩が</span><span class="inline-block">科学データになる。</span>
                </p>

                <!-- CTA Buttons -->
                <div class="flex flex-col sm:flex-row items-center justify-center gap-3" style="margin-bottom:var(--phi-lg)">
                    <a href="post.php" class="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-emerald-800 font-black text-sm shadow-lg shadow-black/20 hover:bg-emerald-50 hover:scale-105 active:scale-95 transition-all">
                        <i data-lucide="camera" class="w-5 h-5"></i>
                        生き物を記録する
                    </a>
                    <a href="about.php" class="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white/15 backdrop-blur-sm text-white font-bold text-sm border border-white/25 hover:bg-white/25 hover:scale-105 active:scale-95 transition-all">
                        <i data-lucide="info" class="w-4 h-4"></i>
                        はじめて使う方へ
                    </a>
                </div>

                <!-- Quick Nav (Inline) -->
                <div class="flex items-center justify-center gap-2 flex-wrap">
                    <a href="zukan.php" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-xs font-bold hover:bg-white/20 transition">
                        <i data-lucide="book-open" class="w-3.5 h-3.5"></i> 図鑑
                    </a>
                    <a href="explore.php" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-xs font-bold hover:bg-white/20 transition">
                        <i data-lucide="map" class="w-3.5 h-3.5"></i> 探索マップ
                    </a>
                    <a href="compass.php" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-xs font-bold hover:bg-white/20 transition">
                        <i data-lucide="trophy" class="w-3.5 h-3.5"></i> コンパス
                    </a>
                    <a href="events.php" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-xs font-bold hover:bg-white/20 transition">
                        <i data-lucide="calendar" class="w-3.5 h-3.5"></i> 観察会
                    </a>
                    <a href="ikimon_walk.php" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-xs font-bold hover:bg-white/20 transition">
                        <i data-lucide="footprints" class="w-3.5 h-3.5"></i> さんぽ
                    </a>
                    <a href="guide/nature-positive.php" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-xs font-bold hover:bg-white/20 transition">
                        <i data-lucide="leaf" class="w-3.5 h-3.5"></i> ネイチャーポジティブ
                    </a>
                </div>
            </div>
        </section>

        <?php if ($currentUser): ?>
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-top:var(--phi-lg);margin-bottom:var(--phi-xl)">
            <div id="today-habit-card-home" class="rounded-3xl border p-5 md:p-6 <?= $todayHabitComplete ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200' ?>">
                <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div class="min-w-0">
                        <div class="text-token-xs font-black tracking-widest <?= $todayHabitComplete ? 'text-emerald-700' : 'text-amber-700' ?>">TODAY</div>
                        <h2 class="text-xl font-black text-text mt-1"><?= htmlspecialchars($todayState['title'] ?? '今日は1つだけでいい。継続を積もう') ?></h2>
                        <p class="text-sm mt-2 <?= $todayHabitComplete ? 'text-emerald-900/80' : 'text-amber-950/80' ?>">
                            <?= htmlspecialchars($todayState['message'] ?? '') ?>
                        </p>
                    </div>
                    <div class="shrink-0 rounded-2xl bg-white/70 px-4 py-3 border border-white/80">
                        <div class="text-2xl"><?= $todayHabitComplete ? '🌿' : '🔥' ?></div>
                        <div class="text-sm font-black text-text"><?= (int)($streakData['current_streak'] ?? 0) ?>日連続</div>
                        <div class="text-token-xs text-muted">自然との接続</div>
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

                <?php if (!empty($todayState['progress_line'])): ?>
                <div class="mt-4 rounded-2xl bg-white/80 border border-white/80 p-4">
                    <div class="text-token-xs font-black tracking-widest <?= $todayHabitComplete ? 'text-emerald-700' : 'text-amber-700' ?>">PROGRESS</div>
                    <p class="text-sm text-text mt-1"><?= htmlspecialchars($todayState['progress_line']) ?></p>
                </div>
                <?php endif; ?>

                <?php if (!empty($natureTimeline['items']) && is_array($natureTimeline['items'])): ?>
                <div class="mt-4 rounded-2xl bg-white/85 border border-white/80 p-4 md:p-5">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <div class="text-token-xs font-black tracking-widest <?= $todayHabitComplete ? 'text-emerald-700' : 'text-amber-700' ?>">MY NATURE STORY</div>
                            <h3 class="text-base font-black text-text mt-1">自分の自然史</h3>
                            <?php if (!empty($natureTimeline['headline'])): ?>
                            <p class="text-sm text-text/80 mt-1"><?= htmlspecialchars($natureTimeline['headline']) ?></p>
                            <?php endif; ?>
                        </div>
                        <div class="shrink-0 rounded-full px-3 py-1 text-token-xs font-bold <?= $todayHabitComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700' ?>">
                            軌跡
                        </div>
                    </div>

                    <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <?php foreach ($natureTimeline['items'] as $item): ?>
                        <div class="rounded-2xl border border-white/80 bg-white/90 p-4">
                            <div class="flex items-center gap-2 text-xs font-black tracking-widest <?= $todayHabitComplete ? 'text-emerald-700' : 'text-amber-700' ?>">
                                <i data-lucide="<?= htmlspecialchars($item['icon'] ?? 'leaf') ?>" class="w-4 h-4"></i>
                                <?= htmlspecialchars($item['label'] ?? '') ?>
                            </div>
                            <div class="text-sm md:text-base font-black text-text mt-2 leading-snug">
                                <?= htmlspecialchars($item['value'] ?? '') ?>
                            </div>
                            <p class="text-token-xs text-muted mt-2"><?= htmlspecialchars($item['detail'] ?? '') ?></p>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
                <?php endif; ?>

                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
                    <?php foreach ($todayCtas as $type => $cta): ?>
                        <?php if (($cta['type'] ?? 'link') === 'button'): ?>
                        <button type="button" data-habit-cta="<?= htmlspecialchars($type) ?>" data-reflection-toggle class="rounded-2xl bg-white p-4 border border-white/80 hover:border-border-strong transition text-left">
                            <div class="flex items-center gap-3">
                                <i data-lucide="<?= htmlspecialchars($cta['icon']) ?>" class="w-5 h-5 <?= htmlspecialchars($cta['icon_class'] ?? 'text-primary') ?>"></i>
                                <div>
                                    <div class="text-sm font-black text-text"><?= htmlspecialchars($cta['label']) ?></div>
                                    <div class="text-token-xs text-muted"><?= htmlspecialchars($cta['detail'] ?? '') ?></div>
                                </div>
                            </div>
                        </button>
                        <?php else: ?>
                        <a href="<?= htmlspecialchars($cta['href'] ?? '#') ?>" data-habit-cta="<?= htmlspecialchars($type) ?>" class="rounded-2xl bg-white p-4 border border-white/80 hover:border-border-strong transition">
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
                <div class="mt-4 rounded-2xl bg-white/80 border border-white/80 p-4">
                    <div class="text-token-xs font-black tracking-widest text-emerald-700">TODAY NOTE</div>
                    <p class="text-sm text-text mt-1"><?= htmlspecialchars($todayReflectionPreview) ?></p>
                </div>
                <?php elseif ($latestReflectionPreview !== ''): ?>
                <p class="mt-4 text-token-xs text-muted">前回の1分メモ: <?= htmlspecialchars($latestReflectionPreview) ?></p>
                <?php endif; ?>

                <div class="mt-4 rounded-2xl bg-white/80 border border-white/80 p-4 hidden" data-reflection-panel>
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <div class="text-token-xs font-black tracking-widest text-amber-700">1 MINUTE NOTE</div>
                            <p class="text-sm text-text mt-1">今日は何を見たか、何に気づいたかを一言だけ残す。</p>
                        </div>
                        <button type="button" data-reflection-cancel class="text-xs font-bold text-muted hover:text-text transition">閉じる</button>
                    </div>
                    <textarea data-reflection-note maxlength="120" rows="3" class="mt-3 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text focus:outline-none focus:border-border-strong resize-none" placeholder="例: 風が冷たくてもスズメは元気だった"></textarea>
                    <div class="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p class="text-token-xs text-muted" data-reflection-status>外に出られない日でも、自然との接続は残せる。</p>
                        <button type="button" data-reflection-submit class="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-black text-white hover:bg-amber-600 transition">
                            <i data-lucide="pen-square" class="w-4 h-4"></i> 保存して継続に加える
                        </button>
                    </div>
                </div>

                <?php if (!$todayHabitComplete && !empty($todayRemaining)): ?>
                <p class="mt-4 text-token-xs text-amber-700">
                    残り: <?= htmlspecialchars(implode(' / ', array_map(fn($type) => $todayLabels[$type] ?? $type, $todayRemaining))) ?>
                </p>
                <?php endif; ?>
            </div>
        </section>
        <?php endif; ?>

        <!-- Daily Quest & Survey Panel → moved to dashboard.php -->

        <!-- ==================== HOW-TO SECTION (Non-logged-in) ==================== -->
        <?php if (!$currentUser): ?>
            <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-bottom:var(--phi-2xl)">
                <div class="bg-gradient-to-br from-primary-surface to-secondary-surface rounded-3xl border border-primary/10" style="padding:var(--phi-xl) var(--phi-lg)">
                    <h2 class="font-black text-text text-center" style="font-size:var(--text-xl);margin-bottom:var(--phi-sm)">🌿 はじめての生きもの観察</h2>
                    <p class="text-token-sm text-muted text-center" style="margin-bottom:var(--phi-lg)">散歩が「調査」に変わる。3ステップで始められます</p>

                    <div class="grid grid-cols-1 md:grid-cols-3" style="gap:var(--phi-lg)">
                        <!-- Step 1 -->
                        <div class="flex flex-col items-center text-center">
                            <div class="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary-glow/20">
                                <i data-lucide="camera" class="w-8 h-8 text-white"></i>
                            </div>
                            <div class="text-token-xs font-black text-primary uppercase tracking-widest mb-1">STEP 1</div>
                            <h3 class="text-base font-black text-text mb-1">📸 写真を撮る</h3>
                            <p class="text-sm text-muted leading-relaxed">見つけた生き物の写真を撮りましょう。<br>名前がわからなくても大丈夫です。</p>
                        </div>
                        <!-- Step 2 -->
                        <div class="flex flex-col items-center text-center">
                            <div class="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4 shadow-lg shadow-secondary/20">
                                <i data-lucide="search" class="w-8 h-8 text-white"></i>
                            </div>
                            <div class="text-token-xs font-black text-secondary uppercase tracking-widest mb-1">STEP 2</div>
                            <h3 class="text-base font-black text-text mb-1">🔍 調べてみる</h3>
                            <p class="text-sm text-muted leading-relaxed">図鑑やガイドで名前を調べましょう。<br>困ったらみんなが教えてくれます。</p>
                        </div>
                        <!-- Step 3 -->
                        <div class="flex flex-col items-center text-center">
                            <div class="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mb-4 shadow-lg shadow-accent/20">
                                <i data-lucide="map" class="w-8 h-8 text-white"></i>
                            </div>
                            <div class="text-token-xs font-black text-accent uppercase tracking-widest mb-1">STEP 3</div>
                            <h3 class="text-base font-black text-text mb-1">🗺️ 地図に残す</h3>
                            <p class="text-sm text-muted leading-relaxed">あなたの記録が地域のデータに。<br>みんなで生きもの地図を作りましょう。</p>
                        </div>
                    </div>

                    <!-- なぜ？ベネフィット（科学的エビデンス付き） -->
                    <div class="grid grid-cols-2 md:grid-cols-4" style="margin-top:var(--phi-xl);gap:var(--phi-sm)">
                        <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                            <span style="font-size:var(--text-xl)">👟</span>
                            <p class="font-black text-primary-dark" style="font-size:var(--text-lg)">-51%</p>
                            <p class="text-token-xs text-muted">認知症リスク減<br><span class="text-muted">(9,800歩/日)</span></p>
                        </div>
                        <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                            <span style="font-size:var(--text-xl)">🧠</span>
                            <p class="font-black" style="font-size:var(--text-lg);color:#0369a1">脳トレ</p>
                            <p class="text-token-xs text-muted">種同定で<br>認知的予備力UP</p>
                        </div>
                        <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                            <span style="font-size:var(--text-xl)">🌿</span>
                            <p class="font-black" style="font-size:var(--text-lg);color:#92400e">↓低下</p>
                            <p class="text-token-xs text-muted">ストレスホルモン<br><span class="text-muted">(森林浴効果)</span></p>
                        </div>
                        <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                            <span style="font-size:var(--text-xl)">🌍</span>
                            <p class="font-black" style="font-size:var(--text-lg);color:#0369a1">科学データ</p>
                            <p class="text-token-xs text-muted">あなたの記録が<br>保全に貢献</p>
                        </div>
                    </div>

                    <div class="text-center" style="margin-top:var(--phi-xl)">
                        <a href="post.php" class="btn-primary text-base px-8 py-3.5 inline-flex items-center gap-2 shadow-lg shadow-primary-glow/20">
                            <i data-lucide="camera" class="w-5 h-5"></i>
                            さっそく始めてみる
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
                    <h2 class="text-2xl font-black tracking-tight text-text"><?php echo __('home.timeline'); ?></h2>
                    <p class="text-sm text-muted"><?php echo count($latest_obs); ?> <?php echo __('home.updates_suffix'); ?></p>
                </div>
                <div class="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1" role="tablist" aria-label="タイムラインフィルタ">
                    <a href="?filter=all" role="tab" aria-selected="<?php echo $filter === 'all' ? 'true' : 'false'; ?>" class="px-4 py-1.5 rounded-full text-sm font-bold transition whitespace-nowrap <?php echo $filter === 'all' ? 'bg-primary/10 border border-primary/20' : 'text-muted hover:text-text hover:bg-surface'; ?>" <?php if ($filter === 'all') echo 'style="color:#065f46"'; ?>>
                        すべて
                    </a>
                    <a href="id_workbench.php" role="tab" aria-selected="false" class="px-4 py-1.5 rounded-full text-sm font-bold transition flex items-center gap-1.5 whitespace-nowrap text-muted hover:text-warning hover:bg-warning-surface">
                        <i data-lucide="search-check" class="w-4 h-4"></i>
                        <?php echo __('nav.id_center'); ?>
                    </a>
                    <?php if ($currentUser): ?>
                        <a href="/profile.php" role="tab" aria-selected="false" class="px-4 py-1.5 rounded-full text-sm font-bold transition whitespace-nowrap text-muted hover:text-secondary hover:bg-secondary/5">
                            <?php echo __('nav.profile'); ?>
                        </a>
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
                    // Legacy fallback: likes/ ディレクトリも確認
                    if ($obsTotalReactions === 0) {
                        $_legacyFile = DATA_DIR . '/likes/' . $obs['id'] . '.json';
                        if (file_exists($_legacyFile)) {
                            $_ll = json_decode(file_get_contents($_legacyFile), true) ?: [];
                            $obsReactions['footprint']['count'] = count($_ll);
                            $obsReactions['footprint']['reacted'] = $currentUser && in_array($currentUser['id'], $_ll);
                            $obsTotalReactions = count($_ll);
                        }
                    }
                    $obsComments = count($obs['identifications'] ?? []);
                ?>
                    <?php
                        $feedCardReactionsJson = json_encode($obsReactions, JSON_HEX_TAG | JSON_HEX_AMP);
                        $feedCardObsId = $obs['id'];
                        $feedCardDetailUrl = 'observation_detail.php?id=' . urlencode($obs['id']);
                        $feedCardShareTitle = $obs['taxon']['name'] ?? '観察記録';
                    ?>
                    <article x-data='{ reactions: <?php echo $feedCardReactionsJson; ?>, total: <?php echo (int)$obsTotalReactions; ?>, scale: 1, menuOpen: false, loggedIn: <?php echo $currentUser ? 'true' : 'false'; ?> }'
                     @click.outside="menuOpen = false"
                        class="feed-card feed-card--animated rounded-2xl overflow-hidden transition bg-elevated border border-border shadow-sm">
                        <!-- Feed Header -->
                        <div class="px-4 py-3 flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-surface overflow-hidden">
                                    <?php if (!empty($obs['user_avatar'])): ?>
                                        <img src="<?php echo htmlspecialchars($obs['user_avatar']); ?>" alt="<?php echo htmlspecialchars($obs['user_name'] ?? 'ユーザー'); ?>のアバター" class="w-full h-full object-cover" loading="lazy">
                                    <?php endif; ?>
                                </div>
                                <div>
                                    <p class="text-sm font-bold leading-none text-text"><?php echo htmlspecialchars($obs['user_name'] ?? substr($obs['user_id'], 0, 4)); ?></p>
                                    <p class="text-token-xs text-muted"><?php echo BioUtils::timeAgo($obs['observed_at']); ?> ・ <?php echo htmlspecialchars($obs['municipality'] ?? $obs['location']['name'] ?? ''); ?></p>
                                </div>
                            </div>
                            <div class="relative">
                                <button @click.stop="menuOpen = !menuOpen" class="p-2 transition rounded-full text-faint hover:bg-surface">
                                    <i data-lucide="more-horizontal" class="w-4 h-4"></i>
                                </button>
                                <div x-show="menuOpen" x-transition.opacity.duration.150ms
                                    class="absolute right-0 top-full mt-1 w-44 bg-elevated rounded-xl shadow-lg border border-border z-30 py-1 overflow-hidden">
                                    <a href="observation_detail.php?id=<?php echo urlencode($obs['id']); ?>"
                                        class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface transition">
                                        <i data-lucide="eye" class="w-4 h-4 text-faint"></i>詳細を見る
                                    </a>
                                    <button @click="menuOpen=false; let u=location.origin+'/<?php echo $feedCardDetailUrl; ?>'; if(navigator.share){navigator.share({title:'<?php echo htmlspecialchars($feedCardShareTitle, ENT_QUOTES); ?>',url:u}).catch(()=>{})}else{navigator.clipboard.writeText(u)}"
                                        class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface transition text-left">
                                        <i data-lucide="share-2" class="w-4 h-4 text-faint"></i>シェアする
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Photo -->
                        <div class="aspect-square w-full bg-surface relative group select-none block overflow-hidden">
                            <img src="<?php echo $obs['photos'][0]; ?>" alt="<?php echo htmlspecialchars($obs['taxon']['name'] ?? $obs['species_name'] ?? '観察写真'); ?>" class="w-full h-full object-cover pointer-events-none" loading="lazy" decoding="async" onload="this.parentElement.classList.remove('lazy-img')">
                            <a href="<?php echo htmlspecialchars($feedCardDetailUrl); ?>" class="absolute inset-0 z-[1] cursor-pointer" aria-label="観察詳細を見る"></a>

                            <div x-show="scale > 1"
                                x-transition:enter="transition ease-out duration-200"
                                x-transition:enter-start="opacity-0 scale-0"
                                x-transition:enter-end="opacity-100 scale-150"
                                x-transition:leave="transition ease-in duration-200"
                                x-transition:leave-start="opacity-100 scale-150"
                                x-transition:leave-end="opacity-0 scale-0"
                                class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                <span class="text-8xl drop-shadow-2xl opacity-90">✨</span>
                            </div>

                            <?php if (BioUtils::hasResolvedTaxon($obs)): ?>
                                <?php
                                $feedTaxon = is_array($obs['taxon'] ?? null) ? $obs['taxon'] : [];
                                $feedDisplayName = $feedTaxon['name'] ?? ($obs['community_taxon']['name'] ?? '同定あり');
                                $feedSlug = $feedTaxon['slug'] ?? ($obs['community_taxon']['slug'] ?? null);
                                $feedSpeciesUrl = $feedSlug
                                    ? 'species/' . urlencode($feedSlug)
                                    : 'species.php?taxon=' . urlencode($feedDisplayName);
                                ?>
                                <a href="<?php echo htmlspecialchars($feedSpeciesUrl); ?>" onclick="event.stopPropagation()"
                                    class="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md flex items-center gap-1.5 border border-white/20 hover:bg-black/70 transition z-10 max-w-[calc(100%-3rem)] truncate">
                                    <i data-lucide="check-circle-2" class="w-3 h-3 text-green-400"></i>
                                    <span class="text-xs font-bold text-white"><?php echo htmlspecialchars($feedDisplayName); ?></span>
                                    <?php if (!empty($obs['individual_count'])): ?>
                                        <span class="text-[10px] font-bold text-white/80 bg-white/15 px-1.5 py-0.5 rounded-full">&times;<?php echo (int)$obs['individual_count']; ?></span>
                                    <?php endif; ?>
                                </a>
                            <?php else: ?>
                                <div class="absolute bottom-2 left-2 flex items-center gap-1.5 z-10">
                                    <div class="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md flex items-center gap-2 border border-white/10">
                                        <i data-lucide="help-circle" class="w-3 h-3 text-white/50"></i>
                                        <span class="text-xs text-white/60"><?php echo __('home.identifying'); ?></span>
                                    </div>
                                    <?php if (!empty($obs['individual_count'])): ?>
                                        <span class="px-2 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold text-white/70 border border-white/10">&times;<?php echo (int)$obs['individual_count']; ?></span>
                                    <?php endif; ?>
                                </div>
                            <?php endif; ?>
                        </div>

                        <!-- Actions: 4 Reaction Buttons -->
                        <div class="px-4 py-2 pb-0 flex items-center gap-0.5">
                            <?php foreach (['footprint' => '👣', 'like' => '✨', 'suteki' => '❤️', 'manabi' => '🔬'] as $_rtype => $_remoji): ?>
                            <button @click="if(!loggedIn){window.location.href='/login.php?redirect='+encodeURIComponent(window.location.pathname+window.location.search);return}; let r=reactions.<?php echo $_rtype; ?>; let prev=r.reacted; r.reacted=!r.reacted; r.count+=r.reacted?1:-1; total+=r.reacted?1:-1; if(r.reacted){scale=1.2;setTimeout(()=>scale=1,200)}; fetch('/api/toggle_like.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'<?php echo htmlspecialchars($feedCardObsId, ENT_QUOTES); ?>',type:'<?php echo $_rtype; ?>'})}).then(res=>res.json()).then(data=>{if(!data.success){r.reacted=prev;r.count+=prev?1:-1;total+=prev?1:-1}}).catch(()=>{r.reacted=prev;r.count+=prev?1:-1;total+=prev?1:-1})"
                                class="flex items-center gap-0.5 py-1.5 px-1.5 rounded-lg transition-all hover:bg-surface active:scale-90"
                                :class="reactions.<?php echo $_rtype; ?>.reacted ? 'bg-primary/10' : ''">
                                <span class="text-base" :class="reactions.<?php echo $_rtype; ?>.reacted ? 'opacity-100' : 'opacity-40'"><?php echo $_remoji; ?></span>
                                <span class="text-[10px] font-bold"
                                    :class="reactions.<?php echo $_rtype; ?>.reacted ? 'text-primary' : 'text-faint'"
                                    x-show="reactions.<?php echo $_rtype; ?>.count > 0"
                                    x-text="reactions.<?php echo $_rtype; ?>.count"></span>
                            </button>
                            <?php endforeach; ?>
                            <a href="observation_detail.php?id=<?php echo urlencode($obs['id']); ?>" class="flex items-center gap-1.5 group active:scale-90 transition-transform py-1.5 px-2 rounded-lg hover:bg-surface" title="同定・コメント">
                                <i data-lucide="message-circle" class="w-5 h-5 transition pointer-events-none <?php echo $obsComments > 0 ? 'text-secondary' : 'text-faint group-hover:text-secondary'; ?>"></i>
                                <span class="text-xs font-bold <?php echo $obsComments > 0 ? 'text-secondary' : 'text-faint'; ?>"><?php echo (int)$obsComments; ?></span>
                            </a>
                            <div class="flex-1"></div>
                        </div>

                        <!-- Caption -->
                        <div class="px-4 py-3">
                            <p class="text-sm text-muted line-clamp-2">
                                <span class="font-bold text-text"><?php echo htmlspecialchars($obs['user_name'] ?? substr($obs['user_id'], 0, 4)); ?></span>
                                <?php echo htmlspecialchars($obs['note'] ?? '記録しました'); ?>
                            </p>
                            <div class="flex items-center justify-between mt-2">
                                <span class="text-token-xs text-muted"><?php echo date('Y.m.d H:i', strtotime($obs['observed_at'] ?? $obs['created_at'] ?? 'now')); ?></span>
                                <a href="observation_detail.php?id=<?php echo urlencode($obs['id']); ?>" class="text-token-xs font-bold transition text-muted hover:text-primary-dark">詳しく見る →</a>
                            </div>
                        </div>
                    </article>
                <?php endforeach; ?>
            </div>

            <!-- More / Empty -->
            <?php if (empty($latest_obs)): ?>
                <div class="py-12 text-center">
                    <i data-lucide="leaf" class="w-12 h-12 mx-auto mb-4 text-primary-surface"></i>
                    <p class="text-sm font-bold mb-1 text-muted">最初の記録者になりませんか？</p>
                    <p class="text-xs text-faint">このエリアにはまだ記録がありません。あなたの記録が、最初の一歩です</p>
                    <a href="post.php" class="btn-primary inline-flex items-center gap-2 mt-4 px-6 py-2.5 text-sm active:scale-95 transition">
                        <i data-lucide="camera" class="w-4 h-4"></i> 記録する
                    </a>
                </div>
            <?php else: ?>
                <div class="pt-8 text-center">
                    <a href="explore.php" class="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-primary/10 text-primary-dark font-bold text-sm border border-primary/20 hover:bg-primary/20 hover:scale-105 active:scale-95 transition-all">
                        <i data-lucide="grid-3x3" class="w-4 h-4"></i>
                        もっと見る
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
                <h2 class="font-black text-text text-center" style="font-size:var(--text-lg);margin-bottom:var(--phi-md)">数字で見る ikimon</h2>
                <div class="grid grid-cols-2 md:grid-cols-4" style="gap:var(--phi-md)">
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black text-primary-dark" style="font-size:var(--text-xl)"><?= number_format($totalObservations) ?></p>
                        <p class="text-token-xs text-muted mt-1">観察記録</p>
                    </div>
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black" style="font-size:var(--text-xl);color:#0369a1"><?= number_format($totalSpecies) ?></p>
                        <p class="text-token-xs text-muted mt-1">確認された種</p>
                    </div>
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black" style="font-size:var(--text-xl);color:#92400e"><?= $rgRate ?>%</p>
                        <p class="text-token-xs text-muted mt-1">安定してきた記録</p>
                    </div>
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black" style="font-size:var(--text-xl);color:#0369a1"><?= number_format($totalUsers) ?></p>
                        <p class="text-token-xs text-muted mt-1">参加者</p>
                    </div>
                </div>
            </div>
        </section>

        <?php if (!empty($featuredSurveyors)): ?>
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-bottom:var(--phi-xl)">
            <div class="rounded-3xl border border-sky-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_50%,#ecfeff_100%)]" style="padding:var(--phi-xl) var(--phi-lg)">
                <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4" style="margin-bottom:var(--phi-md)">
                    <div>
                        <p class="text-token-xs font-black tracking-widest text-sky-700">SURVEYORS</p>
                        <h2 class="font-black text-text" style="font-size:var(--text-lg)">調査員に頼める記録がある</h2>
                        <p class="text-token-sm text-muted mt-2">面談や経歴確認を経た調査員だけを公開。調査したい現場と、調査できる人をつなぎます。</p>
                    </div>
                    <div class="flex flex-col sm:flex-row gap-2">
                        <a href="surveyors.php" class="inline-flex items-center gap-2 text-sm font-bold text-sky-700 hover:text-sky-800">
                            調査員一覧を見る
                            <i data-lucide="arrow-right" class="w-4 h-4"></i>
                        </a>
                        <a href="request_survey.php" class="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800">
                            調査を依頼する
                            <i data-lucide="send" class="w-4 h-4"></i>
                        </a>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <?php foreach ($featuredSurveyors as $surveyor): ?>
                        <a href="surveyor_profile.php?id=<?= urlencode($surveyor['id']) ?>" class="block rounded-2xl border border-white bg-white/90 hover:shadow-lg transition" style="padding:var(--phi-md)">
                            <div class="flex items-start gap-3">
                                <img src="<?= htmlspecialchars($surveyor['avatar']) ?>" alt="<?= htmlspecialchars($surveyor['name']) ?>のアバター" class="w-14 h-14 rounded-2xl object-cover border border-sky-100">
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <p class="font-black text-text"><?= htmlspecialchars($surveyor['name']) ?></p>
                                        <span class="text-[10px] font-black text-sky-700 bg-sky-50 border border-sky-100 rounded-full px-2 py-0.5">認定調査員</span>
                                    </div>
                                    <p class="text-xs text-muted mt-1"><?= htmlspecialchars($surveyor['headline'] ?: '現地の観察記録を支える調査員') ?></p>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2 mt-4">
                                <div class="rounded-xl bg-sky-50 px-3 py-3 text-center">
                                    <div class="text-lg font-black text-sky-700"><?= number_format($surveyor['official_record_count']) ?></div>
                                    <div class="text-[10px] text-muted">公式記録</div>
                                </div>
                                <div class="rounded-xl bg-emerald-50 px-3 py-3 text-center">
                                    <div class="text-lg font-black text-emerald-700"><?= number_format($surveyor['species_count']) ?></div>
                                    <div class="text-[10px] text-muted">確認種</div>
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
                <h2 class="font-black text-text text-center" style="font-size:var(--text-lg);margin-bottom:var(--phi-sm)">🏢 組織で使いたい方へ</h2>
                <p class="text-token-sm text-muted text-center" style="margin-bottom:var(--phi-lg)">ikimonは、会社や地域で自然の記録を続けて残し、見返しやすくするためにも使えます</p>
                <div class="grid grid-cols-1 md:grid-cols-2" style="gap:var(--phi-sm)">
                    <a href="for-business.php" class="bg-white rounded-2xl border border-slate-100 hover:shadow-lg hover:border-blue-200 transition group" style="padding:var(--phi-md)">
                        <div class="flex items-center mb-3" style="gap:var(--phi-sm)">
                            <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                <i data-lucide="building-2" class="w-5 h-5 text-blue-600"></i>
                            </div>
                            <div>
                                <p class="font-black text-text" style="font-size:var(--text-base)">企業・団体の方</p>
                                <p class="text-token-xs text-muted">敷地の自然アーカイブ / 社内参加 / 健康づくり</p>
                            </div>
                        </div>
                        <ul class="space-y-1.5 text-xs text-muted">
                            <li class="flex items-start gap-1.5"><span class="text-blue-700 mt-0.5">✓</span> 敷地や周辺で見つかった生きものを記録として残せる</li>
                            <li class="flex items-start gap-1.5"><span class="text-blue-700 mt-0.5">✓</span> 社員参加の観察会や季節のふり返りに使える</li>
                            <li class="flex items-start gap-1.5"><span class="text-blue-700 mt-0.5">✓</span> 散歩や自然観察を、社内の健康づくりにもつなげやすい</li>
                        </ul>
                        <div class="mt-3 text-xs font-bold text-blue-600 group-hover:text-blue-700 flex items-center gap-1 transition">
                            詳しく見る <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                        </div>
                    </a>
                    <!-- 自治体向け -->
                    <a href="for-business.php#government" class="bg-white rounded-2xl border border-slate-100 hover:shadow-lg hover:border-emerald-200 transition group" style="padding:var(--phi-md)">
                        <div class="flex items-center mb-3" style="gap:var(--phi-sm)">
                            <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <i data-lucide="landmark" class="w-5 h-5 text-emerald-600"></i>
                            </div>
                            <div>
                                <p class="font-black text-text" style="font-size:var(--text-base)">自治体・学校の方</p>
                                <p class="text-token-xs text-muted">地域の記録 / 学校連携 / 自然との接点づくり</p>
                            </div>
                        </div>
                        <ul class="space-y-1.5 text-xs text-muted">
                            <li class="flex items-start gap-1.5"><span class="text-emerald-500 mt-0.5">✓</span> 地域の自然を、市民参加で少しずつアーカイブできる</li>
                            <li class="flex items-start gap-1.5"><span class="text-emerald-500 mt-0.5">✓</span> 季節の変化や、その土地らしい記録を見返しやすい</li>
                            <li class="flex items-start gap-1.5"><span class="text-emerald-500 mt-0.5">✓</span> 学校や観察会とつなげて、自然に親しむ入口を作りやすい</li>
                        </ul>
                        <div class="mt-3 text-xs font-bold text-emerald-600 group-hover:text-emerald-700 flex items-center gap-1 transition">
                            詳しく見る <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
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
                    if (reflectionStatus) reflectionStatus.textContent = 'ひとことだけ書いてください。';
                    reflectionNote?.focus();
                    return;
                }

                reflectionSubmit.disabled = true;
                if (reflectionStatus) reflectionStatus.textContent = '保存中...';

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
                        throw new Error(result.message || '保存に失敗しました');
                    }

                    if (window.ikimonAnalytics) {
                        window.ikimonAnalytics.track('reflection_habit_qualified', {
                            location: 'home',
                            note_length: note.length
                        });
                    }

                    if (reflectionStatus) reflectionStatus.textContent = '保存した。今日の継続に加えた。';
                    window.setTimeout(() => window.location.reload(), 450);
                } catch (error) {
                    if (reflectionStatus) reflectionStatus.textContent = error.message || '保存に失敗しました。';
                } finally {
                    reflectionSubmit.disabled = false;
                }
            });
            <?php endif; ?>
        });
    </script>
    <script src="js/ToastManager.js"></script>
    <script nonce="<?= CspNonce::attr() ?>">
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('SW Registered!', reg))
                .catch(err => console.error('SW Failed', err));
        }
    </script>
    <?php include __DIR__ . '/components/badge_notification.php'; ?>
</body>

</html>
