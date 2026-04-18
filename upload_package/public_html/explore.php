<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';
Auth::init();
Lang::init();
$documentLang = 'ja';
if (method_exists('Lang', 'current')) {
    $documentLang = Lang::current();
} elseif (!empty($_SESSION['lang'])) {
    $documentLang = (string) $_SESSION['lang'];
} elseif (!empty($_GET['lang'])) {
    $documentLang = (string) $_GET['lang'];
}
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang) ?>">

<head>
    <?php
    $meta_title = __('explore_page.meta_title', 'Explore');
    $meta_description = __('explore_page.meta_description', 'Search nearby records and places, then find somewhere new to walk or revisit.');
    include __DIR__ . '/components/meta.php';
    ?>
    <?php include __DIR__ . '/components/map_config.php'; ?>
    <style>
        [x-cloak] { display: none !important; }

        .responsive-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
        }
        @media (min-width: 768px) {
            .responsive-grid {
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 1.5rem;
            }
        }

        /* M3 Filter Chip */
        .m3-chip {
            position: relative; overflow: hidden;
            display: inline-flex; align-items: center; gap: 6px;
            padding: 6px 16px;
            border-radius: var(--shape-full);
            border: 1px solid var(--md-outline);
            background: transparent;
            color: var(--md-on-surface-variant);
            font-size: var(--type-label-lg);
            font-weight: 600;
            white-space: nowrap;
            cursor: pointer;
            transition: background var(--motion-short) var(--motion-std),
                        color var(--motion-short) var(--motion-std),
                        border-color var(--motion-short) var(--motion-std);
        }
        .m3-chip::before {
            content: ''; position: absolute; inset: 0;
            background: currentColor; opacity: 0;
            border-radius: inherit;
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

        /* M3 Search Bar */
        .m3-search {
            width: 100%;
            background: var(--md-surface-variant);
            border: none;
            border-radius: var(--shape-full);
            padding: 10px 16px 10px 44px;
            font-size: var(--type-body-md);
            color: var(--md-on-surface);
            outline: none;
            transition: background var(--motion-short) var(--motion-std);
        }
        .m3-search:focus {
            background: var(--md-surface-container);
            box-shadow: 0 0 0 2px var(--md-primary);
        }
        .m3-search::placeholder { color: var(--md-on-surface-variant); opacity: 0.7; }
    </style>
</head>

<body class="js-loading pt-14 bg-base text-text font-body pb-20 md:pb-0">
    <?php include('components/nav.php'); ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main class="w-full min-h-screen bg-base pb-24 md:pb-0" x-data="explorer()">

        <!-- Header Spacer -->
        <div class="h-14"></div>

        <!-- Header / Search Area -->
        <div x-data="{ headerVisible: true, moreFilters: false }"
            @header-visibility.window="headerVisible = $event.detail"
            :class="headerVisible ? 'top-14' : 'top-0'"
            class="sticky z-30 bg-base/95 backdrop-blur-md border-b border-border pt-4 pb-4 px-4 shadow-sm transition-[top] duration-300 ease-out">
            <div class="w-full max-w-7xl mx-auto flex flex-col md:flex-row md:items-center gap-4">

                <!-- Title & Mobile Map Button -->
                <div class="flex items-center justify-between md:justify-start gap-4 shrink-0">
                    <div>
                        <h2 class="text-2xl font-black font-heading"><?php echo __('explore_page.title', 'Explore'); ?></h2>
                        <p class="text-xs text-muted mt-1"><?php echo __('explore_page.subtitle', 'Find nearby records and places'); ?></p>
                    </div>
                    <a href="map.php?tab=heatmap" class="md:hidden btn-secondary !py-2 !px-4 !rounded-full flex items-center gap-2 text-xs font-bold">
                        <i data-lucide="map" class="w-4 h-4"></i> <?php echo __('explore_page.map', 'Map'); ?>
                    </a>
                </div>

                <!-- Search Bar -->
                <div class="relative w-full md:flex-1 md:max-w-xl">
                    <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style="color:var(--md-on-surface-variant); pointer-events:none;"></i>
                    <input type="text" x-model="query" @input.debounce.500ms="load(true)"
                        placeholder="<?php echo __('explore_page.search_placeholder', 'Search by species or place'); ?>"
                        class="m3-search">
                </div>

                <!-- Filter Chips -->
                <div class="relative shrink-0">
                    <div class="flex gap-2 overflow-x-auto scrollbar-hide pr-6" role="tablist" aria-label="<?php echo __('explore_page.filter_label', 'Category filter'); ?>">
                        <button @click="filter='all'; load(true)" role="tab" :aria-selected="filter === 'all'" class="m3-chip" :class="filter === 'all' ? 'selected' : ''"><?php echo __('explore_page.all', 'All'); ?></button>
                        <button @click="filter='birds'; load(true)" role="tab" :aria-selected="filter === 'birds'" class="m3-chip" :class="filter === 'birds' ? 'selected' : ''"><i data-lucide="bird" class="w-3 h-3" style="pointer-events:none"></i> <?php echo __('explore_page.birds', 'Birds'); ?></button>
                        <button @click="filter='insects'; load(true)" role="tab" :aria-selected="filter === 'insects'" class="m3-chip" :class="filter === 'insects' ? 'selected' : ''"><i data-lucide="bug" class="w-3 h-3" style="pointer-events:none"></i> <?php echo __('explore_page.insects', 'Insects'); ?></button>
                        <button @click="filter='plants'; load(true)" role="tab" :aria-selected="filter === 'plants'" class="m3-chip" :class="filter === 'plants' ? 'selected' : ''"><i data-lucide="flower" class="w-3 h-3" style="pointer-events:none"></i> <?php echo __('explore_page.plants', 'Plants'); ?></button>
                    </div>
                    <div class="pointer-events-none absolute right-0 top-0 bottom-0 w-10 md:hidden" style="background:linear-gradient(to right,transparent,var(--md-surface))"></div>
                </div>

                <div class="flex items-center gap-2 shrink-0 md:ml-auto">
                    <button @click="moreFilters = !moreFilters" class="m3-chip" :class="moreFilters ? 'selected' : ''" :aria-expanded="moreFilters.toString()">
                        <i data-lucide="sliders-horizontal" class="w-4 h-4" style="pointer-events:none"></i>
                        <?php echo __('explore_page.filter_more', 'More filters'); ?>
                    </button>
                    <a href="map.php?tab=heatmap" class="hidden md:flex m3-chip" style="text-decoration:none;">
                        <i data-lucide="map" class="w-4 h-4" style="pointer-events:none"></i>
                        <?php echo __('explore_page.map', 'Map'); ?>
                    </a>
                </div>
            </div>

            <div x-show="moreFilters" x-cloak class="w-full max-w-7xl mx-auto mt-3 space-y-3">
                <div class="flex gap-2 overflow-x-auto scrollbar-hide">
                    <button @click="filter='fungi'; load(true)" class="m3-chip" :class="filter === 'fungi' ? 'selected' : ''">🍄 <?php echo __('explore_page.fungi', 'Fungi'); ?></button>
                    <button @click="filter='mammals'; load(true)" class="m3-chip" :class="filter === 'mammals' ? 'selected' : ''">🐾 <?php echo __('explore_page.mammals', 'Mammals'); ?></button>
                    <button @click="filter='herps'; load(true)" class="m3-chip" :class="filter === 'herps' ? 'selected' : ''">🐸 <?php echo __('explore_page.herps', 'Amphibians and reptiles'); ?></button>
                </div>
                <div class="flex gap-2 overflow-x-auto scrollbar-hide">
                    <button @click="toggleImported()" class="m3-chip" :class="includeImported ? 'selected' : ''">
                    <i data-lucide="archive" class="w-3 h-3" style="pointer-events:none"></i>
                        <span x-text="includeImported ? '<?php echo addslashes(__('explore_page.include_survey', 'Include survey records')); ?>' : '<?php echo addslashes(__('explore_page.only_posts', 'Posts only')); ?>'"></span>
                    </button>
                    <button @click="aiFilter='all'; load(true)" class="m3-chip" :class="aiFilter === 'all' ? 'selected' : ''"><?php echo __('explore_page.ai_all', 'No AI filter'); ?></button>
                    <button @click="aiFilter='hint'; load(true)" class="m3-chip" :class="aiFilter === 'hint' ? 'selected' : ''">
                        <i data-lucide="sparkles" class="w-3 h-3" style="pointer-events:none"></i> <?php echo __('explore_page.ai_hint', 'Has AI hint'); ?>
                    </button>
                    <button @click="aiFilter='multi'; load(true)" class="m3-chip" :class="aiFilter === 'multi' ? 'selected' : ''">
                        <i data-lucide="git-branch" class="w-3 h-3" style="pointer-events:none"></i> <?php echo __('explore_page.ai_multi', 'Multiple AI candidates'); ?>
                    </button>
                </div>
                <div class="flex gap-2 overflow-x-auto scrollbar-hide">
                    <button @click="invasiveFilter='invasive'; load(true)" class="m3-chip" :class="invasiveFilter === 'invasive' ? 'selected' : ''" style="--chip-selected-bg:var(--md-error-container,#ffdad6);--chip-selected-color:var(--md-on-error-container,#410002);">
                        <i data-lucide="alert-triangle" class="w-3 h-3" style="pointer-events:none"></i> <?php echo __('explore_page.invasive_only', 'Invasive only'); ?>
                    </button>
                    <button @click="invasiveFilter='native'; load(true)" class="m3-chip" :class="invasiveFilter === 'native' ? 'selected' : ''">
                        <i data-lucide="leaf" class="w-3 h-3" style="pointer-events:none"></i> <?php echo __('explore_page.native_only', 'Native only'); ?>
                    </button>
                    <template x-if="invasiveFilter !== 'all'">
                        <button @click="invasiveFilter='all'; load(true)" class="m3-chip" style="background:var(--md-surface-container-high,#e8e8e8);">
                            <i data-lucide="x" class="w-3 h-3" style="pointer-events:none"></i> <?php echo __('explore_page.clear', 'Clear'); ?>
                        </button>
                    </template>
                    <button @click="sourceFilter='post'; load(true)" class="m3-chip" :class="sourceFilter === 'post' ? 'selected' : ''">
                        📷 <?php echo __('explore_page.source_post', 'Record'); ?>
                    </button>
                    <button @click="sourceFilter='ikimon_sensor'; load(true)" class="m3-chip" :class="sourceFilter === 'ikimon_sensor' ? 'selected' : ''">
                        📡 <?php echo __('explore_page.source_sensor', 'AI lens'); ?>
                    </button>
                    <button @click="sourceFilter='fieldscan'; load(true)" class="m3-chip" :class="sourceFilter === 'fieldscan' ? 'selected' : ''">
                        🔬 <?php echo __('explore_page.source_scan', 'Scan'); ?>
                    </button>
                </div>
            </div>
        </div>



        <div class="w-full max-w-7xl mx-auto px-4 py-4">
            <!-- Regional Completion Meter (Full) -->
            <div class="mb-6" x-data="regionalCompletion('full')">
                <?php include __DIR__ . '/components/regional_completion.php'; ?>
            </div>

            <!-- Scan Recommendation Cards -->
            <?php include __DIR__ . '/components/scan_recommendation_cards.php'; ?>

            <!-- Loading State (Skeleton) -->
            <div x-show="loading && items.length === 0" class="responsive-grid pb-12">
                <template x-for="i in 6">
                    <div class="aspect-[4/5] rounded-2xl bg-surface border border-border overflow-hidden relative animate-pulse">
                        <div class="w-full h-full bg-surface"></div>
                        <div class="absolute bottom-3 left-3 right-3">
                            <div class="h-4 bg-border rounded w-2/3 mb-2"></div>
                            <div class="h-3 bg-border rounded w-1/2"></div>
                        </div>
                    </div>
                </template>
            </div>

            <!-- Grid -->
            <div class="responsive-grid pb-12" x-show="items.length > 0">
                <template x-for="obs in items" :key="obs.id">
                    <a :href="'observation_detail.php?id=' + obs.id" class="block aspect-[4/5] rounded-2xl bg-surface border border-border overflow-hidden relative group">
                        <img :src="obs.photos[0]" :alt="obs.taxon ? obs.taxon.name : <?php echo json_encode(__('explore_page.observation_photo_alt', 'Observation photo'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>" class="w-full h-full object-cover group-hover:scale-110 transition duration-500 loading-skeleton" loading="lazy">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                        <div x-show="shouldShowAiHint(obs)" class="absolute top-3 left-3 right-8">
                            <div class="inline-flex max-w-full items-center gap-1.5 rounded-full bg-black/45 text-white border border-white/20 px-2.5 py-1 backdrop-blur-sm">
                                <span class="text-[10px] font-black text-primary-foreground/90 flex-shrink-0">AI</span>
                                <span class="text-[10px] font-bold truncate" x-text="aiHintTitle(obs)"></span>
                            </div>
                        </div>
                        <div class="absolute bottom-3 left-3 right-3 text-white">
                            <div class="flex items-center gap-1.5">
                                <p class="text-xs font-bold leading-tight truncate" x-text="obs.taxon ? obs.taxon.name : <?php echo json_encode(__('explore_page.unidentified', 'Unidentified'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>"></p>
                                <span x-show="obs.individual_count" class="text-[9px] font-bold text-white/80 bg-white/20 px-1.5 py-0.5 rounded-full flex-shrink-0" x-text="'×' + obs.individual_count"></span>
                            </div>
                            <p x-show="aiHintMeta(obs)" class="text-[10px] text-white/80 mt-1 truncate" x-text="aiHintMeta(obs)"></p>
                            <div class="flex items-center gap-1 mt-1 opacity-70">
                                <i data-lucide="map-pin" class="w-3 h-3"></i>
                                <span class="text-[10px] truncate" x-text="obs.municipality || (obs.location ? obs.location.name : '')"></span>
                            </div>
                        </div>
                        <!-- Status Dot -->
                        <div class="absolute top-2 right-2 w-2 h-2 rounded-full shadow-lg border border-black/20" :class="getStatusColorClass(obs.status)"></div>
                    </a>
                </template>
            </div>

            <!-- Empty State -->
            <div x-show="items.length === 0 && !loading" class="text-center py-16 text-muted">
                <div class="text-5xl mb-4">🌱</div>
                <p class="text-lg font-bold text-muted mb-2"><?php echo __('explore_page.empty_title', 'No nearby records yet'); ?></p>
                <p class="text-sm text-muted mb-4"><?php echo __('explore_page.empty_body', 'Leave your first record and start the flow for this place.'); ?></p>
                <a href="post.php" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:var(--shape-full);background:var(--md-primary);color:var(--md-on-primary);font-weight:700;font-size:var(--type-label-lg);text-decoration:none;box-shadow:var(--elev-1);">
                    <i data-lucide="camera" class="w-4 h-4" style="pointer-events:none"></i> <?php echo __('explore_page.empty_cta', 'Post the first observation'); ?>
                </a>
            </div>

            <!-- Load More -->
            <div x-show="hasMore" class="py-4 text-center">
                <button @click="load()" class="m3-chip" :disabled="loading">
                <span x-show="!loading"><?php echo __('explore_page.load_more', 'See more'); ?></span>
                <span x-show="loading"><?php echo __('explore_page.loading', 'Loading...'); ?></span>
                </button>
            </div>
        </div>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        function explorer() {
            return {
                query: '',
                filter: 'all',
                aiFilter: 'all',
                invasiveFilter: 'all',
                sourceFilter: new URLSearchParams(window.location.search).get('source') || 'all',
                includeImported: new URLSearchParams(window.location.search).get('include_imported') === '1',
                items: [],
                loading: false,
                offset: 0,
                limit: 20,
                hasMore: true,
                regionStats: null,
                scanRecs: [],
                scanSummary: null,
                scanRecsLoaded: false,
                scanRecsLoading: false,

                init() {
                    this.load();
                    this.tryAutoLoadScanRecs();
                },

                async load(reset = false) {
                    if (this.loading && !reset) return;
                    if (reset) {
                        this.offset = 0;
                        this.items = [];
                        this.hasMore = true;
                    }
                    if (!this.hasMore) return;

                    this.loading = true;
                    try {
                        const groupMap = {
                            birds: 'bird', insects: 'insect', plants: 'plant',
                            fungi: 'fungi', mammals: 'mammal', herps: 'amphibian_reptile'
                        };
                        let url = `api/get_observations.php?limit=${this.limit}&offset=${this.offset}&min_created_year=2026&q=${encodeURIComponent(this.query)}`;
                        if (this.filter !== 'all' && groupMap[this.filter]) {
                            url += `&taxon_group=${groupMap[this.filter]}`;
                        }
                        if (this.aiFilter !== 'all') {
                            url += `&ai_filter=${encodeURIComponent(this.aiFilter)}`;
                        }
                        if (this.invasiveFilter !== 'all') {
                            url += `&invasive_filter=${encodeURIComponent(this.invasiveFilter)}`;
                        }
                        if (this.includeImported) {
                            url += `&include_imported=1`;
                        }
                        if (this.sourceFilter !== 'all') {
                            url += `&record_source=${encodeURIComponent(this.sourceFilter)}`;
                        }
                        const res = await fetch(url);
                        const result = await res.json();

                        this.items = [...this.items, ...result.data];
                        this.hasMore = result.has_more;
                        this.offset += this.limit;

                    } catch (e) {
                        console.error(e);
                    } finally {
                        this.loading = false;
                        this.$nextTick(() => lucide.createIcons());
                    }
                },

                getStatusColorClass(status) {
                    if (status === 'Research Grade') return 'bg-primary';
                    if (status === 'Suggested') return 'bg-warning';
                    return 'bg-muted';
                },

                shouldShowAiHint(obs) {
                    const hint = this.aiHintTitle(obs);
                    return hint !== '';
                },

                aiHintTitle(obs) {
                    const ai = obs.latest_ai_assessment || null;
                    if (!ai) return '';
                    const currentTaxon = obs.taxon?.name || '';
                    const best = ai.best_specific_taxon?.name || '';
                    const recommended = ai.recommended_taxon?.name || '';
                    const candidate = best || recommended || '';
                    if (!candidate) return '';
                    if (!currentTaxon) return candidate;
                    if (currentTaxon === candidate) return '';
                    return candidate;
                },

                aiHintMeta(obs) {
                    const ai = obs.latest_ai_assessment || null;
                    if (!ai) return '';
                    if (ai.candidate_disagreement && ai.candidate_disagreement !== 'single_candidate' && ai.similar_taxa_to_compare?.length) {
                        return '<?php echo addslashes(__('explore_page.hint_candidates', 'Has identification candidates')); ?>';
                    }
                    if (!obs.taxon && this.aiHintTitle(obs)) {
                        const rank = ai.recommended_taxon?.rank || ai.best_specific_taxon?.rank || '';
                        const rankMap = {
                            family: '<?php echo addslashes(__('explore_page.rank_family', 'Family')); ?>',
                            genus: '<?php echo addslashes(__('explore_page.rank_genus', 'Genus')); ?>',
                            species: '<?php echo addslashes(__('explore_page.rank_species', 'Species')); ?>',
                            order: '<?php echo addslashes(__('explore_page.rank_order', 'Order')); ?>',
                            class: '<?php echo addslashes(__('explore_page.rank_class', 'Class')); ?>'
                        };
                        if (rank && rankMap[rank]) {
                        return '<?php echo addslashes(__('explore_page.rank_narrowing', 'AI is narrowing it down to {rank}')); ?>'.replace('{rank}', rankMap[rank]);
                        }
                    }
                    if (!obs.taxon && ai.simple_summary) {
                        return ai.simple_summary;
                    }
                    const rank = ai.recommended_taxon?.rank || ai.best_specific_taxon?.rank || '';
                    const rankMap = {
                            family: '<?php echo addslashes(__('explore_page.rank_family', 'Family')); ?>',
                            genus: '<?php echo addslashes(__('explore_page.rank_genus', 'Genus')); ?>',
                            species: '<?php echo addslashes(__('explore_page.rank_species', 'Species')); ?>',
                            order: '<?php echo addslashes(__('explore_page.rank_order', 'Order')); ?>',
                            class: '<?php echo addslashes(__('explore_page.rank_class', 'Class')); ?>'
                    };
                    if (rank && rankMap[rank] && this.aiHintTitle(obs)) {
                        return '<?php echo addslashes(__('explore_page.rank_hint', '{rank} hint available')); ?>'.replace('{rank}', rankMap[rank]);
                    }
                    return '';
                },

                async tryAutoLoadScanRecs() {
                    if (!navigator.geolocation) return;
                    try {
                        const pos = await new Promise((resolve, reject) =>
                            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 300000 })
                        );
                        await this.loadScanRecs(pos.coords.latitude, pos.coords.longitude);
                    } catch (_) {
                        // Location denied — show prompt
                    }
                },

                async requestLocationForScanRecs() {
                    if (!navigator.geolocation) return;
                    this.scanRecsLoading = true;
                    try {
                        const pos = await new Promise((resolve, reject) =>
                            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
                        );
                        await this.loadScanRecs(pos.coords.latitude, pos.coords.longitude);
                    } catch (_) {
                        this.scanRecsLoading = false;
                    }
                },

                async loadScanRecs(lat, lng) {
                    this.scanRecsLoading = true;
                    try {
                        const res = await fetch(`/api/v2/scan_recommendations.php?lat=${lat}&lng=${lng}&radius=5`);
                        const json = await res.json();
                        if (json.success) {
                            this.scanRecs = json.data.recommendations || [];
                            this.scanSummary = json.data.summary || null;
                            this.scanRecsLoaded = true;
                        }
                    } catch (e) {
                        console.error('[ScanRecs]', e);
                    } finally {
                        this.scanRecsLoading = false;
                        this.$nextTick(() => lucide.createIcons());
                    }
                },

                toggleImported() {
                    this.includeImported = !this.includeImported;
                    const url = new URL(window.location);
                    if (this.includeImported) {
                        url.searchParams.set('include_imported', '1');
                    } else {
                        url.searchParams.delete('include_imported');
                    }
                    history.replaceState({}, '', url);
                    this.load(true);
                }
            }
        }
        lucide.createIcons();
    </script>
    <?php include __DIR__ . '/components/footer.php'; ?>
</body>

</html>
