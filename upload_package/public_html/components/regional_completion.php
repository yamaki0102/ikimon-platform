<?php

/**
 * regional_completion.php — 地域完成度メーター（再利用可能コンポーネント）
 *
 * 「みんなで地図を埋める」集団達成感を表示。ランキングの代替。
 *
 * Usage:
 *   <?php include 'components/regional_completion.php'; ?>
 *   <!-- Then use Alpine.js component: x-data="regionalCompletion()" -->
 *
 * Modes:
 *   compact: フィード上部の1行サマリー（タップで展開）
 *   full:    探索ページ用の詳細表示
 */
?>

<!-- Regional Completion Meter -->
<div x-data="regionalCompletion()" x-init="load()" class="relative">

    <!-- Compact Mode (for Feed) -->
    <template x-if="mode === 'compact'">
        <div @click="expanded = !expanded" class="cursor-pointer">
            <!-- Summary Bar -->
            <div class="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl border border-border/50 hover:border-primary/30 transition group">
                <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <i data-lucide="compass" class="w-4 h-4"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold" style="color:#1a2e1f;" x-text="regionName"></span>
                        <span class="text-[10px] font-bold text-primary" x-text="observedSpecies + '種を発見'"></span>
                    </div>
                    <!-- Milestone Progress Bar -->
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div class="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-1000"
                            :style="'width:' + milestonePercent + '%'"></div>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <div class="text-xs font-bold text-primary" x-text="'Lv.' + adventureLevel"></div>
                    <div class="text-[10px]" style="color:#4b5563;" x-text="'次: ' + nextMilestone + '種'"></div>
                </div>
                <i data-lucide="chevron-down" class="w-4 h-4 text-muted transition-transform duration-300" :class="expanded && 'rotate-180'"></i>
            </div>

            <!-- Expanded Detail -->
            <div x-show="expanded" x-collapse class="mt-2 bg-surface rounded-xl border border-border p-4 space-y-4">
                <!-- Recent Discoveries -->
                <template x-if="recentDiscoveries.length > 0">
                    <div>
                        <h4 class="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center gap-1">
                            <i data-lucide="sparkles" class="w-3 h-3 text-secondary"></i>
                            最近の新規発見
                        </h4>
                        <div class="space-y-1.5">
                            <template x-for="d in recentDiscoveries.slice(0, 5)" :key="d.name">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="font-bold text-text" x-text="d.name"></span>
                                    <span class="text-[10px] text-muted font-mono" x-text="d.discovered_at"></span>
                                </div>
                            </template>
                        </div>
                    </div>
                </template>

                <!-- City Breakdown (milestone-based) -->
                <template x-if="Object.keys(cities).length > 0">
                    <div>
                        <h4 class="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center gap-1">
                            <i data-lucide="building-2" class="w-3 h-3 text-primary"></i>
                            市区町村別
                        </h4>
                        <div class="space-y-2">
                            <template x-for="(city, slug) in cities" :key="slug">
                                <div>
                                    <div class="flex items-center justify-between text-xs mb-0.5">
                                        <span class="font-bold text-text" x-text="city.name"></span>
                                        <div class="flex items-center gap-2">
                                            <span class="text-[10px] font-bold text-primary" x-text="city.observed_species + '種'"></span>
                                            <span class="text-[10px] text-muted" x-text="'→ ' + getMilestone(city.observed_species) + '種'"></span>
                                        </div>
                                    </div>
                                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                        <div class="bg-primary/70 h-full rounded-full transition-all duration-700"
                                            :style="'width:' + getMilestonePercent(city.observed_species) + '%'"></div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>
                </template>

                <!-- CTA -->
                <a href="explore.php" class="block text-center text-xs font-bold text-primary hover:text-primary-dark transition py-2">
                    探索ページで詳しく見る →
                </a>
            </div>
        </div>
    </template>

    <!-- Full Mode (for Explore page) -->
    <template x-if="mode === 'full'">
        <div class="space-y-4">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white shadow-lg">
                        <i data-lucide="compass" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-black text-text font-heading" x-text="regionName + ' 生き物図鑑'"></h3>
                        <p class="text-[10px] text-muted">みんなで種を発見しよう</p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-3xl font-black text-primary font-heading" x-text="observedSpecies + '種'"></div>
                    <div class="text-[10px] text-muted" x-text="'Lv.' + adventureLevel + ' — 次: ' + nextMilestone + '種'"></div>
                </div>
            </div>

            <!-- Milestone Progress Bar -->
            <div class="relative">
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-5 overflow-hidden shadow-inner">
                    <div class="bg-gradient-to-r from-primary via-secondary to-primary h-full rounded-full transition-all duration-1000 relative"
                        :style="'width:' + milestonePercent + '%'">
                        <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                </div>
                <div class="flex justify-between text-[10px] text-muted mt-1">
                    <span x-text="observedSpecies + '種を発見'"></span>
                    <span x-text="'次のマイルストーン: ' + nextMilestone + '種'"></span>
                </div>
            </div>

            <!-- City Cards Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <template x-for="(city, slug) in cities" :key="slug">
                    <div class="bg-surface rounded-xl border border-border p-4 hover:border-primary/30 transition group">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="text-sm font-bold text-text" x-text="city.name"></h4>
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs font-bold text-primary" x-text="city.observed_species + '種'"></span>
                                <span class="text-[10px] text-muted" x-text="'→ ' + getMilestone(city.observed_species)"></span>
                            </div>
                        </div>
                        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden mb-2">
                            <div class="bg-gradient-to-r from-primary/70 to-primary h-full rounded-full transition-all duration-700"
                                :style="'width:' + getMilestonePercent(city.observed_species) + '%'"></div>
                        </div>
                        <div class="flex items-center justify-between text-[10px] text-muted">
                            <span x-text="city.total_observations + '件の観察'"></span>
                            <span x-text="city.observer_count + '人が参加'"></span>
                        </div>
                        <!-- Recent in this city -->
                        <template x-if="city.recent_discoveries && city.recent_discoveries.length > 0">
                            <div class="mt-2 pt-2 border-t border-border/50">
                                <div class="text-[10px] text-muted font-bold mb-1">✨ 最新発見</div>
                                <template x-for="rd in city.recent_discoveries.slice(0, 3)" :key="rd.name">
                                    <div class="text-[10px] text-text truncate" x-text="rd.name + ' (' + rd.discovered_at + ')'"></div>
                                </template>
                            </div>
                        </template>
                    </div>
                </template>
            </div>
        </div>
    </template>

    <!-- Loading Skeleton -->
    <div x-show="loading" class="animate-pulse">
        <div class="h-12 bg-surface rounded-xl border border-border"></div>
    </div>
