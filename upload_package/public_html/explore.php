<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $meta_title = "みつける";
    include __DIR__ . '/components/meta.php';
    ?>
    <style>
        [x-cloak] { display: none !important; }

        /* MD3 Surface Tones */
        .surface-container { background: #f3f6f4; }
        .surface-container-high { background: #eef1ef; }
        .surface-dim { background: #d9dcd9; }

        /* MD3 Search Bar */
        .md3-search {
            background: #eef1ef;
            border: none;
            border-radius: 28px;
            transition: background 200ms ease, box-shadow 200ms ease;
        }
        .md3-search:focus-within {
            background: #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08);
        }

        /* MD3 Filter Chip */
        .md3-chip {
            border-radius: 8px;
            border: 1px solid #c4c7c5;
            background: transparent;
            padding: 6px 16px;
            font-size: 14px;
            font-weight: 500;
            letter-spacing: 0.01em;
            color: #1f1f1f;
            transition: all 150ms ease;
            cursor: pointer;
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .md3-chip:hover { background: rgba(16,185,129,0.04); }
        .md3-chip.active {
            background: rgba(16,185,129,0.12);
            border-color: transparent;
            color: #065f46;
        }
        .md3-chip.active i { color: #059669; }

        /* MD3 Card */
        .md3-card {
            border-radius: 16px;
            overflow: hidden;
            background: #fff;
            transition: box-shadow 200ms ease, transform 200ms ease;
            position: relative;
        }
        .md3-card:hover {
            box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06);
            transform: translateY(-1px);
        }
        .md3-card img {
            transition: transform 400ms cubic-bezier(0.2, 0, 0, 1);
        }
        .md3-card:hover img { transform: scale(1.03); }

        /* Grid */
        .obs-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }
        @media (min-width: 640px) {
            .obs-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; }
        }
        @media (min-width: 1024px) {
            .obs-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        }

        /* MD3 State Layer */
        .state-layer {
            position: absolute; inset: 0;
            background: linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 100%);
            pointer-events: none;
        }

        /* Skeleton */
        @keyframes md3-shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        .md3-skeleton {
            background: linear-gradient(90deg, #eef1ef 25%, #e2e5e3 37%, #eef1ef 63%);
            background-size: 200% 100%;
            animation: md3-shimmer 1.5s ease-in-out infinite;
        }

        /* Scrollbar hide */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* MD3 Outlined Button */
        .md3-btn-outlined {
            border: 1px solid #c4c7c5;
            border-radius: 20px;
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 500;
            color: #10b981;
            background: transparent;
            transition: all 150ms ease;
            cursor: pointer;
        }
        .md3-btn-outlined:hover { background: rgba(16,185,129,0.04); }

        /* MD3 Filled Button */
        .md3-btn-filled {
            border: none;
            border-radius: 20px;
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 500;
            color: #fff;
            background: #10b981;
            transition: all 150ms ease;
            cursor: pointer;
            display: inline-flex; align-items: center; gap: 8px;
        }
        .md3-btn-filled:hover { background: #059669; box-shadow: 0 1px 3px rgba(16,185,129,0.3); }
        .md3-btn-filled:active { transform: scale(0.98); }

        /* Badge */
        .md3-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            backdrop-filter: blur(8px);
        }

        /* Status dot */
        .status-dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            border: 1.5px solid rgba(255,255,255,0.8);
            position: absolute;
            top: 10px; right: 10px;
        }
    </style>
</head>

<body class="js-loading pt-14 bg-white text-text font-body pb-20 md:pb-0">
    <?php include('components/nav.php'); ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main class="w-full min-h-screen pb-24 md:pb-0" x-data="explorer()">

        <!-- Spacer for fixed nav -->
        <div class="h-6"></div>

        <!-- MD3 Top Section -->
        <div class="sticky top-14 z-30 bg-white/95 backdrop-blur-lg pb-3 transition-all duration-200">

            <!-- Search Bar (Google-style) -->
            <div class="max-w-3xl mx-auto px-4 pt-4 pb-2">
                <div class="md3-search flex items-center px-4 py-3">
                    <i data-lucide="search" class="w-5 h-5 text-gray-500 shrink-0"></i>
                    <input type="text" x-model="query" @input.debounce.500ms="load(true)"
                        placeholder="いきものを検索"
                        class="flex-1 bg-transparent border-none outline-none ml-3 text-base text-gray-900 placeholder-gray-500">
                    <a href="map.php?tab=heatmap" class="shrink-0 ml-2 p-1.5 rounded-full hover:bg-black/5 transition" title="活動経路マップ">
                        <i data-lucide="map" class="w-5 h-5 text-gray-600"></i>
                    </a>
                </div>
            </div>

            <!-- Filter Chips (MD3 horizontal scroll) -->
            <div class="max-w-5xl mx-auto px-4">
                <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label="分類フィルタ">
                    <button @click="filter='all'; load(true)" role="tab" :aria-selected="filter === 'all'"
                        class="md3-chip" :class="filter === 'all' && 'active'">すべて</button>
                    <button @click="filter='birds'; load(true)" role="tab" :aria-selected="filter === 'birds'"
                        class="md3-chip" :class="filter === 'birds' && 'active'">
                        <i data-lucide="bird" class="w-4 h-4"></i> 鳥類</button>
                    <button @click="filter='insects'; load(true)" role="tab" :aria-selected="filter === 'insects'"
                        class="md3-chip" :class="filter === 'insects' && 'active'">
                        <i data-lucide="bug" class="w-4 h-4"></i> 昆虫</button>
                    <button @click="filter='plants'; load(true)" role="tab" :aria-selected="filter === 'plants'"
                        class="md3-chip" :class="filter === 'plants' && 'active'">
                        <i data-lucide="flower" class="w-4 h-4"></i> 植物</button>
                    <button @click="filter='fungi'; load(true)" role="tab" :aria-selected="filter === 'fungi'"
                        class="md3-chip" :class="filter === 'fungi' && 'active'">🍄 菌類</button>
                    <button @click="filter='mammals'; load(true)" role="tab" :aria-selected="filter === 'mammals'"
                        class="md3-chip" :class="filter === 'mammals' && 'active'">🐾 哺乳類</button>
                    <button @click="filter='herps'; load(true)" role="tab" :aria-selected="filter === 'herps'"
                        class="md3-chip" :class="filter === 'herps' && 'active'">🐸 両生爬虫</button>

                    <div class="w-px h-6 bg-gray-200 self-center mx-1 shrink-0"></div>

                    <button @click="aiFilter= aiFilter==='hint' ? 'all' : 'hint'; load(true)"
                        class="md3-chip" :class="aiFilter === 'hint' && 'active'">
                        <i data-lucide="sparkles" class="w-4 h-4"></i> AIヒント</button>
                    <button @click="aiFilter= aiFilter==='multi' ? 'all' : 'multi'; load(true)"
                        class="md3-chip" :class="aiFilter === 'multi' && 'active'">
                        <i data-lucide="git-branch" class="w-4 h-4"></i> 複数候補</button>
                    <button @click="toggleImported()"
                        class="md3-chip" :class="includeImported && 'active'">
                        <i data-lucide="archive" class="w-4 h-4"></i> 調査記録</button>
                </div>
            </div>
        </div>

        <div class="max-w-5xl mx-auto px-4 pt-2">

            <!-- Regional Completion -->
            <div class="mb-4" x-data="regionalCompletion('full')">
                <?php include __DIR__ . '/components/regional_completion.php'; ?>
            </div>

            <!-- Skeleton Loading -->
            <div x-show="loading && items.length === 0" class="obs-grid pb-12">
                <template x-for="i in 8">
                    <div class="md3-card aspect-[4/5]">
                        <div class="w-full h-full md3-skeleton"></div>
                    </div>
                </template>
            </div>

            <!-- Observation Grid -->
            <div class="obs-grid pb-12" x-show="items.length > 0">
                <template x-for="obs in items" :key="obs.id">
                    <a :href="'observation_detail.php?id=' + obs.id" class="md3-card block aspect-[4/5]">
                        <img :src="obs.photos[0]"
                            :alt="obs.taxon ? obs.taxon.name : '観察写真'"
                            class="w-full h-full object-cover" loading="lazy">
                        <div class="state-layer"></div>

                        <!-- AI Badge -->
                        <div x-show="shouldShowAiHint(obs)" class="absolute top-2.5 left-2.5">
                            <div class="md3-badge bg-black/40 text-white/95">
                                <span class="text-emerald-300 font-black" style="font-size:10px">AI</span>
                                <span class="truncate max-w-[120px]" x-text="aiHintTitle(obs)"></span>
                            </div>
                        </div>

                        <!-- Status Dot -->
                        <div class="status-dot" :class="getStatusColorClass(obs.status)"></div>

                        <!-- Info Overlay -->
                        <div class="absolute bottom-0 left-0 right-0 p-3 text-white">
                            <div class="flex items-center gap-1.5">
                                <p class="text-sm font-semibold leading-snug truncate" x-text="obs.taxon ? obs.taxon.name : '未同定'"></p>
                                <span x-show="obs.individual_count"
                                    class="text-[10px] font-semibold text-white/80 bg-white/20 px-1.5 py-0.5 rounded shrink-0"
                                    x-text="'×' + obs.individual_count"></span>
                            </div>
                            <p x-show="aiHintMeta(obs)" class="text-[11px] text-white/70 mt-0.5 truncate" x-text="aiHintMeta(obs)"></p>
                            <div class="flex items-center gap-1 mt-1 text-white/60">
                                <i data-lucide="map-pin" class="w-3 h-3"></i>
                                <span class="text-[11px] truncate" x-text="obs.municipality || (obs.location ? obs.location.name : '')"></span>
                            </div>
                        </div>
                    </a>
                </template>
            </div>

            <!-- Empty State (MD3) -->
            <div x-show="items.length === 0 && !loading" class="flex flex-col items-center justify-center py-20 text-center">
                <div class="w-16 h-16 rounded-full surface-container flex items-center justify-center mb-5">
                    <i data-lucide="search" class="w-7 h-7 text-gray-400"></i>
                </div>
                <p class="text-lg font-medium text-gray-800 mb-1">観察が見つかりません</p>
                <p class="text-sm text-gray-500 mb-6">この地域で最初の記録を残しませんか？</p>
                <a href="post.php" class="md3-btn-filled">
                    <i data-lucide="camera" class="w-4 h-4"></i> 観察を投稿する
                </a>
            </div>

            <!-- Load More (MD3) -->
            <div x-show="hasMore && items.length > 0" class="py-6 text-center">
                <button @click="load()" class="md3-btn-outlined" :disabled="loading">
                    <span x-show="!loading">もっと見る</span>
                    <span x-show="loading" class="inline-flex items-center gap-2">
                        <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3"/><path d="M12 2a10 10 0 019.95 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                        読み込み中
                    </span>
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
                includeImported: new URLSearchParams(window.location.search).get('include_imported') === '1',
                items: [],
                loading: false,
                offset: 0,
                limit: 20,
                hasMore: true,
                regionStats: null,

                init() {
                    this.load();
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
                        if (this.includeImported) {
                            url += `&include_imported=1`;
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
                    if (status === 'Research Grade') return 'bg-emerald-500';
                    if (status === 'Suggested') return 'bg-amber-500';
                    return 'bg-gray-400';
                },

                shouldShowAiHint(obs) {
                    return this.aiHintTitle(obs) !== '';
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
                        return '見分け候補あり';
                    }
                    if (!obs.taxon && this.aiHintTitle(obs)) {
                        const rank = ai.recommended_taxon?.rank || ai.best_specific_taxon?.rank || '';
                        const rankMap = { family: '科', genus: '属', species: '種', order: '目', class: '綱' };
                        if (rank && rankMap[rank]) {
                            return rankMap[rank] + 'まで AI が絞り込み中';
                        }
                    }
                    if (!obs.taxon && ai.simple_summary) {
                        return ai.simple_summary;
                    }
                    const rank = ai.recommended_taxon?.rank || ai.best_specific_taxon?.rank || '';
                    const rankMap = { family: '科', genus: '属', species: '種', order: '目', class: '綱' };
                    if (rank && rankMap[rank] && this.aiHintTitle(obs)) {
                        return rankMap[rank] + 'ヒントあり';
                    }
                    return '';
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
