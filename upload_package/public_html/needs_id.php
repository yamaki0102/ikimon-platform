<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';

Auth::init();
$currentUser = Auth::user();

// The Missing Matrix dashboard - Focuses on Unidentified / Disputed observations.
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $meta_title = "未同定リスト";
    $meta_description = "未同定や意見が分かれている観察記録。あなたの知識で、生物多様性データセットの空白を埋めよう。";
    include __DIR__ . '/components/meta.php';
    ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
</head>

<body class="pt-14 bg-base text-text min-h-screen pb-20 md:pb-0" x-data="missingMatrix()">

    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="pt-[calc(var(--nav-height)+var(--safe-top)+20px)] max-w-5xl mx-auto px-4 md:px-6">

        <!-- Header -->
        <header class="mb-8 md:mb-12">
            <div class="inline-flex items-center gap-2 mb-3 bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-token-xs font-black uppercase tracking-widest">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                要対応
            </div>
            <h1 class="text-3xl md:text-5xl font-black mb-4 tracking-tight leading-tight">
                未同定リスト
            </h1>
            <p class="text-secondary max-w-2xl leading-relaxed font-bold">
                ここは「知識の空白」。未同定の生き物や、意見が分かれている記録が集まる場所です。<br>
                あなたの知識でこれらの謎を解き明かし、データセットを完成させてください。
            </p>
        </header>

        <!-- Stats / Gamification snippet -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-surface border border-border-strong rounded-2xl p-4">
                <p class="text-token-xs text-muted font-bold tracking-widest uppercase mb-1">未解決レコード</p>
                <div class="flex items-baseline gap-2">
                    <span class="text-2xl font-black text-text" x-text="stats.unresolved">...</span>
                    <span class="text-sm font-bold text-faint">件</span>
                </div>
            </div>
            <div class="bg-surface border border-border-strong rounded-2xl p-4">
                <p class="text-token-xs text-muted font-bold tracking-widest uppercase mb-1">あなたの貢献</p>
                <div class="flex items-baseline gap-2">
                    <span class="text-2xl font-black text-primary"><?php echo $currentUser ? number_format($currentUser['score'] ?? 0) : '0'; ?></span>
                    <span class="text-sm font-bold text-faint">XP</span>
                </div>
            </div>
            <!-- Jump to Workbench for advanced users -->
            <div class="col-span-2 md:col-span-2 bg-gradient-to-br from-surface to-elevated border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
                <div>
                    <h3 class="font-black text-text mb-0.5">同定する</h3>
                    <p class="text-xs text-muted">プロ向け！大量の記録を一気に同定するツール</p>
                </div>
                <a href="id_workbench.php" class="btn-primary py-2 px-4 text-xs">
                    <i data-lucide="zap" class="w-4 h-4"></i> 同定ツールを開く
                </a>
            </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap gap-2 mb-6">
            <button @click="filter = 'all'" class="px-4 py-2 rounded-xl text-sm font-bold transition border" :class="filter === 'all' ? 'bg-primary text-primary-surface border-primary' : 'bg-surface text-muted border-border hover:border-primary/50 hover:text-text'">
                すべて <span class="bg-black/10 px-1.5 py-0.5 rounded ml-1 text-xs" x-text="stats.unresolved"></span>
            </button>
            <button @click="filter = 'unidentified'" class="px-4 py-2 rounded-xl text-sm font-bold transition border" :class="filter === 'unidentified' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-surface text-muted border-border hover:border-red-500/50 hover:text-text'">
                🔴 全く見当がつかない
            </button>
            <button @click="filter = 'needs_id'" class="px-4 py-2 rounded-xl text-sm font-bold transition border" :class="filter === 'needs_id' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-surface text-muted border-border hover:border-amber-500/50 hover:text-text'">
                🟡 意見求む (同定中)
            </button>
            <button @click="filter = 'disputed'" class="px-4 py-2 rounded-xl text-sm font-bold transition border" :class="filter === 'disputed' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-surface text-muted border-border hover:border-purple-500/50 hover:text-text'">
                ⚔️ 意見が割れている
            </button>
        </div>

        <!-- Loading State -->
        <div x-show="loading" class="flex justify-center items-center py-20">
            <div class="animate-spin w-8 h-8 border-4 border-surface-dark border-r-primary rounded-full"></div>
        </div>

        <!-- Main Feed -->
        <div x-show="!loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" x-cloak>
            <template x-for="obs in filteredObservations" :key="obs.id">
                <a :href="'observation_detail.php?id=' + obs.id" class="group block bg-elevated rounded-2xl overflow-hidden border border-border-strong hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition duration-300">
                    <!-- Photo -->
                    <div class="aspect-square relative bg-surface-dark overflow-hidden">
                        <img :src="obs.photos && obs.photos[0] ? obs.photos[0] : 'assets/img/no-photo.svg'" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">

                        <!-- Status Badge Overlay -->
                        <div class="absolute top-3 left-3 flex flex-col gap-2">
                            <span x-show="!obs.taxon" class="px-2.5 py-1 bg-red-500/90 backdrop-blur-md rounded-lg text-token-xs text-white font-black shadow-lg">
                                🔴 Unidentified
                            </span>
                            <span x-show="obs.taxon && obs.has_dispute" class="px-2.5 py-1 bg-purple-500/90 backdrop-blur-md rounded-lg text-token-xs text-white font-black shadow-lg">
                                ⚔️ Disputed
                            </span>
                            <span x-show="obs.taxon && !obs.has_dispute" class="px-2.5 py-1 bg-amber-500/90 backdrop-blur-md rounded-lg text-token-xs text-white font-black shadow-lg">
                                🟡 Needs ID
                            </span>
                        </div>
                    </div>

                    <!-- Details -->
                    <div class="p-4">
                        <div class="mb-3">
                            <h3 class="font-black text-lg text-text truncate group-hover:text-primary transition" x-text="obs.taxon ? obs.taxon.name : 'Unknown Species'"></h3>
                            <p class="text-sm italic text-muted truncate mt-0.5" x-text="obs.taxon ? obs.taxon.scientific_name : '未同定'"></p>
                        </div>

                        <div class="flex items-center gap-3 text-token-xs text-faint mb-4">
                            <span class="flex items-center gap-1.5"><i data-lucide="calendar" class="w-3.5 h-3.5"></i> <span x-text="formatDate(obs.observed_at)"></span></span>
                            <span class="flex items-center gap-1.5"><i data-lucide="user" class="w-3.5 h-3.5"></i> <span x-text="obs.user_name || 'Anonymous'"></span></span>
                        </div>

                        <!-- ID Contributors preview -->
                        <template x-if="obs.identifications && obs.identifications.length > 0">
                            <div class="pt-3 border-t border-border flex items-center gap-2">
                                <div class="flex -space-x-2">
                                    <template x-for="(id, idx) in obs.identifications.slice(0, 3)" :key="idx">
                                        <div class="w-6 h-6 rounded-full bg-surface-dark border-2 border-elevated flex items-center justify-center text-[10px] font-bold text-muted z-10" :style="`z-index: ${10-idx}`" x-text="(id.user_name || '?').charAt(0)"></div>
                                    </template>
                                </div>
                                <span class="text-xs font-bold text-muted" x-text="obs.identifications.length + '人が同定に参加'"></span>
                            </div>
                        </template>
                        <template x-if="!obs.identifications || obs.identifications.length === 0">
                            <div class="pt-3 border-t border-border">
                                <span class="text-xs font-bold text-primary flex items-center gap-1">
                                    <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> ファーストIDのチャンス！
                                </span>
                            </div>
                        </template>
                    </div>
                </a>
            </template>

            <!-- Loading more -->
            <div x-show="hasMore" class="col-span-full py-8 text-center" x-intersect="loadMore()">
                <div class="inline-block animate-spin w-6 h-6 border-2 border-surface-dark border-r-primary rounded-full"></div>
            </div>

            <div x-show="!loading && filteredObservations.length === 0" class="col-span-full py-16 text-center text-muted">
                <i data-lucide="check-circle-2" class="w-12 h-12 mx-auto mb-4 opacity-50 text-primary"></i>
                <p class="font-bold text-lg">このカテゴリの空白は全て埋まっています</p>
                <p class="text-sm mt-2">素晴らしい貢献です！他のカテゴリも見てみましょう。</p>
            </div>
        </div>
    </main>

    <!-- Navigation included in body -->
    <?php include __DIR__ . '/components/footer.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        function missingMatrix() {
            return {
                observations: [],
                loading: true,
                filter: 'all',
                page: 1,
                hasMore: false,
                stats: {
                    unresolved: 0
                },

                async init() {
                    await this.fetchData();
                    lucide.createIcons();
                },

                async fetchData() {
                    try {
                        this.loading = true;
                        // Use existing api/get_observations.php with status=unresolved
                        const res = await fetch(`api/get_observations.php?status=unresolved&limit=50&page=${this.page}`);
                        const data = await res.json();

                        if (data.success) {
                            if (this.page === 1) {
                                this.observations = data.data;
                            } else {
                                this.observations = [...this.observations, ...data.data];
                            }
                            this.hasMore = data.data.length === 50;

                            // Estimate total unresolved stats
                            if (this.page === 1) {
                                this.stats.unresolved = data.pagination ? data.pagination.total : this.observations.length;
                            }
                        }
                    } catch (e) {
                        console.error('Failed to load missing matrix data', e);
                    } finally {
                        this.loading = false;
                        this.$nextTick(() => lucide.createIcons());
                    }
                },

                async loadMore() {
                    if (!this.hasMore || this.loading) return;
                    this.page++;
                    await this.fetchData();
                },

                get filteredObservations() {
                    return this.observations.filter(obs => {
                        if (this.filter === 'all') return true;
                        if (this.filter === 'unidentified') return !obs.taxon;
                        if (this.filter === 'disputed') return obs.taxon && obs.has_dispute;
                        if (this.filter === 'needs_id') return obs.taxon && !obs.has_dispute;
                        return true;
                    });
                },

                formatDate(d) {
                    if (!d) return '';
                    return new Date(d).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                }
            }
        }
    </script>
</body>

</html>