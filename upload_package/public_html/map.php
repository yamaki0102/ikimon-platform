<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $meta_title = "マップ";
    include __DIR__ . '/components/meta.php';
    ?>
    <?php include __DIR__ . '/components/map_config.php'; ?>
    <style>
        /* Force Solid Header on Map Page to prevent readability issues */
        .glass-nav {
            background-color: var(--color-surface) !important;
            backdrop-filter: none !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
        }

        /* ===== Cluster Panel (shared) ===== */
        .cluster-panel {
            position: fixed;
            z-index: 45;
            background: var(--md-surface-container);
            display: flex;
            flex-direction: column;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.25s ease, transform 0.35s var(--motion-std, cubic-bezier(0.32, 0.72, 0, 1));
        }

        .cluster-panel.is-open {
            pointer-events: auto;
            opacity: 1;
        }

        .cluster-panel .panel-list {
            flex: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            background: var(--md-surface-container);
        }

        .cluster-panel .panel-header,
        .obs-detail-topbar {
            position: sticky;
            top: 0;
            z-index: 4;
            background: var(--md-surface-container);
            backdrop-filter: blur(8px);
        }

        .cluster-panel .panel-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-bottom: 1px solid var(--md-outline-variant);
            text-decoration: none;
            color: inherit;
            transition: background 0.15s;
        }

        .cluster-panel .panel-item:hover {
            background: var(--md-surface-container-low);
        }

        .cluster-panel .panel-item:active {
            background: var(--md-surface-container-low);
        }

        /* ===== Mobile: Bottom Sheet ===== */
        @media (max-width: 767px) {
            .cluster-panel {
                left: 0;
                right: 0;
                bottom: 0;
                border-radius: var(--shape-xl) var(--shape-xl) 0 0;
                box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.15);
                max-height: 85vh;
                transform: translateY(100%);
                touch-action: none;
            }

            .cluster-panel.is-open {
                transform: translateY(0);
            }

            .cluster-panel .sheet-handle {
                display: flex;
                justify-content: center;
                padding: 10px 0 4px;
                cursor: grab;
            }

            .cluster-panel .sheet-handle .bar {
                width: 36px;
                height: 4px;
                background: var(--color-border);
                border-radius: 2px;
            }

            .cluster-panel .panel-header {
                padding: 4px 16px 12px;
            }
        }

        /* ===== Desktop: Centered Bottom Sheet ===== */
        @media (min-width: 768px) {
            .cluster-panel {
                left: 50%;
                right: auto;
                bottom: 0;
                width: 520px;
                height: auto;
                max-height: 75vh;
                border-radius: var(--shape-xl) var(--shape-xl) 0 0;
                transform: translateX(-50%) translateY(100%);
                border-right: none;
                box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.15);
            }

            .cluster-panel.is-open {
                transform: translateX(-50%) translateY(0);
            }

            .cluster-panel .sheet-handle {
                display: flex;
            }

            .cluster-panel .panel-header {
                padding: 4px 16px 12px;
            }
        }

        /* ===== Filter Chip Bar ===== */
        .filter-chip-bar {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
            padding: 0 4px;
        }

        .filter-chip-bar::-webkit-scrollbar {
            display: none;
        }

        .filter-chip {
            flex-shrink: 0;
            padding: 6px 14px;
            border-radius: var(--shape-full);
            font-size: 13px;
            font-weight: 600;
            border: 1.5px solid var(--md-outline-variant);
            background: transparent;
            color: var(--md-on-surface-variant);
            white-space: nowrap;
            cursor: pointer;
            transition: all 0.15s;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .filter-chip:hover {
            border-color: var(--md-on-surface-variant);
            background: var(--md-surface-container-low);
        }

        .filter-chip.active {
            background: var(--md-secondary-container);
            border-color: transparent;
            color: var(--md-on-secondary-container);
        }

        /* ===== Observation Detail View (in panel) ===== */
        .obs-detail-view {
            display: flex;
            flex-direction: column;
            flex: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
        }

        .obs-detail-photo {
            width: 100%;
            aspect-ratio: 4/3;
            object-fit: cover;
            background: var(--md-surface-container-low);
        }

        .obs-detail-info {
            padding: 16px;
        }

        .obs-detail-info h2 {
            font-size: 1.25rem;
            font-weight: 700;
            margin: 0 0 2px;
        }

        .obs-detail-info .sci-name {
            font-size: 0.8rem;
            color: var(--color-faint);
            font-style: italic;
        }

        .obs-detail-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 12px;
            font-size: 0.8rem;
            color: var(--md-on-surface-variant);
        }

        .obs-detail-meta .meta-item {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        /* ===== Layer Switcher ===== */
        .layer-popup {
            position: absolute;
            bottom: 60px;
            right: 0;
            background: var(--md-surface-container);
            border-radius: var(--shape-md);
            box-shadow: var(--elev-3);
            padding: 8px;
            min-width: 160px;
            z-index: 50;
        }

        .layer-option {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-radius: var(--shape-sm);
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            color: var(--md-on-surface);
            transition: background 0.15s;
        }

        .layer-option:hover {
            background: var(--md-surface-container-low);
        }

        .layer-option.active {
            background: var(--md-primary-container);
            color: var(--md-primary);
        }

        /* ===== Tab Navigation ===== */
        .map-tab-bar {
            display: flex;
            background: var(--md-surface-container);
            border-radius: var(--shape-md);
            padding: 3px;
            gap: 2px;
            box-shadow: var(--elev-1);
            border: 1px solid var(--md-outline-variant);
        }

        .map-tab {
            flex: 1;
            padding: 4px 8px;
            border-radius: var(--shape-sm);
            font-size: 11px;
            font-weight: 700;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
            color: var(--md-on-surface-variant);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            white-space: nowrap;
            background: transparent;
            border: none;
        }

        .map-tab:hover {
            color: var(--md-on-surface);
            background: var(--md-surface-container-low);
        }

        .map-tab.active {
            background: var(--md-primary);
            color: #fff;
            box-shadow: 0 2px 8px rgba(var(--color-primary-rgb, 16, 185, 129), 0.3);
        }

        .map-floating-panel {
            background: var(--md-surface-container);
            border: 1px solid var(--md-outline-variant);
            border-radius: var(--shape-xl);
            padding: 8px;
            box-shadow: var(--elev-3);
            backdrop-filter: blur(10px);
        }

        @supports not (backdrop-filter: blur(10px)) {
            .map-floating-panel {
                background: var(--md-surface-container);
            }
        }

        /* ===== Heatmap Legend ===== */
        .heatmap-legend {
            position: absolute;
            bottom: 100px;
            left: 16px;
            z-index: 10;
            background: var(--md-surface-container);
            border-radius: 10px;
            padding: 10px 14px;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
            border: 1px solid var(--md-outline-variant);
            font-size: 11px;
        }

        @media (min-width: 768px) {
            .heatmap-legend {
                left: auto;
                right: 80px;
                bottom: 16px;
            }
        }

        .heatmap-legend .gradient-bar {
            width: 120px;
            height: 8px;
            border-radius: 4px;
            background: linear-gradient(to right, #2b83ba, #64c2a6, #ffd94e, #f57a3c, #d7191c);
            margin: 6px 0;
        }

        /* ===== Year Filter Select ===== */
        .year-filter-select {
            padding: 6px 10px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            border: 1.5px solid var(--md-outline-variant);
            background: var(--md-surface-container);
            color: var(--md-on-surface);
            cursor: pointer;
        }

        /* ===== Site List Panel ===== */
        .site-list-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            border-bottom: 1px solid var(--md-outline-variant);
            cursor: pointer;
            transition: background 0.15s;
        }

        .site-list-item:hover {
            background: var(--md-surface-container-low);
        }

        /* ===== Ghost Markers (Ambient Presence) ===== */
        .ghost-marker {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            pointer-events: none;
            background: radial-gradient(circle, rgba(16,185,129,0.6) 0%, rgba(16,185,129,0) 70%);
            animation: ghost-pulse 3s infinite;
        }
        @keyframes ghost-pulse {
            0% { transform: scale(0.8); opacity: 0.6; }
            50% { transform: scale(1.5); opacity: 0.1; }
            100% { transform: scale(0.8); opacity: 0.6; }
        }
    </style>
</head>

<body class="js-loading font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include('components/nav.php'); ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main class="relative w-full h-screen overflow-hidden" x-data="mapExplorer()">

        <!-- Map -->
        <div id="map" class="absolute inset-0 w-full h-full z-0"></div>

        <!-- Search + Tabs Card: centered, just below nav -->
        <div x-show="!showBottomSheet && !selectedObs" x-transition.opacity.duration.200ms
             class="absolute top-[58px] left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-[480px] md:w-full z-30 pointer-events-auto flex flex-col gap-1.5 map-floating-panel">

            <!-- Tab Navigation (compact) -->
            <div class="map-tab-bar" role="tablist" aria-label="マップ表示タブ">
                <button class="map-tab" role="tab" :aria-selected="activeTab === 'markers'" :class="{'active': activeTab === 'markers'}" @click="switchTab('markers')">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5"></i> マップ
                </button>
                <button class="map-tab" role="tab" :aria-selected="activeTab === 'heatmap'" :class="{'active': activeTab === 'heatmap'}" @click="switchTab('heatmap')">
                    <i data-lucide="flame" class="w-3.5 h-3.5"></i> ストランド
                </button>
                <button class="map-tab" role="tab" :aria-selected="activeTab === 'coverage'" :class="{'active': activeTab === 'coverage'}" @click="switchTab('coverage')">
                    <i data-lucide="grid-3x3" class="w-3.5 h-3.5"></i> 調査網羅
                </button>
                <button class="map-tab" role="tab" :aria-selected="activeTab === 'biodiversity'" :class="{'active': activeTab === 'biodiversity'}" @click="switchTab('biodiversity')">
                    <i data-lucide="leaf" class="w-3.5 h-3.5"></i> 多様性
                </button>
            </div>

            <!-- Search Bar -->
            <div class="relative z-50">
                <div class="flex items-center overflow-hidden relative z-10" style="background:var(--md-surface-container);border:1px solid var(--md-outline-variant);border-radius:var(--shape-xl);box-shadow:var(--elev-2);">
                    <i data-lucide="search" class="ml-4 w-5 h-5 text-muted"></i>
                    <input type="text" x-model="query"
                        @input.debounce.300ms="onInput()"
                        @keydown.enter="onEnter()"
                        @focus="showSuggestions = true"
                        @click.outside="showSuggestions = false"
                        placeholder="場所や種名を検索..."
                        class="flex-1 bg-transparent border-none text-text placeholder-muted focus:ring-0 text-sm h-12 px-3">
                </div>

                <!-- Autocomplete Dropdown -->
                <div x-show="showSuggestions && suggestions.length > 0"
                    x-transition
                    class="absolute top-14 left-0 right-0 overflow-hidden max-h-60 overflow-y-auto" style="background:var(--md-surface-container-high);border-radius:var(--shape-md);box-shadow:var(--elev-3);">
                    <template x-for="s in suggestions" :key="s.place_id">
                        <button @click="selectLocation(s)" class="w-full text-left px-4 py-3 hover:bg-bg-faint border-b border-border last:border-0 transition flex items-start gap-3">
                            <i data-lucide="map-pin" class="w-4 h-4 text-muted mt-0.5 shrink-0"></i>
                            <div>
                                <p class="text-sm font-bold text-text line-clamp-1" x-text="s.name"></p>
                                <p class="text-xs text-muted line-clamp-1" x-text="formatAddress(s)"></p>
                            </div>
                        </button>
                    </template>
                </div>
            </div>
        </div>

        <!-- Filter Chips Row: separate overlay below search card -->
        <div x-show="!showBottomSheet && !selectedObs" x-transition.opacity.duration.200ms
             class="absolute top-[156px] left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-[560px] md:w-full z-20 pointer-events-auto">

            <!-- Filter Chip Bar (markers tab) -->
            <div class="filter-chip-bar" x-show="activeTab === 'markers'" x-transition>
                <button class="filter-chip" :class="{'active': activeTaxonGroup === ''}" @click="setTaxonGroup('')">✨ すべて</button>
                <button class="filter-chip" :class="{'active': activeTaxonGroup === 'insect'}" @click="setTaxonGroup('insect')">🦋 昆虫</button>
                <button class="filter-chip" :class="{'active': activeTaxonGroup === 'bird'}" @click="setTaxonGroup('bird')">🐦 鳥類</button>
                <button class="filter-chip" :class="{'active': activeTaxonGroup === 'plant'}" @click="setTaxonGroup('plant')">🌿 植物</button>
                <button class="filter-chip" :class="{'active': activeTaxonGroup === 'amphibian_reptile'}" @click="setTaxonGroup('amphibian_reptile')">🐸 両爬</button>
                <button class="filter-chip" :class="{'active': activeTaxonGroup === 'mammal'}" @click="setTaxonGroup('mammal')">🐾 哺乳類</button>
                <button class="filter-chip" :class="{'active': activeTaxonGroup === 'fungi'}" @click="setTaxonGroup('fungi')">🍄 菌類</button>
            </div>

            <!-- Coverage info bar -->
            <div class="flex items-center gap-2 px-1 py-1 text-sm text-muted" x-show="activeTab === 'coverage'" x-transition>
                <i data-lucide="info" class="w-4 h-4 shrink-0"></i>
                <span>コミュニティのスキャン済みエリアを表示（k匿名性保護済み）</span>
            </div>

            <!-- Heatmap Filters (heatmap tab) -->
            <div class="flex items-center gap-2" x-show="activeTab === 'heatmap'" x-transition>
                <div class="filter-chip-bar flex-1">
                    <button class="filter-chip" :class="{'active': heatmapTaxon === 'all'}" @click="setHeatmapTaxon('all')">✨ 全て</button>
                    <button class="filter-chip" :class="{'active': heatmapTaxon === 'Insecta'}" @click="setHeatmapTaxon('Insecta')">🦋 昆虫</button>
                    <button class="filter-chip" :class="{'active': heatmapTaxon === 'Aves'}" @click="setHeatmapTaxon('Aves')">🐦 鳥類</button>
                    <button class="filter-chip" :class="{'active': heatmapTaxon === 'Plantae'}" @click="setHeatmapTaxon('Plantae')">🌿 植物</button>
                    <button class="filter-chip" :class="{'active': heatmapTaxon === 'Mammalia'}" @click="setHeatmapTaxon('Mammalia')">🐾 哺乳類</button>
                </div>
                <select class="year-filter-select" x-model="heatmapYear" @change="loadHeatmapData()">
                    <option value="all">全期間</option>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                </select>
            </div>

            <!-- Biodiversity Filters (biodiversity tab) -->
            <div class="flex flex-wrap items-center gap-2" x-show="activeTab === 'biodiversity'" x-transition>
                <div class="filter-chip-bar flex-1">
                    <button class="filter-chip" :class="{'active': biodiversityStage === 'all'}" @click="setBiodiversityStage('all')">✨ すべて</button>
                    <button class="filter-chip" :class="{'active': biodiversityStage === 'S'}" @click="setBiodiversityStage('S')"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;margin-right:3px"></span>S 充実</button>
                    <button class="filter-chip" :class="{'active': biodiversityStage === 'A'}" @click="setBiodiversityStage('A')"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;margin-right:3px"></span>A 豊か</button>
                    <button class="filter-chip" :class="{'active': biodiversityStage === 'B'}" @click="setBiodiversityStage('B')"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:3px"></span>B 成長中</button>
                    <button class="filter-chip" :class="{'active': biodiversityStage === 'C'}" @click="setBiodiversityStage('C')"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3b82f6;margin-right:3px"></span>C 芽吹き</button>
                    <button class="filter-chip" :class="{'active': biodiversityStage === 'D'}" @click="setBiodiversityStage('D')"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#94a3b8;margin-right:3px"></span>D 発見</button>
                </div>
                <button class="filter-chip" :class="{'active': biodiversityRedlistOnly}" @click="toggleBiodiversityRedlist()">🔴 希少種のみ</button>
            </div>
        </div>

        <!-- Heatmap Legend (heatmap tab only) -->
        <div class="heatmap-legend" x-show="activeTab === 'heatmap'" x-transition style="display:none;">
            <div class="font-bold text-text mb-1">観察密度</div>
            <div class="gradient-bar"></div>
            <div class="flex justify-between text-muted">
                <span>少</span>
                <span>多</span>
            </div>
            <div class="text-muted mt-1" x-text="'データ: ' + heatmapPointCount.toLocaleString() + '件'"></div>
        </div>

        <!-- Coverage Legend -->
        <div x-show="activeTab === 'coverage'" x-transition style="display:none;"
             class="heatmap-legend">
            <div class="font-bold text-text mb-1">スキャン回数</div>
            <div style="height:8px;border-radius:4px;background:linear-gradient(to right, rgba(16,185,129,0.12), rgba(16,185,129,0.75));"></div>
            <div class="flex justify-between text-muted text-xs mt-0.5">
                <span>少</span><span>多</span>
            </div>
            <div class="text-muted text-xs mt-1" x-text="coverageMeshCount.toLocaleString() + ' メッシュ調査済み'"></div>
        </div>

        <!-- Biodiversity Legend -->
        <div x-show="activeTab === 'biodiversity'" x-transition style="display:none;" class="heatmap-legend">
            <div class="font-bold text-text mb-2">多様性マップ</div>
            <div class="flex gap-3 mb-3">
                <div>
                    <div class="font-black text-emerald-600" style="font-size:18px;line-height:1.1;" x-text="biodiversityStats.meshes || '—'"></div>
                    <div class="text-muted" style="font-size:10px;">調査エリア</div>
                </div>
                <div>
                    <div class="font-black text-blue-600" style="font-size:18px;line-height:1.1;" x-text="biodiversityStats.species || '—'"></div>
                    <div class="text-muted" style="font-size:10px;">確認種</div>
                </div>
                <div>
                    <div class="font-black text-red-600" style="font-size:18px;line-height:1.1;" x-text="biodiversityStats.redlist"></div>
                    <div class="text-muted" style="font-size:10px;">希少種</div>
                </div>
            </div>
            <div class="font-bold text-muted border-t pt-2 mb-1" style="font-size:11px;">成長段階</div>
            <div style="display:flex;flex-direction:column;gap:3px;font-size:11px;">
                <div style="display:flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block;"></span><span class="text-text">S — 充実</span></div>
                <div style="display:flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;display:inline-block;"></span><span class="text-text">A — 豊か</span></div>
                <div style="display:flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block;"></span><span class="text-text">B — 成長中</span></div>
                <div style="display:flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;display:inline-block;"></span><span class="text-text">C — 芽吹き</span></div>
                <div style="display:flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:#94a3b8;display:inline-block;"></span><span class="text-text">D — 発見</span></div>
            </div>
            <div class="text-muted mt-2" style="font-size:10px;">記録が増えるとエリアが成長します</div>
        </div>

        <!-- Observation Detail Preview (in-page, no navigation) -->
        <div class="cluster-panel" :class="{'is-open': (selectedObs || selectedMesh) && !showBottomSheet}" id="obsDetailPanel">
            <div class="sheet-handle">
                <div class="bar"></div>
            </div>
            <template x-if="selectedObs">
                <div class="obs-detail-view">
                    <!-- Header bar with back and close -->
                    <div class="obs-detail-topbar" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border-bottom:1px solid var(--color-border);">
                        <button @click="selectedObs = null; showBottomSheet = true" style="display:flex; align-items:center; gap:4px; font-size:13px; font-weight:600; color:var(--color-primary); background:none; border:none; cursor:pointer;">
                            ← 一覧に戻る
                        </button>
                        <button @click="selectedObs = null" style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:var(--color-bg-faint); border:none; cursor:pointer; color:var(--color-muted);">
                            ✕
                        </button>
                    </div>
                    <!-- Photo -->
                    <div class="relative">
                        <img :src="selectedObs.photos && selectedObs.photos[0] ? selectedObs.photos[0] : 'assets/img/placeholder.png'"
                            :alt="selectedObs.taxon ? selectedObs.taxon.name : '観察写真'"
                            class="obs-detail-photo" loading="lazy">
                        <!-- Status badge overlay -->
                        <span class="absolute bottom-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm"
                            :class="selectedObs.status === 'Research Grade' ? 'bg-primary/90 text-white' : 'bg-warning/90 text-warning-surface'"
                            x-text="selectedObs.status || 'Needs ID'"></span>
                    </div>
                    <!-- Info -->
                    <div class="obs-detail-info">
                        <h2 x-text="selectedObs.taxon ? selectedObs.taxon.name : '未同定'"></h2>
                        <p class="sci-name" x-show="selectedObs.taxon && selectedObs.taxon.scientific_name"
                            x-text="selectedObs.taxon ? selectedObs.taxon.scientific_name : ''" style="color: var(--color-faint);"></p>

                        <div class="obs-detail-meta">
                            <span class="meta-item">
                                <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                                <span x-text="selectedObs.observed_at ? selectedObs.observed_at.slice(0,10) : ''"></span>
                            </span>
                            <span class="meta-item">
                                <i data-lucide="map-pin" class="w-3.5 h-3.5"></i>
                                <span x-text="selectedObs.place_name || selectedObs.location?.name || ''"></span>
                            </span>
                            <span class="meta-item" x-show="selectedObs.user_name">
                                <i data-lucide="user" class="w-3.5 h-3.5"></i>
                                <span x-text="selectedObs.user_name || ''"></span>
                            </span>
                        </div>

                        <!-- Notes -->
                        <p class="text-sm text-muted mt-3 leading-relaxed" x-show="selectedObs.note" x-text="selectedObs.note"></p>

                        <!-- Red list badge -->
                        <div class="mt-3 flex items-center gap-2" x-show="selectedObs.red_list">
                            <span class="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                                <i data-lucide="alert-triangle" class="w-3 h-3"></i>
                                <span x-text="selectedObs.red_list ? selectedObs.red_list.category : ''"></span>
                            </span>
                        </div>

                        <!-- Action Buttons -->
                        <div style="display:flex; gap:8px; margin-top:16px;">
                            <button @click="selectedObs = null; showBottomSheet = true"
                                style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px; border:1px solid var(--color-border); border-radius:12px; background:var(--color-surface); color:var(--color-text); font-size:13px; font-weight:600; cursor:pointer;">
                                ← 一覧に戻る
                            </button>
                            <a :href="'observation_detail.php?id=' + selectedObs.id"
                                style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px; border-radius:12px; background:var(--color-primary-surface); color:var(--color-primary); font-size:13px; font-weight:700; text-decoration:none; cursor:pointer;">
                                詳しく見る →
                            </a>
                        </div>
                    </div>
                </div>
            </template>
            <!-- Biodiversity Mesh Detail Panel -->
            <template x-if="selectedMesh">
                <div class="obs-detail-view">
                    <div class="obs-detail-topbar" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border-bottom:1px solid var(--color-border);">
                        <span style="font-size:13px; font-weight:700; color:var(--color-text);">多様性メッシュ</span>
                        <button @click="selectedMesh = null" style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:var(--color-bg-faint); border:none; cursor:pointer; color:var(--color-muted);">✕</button>
                    </div>
                    <div class="obs-detail-info">
                        <!-- ステージバッジ + スコア -->
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                            <span style="display:inline-flex; align-items:center; justify-content:center; width:44px; height:44px; border-radius:12px; font-size:20px; font-weight:900;"
                                :style="'background:' + ({S:'#ef4444',A:'#f59e0b',B:'#10b981',C:'#3b82f6',D:'#94a3b8'}[selectedMesh.stage]||'#94a3b8') + '22;border:2px solid ' + ({S:'#ef4444',A:'#f59e0b',B:'#10b981',C:'#3b82f6',D:'#94a3b8'}[selectedMesh.stage]||'#94a3b8') + ';color:' + ({S:'#ef4444',A:'#f59e0b',B:'#10b981',C:'#3b82f6',D:'#94a3b8'}[selectedMesh.stage]||'#94a3b8')"
                                x-text="selectedMesh.stage || 'D'"></span>
                            <div>
                                <div style="font-size:16px; font-weight:900;"
                                    :style="'color:' + ({S:'#ef4444',A:'#f59e0b',B:'#10b981',C:'#3b82f6',D:'#94a3b8'}[selectedMesh.stage]||'#94a3b8')"
                                    x-text="{S:'充実',A:'豊か',B:'成長中',C:'芽吹き',D:'発見'}[selectedMesh.stage] || '発見'"></div>
                                <div style="font-size:11px; color:var(--color-muted);">BIS スコア: <span x-text="selectedMesh.score || 0"></span>/100</div>
                            </div>
                            <span x-show="selectedMesh.red_list_count > 0" style="margin-left:auto; background:rgba(239,68,68,0.12); color:#ef4444; padding:3px 8px; border-radius:8px; font-size:11px; font-weight:700;">🔴 希少種 <span x-text="selectedMesh.red_list_count"></span></span>
                        </div>

                        <!-- 種数サマリー -->
                        <div style="font-size:11px; color:var(--color-muted); margin-bottom:10px;">
                            <span x-text="(selectedMesh.species_count || 0) + '種'"></span>
                            <span> · </span>
                            <span x-text="(selectedMesh.total || 0) + '件の記録'"></span>
                            <span x-show="selectedMesh.group_count"> · <span x-text="selectedMesh.group_count"></span>グループ</span>
                        </div>

                        <!-- BIS 5軸バー -->
                        <div style="margin-bottom:12px;">
                            <div style="font-size:11px; font-weight:700; color:var(--color-muted); margin-bottom:6px;">BIS スコア内訳</div>
                            <template x-for="ax in [{key:'richness',label:'種の多様性',color:'#10b981'},{key:'confidence',label:'データ信頼性',color:'#3b82f6'},{key:'conservation',label:'保全価値',color:'#ef4444'},{key:'coverage',label:'分類群カバー率',color:'#f59e0b'},{key:'effort',label:'調査の継続性',color:'#8b5cf6'}]" :key="ax.key">
                                <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
                                    <span style="font-size:10px; color:var(--color-muted); min-width:80px;" x-text="ax.label"></span>
                                    <div style="flex:1; height:4px; border-radius:2px; background:var(--color-border);">
                                        <div style="height:100%; border-radius:2px; transition:width 0.3s;"
                                            :style="'width:' + (selectedMesh[ax.key] || 0) + '%;background:' + ax.color"></div>
                                    </div>
                                    <span style="font-size:10px; color:var(--color-muted); min-width:20px; text-align:right;" x-text="selectedMesh[ax.key] || 0"></span>
                                </div>
                            </template>
                        </div>

                        <!-- 種リスト -->
                        <div x-show="selectedMesh.species && selectedMesh.species.length > 0" style="border-top:1px solid var(--color-border); padding-top:10px; margin-bottom:12px;">
                            <div style="font-size:11px; font-weight:700; color:var(--color-muted); margin-bottom:6px;">確認されている生き物</div>
                            <div style="display:flex; flex-wrap:wrap; gap:4px;">
                                <template x-for="sp in (selectedMesh.species || []).slice(0, 10)" :key="sp.name">
                                    <span style="display:inline-flex; align-items:center; gap:3px; background:var(--color-surface); border-radius:8px; padding:2px 8px; font-size:11px; color:var(--color-text);"
                                        :style="'border:1px solid ' + ({'鳥類':'#f59e0b','植物':'#10b981','昆虫':'#f97316','哺乳類':'#8b5cf6','爬虫類':'#84cc16','両生類':'#06b6d4','魚類':'#3b82f6','クモ類':'#ec4899','菌類':'#a78bfa'}[sp.group] || '#9ca3af') + '66'">
                                        <span x-text="{'鳥類':'🐦','植物':'🌿','昆虫':'🐛','哺乳類':'🐾','爬虫類':'🦎','両生類':'🐸','魚類':'🐟','クモ類':'🕷','菌類':'🍄'}[sp.group] || '•'"></span>
                                        <span x-text="sp.name"></span>
                                        <span x-show="sp.count > 1" style="font-size:9px; opacity:0.5;" x-text="'×' + sp.count"></span>
                                    </span>
                                </template>
                            </div>
                        </div>

                        <!-- CTA ボタン -->
                        <div style="display:flex; gap:8px; margin-top:4px;">
                            <a :href="'post.php?lat=' + (selectedMesh._center ? selectedMesh._center[1].toFixed(5) : '') + '&lng=' + (selectedMesh._center ? selectedMesh._center[0].toFixed(5) : '')"
                                style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px; border-radius:12px; background:var(--color-primary); color:#fff; font-size:13px; font-weight:700; text-decoration:none; cursor:pointer;">
                                <i data-lucide="camera" class="w-4 h-4"></i> 記録する
                            </a>
                            <button @click="selectedMesh = null; switchTab('markers')"
                                style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px; border:1px solid var(--color-border); border-radius:12px; background:var(--color-surface); color:var(--color-text); font-size:13px; font-weight:600; cursor:pointer;">
                                <i data-lucide="map-pin" class="w-4 h-4"></i> 観察を見る
                            </button>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        <!-- Cluster Panel (Google Maps style - sidebar on PC, bottom sheet on mobile) -->
        <div class="cluster-panel" :class="{'is-open': showBottomSheet}" id="clusterPanel"
            @touchstart.passive="onSheetTouchStart($event)"
            @touchmove.passive="onSheetTouchMove($event)"
            @touchend="onSheetTouchEnd($event)">
            <!-- Mobile drag handle -->
            <div class="sheet-handle">
                <div class="bar"></div>
            </div>
            <!-- Header -->
            <div class="panel-header flex items-center justify-between">
                <h3 class="text-sm font-bold text-text flex items-center gap-2">
                    <i data-lucide="layers" class="w-4 h-4 text-primary"></i>
                    <span>この周辺の観察</span>
                    <span class="text-xs font-normal text-muted" x-text="'(' + clusterItems.length + '件)'"></span>
                </h3>
                <button @click="showBottomSheet = false" class="p-1.5 rounded-full hover:bg-bg-faint text-muted transition">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <!-- Observation List -->
            <div class="panel-list" id="panelList">
                <template x-for="obs in clusterItems" :key="obs.id">
                    <div @click="selectedObs = obs; showBottomSheet = false; if(map && obs.lat && obs.lng) { map.flyTo({center: [obs.lng, obs.lat], zoom: 15, offset: [0, -100]}); }" class="panel-item cursor-pointer">
                        <img :src="obs.photos && obs.photos[0] ? obs.photos[0] : 'assets/img/placeholder.png'"
                            :alt="obs.taxon ? obs.taxon.name : '観察写真'"
                            class="w-14 h-14 rounded-xl object-cover bg-bg-faint border border-border flex-shrink-0"
                            loading="lazy">
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-text truncate"
                                x-text="obs.taxon ? obs.taxon.name : '未同定'"></p>
                            <p class="text-xs text-muted truncate" x-show="obs.taxon && obs.taxon.scientific_name"
                                x-text="obs.taxon ? obs.taxon.scientific_name : ''"></p>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-token-xs text-muted flex items-center gap-0.5">
                                    <i data-lucide="calendar" class="w-3 h-3"></i>
                                    <span x-text="obs.observed_at ? obs.observed_at.slice(0,10) : ''"></span>
                                </span>
                                <span class="text-token-xs font-semibold px-1.5 py-0.5 rounded-full"
                                    :class="obs.status === 'Research Grade' ? 'bg-primary-surface text-primary' : 'bg-warning-surface text-warning'"
                                    x-text="obs.status || 'Needs ID'"></span>
                            </div>
                        </div>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-border flex-shrink-0"></i>
                    </div>
                </template>
                <div x-show="clusterItems.length === 0" class="py-8 text-center text-muted text-sm">
                    読み込み中...
                </div>
            </div>
        </div>

        <!-- My Location FAB -->
        <button @click="locateMe()" class="absolute bottom-[5.5rem] right-4 z-10 w-12 h-12 rounded-full shadow-xl flex items-center justify-center active:scale-90 transition group pointer-events-auto" style="background:var(--md-surface-container);color:var(--md-on-surface);box-shadow:var(--elev-3);">
            <i data-lucide="crosshair" class="group-hover:rotate-45 transition duration-500"></i>
            <span x-show="locating" class="absolute inset-0 rounded-full border-2 border-primary-light animate-ping"></span>
        </button>

        <!-- Layer Switcher FAB -->
        <div class="absolute bottom-[3.5rem] right-4 z-10 pointer-events-auto" @click.outside="showLayerMenu = false">
            <button @click="showLayerMenu = !showLayerMenu" class="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90" style="background:var(--md-surface-container);box-shadow:var(--elev-2);color:var(--md-on-surface-variant);">
                <i data-lucide="layers" class="w-5 h-5"></i>
            </button>
            <div x-show="showLayerMenu" x-transition class="layer-popup" style="display:none;">
                <div class="layer-option" :class="{'active': activeLayer === 'standard'}" @click="switchLayer('standard')">
                    <i data-lucide="map" class="w-4 h-4"></i> 標準
                </div>
                <div class="layer-option" :class="{'active': activeLayer === 'satellite'}" @click="switchLayer('satellite')">
                    <i data-lucide="globe" class="w-4 h-4"></i> 航空写真
                </div>
                <div class="layer-option" :class="{'active': activeLayer === 'terrain'}" @click="switchLayer('terrain')">
                    <i data-lucide="mountain" class="w-4 h-4"></i> 地形図
                </div>
            </div>
        </div>

        <!-- Signs FAB (Strand System) -->
        <button @click="showSignModal = true" class="absolute bottom-[9rem] right-4 z-10 w-10 h-10 rounded-full bg-surface text-accent border border-accent/20 shadow-lg flex items-center justify-center active:scale-90 transition hover:bg-accent-surface pointer-events-auto">
            <i data-lucide="sticker" class="w-5 h-5"></i>
        </button>

        <!-- Sign Modal -->
        <div x-show="showSignModal"
            x-cloak
            style="display: none;"
            class="fixed inset-0 z-[70] flex items-center justify-center px-4 pointer-events-auto bg-black/40 backdrop-blur-sm"
            x-transition.opacity>
            <div @click.away="showSignModal = false" class="w-full max-w-xs p-6 relative" style="background:var(--md-surface-container);border:1px solid var(--md-outline-variant);border-radius:var(--shape-xl);box-shadow:var(--elev-3);">
                <h3 class="text-text font-bold text-center mb-6 tracking-widest uppercase text-xs flex items-center justify-center gap-2">
                    <i data-lucide="map-pin" class="w-4 h-4 text-accent"></i> サインを残す
                </h3>

                <div class="grid grid-cols-3 gap-4">
                    <button @click="placeSign('view')" class="flex flex-col items-center gap-2 text-muted hover:text-accent transition group">
                        <div class="w-12 h-12 rounded-full border border-border flex items-center justify-center bg-bg-faint group-hover:bg-accent-surface group-hover:border-accent/40 transition">
                            <i data-lucide="camera" class="w-6 h-6"></i>
                        </div>
                        <span class="text-token-xs font-bold">景色</span>
                    </button>
                    <button @click="placeSign('rest')" class="flex flex-col items-center gap-2 text-muted hover:text-primary transition group">
                        <div class="w-12 h-12 rounded-full border border-border flex items-center justify-center bg-bg-faint group-hover:bg-primary-surface group-hover:border-primary-glow transition">
                            <i data-lucide="coffee" class="w-6 h-6"></i>
                        </div>
                        <span class="text-token-xs font-bold">休憩</span>
                    </button>
                    <button @click="placeSign('danger')" class="flex flex-col items-center gap-2 text-muted hover:text-danger transition group">
                        <div class="w-12 h-12 rounded-full border border-border flex items-center justify-center bg-bg-faint group-hover:bg-danger/10 group-hover:border-danger/40 transition">
                            <i data-lucide="alert-triangle" class="w-6 h-6"></i>
                        </div>
                        <span class="text-token-xs font-bold">注意</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Add Spot Help FAB -->
        <button @click="showAddSpotModal = true" class="absolute bottom-[11rem] right-4 z-10 w-10 h-10 rounded-full bg-white/90 text-gray-600 shadow-lg flex items-center justify-center active:scale-90 transition hover:bg-white pointer-events-auto backdrop-blur-sm">
            <i data-lucide="map-pin" class="w-5 h-5 relative z-10"></i>
            <i data-lucide="plus" class="w-3 h-3 absolute top-1.5 right-1.5 text-blue-500 bg-white rounded-full z-20"></i>
        </button>

        <!-- Add Spot Modal -->
        <div x-show="showAddSpotModal"
            x-cloak
            style="display: none;"
            class="fixed inset-0 z-[60] flex items-center justify-center px-4 pointer-events-auto">

            <!-- Backdrop -->
            <div x-transition:enter="transition ease-out duration-300"
                x-transition:enter-start="opacity-0"
                x-transition:enter-end="opacity-100"
                x-transition:leave="transition ease-in duration-200"
                x-transition:leave-start="opacity-100"
                x-transition:leave-end="opacity-0"
                @click="showAddSpotModal = false"
                class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

            <!-- Modal Content -->
            <div x-transition:enter="transition ease-out duration-300"
                x-transition:enter-start="opacity-0 scale-95 translate-y-4"
                x-transition:enter-end="opacity-100 scale-100 translate-y-0"
                x-transition:leave="transition ease-in duration-200"
                x-transition:leave-start="opacity-100 scale-100 translate-y-0"
                x-transition:leave-end="opacity-0 scale-95 translate-y-4"
                class="p-6 w-full max-w-sm relative text-center" style="background:var(--md-surface-container);border:1px solid var(--md-outline-variant);border-radius:var(--shape-xl);box-shadow:var(--elev-3);">

                <div class="w-12 h-12 bg-primary-surface rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                    <i data-lucide="map-pin" class="w-6 h-6"></i>
                </div>

                <h3 class="text-xl font-bold mb-2 text-text">地図に場所がない？</h3>
                <p class="text-muted text-sm leading-relaxed mb-6">
                    この地図は「OpenStreetMap」を使用しています。<br>
                    もし場所が見つからない場合は、OpenStreetMapの公式サイトから誰でも地図を更新できます。
                </p>

                <div class="flex flex-col gap-3">
                    <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer" class="w-full bg-primary hover:bg-primary-light text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                        <i data-lucide="external-link" class="w-4 h-4"></i>
                        OpenStreetMapで追加する
                    </a>
                    <button @click="showAddSpotModal = false" class="w-full bg-bg-faint hover:bg-border text-muted font-bold py-3 rounded-xl transition">
                        閉じる
                    </button>
                </div>
            </div>
        </div>

    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        function mapExplorer() {
            const STAGE_COLORS = { S:'#ef4444', A:'#f59e0b', B:'#10b981', C:'#3b82f6', D:'#94a3b8' };
            const STAGE_LABELS = { S:'充実', A:'豊か', B:'成長中', C:'芽吹き', D:'発見' };
            const BIS_AXES = [
                { key:'richness',     label:'種の多様性',     color:'#10b981' },
                { key:'confidence',   label:'データ信頼性',   color:'#3b82f6' },
                { key:'conservation', label:'保全価値',       color:'#ef4444' },
                { key:'coverage',     label:'分類群カバー率', color:'#f59e0b' },
                { key:'effort',       label:'調査の継続性',   color:'#8b5cf6' }
            ];
            const GROUP_ICONS = { '鳥類':'🐦','植物':'🌿','昆虫':'🐛','哺乳類':'🐾','爬虫類':'🦎','両生類':'🐸','魚類':'🐟','クモ類':'🕷','菌類':'🍄','その他':'•' };
            const GROUP_COLORS = { '鳥類':'#f59e0b','植物':'#10b981','昆虫':'#f97316','哺乳類':'#8b5cf6','爬虫類':'#84cc16','両生類':'#06b6d4','魚類':'#3b82f6','クモ類':'#ec4899','菌類':'#a78bfa','その他':'#9ca3af' };

            return {
                query: '',
                items: [],
                map: null,
                markers: {},
                selectedObs: null,
                showSignModal: false,
                signs: [],
                signMarkers: {},
                loading: false,
                locating: false,
                suggestions: [],
                showSuggestions: false,
                showAddSpotModal: false,
                showBottomSheet: false,
                clusterItems: [],
                _sheetStartY: 0,
                _sheetCurrentY: 0,
                // Sprint 1: Filter chips, Layer switcher
                activeTaxonGroup: '',
                activeLayer: localStorage.getItem('ikimon_map_layer') || 'standard',
                showLayerMenu: false,

                // Tab system
                activeTab: (() => {
                    const tab = new URLSearchParams(window.location.search).get('tab') || 'markers';
                    return ['markers', 'heatmap', 'coverage', 'biodiversity'].includes(tab) ? tab : 'markers';
                })(),

                // Heatmap state
                heatmapTaxon: 'all',
                heatmapYear: 'all',
                heatmapPointCount: 0,
                _heatmapLoaded: false,

                // Coverage state
                coverageMeshCount: 0,
                _coverageLoaded: false,

                // Biodiversity tab state
                biodiversityStage: 'all',
                biodiversityRedlistOnly: false,
                _biodiversityLoaded: false,
                biodiversityGeoJson: null,
                biodiversityStats: { meshes: 0, species: 0, redlist: 0 },
                selectedMesh: null,

                // Ghosts state
                ghosts: [],
                ghostMarkers: [],
                _ghostsLoaded: false,

                init() {
                    this.loadSigns();
                    this.loadObs();
                    setTimeout(() => {
                        this.initMap();
                        this.loadGhosts();
                    }, 100);

                    // Load tab-specific data after map loads
                    this.$watch('activeTab', (tab) => {
                        this.$nextTick(() => lucide.createIcons());
                    });
                },

                switchTab(tab) {
                    this.activeTab = tab;
                    this.selectedObs = null;
                    this.showBottomSheet = false;

                    // Update URL without reload
                    const url = new URL(window.location);
                    if (tab === 'markers') {
                        url.searchParams.delete('tab');
                    } else {
                        url.searchParams.set('tab', tab);
                    }
                    history.replaceState({}, '', url);

                    if (!this.map) return;

                    // Toggle layer visibility
                    const markerLayers = ['clusters', 'cluster-count', 'unclustered-point'];
                    const heatmapLayers = ['heatmap-layer'];
                    markerLayers.forEach(id => {
                        if (this.map.getLayer(id)) {
                            this.map.setLayoutProperty(id, 'visibility', tab === 'markers' ? 'visible' : 'none');
                        }
                    });

                    heatmapLayers.forEach(id => {
                        if (this.map.getLayer(id)) {
                            this.map.setLayoutProperty(id, 'visibility', tab === 'heatmap' ? 'visible' : 'none');
                        }
                    });

                    const coverageLayers = ['mesh-coverage-fill', 'mesh-coverage-outline'];
                    coverageLayers.forEach(id => {
                        if (this.map.getLayer(id)) {
                            this.map.setLayoutProperty(id, 'visibility', tab === 'coverage' ? 'visible' : 'none');
                        }
                    });
                    // Lazy load
                    if (tab === 'coverage' && !this._coverageLoaded) {
                        this.loadCoverageData();
                    }

                    const biodiversityLayers = ['bio-mesh-heat', 'bio-mesh-fill', 'bio-mesh-outline', 'bio-mesh-label', 'bio-mesh-links'];
                    biodiversityLayers.forEach(id => {
                        if (this.map.getLayer(id)) {
                            this.map.setLayoutProperty(id, 'visibility', tab === 'biodiversity' ? 'visible' : 'none');
                        }
                    });
                    if (tab !== 'biodiversity') this.selectedMesh = null;
                    if (tab === 'biodiversity' && !this._biodiversityLoaded) {
                        this.loadBiodiversityData();
                    }

                    // Toggle DOM markers (photo markers at high zoom)
                    Object.values(this.markers).forEach(m => {
                        m.getElement().style.display = tab === 'markers' ? '' : 'none';
                    });

                    // Lazy load tab data
                    if (tab === 'heatmap' && !this._heatmapLoaded) {
                        this.loadHeatmapData();
                    }
                    this.$nextTick(() => lucide.createIcons());
                },

                setHeatmapTaxon(taxon) {
                    this.heatmapTaxon = taxon;
                    this.loadHeatmapData();
                },

                async loadHeatmapData() {
                    try {
                        const res = await fetch(`api/heatmap_data.php?taxon=${this.heatmapTaxon}&year=${this.heatmapYear}`);
                        const data = await res.json();
                        this.heatmapPointCount = data.points.length;
                        this._heatmapLoaded = true;

                        if (!this.map) return;

                        // Build GeoJSON from heatmap points
                        const geojson = {
                            type: 'FeatureCollection',
                            features: data.points.map(p => ({
                                type: 'Feature',
                                properties: {
                                    weight: p[2] || 1
                                },
                                geometry: {
                                    type: 'Point',
                                    coordinates: [p[1], p[0]] // [lng, lat]
                                }
                            }))
                        };

                        if (this.map.getSource('heatmap-source')) {
                            this.map.getSource('heatmap-source').setData(geojson);
                        } else {
                            this.map.addSource('heatmap-source', {
                                type: 'geojson',
                                data: geojson
                            });

                            this.map.addLayer({
                                id: 'heatmap-layer',
                                type: 'heatmap',
                                source: 'heatmap-source',
                                paint: {
                                    'heatmap-weight': ['get', 'weight'],
                                    'heatmap-intensity': [
                                        'interpolate', ['linear'],
                                        ['zoom'],
                                        0, 0.5, 10, 1, 14, 2
                                    ],
                                    'heatmap-color': [
                                        'interpolate', ['linear'],
                                        ['heatmap-density'],
                                        0, 'rgba(43,131,186,0)',
                                        0.3, 'rgb(100,194,166)',
                                        0.5, 'rgb(255,217,78)',
                                        0.7, 'rgb(245,122,60)',
                                        1, 'rgb(215,25,28)'
                                    ],
                                    'heatmap-radius': [
                                        'interpolate', ['linear'],
                                        ['zoom'],
                                        0, 4, 10, 12, 14, 20
                                    ],
                                    'heatmap-opacity': 0.65
                                },
                                layout: {
                                    visibility: this.activeTab === 'heatmap' ? 'visible' : 'none'
                                }
                            });
                        }
                    } catch (e) {
                        console.error('Heatmap load failed:', e);
                    }
                },

                async loadCoverageData() {
                    try {
                        const bounds = this.map.getBounds();
                        const url = `api/v2/mesh_coverage.php?sw_lat=${bounds.getSouth()}&sw_lng=${bounds.getWest()}&ne_lat=${bounds.getNorth()}&ne_lng=${bounds.getEast()}`;
                        const res = await fetch(url);
                        const data = await res.json();
                        this.coverageMeshCount = data.meta?.community_mesh_count ?? 0;
                        this._coverageLoaded = true;

                        if (!this.map) return;

                        if (this.map.getSource('mesh-coverage')) {
                            this.map.getSource('mesh-coverage').setData(data);
                        } else {
                            this.map.addSource('mesh-coverage', { type: 'geojson', data });
                            this.map.addLayer({
                                id: 'mesh-coverage-fill',
                                type: 'fill',
                                source: 'mesh-coverage',
                                paint: {
                                    'fill-color': [
                                        'interpolate', ['linear'],
                                        ['get', 'scan_count'],
                                        1, 'rgba(16,185,129,0.12)',
                                        5, 'rgba(16,185,129,0.30)',
                                        20, 'rgba(16,185,129,0.55)',
                                        50, 'rgba(16,185,129,0.75)'
                                    ],
                                    'fill-opacity': [
                                        'interpolate', ['linear'],
                                        ['get', 'freshness'],
                                        0.1, 0.4,
                                        0.5, 0.7,
                                        1.0, 1.0
                                    ]
                                }
                            });
                            this.map.addLayer({
                                id: 'mesh-coverage-outline',
                                type: 'line',
                                source: 'mesh-coverage',
                                paint: {
                                    'line-color': 'rgba(16,185,129,0.4)',
                                    'line-width': 0.8
                                }
                            });
                        }

                        // Reload on map move
                        this.map.on('moveend', () => {
                            if (this.activeTab === 'coverage') {
                                this._coverageLoaded = false;
                                this.loadCoverageData();
                            }
                        });
                    } catch(e) {
                        console.error('coverage load error', e);
                    }
                },

                async loadBiodiversityData() {
                    if (this._biodiversityLoaded) return;
                    try {
                        const res = await fetch('/api/v2/mesh_importance.php');
                        const gj = await res.json();
                        if (!gj.features) return;

                        // ラベル生成
                        const stageIcons = { S:'🔥', A:'🌳', B:'🌱', C:'🌿', D:'📍' };
                        gj.features.forEach(f => {
                            const p = f.properties;
                            f.properties.label_short = (stageIcons[p.stage] || '📍') + ' ' + (p.species_count || 0) + '種';
                        });

                        this.biodiversityGeoJson = gj;
                        const summary = gj.summary || {};
                        this.biodiversityStats = {
                            meshes:  summary.total_meshes  ?? gj.features.length,
                            species: summary.total_species ?? '—',
                            redlist: summary.red_list_total ?? 0
                        };

                        if (!this.map) return;

                        // セントロイド計算
                        const centroidCalc = coords => {
                            let cx = 0, cy = 0;
                            coords.forEach(c => { cx += c[0]; cy += c[1]; });
                            return [cx / coords.length, cy / coords.length];
                        };

                        const centroids = gj.features.map(f => {
                            const c = centroidCalc(f.geometry.coordinates[0]);
                            return { type:'Feature', geometry:{ type:'Point', coordinates:c }, properties:{ score: f.properties.score || 0 } };
                        });

                        // 隣接リンク計算
                        const meshSet = {};
                        gj.features.forEach(f => {
                            const c = centroidCalc(f.geometry.coordinates[0]);
                            meshSet[f.properties.mesh_code] = c;
                        });
                        const links = [];
                        const seen = {};
                        gj.features.forEach(f => {
                            const code = f.properties.mesh_code;
                            const center = meshSet[code];
                            if (!center || code.length < 8) return;
                            const p2 = parseInt(code.substring(0,2)), u2 = parseInt(code.substring(2,4));
                            const q2 = parseInt(code.substring(4,5)), v2 = parseInt(code.substring(5,6));
                            const r2 = parseInt(code.substring(6,7)), w2 = parseInt(code.substring(7,8));
                            const neighbors = [];
                            // 右
                            let nr = w2+1, nq = q2, nv = v2, nu = u2, np = p2, nrr = r2;
                            if (nr > 9) { nr = 0; nv = v2+1; if (nv > 7) { nv = 0; nu = u2+1; } }
                            neighbors.push(''+String(np).padStart(2,'0')+String(nu).padStart(2,'0')+nq+nv+nrr+nr);
                            // 上
                            let ur = r2+1, uq = q2, up = p2;
                            if (ur > 9) { ur = 0; uq = q2+1; if (uq > 7) { uq = 0; up = p2+1; } }
                            neighbors.push(''+String(up).padStart(2,'0')+String(u2).padStart(2,'0')+uq+v2+ur+w2);
                            neighbors.forEach(nc => {
                                if (!meshSet[nc]) return;
                                const key = [code, nc].sort().join('-');
                                if (seen[key]) return;
                                seen[key] = true;
                                links.push({ type:'Feature', geometry:{ type:'LineString', coordinates:[center, meshSet[nc]] }, properties:{} });
                            });
                        });

                        // ソース追加
                        if (!this.map.getSource('bio-mesh')) {
                            this.map.addSource('bio-mesh', { type:'geojson', data:{ type:'FeatureCollection', features:[] } });
                            this.map.addSource('bio-mesh-centroids', { type:'geojson', data:{ type:'FeatureCollection', features:centroids } });
                            this.map.addSource('bio-mesh-links', { type:'geojson', data:{ type:'FeatureCollection', features:links } });

                            // レイヤー追加
                            this.map.addLayer({ id:'bio-mesh-heat', type:'heatmap', source:'bio-mesh-centroids', maxzoom:12, paint:{
                                'heatmap-weight': ['interpolate',['linear'],['get','score'], 0,0.1, 50,0.5, 80,1],
                                'heatmap-intensity': ['interpolate',['linear'],['zoom'], 0,0.6, 12,2.5],
                                'heatmap-radius': ['interpolate',['linear'],['zoom'], 0,10, 8,22, 12,35],
                                'heatmap-color': ['interpolate',['linear'],['heatmap-density'],
                                    0,'rgba(0,0,0,0)', 0.15,'rgba(59,130,246,0.25)', 0.35,'rgba(16,185,129,0.45)',
                                    0.55,'rgba(245,158,11,0.6)', 0.75,'rgba(239,68,68,0.75)', 1.0,'rgba(255,255,255,0.9)'],
                                'heatmap-opacity': ['interpolate',['linear'],['zoom'], 9,0.85, 12,0]
                            }});
                            this.map.addLayer({ id:'bio-mesh-fill', type:'fill', source:'bio-mesh', minzoom:8, paint:{
                                'fill-color': ['match',['get','stage'],'S',STAGE_COLORS.S,'A',STAGE_COLORS.A,'B',STAGE_COLORS.B,'C',STAGE_COLORS.C,'D',STAGE_COLORS.D,'#94a3b8'],
                                'fill-opacity': ['interpolate',['linear'],['zoom'],
                                    8, ['interpolate',['linear'],['get','score'], 0,0.1, 40,0.2, 80,0.35],
                                    12,['interpolate',['linear'],['get','score'], 0,0.2, 40,0.4, 80,0.65]]
                            }});
                            this.map.addLayer({ id:'bio-mesh-outline', type:'line', source:'bio-mesh', minzoom:9, paint:{
                                'line-color': ['match',['get','stage'],'S',STAGE_COLORS.S,'A',STAGE_COLORS.A,'B',STAGE_COLORS.B,'C',STAGE_COLORS.C,'D',STAGE_COLORS.D,'rgba(100,100,100,0.3)'],
                                'line-width': ['interpolate',['linear'],['zoom'], 9,0.5, 14,1.5],
                                'line-opacity': 0.7
                            }});
                            this.map.addLayer({ id:'bio-mesh-links', type:'line', source:'bio-mesh-links', minzoom:10, paint:{
                                'line-color': 'rgba(80,80,80,0.15)', 'line-width': 1
                            }});
                            this.map.addLayer({ id:'bio-mesh-label', type:'symbol', source:'bio-mesh', minzoom:11, layout:{
                                'text-field': ['get','label_short'],
                                'text-size': ['interpolate',['linear'],['zoom'], 11,9, 14,12],
                                'text-anchor': 'center'
                            }, paint:{
                                'text-color': '#333',
                                'text-halo-color': 'rgba(255,255,255,0.9)',
                                'text-halo-width': 1.5
                            }});

                            // クリックハンドラ
                            this.map.on('click', 'bio-mesh-fill', (e) => {
                                const f = e.features[0];
                                const p = f.properties;
                                let byGroup = p.by_group;
                                if (typeof byGroup === 'string') try { byGroup = JSON.parse(byGroup); } catch(_) { byGroup = {}; }
                                let species = p.species;
                                if (typeof species === 'string') try { species = JSON.parse(species); } catch(_) { species = []; }
                                if (!Array.isArray(species)) species = [];
                                const coords = f.geometry.coordinates[0];
                                const center = centroidCalc(coords);
                                this.selectedMesh = { ...p, by_group: byGroup, species: species, _center: center };
                                this.selectedObs = null;
                                this.showBottomSheet = false;
                                this.$nextTick(() => lucide.createIcons());
                            });
                            this.map.on('mouseenter', 'bio-mesh-fill', () => { this.map.getCanvas().style.cursor = 'pointer'; });
                            this.map.on('mouseleave', 'bio-mesh-fill', () => { this.map.getCanvas().style.cursor = ''; });
                        } else {
                            this.map.getSource('bio-mesh-centroids').setData({ type:'FeatureCollection', features:centroids });
                            this.map.getSource('bio-mesh-links').setData({ type:'FeatureCollection', features:links });
                        }

                        this._biodiversityLoaded = true;
                        this.applyBiodiversityFilter();
                    } catch(e) {
                        console.error('biodiversity load error', e);
                    }
                },

                applyBiodiversityFilter() {
                    if (!this.biodiversityGeoJson || !this.map || !this.map.getSource('bio-mesh')) return;
                    const filtered = { type:'FeatureCollection', features: this.biodiversityGeoJson.features.filter(f => {
                        if (this.biodiversityStage !== 'all' && f.properties.stage !== this.biodiversityStage) return false;
                        if (this.biodiversityRedlistOnly && !(f.properties.red_list_count > 0)) return false;
                        return true;
                    })};
                    this.map.getSource('bio-mesh').setData(filtered);
                },

                setBiodiversityStage(stage) {
                    this.biodiversityStage = stage;
                    this.applyBiodiversityFilter();
                },

                toggleBiodiversityRedlist() {
                    this.biodiversityRedlistOnly = !this.biodiversityRedlistOnly;
                    this.applyBiodiversityFilter();
                },

                async loadGhosts() {
                    if (this._ghostsLoaded) return;
                    try {
                        const res = await fetch('api/get_ghosts.php');
                        const data = await res.json();
                        if (data.success && data.ghosts) {
                            this.ghosts = data.ghosts;
                            this.renderGhosts();
                            this._ghostsLoaded = true;
                        }
                    } catch (e) {
                        console.error('Ghosts load failed:', e);
                    }
                },

                renderGhosts() {
                    if (!this.map) return;
                    
                    // Clear existing
                    this.ghostMarkers.forEach(m => m.remove());
                    this.ghostMarkers = [];

                    this.ghosts.forEach(ghost => {
                        const el = document.createElement('div');
                        el.className = 'ghost-marker';
                        
                        // Set opacity based on hours ago (fades out over 24h)
                        const baseOpacity = Math.max(0.1, 1 - (ghost.hours_ago / 24));
                        el.style.opacity = baseOpacity;
                        
                        // Random animation delay to offset pulsing
                        el.style.animationDelay = (Math.random() * 3) + 's';

                        const marker = new maplibregl.Marker({
                            element: el,
                            pitchAlignment: 'map'
                        })
                        .setLngLat([ghost.lng, ghost.lat])
                        .addTo(this.map);
                        
                        this.ghostMarkers.push(marker);
                    });
                },

                locateMe() {
                    if (!navigator.geolocation || !this.map) return;
                    this.locating = true;
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            this.locating = false;
                            const {
                                latitude,
                                longitude
                            } = pos.coords;
                            this.map.flyTo({
                                center: [longitude, latitude],
                                zoom: 15,
                                speed: 2.0,
                                essential: true
                            });
                            // Add/update user location marker
                            if (this._userLocationMarker) {
                                this._userLocationMarker.setLngLat([longitude, latitude]);
                            } else {
                                const el = document.createElement('div');
                                el.className = 'relative';
                                el.innerHTML = `
                                    <div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg z-10 relative"></div>
                                    <div class="absolute inset-0 w-4 h-4 bg-blue-400 rounded-full animate-ping opacity-50"></div>
                                `;
                                this._userLocationMarker = new maplibregl.Marker({
                                        element: el
                                    })
                                    .setLngLat([longitude, latitude])
                                    .addTo(this.map);
                            }
                        },
                        (err) => {
                            this.locating = false;
                            console.warn('Geolocation error:', err.message);
                        }, {
                            enableHighAccuracy: true,
                            timeout: 10000
                        }
                    );
                },

                onInput() {
                    this.loadObs();
                    this.fetchSuggestions();
                },

                onEnter() {
                    this.showSuggestions = false;
                    if (this.suggestions.length > 0) {
                        this.selectLocation(this.suggestions[0]);
                    }
                },

                async fetchSuggestions() {
                    if (this.query.length < 2) {
                        this.suggestions = [];
                        return;
                    }
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.query)}&addressdetails=1&limit=30`);
                        let data = await res.json();

                        // 1. Filter out specific noise (e.g. Taxi stands)
                        data = data.filter(s => {
                            if (s.type === 'taxi') return false;
                            // Allow highways/bus stops but maybe deprioritize them later?
                            // For now, just ban 'taxi' which was the main issue.
                            return true;
                        });

                        // 2. Sort by importance (Ensure major places come first)
                        data.sort((a, b) => (b.importance || 0) - (a.importance || 0));

                        // 3. Deduplicate by Name (If multiple "Hamamatsu", pick top ones but avoid exact dupes)
                        const seen = new Set();
                        this.suggestions = data.filter(s => {
                            const key = s.display_name;
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        }).slice(0, 5);

                        this.showSuggestions = this.suggestions.length > 0;
                    } catch (e) {
                        console.error(e);
                    }
                },

                selectLocation(loc) {
                    this.query = loc.name || loc.display_name.split(',')[0];
                    this.showSuggestions = false;

                    if (this.map) {
                        this.map.flyTo({
                            center: [parseFloat(loc.lon), parseFloat(loc.lat)],
                            zoom: 14,
                            speed: 2.0, // Faster animation
                            essential: true
                        });
                    }
                    this.loadObs(); // Reload obs for the new area? 
                },

                formatAddress(s) {
                    // Simple formatter: remove name from display_name
                    const name = s.name || '';
                    return s.display_name.replace(name, '').replace(/^,\s*/, '');
                },

                async loadObs() {
                    // Cancel any in-flight request
                    if (this._fetchController) this._fetchController.abort();
                    this._fetchController = new AbortController();

                    const bounds = this.map ? this.map.getBounds() : null;
                    let url = `api/get_observations.php?limit=500&min_created_year=2026&q=${encodeURIComponent(this.query)}`;
                    if (bounds) {
                        const sw = bounds.getSouthWest();
                        const ne = bounds.getNorthEast();
                        url += `&sw_lat=${sw.lat}&sw_lng=${sw.lng}&ne_lat=${ne.lat}&ne_lng=${ne.lng}`;
                    }
                    if (this.activeTaxonGroup) {
                        url += `&taxon_group=${encodeURIComponent(this.activeTaxonGroup)}`;
                    }

                    try {
                        const res = await fetch(url, {
                            signal: this._fetchController.signal
                        });
                        const result = await res.json();
                        this.items = result.data;
                        this.updateSource();
                    } catch (e) {
                        if (e.name !== 'AbortError') console.error('loadObs error:', e);
                    }
                },

                // Remove old search/geocode methods as they are replaced

                initMap() {
                    this.map = new maplibregl.Map({
                        container: 'map',
                        style: IKIMON_MAP.style('light'),
                        center: [137.7261, 34.7108],
                        zoom: 12,
                        attributionControl: false
                    });
                    this.map.addControl(new maplibregl.AttributionControl({
                        compact: true
                    }));

                    this.map.on('load', () => {
                        // Add GeoJSON Source with Clustering
                        this.map.addSource('observations', {
                            type: 'geojson',
                            data: {
                                type: 'FeatureCollection',
                                features: []
                            },
                            cluster: true,
                            clusterMaxZoom: 14, // Stop clustering at zoom 14 (showing individual photos)
                            clusterRadius: 50
                        });

                        // Strand System: Exploration Traces (Visualizing other researchers)
                        // Mocking some paths around Hamamatsu to simulate "Net Trails"
                        const traces = {
                            type: 'FeatureCollection',
                            features: []
                        };
                        const base = [137.7261, 34.7108]; // Hamamatsu
                        for (let i = 0; i < 8; i++) {
                            let path = [];
                            let curr = [base[0] + (Math.random() - 0.5) * 0.08, base[1] + (Math.random() - 0.5) * 0.08];
                            path.push([...curr]);
                            for (let j = 0; j < 15; j++) {
                                curr[0] += (Math.random() - 0.5) * 0.005;
                                curr[1] += (Math.random() - 0.5) * 0.005;
                                path.push([...curr]);
                            }
                            traces.features.push({
                                type: 'Feature',
                                geometry: {
                                    type: 'LineString',
                                    coordinates: path
                                }
                            });
                        }

                        this.map.addSource('traces', {
                            type: 'geojson',
                            data: traces
                        });

                        // Glow Layer (Holographic effect)
                        this.map.addLayer({
                            'id': 'traces-glow',
                            'type': 'line',
                            'source': 'traces',
                            'layout': {
                                'line-join': 'round',
                                'line-cap': 'round'
                            },
                            'paint': {
                                'line-color': '#00ffff',
                                'line-width': 8,
                                'line-opacity': 0.2,
                                'line-blur': 3
                            }
                        });
                        // Core Layer
                        this.map.addLayer({
                            'id': 'traces-core',
                            'type': 'line',
                            'source': 'traces',
                            'layout': {
                                'line-join': 'round',
                                'line-cap': 'round'
                            },
                            'paint': {
                                'line-color': '#00deff',
                                'line-width': 2,
                                'line-opacity': 0.7,
                                'line-dasharray': [1, 2] // Dashed look roughly like footprints
                            }
                        });

                        // Cluster Layer (Circles)
                        this.map.addLayer({
                            id: 'clusters',
                            type: 'circle',
                            source: 'observations',
                            filter: ['has', 'point_count'],
                            paint: {
                                'circle-color': '#51bbd6',
                                'circle-radius': 18,
                                'circle-stroke-width': 2,
                                'circle-stroke-color': '#fff'
                            }
                        });

                        // Cluster Count Text
                        this.map.addLayer({
                            id: 'cluster-count',
                            type: 'symbol',
                            source: 'observations',
                            filter: ['has', 'point_count'],
                            layout: {
                                'text-field': '{point_count_abbreviated}',
                                'text-font': ['Noto Sans Regular'], // Ensure valid font or use default if unsure
                                'text-size': 12
                            },
                            paint: {
                                'text-color': '#ffffff'
                            }
                        });

                        // Handle Cluster Clicks → Bottom Sheet with observation list
                        this.map.on('click', 'clusters', (e) => {
                            const features = this.map.queryRenderedFeatures(e.point, {
                                layers: ['clusters']
                            });
                            const clusterId = features[0].properties.cluster_id;
                            const pointCount = features[0].properties.point_count;
                            const source = this.map.getSource('observations');

                            // Get cluster leaves (max 50 for performance)
                            source.getClusterLeaves(clusterId, Math.min(pointCount, 50), 0, (err, leaves) => {
                                if (err) return;
                                this.clusterItems = leaves.map(leaf => {
                                    const p = leaf.properties;
                                    return typeof p.obsData === 'string' ? JSON.parse(p.obsData) : p.obsData;
                                }).filter(Boolean);
                                this.selectedObs = null; // Close preview card
                                this.showBottomSheet = true;
                                this.$nextTick(() => lucide.createIcons());
                            });
                        });

                        this.map.on('mouseenter', 'clusters', () => {
                            this.map.getCanvas().style.cursor = 'pointer';
                        });
                        this.map.on('mouseleave', 'clusters', () => {
                            this.map.getCanvas().style.cursor = '';
                        });

                        // Unclustered point layer (GPU-rendered circles for individual points)
                        this.map.addLayer({
                            id: 'unclustered-point',
                            type: 'circle',
                            source: 'observations',
                            filter: ['!', ['has', 'point_count']],
                            paint: {
                                'circle-color': '#10b981',
                                'circle-radius': 7,
                                'circle-stroke-width': 2,
                                'circle-stroke-color': '#ffffff'
                            }
                        });

                        // Click on unclustered point → show preview card
                        this.map.on('click', 'unclustered-point', (e) => {
                            const props = e.features[0].properties;
                            const obsData = typeof props.obsData === 'string' ? JSON.parse(props.obsData) : props.obsData;
                            this.selectedObs = obsData;
                            this.map.flyTo({
                                center: e.features[0].geometry.coordinates,
                                zoom: Math.max(this.map.getZoom(), 15),
                                offset: [0, -100]
                            });
                        });

                        this.map.on('mouseenter', 'unclustered-point', () => {
                            this.map.getCanvas().style.cursor = 'pointer';
                        });
                        this.map.on('mouseleave', 'unclustered-point', () => {
                            this.map.getCanvas().style.cursor = '';
                        });

                        // Update photo markers on high zoom
                        this.map.on('render', () => {
                            if (!this.map.isSourceLoaded('observations')) return;
                            this.updateMarkers();
                        });

                        // Viewport-based loading: refetch on map move
                        let moveTimer = null;
                        this.map.on('moveend', () => {
                            clearTimeout(moveTimer);
                            moveTimer = setTimeout(() => this.loadObs(), 300);
                        });

                        this.updateSource();

                        // Activate initial tab from URL param
                        if (this.activeTab !== 'markers') {
                            this.switchTab(this.activeTab);
                        }
                    });

                    this.map.on('click', () => this.selectedObs = null);
                },

                updateSource() {
                    if (!this.map || !this.map.getSource('observations')) return;

                    const geojson = {
                        type: 'FeatureCollection',
                        features: this.items.map(obs => ({
                            type: 'Feature',
                            properties: {
                                id: obs.id,
                                photo: obs.photos && obs.photos[0],
                                // Pass entire obs for preview (serialize roughly or just ID)
                                obsData: obs
                            },
                            geometry: {
                                type: 'Point',
                                coordinates: [parseFloat(obs.lng), parseFloat(obs.lat)]
                            }
                        }))
                    };

                    this.map.getSource('observations').setData(geojson);
                },

                updateMarkers() {
                    if (!this.map) return;

                    // Only show photo markers at zoom >= 15 (few points visible)
                    const zoom = this.map.getZoom();
                    if (zoom < 15) {
                        // Remove all DOM markers at low zoom, GPU layers handle it
                        Object.keys(this.markers).forEach(id => {
                            this.markers[id].remove();
                            delete this.markers[id];
                        });
                        return;
                    }

                    // 1. Get visible unclustered points
                    const features = this.map.querySourceFeatures('observations', {
                        filter: ['!', ['has', 'point_count']]
                    });

                    const visibleIds = new Set(features.map(f => f.properties.id));

                    // 2. Remove markers no longer visible
                    Object.keys(this.markers).forEach(id => {
                        if (!visibleIds.has(Number(id))) {
                            this.markers[id].remove();
                            delete this.markers[id];
                        }
                    });

                    // 3. Add photo markers for visible points (only at high zoom)
                    features.forEach(f => {
                        const id = f.properties.id;
                        if (this.markers[id]) return;

                        const el = document.createElement('div');
                        el.className = 'w-8 h-8 rounded-full shadow-xl cursor-pointer';

                        const inner = document.createElement('div');
                        inner.className = 'w-full h-full rounded-full border-2 border-white bg-cover bg-center transition-transform duration-300 hover:scale-125';
                        inner.style.backgroundImage = `url(${f.properties.photo})`;

                        el.appendChild(inner);

                        el.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const obsData = typeof f.properties.obsData === 'string' ? JSON.parse(f.properties.obsData) : f.properties.obsData;
                            this.selectedObs = obsData;
                            this.map.flyTo({
                                center: f.geometry.coordinates,
                                zoom: 15,
                                offset: [0, -100]
                            });
                        });

                        const m = new maplibregl.Marker({
                                element: el
                            })
                            .setLngLat(f.geometry.coordinates)
                            .addTo(this.map);

                        this.markers[id] = m;
                    });
                },

                // Sprint 1: Filter & Layer methods
                setTaxonGroup(group) {
                    this.activeTaxonGroup = group;
                    this.loadObs();
                },

                switchLayer(layerName) {
                    if (!this.map) return;
                    this.activeLayer = layerName;
                    this.showLayerMenu = false;
                    localStorage.setItem('ikimon_map_layer', layerName);

                    const styles = {
                        standard: IKIMON_MAP.style('light'),
                        satellite: IKIMON_MAP.satellite(),
                        terrain: IKIMON_MAP.terrain()
                    };

                    const currentCenter = this.map.getCenter();
                    const currentZoom = this.map.getZoom();

                    this.map.setStyle(styles[layerName]);
                    this.map.once('styledata', () => {
                        this.map.setCenter(currentCenter);
                        this.map.setZoom(currentZoom);
                        // Re-add observation source and layers after style change
                        if (!this.map.getSource('observations')) {
                            this.map.addSource('observations', {
                                type: 'geojson',
                                data: {
                                    type: 'FeatureCollection',
                                    features: []
                                },
                                cluster: true,
                                clusterMaxZoom: 14,
                                clusterRadius: 50
                            });
                            this.map.addLayer({
                                id: 'clusters',
                                type: 'circle',
                                source: 'observations',
                                filter: ['has', 'point_count'],
                                paint: {
                                    'circle-color': '#51bbd6',
                                    'circle-radius': 18,
                                    'circle-stroke-width': 2,
                                    'circle-stroke-color': '#fff'
                                }
                            });
                            this.map.addLayer({
                                id: 'cluster-count',
                                type: 'symbol',
                                source: 'observations',
                                filter: ['has', 'point_count'],
                                layout: {
                                    'text-field': '{point_count_abbreviated}',
                                    'text-font': ['Noto Sans Regular'],
                                    'text-size': 12
                                },
                                paint: {
                                    'text-color': '#ffffff'
                                }
                            });
                            this.map.addLayer({
                                id: 'unclustered-point',
                                type: 'circle',
                                source: 'observations',
                                filter: ['!', ['has', 'point_count']],
                                paint: {
                                    'circle-color': '#10b981',
                                    'circle-radius': 7,
                                    'circle-stroke-width': 2,
                                    'circle-stroke-color': '#ffffff'
                                }
                            });

                            // Re-register event listeners after style change
                            this.map.on('click', 'clusters', (e) => {
                                const features = this.map.queryRenderedFeatures(e.point, {
                                    layers: ['clusters']
                                });
                                const clusterId = features[0].properties.cluster_id;
                                const pointCount = features[0].properties.point_count;
                                const source = this.map.getSource('observations');
                                source.getClusterLeaves(clusterId, Math.min(pointCount, 50), 0, (err, leaves) => {
                                    if (err) return;
                                    this.clusterItems = leaves.map(leaf => {
                                        const p = leaf.properties;
                                        return typeof p.obsData === 'string' ? JSON.parse(p.obsData) : p.obsData;
                                    }).filter(Boolean);
                                    this.selectedObs = null;
                                    this.showBottomSheet = true;
                                    this.$nextTick(() => lucide.createIcons());
                                });
                            });
                            this.map.on('click', 'unclustered-point', (e) => {
                                const props = e.features[0].properties;
                                const obsData = typeof props.obsData === 'string' ? JSON.parse(props.obsData) : props.obsData;
                                this.selectedObs = obsData;
                                this.map.flyTo({
                                    center: e.features[0].geometry.coordinates,
                                    zoom: Math.max(this.map.getZoom(), 15),
                                    offset: [0, -100]
                                });
                            });
                            this.map.on('mouseenter', 'clusters', () => this.map.getCanvas().style.cursor = 'pointer');
                            this.map.on('mouseleave', 'clusters', () => this.map.getCanvas().style.cursor = '');
                            this.map.on('mouseenter', 'unclustered-point', () => this.map.getCanvas().style.cursor = 'pointer');
                            this.map.on('mouseleave', 'unclustered-point', () => this.map.getCanvas().style.cursor = '');
                        }
                        this.updateSource();
                        // Re-init biodiversity layers after style change
                        if (this._biodiversityLoaded) {
                            this._biodiversityLoaded = false;
                            if (this.activeTab === 'biodiversity') {
                                this.loadBiodiversityData();
                            }
                        }
                    });
                },

                loadSigns() {
                    const saved = localStorage.getItem('ikimon_signs');
                    if (saved) {
                        try {
                            this.signs = JSON.parse(saved);
                            const now = Date.now();
                            this.signs = this.signs.filter(s => now - s.ts < 86400000);
                        } catch (e) {
                            this.signs = [];
                        }
                    }
                    this.renderSigns();
                },

                placeSign(type) {
                    if (!this.map) return;
                    const center = this.map.getCenter();
                    const sign = {
                        id: 's_' + Date.now(),
                        type: type,
                        lat: center.lat,
                        lng: center.lng,
                        ts: Date.now()
                    };
                    this.signs.push(sign);
                    localStorage.setItem('ikimon_signs', JSON.stringify(this.signs));
                    this.renderSigns();
                    this.showSignModal = false;
                },

                renderSigns() {
                    if (!this.map) return;

                    this.signs.forEach(s => {
                        if (this.signMarkers[s.id]) return;

                        const el = document.createElement('div');
                        let icon = 'map-pin',
                            color = 'text-gray-600 border-gray-300';

                        if (s.type === 'view') {
                            icon = 'camera';
                            color = 'text-blue-600 border-blue-300 bg-blue-50';
                        }
                        if (s.type === 'rest') {
                            icon = 'coffee';
                            color = 'text-green-600 border-green-300 bg-green-50';
                        }
                        if (s.type === 'danger') {
                            icon = 'alert-triangle';
                            color = 'text-red-600 border-red-300 bg-red-50';
                        }

                        el.className = `w-10 h-10 rounded-full bg-white border-2 flex items-center justify-center shadow-md ${color} z-20`;
                        el.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5"></i>`;

                        const m = new maplibregl.Marker({
                                element: el
                            })
                            .setLngLat([s.lng, s.lat])
                            .addTo(this.map);

                        this.signMarkers[s.id] = m;
                    });
                    lucide.createIcons();
                },

                // Mobile bottom sheet touch drag handlers
                onSheetTouchStart(e) {
                    // Only on mobile
                    if (window.innerWidth >= 768) return;
                    const panel = document.getElementById('clusterPanel');
                    const listEl = panel.querySelector('.panel-list');
                    // Only drag from handle area or when list is scrolled to top
                    if (listEl.scrollTop > 0) return;
                    this._sheetStartY = e.touches[0].clientY;
                    this._sheetDragging = true;
                    this._sheetCurrentY = 0;
                    panel.style.transition = 'none';
                },

                onSheetTouchMove(e) {
                    if (!this._sheetDragging) return;
                    const panel = document.getElementById('clusterPanel');
                    const dy = e.touches[0].clientY - this._sheetStartY;
                    if (dy < 0) return; // Don't drag up past open
                    this._sheetCurrentY = dy;
                    panel.style.transform = `translateY(${dy}px)`;
                },

                onSheetTouchEnd(e) {
                    if (!this._sheetDragging) return;
                    this._sheetDragging = false;
                    const panel = document.getElementById('clusterPanel');
                    panel.style.transition = '';
                    panel.style.transform = '';
                    const threshold = panel.offsetHeight * 0.3;
                    if (this._sheetCurrentY > threshold) {
                        this.showBottomSheet = false;
                    }
                    this._sheetCurrentY = 0;
                }
            }
        }
        lucide.createIcons();
    </script>
</body>

</html>
