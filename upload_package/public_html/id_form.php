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
        echo "<div style='text-align:center; padding:50px; color:white; background:#111;'>";
        echo "<h1>Observation Not Found</h1>";
        echo "<p>ID: " . htmlspecialchars($id) . " could not be found.</p>";
        echo "<a href='index.php' style='color:orange;'>Return to Home</a>";
        echo "</div>";
        exit;
    }
}

$is_owner = ($currentUser && isset($obs['user_id']) && $obs['user_id'] === $currentUser['id']);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>名前を提案する - ikimon</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="stylesheet" href="assets/css/input.css">
    <style>
        [x-cloak] { display: none !important; }
    </style>
</head>
<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">
    <?php include('components/nav.php'); ?>
    <script>document.body.classList.remove('js-loading');</script>

    <main class="max-w-xl mx-auto px-6 py-24" x-data="identifier()" 
          x-init="<?php if(isset($_GET['navigator'])) echo "setTimeout(() => \$dispatch('open-navigator'), 100);"; ?>">
        <a href="observation_detail.php?id=<?php echo $id; ?>" class="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition">
            <i data-lucide="arrow-left" class="w-4 h-4"></i>
            観察に戻る
        </a>

        <h1 class="text-3xl font-black mb-8">名前を教える</h1>

        <!-- Image Viewer (Carousel + Lightbox) -->
        <div class="mb-12">
            <!-- Lightbox -->
            <div x-show="lightbox" style="display: none;" 
                 class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-2" 
                 x-transition.opacity>
                <button @click.stop="lightbox = false" class="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full z-[101]">
                    <i data-lucide="x"></i>
                </button>
                <img :src="<?php echo htmlspecialchars(json_encode($obs['photos'])); ?>[active]" 
                     class="max-w-full max-h-full object-contain pointer-events-none select-none">
            </div>

            <!-- Main Card -->
            <div class="aspect-square bg-black/40 rounded-[2rem] overflow-hidden relative group border border-white/10 shadow-2xl mb-4"
                 @click="lightbox = true"
                 @touchstart="touchStart = $event.changedTouches[0].screenX"
                 @touchend="touchEnd = $event.changedTouches[0].screenX; swipe()">
                
                 <!-- Images -->
                 <template x-for="(photo, index) in <?php echo htmlspecialchars(json_encode($obs['photos'])); ?>" :key="index">
                    <img :src="photo" class="absolute inset-0 w-full h-full object-contain transition-all duration-500" 
                         :class="active === index ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'">
                </template>

                <!-- Hints -->
                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
                    <i data-lucide="maximize-2" class="w-12 h-12 text-white drop-shadow-lg"></i>
                </div>

                <!-- Controls -->
                <?php if (count($obs['photos']) > 1): ?>
                <button @click.stop="active = (active - 1 + <?php echo count($obs['photos']); ?>) % <?php echo count($obs['photos']); ?>" class="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition z-20">
                    <i data-lucide="chevron-left" class="w-5 h-5"></i>
                </button>
                <button @click.stop="active = (active + 1) % <?php echo count($obs['photos']); ?>" class="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition z-20">
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
                    <img src="<?php echo $photo; ?>" class="w-full h-full object-cover">
                </button>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>

            <!-- Basic Info -->
            <div class="flex items-center gap-4 mt-4 px-2">
                 <div>
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</p>
                    <p class="text-sm font-bold text-white"><?php echo date('Y.m.d', strtotime($obs['observed_at'])); ?></p>
                 </div>
                 <div class="w-px h-8 bg-white/10"></div>
                 <div>
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Location</p>
                    <p class="text-sm font-bold text-white">Hamamatsu</p>
                 </div>
            </div>
        </div>

        <form @submit.prevent="submit" class="space-y-8">
            <div class="relative" @click.away="results = []">
                <div class="flex justify-between items-center mb-2">
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest">種名・学名で検索</label>
                    <?php if ($is_owner): ?>
                    <button type="button" @click="$dispatch('open-navigator')" class="text-xs font-bold text-[var(--color-primary)] flex items-center gap-1 bg-[var(--color-primary)]/10 px-3 py-1.5 rounded-full hover:bg-[var(--color-primary)]/20 transition">
                        <i data-lucide="compass" class="w-3 h-3"></i>
                        ナビで調べる
                    </button>
                    <?php endif; ?>
                </div>
                <div class="relative">
                    <input type="text" x-model="query" @input.debounce.300ms="search" placeholder="アオスジアゲハ、Graphium..." class="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-4 focus:outline-none focus:border-[var(--color-primary)] transition pl-12">
                    <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]"></i>
                </div>

                <!-- Search Results -->
                <div x-show="results.length > 0" x-cloak class="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl">
                    <template x-for="item in results" :key="item.key">
                        <button @click.prevent="select(item)" class="w-full text-left p-4 hover:bg-white/5 border-b border-white/5 last:border-0 transition">
                            <p class="font-bold flex items-center justify-between">
                                <span x-text="item.canonicalName"></span>
                                <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 font-normal uppercase" x-text="item.rank"></span>
                            </p>
                            <p class="text-xs text-gray-500 italic" x-text="item.scientificName"></p>
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
                        <h3 class="text-xl font-bold" x-text="selected ? selected.canonicalName : ''"></h3>
                        <p class="text-sm text-gray-500 italic" x-text="selected ? selected.scientificName : ''"></p>
                    </div>
                    <button @click.prevent="selected = null; query = ''" class="p-2 hover:bg-red-500/20 rounded-full transition">
                        <i data-lucide="trash-2" class="w-5 h-5 text-red-500"></i>
                    </button>
                </div>
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">提案の自信度</label>
                <div class="grid grid-cols-3 gap-2">
                    <template x-for="level in ['確実', 'たぶん', '自信なし']">
                        <label class="flex-1">
                            <input type="radio" :value="level" x-model="confidence" class="hidden peer">
                            <div class="text-center py-3 rounded-xl border border-white/10 bg-white/5 peer-checked:bg-green-500 peer-checked:text-black peer-checked:border-green-500 transition cursor-pointer text-sm font-bold" x-text="level"></div>
                        </label>
                    </template>
                </div>
                </div>
            </div>

            <!-- Life Stage -->
            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">ライフステージ</label>
                <div class="flex flex-wrap gap-2">
                    <template x-for="stage in [
                        {id: 'adult', label: '成体', icon: 'bug'},
                        {id: 'larva', label: '幼生', icon: 'nut'},
                        {id: 'pupa', label: 'サナギ', icon: 'package'},
                        {id: 'egg', label: '卵', icon: 'circle'},
                        {id: 'exuviae', label: '痕跡', icon: 'ghost'}
                    ]">
                        <label class="cursor-pointer">
                            <input type="radio" :value="stage.id" x-model="life_stage" class="hidden peer">
                            <div class="px-4 py-2 rounded-xl border border-white/10 bg-white/5 peer-checked:bg-[var(--color-primary)] peer-checked:text-black peer-checked:border-[var(--color-primary)] transition text-xs font-bold text-gray-400 flex items-center gap-1">
                                <i :data-lucide="stage.icon" class="w-3 h-3"></i>
                                <span x-text="stage.label"></span>
                            </div>
                        </label>
                    </template>
                    <label class="cursor-pointer">
                        <input type="radio" value="unknown" x-model="life_stage" class="hidden peer">
                        <div class="px-4 py-2 rounded-xl border border-white/10 bg-white/5 peer-checked:bg-gray-500 peer-checked:text-white peer-checked:border-gray-500 transition text-xs font-bold text-gray-400">
                            不明
                        </div>
                    </label>
                </div>
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">提案の根拠・メモ</label>
                <textarea x-model="note" placeholder="例：背中の白い斑点、鳴き声の特徴など..." class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 h-24 focus:outline-none focus:border-[var(--color-primary)] transition"></textarea>
            </div>

            <button type="submit" :disabled="!selected || submitting" class="btn-primary w-full flex items-center justify-center gap-2" :class="(!selected || submitting) ? 'opacity-50 cursor-not-allowed' : ''">
                <i data-lucide="check-square" x-show="!submitting"></i>
                <span x-show="!submitting">名前を送信する</span>
                <span x-show="submitting">送信中...</span>
            </button>

            <!-- Navigator Component (Only for Owner) -->
            <?php if ($is_owner): ?>
            <div @navigator-result.window="
                query = $event.detail.query; 
                if($event.detail.life_stage !== 'unknown') life_stage = $event.detail.life_stage;
                // Auto-select if exact match logic could go here, for now just fill query
                search(); // Trigger search with result
            ">
                <?php include __DIR__ . '/components/navigator.php'; ?>
            </div>
            <?php endif; ?>
        </form>
    </main>

    <script>
        function identifier() {
            return {
                query: '',
                results: [],
                selected: null,
                confidence: '確実',
                life_stage: 'unknown',
                note: '',
                submitting: false,
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
                        this.results = await res.json();
                    } catch (e) {
                        console.error(e);
                    }
                },

                select(item) {
                    this.selected = item;
                    this.results = [];
                    this.query = item.canonicalName;
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
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                observation_id: '<?php echo $id; ?>',
                                taxon_key: this.selected.key,
                                taxon_name: this.selected.canonicalName,
                                scientific_name: this.selected.scientificName,
                                confidence: this.confidence,
                                life_stage: this.life_stage, // Add life_stage
                                note: this.note
                            })
                        });
                        const result = await res.json();
                        if (result.success) {
                            alert('提案を送信しました！');
                            window.location.href = 'observation_detail.php?id=<?php echo $id; ?>';
                        } else {
                            alert('エラー: ' + result.message);
                        }
                    } catch (e) {
                        console.error(e);
                        alert('送信に失敗しました');
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
