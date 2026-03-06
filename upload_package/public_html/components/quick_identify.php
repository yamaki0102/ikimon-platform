<?php

/**
 * quick_identify.php — クイック同定ボトムシート / サイドパネル
 * 
 * id_center.php / id_workbench.php から include して使う共通コンポーネント。
 * Alpine.js コンポーネント `quickIdentify` として動作。
 *
 * 使い方:
 *   1. 親ページで include('components/quick_identify.php') する
 *   2. 親の Alpine から $dispatch('open-quick-id', { item: observationObject }) で開く
 *   3. 同定完了時に 'identification-submitted' カスタムイベントが dispatch される
 */
?>

<!-- Quick Identify Panel (Bottom Sheet on mobile, Side Panel on desktop) -->
<div x-data="quickIdentify()"
    x-show="open"
    x-cloak
    @open-quick-id.window="openPanel($event.detail)"
    @keydown.escape.window="close()"
    class="fixed inset-0 z-[90]"
    role="dialog" aria-modal="true" aria-labelledby="quick-identify-title"
    x-transition:enter="transition ease-out duration-300"
    x-transition:enter-start="opacity-0"
    x-transition:enter-end="opacity-100"
    x-transition:leave="transition ease-in duration-200"
    x-transition:leave-start="opacity-100"
    x-transition:leave-end="opacity-0">

    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="close()"></div>

    <!-- Panel: Bottom Sheet (mobile) / Side Panel (desktop) -->
    <div class="absolute bottom-0 left-0 right-0 lg:bottom-auto lg:top-0 lg:left-auto lg:right-0 lg:w-[480px] lg:h-full
                bg-[#0a0d14] border-t lg:border-t-0 lg:border-l border-white/10 
                rounded-t-3xl lg:rounded-none shadow-2xl
                max-h-[90vh] lg:max-h-full overflow-y-auto overscroll-contain"
        x-transition:enter="transition ease-out duration-300"
        x-transition:enter-start="translate-y-full lg:translate-y-0 lg:translate-x-full"
        x-transition:enter-end="translate-y-0 lg:translate-x-0"
        x-transition:leave="transition ease-in duration-200"
        x-transition:leave-start="translate-y-0 lg:translate-x-0"
        x-transition:leave-end="translate-y-full lg:translate-y-0 lg:translate-x-full"
        @click.stop>

        <!-- Handle bar (mobile) -->
        <div class="lg:hidden w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-2"></div>

        <!-- Header -->
        <div class="sticky top-0 bg-[#0a0d14]/95 backdrop-blur-xl z-10 px-5 py-3 border-b border-white/5 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-[var(--color-primary)] text-black flex items-center justify-center">
                    <i data-lucide="microscope" class="w-4 h-4"></i>
                </div>
                <div>
                    <h2 id="quick-identify-title" class="text-sm font-black">名前を教える</h2>
                    <p class="text-[10px] text-gray-500 font-mono" x-text="item ? item.id : ''"></p>
                </div>
            </div>
            <button @click="close()" class="p-2 hover:bg-white/10 rounded-full transition">
                <i data-lucide="x" class="w-5 h-5 text-gray-400"></i>
            </button>
        </div>

        <!-- Content -->
        <div class="px-5 py-4 space-y-5">

            <!-- Photo Preview (compact) -->
            <div class="flex gap-2 items-start" x-show="item">
                <div class="w-20 h-20 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 relative group cursor-pointer"
                    @click="lightbox = true">
                    <img :src="item && item.photos && item.photos[0] ? item.photos[0] : ''"
                        :alt="item && item.taxon ? item.taxon.name : '観察写真'"
                        class="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                        loading="lazy">
                    <div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <i data-lucide="maximize-2" class="w-4 h-4 text-white"></i>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs text-gray-400 truncate flex items-center gap-1">
                        <i data-lucide="calendar" class="w-3 h-3"></i>
                        <span x-text="item ? formatDate(item.observed_at) : ''"></span>
                    </p>
                    <p class="text-sm font-bold text-white mt-0.5 line-clamp-1" x-text="item && item.taxon ? item.taxon.name : '未同定'"></p>
                    <p class="text-[10px] text-gray-500 italic" x-text="item && item.taxon ? item.taxon.scientific_name : ''"></p>
                    <!-- Photo count -->
                    <template x-if="item && item.photos && item.photos.length > 1">
                        <div class="flex gap-1 mt-1">
                            <template x-for="(photo, pi) in item.photos.slice(0, 4)" :key="pi">
                                <div class="w-6 h-6 rounded overflow-hidden border border-white/10 cursor-pointer hover:border-[var(--color-primary)] transition"
                                    @click.stop="lightboxIdx = pi; lightbox = true">
                                    <img :src="photo" :alt="'観察写真 ' + (pi + 1)" class="w-full h-full object-cover">
                                </div>
                            </template>
                            <template x-if="item.photos.length > 4">
                                <div class="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[8px] font-bold text-gray-400"
                                    x-text="'+' + (item.photos.length - 4)"></div>
                            </template>
                        </div>
                    </template>
                </div>
            </div>

            <!-- Observer & Location Context -->
            <div x-show="item" class="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
                <img :src="item ? (item.user_avatar || 'assets/img/default-avatar.svg') : ''" :alt="item ? (item.user_name || 'ユーザー') + 'のアバター' : 'ユーザーのアバター'" class="w-8 h-8 rounded-full object-cover border border-white/10" loading="lazy">
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-white/80 truncate" x-text="item ? (item.user_name || 'observer') : ''"></p>
                    <p x-show="item && item.location_name" class="text-[10px] text-gray-500 truncate flex items-center gap-1">
                        <i data-lucide="map-pin" class="w-2.5 h-2.5 shrink-0"></i>
                        <span x-text="item ? item.location_name : ''"></span>
                    </p>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-[10px] text-gray-500 font-mono" x-text="item ? formatDate(item.observed_at) : ''"></p>
                    <p x-show="item && item.photos" class="text-[9px] text-gray-600" x-text="item && item.photos ? item.photos.length + '枚' : ''"></p>
                </div>
            </div>

            <!-- Existing Identifications -->
            <div x-show="item && item.identifications && item.identifications.length > 0">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">既存の提案 <span class="text-gray-600 normal-case" x-text="item && item.identifications ? '(' + item.identifications.length + '件)' : ''"></span></label>
                <div class="space-y-1.5 max-h-32 overflow-y-auto">
                    <template x-for="(eid, eidx) in (item ? item.identifications : [])" :key="eidx">
                        <div class="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                            <img :src="eid.user_avatar || 'assets/img/default-avatar.svg'" :alt="(eid.user_name || 'ユーザー') + 'のアバター'" class="w-5 h-5 rounded-full object-cover border border-white/10 shrink-0" loading="lazy">
                            <div class="flex-1 min-w-0">
                                <p class="text-xs font-bold text-white/80 truncate" x-text="eid.taxon_name || '名前なし'"></p>
                                <div class="flex items-center gap-1.5">
                                    <p class="text-[9px] text-gray-500 italic truncate" x-text="eid.scientific_name || ''"></p>
                                    <span x-show="eid.life_stage && eid.life_stage !== 'unknown'" class="text-[8px] px-1 py-0.5 rounded bg-white/10 text-gray-500 font-bold" x-text="eid.life_stage === 'adult' ? '成体' : eid.life_stage === 'juvenile' ? '幼体' : eid.life_stage === 'egg' ? '卵等' : '痕跡'"></span>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
            </div>

            <!-- Taxon Search -->
            <div class="relative" @click.away="searchResults = []">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">種名・学名で検索</label>
                <div class="relative group">


                    <div class="relative">
                        <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"></i>
                        <input type="text"
                            x-model="query"
                            @input.debounce.300ms="searchTaxon"
                            @focus="if(query.length >= 2) searchTaxon()"
                            x-ref="searchInput"
                            placeholder="アオスジアゲハ、Graphium..."
                            class="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[var(--color-primary)] transition">
                        <div x-show="searching" class="absolute right-3 top-1/2 -translate-y-1/2">
                            <div class="w-4 h-4 border-2 border-white/10 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
                        </div>
                    </div>
                </div>

                <!-- Search Results Dropdown -->
                <div x-show="searchResults.length > 0"
                    x-transition
                    class="absolute top-full left-0 right-0 mt-1 bg-[#111418] border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl max-h-[40vh] overflow-y-auto">
                    <template x-for="(result, ri) in searchResults" :key="result.key || ri">
                        <button @click.prevent="selectTaxon(result)"
                            class="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition flex items-center justify-between gap-2">
                            <div class="min-w-0">
                                <p class="font-bold text-sm truncate" x-text="result.canonicalName || result.scientificName"></p>
                                <p class="text-xs text-gray-500 italic truncate" x-text="result.scientificName"></p>
                            </div>
                            <span class="text-[9px] px-2 py-0.5 rounded-full bg-white/10 font-bold uppercase shrink-0" x-text="result.rank"></span>
                        </button>
                    </template>
                </div>
            </div>

            <!-- Selected Taxon Display -->
            <div x-show="selected" x-transition
                class="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-xl p-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-[10px] font-bold text-[var(--color-primary)] flex items-center gap-1 mb-0.5">
                        <i data-lucide="check-circle-2" class="w-3 h-3"></i> 選択中
                    </p>
                    <p class="text-sm font-bold truncate" x-text="selected ? selected.canonicalName : ''"></p>
                    <p class="text-xs text-gray-500 italic truncate" x-text="selected ? selected.scientificName : ''"></p>
                </div>
                <button @click.prevent="clearSelection()" class="p-1.5 hover:bg-red-500/20 rounded-full transition shrink-0">
                    <i data-lucide="x" class="w-4 h-4 text-red-400"></i>
                </button>
            </div>

            <!-- Confidence (Hidden/Fixed to sure) -->
            <input type="hidden" x-model="confidence" value="sure">

            <!-- Life Stage Selector -->
            <div>
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">ライフステージ</label>
                <div class="grid grid-cols-5 gap-1.5">
                    <template x-for="ls in [
                        {id: 'adult', label: '成体', emoji: '👑'},
                        {id: 'juvenile', label: '幼体', emoji: '🌱'},
                        {id: 'egg', label: '卵等', emoji: '🥚'},
                        {id: 'trace', label: '痕跡', emoji: '👣'},
                        {id: 'unknown', label: '不明', emoji: '❓'}
                    ]" :key="ls.id">
                        <button type="button" @click="lifeStage = ls.id"
                            :class="lifeStage === ls.id ? 'bg-[var(--color-primary)] text-black border-[var(--color-primary)]' : 'bg-white/5 border-white/10 text-gray-500'"
                            class="flex flex-col items-center py-1.5 rounded-xl border transition overflow-hidden">
                            <span class="text-xs" x-text="ls.emoji"></span>
                            <span class="text-[8px] font-bold mt-0.5" x-text="ls.label"></span>
                        </button>
                    </template>
                </div>
            </div>

            <!-- Note (compact) -->
            <div>
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">メモ <span class="text-gray-600 normal-case">(任意)</span></label>
                <textarea x-model="note"
                    placeholder="背中の白い斑点、鳴き声の特徴..."
                    maxlength="200"
                    class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 h-16 text-sm focus:outline-none focus:border-[var(--color-primary)] transition resize-none"></textarea>
            </div>

            <!-- Submit -->
            <button @click="submitIdentification()"
                :disabled="!selected || submitting"
                class="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition"
                :class="selected && !submitting 
                        ? 'bg-[var(--color-primary)] text-black hover:brightness-110 shadow-lg shadow-[var(--color-primary)]/20' 
                        : 'bg-white/5 text-gray-500 cursor-not-allowed'">
                <template x-if="!submitting">
                    <span class="flex items-center gap-2">
                        <i data-lucide="check-square" class="w-4 h-4"></i>
                        名前を送信
                    </span>
                </template>
                <template x-if="submitting">
                    <span class="flex items-center gap-2">
                        <div class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                        送信中...
                    </span>
                </template>
            </button>

            <!-- Skip / Next buttons -->
            <div class="flex gap-2 pb-4">
                <button @click="skipAndNext('pass')"
                    class="flex-1 py-2 rounded-lg border border-white/5 bg-white/5 text-gray-400 text-xs font-bold hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition flex items-center justify-center gap-1.5">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i> パス
                </button>
                <button @click="skipAndNext('later')"
                    class="flex-1 py-2 rounded-lg border border-white/5 bg-white/5 text-gray-400 text-xs font-bold hover:bg-yellow-500/10 hover:text-yellow-400 hover:border-yellow-500/30 transition flex items-center justify-center gap-1.5">
                    <i data-lucide="bookmark" class="w-3.5 h-3.5"></i> あとで
                </button>
                <a :href="item ? 'observation_detail.php?id=' + item.id : '#'"
                    class="flex-1 py-2 rounded-lg border border-white/5 bg-white/5 text-gray-400 text-xs font-bold hover:bg-white/10 hover:text-white transition flex items-center justify-center gap-1.5">
                    <i data-lucide="external-link" class="w-3.5 h-3.5"></i> 詳細
                </a>
            </div>
        </div>
    </div>

    <!-- Lightbox -->
    <div x-show="lightbox"
        x-transition.opacity
        class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
        role="dialog" aria-modal="true" aria-labelledby="quick-identify-lightbox-title"
        @click="lightbox = false">
        <h2 id="quick-identify-lightbox-title" class="sr-only">観察写真</h2>
        <button @click.stop="lightbox = false" class="absolute top-4 right-4 p-2 bg-white/10 rounded-full z-[101] hover:bg-white/20 transition">
            <i data-lucide="x" class="w-5 h-5 text-white"></i>
        </button>
        <template x-if="item && item.photos">
            <div class="relative max-w-full max-h-full" @click.stop>
                <img :src="item.photos[lightboxIdx] || ''" :alt="'観察写真 ' + (lightboxIdx + 1)" class="max-w-full max-h-[85vh] object-contain">
                <template x-if="item.photos.length > 1">
                    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        <template x-for="(p, pi) in item.photos" :key="pi">
                            <button @click.stop="lightboxIdx = pi"
                                class="w-8 h-8 rounded-lg overflow-hidden border-2 transition"
                                :class="lightboxIdx === pi ? 'border-[var(--color-primary)] scale-110' : 'border-white/20 opacity-60'">
                                <img :src="p" :alt="'観察写真 ' + (pi + 1)" class="w-full h-full object-cover">
                            </button>
                        </template>
                    </div>
                </template>
            </div>
        </template>
    </div>
