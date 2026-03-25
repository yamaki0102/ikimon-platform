<?php
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
// QuestManager moved to dashboard
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/PrivacyFilter.php';
require_once __DIR__ . '/../libs/FollowManager.php';
require_once __DIR__ . '/../libs/ThumbnailGenerator.php';

Auth::init();
$currentUser = Auth::user();

// Fetch Data for Feed with Filters
$filter = $_GET['filter'] ?? 'all';
$followedUserIds = ($currentUser && $filter === 'following') ? FollowManager::getFollowedUserIds($currentUser['id']) : [];
$latest_obs = DataStore::getLatest('observations', 30, function ($item) use ($filter, $currentUser, $followedUserIds) {
    // Exclude test/E2E users, guest users
    $userName = $item['user_name'] ?? '';
    if (strpos($userName, 'E2E_') === 0) return false;
    if (preg_match('/^gues$/i', $userName)) return false;
    if (preg_match('/^Guest$/i', $userName)) return false;
    if (empty($userName)) return false;

    // 写真付き観察 OR セッションサマリー（ウォーク/スキャン）を許可
    // 個別検出(walk, live-scan, passive)はフィードには表示しない（サマリーでまとめて表示）
    $isSummary = in_array($item['observation_source'] ?? $item['source'] ?? '', ['live-scan-summary', 'walk-summary']);
    $isIndividualDetection = in_array($item['observation_source'] ?? $item['source'] ?? '', ['walk', 'live-scan', 'passive']);
    if ($isIndividualDetection) return false;
    if (!$isSummary) {
        $photo = $item['photos'][0] ?? '';
        if (empty($photo) || strpos($photo, 'sample_') !== false) return false;
        if (!preg_match('/^uploads\//', $photo)) return false;
    }

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
usort($latest_obs, function ($a, $b) {
    return strtotime($b['created_at'] ?? $b['observed_at'] ?? '0')
         - strtotime($a['created_at'] ?? $a['observed_at'] ?? '0');
});

$feedManual = [];
$feedWalk = [];
$feedScan = [];
foreach ($latest_obs as $o) {
    $src = $o['observation_source'] ?? $o['source'] ?? '';
    if ($src === 'walk-summary') {
        $feedWalk[] = $o;
    } elseif ($src === 'live-scan-summary') {
        $feedScan[] = $o;
    } else {
        $feedManual[] = $o;
    }
}
$feedManual = array_slice($feedManual, 0, 6);
$feedWalk = array_slice($feedWalk, 0, 4);
$feedScan = array_slice($feedScan, 0, 4);
$latest_obs = array_slice($latest_obs, 0, 6);

// Stats for hero
$allObs = DataStore::fetchAll('observations');
$totalObs = count($allObs);
$uniqueSpecies = count(array_unique(array_filter(array_map(function ($o) {
    $name = $o['taxon']['name'] ?? '';
    if (!$name || $name === '未同定') return null;
    return $o['taxon']['key'] ?? $o['taxon']['scientific_name'] ?? $name;
}, $allObs))));
unset($allObs);

// Community Session Stats (all users)
$communityWalkStats = ['count' => 0, 'duration_min' => 0, 'species' => [], 'total_detections' => 0, 'users' => []];
$communityScanStats = ['count' => 0, 'duration_min' => 0, 'species' => [], 'total_detections' => 0, 'users' => []];
$allSessions = DataStore::fetchAll('passive_sessions');
foreach ($allSessions as $s) {
    $mode = $s['session_meta']['scan_mode'] ?? '';
    $summary = $s['summary'] ?? [];
    if ($mode !== 'walk' && $mode !== 'live-scan') continue;
    $durSec = (int)($summary['duration_sec'] ?? 0);
    $detections = (int)($summary['total_detections'] ?? 0);
    if ($durSec < 30 || $detections < 1) continue;
    $bucket = ($mode === 'walk') ? 'walk' : 'scan';
    if ($bucket === 'walk') {
        $communityWalkStats['count']++;
        $communityWalkStats['duration_min'] += (int)round($durSec / 60);
        $communityWalkStats['total_detections'] += $detections;
        foreach ($summary['species'] ?? [] as $name => $cnt) { if ($name) $communityWalkStats['species'][$name] = true; }
        $uid = $s['user_id'] ?? '';
        if ($uid) $communityWalkStats['users'][$uid] = true;
    } else {
        $communityScanStats['count']++;
        $communityScanStats['duration_min'] += (int)round($durSec / 60);
        $communityScanStats['total_detections'] += $detections;
        foreach ($summary['species'] ?? [] as $name => $cnt) { if ($name) $communityScanStats['species'][$name] = true; }
        $uid = $s['user_id'] ?? '';
        if ($uid) $communityScanStats['users'][$uid] = true;
    }
}
unset($allSessions);
foreach ([&$communityWalkStats, &$communityScanStats] as &$stats) {
    $stats['unique_species'] = count($stats['species']);
    $stats['unique_users'] = count($stats['users']);
    unset($stats['species'], $stats['users']);
}
unset($stats);

// Latest walk summaries (max 5)
$latestWalkSummaries = DataStore::getLatest('observations', 5, function ($item) {
    return ($item['observation_source'] ?? '') === 'walk-summary';
});

// Latest scan summaries (max 5)
$latestScans = DataStore::getLatest('observations', 5, function ($item) {
    return ($item['observation_source'] ?? '') === 'live-scan-summary';
});
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <title>ikimon.life — 散歩×生きもの観察で自然を守りながら健康に</title>
    <meta name="description" content="スマホで写真を撮って、名前を調べて、地図に記録。小学生から大人まで、だれでも参加できる生きもの観察プラットフォームです。">

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
                    <a href="livemap.php" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-xs font-bold hover:bg-white/20 transition">
                        <i data-lucide="globe" class="w-3.5 h-3.5"></i> ライブマップ
                    </a>
                    <a href="compass.php" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-xs font-bold hover:bg-white/20 transition">
                        <i data-lucide="trophy" class="w-3.5 h-3.5"></i> コンパス
                    </a>
                    <a href="events.php" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-xs font-bold hover:bg-white/20 transition">
                        <i data-lucide="calendar" class="w-3.5 h-3.5"></i> 観察会
                    </a>
                    <a href="field_research.php" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 text-xs font-bold hover:bg-emerald-500/30 transition">
                        <i data-lucide="search" class="w-3.5 h-3.5"></i> いきものサーチ
                    </a>

                </div>
            </div>
        </section>

        <!-- Daily Quest & Survey Panel → moved to dashboard.php -->

        <!-- ==================== 学習ヒントカード (ログインユーザーのみ) ==================== -->
        <?php if ($currentUser): ?>
        <section class="max-w-5xl mx-auto px-4 md:px-6 mt-3 mb-4" x-data="learningHint()" x-init="load()" x-cloak>
            <template x-if="hint">
                <div class="bg-sky-50 border border-sky-200 rounded-2xl p-4">
                    <div class="flex items-start gap-3">
                        <!-- 写真サムネ -->
                        <a :href="'observation_detail.php?id=' + hint.obs_id" class="shrink-0">
                            <img :src="hint.photo_url" alt="" class="w-14 h-14 rounded-xl object-cover border border-sky-200" loading="lazy">
                        </a>
                        <div class="flex-1 min-w-0">
                            <p class="text-[10px] font-black text-sky-700 uppercase tracking-widest mb-1">次にここを見ると、もっと深く分かるよ</p>
                            <p x-show="hint.taxon_name" class="text-xs font-bold text-sky-900 mb-1" x-text="hint.taxon_name"></p>
                            <p class="text-xs text-sky-800 leading-relaxed line-clamp-2" x-text="hint.next_action"></p>
                            <a :href="'observation_detail.php?id=' + hint.obs_id"
                               @click="if(window.ikimonAnalytics) ikimonAnalytics.track('learning_hint_click', {obs_id: hint.obs_id})"
                               class="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 mt-1.5 hover:underline">
                                考察を読む <i data-lucide="arrow-right" class="w-3 h-3"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </template>
        </section>
        <script nonce="<?= CspNonce::attr() ?>">
            function learningHint() {
                return {
                    hint: null,
                    async load() {
                        try {
                            const res = await fetch('api/get_learning_hint.php');
                            const data = await res.json();
                            if (data.success && data.hint && data.hint.next_action) {
                                this.hint = data.hint;
                                this.$nextTick(() => lucide.createIcons());
                            }
                        } catch (e) {
                            console.warn('[LearningHint] Failed:', e);
                        }
                    }
                };
            }
        </script>
        <?php endif; ?>

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
                        <a href="?filter=following" role="tab" aria-selected="<?php echo $filter === 'following' ? 'true' : 'false'; ?>" class="px-4 py-1.5 rounded-full text-sm font-bold transition whitespace-nowrap flex items-center gap-1.5 <?php echo $filter === 'following' ? 'bg-accent/10 border border-accent/20' : 'text-muted hover:text-accent hover:bg-accent/5'; ?>" <?php if ($filter === 'following') echo 'style="color:#92400e"'; ?>>
                            <i data-lucide="users" class="w-4 h-4"></i>
                            フォロー中
                        </a>
                        <a href="?filter=mine" role="tab" aria-selected="<?php echo $filter === 'mine' ? 'true' : 'false'; ?>" class="px-4 py-1.5 rounded-full text-sm font-bold transition whitespace-nowrap <?php echo $filter === 'mine' ? 'bg-secondary/10 border border-secondary/20' : 'text-muted hover:text-secondary hover:bg-secondary/5'; ?>" <?php if ($filter === 'mine') echo 'style="color:#0369a1"'; ?>>
                            <?php echo __('nav.profile'); ?>
                        </a>
                    <?php endif; ?>
                </div>
            </div>


            <!-- Regional Completion Meter (Compact) -->
            <div class="mb-4" x-data="regionalCompletion('compact')">
                <?php include __DIR__ . '/components/regional_completion.php'; ?>
            </div>

            <!-- さんぽ CTA -->
            <?php if ($currentUser): ?>
            <div class="mb-4 rounded-2xl overflow-hidden border border-emerald-200 dark:border-emerald-800" style="background:linear-gradient(135deg,rgba(16,185,129,0.06),rgba(34,197,94,0.03));">
                <a href="field_research.php" class="flex items-center gap-4 px-4 py-3" style="text-decoration:none;">
                    <div class="text-3xl flex-shrink-0">🌿</div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-[var(--color-text)]">今日のいきものサーチを始めよう</p>
                        <p class="text-xs text-[var(--color-text-muted)]">歩いて、見つけて、自動記録。あなたの発見が100年アーカイブに。</p>
                    </div>
                    <i data-lucide="chevron-right" class="w-5 h-5 text-emerald-500 flex-shrink-0"></i>
                </a>
            </div>
            <?php endif; ?>

            <!-- Feed Grid: 観察投稿が主役 -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style="gap:var(--phi-lg)">
                <?php foreach ((!empty($feedManual) ? $feedManual : $latest_obs) as $obs):
                    $obsIdCount = count($obs['identifications'] ?? []);
                    // Check if current user already reacted
                    $_feedLikeFile = DATA_DIR . '/likes/' . $obs['id'] . '.json';
                    $_feedLikeRaw = file_exists($_feedLikeFile) ? json_decode(file_get_contents($_feedLikeFile), true) : [];
                    if (isset($_feedLikeRaw[0]) && is_string($_feedLikeRaw[0])) {
                        $_feedLikeUsers = $_feedLikeRaw;
                        $_feedReactions = [];
                        foreach ($_feedLikeUsers as $_u) $_feedReactions[$_u] = 'like';
                        $_feedLikeRaw = ['users' => $_feedLikeUsers, 'reactions' => $_feedReactions];
                    }
                    $_feedUsers = $_feedLikeRaw['users'] ?? [];
                    $_feedReactions = $_feedLikeRaw['reactions'] ?? [];
                    $_feedCount = count($_feedUsers);
                    $_feedMyReaction = ($currentUser && in_array($currentUser['id'], $_feedUsers, true))
                        ? ($_feedReactions[$currentUser['id']] ?? 'like') : null;
                ?>
                    <article x-data="feedCard('<?php echo htmlspecialchars($obs['id'], ENT_QUOTES); ?>', <?php echo (int)$_feedCount; ?>, <?php echo $_feedMyReaction ? "'" . htmlspecialchars($_feedMyReaction, ENT_QUOTES) . "'" : 'null'; ?>)"
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
                                    <?php
                                        $feedLocation = $obs['municipality'] ?? $obs['location']['name'] ?? '';
                                        $feedDetCount = $obs['detection_count'] ?? null;
                                    ?>
                                    <p class="text-token-xs text-muted">
                                        <?= BioUtils::timeAgo($obs['observed_at']) ?>
                                        <?php if ($feedLocation): ?>
                                            ・ <?= htmlspecialchars($feedLocation) ?>
                                        <?php endif; ?>
                                        <?php if ($feedDetCount && $feedDetCount > 1): ?>
                                            <span class="text-emerald-600 font-bold">· <?= (int)$feedDetCount ?>回検出</span>
                                        <?php endif; ?>
                                    </p>
                                </div>
                            </div>
                            <div class="relative" x-data="{ menuOpen: false }" @click.outside="menuOpen = false">
                                <button @click="menuOpen = !menuOpen" class="p-2 transition rounded-full text-faint hover:bg-surface">
                                    <i data-lucide="more-horizontal" class="w-4 h-4"></i>
                                </button>
                                <div x-show="menuOpen" x-transition:enter="transition ease-out duration-150" x-transition:enter-start="opacity-0 scale-95" x-transition:enter-end="opacity-100 scale-100" x-transition:leave="transition ease-in duration-100" x-transition:leave-start="opacity-100 scale-100" x-transition:leave-end="opacity-0 scale-95"
                                    class="absolute right-0 top-full mt-1 w-44 bg-elevated rounded-xl shadow-lg border border-border z-50 py-1 overflow-hidden" x-cloak>
                                    <button @click="navigator.clipboard.writeText(location.origin + '/observation_detail.php?id=<?= urlencode($obs['id']) ?>'); menuOpen = false; if(window.ToastManager) ToastManager.show('リンクをコピーしました','success');"
                                        class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface transition text-left">
                                        <i data-lucide="link" class="w-4 h-4 text-muted"></i>リンクをコピー
                                    </button>
                                    <button @click="if(navigator.share) navigator.share({title:'<?= htmlspecialchars(BioUtils::displayName($obs) ?: '観察記録', ENT_QUOTES) ?>',url:location.origin+'/observation_detail.php?id=<?= urlencode($obs['id']) ?>'}); menuOpen = false;"
                                        class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface transition text-left">
                                        <i data-lucide="share-2" class="w-4 h-4 text-muted"></i>共有する
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Photo / Activity Card -->
                        <?php
                            $feedPhoto = $obs['photos'][0] ?? null;
                            $feedHasImage = $feedPhoto && ThumbnailGenerator::exists($feedPhoto, 'md');
                            $feedImg = $feedHasImage ? ThumbnailGenerator::resolve($feedPhoto, 'md') : null;
                            $feedImgSm = $feedHasImage ? ThumbnailGenerator::resolve($feedPhoto, 'sm') : null;
                            $isScanSummary = in_array($obs['observation_source'] ?? '', ['live-scan-summary', 'walk-summary']);
                            $isWalkSummary = ($obs['observation_source'] ?? '') === 'walk-summary';
                            $isAudioDet = in_array($obs['observation_source'] ?? $obs['source'] ?? '', ['walk', 'passive']);
                        ?>
                        <div class="<?= $isScanSummary ? 'w-full min-h-[160px]' : ($isAudioDet && !$feedHasImage ? 'w-full aspect-[4/3]' : 'aspect-square w-full') ?> bg-surface relative group select-none"
                            @click="doubleTap($event)">
                            <?php if ($feedHasImage): ?>
                                <img src="<?php echo htmlspecialchars($feedImg); ?>"
                                     srcset="<?php echo htmlspecialchars($feedImgSm); ?> 320w, <?php echo htmlspecialchars($feedImg); ?> 640w, <?php echo htmlspecialchars($feedPhoto); ?> 1280w"
                                     sizes="(max-width: 640px) 100vw, 640px"
                                     alt="<?php echo htmlspecialchars($obs['taxon']['name'] ?? $obs['species_name'] ?? '観察写真'); ?>"
                                     class="w-full h-full object-cover pointer-events-none"
                                     loading="lazy" decoding="async"
                                     onload="this.parentElement.classList.remove('lazy-img')">
                            <?php elseif ($isScanSummary): ?>
                                <?php
                                    $ss = $obs['scan_summary'] ?? [];
                                    $dur = $ss['duration_min'] ?? 0;
                                    $spCount = $ss['species_count'] ?? 0;
                                    $topSp = $ss['top_species'] ?? [];
                                    $envDesc = $ss['environment']['description'] ?? '';
                                ?>
                                <div class="flex flex-col gap-3 bg-gradient-to-br <?= $isWalkSummary ? 'from-emerald-900/90 to-teal-900/90' : 'from-blue-900/90 to-purple-900/90' ?> p-5">
                                    <!-- ヘッダー -->
                                    <div class="flex items-center gap-3">
                                        <span class="text-3xl"><?= $isWalkSummary ? '🚶' : '📡' ?></span>
                                        <div>
                                            <div class="text-white font-bold"><?= $isWalkSummary ? 'ウォーク' : 'ライブスキャン' ?> <?= $dur ?>分間</div>
                                            <div class="flex gap-2 text-xs mt-1 flex-wrap">
                                                <span class="px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full"><?= $spCount ?>種検出</span>
                                                <?php if ($isWalkSummary): ?>
                                                    <span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full">🐦 <?= $ss['audio_detections'] ?? 0 ?></span>
                                                    <?php if (($ss['distance_m'] ?? 0) > 0): ?>
                                                    <span class="px-2 py-0.5 bg-teal-500/20 text-teal-300 rounded-full">📏 <?= round(($ss['distance_m'] ?? 0) / 1000, 1) ?>km</span>
                                                    <?php endif; ?>
                                                <?php else: ?>
                                                    <span class="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full">🐦 <?= $ss['audio_detections'] ?? 0 ?></span>
                                                    <span class="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">📷 <?= $ss['visual_detections'] ?? 0 ?></span>
                                                <?php endif; ?>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- 検出された種 -->
                                    <?php if (!empty($topSp)): ?>
                                    <div class="flex flex-wrap gap-1.5">
                                        <?php foreach (array_slice($topSp, 0, 6) as $sp): ?>
                                        <span class="text-xs px-2.5 py-1 bg-white/10 text-gray-200 rounded-full"><?= htmlspecialchars($sp['name'] ?? '') ?></span>
                                        <?php endforeach; ?>
                                        <?php if (count($topSp) > 6): ?>
                                        <span class="text-xs px-2.5 py-1 text-gray-400">+<?= count($topSp) - 6 ?></span>
                                        <?php endif; ?>
                                    </div>
                                    <?php endif; ?>
                                    <!-- 環境 -->
                                    <?php if ($envDesc): ?>
                                    <div class="text-xs text-gray-300 bg-white/5 rounded-lg px-3 py-2">🌳 <?= htmlspecialchars($envDesc) ?></div>
                                    <?php endif; ?>
                                    <div class="flex items-center gap-1.5 pt-1">
                                        <i data-lucide="database" class="w-3 h-3 text-blue-400/70"></i>
                                        <span class="text-[10px] text-blue-300/70">地域の生物多様性データベースに反映済み</span>
                                    </div>
                                </div>
                            <?php elseif (in_array($obs['observation_source'] ?? $obs['source'] ?? '', ['walk', 'live-scan', 'passive'])): ?>
                                <?php
                                    $detType = $obs['detection_type'] ?? 'audio';
                                    $detConf = round(($obs['detection_confidence'] ?? 0) * 100);
                                    $detModel = $obs['detection_model'] ?? '';
                                    $detIcon = $detType === 'audio' ? '🐦' : '🌿';
                                    $modeLabel = match($obs['observation_source'] ?? $obs['source'] ?? '') {
                                        'walk' => '🚶 ウォーク',
                                        'live-scan' => '📡 ライブスキャン',
                                        default => '📡 パッシブ',
                                    };
                                ?>
                                <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-900/80 to-blue-900/80">
                                    <div class="text-5xl"><?= $detIcon ?></div>
                                    <div class="text-white font-bold text-sm"><?= htmlspecialchars(BioUtils::displayName($obs) ?: '音声検出') ?></div>
                                    <div class="text-xs text-gray-300">
                                        <?= $modeLabel ?> · AI <?= $detConf ?>%
                                        <?php $audioDetCount = $obs['detection_count'] ?? 0; ?>
                                        <?php if ($audioDetCount > 1): ?>
                                            · <span class="text-emerald-300 font-bold"><?= (int)$audioDetCount ?>回検出</span>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            <?php else: ?>
                                <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface text-muted">
                                    <i data-lucide="image-off" class="w-8 h-8 text-faint"></i>
                                    <span class="text-sm font-medium">画像準備中</span>
                                </div>
                            <?php endif; ?>

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

                            <?php
                                $feedIsAudioSource = in_array($obs['observation_source'] ?? $obs['source'] ?? '', ['live-scan-summary', 'walk-summary']);
                            ?>
                            <?php if ($feedIsAudioSource): ?>
                                <?php
                                    $feedDetName = BioUtils::displayName($obs) ?: null;
                                    $feedDetConf = round(($obs['detection_confidence'] ?? 0) * 100);
                                    $feedDetSource = match($obs['observation_source'] ?? $obs['source'] ?? '') {
                                        'walk-summary' => 'ウォーク',
                                        'live-scan-summary' => 'スキャン',
                                        default => 'スキャン',
                                    };
                                ?>
                                <?php if ($feedDetName): ?>
                                    <a href="observation_detail.php?id=<?= urlencode($obs['id']) ?>"
                                        class="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-emerald-900/60 backdrop-blur-md flex items-center gap-2 border border-emerald-400/30 hover:bg-emerald-900/80 transition z-10">
                                        <i data-lucide="audio-lines" class="w-3 h-3 text-emerald-300"></i>
                                        <span class="text-xs font-bold text-emerald-100"><?= htmlspecialchars($feedDetName) ?></span>
                                        <span class="text-[10px] text-emerald-200/60"><?= $feedDetSource ?></span>
                                    </a>
                                <?php else: ?>
                                    <div class="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-emerald-900/40 backdrop-blur-md flex items-center gap-2 border border-emerald-400/20">
                                        <i data-lucide="audio-lines" class="w-3 h-3 text-emerald-300/60"></i>
                                        <span class="text-xs text-emerald-100/60">音声検出</span>
                                    </div>
                                <?php endif; ?>
                            <?php elseif (isset($obs['taxon']['id'])): ?>
                                <?php
                                $feedSlug = $obs['taxon']['slug'] ?? null;
                                $feedSpeciesUrl = $feedSlug
                                    ? 'species/' . urlencode($feedSlug)
                                    : 'species.php?taxon=' . urlencode($obs['taxon']['name']);
                                ?>
                                <a href="<?php echo htmlspecialchars($feedSpeciesUrl); ?>"
                                    class="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md flex items-center gap-2 border border-white/20 hover:bg-black/70 transition z-10">
                                    <i data-lucide="check-circle-2" class="w-3 h-3 text-green-400"></i>
                                    <span class="text-xs font-bold text-white"><?php echo htmlspecialchars(BioUtils::resolveJaName($obs['taxon']['name'])); ?></span>
                                </a>
                            <?php else: ?>
                                <?php
                                    $feedLatestId = null;
                                    $feedIds = $obs['identifications'] ?? [];
                                    if (!empty($feedIds)) {
                                        $feedLatestId = end($feedIds);
                                    }
                                    $feedAiName = null;
                                    $feedAiAssessments = $obs['ai_assessments'] ?? [];
                                    if (!empty($feedAiAssessments)) {
                                        $feedLatestAi = end($feedAiAssessments);
                                        $feedAiName = $feedLatestAi['recommended_taxon']['name'] ?? null;
                                    }
                                ?>
                                <?php if ($feedLatestId && !empty($feedLatestId['taxon_name'])): ?>
                                    <a href="observation_detail.php?id=<?= urlencode($obs['id']) ?>#identifications"
                                        class="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-amber-900/60 backdrop-blur-md flex items-center gap-2 border border-amber-400/30 hover:bg-amber-900/80 transition z-10">
                                        <i data-lucide="user" class="w-3 h-3 text-amber-300"></i>
                                        <span class="text-xs font-bold text-amber-100"><?= htmlspecialchars(BioUtils::resolveJaName($feedLatestId['taxon_name'])) ?></span>
                                        <span class="text-[10px] text-amber-200/60">提案</span>
                                    </a>
                                <?php elseif ($feedAiName): ?>
                                    <a href="observation_detail.php?id=<?= urlencode($obs['id']) ?>"
                                        class="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-blue-900/60 backdrop-blur-md flex items-center gap-2 border border-blue-400/30 hover:bg-blue-900/80 transition z-10">
                                        <i data-lucide="sparkles" class="w-3 h-3 text-blue-300"></i>
                                        <span class="text-xs font-bold text-blue-100"><?= htmlspecialchars(BioUtils::resolveJaName($feedAiName)) ?></span>
                                        <span class="text-[10px] text-blue-200/60">AI</span>
                                    </a>
                                <?php else: ?>
                                    <div class="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md flex items-center gap-2 border border-white/10">
                                        <i data-lucide="help-circle" class="w-3 h-3 text-white/50"></i>
                                        <span class="text-xs text-white/60"><?= __('home.identifying') ?></span>
                                    </div>
                                <?php endif; ?>
                            <?php endif; ?>
                        </div>

                        <!-- Actions: Reactions + Comments -->
                        <div class="px-4 py-3 pb-0 flex items-center gap-2">
                            <?php if ($currentUser): ?>
                                <?php
                                $feedRxItems = [
                                    ['id' => 'like', 'emoji' => '✨'],
                                    ['id' => 'beautiful', 'emoji' => '🌸'],
                                    ['id' => 'cute', 'emoji' => '❤️'],
                                ];
                                foreach ($feedRxItems as $frx): ?>
                                    <button @click="rxSend('<?php echo $frx['id']; ?>')"
                                        class="text-lg active:scale-125 transition-transform px-0.5"
                                        :class="rxMy === '<?php echo $frx['id']; ?>' ? 'opacity-100 scale-110' : 'opacity-30 hover:opacity-70'">
                                        <?php echo $frx['emoji']; ?>
                                    </button>
                                <?php endforeach; ?>
                                <span class="text-xs font-bold text-secondary ml-0.5" x-show="rxCount > 0" x-text="rxCount"></span>
                            <?php else: ?>
                                <?php
                                $feedRxGuest = [
                                    ['id' => 'like', 'emoji' => '✨'],
                                    ['id' => 'beautiful', 'emoji' => '🌸'],
                                    ['id' => 'cute', 'emoji' => '❤️'],
                                ];
                                foreach ($feedRxGuest as $frxg): ?>
                                    <a href="login.php?redirect=<?= urlencode('observation_detail.php?id=' . $obs['id']) ?>"
                                        class="text-lg opacity-30 hover:opacity-60 transition-opacity px-0.5">
                                        <?= $frxg['emoji'] ?>
                                    </a>
                                <?php endforeach; ?>
                                <?php if ($_feedCount > 0): ?>
                                    <span class="text-xs font-bold text-secondary"><?php echo (int)$_feedCount; ?></span>
                                <?php endif; ?>
                            <?php endif; ?>
                            <div class="flex-1"></div>
                            <a href="observation_detail.php?id=<?php echo urlencode($obs['id']); ?>#identifications" class="flex items-center gap-1.5 group active:scale-90 transition-transform">
                                <i data-lucide="message-circle" class="w-4 h-4 transition text-faint group-hover:text-secondary"></i>
                                <?php if ($obsIdCount > 0): ?>
                                    <span class="text-xs font-bold text-secondary"><?php echo (int)$obsIdCount; ?></span>
                                <?php endif; ?>
                            </a>
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

        <!-- ==================== ウォークモード ==================== -->
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-bottom:var(--phi-xl)">
            <div class="rounded-3xl overflow-hidden border border-emerald-500/20">
                <div class="bg-gradient-to-br from-emerald-900 to-teal-900 p-5 md:p-6">
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-2xl">🔍</span>
                                <h2 class="text-lg font-black text-white">いきものサーチ</h2>
                            </div>
                            <p class="text-sm text-emerald-200/80 leading-relaxed mb-4">いつもの道を歩くだけ。スマホがポケットの中で鳥の声をAIが自動判定。カメラをかざせば植物も昆虫も。</p>
                            <a href="field_research.php?mode=walk" class="inline-flex items-center gap-2 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 text-sm font-bold rounded-full px-5 py-2.5 transition active:scale-95 shadow-lg shadow-emerald-400/20">
                                <i data-lucide="search" class="w-4 h-4"></i>
                                いきものサーチを始める
                            </a>
                        </div>
                    </div>

                    <?php if ($communityWalkStats['count'] > 0): ?>
                    <div class="mt-5 pt-4 border-t border-white/10">
                        <p class="text-[11px] text-emerald-300/60 font-bold mb-2">みんなの記録</p>
                        <div class="flex items-center gap-4 text-sm text-emerald-100">
                            <span><span class="font-black text-white"><?= number_format($communityWalkStats['count']) ?></span> 回散歩</span>
                            <span class="text-emerald-400/30">|</span>
                            <span>合計 <span class="font-black text-white"><?= number_format($communityWalkStats['duration_min']) ?></span> 分</span>
                            <span class="text-emerald-400/30">|</span>
                            <span><span class="font-black text-white"><?= number_format($communityWalkStats['unique_species']) ?></span> 種の鳥を録音</span>
                        </div>
                    </div>
                    <?php endif; ?>
                </div>

                <?php if (!empty($latestWalkSummaries)): ?>
                <div class="bg-elevated divide-y divide-border">
                    <div class="px-4 py-2.5 bg-emerald-50/50">
                        <span class="text-[11px] font-bold text-emerald-700">最近のウォーク</span>
                    </div>
                    <?php foreach ($latestWalkSummaries as $ws):
                        $wsSummary = $ws['scan_summary'] ?? [];
                        $wsDur = $wsSummary['duration_min'] ?? 0;
                        $wsSpCount = $wsSummary['species_count'] ?? 0;
                        $wsDist = ($wsSummary['distance_m'] ?? 0) > 0 ? round(($wsSummary['distance_m'] ?? 0) / 1000, 1) . 'km' : '';
                        $wsTopSpecies = array_slice($wsSummary['top_species'] ?? [], 0, 3);
                        $wsUserName = $ws['user_name'] ?? 'ユーザー';
                        $wsUserAvatar = $ws['user_avatar'] ?? '';
                        $wsDate = date('n/j H:i', strtotime($ws['observed_at'] ?? $ws['created_at'] ?? 'now'));
                    ?>
                    <a href="observation_detail.php?id=<?= urlencode($ws['id']) ?>" class="flex items-center gap-3 px-4 py-3 hover:bg-surface transition">
                        <?php if ($wsUserAvatar): ?>
                        <img src="<?= htmlspecialchars($wsUserAvatar) ?>" alt="" class="w-9 h-9 rounded-full object-cover border border-border shrink-0">
                        <?php else: ?>
                        <div class="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                            <i data-lucide="bird" class="w-4 h-4 text-emerald-500"></i>
                        </div>
                        <?php endif; ?>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-bold text-text truncate"><?= htmlspecialchars($wsUserName) ?></span>
                                <span class="text-[10px] text-muted"><?= $wsDate ?></span>
                            </div>
                            <div class="flex items-center gap-2 mt-0.5">
                                <span class="text-xs text-muted"><?= $wsDur ?>分の散歩<?= $wsDist ? "({$wsDist})" : '' ?>で<?= $wsSpCount ?>種の鳥に出会った</span>
                            </div>
                            <?php if (!empty($wsTopSpecies)): ?>
                            <div class="flex gap-1 mt-1">
                                <?php foreach ($wsTopSpecies as $sp): ?>
                                <span class="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full"><?= htmlspecialchars($sp['name'] ?? '') ?></span>
                                <?php endforeach; ?>
                            </div>
                            <?php endif; ?>
                        </div>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-faint shrink-0"></i>
                    </a>
                    <?php endforeach; ?>
                </div>
                <?php endif; ?>
            </div>
        </section>

        <!-- ==================== ライブスキャン ==================== -->
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-bottom:var(--phi-2xl)">
            <div class="rounded-3xl overflow-hidden border border-blue-500/20">
                <div class="bg-gradient-to-br from-blue-900 to-purple-900 p-5 md:p-6">
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-2xl">📡</span>
                                <h2 class="text-lg font-black text-white">カメラで生きもの図鑑</h2>
                            </div>
                            <p class="text-sm text-blue-200/80 leading-relaxed mb-4">スマホのカメラを周りにかざすだけ。植物・昆虫・鳥 ― 映ったものをAIがリアルタイムで判定して、自動で記録します。</p>
                            <div class="flex gap-2">
                                <a href="field_research.php?mode=scan" class="inline-flex items-center gap-2 bg-blue-400 hover:bg-blue-300 text-blue-950 text-sm font-bold rounded-full px-5 py-2.5 transition active:scale-95 shadow-lg shadow-blue-400/20">
                                    <i data-lucide="radar" class="w-4 h-4"></i>
                                    スキャン開始
                                </a>
                                <a href="livemap.php" class="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-xs font-bold hover:bg-white/20 transition">
                                    <i data-lucide="globe" class="w-3.5 h-3.5"></i> マップ
                                </a>
                            </div>
                        </div>
                    </div>

                    <?php if ($communityScanStats['count'] > 0): ?>
                    <div class="mt-5 pt-4 border-t border-white/10">
                        <p class="text-[11px] text-blue-300/60 font-bold mb-2">みんなの記録</p>
                        <div class="flex items-center gap-4 text-sm text-blue-100 flex-wrap">
                            <span><span class="font-black text-white"><?= number_format($communityScanStats['count']) ?></span> 回スキャン</span>
                            <span class="text-blue-400/30">|</span>
                            <span>合計 <span class="font-black text-white"><?= number_format($communityScanStats['duration_min']) ?></span> 分</span>
                            <span class="text-blue-400/30">|</span>
                            <span><span class="font-black text-white"><?= number_format($communityScanStats['unique_species']) ?></span> 種を発見</span>
                        </div>
                    </div>
                    <?php endif; ?>
                </div>

                <?php if (!empty($latestScans)): ?>
                <div class="bg-elevated divide-y divide-border">
                    <div class="px-4 py-2.5 bg-blue-50/50">
                        <span class="text-[11px] font-bold text-blue-700">最近のスキャン</span>
                    </div>
                    <?php foreach ($latestScans as $scan):
                        $scanSummary = $scan['scan_summary'] ?? [];
                        $scanDur = $scanSummary['duration_min'] ?? 0;
                        $scanSpCount = $scanSummary['species_count'] ?? 0;
                        $scanTopSpecies = array_slice($scanSummary['top_species'] ?? [], 0, 3);
                        $scanUserName = $scan['user_name'] ?? 'ユーザー';
                        $scanUserAvatar = $scan['user_avatar'] ?? '';
                        $scanDate = date('n/j H:i', strtotime($scan['observed_at'] ?? $scan['created_at'] ?? 'now'));
                    ?>
                    <a href="observation_detail.php?id=<?= urlencode($scan['id']) ?>" class="flex items-center gap-3 px-4 py-3 hover:bg-surface transition">
                        <?php if ($scanUserAvatar): ?>
                        <img src="<?= htmlspecialchars($scanUserAvatar) ?>" alt="" class="w-9 h-9 rounded-full object-cover border border-border shrink-0">
                        <?php else: ?>
                        <div class="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <i data-lucide="scan" class="w-4 h-4 text-blue-500"></i>
                        </div>
                        <?php endif; ?>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-bold text-text truncate"><?= htmlspecialchars($scanUserName) ?></span>
                                <span class="text-[10px] text-muted"><?= $scanDate ?></span>
                            </div>
                            <div class="flex items-center gap-2 mt-0.5">
                                <span class="text-xs text-muted"><?= $scanDur ?>分間のスキャンで<?= $scanSpCount ?>種を発見</span>
                            </div>
                            <?php if (!empty($scanTopSpecies)): ?>
                            <div class="flex gap-1 mt-1">
                                <?php foreach ($scanTopSpecies as $sp): ?>
                                <span class="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full"><?= htmlspecialchars($sp['name'] ?? '') ?></span>
                                <?php endforeach; ?>
                            </div>
                            <?php endif; ?>
                        </div>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-faint shrink-0"></i>
                    </a>
                    <?php endforeach; ?>
                </div>
                <?php endif; ?>
            </div>
        </section>

        <!-- ==================== サウンドアーカイブ ==================== -->
        <?php
        $soundArchive = DataStore::getLatest('sound_archive', 6, function ($item) {
            return empty($item['hidden']);
        });
        usort($soundArchive, function ($a, $b) {
            return strcmp($b['created_at'] ?? '', $a['created_at'] ?? '');
        });
        $soundArchive = array_slice($soundArchive, 0, 6);
        ?>
        <section class="max-w-5xl mx-auto px-4 md:px-6" style="margin-bottom:var(--phi-xl)" x-data="{ saPlaying: null }">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                    <i data-lucide="audio-lines" class="w-5 h-5 text-violet-500"></i>
                    <h2 class="font-black text-text" style="font-size:var(--text-md)">サウンドアーカイブ</h2>
                </div>
                <a href="/sound_archive.php" class="text-token-xs font-bold text-primary hover:underline">すべて見る →</a>
            </div>
            <p class="text-token-xs text-muted mb-3">生き物の声を集めて、みんなで同定しよう</p>

            <?php if (empty($soundArchive)): ?>
            <div class="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-6 text-center">
                <i data-lucide="mic" class="w-10 h-10 text-violet-300 mx-auto mb-2"></i>
                <p class="text-sm font-bold text-violet-700 mb-1">まだ音声がありません</p>
                <p class="text-token-xs text-violet-500 mb-3">ウォーク・スキャンで自動録音、または手動でアップロードできます</p>
                <a href="/sound_archive.php" class="inline-flex items-center gap-1.5 bg-violet-600 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-violet-700 transition">
                    <i data-lucide="upload" class="w-3.5 h-3.5"></i> 音声をアップロード
                </a>
            </div>
            <?php else: ?>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <?php foreach ($soundArchive as $sa): ?>
                <div class="bg-surface border border-border rounded-xl p-3 space-y-1.5">
                    <?php if (!empty($sa['image_path'])): ?>
                    <img src="/<?= htmlspecialchars($sa['image_path'], ENT_QUOTES, 'UTF-8') ?>" class="w-full h-20 object-cover rounded-lg" loading="lazy">
                    <?php endif; ?>
                    <button @click="if(saPlaying==='<?= $sa['id'] ?>'){$refs.saAudio.pause();saPlaying=null}else{$refs.saAudio.src='/<?= htmlspecialchars($sa['audio_path'], ENT_QUOTES, 'UTF-8') ?>';$refs.saAudio.play();saPlaying='<?= $sa['id'] ?>'}" class="w-full flex items-center gap-2 py-1.5 rounded-lg transition" :class="saPlaying==='<?= $sa['id'] ?>' ? 'text-red-500' : 'text-violet-600'">
                        <span class="w-7 h-7 flex items-center justify-center rounded-full" :class="saPlaying==='<?= $sa['id'] ?>' ? 'bg-red-100' : 'bg-violet-100'">
                            <i :data-lucide="saPlaying==='<?= $sa['id'] ?>' ? 'pause' : 'play'" class="w-3.5 h-3.5"></i>
                        </span>
                        <span class="text-[11px] font-bold truncate text-text"><?= htmlspecialchars($sa['location']['area_name'] ?? '不明', ENT_QUOTES, 'UTF-8') ?></span>
                    </button>
                    <div class="text-[10px] text-muted">
                        <?= date('n/j H:i', strtotime($sa['recorded_at'] ?? $sa['created_at'] ?? 'now')) ?>
                        <?php
                        $idCount = count($sa['identifications'] ?? []);
                        $status = $sa['identification_status'] ?? 'needs_id';
                        if ($status === 'identified'): ?>
                            <span class="text-emerald-600 font-bold ml-1">同定済み</span>
                        <?php elseif ($idCount > 0): ?>
                            <span class="text-blue-500 font-bold ml-1"><?= $idCount ?>件提案</span>
                        <?php else: ?>
                            <span class="text-amber-500 font-bold ml-1">同定待ち</span>
                        <?php endif; ?>
                    </div>
                    <?php if (!empty($sa['birdnet_result']['top_species'])): ?>
                    <div class="text-[10px] text-faint truncate">AI: <?= htmlspecialchars($sa['birdnet_result']['top_species'], ENT_QUOTES, 'UTF-8') ?></div>
                    <?php endif; ?>
                </div>
                <?php endforeach; ?>
            </div>
            <audio x-ref="saAudio" @ended="saPlaying = null" preload="none" style="display:none"></audio>
            <?php endif; ?>
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
                        <p class="font-black text-primary-dark" style="font-size:var(--text-xl)"><?= number_format($totalObservations) ?></p>
                        <p class="text-token-xs text-muted mt-1">観察記録</p>
                    </div>
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black" style="font-size:var(--text-xl);color:#0369a1"><?= number_format($totalSpecies) ?></p>
                        <p class="text-token-xs text-muted mt-1">確認された種</p>
                    </div>
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black" style="font-size:var(--text-xl);color:#92400e"><?= $rgRate ?>%</p>
                        <p class="text-token-xs text-muted mt-1">Research Grade</p>
                    </div>
                    <div class="flex flex-col items-center text-center bg-white/60 rounded-xl border border-primary/10" style="padding:var(--phi-md) var(--phi-sm)">
                        <p class="font-black" style="font-size:var(--text-xl);color:#0369a1"><?= number_format($totalUsers) ?></p>
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
                            <li class="flex items-start gap-1.5"><span class="text-blue-700 mt-0.5">✓</span> 自社エリアの生物多様性レポート生成</li>
                            <li class="flex items-start gap-1.5"><span class="text-blue-700 mt-0.5">✓</span> 社員参加型の観察会でCSR×チームビルディング</li>
                            <li class="flex items-start gap-1.5"><span class="text-blue-700 mt-0.5">✓</span> 健康経営としての散歩プログラム</li>
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

        function feedCard(obsId, initCount, initMy) {
            return {
                rxCount: initCount,
                rxMy: initMy,
                scale: 1,
                lastTap: 0,
                _tapTimer: null,
                async rxSend(type) {
                    var _csrf = (document.cookie.match(/(?:^|;\s*)ikimon_csrf=([a-f0-9]{64})/) || [])[1] || '';
                    var res = await fetch('api/toggle_like.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': _csrf },
                        body: JSON.stringify({ id: obsId, reaction: type })
                    }).then(function(r) { return r.json(); });
                    if (res.success) {
                        this.rxMy = res.my_reaction;
                        this.rxCount = res.count;
                        if (res.action === 'liked' || res.action === 'changed') {
                            if (window.SoundManager) SoundManager.play('light-click');
                            if (window.HapticEngine) HapticEngine.tick();
                        }
                    }
                },
                doubleTap(e) {
                    var now = Date.now();
                    var self = this;
                    if (now - this.lastTap < 300) {
                        clearTimeout(this._tapTimer);
                        this._tapTimer = null;
                        if (!this.rxMy) { this.rxSend('like'); this.scale = 1.2; setTimeout(function() { self.scale = 1; }, 200); }
                    } else {
                        this._tapTimer = setTimeout(function() {
                            window.location.href = 'observation_detail.php?id=' + encodeURIComponent(obsId);
                        }, 300);
                    }
                    this.lastTap = now;
                }
            };
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
            navigator.serviceWorker.register('sw.js?v=13')
                .then(reg => {
                    console.log('SW Registered!', reg);
                    reg.update();
                })
                .catch(err => console.error('SW Failed', err));
        }
    </script>
    <?php include __DIR__ . '/components/badge_notification.php'; ?>
</body>

</html>
