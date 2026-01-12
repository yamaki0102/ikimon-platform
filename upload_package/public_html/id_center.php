<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();

if (!Auth::isLoggedIn()) {
    header('Location: login.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ID Workbench - ikimon</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="stylesheet" href="assets/css/input.css">
    <style>
        [x-cloak] { display: none !important; }
    </style>
</head>
<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] overflow-y-scroll">
    <?php include('components/nav.php'); ?>

    <main class="max-w-[1800px] mx-auto pt-16 pb-32 px-4 md:px-8" x-data="idWorkbench()">
        <!-- Header & Filters -->
        <header class="flex flex-col md:flex-row items-center justify-between gap-3 mb-4 sticky top-14 z-30 bg-[#05070a]/95 backdrop-blur-xl py-2 -mx-4 px-4 border-b border-white/5 shadow-2xl">
            <div class="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                <div class="flex items-center gap-3">
                    <h1 class="text-sm md:text-lg font-black flex items-center gap-2 tracking-tight whitespace-nowrap">
                        <div class="w-6 h-6 rounded bg-[var(--color-primary)] text-black flex items-center justify-center">
                            <i data-lucide="microscope" class="w-3.5 h-3.5"></i>
                        </div>
                        ID Workbench
                    </h1>
                    <div class="h-4 w-px bg-white/10 block"></div>
                    <p class="text-gray-500 text-[10px] font-mono whitespace-nowrap">QUEUE: <span x-text="filteredQueue.length" class="text-white font-bold"></span></p>
                </div>
            </div>
            
            <div class="flex items-center gap-2 overflow-x-auto max-w-full pb-1 md:pb-0 scrollbar-hide w-full md:w-auto">
                <!-- Search Group -->
                <div class="flex items-center gap-1 shrink-0">
                    <div class="relative shrink-0 group">
                        <i data-lucide="search" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"></i>
                        <input type="text" x-model="search" placeholder="Filter..." class="bg-white/5 border border-white/10 rounded-lg pl-8 pr-8 py-1.5 text-[11px] font-bold focus:outline-none focus:border-[var(--color-primary)] transition w-28 md:w-32">
                        <!-- Save Button inside input -->
                        <button x-show="search.length > 0" @click="savePreset()" class="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-[var(--color-primary)] hover:scale-110 transition" title="Save as Favorite">
                            <i data-lucide="star" class="w-3 h-3"></i>
                        </button>
                    </div>
                    <!-- Navigator Button -->
                    <button @click="$dispatch('open-navigator')" class="p-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 rounded-lg hover:bg-[var(--color-primary)] hover:text-black transition" title="Bio-Navigator">
                        <i data-lucide="compass" class="w-4 h-4"></i>
                    </button>
                </div>

                <div class="h-6 w-px bg-white/10 md:hidden"></div>

                <!-- Filters -->
                <div class="flex items-center gap-1 shrink-0">
                    <!-- Standard Filters -->
                    <div class="p-0.5 bg-white/5 rounded-lg flex gap-0.5">
                        <button @click="filter = 'all'" :class="filter === 'all' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'" class="px-2.5 py-1 rounded-md text-[10px] font-bold transition">All</button>
                        <button @click="filter = 'unidentified'" :class="filter === 'unidentified' ? 'bg-[var(--color-primary)] text-black shadow-sm' : 'text-gray-500 hover:text-gray-300'" class="px-2.5 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1">
                            <i data-lucide="help-circle" class="w-3 h-3"></i> <span class="hidden lg:inline">Unidentified</span><span class="lg:hidden">UnID</span>
                        </button>
                        <button @click="filter = 'check'" :class="filter === 'check' ? 'bg-purple-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'" class="px-2.5 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1">
                            <i data-lucide="check-circle-2" class="w-3 h-3"></i> Verify
                        </button>
                    </div>

                    <!-- Local Filters -->
                    <div class="p-0.5 bg-white/5 rounded-lg flex gap-0.5 border-l border-white/5 pl-1">
                         <button @click="filter = 'pinned'" :class="filter === 'pinned' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'text-gray-500 hover:text-gray-300'" class="px-2.5 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1">
                            <i data-lucide="bookmark" class="w-3 h-3"></i> <span class="hidden md:inline">Pin</span>
                        </button>
                         <button @click="filter = 'passed'" :class="filter === 'passed' ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'text-gray-500 hover:text-gray-300'" class="px-2.5 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1">
                            <i data-lucide="x" class="w-3 h-3"></i> <span class="hidden md:inline">Pass</span>
                        </button>
                    </div>

                    <!-- Presets -->
                    <template x-if="presets.length > 0">
                        <div class="flex items-center gap-1 border-l border-white/5 pl-2 ml-1">
                            <template x-for="(p, idx) in presets" :key="idx">
                                <div class="group/p relative">
                                    <button @click="search = p.query" class="px-2.5 py-1 pl-2.5 pr-6 rounded-md text-[10px] font-bold transition flex items-center gap-1 border hover:bg-white/5" :class="search === p.query ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/30' : 'text-gray-400 border-white/5 bg-[#05070a]'">
                                        <i data-lucide="tag" class="w-2.5 h-2.5 opacity-50"></i>
                                        <span x-text="p.label"></span>
                                    </button>
                                    <button @click.stop="removePreset(idx)" class="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-red-500 rounded-full hover:bg-white/10 transition">
                                        <i data-lucide="x" class="w-2.5 h-2.5"></i>
                                    </button>
                                </div>
                            </template>
                        </div>
                    </template>
                </div>
            </div>
        </header>

        <!-- Loading -->
        <div x-show="loading" class="py-32 text-center">
            <div class="w-12 h-12 border-4 border-white/5 border-t-[var(--color-primary)] rounded-full animate-spin mx-auto mb-6"></div>
            <p class="text-gray-500 text-xs font-bold uppercase tracking-widest animate-pulse">Synchronizing Queue...</p>
        </div>

        <!-- Grid -->
        <div x-show="!loading" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3" x-transition.opacity>
            <template x-for="item in filteredQueue" :key="item.id">
                <div class="group relative aspect-[4/5] bg-[#111] rounded-xl overflow-hidden border border-white/5 hover:border-[var(--color-primary)]/50 transition duration-300 shadow-2xl">
                    
                    <!-- Image -->
                    <img :src="item.photos[0]" loading="lazy" class="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition duration-500 scale-100 group-hover:scale-110">
                    
                    <!-- Top Status -->
                    <div class="absolute top-0 left-0 w-full p-2 flex justify-between items-start z-10 pointer-events-none">
                        <span x-show="item.taxon" class="px-1.5 py-0.5 bg-black/60 text-white text-[9px] font-bold rounded border border-white/10 backdrop-blur-md flex items-center gap-1">
                            <i data-lucide="message-square" class="w-2.5 h-2.5 text-[var(--color-primary)]"></i> Prop
                        </span>
                        <span x-show="!item.taxon" class="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[9px] font-bold rounded border border-red-500/30 backdrop-blur-md">
                            UnID
                        </span>
                    </div>

                    <!-- Overlay Info & Controls -->
                    <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent p-3 flex flex-col justify-end translate-y-2 group-hover:translate-y-0 transition duration-300">
                        
                        <div class="mb-2 transform transition duration-300">
                            <p class="text-[9px] text-gray-400 mb-0.5 font-mono flex items-center gap-1">
                                <i data-lucide="calendar" class="w-2.5 h-2.5"></i> <span x-text="formatDate(item.observed_at)"></span>
                            </p>
                            <h3 class="font-bold text-xs leading-tight text-white line-clamp-2 min-h-[2.5em] group-hover:text-[var(--color-primary)] transition" x-text="item.taxon ? item.taxon.name : 'Unknown Species'"></h3>
                        </div>
                        
                        <!-- Quick Actions Toolbar -->
                        <div class="grid grid-cols-3 gap-1 pt-2 border-t border-white/10 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200" @click.stop>
                            <!-- ID -->
                            <button @click="openID(item)" class="flex flex-col items-center justify-center py-1.5 rounded bg-white/5 hover:bg-[var(--color-primary)] hover:text-black text-gray-400 transition group/btn" title="Identify">
                                <i data-lucide="search" class="w-3.5 h-3.5 mb-0.5 group-hover/btn:scale-110 transition"></i>
                                <span class="text-[8px] font-bold uppercase">View</span>
                            </button>
                            <!-- Later -->
                            <button @click="markLater(item.id)" class="flex flex-col items-center justify-center py-1.5 rounded bg-white/5 hover:bg-yellow-500 hover:text-black text-gray-400 transition group/btn" title="Pin / Later">
                                <i data-lucide="bookmark" class="w-3.5 h-3.5 mb-0.5 group-hover/btn:scale-110 transition"></i>
                                <span class="text-[8px] font-bold uppercase">Pin</span>
                            </button>
                            <!-- Pass -->
                            <button @click="markPass(item.id)" class="flex flex-col items-center justify-center py-1.5 rounded bg-white/5 hover:bg-red-500 hover:text-white text-gray-400 transition group/btn" title="Pass / Hide">
                                <i data-lucide="x" class="w-3.5 h-3.5 mb-0.5 group-hover/btn:scale-110 transition"></i>
                                <span class="text-[8px] font-bold uppercase">Pass</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Click whole card link -->
                    <a :href="'observation_detail.php?id=' + item.id" class="absolute inset-0 z-0"></a>
                </div>
            </template>
        </div>

        <!-- Empty State -->
        <div x-show="!loading && filteredQueue.length === 0" class="py-40 text-center text-gray-600 flex flex-col items-center justify-center">
            <div class="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <i data-lucide="check-circle" class="w-10 h-10 text-green-500"></i>
            </div>
            <h2 class="text-2xl font-black text-white mb-2">All Caught Up!</h2>
            <p>Your queue is empty based on current filters.</p>
            <button @click="filter = 'all'" class="mt-8 text-sm text-[var(--color-primary)] hover:underline">Reset Filters</button>
        </div>
        
    </main>

    <?php include('components/navigator.php'); ?>
    
    <script>
        function idWorkbench() {
            return {
                loading: true,
                queue: [],
                filter: 'all', 
                search: '',
                skipped: [],
                later: [],
                presets: [],

                init() {
                    this.loadLocal();
                    this.fetchQueue();
                },
                
                handleNavigator(detail) {
                    this.search = detail.query;
                    // Optional: save to presets automatically? 
                    // Let's not. User can save it if they want.
                },
                
                loadLocal() {
                    try {
                        const s = localStorage.getItem('ikimon_skipped_ids');
                        if(s) this.skipped = JSON.parse(s);
                        const l = localStorage.getItem('ikimon_later_ids');
                        if(l) this.later = JSON.parse(l);
                        const p = localStorage.getItem('ikimon_search_presets');
                        if(p) this.presets = JSON.parse(p);
                    } catch(e) {}
                },

                async fetchQueue() {
                    this.loading = true;
                    try {
                        // Fetching expanded list 
                        const res = await fetch('api/get_observations.php?status=unresolved&limit=200'); 
                        const data = await res.json();
                        this.queue = data.data;
                    } catch(e) { console.error(e); }
                    finally { 
                        this.loading = false;
                        this.$nextTick(() => lucide.createIcons());
                    }
                },

                get filteredQueue() {
                    return this.queue.filter(item => {
                        // 1. Search text
                        if (this.search) {
                            const q = this.search.toLowerCase();
                            const name = item.taxon ? item.taxon.name : '';
                            const sname = item.taxon ? item.taxon.scientific_name : '';
                            if (!name.toLowerCase().includes(q) && !sname.toLowerCase().includes(q)) return false;
                        }

                        if (this.filter === 'pinned') return this.later.includes(item.id);
                        if (this.filter === 'passed') return this.skipped.includes(item.id);

                        // Exclude skipped items by default unless explicitly filtering for them
                        if (this.skipped.includes(item.id)) return false;
                        
                        // 3. Filter logic
                        if(this.filter === 'unidentified') {
                            return !item.taxon; 
                        }
                        if(this.filter === 'check') {
                            return !!item.taxon; // Validation mode
                        }
                        return true;
                    });
                },

                savePreset() {
                    if(!this.search) return;
                    if(this.presets.some(p => p.query === this.search)) return;
                    const label = this.search.length > 8 ? this.search.substring(0, 8) + '...' : this.search;
                    this.presets.push({ label: label, query: this.search });
                    localStorage.setItem('ikimon_search_presets', JSON.stringify(this.presets));
                    this.$nextTick(() => lucide.createIcons());
                },

                removePreset(index) {
                    this.presets.splice(index, 1);
                    localStorage.setItem('ikimon_search_presets', JSON.stringify(this.presets));
                },

                markPass(id) {
                    if(!this.skipped.includes(id)) {
                        this.skipped.push(id);
                        localStorage.setItem('ikimon_skipped_ids', JSON.stringify(this.skipped));
                    }
                },

                markLater(id) {
                    if(!this.later.includes(id)) {
                        this.later.push(id);
                        localStorage.setItem('ikimon_later_ids', JSON.stringify(this.later));
                    }
                },
                
                openID(item) {
                     window.location.href = 'id_form.php?id=' + item.id;
                },

                formatDate(d) {
                    return new Date(d).toLocaleDateString('ja-JP', {month: 'short', day: 'numeric'});
                }
            }
        }
    </script>
</body>
</html>
