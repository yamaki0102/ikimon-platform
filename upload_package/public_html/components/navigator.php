
<!-- Bio-Navigator Modal -->
<div x-data="navigator()" x-show="open" style="display: none;" 
     class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
     role="dialog" aria-modal="true" aria-labelledby="navigator-title"
     x-transition.opacity>

    <div class="bg-[var(--color-bg-surface)] rounded-3xl w-full max-w-lg shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[85vh] relative text-[var(--color-text)]" @click.outside="open = false">
        
        <!-- Header -->
        <div class="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-[#111]">
            <h3 id="navigator-title" class="font-black text-base flex items-center gap-2">
                <i data-lucide="compass" class="text-[var(--color-primary)] w-5 h-5"></i> Bio-Navigator
            </h3>
            <button @click="open = false" class="p-1.5 hover:bg-white/10 rounded-full transition"><i data-lucide="x" class="w-5 h-5"></i></button>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto p-4 relative">
            
            <!-- Question -->
            <div class="text-center mb-4">
                <p class="text-[var(--color-primary)] font-mono text-[10px] mb-1 tracking-widest uppercase" x-text="'Step ' + (history.length + 1)"></p>
                <h2 class="text-xl font-bold" x-text="currentData.question"></h2>
            </div>

            <!-- Options Grid -->
            <div class="grid grid-cols-2 gap-3 pb-4">
                <template x-for="opt in currentData.options" :key="opt.id">
                    <button @click="selectOption(opt)" class="group relative bg-[#20242c] hover:bg-[#2a303b] active:scale-95 border border-white/10 rounded-2xl p-3 flex flex-row items-center text-left gap-3 transition-all duration-200 h-auto min-h-[7rem] w-full">
                        <div class="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:bg-[var(--color-primary)]/20 transition duration-300 border border-white/5 shrink-0">
                            <i :data-lucide="opt.icon" class="w-7 h-7" :class="opt.color || 'text-white group-hover:text-[var(--color-primary)]'"></i>
                        </div>
                        <div class="flex-1 min-w-0 flex flex-col justify-center py-1">
                            <div class="mb-1">
                                 <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                    <p class="font-black text-base text-white tracking-wide leading-tight" x-text="opt.label"></p>
                                    <p class="text-[10px] text-[var(--color-primary)] font-bold uppercase tracking-wider bg-[var(--color-primary)]/10 px-1.5 py-0.5 rounded flex-shrink-0" x-text="opt.sub"></p>
                                 </div>
                            </div>
                            <p class="text-xs text-gray-300 leading-tight font-medium" x-text="opt.desc || ''"></p>
                        </div>
                        <!-- Border Glow -->
                        <div class="absolute inset-0 rounded-2xl border-2 border-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none"></div>
                    </button>
                </template>
                
                <!-- Show More Button -->
                <template x-if="currentData.hasMore">
                    <button @click="toggleMore()" class="col-span-2 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-gray-400 font-mono border border-dashed border-white/10">
                        <span x-text="taxonomyLimit ? ('Show All (' + currentData.totalCount + ')') : 'Show Less'"></span>
                    </button>
                </template>
                
                <!-- Show Less Button -->
                <template x-if="!taxonomyLimit && currentData.totalCount > 12">
                     <button @click="toggleMore()" class="col-span-2 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-gray-400 font-mono border border-dashed border-white/10">
                        Show Less
                    </button>
                </template>
            </div>
            
        </div>

        <!-- Footer / Controls -->
        <div class="px-6 py-4 bg-[#111] border-t border-white/5 flex items-center justify-between">
            <button @click="back()" x-show="history.length > 0" class="text-gray-400 hover:text-white text-sm font-bold flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition">
                <i data-lucide="arrow-left" class="w-4 h-4"></i> Back
            </button>
            <div x-show="history.length === 0"></div>

            <button @click="open = false" class="text-gray-500 text-xs hover:text-white transition">Cancel</button>
        </div>
    </div>
