<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/Lang.php'; // Fix for __()

$id = $_GET['id'] ?? '';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
Lang::init(); // Initialize Language
$currentUser = Auth::user(); // Get current user
$obs = DataStore::findById('observations', $id);

if (!$obs) {
    // Try stripping 'obs_' prefix if present (common user error or legacy link)
    if (strpos($id, 'obs_') === 0) {
        $clean_id = substr($id, 4);
        $obs = DataStore::findById('observations', $clean_id);
    }

    if (!$obs) {
        echo "<div style='text-align:center; padding:50px; color:#1a2e1f; background:#fff;'>";
        echo "<h1>Observation Not Found</h1>";
        echo "<p>ID: " . htmlspecialchars($id) . " could not be found.</p>";
        echo "<a href='index.php' style='color:#10b981;'>Return to Home</a>";
        echo "</div>";
        exit;
    }
}

$is_owner = ($currentUser && isset($obs['user_id']) && $obs['user_id'] === $currentUser['id']);
$meta_title = '名前を提案する';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>

<body class="js-loading font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include('components/nav.php'); ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main class="max-w-xl mx-auto px-6 py-24" x-data="identifier()">
        <a href="observation_detail.php?id=<?php echo $id; ?>" class="inline-flex items-center gap-2 text-muted hover:text-text mb-8 transition">
            <i data-lucide="arrow-left" class="w-4 h-4"></i>
            観察に戻る
        </a>

        <h1 class="text-3xl font-black mb-8">名前を教える</h1>

        <!-- Image Viewer (Carousel + Lightbox) -->
        <div class="mb-12">
            <!-- Lightbox -->
            <div x-show="lightbox" style="display: none;"
                class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-2"
                x-transition.opacity role="dialog" aria-modal="true" aria-labelledby="id-form-lightbox-title"
                @keydown.window.escape.prevent="lightbox = false"
                @keydown.window.left.prevent="active = (active - 1 + <?php echo count($obs['photos']); ?>) % <?php echo count($obs['photos']); ?>"
                @keydown.window.right.prevent="active = (active + 1) % <?php echo count($obs['photos']); ?>">
                <h2 id="id-form-lightbox-title" class="sr-only">観察写真</h2>
                <button @click.stop="lightbox = false" aria-label="閉じる" class="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full z-[101]">
                    <i data-lucide="x"></i>
                </button>
                <img :src="<?php echo htmlspecialchars(json_encode($obs['photos'])); ?>[active]"
                    :alt="'観察写真 ' + (active + 1)"
                    class="max-w-full max-h-full object-contain pointer-events-none select-none">
            </div>

            <!-- Main Card -->
            <div class="aspect-square bg-surface rounded-[2rem] overflow-hidden relative group border border-border shadow-2xl mb-4"
                @click="lightbox = true"
                @touchstart="touchStart = $event.changedTouches[0].screenX"
                @touchend="touchEnd = $event.changedTouches[0].screenX; swipe()">

                <!-- Images -->
                <template x-for="(photo, index) in <?php echo htmlspecialchars(json_encode($obs['photos'])); ?>" :key="index">
                    <img :src="photo" :alt="'観察写真 ' + (index + 1)" class="absolute inset-0 w-full h-full object-contain transition-all duration-500"
                        :class="active === index ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'">
                </template>

                <!-- Hints -->
                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
                    <i data-lucide="maximize-2" class="w-12 h-12 text-white drop-shadow-lg"></i>
                </div>

                <!-- Controls -->
                <?php if (count($obs['photos']) > 1): ?>
                    <button @click.stop="active = (active - 1 + <?php echo count($obs['photos']); ?>) % <?php echo count($obs['photos']); ?>" aria-label="前の写真" class="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition z-20">
                        <i data-lucide="chevron-left" class="w-5 h-5"></i>
                    </button>
                    <button @click.stop="active = (active + 1) % <?php echo count($obs['photos']); ?>" aria-label="次の写真" class="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition z-20">
                        <i data-lucide="chevron-right" class="w-5 h-5"></i>
                    </button>
                    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold tracking-widest z-20">
                        <span x-text="active + 1"></span> / <?php echo count($obs['photos']); ?>
                    </div>
                <?php endif; ?>
            </div>

            <!-- Thumbnails -->
            <?php if (count($obs['photos']) > 1): ?>
                <div class="flex gap-2 overflow-x-auto scrollbar-hide">
                    <?php foreach ($obs['photos'] as $idx => $photo): ?>
                        <button @click.stop="active = <?php echo $idx; ?>" type="button" class="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition" :class="active === <?php echo $idx; ?> ? 'border-green-500 scale-105' : 'border-transparent opacity-50'">
                            <img src="<?php echo $photo; ?>" alt="観察写真 <?php echo $idx + 1; ?>" class="w-full h-full object-cover">
                        </button>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

            <!-- Basic Info -->
            <div class="flex items-center gap-4 mt-4 px-2">
                <div>
                    <p class="text-[10px] font-bold text-faint uppercase tracking-widest">Date</p>
                    <p class="text-sm font-bold text-text"><?php echo date('Y.m.d', strtotime($obs['observed_at'])); ?></p>
                </div>
                <div class="w-px h-8 bg-border"></div>
                <div>
                    <p class="text-[10px] font-bold text-faint uppercase tracking-widest">Location</p>
                    <p class="text-sm font-bold text-text">Hamamatsu</p>
                </div>
            </div>
        </div>

        <form @submit.prevent="submit" class="space-y-8">
            <div class="relative" @click.away="results = []">
                <div class="flex justify-between items-center mb-2">
                    <label class="block text-xs font-bold text-muted uppercase tracking-widest">種名・学名で検索</label>

                </div>
                <div class="relative">
                    <input type="text" x-model="query" @input.debounce.300ms="search" placeholder="アオスジアゲハ、Graphium..." class="w-full bg-surface border border-border rounded-xl px-4 py-4 focus:outline-none focus:border-[var(--color-primary)] transition pl-12">
                    <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]"></i>
                </div>

                <!-- Search Results -->
                <div x-show="results.length > 0" x-cloak class="absolute top-full left-0 right-0 mt-2 bg-white border border-border rounded-2xl overflow-hidden z-50 shadow-2xl">
                    <template x-for="item in results" :key="item.key">
                        <button @click.prevent="select(item)" class="w-full text-left p-4 hover:bg-surface border-b border-border last:border-0 transition">
                            <p class="font-bold flex items-center justify-between">
                                <span x-text="item.canonicalName || item.ja_name || item.scientificName || item.scientific_name"></span>
                                <span class="text-[10px] px-2 py-0.5 rounded-full bg-surface font-normal uppercase" x-text="item.rank"></span>
                            </p>
                            <p class="text-xs text-muted italic" x-text="item.scientificName || item.scientific_name"></p>
                        </button>
                    </template>
                </div>
            </div>

            <!-- Selected Taxon -->
            <div x-show="selected" x-transition class="glass-card p-6 rounded-3xl border-[var(--color-primary)]/30">
                <p class="text-xs font-bold text-[var(--color-primary)] uppercase mb-4 flex items-center gap-2">
                    <i data-lucide="check-circle-2" class="w-4 h-4"></i>
                    選択中
                </p>
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-xl font-bold" x-text="selected ? (selected.canonicalName || selected.ja_name || selected.scientificName || selected.scientific_name) : ''"></h3>
                        <p class="text-sm text-muted italic" x-text="selected ? (selected.scientificName || selected.scientific_name) : ''"></p>
                    </div>
                    <button @click.prevent="selected = null; query = ''" class="p-2 hover:bg-red-500/20 rounded-full transition">
                        <i data-lucide="trash-2" class="w-5 h-5 text-red-500"></i>
                    </button>
                </div>
            </div>

            <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-widest mb-2">提案の自信度</label>
                <div class="grid grid-cols-3 gap-2">
                    <label class="cursor-pointer">
                        <input type="radio" value="maybe" x-model="confidence" class="hidden peer">
                        <div class="text-center p-3 rounded-xl border border-border bg-surface peer-checked:bg-warning/20 peer-checked:text-warning peer-checked:border-warning transition cursor-pointer">
                            <div class="text-lg">🤔</div>
                            <div class="text-xs font-bold mt-1">たぶん</div>
                        </div>
                    </label>
                    <label class="cursor-pointer">
                        <input type="radio" value="sure" x-model="confidence" class="hidden peer">
                        <div class="text-center p-3 rounded-xl border border-border bg-surface peer-checked:bg-primary/20 peer-checked:text-primary peer-checked:border-primary transition cursor-pointer">
                            <div class="text-lg">✅</div>
                            <div class="text-xs font-bold mt-1">自信あり</div>
                        </div>
                    </label>
                    <label class="cursor-pointer">
                        <input type="radio" value="literature" x-model="confidence" class="hidden peer">
                        <div class="text-center p-3 rounded-xl border border-border bg-surface peer-checked:bg-secondary/20 peer-checked:text-secondary peer-checked:border-secondary transition cursor-pointer">
                            <div class="text-lg">📖</div>
                            <div class="text-xs font-bold mt-1">文献確認</div>
                        </div>
                    </label>
                </div>
            </div>

            <!-- Life Stage -->
            <div>
                <div class="flex items-center gap-2 mb-2">
                    <label class="block text-xs font-bold text-muted uppercase tracking-widest">ライフステージ</label>
                    <span class="text-[9px] text-text-secondary bg-surface px-2 py-0.5 rounded-full">任意</span>
                </div>
                <div class="flex flex-wrap gap-2">
                    <template x-for="stage in [
                        {id: 'adult', label: '成体', sub: '成虫・成魚・成獣', icon: 'crown'},
                        {id: 'juvenile', label: '幼体', sub: '幼虫・稚魚・芽生え', icon: 'sprout'},
                        {id: 'egg', label: '卵・種子', sub: '卵塚・胞子も', icon: 'circle-dot'},
                        {id: 'trace', label: '痕跡', sub: '足跡・糞・巣・脱皮', icon: 'footprints'}
                    ]">
                        <label class="cursor-pointer">
                            <input type="radio" :value="stage.id" x-model="life_stage" class="hidden peer">
                            <div class="px-3 py-2 rounded-xl border border-border bg-surface peer-checked:bg-[var(--color-primary)] peer-checked:text-black peer-checked:border-[var(--color-primary)] transition text-muted flex flex-col items-center gap-0.5 min-w-[72px]">
                                <i :data-lucide="stage.icon" class="w-4 h-4"></i>
                                <span class="text-xs font-bold" x-text="stage.label"></span>
                                <span class="text-[8px] opacity-60" x-text="stage.sub"></span>
                            </div>
                        </label>
                    </template>
                    <label class="cursor-pointer">
                        <input type="radio" value="unknown" x-model="life_stage" class="hidden peer">
                        <div class="px-3 py-2 rounded-xl border border-border bg-surface peer-checked:bg-text-secondary peer-checked:text-white peer-checked:border-text-secondary transition text-xs font-bold text-muted flex flex-col items-center gap-0.5 min-w-[72px]">
                            <i data-lucide="help-circle" class="w-4 h-4"></i>
                            不明
                        </div>
                    </label>
                </div>
            </div>

            <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-widest mb-2">提案の根拠・メモ</label>
                <textarea x-model="note" placeholder="例：背中の白い斑点、鳴き声の特徴など..." class="w-full bg-surface border border-border rounded-xl px-4 py-3 h-24 focus:outline-none focus:border-[var(--color-primary)] transition"></textarea>
            </div>

            <button type="submit" :disabled="!selected || submitting" class="btn-primary w-full flex items-center justify-center gap-2" :class="(!selected || submitting) ? 'opacity-50 cursor-not-allowed' : ''">
                <i data-lucide="check-square" x-show="!submitting"></i>
                <span x-show="!submitting">名前を送信する</span>
                <span x-show="submitting">送信中...</span>
            </button>


        </form>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        function identifier() {
            const urlParams = new URLSearchParams(window.location.search);
            return {
                query: urlParams.get('taxon_name') || '',
                results: [],
                selected: null,
                confidence: 'maybe',
                life_stage: 'unknown',
                note: urlParams.get('note') || '',
                submitting: false,
                init() {
                    // If taxon_name was provided, trigger a search immediately
                    if (this.query.length >= 2) {
                        this.search();
                    }
                },
                // Image Gallery State
                active: 0,
                lightbox: false,
                touchStart: 0,
                touchEnd: 0,

                async search() {
                    if (this.query.length < 2) {
                        this.results = [];
                        return;
                    }
                    try {
                        const res = await fetch(`api/search_taxon.php?q=${encodeURIComponent(this.query)}`);
                        const data = await res.json();
                        this.results = data.results || [];
                    } catch (e) {
                        console.error(e);
                    }
                },

                select(item) {
                    this.selected = item;
                    this.results = [];
                    this.query = item.canonicalName || item.ja_name || item.scientificName || item.scientific_name;
                },

                swipe() {
                    if (this.touchStart - this.touchEnd > 50) {
                        // Swipe Left (Next)
                        this.active = (this.active + 1) % <?php echo count($obs['photos']); ?>;
                    }
                    if (this.touchEnd - this.touchStart > 50) {
                        // Swipe Right (Prev)
                        this.active = (this.active - 1 + <?php echo count($obs['photos']); ?>) % <?php echo count($obs['photos']); ?>;
                    }
                },
                async submit() {
                    this.submitting = true;
                    try {
                        const res = await fetch('api/post_identification.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
                            },
                            body: JSON.stringify({
                                observation_id: '<?php echo $id; ?>',
                                taxon_key: this.selected.key || this.selected.gbif_key || null,
                                taxon_name: this.selected.canonicalName || this.selected.ja_name || this.selected.scientificName || this.selected.scientific_name,
                                scientific_name: this.selected.scientificName || this.selected.scientific_name,
                                confidence: this.confidence,
                                life_stage: this.life_stage, // Add life_stage
                                note: this.note,
                                taxon_rank: this.selected.rank || 'species',
                                taxon_slug: this.selected.slug || '',
                                inat_taxon_id: this.selected.inat_taxon_id || null,
                                lineage: this.selected.lineage || {},
                                lineage_ids: this.selected.lineage_ids || {}
                            })
                        });
                        const result = await res.json();
                        if (result.success) {
                            alert('提案ありがとう！ 🌟\n投稿者の助けになったよ！');
                            window.location.href = 'observation_detail.php?id=<?php echo $id; ?>';
                        } else {
                            alert('ごめん、うまく送れなかった 🙇\n' + (result.message || '時間を空けてもう一度試してみてね'));
                        }
                    } catch (e) {
                        console.error(e);
                        alert('通信がうまくいかなかったみたい 📡\n電波の良い場所で試してみてね');
                    } finally {
                        this.submitting = false;
                    }
                }
            }
        }
        lucide.createIcons();
    </script>
</body>

</html>
