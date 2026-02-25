<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/Taxon.php';

Auth::init();
$currentUser = Auth::user();

if (!$currentUser) {
    header('Location: login.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $meta_title = "ID Workbench — 同定コックピット";
    include __DIR__ . '/components/meta.php';
    ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
    <style>
        [x-cloak] {
            display: none !important;
        }

        body {
            overflow: auto;
            /* Allow mobile scrolling */
            height: 100vh;
            background-color: #050505;
        }

        @media (min-width: 768px) {
            body {
                overflow: hidden;
                /* Lock on desktop */
            }
        }

        /* Mobile Adjustments */
        @media (max-width: 767px) {
            body {
                overflow: auto;
                /* Ensure scrolling on mobile */
                height: auto;
            }

            .panel-mobile {
                height: auto !important;
                max-height: 60vh;
                /* Limit height of panels on mobile */
                overflow-y: auto;
            }
        }

        .scrollbar-thin::-webkit-scrollbar {
            width: 4px;
            height: 4px;
        }

        .scrollbar-thin::-webkit-scrollbar-track {
            background: #111;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb {
            background: #333;
            border-radius: 2px;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
            background: #555;
        }

        .item-selected {
            outline: 2px solid var(--color-primary);
            outline-offset: -2px;
        }

        .tree-node:hover {
            background: rgba(255, 255, 255, 0.03);
        }

        .shortcut-badge {
            font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
            font-size: var(--text-xs);
            padding: 1px 5px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 3px;
        }
    </style>
</head>

<body x-data="workbench()" @keydown.window="handleKeydown($event)">

    <!-- Top Bar (Cockpit Toolbar) -->
    <header class="h-11 bg-[#0a0d14] border-b border-white/5 flex items-center justify-between px-4 z-20 select-none">
        <div class="flex items-center gap-3">
            <a href="id_center.php" class="text-xs text-gray-500 hover:text-white transition font-bold flex items-center gap-1.5">
                <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
            </a>
            <h1 class="text-xs font-black text-gray-300 flex items-center gap-2 tracking-tight">
                <i data-lucide="layout-dashboard" class="text-[var(--color-primary)] w-3.5 h-3.5"></i>
                ID Workbench
            </h1>
            <div class="h-4 w-px bg-white/10"></div>
            <div class="text-token-xs font-mono text-gray-600">
                <span x-text="filteredItems.length" class="text-white font-bold"></span>件
                <span x-show="selectedIds.length > 0" class="text-[var(--color-primary)] ml-1">
                    | <span x-text="selectedIds.length" class="font-bold"></span>選択中
                </span>
            </div>
        </div>
        <div class="flex items-center gap-2">
            <!-- Keyboard shortcuts legend -->
            <div class="hidden xl:flex items-center gap-2 text-token-xs text-gray-600 mr-2">
                <span class="shortcut-badge">N</span>次
                <span class="shortcut-badge">P</span>前
                <span class="shortcut-badge">/</span>検索
                <span class="shortcut-badge">Enter</span>同定
                <span class="shortcut-badge">X</span>パス
                <span class="shortcut-badge">B</span>ブクマ
                <span class="shortcut-badge">Esc</span>閉
            </div>
            <!-- Grid Size -->
            <div class="flex items-center gap-1 bg-white/5 rounded-md p-0.5">
                <button @click="gridCols = Math.max(1, gridCols - 1)" class="p-1 text-gray-500 hover:text-white transition"><i data-lucide="minus" class="w-3 h-3"></i></button>
                <span class="text-token-xs font-mono text-gray-400 w-4 text-center" x-text="gridCols"></span>
                <button @click="gridCols = Math.min(5, gridCols + 1)" class="p-1 text-gray-500 hover:text-white transition"><i data-lucide="plus" class="w-3 h-3"></i></button>
            </div>
        </div>
    </header>

    <!-- Main 3-Panel Layout (Desktop & Mobile) -->
    <div class="flex flex-col md:flex-row h-auto md:h-[calc(100vh-44px)] relative overflow-visible md:overflow-hidden">

        <!-- LEFT PANEL: Taxonomy Tree Filter -->
        <aside class="w-full md:w-56 lg:w-64 bg-[#0a0d14] border-b md:border-b-0 md:border-r border-white/5 flex flex-col shrink-0 panel-mobile md:h-full">
            <!-- Search -->
            <div class="p-3 border-b border-white/5">
                <div class="flex items-center gap-2">
                    <div class="relative flex-1">
                        <i data-lucide="search" class="absolute left-2 top-[7px] w-3 h-3 text-gray-600"></i>
                        <input type="text" x-model="filterText" x-ref="filterInput"
                            placeholder="絞り込み..."
                            class="w-full bg-white/5 border border-white/10 rounded-md pl-7 pr-3 py-1 text-token-xs focus:outline-none focus:border-[var(--color-primary)] transition placeholder-gray-600">
                    </div>
                    <button @click="$dispatch('open-navigator')" class="p-1.5 rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition shrink-0" title="AIナビゲーターで絞り込む">
                        <i data-lucide="compass" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>

            <!-- Taxonomy Tree -->
            <div class="flex-1 overflow-y-auto scrollbar-thin p-2">
                <h3 class="text-token-xs font-bold text-gray-600 uppercase tracking-widest px-2 mb-2">分類群フィルタ</h3>

                <!-- All -->
                <button @click="taxonFilter = 'all'"
                    class="tree-node w-full text-left px-2 py-1.5 rounded-md text-token-xs font-bold transition flex items-center justify-between"
                    :class="taxonFilter === 'all' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'">
                    <span class="flex items-center gap-2">🌍 すべて</span>
                    <span class="text-token-xs font-mono text-gray-600" x-text="allItems.length"></span>
                </button>

                <div class="mt-2 space-y-px">
                    <template x-for="group in taxonGroups" :key="group.id">
                        <div>
                            <!-- Kingdom/Group header -->
                            <button @click="setTaxonFilter(group.id)"
                                class="tree-node w-full text-left px-2 py-1.5 rounded-md text-token-xs font-bold transition flex items-center justify-between"
                                :class="taxonFilter === group.id ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-200'">
                                <span class="flex items-center gap-2">
                                    <span x-text="group.icon" class="text-xs"></span>
                                    <span x-text="group.label"></span>
                                </span>
                                <span class="text-token-xs font-mono" :class="taxonFilter === group.id ? 'text-[var(--color-primary)]' : 'text-gray-600'" x-text="groupCounts[group.id] || 0"></span>
                            </button>
                        </div>
                    </template>
                </div>

                <!-- Status Sections -->
                <div class="border-t border-white/5 mt-3 pt-3">
                    <h3 class="text-token-xs font-bold text-gray-600 uppercase tracking-widest px-2 mb-2">ステータス</h3>
                    <button @click="statusFilter = 'unidentified'"
                        class="tree-node w-full text-left px-2 py-1.5 rounded-md text-token-xs font-bold transition flex items-center justify-between"
                        :class="statusFilter === 'unidentified' ? 'bg-red-500/10 text-red-400' : 'text-gray-400 hover:text-gray-200'">
                        <span>🔴 未同定</span>
                        <span class="text-token-xs font-mono text-gray-600" x-text="statusCounts.unidentified"></span>
                    </button>
                    <button @click="statusFilter = 'suggested'"
                        class="tree-node w-full text-left px-2 py-1.5 rounded-md text-token-xs font-bold transition flex items-center justify-between"
                        :class="statusFilter === 'suggested' ? 'bg-purple-500/10 text-purple-400' : 'text-gray-400 hover:text-gray-200'">
                        <span>🟣 要確認</span>
                        <span class="text-token-xs font-mono text-gray-600" x-text="statusCounts.suggested"></span>
                    </button>
                    <button @click="statusFilter = 'all'"
                        class="tree-node w-full text-left px-2 py-1.5 rounded-md text-token-xs font-bold transition flex items-center justify-between mt-1"
                        :class="statusFilter === 'all' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200'">
                        <span>⬜ 全ステータス</span>
                    </button>
                </div>

                <!-- Saved Presets -->
                <div class="border-t border-white/5 mt-3 pt-3" x-show="presets.length > 0">
                    <h3 class="text-token-xs font-bold text-gray-600 uppercase tracking-widest px-2 mb-2">プリセット</h3>
                    <template x-for="(preset, pi) in presets" :key="pi">
                        <div class="group flex items-center">
                            <button @click="applyPreset(preset)"
                                class="tree-node flex-1 text-left px-2 py-1 rounded-md text-token-xs font-bold text-gray-400 hover:text-white transition truncate">
                                <i data-lucide="tag" class="w-2.5 h-2.5 inline opacity-40"></i>
                                <span x-text="preset.name"></span>
                            </button>
                            <button @click="removePreset(pi)" class="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition">
                                <i data-lucide="x" class="w-3 h-3"></i>
                            </button>
                        </div>
                    </template>
                </div>
            </div>

            <!-- Save Preset Button -->
            <div class="p-2 border-t border-white/5">
                <button @click="saveCurrentPreset()"
                    class="w-full py-1.5 rounded-md text-token-xs font-bold bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition flex items-center justify-center gap-1.5">
                    <i data-lucide="plus" class="w-3 h-3"></i> プリセット保存
                </button>
            </div>
        </aside>

        <!-- CENTER PANEL: Grid -->
        <main class="flex-1 bg-[#050505] flex flex-col relative min-w-0 h-[60vh] md:h-full order-first md:order-none">
            <!-- Grid Toolbar -->
            <div class="h-8 bg-[#0a0d14] border-b border-white/5 flex items-center px-3 justify-between shrink-0">
                <div class="flex items-center gap-2">
                    <span class="text-token-xs font-bold text-gray-500">並替:</span>
                    <select x-model="sortBy" class="bg-transparent border-none text-token-xs text-gray-400 focus:outline-none cursor-pointer">
                        <option value="newest">新しい順</option>
                        <option value="oldest">古い順</option>
                    </select>
                </div>
                <div class="flex items-center gap-2" x-show="selectedIds.length > 0">
                    <button @click="batchQuickID()" class="text-token-xs font-bold text-[var(--color-primary)] hover:underline">一括同定</button>
                    <button @click="clearSelection()" class="text-token-xs font-bold text-gray-500 hover:text-white">選択解除</button>
                </div>
            </div>

            <!-- Grid -->
            <div class="flex-1 overflow-y-auto p-3 scrollbar-thin" @click.self="clearSelection()">
                <!-- Loading -->
                <div x-show="loading" class="flex items-center justify-center h-full">
                    <div class="w-8 h-8 border-2 border-white/10 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
                </div>

                <div x-show="!loading" class="grid gap-1.5" :class="gridClasses">
                    <template x-for="(item, index) in filteredItems" :key="item.id">
                        <div class="relative group aspect-[4/3] bg-[#111] rounded-lg overflow-hidden select-none transition-all duration-75 cursor-pointer"
                            :class="{ 
                                 'item-selected': selectedIds.includes(item.id), 
                                 'ring-1 ring-white/5': !selectedIds.includes(item.id),
                                 'ring-1 ring-blue-500/40': activeItemId === item.id,
                             }">
                            <!-- Image -->
                            <img :src="item.photos && item.photos[0] ? item.photos[0] : 'assets/img/no-photo.svg'"
                                @click.stop="activateItem(item, index)"
                                @dblclick.stop="openQuickID(item, index)"
                                class="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition duration-200">

                            <!-- Status badge -->
                            <div class="absolute top-1 left-1 flex gap-0.5 pointer-events-none">
                                <span x-show="!item.taxon" class="px-1 py-px bg-red-500/80 rounded text-token-xs text-white font-bold">UnID</span>
                                <span x-show="item.taxon" class="px-1 py-px bg-purple-500/60 rounded text-token-xs text-white font-bold">Prop</span>
                            </div>

                            <!-- Select checkbox -->
                            <div class="absolute top-0 right-0 p-1.5 cursor-pointer opacity-0 group-hover:opacity-100 transition" @click.stop="toggleSelect(item.id, index, $event)">
                                <div class="w-4 h-4 rounded border border-white/30 bg-black/40 flex items-center justify-center"
                                    :class="selectedIds.includes(item.id) ? '!bg-[var(--color-primary)] !border-[var(--color-primary)]' : ''">
                                    <i x-show="selectedIds.includes(item.id)" data-lucide="check" class="w-2.5 h-2.5 text-black"></i>
                                </div>
                            </div>

                            <!-- Brief info overlay -->
                            <div class="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition pointer-events-none">
                                <p class="text-token-xs font-bold text-white truncate" x-text="item.taxon ? item.taxon.name : 'Unknown'"></p>
                            </div>

                            <!-- Quick actions on hover -->
                            <div class="absolute bottom-0 right-0 p-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition" @click.stop>
                                <button @click="openQuickID(item, index)" class="p-1 rounded bg-[var(--color-primary)] text-black hover:brightness-110 transition" title="同定 (Enter)">
                                    <i data-lucide="zap" class="w-3 h-3"></i>
                                </button>
                            </div>
                        </div>
                    </template>
                </div>

                <!-- Empty state -->
                <div x-show="!loading && filteredItems.length === 0" class="flex flex-col items-center justify-center h-full text-gray-600">
                    <i data-lucide="inbox" class="w-12 h-12 opacity-20 mb-4"></i>
                    <p class="text-sm font-bold">条件に一致する記録がありません</p>
                    <button @click="resetFilters()" class="mt-4 text-xs text-[var(--color-primary)] hover:underline">フィルターをリセット</button>
                </div>
            </div>
        </main>

        <!-- RIGHT PANEL: Inspector -->
        <aside class="w-full md:w-72 lg:w-80 bg-[#0a0d14] border-t md:border-t-0 md:border-l border-white/5 flex flex-col shrink-0 panel-mobile md:h-full">
            <!-- Active item preview -->
            <template x-if="activeItem">
                <div class="flex-1 flex flex-col overflow-y-auto scrollbar-thin">
                    <!-- Photo -->
                    <div class="aspect-[4/3] bg-black relative group shrink-0">
                        <img :src="activeItem.photos && activeItem.photos[activePhotoIdx] ? activeItem.photos[activePhotoIdx] : ''"
                            class="w-full h-full object-cover">
                        <!-- Photo nav -->
                        <template x-if="activeItem.photos && activeItem.photos.length > 1">
                            <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                <template x-for="(p, pi) in activeItem.photos" :key="pi">
                                    <button @click="activePhotoIdx = pi"
                                        class="w-6 h-6 rounded overflow-hidden border-2 transition"
                                        :class="activePhotoIdx === pi ? 'border-white scale-110' : 'border-white/20 opacity-50'">
                                        <img :src="p" class="w-full h-full object-cover">
                                    </button>
                                </template>
                            </div>
                        </template>
                    </div>

                    <!-- Item Details -->
                    <div class="p-3 space-y-3">
                        <div>
                            <h3 class="font-bold text-sm" x-text="activeItem.taxon ? activeItem.taxon.name : '未同定'"></h3>
                            <p class="text-token-xs text-gray-500 italic" x-text="activeItem.taxon ? activeItem.taxon.scientific_name : ''"></p>
                            <p class="text-token-xs text-gray-600 mt-1 font-mono" x-text="activeItem.id"></p>
                        </div>
                        <div class="text-token-xs text-gray-400 space-y-1">
                            <p class="flex items-center gap-1.5"><i data-lucide="calendar" class="w-3 h-3"></i> <span x-text="formatDate(activeItem.observed_at)"></span></p>
                            <p class="flex items-center gap-1.5" x-show="activeItem.location"><i data-lucide="map-pin" class="w-3 h-3"></i> <span x-text="activeItem.location ? activeItem.location.name : ''"></span></p>
                            <p class="flex items-center gap-1.5"><i data-lucide="user" class="w-3 h-3"></i> <span x-text="activeItem.user_name || '匿名'"></span></p>
                        </div>

                        <!-- Existing IDs -->
                        <template x-if="activeItem.identifications && activeItem.identifications.length > 0">
                            <div>
                                <h4 class="text-token-xs font-bold text-gray-600 uppercase tracking-widest mb-1.5">提案された同定</h4>
                                <template x-for="idEntry in activeItem.identifications" :key="idEntry.id">
                                    <div class="flex items-center gap-2 py-1 border-b border-white/5">
                                        <div class="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-token-xs" x-text="(idEntry.user_name || '?').charAt(0)"></div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-1.5 leading-none mb-0.5">
                                                <p class="text-token-xs font-bold truncate" x-text="idEntry.taxon_name"></p>
                                                <span x-show="idEntry.life_stage && idEntry.life_stage !== 'unknown'" class="text-token-xs px-1 py-0.5 rounded bg-white/10 text-gray-500 font-bold shrink-0" x-text="idEntry.life_stage === 'adult' ? '成体' : idEntry.life_stage === 'juvenile' ? '幼体' : idEntry.life_stage === 'egg' ? '卵等' : '痕跡'"></span>
                                            </div>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </template>

                        <!-- Action buttons -->
                        <div class="space-y-1.5 pt-2">
                            <button @click="openQuickID(activeItem, activeItemIndex)"
                                class="w-full py-2 rounded-lg bg-[var(--color-primary)] text-black text-xs font-bold hover:brightness-110 transition flex items-center justify-center gap-1.5 shadow-lg">
                                <i data-lucide="zap" class="w-3.5 h-3.5"></i> 同定する
                                <span class="shortcut-badge !bg-black/20 !border-black/20 !text-black/60">Enter</span>
                            </button>
                            <div class="grid grid-cols-2 gap-1.5">
                                <button @click="markPass(activeItem.id)"
                                    class="py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-400 text-token-xs font-bold hover:bg-red-500/10 hover:text-red-400 transition flex items-center justify-center gap-1">
                                    <i data-lucide="x" class="w-3 h-3"></i> パス
                                    <span class="shortcut-badge">X</span>
                                </button>
                                <button @click="markLater(activeItem.id)"
                                    class="py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-400 text-token-xs font-bold hover:bg-blue-500/10 hover:text-blue-400 transition flex items-center justify-center gap-1">
                                    <i data-lucide="bookmark" class="w-3 h-3"></i> あとで
                                    <span class="shortcut-badge">B</span>
                                </button>
                            </div>
                            <a :href="'post.php?taxon_name=' + encodeURIComponent(activeItem.taxon ? activeItem.taxon.name : '')"
                                x-show="activeItem.taxon"
                                class="block w-full py-1.5 rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 text-[var(--color-primary)] text-token-xs font-bold hover:bg-[var(--color-primary)]/10 transition text-center">
                                📸 この種で観察を投稿
                            </a>
                            <a :href="'observation_detail.php?id=' + activeItem.id"
                                class="block w-full py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-400 text-token-xs font-bold hover:bg-white/10 hover:text-white transition text-center">
                                詳細ページを開く
                            </a>
                        </div>
                    </div>
                </div>
            </template>

            <!-- Empty state -->
            <template x-if="!activeItem">
                <div class="flex-1 flex flex-col items-center justify-center text-gray-600 p-6">
                    <i data-lucide="mouse-pointer-click" class="w-8 h-8 opacity-20 mb-3"></i>
                    <p class="text-xs text-center mb-3">写真をクリックして詳細を表示</p>
                    <div class="text-token-xs bg-white/5 rounded-lg p-3 w-full space-y-1 font-mono text-gray-500">
                        <p><span class="shortcut-badge">Click</span> 選択</p>
                        <p><span class="shortcut-badge">Dbl-Click</span> 同定</p>
                        <p><span class="shortcut-badge">Shift+Click</span> 範囲選択</p>
                        <p><span class="shortcut-badge">N</span> / <span class="shortcut-badge">P</span> 次/前</p>
                    </div>
                </div>
            </template>
        </aside>
    </div>

    <!-- (Mobile Link removed - now supporting native mobile view) -->

    <?php include('components/quick_identify.php'); ?>
    <?php include('components/nav.php'); ?>

    <script nonce="<?= CspNonce::attr() ?>">
        function workbench() {
            return {
                loading: true,
                allItems: [],
                selectedIds: [],
                lastSelectedIndex: null,
                activeItemId: null,
                activePhotoIdx: 0,
                activeItemIndex: -1,

                // Filters
                filterText: '',
                taxonFilter: 'all',
                statusFilter: 'all',
                sortBy: 'newest',
                gridCols: parseInt(localStorage.getItem('ikimon_wb_grid_cols')) || 3,
                presets: [],

                // Pass/Later
                passItems: [],
                laterItems: [],

                taxonGroups: [{
                        id: 'insecta',
                        label: '昆虫',
                        icon: '🦗',
                        match: {
                            class: 'Insecta'
                        }
                    },
                    {
                        id: 'plantae',
                        label: '植物',
                        icon: '🌿',
                        match: {
                            kingdom: 'Plantae'
                        }
                    },
                    {
                        id: 'aves',
                        label: '鳥類',
                        icon: '🐦',
                        match: {
                            class: 'Aves'
                        }
                    },
                    {
                        id: 'mammalia',
                        label: '哺乳類',
                        icon: '🐾',
                        match: {
                            class: 'Mammalia'
                        }
                    },
                    {
                        id: 'fish',
                        label: '魚類',
                        icon: '🐟',
                        match: {
                            class: ['Actinopterygii', 'Chondrichthyes']
                        }
                    },
                    {
                        id: 'fungi',
                        label: 'きのこ',
                        icon: '🍄',
                        match: {
                            kingdom: 'Fungi'
                        }
                    },
                    {
                        id: 'other',
                        label: 'その他',
                        icon: '❓'
                    },
                ],

                init() {
                    this.loadLocal();
                    this.fetchItems();
                    this.$watch('gridCols', v => localStorage.setItem('ikimon_wb_grid_cols', v));
                },

                loadLocal() {
                    try {
                        this.passItems = JSON.parse(localStorage.getItem('ikimon_skipped_ids') || '[]');
                        this.laterItems = JSON.parse(localStorage.getItem('ikimon_later_ids') || '[]');
                        this.presets = JSON.parse(localStorage.getItem('ikimon_wb_presets') || '[]');
                    } catch (e) {}
                },

                async fetchItems() {
                    this.loading = true;
                    try {
                        const res = await fetch('api/get_observations.php?status=unresolved&limit=200');
                        const data = await res.json();
                        this.allItems = data.data || [];
                    } catch (e) {
                        console.error('Fetch failed:', e);
                    } finally {
                        this.loading = false;
                        this.$nextTick(() => lucide.createIcons());
                    }
                },

                getTaxonGroup(item) {
                    if (!item || !item.taxon || !item.taxon.lineage) return 'other';
                    const lin = item.taxon.lineage;
                    for (const group of this.taxonGroups) {
                        if (!group.match) continue;
                        for (const [rank, expected] of Object.entries(group.match)) {
                            const val = lin[rank];
                            if (Array.isArray(expected)) {
                                if (expected.includes(val)) return group.id;
                            } else if (val === expected) return group.id;
                        }
                    }
                    return 'other';
                },

                get groupCounts() {
                    const c = {};
                    this.taxonGroups.forEach(g => {
                        c[g.id] = this.allItems.filter(i => this.getTaxonGroup(i) === g.id).length;
                    });
                    return c;
                },

                get statusCounts() {
                    return {
                        unidentified: this.allItems.filter(i => !i.taxon).length,
                        suggested: this.allItems.filter(i => !!i.taxon).length,
                    };
                },

                setTaxonFilter(id) {
                    this.taxonFilter = id;
                },

                get filteredItems() {
                    let items = this.allItems;

                    // Text filter
                    if (this.filterText) {
                        const q = this.filterText.toLowerCase();
                        items = items.filter(i => {
                            const name = i.taxon ? (i.taxon.name || '').toLowerCase() : '';
                            const sci = i.taxon ? (i.taxon.scientific_name || '').toLowerCase() : '';
                            const loc = i.location ? (i.location.name || '').toLowerCase() : '';
                            return name.includes(q) || sci.includes(q) || loc.includes(q);
                        });
                    }

                    // Status filter
                    if (this.statusFilter === 'unidentified') items = items.filter(i => !i.taxon);
                    if (this.statusFilter === 'suggested') items = items.filter(i => !!i.taxon);

                    // Taxon group filter
                    if (this.taxonFilter !== 'all') {
                        items = items.filter(i => this.getTaxonGroup(i) === this.taxonFilter);
                    }

                    // Exclude passed (unless explicitly viewing)
                    items = items.filter(i => !this.passItems.includes(i.id));

                    // Sort
                    if (this.sortBy === 'newest') {
                        items.sort((a, b) => new Date(b.observed_at || 0) - new Date(a.observed_at || 0));
                    } else {
                        items.sort((a, b) => new Date(a.observed_at || 0) - new Date(b.observed_at || 0));
                    }

                    return items;
                },

                get activeItem() {
                    if (!this.activeItemId) return null;
                    return this.allItems.find(i => i.id === this.activeItemId) || null;
                },

                get gridClasses() {
                    const m = {
                        '1': 'grid-cols-2',
                        '2': 'grid-cols-3 lg:grid-cols-4',
                        '3': 'grid-cols-4 lg:grid-cols-5',
                        '4': 'grid-cols-5 lg:grid-cols-7',
                        '5': 'grid-cols-7 lg:grid-cols-10'
                    };
                    return m[this.gridCols] || m['3'];
                },

                activateItem(item, index) {
                    this.activeItemId = item.id;
                    this.activeItemIndex = index;
                    this.activePhotoIdx = 0;
                    this.$nextTick(() => lucide.createIcons());
                },

                openQuickID(item, index) {
                    this.$dispatch('open-quick-id', {
                        item: item,
                        queue: this.filteredItems,
                        index: index
                    });
                },

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
                    this.activateItem(this.filteredItems[index], index);
                },

                clearSelection() {
                    this.selectedIds = [];
                    this.lastSelectedIndex = null;
                },

                batchQuickID() {
                    if (this.selectedIds.length === 0) return;
                    const first = this.filteredItems.find(i => this.selectedIds.includes(i.id));
                    if (first) this.openQuickID(first, this.filteredItems.indexOf(first));
                },

                markPass(id) {
                    if (!this.passItems.includes(id)) {
                        this.passItems.push(id);
                        localStorage.setItem('ikimon_skipped_ids', JSON.stringify(this.passItems));
                    }
                    this.navigateNext();
                },

                markLater(id) {
                    if (!this.laterItems.includes(id)) {
                        this.laterItems.push(id);
                        localStorage.setItem('ikimon_later_ids', JSON.stringify(this.laterItems));
                    }
                },

                navigateNext() {
                    const items = this.filteredItems;
                    if (items.length === 0) {
                        this.activeItemId = null;
                        return;
                    }
                    let idx = this.activeItemIndex;
                    if (idx < items.length - 1) idx++;
                    this.activateItem(items[idx], idx);
                },

                navigatePrev() {
                    const items = this.filteredItems;
                    if (items.length === 0) return;
                    let idx = this.activeItemIndex;
                    if (idx > 0) idx--;
                    this.activateItem(items[idx], idx);
                },

                resetFilters() {
                    this.filterText = '';
                    this.taxonFilter = 'all';
                    this.statusFilter = 'all';
                },

                // Presets
                saveCurrentPreset() {
                    const name = prompt('プリセット名を入力:');
                    if (!name) return;
                    this.presets.push({
                        name,
                        taxonFilter: this.taxonFilter,
                        statusFilter: this.statusFilter,
                        filterText: this.filterText
                    });
                    localStorage.setItem('ikimon_wb_presets', JSON.stringify(this.presets));
                    this.$nextTick(() => lucide.createIcons());
                },

                applyPreset(preset) {
                    this.taxonFilter = preset.taxonFilter || 'all';
                    this.statusFilter = preset.statusFilter || 'all';
                    this.filterText = preset.filterText || '';
                },

                removePreset(idx) {
                    this.presets.splice(idx, 1);
                    localStorage.setItem('ikimon_wb_presets', JSON.stringify(this.presets));
                },

                formatDate(d) {
                    if (!d) return '';
                    return new Date(d).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                },



                // Keyboard Shortcuts
                handleKeydown(e) {
                    // Ignore if typing in input
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

                    switch (e.key) {
                        case 'n':
                        case 'N':
                        case 'ArrowRight':
                        case 'ArrowDown':
                            e.preventDefault();
                            this.navigateNext();
                            break;
                        case 'p':
                        case 'P':
                        case 'ArrowLeft':
                        case 'ArrowUp':
                            e.preventDefault();
                            this.navigatePrev();
                            break;
                        case '/':
                            e.preventDefault();
                            if (this.$refs.filterInput) this.$refs.filterInput.focus();
                            break;
                        case 'Enter':
                            e.preventDefault();
                            if (this.activeItem) this.openQuickID(this.activeItem, this.activeItemIndex);
                            break;
                        case 'x':
                        case 'X':
                            if (this.activeItem) this.markPass(this.activeItem.id);
                            break;
                        case 'b':
                        case 'B':
                            if (this.activeItem) this.markLater(this.activeItem.id);
                            break;
                        case 'Escape':
                            this.clearSelection();
                            this.activeItemId = null;
                            break;
                        case 'a':
                            if (e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                                this.selectedIds = this.filteredItems.map(i => i.id);
                            }
                            break;
                    }
                }
            };
        }

        // Listen for identification events
        document.addEventListener('identification-submitted', function(e) {
            console.log('[Workbench] ID submitted:', e.detail);
        });

        document.addEventListener('DOMContentLoaded', () => lucide.createIcons());
    </script>
</body>

</html>