</div>

<script nonce="<?= CspNonce::attr() ?>">
    function navigator() {
        return {
            open: false,
            data: null,
            taxonomy: null,
            taxonomyLimit: 12,
            currentKey: 'root',
            history: [],
            
            // Visual Map for known Families to Icons
            iconMap: {
                'Scarabaeidae': 'shield',
                'Lucanidae': 'sword',
                'Coccinellidae': 'disc',
                'Cerambycidae': 'radio-receiver',
                'Curculionidae': 'mic',
                'Papilionidae': 'feather',
                'Nymphalidae': 'feather',
                'Lycaenidae': 'circle-dashed',
                'Pieridae': 'wind',
                'Apidae': 'flower',
                'Formicidae': 'more-horizontal',
                'Vespidae': 'alert-triangle'
            },

            init() {
                this.loadData();
                window.addEventListener('open-navigator', () => {
                   this.open = true;
                });
                this.$watch('open', val => {
                    if(val) {
                        this.currentKey = 'root';
                        this.history = [];
                        this.$nextTick(() => lucide.createIcons());
                    }
                });
            },

            async loadData() {
                try {
                    const [navRes, taxRes] = await Promise.all([
                        fetch('data/navigator_data.json?v=' + Date.now()),
                        fetch('data/navigator_taxonomy.json?v=' + Date.now()).catch(() => null)
                    ]);
                    
                    this.data = await navRes.json();
                    if (taxRes && taxRes.ok) {
                        this.taxonomy = await taxRes.json();
                    } else {
                        console.warn('Taxonomy data not loaded');
                        this.taxonomy = {};
                    }
                } catch(e) { console.error('Nav Load Error', e); }
            },

            get currentData() {
                let node = this.data ? (this.data[this.currentKey] || {}) : { question: 'Loading...', options: [] };
                
                // Dynamic Taxonomy Injection
                if (node.type === 'dynamic' && this.taxonomy) {
                    const orderName = node.taxonomy;
                    const list = this.taxonomy[orderName] || [];
                    
                    if (list.length > 0) {
                        // Sort by Count Descending
                        const sorted = list.sort((a,b) => b.count - a.count);
                        
                        // Slice for display
                        const displayList = this.taxonomyLimit ? sorted.slice(0, this.taxonomyLimit) : sorted;
                        
                        return {
                            question: node.question,
                            source: node.source,
                            options: displayList.map(item => ({
                                id: item.id,
                                label: item.label,
                                sub: item.sub, 
                                icon: this.iconMap[item.sub] || 'help-circle', 
                                result: item.label, 
                                color: 'text-gray-300'
                            })),
                            totalCount: sorted.length,
                            hasMore: sorted.length > (this.taxonomyLimit || 9999)
                        };
                    } else {
                        return { question: node.question + ' (No Data)', options: [] };
                    }
                }
                
                return node;
            },

            toggleMore() {
                if (this.taxonomyLimit) {
                    this.taxonomyLimit = null; // Show All
                } else {
                    this.taxonomyLimit = 12; // Reset
                }
            },


            selectOption(opt) {
                if (opt.result) {
                    this.finish(opt.result, opt.label, opt.life_stage);
                } else if (opt.next) {
                    this.history.push(this.currentKey);
                    this.currentKey = opt.next;
                    this.$nextTick(() => lucide.createIcons());
                }
            },

            back() {
                if (this.history.length > 0) {
                    this.currentKey = this.history.pop();
                    this.$nextTick(() => lucide.createIcons());
                }
            },

            finish(result, label, life_stage) {
                console.log('Navigator Result:', result, life_stage);
                this.open = false;
                window.dispatchEvent(new CustomEvent('navigator-result', { 
                    detail: { query: result, label: label, life_stage: life_stage || 'unknown' } 
                }));
            }
        }
    }
</script>
