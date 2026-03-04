<?php
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/QuestManager.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/PrivacyFilter.php';
require_once __DIR__ . '/../libs/FollowManager.php';

Auth::init();
$currentUser = Auth::user();

// Fetch Data for Feed with Filters
$filter = $_GET['filter'] ?? 'all';
$followedUserIds = ($currentUser && $filter === 'following') ? FollowManager::getFollowedUserIds($currentUser['id']) : [];
$latest_obs = DataStore::getLatest('observations', 20, function ($item) use ($filter, $currentUser, $followedUserIds) {
    // Exclude test/E2E users and sample images
    $userName = $item['user_name'] ?? '';
    if (strpos($userName, 'E2E_') === 0) return false;
    $photo = $item['photos'][0] ?? '';
    if (strpos($photo, 'sample_') !== false) return false;

    if ($filter === 'unidentified') {
        return empty($item['taxon']['id']);
    }
    if ($filter === 'mine') {
        return isset($item['user_id']) && isset($currentUser['id']) && $item['user_id'] === $currentUser['id'];
    }
    if ($filter === 'following') {
        return isset($item['user_id']) && in_array($item['user_id'], $followedUserIds);
    }
    return true;
});

$dailyQuests = QuestManager::getActiveQuests();
$dailyQuest = $dailyQuests[0] ?? null;