</div>

<!-- Success Toast -->
<div x-data="{ showToast: false, toastMsg: '' }"
    @id-toast.window="toastMsg = $event.detail.message; showToast = true; setTimeout(() => showToast = false, 3000)"
    x-show="showToast"
    x-cloak
    x-transition:enter="transition ease-out duration-300"
    x-transition:enter-start="translate-y-8 opacity-0"
    x-transition:enter-end="translate-y-0 opacity-100"
    x-transition:leave="transition ease-in duration-200"
    x-transition:leave-start="translate-y-0 opacity-100"
    x-transition:leave-end="translate-y-8 opacity-0"
    class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[95] px-6 py-3 bg-green-500/90 text-black font-bold text-sm rounded-full shadow-2xl flex items-center gap-2 backdrop-blur-md">
    <i data-lucide="check-circle-2" class="w-4 h-4"></i>
    <span x-text="toastMsg"></span>
</div>

<script nonce="<?= CspNonce::attr() ?>">
    function quickIdentify() {
        return {
            open: false,
            item: null,
            query: '',
            searchResults: [],
            selected: null,
            confidence: 'maybe',
            lifeStage: 'unknown',
            note: '',
            submitting: false,
            searching: false,
            lightbox: false,
            lightboxIdx: 0,

            // Queue navigation support
            _queueItems: [],
            _currentIndex: -1,

            openPanel(detail) {
                this.item = detail.item || detail;
                this._queueItems = detail.queue || [];
                this._currentIndex = detail.index ?? -1;
                this.resetForm();
                this.open = true;
                this.$nextTick(() => {
                    lucide.createIcons();
                    if (this.$refs.searchInput) this.$refs.searchInput.focus();
                });
            },

            close() {
                this.open = false;
                this.item = null;
                this.resetForm();
            },

            resetForm() {
                this.query = '';
                this.searchResults = [];
                this.selected = null;
                this.confidence = 'maybe';
                this.lifeStage = 'unknown';
                this.note = '';
                this.submitting = false;
                this.lightbox = false;
                this.lightboxIdx = 0;
            },

            async searchTaxon() {
                if (this.query.length < 2) {
                    this.searchResults = [];
                    return;
                }
                this.searching = true;
                try {
                    const res = await fetch(`api/search_taxon.php?q=${encodeURIComponent(this.query)}`);
                    this.searchResults = await res.json();
                } catch (e) {
                    console.error('Taxon search failed:', e);
                    this.searchResults = [];
                } finally {
                    this.searching = false;
                }
            },

            selectTaxon(result) {
                this.selected = result;
                this.searchResults = [];
                this.query = result.canonicalName || result.scientificName;
            },

            clearSelection() {
                this.selected = null;
                this.query = '';
                this.$nextTick(() => {
                    if (this.$refs.searchInput) this.$refs.searchInput.focus();
                });
            },

            async submitIdentification() {
                if (!this.selected || !this.item || this.submitting) return;
                this.submitting = true;

                try {
                    const payload = {
                        observation_id: this.item.id,
                        taxon_key: this.selected.key,
                        taxon_name: this.selected.canonicalName || this.selected.scientificName,
                        scientific_name: this.selected.scientificName,
                        taxon_rank: this.selected.rank || 'species',
                        taxon_slug: (this.selected.canonicalName || '').toLowerCase().replace(/\s+/g, '-'),
                        confidence: this.confidence,
                        life_stage: this.lifeStage,
                        note: this.note,
                        lineage: {
                            kingdom: this.selected.kingdom || null,
                            phylum: this.selected.phylum || null,
                            class: this.selected.class || null,
                            order: this.selected.order || null,
                            family: this.selected.family || null,
                            genus: this.selected.genus || null,
                        }
                    };

                    /* 
                     * Use CSRF token from meta tag
                     */
                    const _csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';

                    const res = await fetch('api/post_identification.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Csrf-Token': _csrf
                        },
                        body: JSON.stringify(payload)
                    });
                    const result = await res.json();

                    if (result.success) {
                        // Dispatch success events
                        this.$dispatch('identification-submitted', {
                            observationId: this.item.id,
                            taxonName: payload.taxon_name
                        });
                        this.$dispatch('id-toast', {
                            message: '名前を送信した！🌟'
                        });

                        // Auto-advance to next item if queue available
                        this.advanceToNext();
                    } else {
                        alert('送信失敗: ' + (result.message || '時間を空けてもう一度試してみてね'));
                        this.submitting = false;
                    }
                } catch (e) {
                    console.error('Identification submit failed:', e);
                    alert('通信エラー 📡 電波の良い場所で試してみてね');
                    this.submitting = false;
                }
            },

            skipAndNext(action) {
                if (!this.item) return;
                this.$dispatch('quick-id-action', {
                    action: action,
                    observationId: this.item.id
                });
                this.advanceToNext();
            },

            advanceToNext() {
                if (this._queueItems.length > 0 && this._currentIndex >= 0) {
                    const nextIndex = this._currentIndex + 1;
                    if (nextIndex < this._queueItems.length) {
                        this._currentIndex = nextIndex;
                        this.item = this._queueItems[nextIndex];
                        this.resetForm();
                        this.$nextTick(() => {
                            lucide.createIcons();
                            if (this.$refs.searchInput) this.$refs.searchInput.focus();
                        });
                        return;
                    }
                }
                // No more items, close
                this.close();
            },

            formatDate(d) {
                if (!d) return '';
                return new Date(d).toLocaleDateString('ja-JP', {
                    month: 'short',
                    day: 'numeric'
                });
            }
        };
    }
</script>