</div>

<script nonce="<?= CspNonce::attr() ?>">
    // Milestone thresholds for species discovery
    const MILESTONES = [1, 5, 10, 25, 50, 100, 200, 500, 1000, 2500, 5000];
    const LEVEL_NAMES = ['はじまり', '探索者', '観察者', '調査員', '博物学者', 'マスター', '達人', '賢者', '伝説', '神話', '完全制覇'];

    function getNextMilestone(count) {
        for (const m of MILESTONES) {
            if (count < m) return m;
        }
        return MILESTONES[MILESTONES.length - 1];
    }
    function getAdventureLevel(count) {
        let lvl = 0;
        for (const m of MILESTONES) {
            if (count >= m) lvl++;
        }
        return lvl;
    }
    function getMilestoneProgress(count) {
        const next = getNextMilestone(count);
        let prev = 0;
        for (let i = MILESTONES.length - 1; i >= 0; i--) {
            if (MILESTONES[i] <= count) { prev = MILESTONES[i]; break; }
        }
        if (next === prev) return 100;
        return Math.round((count - prev) / (next - prev) * 100);
    }

    function regionalCompletion(initialMode = 'compact') {
        return {
            mode: initialMode,
            loading: true,
            expanded: false,
            regionName: '',
            observedSpecies: 0,
            estimatedSpecies: 0,
            completionPercent: 0,
            adventureLevel: 0,
            nextMilestone: 1,
            milestonePercent: 0,
            recentDiscoveries: [],
            cities: {},

            getMilestone(count) { return getNextMilestone(count); },
            getMilestonePercent(count) { return getMilestoneProgress(count); },

            async load() {
                try {
                    const res = await fetch('api/get_exploration_stats.php?region=jp_shizuoka');
                    const data = await res.json();

                    this.regionName = data.region_name || '静岡県';
                    this.observedSpecies = data.observed_species || 0;
                    this.estimatedSpecies = data.estimated_species || 1;
                    this.completionPercent = this.estimatedSpecies > 0 ?
                        Math.round(this.observedSpecies / this.estimatedSpecies * 100) :
                        0;
                    this.adventureLevel = getAdventureLevel(this.observedSpecies);
                    this.nextMilestone = getNextMilestone(this.observedSpecies);
                    this.milestonePercent = getMilestoneProgress(this.observedSpecies);
                    this.recentDiscoveries = data.recent_discoveries || [];
                    this.cities = data.cities || {};
                } catch (e) {
                    console.error('Regional stats error:', e);
                } finally {
                    this.loading = false;
                    this.$nextTick(() => {
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    });
                }
            }
        };
    }
</script>