// Stats for hero
$allObs = DataStore::fetchAll('observations');
$totalObs = count($allObs);
$uniqueSpecies = count(array_unique(array_filter(array_map(function ($o) {
    return $o['taxon']['id'] ?? null;
}, $allObs))));
unset($allObs);
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <title>ikimon.life — 散歩×生きもの観察で自然を守りながら健康に</title>
    <meta name="description" content="スマホで写真を撮って、名前を調べて、地図に記録。小学生から大人まで、だれでも参加できる生きもの観察プラットフォームです。">

    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
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
                "logo": "https://ikimon.life/static/icons/icon-512.png"
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
            background: linear-gradient(135deg, var(--color-primary-surface) 0%, #f0fdf4 30%, #f0f9ff 70%, var(--color-primary-surface) 100%);
        }

        .hero-section h1 {
            font-size: var(--text-2xl);
            line-height: 1.2;
            letter-spacing: var(--tracking);
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

        <!-- ==================== HERO SECTION (Compact) ==================== -->
        <section class="hero-section relative overflow-hidden">
            <div class="max-w-5xl mx-auto px-6 text-center relative z-10" style="padding-top:var(--phi-xl);padding-bottom:var(--phi-lg)">
                <!-- Eyebrow -->
                <div class="inline-flex items-center gap-2 rounded-full px-4 py-1.5 bg-surface/80 border border-primary-surface shadow-sm" style="margin-bottom:var(--phi-md)">
                    <span class="w-2 h-2 rounded-full animate-pulse bg-primary"></span>
                    <span class="text-token-xs font-bold text-primary-dark"><?php echo number_format($totalObs); ?> 件の記録 · <?php echo number_format($uniqueSpecies); ?> 種</span>
                </div>

                <!-- Main Copy -->
                <h1 class="font-black tracking-tight leading-tight text-text" style="margin-bottom:var(--phi-xs)">
                    歩いて、見つけて、<br class="md:hidden"><span class="text-primary">守る</span>。
                </h1>
                <p class="hero-sub max-w-xl mx-auto text-secondary leading-relaxed" style="margin-bottom:var(--phi-lg)">
                    <span class="inline-block">散歩×生きもの観察で、</span><span class="inline-block">自然を守りながら健康に。</span><br class="md:hidden">
                    <span class="inline-block">あなたの一歩が</span><span class="inline-block">科学データになる。</span>
                </p>
            </div>

            <!-- Decorative blobs -->
            <div class="absolute top-10 left-10 w-48 h-48 rounded-full blur-3xl bg-primary/10"></div>
            <div class="absolute bottom-10 right-10 w-36 h-36 rounded-full blur-3xl bg-accent/10"></div>
        </section>

        <!-- ==================== DAILY QUEST WIDGET (New) ==================== -->
        <?php
        $questProgress = 0;
        $questCompleted = false;
        if ($currentUser && $dailyQuest) {
            $today = date('Y-m-d');
            $questLog = $currentUser['quest_log'] ?? [];
            if (isset($questLog[$today][$dailyQuest['id']])) {
                $questProgress = 100;
                $questCompleted = true;
            } else {
                $questProgress = QuestManager::checkProgress($currentUser['id'], $dailyQuest['id']);
            }
        }
        ?>
        <?php if ($dailyQuest): ?>
            <section class="max-w-5xl mx-auto px-4 md:px-6 relative z-30" style="margin-top:calc(var(--phi-sm) * -1);margin-bottom:var(--phi-lg)">
                <div class="bg-white/90 backdrop-blur-md border border-amber-200 rounded-2xl p-4 shadow-lg shadow-amber-500/10 flex items-center gap-4 relative overflow-hidden">
                    <!-- Background decoration -->
                    <div class="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl -mr-8 -mt-8"></div>

                    <!-- Icon -->
                    <div class="shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center text-white shadow-md">
                        <i data-lucide="<?php echo htmlspecialchars($dailyQuest['icon']); ?>" class="w-6 h-6"></i>
                    </div>

                    <!-- Content -->
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[10px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wider">DAILY QUEST</span>
                            <span class="text-xs font-bold text-amber-600">+<?php echo $dailyQuest['reward']; ?> XP</span>
                        </div>
                        <h3 class="text-sm font-black text-text leading-snug"><?php echo htmlspecialchars($dailyQuest['title']); ?></h3>
                        <p class="text-xs text-muted leading-relaxed mt-0.5"><?php echo htmlspecialchars($dailyQuest['description']); ?></p>

                        <!-- Progress Bar -->
                        <div class="mt-2 h-2 w-full bg-surface-dark rounded-full overflow-hidden relative">
                            <div class="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-out" style="width: <?php echo $questProgress; ?>%"></div>
                        </div>
                    </div>

                    <!-- Action / Status -->
                    <div class="shrink-0">
                        <?php if ($questCompleted): ?>
                            <div class="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-green-100/80 text-green-600 border border-green-200">
                                <i data-lucide="check" class="w-6 h-6"></i>
                            </div>
                        <?php else: ?>
                            <a href="post.php" class="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-amber-500 text-white shadow-lg shadow-amber-500/30 hover:bg-amber-600 hover:scale-105 active:scale-95 transition">
                                <i data-lucide="camera" class="w-5 h-5"></i>
                            </a>
                        <?php endif; ?>
                    </div>
                </div>
            </section>
        <?php endif; ?>

        <!-- ==================== QUICK NAV (Horizontal Scroll) ==================== -->
        <section class="max-w-5xl mx-auto relative z-20" style="margin-bottom:var(--phi-xl)">
            <div class="flex gap-3 overflow-x-auto px-4 md:px-6 pb-2 scrollbar-hide snap-x snap-mandatory" style="-webkit-overflow-scrolling: touch">

                <a href="zukan.php" class="flex flex-col items-center gap-2 min-w-[72px] py-3 px-2 rounded-2xl transition hover:shadow-md active:scale-95 bg-elevated border border-border snap-start">
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center bg-accent-surface">
                        <i data-lucide="book-open" class="w-5 h-5 text-accent"></i>
                    </div>
                    <span class="text-token-xs font-bold text-text whitespace-nowrap">図鑑</span>
                </a>
                <a href="explore.php" class="flex flex-col items-center gap-2 min-w-[72px] py-3 px-2 rounded-2xl transition hover:shadow-md active:scale-95 bg-elevated border border-border snap-start">
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center bg-secondary-surface">
                        <i data-lucide="map" class="w-5 h-5 text-secondary"></i>
                    </div>
                    <span class="text-token-xs font-bold text-text whitespace-nowrap">探索マップ</span>
                </a>
                <a href="events.php" class="flex flex-col items-center gap-2 min-w-[72px] py-3 px-2 rounded-2xl transition hover:shadow-md active:scale-95 bg-elevated border border-border snap-start">
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center bg-primary-surface">
                        <i data-lucide="calendar" class="w-5 h-5 text-primary"></i>
                    </div>
                    <span class="text-token-xs font-bold text-text whitespace-nowrap">観察会</span>
                </a>
                <a href="compass.php" class="flex flex-col items-center gap-2 min-w-[72px] py-3 px-2 rounded-2xl transition hover:shadow-md active:scale-95 bg-elevated border border-border snap-start">
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center bg-purple-50 dark:bg-purple-900/30">
                        <i data-lucide="trophy" class="w-5 h-5 text-purple-600 dark:text-purple-400"></i>
                    </div>
                    <span class="text-token-xs font-bold text-text whitespace-nowrap">コンパス</span>
                </a>

                <a href="ikimon_walk.php" class="flex flex-col items-center gap-2 min-w-[72px] py-3 px-2 rounded-2xl transition hover:shadow-md active:scale-95 bg-elevated border border-border snap-start">
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/30">
                        <i data-lucide="footprints" class="w-5 h-5 text-emerald-600 dark:text-emerald-400"></i>
                    </div>
                    <span class="text-token-xs font-bold text-text whitespace-nowrap">さんぽ記録</span>
                </a>
            </div>
        </section>

        <!-- ==================== Survey Panel ==================== -->
        <?php include __DIR__ . '/components/survey_panel.php'; ?>

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
                            <p class="font-black text-primary" style="font-size:var(--text-lg)">-51%</p>
                            <p class="text-token-xs text-muted">認知症リスク減<br><span class="text-faint">(9,800歩/日)</span></p>
                        </div>
                        <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                            <span style="font-size:var(--text-xl)">🧠</span>
                            <p class="font-black text-secondary" style="font-size:var(--text-lg)">脳トレ</p>
                            <p class="text-token-xs text-muted">種同定で<br>認知的予備力UP</p>
                        </div>
                        <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                            <span style="font-size:var(--text-xl)">🌿</span>
                            <p class="font-black text-accent" style="font-size:var(--text-lg)">↓低下</p>
                            <p class="text-token-xs text-muted">ストレスホルモン<br><span class="text-faint">(森林浴効果)</span></p>
                        </div>
                        <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                            <span style="font-size:var(--text-xl)">🌍</span>
                            <p class="font-black" style="font-size:var(--text-lg);color:var(--color-secondary)">科学データ</p>
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

        <!-- ==================== 探索マップ (Exploration Map) ==================== -->
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-bottom:var(--phi-xl)" x-data="explorationMap()" x-cloak>
            <div x-show="stats" x-transition class="bg-gradient-to-br from-primary-surface via-secondary-surface to-accent-surface border border-primary/10 rounded-3xl p-5 md:p-6 shadow-sm">
                <!-- Header with Region Selector -->
                <div class="flex items-center justify-between mb-4 gap-3">
                    <h3 class="text-sm font-black text-primary-dark tracking-wider uppercase shrink-0 flex items-center gap-1.5">
                        <i data-lucide="compass" class="w-4 h-4"></i> 探索マップ
                    </h3>
                    <div class="flex items-center gap-2">
                        <select x-model="selectedCity" @change="onCityChange()"
                            class="text-xs font-bold bg-white border border-primary/20 rounded-full px-3 py-1.5 text-primary focus:ring-1 focus:ring-primary/40 cursor-pointer">
                            <template x-for="c in cities" :key="c.id">
                                <option :value="c.id" x-text="c.name.ja"></option>
                            </template>
                        </select>
                        <!-- 市区町村ドリルダウン -->
                        <select x-show="municipalities.length" x-model="selectedMunicipality" @change="onMunicipalityChange()"
                            x-transition
                            class="text-xs font-bold bg-surface border border-accent/20 rounded-full px-3 py-1.5 text-accent-dark focus:ring-1 focus:ring-accent/40 cursor-pointer">
                            <template x-for="m in municipalities" :key="m.id">
                                <option :value="m.id" x-text="m.name.ja"></option>
                            </template>
                        </select>
                    </div>
                </div>

                <!-- Main Species Counter (進行形表現) -->
                <div class="mb-5">
                    <div class="flex items-end gap-2 mb-2">
                        <span class="text-4xl font-black text-text tabular-nums" x-text="stats?.observed_species || 0"></span>
                        <span class="text-base font-bold text-primary mb-1">種を記録中</span>
                    </div>
                    <div class="w-full bg-surface rounded-full h-2.5 overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-1000 ease-out"
                            :style="'width:' + Math.min(100, (stats?.observed_species / Math.max(1, stats?.estimated_species)) * 100) + '%'"></div>
                    </div>
                    <div class="flex items-center justify-between mt-1.5">
                        <span class="text-token-xs text-faint">推定 <span x-text="stats?.estimated_species || '—'"></span> 種の生息地</span>
                        <span class="text-token-xs text-faint" x-text="stats?.total_observations?.toLocaleString() + ' 件の観察'"></span>
                    </div>
                </div>

                <!-- This Month + Trend Badge -->
                <div class="flex flex-wrap items-center gap-2 text-xs mb-5">
                    <span class="bg-primary-surface text-primary-dark px-3 py-1.5 rounded-full font-bold inline-flex items-center gap-1">
                        🆕 今月 +<span x-text="stats?.new_species_this_month || 0"></span> 件
                    </span>
                    <span x-show="stats?.mom_change_percent" class="px-3 py-1.5 rounded-full font-bold inline-flex items-center gap-1"
                        :class="stats?.mom_change_percent >= 0 ? 'bg-accent-surface text-accent-dark' : 'bg-warning-surface text-warning-dark'">
                        <i :data-lucide="stats?.mom_change_percent >= 0 ? 'trending-up' : 'trending-down'" class="w-3.5 h-3.5"></i>
                        先月比 <span x-text="(stats?.mom_change_percent >= 0 ? '+' : '') + stats?.mom_change_percent + '%'"></span>
                    </span>
                </div>

                <!-- Recent Discoveries -->
                <div class="mb-5" x-show="stats?.recent_discoveries?.length">
                    <p class="text-token-xs text-muted font-bold uppercase tracking-widest mb-2">🔍 最近の発見</p>
                    <div class="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
                        <template x-for="d in (stats?.recent_discoveries || []).slice(0,5)" :key="d.name">
                            <div class="shrink-0 bg-white/80 border border-primary-surface rounded-xl px-3 py-2 min-w-[120px]">
                                <p class="text-xs font-bold text-text" x-text="d.name"></p>
                                <p class="text-[9px] text-faint italic" x-text="d.scientific_name"></p>
                                <p class="text-[9px] text-primary mt-0.5" x-text="d.discovered_at"></p>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- City Comparison ("みんな探索中") -->
                <div class="mb-4" x-show="Object.keys(stats?.cities || {}).length > 1">
                    <p class="text-token-xs text-muted font-bold uppercase tracking-widest mb-2">🏘️ 近くのエリアも探索中</p>
                    <div class="space-y-1.5">
                        <template x-for="[slug, city] in Object.entries(stats?.cities || {}).slice(0,5)" :key="slug">
                            <div class="flex items-center gap-3">
                                <span class="text-token-xs text-text-secondary w-16 truncate font-medium" x-text="city.name"></span>
                                <div class="flex-1 bg-muted/10 rounded-full h-2 overflow-hidden">
                                    <div class="h-full bg-primary/70 rounded-full transition-all duration-700"
                                        :style="'width:' + Math.min(100, (city.observed_species / Math.max(1, city.estimated_species)) * 100) + '%'"></div>
                                </div>
                                <span class="text-token-xs text-muted w-12 text-right tabular-nums" x-text="city.observed_species + ' 種'"></span>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- Monthly Trend Mini Chart (12 months) -->
                <div class="mb-4" x-show="stats?.monthly_trend?.length">
                    <p class="text-token-xs text-muted font-bold uppercase tracking-widest mb-2">📊 月別観察数</p>
                    <div class="flex items-end gap-0.5 h-14">
                        <template x-for="t in (stats?.monthly_trend || [])" :key="t.month">
                            <div class="flex-1 flex flex-col items-center gap-0.5" :title="t.month + ': ' + t.observations + '件'">
                                <div class="w-full rounded-t-sm transition-all duration-500"
                                    :class="t.month === currentMonth ? 'bg-primary' : 'bg-primary-light/40'"
                                    :style="'height:' + Math.max(3, (t.observations / Math.max(...(stats?.monthly_trend||[]).map(x=>x.observations), 1)) * 40) + 'px'">
                                </div>
                                <span class="text-[7px] text-muted" x-text="t.month.split('-')[1] + '月'"></span>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- Top Observers -->
                <div x-show="stats?.top_observers?.length">
                    <p class="text-token-xs text-muted font-bold uppercase tracking-widest mb-2">🏅 探検隊のヒーローたち</p>
                    <div class="flex flex-wrap gap-2">
                        <template x-for="o in (stats?.top_observers || [])" :key="o.rank">
                            <div class="inline-flex items-center gap-1.5 bg-surface/70 border border-border rounded-full px-3 py-1">
                                <span class="text-token-xs" x-text="o.rank <= 3 ? ['🥇','🥈','🥉'][o.rank-1] : '#' + o.rank"></span>
                                <span class="text-xs font-bold text-text" x-text="o.name"></span>
                                <span class="text-token-xs text-muted" x-text="o.observations + '件'"></span>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- Collective Achievement -->
                <div class="mt-4 bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl p-4 text-center">
                    <p class="text-base font-black text-text">
                        🌱 みんなで
                        <span class="text-primary text-xl font-black" x-text="stats?.observed_species || 0"></span>
                        種を探索中！
                    </p>
                    <p class="text-token-xs text-muted mt-1">
                        まだ見ぬ生き物がこの地域にいるかも — 次の発見はキミの手で 🔎
                    </p>
                </div>
            </div>

            <!-- Loading State -->
            <div x-show="!stats && loading" class="bg-primary/5 border border-primary/10 rounded-3xl p-8 text-center">
                <i data-lucide="loader-2" class="w-8 h-8 text-primary animate-spin mx-auto mb-2"></i>
                <p class="text-sm text-muted">探索データを読み込み中...</p>
            </div>
        </section>

        <!-- ==================== FEED SECTION ==================== -->
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-bottom:var(--phi-2xl)">
            <!-- Feed Header & Filter Tabs -->
            <div class="flex flex-col gap-3 mb-6">
                <div class="flex items-baseline justify-between">
                    <h2 class="text-2xl font-black tracking-tight text-text"><?php echo __('home.timeline'); ?></h2>
                    <p class="text-sm text-faint"><?php echo count($latest_obs); ?> <?php echo __('home.updates_suffix'); ?></p>
                </div>
                <div class="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
                    <a href="?filter=all" class="px-4 py-1.5 rounded-full text-sm font-bold transition whitespace-nowrap <?php echo $filter === 'all' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted hover:text-text hover:bg-surface'; ?>">
                        すべて
                    </a>
                    <a href="id_workbench.php" class="px-4 py-1.5 rounded-full text-sm font-bold transition flex items-center gap-1.5 whitespace-nowrap text-muted hover:text-warning hover:bg-warning-surface">
                        <i data-lucide="search-check" class="w-4 h-4"></i>
                        <?php echo __('nav.id_center'); ?>
                    </a>
                    <?php if ($currentUser): ?>
                        <a href="?filter=following" class="px-4 py-1.5 rounded-full text-sm font-bold transition whitespace-nowrap flex items-center gap-1.5 <?php echo $filter === 'following' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-muted hover:text-accent hover:bg-accent/5'; ?>">
                            <i data-lucide="users" class="w-4 h-4"></i>
                            フォロー中
                        </a>
                        <a href="?filter=mine" class="px-4 py-1.5 rounded-full text-sm font-bold transition whitespace-nowrap <?php echo $filter === 'mine' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'text-muted hover:text-secondary hover:bg-secondary/5'; ?>">
                            <?php echo __('nav.profile'); ?>
                        </a>
                    <?php endif; ?>
                </div>
            </div>


            <!-- Regional Completion Meter (Compact) -->
            <div class="mb-4" x-data="regionalCompletion('compact')">
                <?php include __DIR__ . '/components/regional_completion.php'; ?>
            </div>

            <!-- Feed Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style="gap:var(--phi-lg)">
                <?php foreach ($latest_obs as $obs):
                    $obsCounts = DataStore::getCounts('observations', $obs['id']);
                    $obsLikes = $obsCounts['likes'] ?? 0;
                    $obsComments = $obsCounts['comments'] ?? 0;
                ?>
                    <article x-data="{ 
                        stepped: false, 
                        count: <?php echo (int)$obsLikes; ?>, 
                        scale: 1, 
                        lastTap: 0,
                        
                        step(e) { 
                            this.stepped = !this.stepped; 
                            this.count += this.stepped ? 1 : -1; 
                            if (this.stepped) {
                                if (window.SoundManager) SoundManager.play('light-click');
                                if (window.HapticEngine) HapticEngine.tick();
                            }
                            this.scale = 1.2; 
                            setTimeout(() => this.scale = 1, 200); 
                        },
                        
                        doubleTap(e) {
                            const now = Date.now();
                            if (now - this.lastTap < 300) {
                                if (!this.stepped) {
                                    this.step(e); 
                                }
                            }
                            this.lastTap = now;
                        }
                     }"
                        }"
                        class="feed-card feed-card--animated rounded-2xl overflow-hidden transition bg-elevated border border-border shadow-sm">
                        <!-- Feed Header -->
                        <div class="px-4 py-3 flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-surface overflow-hidden">
                                    <?php if (!empty($obs['user_avatar'])): ?>
                                        <img src="<?php echo htmlspecialchars($obs['user_avatar']); ?>" class="w-full h-full object-cover" loading="lazy">
                                    <?php endif; ?>
                                </div>
                                <div>
                                    <p class="text-sm font-bold leading-none text-text"><?php echo htmlspecialchars($obs['user_name'] ?? substr($obs['user_id'], 0, 4)); ?></p>
                                    <p class="text-token-xs text-faint"><?php echo BioUtils::timeAgo($obs['observed_at']); ?> ・ <?php echo htmlspecialchars($obs['location']['name'] ?? '場所不明'); ?></p>
                                </div>
                            </div>
                            <button class="p-2 transition rounded-full text-faint hover:bg-surface">
                                <i data-lucide="more-horizontal" class="w-4 h-4"></i>
                            </button>
                        </div>

                        <!-- Photo -->
                        <div class="aspect-square w-full bg-surface relative group select-none"
                            @click="doubleTap($event)">
                            <img src="<?php echo $obs['photos'][0]; ?>" class="w-full h-full object-cover pointer-events-none" loading="lazy" decoding="async" onload="this.parentElement.classList.remove('lazy-img')">

                            <div x-show="scale > 1"
                                x-transition:enter="transition ease-out duration-200"
                                x-transition:enter-start="opacity-0 scale-0"
                                x-transition:enter-end="opacity-100 scale-150"
                                x-transition:leave="transition ease-in duration-200"
                                x-transition:leave-start="opacity-100 scale-150"
                                x-transition:leave-end="opacity-0 scale-0"
                                class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                <span class="text-8xl drop-shadow-2xl opacity-90">👣</span>
                            </div>

                            <?php if (isset($obs['taxon']['id'])): ?>
                                <?php
                                $feedSlug = $obs['taxon']['slug'] ?? null;
                                $feedSpeciesUrl = $feedSlug
                                    ? 'species/' . urlencode($feedSlug)
                                    : 'species.php?taxon=' . urlencode($obs['taxon']['name']);
                                ?>
                                <a href="<?php echo htmlspecialchars($feedSpeciesUrl); ?>"
                                    class="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md flex items-center gap-2 border border-white/20 hover:bg-black/70 transition z-10">
                                    <i data-lucide="check-circle-2" class="w-3 h-3 text-green-400"></i>
                                    <span class="text-xs font-bold text-white"><?php echo htmlspecialchars($obs['taxon']['name']); ?></span>
                                </a>
                            <?php else: ?>
                                <div class="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md flex items-center gap-2 border border-orange-400/50">
                                    <i data-lucide="help-circle" class="w-3 h-3 text-orange-400"></i>
                                    <span class="text-xs font-bold text-orange-100"><?php echo __('home.identifying'); ?></span>
                                </div>
                            <?php endif; ?>
                        </div>

                        <!-- Actions -->
                        <div class="px-4 py-3 pb-0 flex items-center gap-4">
                            <button @click="step($event)" class="flex items-center gap-1.5 group active:scale-90 transition-transform">
                                <span class="text-xl transition duration-300" :class="stepped ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'">👣</span>
                                <span class="text-xs font-bold text-secondary" x-text="count"></span>
                            </button>
                            <a href="observation_detail.php?id=<?php echo urlencode($obs['id']); ?>" class="flex items-center gap-1.5 group active:scale-90 transition-transform">
                                <i data-lucide="tag" class="w-5 h-5 transition text-faint group-hover:text-secondary"></i>
                                <span class="text-xs font-bold text-secondary"><?php echo (int)$obsComments; ?></span>
                            </a>
                            <div class="flex-1"></div>
                            <!-- 詳しく見るに統合 -->
                        </div>

                        <!-- Caption -->
                        <div class="px-4 py-3">
                            <p class="text-sm text-muted line-clamp-2">
                                <span class="font-bold text-text"><?php echo htmlspecialchars($obs['user_name'] ?? substr($obs['user_id'], 0, 4)); ?></span>
                                <?php echo htmlspecialchars($obs['note'] ?? '記録しました'); ?>
                            </p>
                            <div class="flex items-center justify-between mt-2">
                                <span class="text-token-xs text-faint"><?php echo date('Y.m.d H:i', strtotime($obs['observed_at'] ?? $obs['created_at'] ?? 'now')); ?></span>
                                <a href="observation_detail.php?id=<?php echo urlencode($obs['id']); ?>" class="text-token-xs font-bold transition text-faint hover:text-primary">詳しく見る →</a>
                            </div>
                        </div>
                    </article>
                <?php endforeach; ?>
            </div>

            <!-- End of Feed -->
            <div class="py-12 text-center text-faint text-xs">
                <?php if (empty($latest_obs)): ?>
                    <div class="py-8">
                        <i data-lucide="leaf" class="w-12 h-12 mx-auto mb-4 text-primary-surface"></i>
                        <p class="text-sm font-bold mb-1 text-muted">最初の記録者になりませんか？</p>
                        <p class="text-xs text-faint">このエリアにはまだ記録がありません。あなたの記録が、最初の一歩です 🌱</p>
                        <a href="post.php" class="btn-primary inline-flex items-center gap-2 mt-4 px-6 py-2.5 text-sm active:scale-95 transition">
                            <i data-lucide="camera" class="w-4 h-4"></i> 記録する
                        </a>
                    </div>
                <?php else: ?>
                    <p>ここまで見てくれてありがとうございます 🙌</p>
                    <i data-lucide="check" class="w-4 h-4 mx-auto mt-2 opacity-50"></i>
                <?php endif; ?>
            </div>
        </section>

        <!-- ==================== 季節の生き物 ==================== -->
        <?php
        $month = (int)date('n');
        if ($month >= 3 && $month <= 5) {
            $season = '春';
            $emoji = '🌸';
            $creatures = [
                ['name' => 'ウグイス', 'latin' => 'Horornis diphone', 'hint' => '声を頼りに探そう', 'icon' => '🐦'],
                ['name' => 'モンシロチョウ', 'latin' => 'Pieris rapae', 'hint' => '菜の花畑に', 'icon' => '🦋'],
                ['name' => 'アオダイショウ', 'latin' => 'Elaphe climacophora', 'hint' => '日向ぼっこ中かも', 'icon' => '🐍'],
                ['name' => 'フキノトウ', 'latin' => 'Petasites japonicus', 'hint' => '早春の味覚', 'icon' => '🌿'],
            ];
        } elseif ($month >= 6 && $month <= 8) {
            $season = '夏';
            $emoji = '☀️';
            $creatures = [
                ['name' => 'カブトムシ', 'latin' => 'Trypoxylus dichotomus', 'hint' => '夜の樹液に集合', 'icon' => '🪲'],
                ['name' => 'オニヤンマ', 'latin' => 'Anotogaster sieboldii', 'hint' => '最大最速のトンボ', 'icon' => '🔵'],
                ['name' => 'アブラゼミ', 'latin' => 'Graptopsaltria nigrofuscata', 'hint' => 'ミーンミンミン', 'icon' => '🦗'],
                ['name' => 'ヒマワリ', 'latin' => 'Helianthus annuus', 'hint' => '太陽を追う花', 'icon' => '🌻'],
            ];
        } elseif ($month >= 9 && $month <= 11) {
            $season = '秋';
            $emoji = '🍂';
            $creatures = [
                ['name' => 'アキアカネ', 'latin' => 'Sympetrum frequens', 'hint' => '赤トンボの季節', 'icon' => '🔴'],
                ['name' => 'モズ', 'latin' => 'Lanius bucephalus', 'hint' => 'はやにえを探して', 'icon' => '🐦'],
                ['name' => 'ジョロウグモ', 'latin' => 'Trichonephila clavata', 'hint' => '大きな巣に注目', 'icon' => '🕷️'],
                ['name' => 'キンモクセイ', 'latin' => 'Osmanthus fragrans', 'hint' => '香りで気づく', 'icon' => '🌳'],
            ];
        } else {
            $season = '冬';
            $emoji = '❄️';
            $creatures = [
                ['name' => 'ジョウビタキ', 'latin' => 'Phoenicurus auroreus', 'hint' => '冬の使者', 'icon' => '🐦'],
                ['name' => 'ツグミ', 'latin' => 'Turdus eunomus', 'hint' => '地面を歩く鳥', 'icon' => '🐤'],
                ['name' => 'カワセミ', 'latin' => 'Alcedo atthis', 'hint' => '水辺の宝石', 'icon' => '💎'],
                ['name' => 'スイセン', 'latin' => 'Narcissus', 'hint' => '冬の花壇に', 'icon' => '🌼'],
            ];
        }
        ?>
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-bottom:var(--phi-xl)">
            <div class="rounded-2xl bg-gradient-to-br from-accent-surface to-orange-50 border border-amber-500/25" style="padding:var(--phi-lg)">
                <h2 class="text-sm font-black flex items-center gap-2 text-accent-dark" style="margin-bottom:var(--phi-md)">
                    <?= $emoji ?> 今の季節（<?= $season ?>）に会える生き物
                </h2>
                <div class="grid grid-cols-2 md:grid-cols-4" style="gap:var(--phi-sm)">
                    <?php foreach ($creatures as $c): ?>
                        <a href="explore.php?q=<?= urlencode($c['name']) ?>" class="rounded-xl text-center transition group bg-white/80 hover:bg-white hover:shadow-md" style="padding:var(--phi-sm)">
                            <span class="text-2xl block mb-1"><?= $c['icon'] ?></span>
                            <p class="text-sm font-black transition text-text"><?= $c['name'] ?></p>
                            <p class="text-token-xs italic text-muted"><?= $c['latin'] ?></p>
                            <p class="text-token-xs mt-0.5 text-faint"><?= $c['hint'] ?></p>
                        </a>
                    <?php endforeach; ?>
                </div>
            </div>
        </section>

        <!-- ==================== 数字で見る ikimon ==================== -->
        <?php
        $allObs = DataStore::fetchAll('observations');
        $totalObservations = count($allObs);
        $speciesSet = [];
        $rgCount = 0;
        foreach ($allObs as $o) {
            if (!empty($o['taxon']['name'])) $speciesSet[$o['taxon']['name']] = true;
            if (($o['status'] ?? '') === 'Research Grade') $rgCount++;
        }
        $totalSpecies = count($speciesSet);
        $rgRate = $totalObservations > 0 ? round($rgCount / $totalObservations * 100) : 0;
        $totalUsers = count(DataStore::fetchAll('users'));
        ?>
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-bottom:var(--phi-xl)">
            <div class="bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/10 rounded-3xl" style="padding:var(--phi-xl) var(--phi-lg)">
                <h2 class="font-black text-text text-center" style="font-size:var(--text-lg);margin-bottom:var(--phi-md)">数字で見る ikimon</h2>
                <div class="grid grid-cols-2 md:grid-cols-4" style="gap:var(--phi-md)">
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black text-primary" style="font-size:var(--text-xl)"><?= number_format($totalObservations) ?></p>
                        <p class="text-token-xs text-muted mt-1">観察記録</p>
                    </div>
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black text-secondary" style="font-size:var(--text-xl)"><?= number_format($totalSpecies) ?></p>
                        <p class="text-token-xs text-muted mt-1">確認された種</p>
                    </div>
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black text-accent" style="font-size:var(--text-xl)"><?= $rgRate ?>%</p>
                        <p class="text-token-xs text-muted mt-1">Research Grade</p>
                    </div>
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black" style="font-size:var(--text-xl);color:var(--color-secondary)"><?= number_format($totalUsers) ?></p>
                        <p class="text-token-xs text-muted mt-1">参加者</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- B2B/G Section (Rich) -->
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-bottom:var(--phi-2xl)">
            <div class="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-3xl" style="padding:var(--phi-xl) var(--phi-lg)">
                <h2 class="font-black text-text text-center" style="font-size:var(--text-lg);margin-bottom:var(--phi-sm)">🏢 導入をご検討の方へ</h2>
                <p class="text-token-sm text-muted text-center" style="margin-bottom:var(--phi-lg)">ikimonは企業CSR・自治体の生物多様性政策にも活用されています</p>
                <div class="grid grid-cols-1 md:grid-cols-2" style="gap:var(--phi-sm)">
                    <a href="for-business.php" class="bg-white rounded-2xl border border-slate-100 hover:shadow-lg hover:border-blue-200 transition group" style="padding:var(--phi-md)">
                        <div class="flex items-center mb-3" style="gap:var(--phi-sm)">
                            <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                <i data-lucide="building-2" class="w-5 h-5 text-blue-600"></i>
                            </div>
                            <div>
                                <p class="font-black text-text" style="font-size:var(--text-base)">企業の方</p>
                                <p class="text-token-xs text-muted">CSR / ESG / TNFD 対応</p>
                            </div>
                        </div>
                        <ul class="space-y-1.5 text-xs text-muted">
                            <li class="flex items-start gap-1.5"><span class="text-blue-500 mt-0.5">✓</span> 自社エリアの生物多様性レポート生成</li>
                            <li class="flex items-start gap-1.5"><span class="text-blue-500 mt-0.5">✓</span> 社員参加型の観察会でCSR×チームビルディング</li>
                            <li class="flex items-start gap-1.5"><span class="text-blue-500 mt-0.5">✓</span> 健康経営としての散歩プログラム</li>
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
                                <p class="font-black text-text" style="font-size:var(--text-base)">自治体・教育機関の方</p>
                                <p class="text-token-xs text-muted">30by30 / 関係人口 / 環境教育</p>
                            </div>
                        </div>
                        <ul class="space-y-1.5 text-xs text-muted">
                            <li class="flex items-start gap-1.5"><span class="text-emerald-500 mt-0.5">✓</span> 市民参加で広域モニタリング → コスト削減</li>
                            <li class="flex items-start gap-1.5"><span class="text-emerald-500 mt-0.5">✓</span> 「自然が豊かな地域」のエビデンス → 移住促進</li>
                            <li class="flex items-start gap-1.5"><span class="text-emerald-500 mt-0.5">✓</span> 環境教育プログラムとして学校連携</li>
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

        // 探索マップ (Exploration Map) — 新API駆動 + 位置情報自動選択 + 市区町村ドリルダウン
        function explorationMap() {
            const STORAGE_KEY = 'ikimon_region';
            return {
                stats: null,
                loading: false,
                regionIndex: [],
                cities: [],
                municipalities: [],
                selectedRegion: '',
                selectedCity: '',
                selectedMunicipality: '',
                currentMonth: new Date().toISOString().slice(0, 7),

                async init() {
                    this.loading = true;
                    await this.loadRegionIndex();
                    await this.resolveDefaultCity();
                    this.checkSubRegion();
                    await this.loadStats();
                    this.loading = false;
                },

                async loadRegionIndex() {
                    try {
                        const res = await fetch('api/region_list.php');
                        const result = await res.json();
                        if (result.success && result.data.regions?.length) {
                            this.regionIndex = result.data.regions;
                        }
                    } catch (e) {
                        console.error('Region index error:', e);
                    }
                },

                // 3段階フォールバック: ① localStorage → ② Geolocation → ③ 先頭
                async resolveDefaultCity() {
                    const jp = this.regionIndex.find(r => r.id === 'jp');
                    if (!jp) {
                        const first = this.regionIndex[0];
                        if (!first) return;
                        this.selectedRegion = first.id;
                        this.cities = first.cities || [];
                        this.selectedCity = this.cities[0]?.id || '';
                        return;
                    }

                    this.selectedRegion = 'jp';
                    this.cities = jp.cities || [];

                    // ① localStorage
                    try {
                        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
                        if (saved?.city && this.cities.some(c => c.id === saved.city)) {
                            this.selectedCity = saved.city;
                            if (saved.municipality) this.selectedMunicipality = saved.municipality;
                            return;
                        }
                    } catch (_) {}

                    // ② Geolocation
                    try {
                        const pos = await this.getPosition(5000);
                        const matched = this.findByCoords(pos.coords.latitude, pos.coords.longitude);
                        if (matched) {
                            this.selectedCity = matched;
                            this.persist();
                            return;
                        }
                    } catch (_) {}

                    // ③ 先頭
                    this.selectedCity = this.cities[0]?.id || '';
                },

                checkSubRegion() {
                    const subId = 'jp_' + this.selectedCity;
                    const sub = this.regionIndex.find(r => r.id === subId);
                    if (sub && sub.cities?.length) {
                        this.municipalities = sub.cities;
                        if (!this.selectedMunicipality || !this.municipalities.some(m => m.id === this.selectedMunicipality)) {
                            this.selectedMunicipality = this.municipalities[0]?.id || '';
                        }
                    } else {
                        this.municipalities = [];
                        this.selectedMunicipality = '';
                    }
                },

                getPosition(timeout) {
                    return new Promise((resolve, reject) => {
                        if (!navigator.geolocation) return reject('no geolocation');
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: false,
                            timeout: timeout,
                            maximumAge: 600000
                        });
                    });
                },

                findByCoords(lat, lng) {
                    for (const c of this.cities) {
                        if (!c.bbox) continue;
                        const [s, w, n, e] = c.bbox;
                        if (lat >= s && lat <= n && lng >= w && lng <= e) return c.id;
                    }
                    return null;
                },

                persist() {
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify({
                            region: this.selectedRegion,
                            city: this.selectedCity,
                            municipality: this.selectedMunicipality || undefined
                        }));
                    } catch (_) {}
                },

                onCityChange() {
                    this.selectedMunicipality = '';
                    this.checkSubRegion();
                    this.persist();
                    this.loadStats();
                },

                onMunicipalityChange() {
                    this.persist();
                    this.loadStats();
                },

                // 新 Exploration Stats API を呼ぶ
                async loadStats() {
                    let region = 'jp_' + this.selectedCity;
                    let cityParam = '';

                    // 市区町村が選択されていればcityパラメータを付与
                    if (this.municipalities.length && this.selectedMunicipality) {
                        cityParam = this.selectedMunicipality;
                    }

                    if (!this.selectedCity) return;

                    try {
                        let url = `api/get_exploration_stats.php?region=${encodeURIComponent(region)}`;
                        if (cityParam) url += `&city=${encodeURIComponent(cityParam)}`;

                        const res = await fetch(url);
                        const data = await res.json();
                        if (!data.error) {
                            this.stats = data;
                            // lucide アイコン再レンダリング（動的要素用）
                            this.$nextTick(() => {
                                if (window.lucide) lucide.createIcons();
                            });
                        }
                    } catch (e) {
                        console.error('Exploration stats error:', e);
                    }
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