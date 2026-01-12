<?php
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/Taxon.php';

Auth::init();
$currentUser = Auth::user();

// Fetch ALL unidentified observations for the "Cockpit" (Limit 200 for demo)
// In a real app, this would be paginated or lazy-loaded via API.
// We mix "My Unidentified" and "Others" for now, or just show everything.
$observations = DataStore::getLatest('observations', 200, function($item) {
    return empty($item['taxon']['id']); // Unidentified only
});

// PATCH: Force Valid Images for Demo (Overwrite ALL)
// This ensures no broken relative paths or dead links cause black screens.
foreach ($observations as &$obs) {
    // Generate a consistent random ID for correct caching/visuals
    $seed = isset($obs['id']) ? substr(md5($obs['id']), 0, 6) : rand();
    
    // Create 1-3 random photos
    $photos = [];
    $count = rand(1, 3);
    for ($i=0; $i<$count; $i++) {
        $photos[] = 'https://picsum.photos/800/600?random=' . $seed . $i;
    }
    $obs['photos'] = $photos;
}
unset($obs);

// JSON Encode for Alpine
$jsonObservations = json_encode($observations);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php 
    $meta_title = "ID Cockpit";
    include __DIR__ . '/components/meta.php'; 
    ?>
    <style>
        /* Cockpit Specific Styles */
        body { overflow: hidden; height: 100vh; background-color: #0d0d0d; }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: #1a1a1a; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #555; }
        
        /* Grid Selection */
        .item-selected { outline: 2px solid #fbbf24; outline-offset: -2px; }
        .item-active { border-color: white; }
    </style>
</head>
<body x-data="cockpit()" @keydown.window="handleKeydown($event)">

    <!-- Top Bar (Toolbar) -->
    <header class="h-12 bg-[#1a1a1a] border-b border-white/5 flex items-center justify-between px-4 z-20">
        <div class="flex items-center gap-4">
            <h1 class="text-sm font-black italic text-gray-400 flex items-center gap-2">
                <i data-lucide="layers" class="text-orange-500 w-4 h-4"></i>
                ID COCKPIT
            </h1>
            <div class="h-6 w-px bg-white/10"></div>
            <!-- View Modes -->
            <div class="flex bg-black/50 rounded-lg p-0.5">
                <button class="p-1.5 rounded text-white bg-white/10" title="Grid View"><i data-lucide="grid" class="w-4 h-4"></i></button>
                <button class="p-1.5 rounded text-gray-500 hover:text-white" title="Compare View"><i data-lucide="columns" class="w-4 h-4"></i></button>
            </div>
            <!-- Selection Count -->
            <div class="text-xs font-mono text-gray-500" x-show="selectedIds.length > 0">
                <span class="text-orange-400 font-bold" x-text="selectedIds.length"></span> items selected
            </div>
        </div>

        <div class="flex items-center gap-4">
            <div class="text-[10px] text-gray-600 font-mono hidden lg:block">
                SHOTCUTS: [1-5]:Rate [Del]:Hide [Ctrl+A]:All
            </div>
            <a href="index.php" class="text-xs font-bold text-gray-500 hover:text-white">Exit</a>
        </div>
    </header>

    <!-- Main Layout (Responsive Switch) -->
    <div class="hidden md:flex h-[calc(100vh-48px)] bg-[#050505] relative overflow-hidden">
        
            <!-- LEFT PANEL: Filters -->
            <aside class="w-64 bg-[#111] border-r border-white/5 flex flex-col">
                <!-- Source -->
                <div class="p-4 border-b border-white/5">
                    <h3 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">ソース</h3>
                    <div class="space-y-1">
                        <button class="w-full text-left px-3 py-2 rounded text-xs font-bold text-orange-400 bg-orange-500/10 flex items-center gap-2">
                            <i data-lucide="inbox" class="w-3.5 h-3.5"></i>
                            未同定の投稿
                            <span class="ml-auto text-[10px] opacity-60" x-text="items.length"></span>
                        </button>
                    </div>
                </div>
                <!-- Filter Input -->
                <div class="p-4 border-b border-white/5">
                    <h3 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">絞り込み</h3>
                    <div class="relative">
                        <i data-lucide="search" class="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-500"></i>
                        <input type="text" x-model="filterText" placeholder="種名や場所で検索..." 
                               class="w-full bg-black border border-white/10 rounded px-2 pl-8 py-1.5 text-xs text-white focus:border-orange-500 outline-none placeholder-gray-600">
                    </div>
                </div>
                <!-- Metadata Filters -->
                <div class="p-4 flex-1 overflow-y-auto scrollbar-thin">
                    <h3 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">メタデータ</h3>
                    <div class="mb-4">
                        <div class="flex items-center justify-between text-xs text-gray-300 mb-1 cursor-pointer">
                            <span>撮影年月</span>
                            <i data-lucide="chevron-down" class="w-3 h-3"></i>
                        </div>
                        <div class="pl-2 border-l border-white/10 space-y-1 mt-1 text-[11px] text-gray-500">
                            <div>2025年 (120)</div>
                        </div>
                    </div>
                </div>
            </aside>

            <!-- CENTER PANEL: Grid -->
            <main class="flex-1 bg-[#050505] flex flex-col relative min-w-0" @click.self="clearSelection()">
                <!-- Grid Toolbar -->
                <div class="h-10 bg-[#161616] border-b border-white/5 flex items-center px-4 justify-between shrink-0">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold text-gray-500">並び順:</span>
                        <select class="bg-black border border-white/10 text-[10px] text-gray-300 rounded px-2 py-0.5 focus:border-orange-500 outline-none">
                            <option>撮影日（新しい順）</option>
                            <option>撮影日（古い順）</option>
                        </select>
                        <span x-show="filterText" class="text-[10px] text-orange-400 ml-2" x-text="'絞り込み中: ' + filteredItems.length + '件'"></span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] text-gray-500">表示サイズ</span>
                        <input type="range" class="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" min="1" max="5" value="3" @input="gridCols = $event.target.value">
                    </div>
                </div>

                <!-- Grid Logic -->
                <div class="flex-1 overflow-y-auto p-4 scrollbar-thin" @click.self="clearSelection()">
                    <div class="grid gap-2" :class="gridClasses">
                        <template x-for="(item, index) in filteredItems" :key="item.id ? (item.id + '_' + index) : index">
                            <div class="relative group aspect-[4/3] bg-[#111] rounded overflow-hidden select-none transition-all duration-75"
                                    :class="{ 
                                        'item-selected': selectedIds.includes(item.id), 
                                        'ring-1 ring-white/20': !selectedIds.includes(item.id),
                                        'opacity-50 grayscale': passItems.includes(item.id),
                                        'ring-blue-500/50': laterItems.includes(item.id)
                                    }">
                                <!-- Main Image (Click to Zoom) -->
                                <img :src="item.photos[0]" 
                                     @click.stop="viewItem(index)"
                                     class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition cursor-zoom-in">
                                
                                <!-- Markers -->
                                <div class="absolute top-1 left-1 flex gap-1 pointer-events-none">
                                    <span x-show="passItems.includes(item.id)" class="px-1 py-px bg-red-500/80 rounded text-[9px] text-white font-bold">パス</span>
                                    <span x-show="laterItems.includes(item.id)" class="px-1 py-px bg-blue-500/80 rounded text-[9px] text-white font-bold">あとで</span>
                                </div>

                                <!-- Selection Checkbox (Click to Select) -->
                                <div class="absolute top-0 right-0 p-2 cursor-pointer" @click.stop="toggleSelect(item.id, index, $event)">
                                    <div class="w-5 h-5 rounded-full border border-white/30 bg-black/40 flex items-center justify-center transition hover:bg-black/60"
                                            :class="selectedIds.includes(item.id) ? '!bg-orange-500 !border-orange-500' : ''">
                                        <i x-show="selectedIds.includes(item.id)" data-lucide="check" class="w-3.5 h-3.5 text-white"></i>
                                    </div>
                                </div>

                                <!-- Desktop Actions (Hover) -->
                                <div class="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" @click.stop>
                                    <button @click="markSignal(item.id, 'pass')" 
                                            class="p-1.5 rounded-full bg-white/10 hover:bg-red-600 text-white transition backdrop-blur-sm" 
                                            :class="passItems.includes(item.id) ? 'bg-red-600' : ''"
                                            title="パス (Pass)">
                                        <i data-lucide="ban" class="w-3.5 h-3.5"></i>
                                    </button>
                                    <button @click="markSignal(item.id, 'later')" 
                                            class="p-1.5 rounded-full bg-white/10 hover:bg-blue-600 text-white transition backdrop-blur-sm"
                                            :class="laterItems.includes(item.id) ? 'bg-blue-600' : ''"
                                            title="あとで (Later)">
                                        <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                                    </button>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </main>

            <!-- RIGHT PANEL: Inspector (Unchanged) -->
            <aside class="w-80 bg-[#111] border-l border-white/5 flex flex-col lg:w-96">
                <!-- Selection Summary & Input -->
                <div class="p-4 border-b border-white/5 bg-[#161616]">
                    <div class="flex items-center gap-2 mb-2">
                         <span class="text-xs font-bold text-gray-300" x-text="selectedIds.length > 0 ? selectedIds.length + '枚を選択中' : '未選択'"></span>
                    </div>
                </div>
                <div class="p-4 flex-1 overflow-y-auto" x-show="selectedIds.length > 0">
                    <h3 class="text-[10px] font-bold text-gray-500 uppercase mb-4">一括同定</h3>
                    <div class="flex flex-wrap gap-2 mb-6">
                        <button @click="applyTaxon('Corvus macrorhynchos', 'ハシブトガラス')" class="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-gray-300 hover:bg-white/10 transition">ハシブトガラス</button>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-[10px] font-bold text-gray-500 mb-1">種名を入力</label>
                            <input type="text" placeholder="カラス..." class="w-full bg-black border border-white/20 rounded px-3 py-2 text-sm text-white outline-none focus:border-orange-500">
                        </div>
                        <button class="w-full py-3 bg-orange-600 font-bold text-sm text-white rounded hover:bg-orange-500 transition shadow-lg">決定・適用</button>
                    </div>
                </div>
                <!-- Empty State -->
                <div class="p-4 flex-1 flex flex-col items-center justify-center text-gray-600 space-y-2" x-show="selectedIds.length === 0">
                    <i data-lucide="mouse-pointer-2" class="w-8 h-8 opacity-20"></i>
                    <p class="text-xs text-center">写真を選択して同定を入力</p>
                    <div class="text-[10px] font-mono bg-white/5 px-2 py-1 rounded">
                        Shift + Click で範囲選択
                    </div>
                </div>
            </aside>
        </div>


        <!-- ============================================== -->
        <!-- MOBILE VIEW: Deck UI (md:hidden)             -->
        <!-- ============================================== -->
        <div class="md:hidden h-full flex flex-col relative select-none">
            
            <!-- Deck Area (Main) -->
            <div class="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                
                <template x-if="items.length > 0 && currentMobileItem">
                    <div class="relative w-full h-full p-4 flex flex-col items-center justify-center">
                        
                        <!-- Current Card -->
                        <div class="w-full aspect-[4/5] max-h-[70vh] rounded-2xl overflow-hidden shadow-2xl relative bg-[#1a1a1a] border border-white/10 group">
                            <!-- Main Photo -->
                            <img :src="currentMobileItem.photos[photoIndex]" 
                                 @click="openLightbox()"
                                 class="w-full h-full object-cover transition duration-300 active:scale-95 cursor-zoom-in">
                            
                            <!-- Badges (Top Left) -->
                            <div class="absolute top-3 left-3 flex flex-col gap-1">
                                <span x-show="passItems.includes(currentMobileItem.id)" class="px-2 py-1 bg-red-600 shadow-lg rounded text-[10px] font-bold text-white tracking-widest flex items-center gap-1">
                                    <i data-lucide="ban" class="w-3 h-3"></i> パス
                                </span>
                                <span x-show="laterItems.includes(currentMobileItem.id)" class="px-2 py-1 bg-blue-600 shadow-lg rounded text-[10px] font-bold text-white tracking-widest flex items-center gap-1">
                                    <i data-lucide="clock" class="w-3 h-3"></i> あとで
                                </span>
                            </div>

                            <!-- Multiple Photos Indicator (Top Right) -->
                            <template x-if="currentMobileItem.photos.length > 1">
                                <div class="absolute top-3 right-3 bg-black/50 backdrop-blur rounded-full px-3 py-1 text-xs font-bold text-white flex items-center gap-1 border border-white/10 pointer-events-none">
                                    <i data-lucide="layers" class="w-3 h-3"></i>
                                    <span x-text="(photoIndex + 1) + '/' + currentMobileItem.photos.length"></span>
                                </div>
                            </template>

                            <!-- Mini Photo Nav (Overlay) -->
                            <div class="absolute inset-y-0 inset-x-0 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition pointer-events-none">
                                <button x-show="photoIndex > 0" @click.stop="prevPhoto()" class="pointer-events-auto p-2 rounded-full bg-black/50 text-white hover:bg-black/70"><i data-lucide="chevron-left" class="w-6 h-6"></i></button>
                                <div class="flex-1"></div>
                                <button x-show="photoIndex < currentMobileItem.photos.length - 1" @click.stop="nextPhoto()" class="pointer-events-auto p-2 rounded-full bg-black/50 text-white hover:bg-black/70"><i data-lucide="chevron-right" class="w-6 h-6"></i></button>
                            </div>
                            
                            <!-- Overlay Info -->
                            <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pointer-events-none">
                                <div class="text-xs font-mono text-gray-400 mb-1" x-text="formatDate(currentMobileItem.observed_at)"></div>
                                <div class="text-lg font-bold text-white leading-tight" x-text="(currentMobileItem.location && currentMobileItem.location.name) ? currentMobileItem.location.name : '場所不明'"></div>
                            </div>
                        </div>

                        <!-- Progress / Pass Feedback -->
                         <div class="mt-4 text-xs text-gray-500 font-bold tracking-widest uppercase">
                            <span x-show="passItems.includes(currentMobileItem.id)">パス済み</span>
                            <span x-show="laterItems.includes(currentMobileItem.id)">あとで確認</span>
                         </div>
                    </div>
                </template>
                <template x-if="items.length === 0">
                    <div class="text-gray-500">投稿がありません</div>
                </template>
            </div>



            <!-- Bottom Action Bar (Thumb Zone) -->
            <div class="h-24 bg-[#111] border-t border-white/5 px-4 flex items-center justify-between z-20 pb-4 gap-2">
                
                <!-- PASS Button -->
                <button @click="markSignal(currentMobileItem.id, 'pass'); nextItem()" class="flex flex-col items-center gap-1 text-gray-500 active:scale-90 transition w-14">
                    <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-red-500 hover:bg-red-500/20">
                        <i data-lucide="ban" class="w-5 h-5"></i>
                    </div>
                    <span class="text-[9px] font-bold text-red-500/70">パス</span>
                </button>

                <!-- Back -->
                <button @click="prevItem()" class="flex flex-col items-center gap-1 text-gray-500 active:scale-90 transition w-14">
                    <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                        <i data-lucide="undo-2" class="w-4 h-4"></i>
                    </div>
                    <span class="text-[9px] font-bold">戻る</span>
                </button>

                <!-- Identify (Main) -->
                <button @click="mobileInputOpen = true" class="flex flex-col items-center gap-1 -mt-8 active:scale-95 transition">
                    <div class="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-900/40 border-4 border-[#111]">
                        <i data-lucide="search" class="w-8 h-8 text-white"></i>
                    </div>
                    <span class="text-xs font-bold text-orange-500">同定</span>
                </button>

                <!-- Skip -->
                <button @click="nextItem()" class="flex flex-col items-center gap-1 text-gray-500 active:scale-90 transition w-14">
                    <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                        <i data-lucide="skip-forward" class="w-4 h-4"></i>
                    </div>
                    <span class="text-[9px] font-bold">次へ</span>
                </button>

                <!-- LATER Button -->
                <button @click="markSignal(currentMobileItem.id, 'later'); nextItem()" class="flex flex-col items-center gap-1 text-gray-500 active:scale-90 transition w-14">
                    <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-blue-500 hover:bg-blue-500/20">
                        <i data-lucide="clock" class="w-5 h-5"></i>
                    </div>
                    <span class="text-[9px] font-bold text-blue-500/70">あとで</span>
                </button>
            </div>

            <!-- Mobile Input Sheet (Overlay) -->
            <div x-show="mobileInputOpen" 
                 x-transition.opacity 
                 class="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center" x-cloak>
                 
                 <div class="bg-[#1a1a1a] w-full rounded-t-3xl border-t border-white/10 p-6 pb-12" @click.outside="mobileInputOpen = false">
                    <div class="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6"></div>
                    <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">種名を入力</h3>
                    
                    <div class="space-y-4">
                        <input type="text" placeholder="種名を入力..." class="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-base text-white outline-none focus:border-orange-500">
                        
                        <div class="flex overflow-x-auto gap-2 py-2">
                             <button class="whitespace-nowrap px-3 py-1.5 bg-white/5 rounded-lg text-xs text-gray-300">候補: カラス</button>
                             <button class="whitespace-nowrap px-3 py-1.5 bg-white/5 rounded-lg text-xs text-gray-300">候補: スズメ</button>
                        </div>

                        <button @click="mobileInputOpen = false; nextItem()" class="w-full py-4 bg-orange-600 font-bold text-white rounded-xl shadow-lg">
                            決定して次へ
                        </button>
                    </div>
                 </div>
            </div>

            <!-- Mobile Input Sheet (Overlay) -->
            <div x-show="mobileInputOpen" 
                 x-transition.opacity 
                 class="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center" x-cloak>
                 
                 <div class="bg-[#1a1a1a] w-full rounded-t-3xl border-t border-white/10 p-6 pb-12" @click.outside="mobileInputOpen = false">
                    <div class="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6"></div>
                    <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">INPUT SPECIES</h3>
                    
                    <div class="space-y-4">
                        <input type="text" placeholder="Start typing species name..." class="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-base text-white outline-none focus:border-orange-500">
                        
                        <div class="flex overflow-x-auto gap-2 py-2">
                             <button class="whitespace-nowrap px-3 py-1.5 bg-white/5 rounded-lg text-xs text-gray-300">Previous: Corvus</button>
                             <button class="whitespace-nowrap px-3 py-1.5 bg-white/5 rounded-lg text-xs text-gray-300">Previous: Passer</button>
                        </div>

                        <button @click="mobileInputOpen = false; nextItem()" class="w-full py-4 bg-orange-600 font-bold text-white rounded-xl shadow-lg">
                            CONFIRM & NEXT
                        </button>
                    </div>
                 </div>
            </div>

        </div>

    </div>

    <!-- Scripts -->
    <script>
        lucide.createIcons();

        function cockpit() {
            return {
                items: <?php echo $jsonObservations; ?>,
                selectedIds: [],
                lastSelectedIndex: null,
                
                // Grid State
                gridCols: parseInt(localStorage.getItem('ikimon_grid_cols')) || 3,
                
                // Mobile State
                currentMobileIndex: 0,
                mobileInputOpen: false,
                photoIndex: 0,
                lightboxOpen: false,

                // Persistent State
                viewedItems: JSON.parse(localStorage.getItem('ikimon_viewed_ids')) || [],
                passItems: JSON.parse(localStorage.getItem('ikimon_pass_ids')) || [],
                laterItems: JSON.parse(localStorage.getItem('ikimon_later_ids')) || [],

                // Filter State
                filterText: '',

                // Pan & Zoom State
                scale: 1,
                panX: 0,
                panY: 0,
                isDragging: false,
                startX: 0,
                startY: 0,

                init() {
                    this.$watch('gridCols', (value) => {
                        localStorage.setItem('ikimon_grid_cols', value);
                    });
                    this.$watch('currentMobileIndex', () => {
                        this.resetZoom();
                    });
                    this.$watch('photoIndex', () => {
                        this.resetZoom();
                    });
                },
                
                // Zoom Logic
                handleWheel(e) {
                    const delta = e.deltaY > 0 ? -0.1 : 0.1;
                    this.scale = Math.min(Math.max(0.5, this.scale + delta), 4);
                },
                adjustZoom(delta) {
                    this.scale = Math.min(Math.max(0.5, this.scale + delta), 4);
                },
                resetZoom() {
                    this.scale = 1;
                    this.panX = 0;
                    this.panY = 0;
                },

                // Pan Logic
                startDrag(e) {
                    this.isDragging = true;
                    this.startX = e.clientX - this.panX;
                    this.startY = e.clientY - this.panY;
                },
                handleDrag(e) {
                    if (!this.isDragging) return;
                    e.preventDefault();
                    this.panX = e.clientX - this.startX;
                    this.panY = e.clientY - this.startY;
                },
                endDrag() {
                    this.isDragging = false;
                },
                
                closeLightbox() {
                    this.lightboxOpen = false;
                    this.resetZoom();
                },

                get filteredItems() {
                    if (!this.filterText) return this.items;
                    const lowered = this.filterText.toLowerCase();
                    return this.items.filter(i => {
                        const loc = (i.location && i.location.name) ? i.location.name.toLowerCase() : '';
                        const tax = i.probable_taxon ? i.probable_taxon.toLowerCase() : '';
                        return loc.includes(lowered) || tax.includes(lowered);
                    });
                },

                get currentMobileItem() {
                    if (this.filteredItems.length === 0) return null;
                    return this.filteredItems[this.currentMobileIndex] || this.filteredItems[0];
                },

                applyTaxon(sciName, name) { alert(`Applied ${name}`); },

                viewItem(index) {
                    this.currentMobileIndex = index;
                    this.photoIndex = 0;
                    this.lightboxOpen = true;
                },

                // Signals
                // Signals
                toggleSignal(id, type) {
                    const target = type === 'pass' ? 'passItems' : 'laterItems';
                    const storageKey = type === 'pass' ? 'ikimon_pass_ids' : 'ikimon_later_ids';
                    
                    if (this[target].includes(id)) {
                        this[target] = this[target].filter(v => v !== id);
                    } else {
                        // Remove from other list if present (exclusive?) - Optional, for now allow both or strictly one?
                        // Let's toggle only.
                        this[target].push(id);
                    }
                    localStorage.setItem(storageKey, JSON.stringify(this[target]));
                    
                    // Also mark as viewed if toggling ON?
                    if (this[target].includes(id)) {
                        this.markAsViewed(id);
                    }
                },
                
                markSignal(id, type) {
                    this.toggleSignal(id, type);
                },

                markAsViewed(id) {
                    if (!this.viewedItems.includes(id)) {
                        this.viewedItems.push(id);
                        localStorage.setItem('ikimon_viewed_ids', JSON.stringify(this.viewedItems));
                    }
                },

                // Computed Classes for Grid
                get gridClasses() {
                    const maps = {
                        '1': 'grid-cols-1', 
                        '2': 'grid-cols-2',
                        '3': 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
                        '4': 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
                        '5': 'grid-cols-6 md:grid-cols-8 lg:grid-cols-12'
                    };
                    return maps[this.gridCols];
                },

                formatDate(dateStr) {
                    const d = new Date(dateStr);
                    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                },

                // Desktop Logic
                toggleSelect(id, index, event) {
                    if (event.shiftKey && this.lastSelectedIndex !== null) {
                        const start = Math.min(this.lastSelectedIndex, index);
                        const end = Math.max(this.lastSelectedIndex, index);
                        const rangeIds = this.filteredItems.slice(start, end + 1).map(i => i.id);
                        this.selectedIds = [...new Set([...this.selectedIds, ...rangeIds])];
                    } else if (event.metaKey || event.ctrlKey) {
                        if (this.selectedIds.includes(id)) {
                            this.selectedIds = this.selectedIds.filter(i => i !== id);
                        } else {
                            this.selectedIds.push(id);
                        }
                    } else {
                        this.selectedIds = [id];
                    }
                    this.lastSelectedIndex = index;
                },

                clearSelection() {
                    this.selectedIds = [];
                    this.lastSelectedIndex = null;
                },
                
                applyTaxon(sciName, name) { alert(`Applied ${name}`); },

                viewItem(index) {
                    this.currentMobileIndex = index;
                    this.photoIndex = 0;
                    this.lightboxOpen = true;
                },

                // Mobile Logic
                nextItem() {
                    if (this.currentMobileItem) {
                         this.markAsViewed(this.currentMobileItem.id);
                    }
                    if (this.currentMobileIndex < this.filteredItems.length - 1) {
                        this.currentMobileIndex++;
                        this.photoIndex = 0; 
                    }
                },
                prevItem() {
                    if (this.currentMobileIndex > 0) {
                         this.currentMobileIndex--;
                         this.photoIndex = 0; 
                    }
                },
                
                // Photo Nav
                nextPhoto() {
                    if (this.currentMobileItem && this.photoIndex < this.currentMobileItem.photos.length - 1) {
                        this.photoIndex++;
                    }
                },
                prevPhoto() {
                    if (this.photoIndex > 0) {
                        this.photoIndex--;
                    }
                },
                openLightbox() {
                    this.lightboxOpen = true;
                    if (this.currentMobileItem) {
                         this.markAsViewed(this.currentMobileItem.id);
                    }
                },
                
                handleKeydown(e) {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                        // Desktop Hide
                    }
                    if (e.key === 'ArrowRight') this.nextItem();
                    if (e.key === 'ArrowLeft') this.prevItem();
                }
            }
        }
    </script>
    <!-- Lightbox Modal (Pro UI) -->
    <div x-show="lightboxOpen" 
         class="fixed inset-0 z-[100] bg-black/95 flex flex-col" 
         x-cloak
         @mouseup.window="endDrag"
         @mousemove.window="handleDrag">
            
            <!-- Header: Close & Title -->
            <div class="absolute top-0 left-0 w-full z-50 flex items-center justify-between p-6 pointer-events-none">
                 <!-- Left: Counter -->
                 <div class="pointer-events-auto bg-black/50 backdrop-blur px-4 py-2 rounded-full text-white font-mono text-sm border border-white/10">
                    <span x-text="(photoIndex + 1)"></span> / <span x-text="currentMobileItem ? currentMobileItem.photos.length : 0"></span>
                 </div>

                 <!-- Right: Close Button -->
                 <button @click="closeLightbox()" class="pointer-events-auto flex items-center gap-2 bg-white/10 hover:bg-white/20 hover:scale-105 text-white px-6 py-3 rounded-full backdrop-blur border border-white/20 transition-all shadow-lg group">
                     <span class="font-bold text-sm tracking-widest">閉じる</span>
                     <div class="bg-white text-black rounded-full p-1 group-hover:rotate-90 transition">
                         <!-- Icon: X -->
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                     </div>
                 </button>
            </div>
            
            <!-- Main Interactive Canvas -->
            <div class="flex-1 w-full h-full relative overflow-hidden cursor-grab active:cursor-grabbing"
                 @mousedown="startDrag"
                 @wheel.prevent="handleWheel"
                 @click.self="closeLightbox()">
                 
                <!-- Image Wrapper with Transform -->
                <div class="w-full h-full flex items-center justify-center pointer-events-none"> 
                    <img :src="currentMobileItem ? currentMobileItem.photos[photoIndex] : ''" 
                         class="max-w-none transition-transform duration-75 ease-out select-none pointer-events-auto"
                         :style="`transform: translate(${panX}px, ${panY}px) scale(${scale});`"
                         @dragstart.prevent 
                         alt="Zoomable Image">
                </div>

                <!-- Nav Arrows -->
                <button x-show="photoIndex > 0" @click.stop="prevPhoto()" class="absolute left-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/40 backdrop-blur text-white hover:bg-white hover:text-black border border-white/10 transition shadow-xl z-40">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <button x-show="currentMobileItem && photoIndex < currentMobileItem.photos.length - 1" @click.stop="nextPhoto()" class="absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/40 backdrop-blur text-white hover:bg-white hover:text-black border border-white/10 transition shadow-xl z-40">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
            
                 <!-- Zoom Controls (Bottom Right Floating) -->
                 <div class="absolute bottom-28 right-6 flex flex-col gap-2 z-50 pointer-events-auto" @mousedown.stop>
                     <div class="flex items-center gap-2 bg-black/80 backdrop-blur p-2 rounded-full border border-white/20 shadow-2xl">
                         <button @click="adjustZoom(-0.5)" class="p-3 rounded-full hover:bg-white/20 text-white transition active:scale-90" title="Zoom Out">
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>
                         </button>
                         <span class="text-xs font-mono w-12 text-center text-white" x-text="Math.round(scale * 100) + '%'"></span>
                         <button @click="adjustZoom(0.5)" class="p-3 rounded-full hover:bg-white/20 text-white transition active:scale-90" title="Zoom In">
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                         </button>
                     </div>
                     <button @click="resetZoom()" class="bg-black/80 backdrop-blur border border-white/20 text-white text-xs font-bold py-2 px-4 rounded-full hover:bg-white hover:text-black transition shadow-lg">
                         RESET
                     </button>
                 </div>
            </div>
            
            <!-- Footer: Triage Actions (Fixed Bottom) -->
            <div class="w-full bg-black/90 backdrop-blur border-t border-white/20 p-6 z-50">
                <div class="flex items-center justify-center gap-6 max-w-lg mx-auto">
                    <button @click="toggleSignal(currentMobileItem.id, 'pass')" 
                            class="flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl border border-white/40 bg-white/10 hover:bg-red-600 hover:border-red-600 hover:text-white text-white transition group shadow-lg"
                            :class="passItems.includes(currentMobileItem ? currentMobileItem.id : '') ? '!bg-red-600 !text-white !border-red-600 ring-2 ring-red-400' : ''">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:scale-110 transition"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>
                        <span class="text-lg font-bold tracking-wide" x-text="passItems.includes(currentMobileItem ? currentMobileItem.id : '') ? '解除' : 'パス'"></span>
                    </button>
                    <button @click="toggleSignal(currentMobileItem.id, 'later')" 
                            class="flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl border border-white/40 bg-white/10 hover:bg-blue-600 hover:border-blue-600 hover:text-white text-white transition group shadow-lg"
                            :class="laterItems.includes(currentMobileItem ? currentMobileItem.id : '') ? '!bg-blue-600 !text-white !border-blue-600 ring-2 ring-blue-400' : ''">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:scale-110 transition"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span class="text-lg font-bold tracking-wide" x-text="laterItems.includes(currentMobileItem ? currentMobileItem.id : '') ? '解除' : 'あとで'"></span>
                    </button>
                </div>
            </div>
    </div>
</body>
</html>
