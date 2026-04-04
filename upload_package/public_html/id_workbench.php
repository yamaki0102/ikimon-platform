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
    <style>
        [x-cloak] {
            display: none !important;
        }

        body {
            overflow: auto;
            height: 100vh;
            background: var(--md-surface);
            color: var(--md-on-surface);
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
            background: rgba(15, 23, 42, 0.04);
        }

        .scrollbar-thin::-webkit-scrollbar-thumb {
            background: rgba(100, 116, 139, 0.32);
            border-radius: 2px;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
            background: rgba(100, 116, 139, 0.5);
        }

        .item-selected {
            outline: 2px solid var(--md-primary);
            outline-offset: -2px;
        }

        .tree-node:hover {
            background: var(--md-primary-container);
        }

        .shortcut-badge {
            font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
            font-size: 0.7rem;
            padding: 1px 5px;
            background: var(--md-surface-container-low);
            border: 1px solid var(--md-outline-variant);
            border-radius: var(--shape-xs);
            color: var(--md-on-surface-variant);
        }

        .workbench-topbar {
            background: var(--md-surface-container);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-bottom: 1px solid var(--md-outline-variant);
            box-shadow: var(--elev-1);
        }

        .workbench-panel {
            background: var(--md-surface-container);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
        }

        .workbench-toolbar {
            background: var(--md-surface-container-low);
            border-bottom: 1px solid var(--md-outline-variant);
        }

        .workbench-stage {
            background: var(--md-surface-container-low);
            border: 1px solid var(--md-outline-variant);
            box-shadow: var(--elev-2);
        }

        .workbench-photo-button {
            background: var(--md-surface-container);
            border: 1px solid var(--md-outline-variant);
            color: var(--md-on-surface-variant);
            box-shadow: var(--elev-2);
        }

        .workbench-photo-button:hover {
            color: var(--md-on-surface);
            background: var(--md-surface-container-high);
        }

        .workbench-hit-button {
            min-width: 44px;
            min-height: 44px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            position: relative;
            z-index: 2;
            touch-action: manipulation;
        }

        .workbench-hit-button i,
        .workbench-hit-button svg,
        .lightbox-nav-zone i,
        .lightbox-nav-zone svg {
            pointer-events: none;
        }

        .workbench-meta-card {
            background: var(--md-surface-container-low);
            border: 1px solid var(--md-outline-variant);
            box-shadow: var(--elev-1);
        }

        .lightbox-backdrop {
            background: rgba(15, 23, 42, 0.82);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }

        .lightbox-nav-zone {
            position: absolute;
            top: 0;
            bottom: 0;
            width: min(22%, 160px);
            display: flex;
            align-items: center;
            z-index: 3;
            touch-action: manipulation;
        }

        .lightbox-nav-zone--left {
            left: 0;
            justify-content: flex-start;
            padding-left: 12px;
        }

        .lightbox-nav-zone--right {
            right: 0;
            justify-content: flex-end;
            padding-right: 12px;
        }

        /* Mobile filter drawer */
        @media (max-width: 767px) {
            .mobile-filter-drawer {
                position: fixed;
                inset: 0;
                z-index: 45;
                padding-top: 44px;
                background: var(--md-surface-container);
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }
        }
    </style>
</head>

<body x-data="workbench()" @keydown.window="handleKeydown($event)">

    <!-- Top Bar (Cockpit Toolbar) -->
    <header class="workbench-topbar h-12 flex items-center justify-between px-4 z-20 select-none">
        <div class="flex items-center gap-3">
            <a href="id_center.php" class="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition font-bold flex items-center gap-1.5">
                <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
            </a>
            <h1 class="text-xs font-black text-[var(--color-text)] flex items-center gap-2 tracking-tight">
                <i data-lucide="layout-dashboard" class="text-[var(--color-primary)] w-3.5 h-3.5"></i>
                ID Workbench
            </h1>
            <div class="h-4 w-px bg-black/10"></div>
            <div class="text-token-xs font-mono text-[var(--color-text-muted)]">
                <span x-text="filteredItems.length" class="text-[var(--color-text)] font-bold"></span>件
                <span x-show="selectedIds.length > 0" class="text-[var(--color-primary)] ml-1">
                    | <span x-text="selectedIds.length" class="font-bold"></span>選択中
                </span>
            </div>
        </div>
        <div class="flex items-center gap-2">
            <!-- Keyboard shortcuts legend (XL+) -->
            <div class="hidden xl:flex items-center gap-2 text-token-xs text-[var(--color-text-muted)] mr-2">
                <span class="shortcut-badge">N</span>次
                <span class="shortcut-badge">P</span>前
                <span class="shortcut-badge">/</span>検索
                <span class="shortcut-badge">Enter</span>同定
                <span class="shortcut-badge">X</span>パス
                <span class="shortcut-badge">B</span>ブクマ
                <span class="shortcut-badge">Esc</span>閉
            </div>
            <!-- Help button -->
            <div class="relative">
                <button @click="showHelp = !showHelp" title="使い方・ショートカット"
                    class="p-1.5 rounded-md transition text-token-xs font-bold"
                    :class="showHelp ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary-dark)]' : 'bg-white/70 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-white'">
                    <i data-lucide="circle-help" class="w-3.5 h-3.5"></i>
                </button>
                <!-- Help Popup -->
                <div x-show="showHelp" x-cloak @click.outside="showHelp = false"
                    class="absolute right-0 top-8 w-64 p-4 z-50 text-token-xs space-y-3" style="background:var(--md-surface-container-high);border-radius:var(--shape-xl);box-shadow:var(--elev-3);color:var(--md-on-surface-variant);">
                    <p class="text-[var(--color-text)] font-bold text-xs flex items-center gap-1.5">
                        <i data-lucide="layout-dashboard" class="w-3.5 h-3.5 text-[var(--color-primary)]"></i>
                        ID Workbench とは？
                    </p>
                    <p class="leading-relaxed">未同定・要確認の観察をまとめて見て、その場で大きな写真を確認しながら同定を進める作業台です。</p>
                    <hr class="border-black/5">
                    <p class="text-[var(--color-text)] font-bold">キーボードショートカット</p>
                    <div class="grid grid-cols-2 gap-x-3 gap-y-1 font-mono">
                        <p><span class="shortcut-badge">N</span> 次へ</p>
                        <p><span class="shortcut-badge">P</span> 前へ</p>
                        <p><span class="shortcut-badge">/</span> 検索</p>
                        <p><span class="shortcut-badge">Enter</span> 同定</p>
                        <p><span class="shortcut-badge">X</span> パス</p>
                        <p><span class="shortcut-badge">B</span> あとで</p>
                        <p><span class="shortcut-badge">Esc</span> 解除</p>
                        <p><span class="shortcut-badge">Ctrl+A</span> 全選択</p>
                    </div>
                    <hr class="border-black/5">
                    <div class="grid grid-cols-2 gap-x-3 gap-y-1 font-mono">
                        <p><span class="shortcut-badge">Click</span> 選択</p>
                        <p><span class="shortcut-badge">Dbl</span> 同定</p>
                        <p><span class="shortcut-badge">Shift</span> 範囲選択</p>
                    </div>
                </div>
            </div>
            <!-- Mobile Filter Toggle -->
            <button @click="showMobileFilter = !showMobileFilter"
                class="md:hidden flex items-center gap-1 px-2 py-1 rounded-md text-token-xs font-bold transition"
                :class="showMobileFilter || taxonFilter !== 'all' || statusFilter !== 'all' || filterText
                    ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                    : 'bg-white/70 text-[var(--color-text-muted)] hover:text-[var(--color-text)]'">
                <i data-lucide="filter" class="w-3 h-3"></i>
                <span x-text="taxonFilter !== 'all' || statusFilter !== 'all' || filterText ? '絞込中' : 'フィルタ'"></span>
            </button>
            <!-- Grid Size (desktop only) -->
            <div class="hidden md:flex items-center gap-1 p-0.5" style="background:var(--md-surface-container-low);border-radius:var(--shape-full);box-shadow:var(--elev-1);">
                <button @click="gridCols = Math.max(1, gridCols - 1)" class="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"><i data-lucide="minus" class="w-3 h-3"></i></button>
                <span class="text-token-xs font-mono text-[var(--color-text-muted)] w-4 text-center" x-text="gridCols"></span>
                <button @click="gridCols = Math.min(5, gridCols + 1)" class="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"><i data-lucide="plus" class="w-3 h-3"></i></button>
            </div>
        </div>
    </header>

    <!-- Welcome Banner (first-visit only) -->
    <div x-show="showWelcome" x-cloak
        class="relative bg-gradient-to-r from-[var(--color-primary)]/14 via-white to-[var(--color-secondary)]/10 border-b border-[var(--color-primary)]/20 px-4 py-2.5 flex items-center gap-4 shrink-0">
        <div class="flex items-center gap-3 flex-1 min-w-0">
            <span class="text-lg shrink-0">🔬</span>
            <div class="min-w-0">
                <p class="text-xs font-black text-[var(--color-text)]">ID Workbench — 同定作業台</p>
                <p class="text-token-xs text-[var(--color-text-muted)] leading-relaxed hidden sm:block">iNaturalist の Identify のように、一覧の流れを止めずに写真を大きく見ながら同定できるようにしています。
                    <span class="text-[var(--color-text)]">① 左で絞る</span> →
                    <span class="text-[var(--color-text)]">② 真ん中で選ぶ</span> →
                    <span class="text-[var(--color-text)]">③ 右や下で大きく見て同定</span>
                </p>
            </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
            <button @click="showHelp = true; showWelcome = false; localStorage.setItem('ikimon_wb_welcomed','1')"
                class="text-token-xs text-[var(--color-primary)] font-bold hover:underline whitespace-nowrap">
                詳しく見る
            </button>
            <button @click="showWelcome = false; localStorage.setItem('ikimon_wb_welcomed','1')"
                class="p-1 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-white/80 transition" title="閉じる">
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>
        </div>
    </div>

    <!-- Main 3-Panel Layout (Desktop & Mobile) -->
    <div class="flex flex-col md:flex-row h-[calc(100dvh-44px)] md:h-[calc(100vh-44px)] relative overflow-hidden">

        <!-- LEFT PANEL: Taxonomy Tree Filter -->
        <aside :class="showMobileFilter ? 'mobile-filter-drawer flex flex-col' : 'hidden md:flex md:flex-col'"
            class="workbench-panel w-full md:w-60 lg:w-72 md:border-r border-black/5 shrink-0 md:h-full">
            <!-- Mobile drawer header -->
            <div class="md:hidden flex items-center justify-between px-3 py-2 border-b border-black/5 shrink-0">
                <span class="text-xs font-black text-[var(--color-text)]">フィルタ</span>
                <button @click="showMobileFilter = false" class="p-1.5 hover:bg-black/5 rounded-full transition">
                    <i data-lucide="x" class="w-4 h-4 text-[var(--color-text-muted)]"></i>
                </button>
            </div>
            <!-- Search -->
            <div class="p-3 border-b border-black/5">
                <div class="flex items-center gap-2">
                    <div class="relative flex-1">
                        <i data-lucide="search" class="absolute left-2 top-[7px] w-3 h-3 text-[var(--color-text-faint)]"></i>
                        <input type="text" x-model="filterText" x-ref="filterInput"
                            placeholder="絞り込み..."
                            class="w-full pl-7 pr-3 py-2 text-token-xs focus:outline-none transition" style="background:var(--md-surface-variant);border:none;border-bottom:2px solid var(--md-outline);border-radius:var(--shape-xs) var(--shape-xs) 0 0;">
                    </div>
                    <button @click="$dispatch('open-navigator')" class="p-2 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition shrink-0" title="AIナビゲーターで絞り込む">
                        <i data-lucide="compass" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>

            <!-- Taxonomy Tree -->
            <div class="flex-1 overflow-y-auto scrollbar-thin p-2">
                <h3 class="text-token-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest px-2 mb-2">分類群フィルタ</h3>

                <!-- All -->
                <button @click="taxonFilter = 'all'"
                    class="tree-node w-full text-left px-2 py-1.5 rounded-md text-token-xs font-bold transition flex items-center justify-between"
                        :class="taxonFilter === 'all' ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'">
                    <span class="flex items-center gap-2">🌍 すべて</span>
                    <span class="text-token-xs font-mono text-[var(--color-text-faint)]" x-text="allItems.length"></span>
                </button>

                <div class="mt-2 space-y-px">
                    <template x-for="group in taxonGroups" :key="group.id">
                        <div>
                            <!-- Kingdom/Group header -->
                            <button @click="setTaxonFilter(group.id)"
                                class="tree-node w-full text-left px-2 py-1.5 rounded-md text-token-xs font-bold transition flex items-center justify-between"
                                :class="taxonFilter === group.id ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'">
                                <span class="flex items-center gap-2">
                                    <span x-text="group.icon" class="text-xs"></span>
                                    <span x-text="group.label"></span>
                                </span>
                                <span class="text-token-xs font-mono" :class="taxonFilter === group.id ? 'text-[var(--color-primary-dark)]' : 'text-[var(--color-text-faint)]'" x-text="groupCounts[group.id] || 0"></span>
                            </button>
                        </div>
                    </template>
                </div>

                <!-- Status Sections -->
                <div class="border-t border-black/5 mt-3 pt-3">
                    <h3 class="text-token-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest px-2 mb-2">ステータス</h3>
                    <button @click="statusFilter = 'unidentified'"
                        class="tree-node w-full text-left px-2 py-1.5 rounded-md text-token-xs font-bold transition flex items-center justify-between"
                        :class="statusFilter === 'unidentified' ? 'bg-red-500/10 text-red-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'">
                        <span>🔴 未同定</span>
                        <span class="text-token-xs font-mono text-[var(--color-text-faint)]" x-text="statusCounts.unidentified"></span>
                    </button>
                    <button @click="statusFilter = 'suggested'"
                        class="tree-node w-full text-left px-2 py-1.5 rounded-md text-token-xs font-bold transition flex items-center justify-between"
                        :class="statusFilter === 'suggested' ? 'bg-purple-500/10 text-purple-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'">
                        <span>🟣 要確認</span>
                        <span class="text-token-xs font-mono text-[var(--color-text-faint)]" x-text="statusCounts.suggested"></span>
                    </button>
                    <button @click="statusFilter = 'ai-multi'"
                        class="tree-node w-full text-left px-2 py-1.5 rounded-md text-token-xs font-bold transition flex items-center justify-between"
                        :class="statusFilter === 'ai-multi' ? 'bg-amber-500/10 text-amber-700' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'">
                        <span>🧭 AI複数候補</span>
                        <span class="text-token-xs font-mono text-[var(--color-text-faint)]" x-text="statusCounts.aiMulti"></span>
                    </button>
                    <button @click="statusFilter = 'ai-genus'"
                        class="tree-node w-full text-left px-2 py-1.5 rounded-md text-token-xs font-bold transition flex items-center justify-between"
                        :class="statusFilter === 'ai-genus' ? 'bg-emerald-500/10 text-emerald-700' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'">
                        <span>🌱 属までは近い</span>
                        <span class="text-token-xs font-mono text-[var(--color-text-faint)]" x-text="statusCounts.aiGenus"></span>
                    </button>
                    <button @click="statusFilter = 'all'"
                        class="tree-node w-full text-left px-2 py-1.5 rounded-md text-token-xs font-bold transition flex items-center justify-between mt-1"
                        :class="statusFilter === 'all' ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'">
                        <span>⬜ 全ステータス</span>
                    </button>
                    <button @click="statusFilter = 'later'" x-show="laterItems.length > 0"
                        class="tree-node w-full text-left px-2 py-1.5 rounded-md text-token-xs font-bold transition flex items-center justify-between"
                        :class="statusFilter === 'later' ? 'bg-blue-500/10 text-blue-600' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'">
                        <span>🔖 あとで</span>
                        <span class="text-token-xs font-mono text-[var(--color-text-faint)]" x-text="laterItems.length"></span>
                    </button>
                    <button @click="statusFilter = 'passed'" x-show="passItems.length > 0"
                        class="tree-node w-full text-left px-2 py-1.5 rounded-md text-token-xs font-bold transition flex items-center justify-between"
                        :class="statusFilter === 'passed' ? 'bg-slate-500/10 text-slate-700' : 'text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]'">
                        <span>⏭ パス済み</span>
                        <span class="text-token-xs font-mono text-[var(--color-text-faint)]" x-text="passItems.length"></span>
                    </button>
                </div>

                <!-- Pass/Later Management -->
                <div x-show="passItems.length > 0 || laterItems.length > 0" class="border-t border-black/5 mt-3 pt-3 px-2 space-y-1">
                    <div x-show="passItems.length > 0" class="flex items-center justify-between">
                        <span class="text-token-xs text-[var(--color-text-muted)]">パス済み <span x-text="passItems.length" class="font-bold text-[var(--color-text-faint)]"></span>件</span>
                        <button @click="clearAllPass()" class="text-token-xs text-[var(--color-text-muted)] hover:text-red-500 transition font-bold">全解除</button>
                    </div>
                    <div x-show="laterItems.length > 0" class="flex items-center justify-between">
                        <span class="text-token-xs text-[var(--color-text-muted)]">あとで <span x-text="laterItems.length" class="font-bold text-[var(--color-text-faint)]"></span>件</span>
                        <button @click="clearAllLater()" class="text-token-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition font-bold">クリア</button>
                    </div>
                </div>

                <!-- Saved Presets -->
                <div class="border-t border-black/5 mt-3 pt-3" x-show="presets.length > 0">
                    <h3 class="text-token-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest px-2 mb-2">プリセット</h3>
                    <template x-for="(preset, pi) in presets" :key="pi">
                        <div class="group flex items-center">
                            <button @click="applyPreset(preset)"
                                class="tree-node flex-1 text-left px-2 py-1 rounded-md text-token-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition truncate">
                                <i data-lucide="tag" class="w-2.5 h-2.5 inline opacity-40"></i>
                                <span x-text="preset.name"></span>
                            </button>
                            <button @click="removePreset(pi)" class="p-1 text-[var(--color-text-faint)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                                <i data-lucide="x" class="w-3 h-3"></i>
                            </button>
                        </div>
                    </template>
                </div>
            </div>

            <!-- Save Preset Button / Inline Form -->
            <div class="p-2 border-t border-black/5">
                <template x-if="!showPresetForm">
                    <button @click="showPresetForm = true; $nextTick(() => $refs.presetInput && $refs.presetInput.focus())"
                        class="w-full py-2 text-token-xs font-bold transition flex items-center justify-center gap-1.5" style="border-radius:var(--shape-md);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
                        <i data-lucide="plus" class="w-3 h-3"></i> プリセット保存
                    </button>
                </template>
                <template x-if="showPresetForm">
                    <form @submit.prevent="saveCurrentPreset()" class="flex gap-1">
                        <input x-ref="presetInput" x-model="presetNameInput"
                            @keydown.escape.prevent="showPresetForm = false; presetNameInput = ''"
                            placeholder="プリセット名..."
                            maxlength="20"
                            class="flex-1 min-w-0 px-2 py-2 text-token-xs focus:outline-none transition" style="background:var(--md-surface-variant);border:none;border-bottom:2px solid var(--md-outline);border-radius:var(--shape-xs) var(--shape-xs) 0 0;color:var(--md-on-surface);">
                        <button type="submit" title="保存"
                            class="p-1.5 rounded-md bg-[var(--color-primary)]/20 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/30 transition shrink-0">
                            <i data-lucide="check" class="w-3 h-3"></i>
                        </button>
                        <button type="button" @click="showPresetForm = false; presetNameInput = ''" title="キャンセル"
                            class="p-1.5 rounded-md bg-white border border-black/5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition shrink-0">
                            <i data-lucide="x" class="w-3 h-3"></i>
                        </button>
                    </form>
                </template>
            </div>
        </aside>

        <!-- CENTER PANEL: Grid -->
        <main class="flex-1 flex flex-col relative min-w-0 min-h-0 order-first md:order-none" style="background:var(--md-surface);">
            <!-- Mobile Quick Filter Chips (mobile only) -->
            <div class="md:hidden flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide shrink-0 backdrop-blur-sm" style="background:var(--md-surface-container);border-bottom:1px solid var(--md-outline-variant);">
                <button @click="statusFilter = 'all'; taxonFilter = 'all'"
                    class="flex items-center gap-1 px-2.5 py-1 rounded-full border text-token-xs font-bold whitespace-nowrap transition shrink-0"
                    :class="statusFilter === 'all' && taxonFilter === 'all' ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20 text-[var(--color-primary-dark)]' : 'bg-white border-black/5 text-[var(--color-text-muted)]'">
                    🌍 全て
                </button>
                <button @click="statusFilter = 'unidentified'; taxonFilter = 'all'"
                    class="flex items-center gap-1 px-2.5 py-1 rounded-full border text-token-xs font-bold whitespace-nowrap transition shrink-0"
                    :class="statusFilter === 'unidentified' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-white border-black/5 text-[var(--color-text-muted)]'">
                    🔴 未同定 <span x-text="statusCounts.unidentified" class="font-mono ml-0.5 opacity-70"></span>
                </button>
                <button @click="statusFilter = 'suggested'; taxonFilter = 'all'"
                    class="flex items-center gap-1 px-2.5 py-1 rounded-full border text-token-xs font-bold whitespace-nowrap transition shrink-0"
                    :class="statusFilter === 'suggested' ? 'bg-purple-500/10 border-purple-500/20 text-purple-500' : 'bg-white border-black/5 text-[var(--color-text-muted)]'">
                    🟣 要確認 <span x-text="statusCounts.suggested" class="font-mono ml-0.5 opacity-70"></span>
                </button>
                <button @click="statusFilter = 'ai-multi'; taxonFilter = 'all'"
                    class="flex items-center gap-1 px-2.5 py-1 rounded-full border text-token-xs font-bold whitespace-nowrap transition shrink-0"
                    :class="statusFilter === 'ai-multi' ? 'bg-amber-500/10 border-amber-500/20 text-amber-700' : 'bg-white border-black/5 text-[var(--color-text-muted)]'">
                    🧭 AI複数 <span x-text="statusCounts.aiMulti" class="font-mono ml-0.5 opacity-70"></span>
                </button>
                <button @click="statusFilter = 'ai-genus'; taxonFilter = 'all'"
                    class="flex items-center gap-1 px-2.5 py-1 rounded-full border text-token-xs font-bold whitespace-nowrap transition shrink-0"
                    :class="statusFilter === 'ai-genus' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-white border-black/5 text-[var(--color-text-muted)]'">
                    🌱 属までは近い <span x-text="statusCounts.aiGenus" class="font-mono ml-0.5 opacity-70"></span>
                </button>
                <div class="w-px h-4 bg-black/10 shrink-0"></div>
                <template x-for="group in taxonGroups.slice(0, 5)" :key="group.id">
                    <button @click="taxonFilter = group.id; statusFilter = 'all'"
                        class="flex items-center gap-1 px-2.5 py-1 rounded-full border text-token-xs font-bold whitespace-nowrap transition shrink-0"
                        :class="taxonFilter === group.id ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20 text-[var(--color-primary-dark)]' : 'bg-white border-black/5 text-[var(--color-text-muted)]'">
                        <span x-text="group.icon"></span><span x-text="group.label"></span>
                    </button>
                </template>
            </div>
            <!-- Grid Toolbar -->
            <div class="workbench-toolbar h-10 flex items-center px-3 justify-between shrink-0">
                <div class="flex items-center gap-2">
                    <span class="text-token-xs font-bold text-[var(--color-text-muted)]">並替:</span>
                    <select x-model="sortBy" class="bg-transparent border-none text-token-xs text-[var(--color-text-secondary)] focus:outline-none cursor-pointer">
                        <option value="newest">新しい順</option>
                        <option value="oldest">古い順</option>
                    </select>
                </div>
                <div class="flex items-center gap-2" x-show="selectedIds.length > 0">
                    <button @click="batchQuickID()" class="text-token-xs font-bold text-[var(--color-primary)] hover:underline">一括同定</button>
                    <button @click="clearSelection()" class="text-token-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)]">選択解除</button>
                </div>
            </div>

            <!-- Grid -->
            <div class="flex-1 overflow-y-auto p-3 pb-20 md:pb-3 scrollbar-thin" @click.self="clearSelection()">
                <!-- Loading -->
                <div x-show="loading" class="flex items-center justify-center h-full">
                    <div class="w-8 h-8 border-2 border-white/10 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
                </div>

                <div x-show="!loading" class="grid gap-3" :class="gridClasses">
                    <template x-for="(item, index) in filteredItems" :key="item.id">
                        <div class="relative group overflow-hidden select-none transition-all duration-150 cursor-pointer" style="border-radius:var(--shape-xl);background:var(--md-surface-container);border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);"
                            @click="activateItem(item, index)"
                            :class="{
                                 'item-selected': selectedIds.includes(item.id),
                                 'ring-1 ring-black/5': !selectedIds.includes(item.id) && activeItemId !== item.id,
                                 'ring-2 ring-[var(--color-primary)] shadow-[0_12px_32px_rgba(16,185,129,0.18)] -translate-y-0.5 z-10': activeItemId === item.id,
                             }">
                            <div class="relative aspect-[4/3] overflow-hidden" style="background:var(--md-surface-container-low);">
                                <img :src="currentPhotoSrc(item)"
                                :alt="displayName(item)"
                                @dblclick.stop="openQuickID(item, index)"
                                class="w-full h-full object-cover transition duration-200 group-hover:scale-[1.02]">

                                <div class="absolute inset-x-0 top-0 flex items-start justify-between p-2">
                                    <!-- Status badge -->
                                    <div class="flex gap-1 pointer-events-none">
                                        <span x-show="!item.taxon" class="px-2 py-0.5 bg-red-500/90 rounded-full text-token-xs text-white font-bold">未同定</span>
                                        <span x-show="item.taxon" class="px-2 py-0.5 bg-purple-500/80 rounded-full text-token-xs text-white font-bold">提案あり</span>
                                        <span x-show="hasMultipleAiCandidates(item)" class="px-2 py-0.5 bg-amber-400/90 rounded-full text-token-xs text-black font-bold">AI複数</span>
                                        <span x-show="hasAiGenusHint(item)" class="px-2 py-0.5 bg-emerald-400/90 rounded-full text-token-xs text-black font-bold">属近い</span>
                                    </div>

                                    <div class="flex items-center gap-1.5">
                                        <button @click.stop="openPhotoViewer(item, 0)"
                                            class="workbench-photo-button workbench-hit-button rounded-full transition"
                                            title="写真を大きく見る">
                                            <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
                                        </button>
                                        <div class="cursor-pointer opacity-90" @click.stop="toggleSelect(item.id, index, $event)">
                                            <div class="w-5 h-5 rounded-full border border-white/70 bg-white/85 flex items-center justify-center shadow-sm"
                                                :class="selectedIds.includes(item.id) ? '!bg-[var(--color-primary)] !border-[var(--color-primary)]' : ''">
                                                <i x-show="selectedIds.includes(item.id)" data-lucide="check" class="w-3 h-3 text-white"></i>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="absolute inset-x-0 bottom-0 px-2 pb-2 pt-8 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none">
                                    <p class="text-sm font-black text-white truncate" x-text="displayName(item)"></p>
                                    <p class="text-token-xs text-white/80 truncate" x-text="secondaryLabel(item)"></p>
                                </div>
                            </div>

                            <div class="px-3 py-3 workbench-meta-card border-t-0 rounded-t-none">
                                <div class="flex items-start justify-between gap-2">
                                    <div class="min-w-0">
                                        <p class="text-token-xs font-bold text-[var(--color-text)] truncate" x-text="displayName(item)"></p>
                                        <p class="text-token-xs text-[var(--color-text-muted)] truncate" x-text="item.municipality || (item.location ? item.location.name : '場所情報なし')"></p>
                                    </div>
                                    <span class="text-token-xs text-[var(--color-text-faint)] shrink-0" x-text="formatDate(item.observed_at)"></span>
                                </div>
                                <div class="mt-2 flex items-center justify-between gap-2">
                                    <div class="flex items-center gap-1.5 text-token-xs text-[var(--color-text-muted)] min-w-0">
                                        <i data-lucide="messages-square" class="w-3.5 h-3.5 text-[var(--color-primary)]"></i>
                                        <span class="truncate" x-text="item.identifications?.length ? item.identifications.length + '件の同定あり' : '最初の同定を待っています'"></span>
                                    </div>
                                    <button @click.stop="openQuickID(item, index)" class="px-2.5 py-1.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)] text-token-xs font-bold hover:bg-[var(--color-primary)]/20 transition shrink-0" title="同定 (Enter)">
                                        同定する
                                    </button>
                                </div>
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

        <!-- RIGHT PANEL: Inspector (desktop only) -->
        <aside class="hidden md:flex md:flex-col w-full md:w-80 lg:w-[25rem] workbench-panel md:border-l border-black/5 shrink-0 md:h-full">
            <template x-if="activeItem">
                <div class="flex-1 flex flex-col overflow-y-auto scrollbar-thin">
                    <div class="p-4 pb-3 border-b border-black/5 shrink-0">
                        <div class="flex items-start justify-between gap-3 mb-3">
                            <div class="min-w-0">
                                <p class="text-token-xs font-bold uppercase tracking-widest text-[var(--color-text-faint)]">選択中の観察</p>
                                <h3 class="font-black text-lg leading-tight text-[var(--color-text)]" x-text="displayName(activeItem)"></h3>
                                <p class="text-token-xs text-[var(--color-text-muted)] italic truncate" x-text="activeItem.taxon ? activeItem.taxon.scientific_name : (latestAiAssessment(activeItem)?.best_specific_taxon?.scientific_name || latestAiAssessment(activeItem)?.recommended_taxon?.scientific_name || '')"></p>
                                <p class="text-token-xs text-[var(--color-text-faint)] mt-1 font-mono truncate" x-text="activeItem.id"></p>
                            </div>
                            <button @click="openPhotoViewer(activeItem, activePhotoIdx)"
                                class="workbench-photo-button workbench-hit-button rounded-full shrink-0"
                                title="写真を大きく見る">
                                <i data-lucide="maximize-2" class="w-4 h-4"></i>
                            </button>
                        </div>

                        <div class="workbench-stage rounded-[24px] p-3">
                            <div class="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-[var(--color-bg-surface)]">
                                <img :src="currentPhotoSrc(activeItem, activePhotoIdx)"
                                    :alt="displayName(activeItem)"
                                    @click="openPhotoViewer(activeItem, activePhotoIdx)"
                                    class="w-full h-full object-contain cursor-zoom-in">
                                <div class="absolute inset-x-0 top-0 flex items-center justify-between p-2">
                                    <span class="px-2.5 py-1 rounded-full bg-black/55 text-white text-token-xs font-bold shadow-sm" x-text="displayName(activeItem)"></span>
                                    <span class="px-2 py-1 rounded-full bg-white/90 text-[var(--color-text-muted)] text-token-xs font-bold shadow-sm" x-text="photoCounter(activeItem, activePhotoIdx)"></span>
                                </div>
                                <template x-if="(activeItem.photos?.length || 0) > 1">
                                    <div class="absolute inset-x-0 bottom-0 flex items-center justify-between p-2">
                                        <button @click.stop="shiftActivePhoto(-1)" class="workbench-photo-button workbench-hit-button rounded-full">
                                            <i data-lucide="chevron-left" class="w-4 h-4"></i>
                                        </button>
                                        <button @click.stop="shiftActivePhoto(1)" class="workbench-photo-button workbench-hit-button rounded-full">
                                            <i data-lucide="chevron-right" class="w-4 h-4"></i>
                                        </button>
                                    </div>
                                </template>
                            </div>
                            <template x-if="(activeItem.photos?.length || 0) > 1">
                                <div class="mt-3 flex gap-2 overflow-x-auto scrollbar-thin">
                                    <template x-for="(photo, photoIndex) in activeItem.photos" :key="photo + '-' + photoIndex">
                                        <button @click="setActivePhoto(photoIndex)"
                                            class="shrink-0 rounded-2xl overflow-hidden border-2 transition"
                                            :class="activePhotoIdx === photoIndex ? 'border-[var(--color-primary)] shadow-[0_8px_20px_rgba(16,185,129,0.18)]' : 'border-transparent opacity-70 hover:opacity-100'">
                                            <img :src="photo" :alt="displayName(activeItem)" class="w-16 h-16 object-cover">
                                        </button>
                                    </template>
                                </div>
                            </template>
                        </div>
                    </div>

                    <div class="p-4 space-y-4">
                        <div class="workbench-meta-card rounded-2xl p-3 text-token-xs text-[var(--color-text-muted)] space-y-1.5">
                            <p class="flex items-center gap-1.5"><i data-lucide="calendar" class="w-3 h-3"></i> <span x-text="formatDate(activeItem.observed_at)"></span></p>
                            <p class="flex items-center gap-1.5" x-show="activeItem.municipality || activeItem.location"><i data-lucide="map-pin" class="w-3 h-3"></i> <span x-text="activeItem.municipality || (activeItem.location ? activeItem.location.name : '')"></span></p>
                            <p class="flex items-center gap-1.5"><i data-lucide="user" class="w-3 h-3"></i> <span x-text="activeItem.user_name || '匿名'"></span></p>
                        </div>

                        <template x-if="latestAiAssessment(activeItem)">
                            <div class="workbench-meta-card rounded-2xl p-3">
                                <div class="flex items-center justify-between gap-2">
                                    <div>
                                        <p class="text-token-xs font-bold uppercase tracking-widest text-[var(--color-text-faint)]">AIヒント</p>
                                        <p class="text-sm font-bold text-[var(--color-text)]" x-text="latestAiAssessment(activeItem)?.recommended_taxon?.label || latestAiAssessment(activeItem)?.best_specific_taxon?.label || '見分け候補あり'"></p>
                                    </div>
                                    <span x-show="hasMultipleAiCandidates(activeItem)" class="px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 text-token-xs font-bold">複数候補</span>
                                </div>
                                <p class="mt-2 text-token-xs text-[var(--color-text-muted)] leading-relaxed" x-text="latestAiAssessment(activeItem)?.simple_summary || latestAiAssessment(activeItem)?.why_not_more_specific || 'いま見えている情報から、次に確認したい点を絞っています。'"></p>
                            </div>
                        </template>

                        <template x-if="activeItem.identifications && activeItem.identifications.length > 0">
                            <div>
                                <h4 class="text-token-xs font-bold text-[var(--color-text-faint)] uppercase tracking-widest mb-1.5">提案された同定</h4>
                                <template x-for="idEntry in activeItem.identifications" :key="idEntry.id">
                                    <div class="flex items-center gap-2 py-2 border-b border-black/5">
                                        <div class="w-6 h-6 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)] flex items-center justify-center text-token-xs font-bold" x-text="(idEntry.user_name || '?').charAt(0)"></div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-1.5 leading-none mb-0.5">
                                                <p class="text-token-xs font-bold truncate text-[var(--color-text)]" x-text="idEntry.taxon_name"></p>
                                                <span x-show="idEntry.life_stage && idEntry.life_stage !== 'unknown'" class="text-token-xs px-1.5 py-0.5 rounded-full bg-black/5 text-[var(--color-text-muted)] font-bold shrink-0" x-text="idEntry.life_stage === 'adult' ? '成体' : idEntry.life_stage === 'juvenile' ? '幼体' : idEntry.life_stage === 'egg' ? '卵等' : '痕跡'"></span>
                                            </div>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </template>

                        <div class="space-y-2 pt-1">
                            <button @click="openQuickID(activeItem, activeItemIndex)"
                                class="w-full py-3 rounded-2xl bg-[var(--color-primary)] text-black text-xs font-bold hover:brightness-110 transition flex items-center justify-center gap-1.5 shadow-lg">
                                <i data-lucide="zap" class="w-3.5 h-3.5"></i> 同定する
                                <span class="shortcut-badge !bg-black/20 !border-black/20 !text-black/60">Enter</span>
                            </button>
                            <div class="grid grid-cols-2 gap-1.5">
                                <button @click="markPass(activeItem.id)"
                                    class="py-2 text-token-xs font-bold hover:bg-red-500/10 hover:text-red-500 transition flex items-center justify-center gap-1" style="border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);color:var(--md-on-surface-variant);">
                                    <i data-lucide="x" class="w-3 h-3"></i> パス
                                    <span class="shortcut-badge">X</span>
                                </button>
                                <button @click="markLater(activeItem.id)"
                                    class="py-2 text-token-xs font-bold hover:bg-blue-500/10 hover:text-blue-500 transition flex items-center justify-center gap-1" style="border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);color:var(--md-on-surface-variant);">
                                    <i data-lucide="bookmark" class="w-3 h-3"></i> あとで
                                    <span class="shortcut-badge">B</span>
                                </button>
                            </div>
                            <a :href="'post.php?taxon_name=' + encodeURIComponent(activeItem.taxon ? activeItem.taxon.name : '')"
                                x-show="activeItem.taxon"
                                class="block w-full py-2 rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 text-[var(--color-primary-dark)] text-token-xs font-bold hover:bg-[var(--color-primary)]/10 transition text-center">
                                📸 この種で観察を投稿
                            </a>
                            <div class="grid grid-cols-2 gap-1.5">
                                <button @click="openPhotoViewer(activeItem, activePhotoIdx)"
                                    class="py-2 text-token-xs font-bold transition text-center" style="border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);color:var(--md-on-surface-variant);">
                                    大きく見る
                                </button>
                                <a :href="'observation_detail.php?id=' + activeItem.id"
                                    class="block py-2 text-token-xs font-bold transition text-center" style="border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);color:var(--md-on-surface-variant);">
                                    詳細ページ
                                </a>
                            </div>
                            <p class="text-token-xs text-[var(--color-text-faint)] text-center">詳細ページは補助です。この画面で写真確認と同定を進められます。</p>
                        </div>
                    </div>
                </div>
            </template>

            <template x-if="!activeItem">
                <div class="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)] p-6 gap-5">
                    <div class="w-full space-y-2">
                        <p class="text-token-xs text-[var(--color-text-faint)] font-bold uppercase tracking-widest mb-3 text-center">使い方</p>
                        <div class="workbench-meta-card rounded-2xl p-3 flex items-start gap-3">
                            <span class="w-5 h-5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary-dark)] text-token-xs font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
                            <div>
                                <p class="text-xs font-bold text-[var(--color-text)]">フィルタで絞り込む</p>
                                <p class="text-token-xs text-[var(--color-text-muted)] mt-0.5">左パネルで分類群・ステータスを選ぶ</p>
                            </div>
                        </div>
                        <div class="workbench-meta-card rounded-2xl p-3 flex items-start gap-3">
                            <span class="w-5 h-5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary-dark)] text-token-xs font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
                            <div>
                                <p class="text-xs font-bold text-[var(--color-text)]">写真を選ぶ</p>
                                <p class="text-token-xs text-[var(--color-text-muted)] mt-0.5">右側に大きな写真が出るので、その場で見比べられる</p>
                            </div>
                        </div>
                        <div class="workbench-meta-card rounded-2xl p-3 flex items-start gap-3">
                            <span class="w-5 h-5 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary-dark)] text-token-xs font-black flex items-center justify-center shrink-0 mt-0.5">3</span>
                            <div>
                                <p class="text-xs font-bold text-[var(--color-text)]">名前を提案する</p>
                                <p class="text-token-xs text-[var(--color-text-muted)] mt-0.5"><span class="shortcut-badge">Enter</span> でも同定画面を開ける</p>
                            </div>
                        </div>
                    </div>
                    <div class="w-full">
                        <p class="text-token-xs text-[var(--color-text-faint)] font-bold uppercase tracking-widest mb-2 text-center">ショートカット</p>
                        <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-token-xs font-mono p-3" style="color:var(--md-on-surface-variant);background:var(--md-surface-container-low);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
                            <p><span class="shortcut-badge">N</span> 次へ</p>
                            <p><span class="shortcut-badge">P</span> 前へ</p>
                            <p><span class="shortcut-badge">Enter</span> 同定</p>
                            <p><span class="shortcut-badge">X</span> パス</p>
                            <p><span class="shortcut-badge">B</span> あとで</p>
                            <p><span class="shortcut-badge">/</span> 検索</p>
                        </div>
                    </div>
                </div>
            </template>
        </aside>
    </div>

    <!-- Undo Pass Toast -->
    <div x-show="lastPassedId" x-cloak x-transition:enter="transition ease-out duration-200" x-transition:enter-start="opacity-0 translate-y-2" x-transition:enter-end="opacity-100 translate-y-0" x-transition:leave="transition ease-in duration-150" x-transition:leave-end="opacity-0 translate-y-2"
        class="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 text-xs font-bold whitespace-nowrap" style="background:var(--md-surface-container-high);border-radius:var(--shape-full);box-shadow:var(--elev-4);color:var(--md-on-surface);">
        <span class="text-[var(--color-text-muted)]">パスしました</span>
        <button @click="undoPass()" class="text-[var(--color-primary)] hover:underline flex items-center gap-1">
            <i data-lucide="undo-2" class="w-3 h-3"></i> 元に戻す
        </button>
    </div>

    <!-- Mobile Bottom Inspector -->
    <div x-show="activeItem && isMobile" x-cloak
        class="fixed bottom-16 inset-x-0 backdrop-blur-sm z-30 md:hidden" style="background:var(--md-surface-container);border-top:1px solid var(--md-outline-variant);"
        x-transition:enter="transition ease-out duration-200" x-transition:enter-start="opacity-0 translate-y-4" x-transition:enter-end="opacity-100 translate-y-0">
        <div class="px-3 py-3 space-y-3">
            <button @click="if(activeItem) openPhotoViewer(activeItem, activePhotoIdx)"
                class="block w-full">
                <div class="relative aspect-[4/3] rounded-[20px] overflow-hidden workbench-stage p-2">
                    <img :src="currentPhotoSrc(activeItem, activePhotoIdx)"
                        :alt="displayName(activeItem)"
                        class="w-full h-full rounded-[16px] object-contain">
                    <div class="absolute inset-x-0 top-0 p-3 flex items-center justify-between">
                        <span class="px-2.5 py-1 rounded-full bg-black/55 text-white text-token-xs font-bold" x-text="displayName(activeItem)"></span>
                        <span class="px-2 py-1 rounded-full bg-white/90 text-[var(--color-text-muted)] text-token-xs font-bold" x-text="photoCounter(activeItem, activePhotoIdx)"></span>
                    </div>
                </div>
            </button>
            <div class="flex items-start gap-3">
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-black text-[var(--color-text)] truncate" x-text="displayName(activeItem)"></p>
                    <p class="text-token-xs text-[var(--color-text-muted)] truncate" x-text="(activeItem?.municipality || '') + (activeItem?.observed_at ? ' · ' + formatDate(activeItem.observed_at) : '')"></p>
                    <p class="text-token-xs text-[var(--color-text-faint)] truncate" x-text="activeItem?.identifications?.length ? activeItem.identifications.length + '件の同定あり' : '最初の同定を待っています'"></p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button @click="if(activeItem) openPhotoViewer(activeItem, activePhotoIdx)"
                        class="workbench-hit-button rounded-xl bg-black/5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
                        title="大きく見る">
                        <i data-lucide="maximize-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-4 gap-2">
                <button @click="if(activeItem) markLater(activeItem.id)"
                    class="p-2 rounded-xl transition border border-black/5"
                    :class="laterItems.includes(activeItem?.id) ? 'bg-blue-500/10 text-blue-600' : 'bg-white text-[var(--color-text-muted)]'"
                    title="あとで">
                    <i data-lucide="bookmark" class="w-4 h-4"></i>
                </button>
                <button @click="if(activeItem) { markPass(activeItem.id); activeItemId = null; }"
                    class="p-2 hover:text-red-500 transition" style="border-radius:var(--shape-md);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);" title="パス">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
                <button @click="if(activeItem) openQuickID(activeItem, activeItemIndex)"
                    class="p-2 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)] hover:bg-[var(--color-primary)]/20 transition" title="同定する">
                    <i data-lucide="zap" class="w-4 h-4"></i>
                </button>
                <a :href="activeItem ? 'observation_detail.php?id=' + activeItem.id : '#'"
                    class="px-3 py-2 font-bold text-xs flex items-center justify-center gap-1.5 transition" style="border-radius:var(--shape-md);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
                    <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i> 詳細
                </a>
            </div>
            <template x-if="activeItem?.identifications?.length > 0">
                <div class="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                <template x-for="ident in (activeItem.identifications || []).slice(0, 4)" :key="ident.id">
                    <span class="shrink-0 px-2 py-0.5 rounded-full bg-white border border-black/5 text-token-xs text-[var(--color-text-muted)] font-bold"
                        x-text="ident.taxon_name || '?'"></span>
                </template>
                </div>
            </template>
        </div>
    </div>

    <!-- Photo Lightbox -->
    <div x-show="photoViewer.open" x-cloak
        class="fixed inset-0 z-[70] lightbox-backdrop flex items-center justify-center px-3 py-6"
        @keydown.window.escape.prevent="closePhotoViewer()"
        @click.self="closePhotoViewer()">
        <div class="w-full max-w-6xl h-full max-h-[92vh] flex flex-col">
            <div class="flex items-center justify-between gap-3 text-white mb-3">
                <div class="min-w-0">
                    <p class="text-sm font-black truncate" x-text="photoViewer.item ? displayName(photoViewer.item) : '写真プレビュー'"></p>
                    <p class="text-token-xs text-white/70 truncate" x-text="photoViewer.item ? secondaryLabel(photoViewer.item) : ''"></p>
                </div>
                <div class="flex items-center gap-2">
                    <button @click="if(photoViewer.item) openQuickID(photoViewer.item, activeItemIndex)"
                        class="px-3 py-2 rounded-full bg-[var(--color-primary)] text-black text-token-xs font-bold hover:brightness-110 transition">
                        同定する
                    </button>
                    <button @click="closePhotoViewer()" class="workbench-photo-button workbench-hit-button rounded-full">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            <div class="relative flex-1 rounded-[28px] overflow-hidden bg-black/20 border border-white/10">
                <img :src="photoViewer.photo"
                    :alt="photoViewer.item ? displayName(photoViewer.item) : '観察写真'"
                    class="w-full h-full object-contain">
                <template x-if="(photoViewer.item?.photos?.length || 0) > 1">
                    <div>
                        <button @click.stop="shiftPhotoViewer(-1)" class="lightbox-nav-zone lightbox-nav-zone--left" aria-label="前の写真">
                            <span class="workbench-photo-button workbench-hit-button rounded-full">
                                <i data-lucide="chevron-left" class="w-4 h-4"></i>
                            </span>
                        </button>
                        <button @click.stop="shiftPhotoViewer(1)" class="lightbox-nav-zone lightbox-nav-zone--right" aria-label="次の写真">
                            <span class="workbench-photo-button workbench-hit-button rounded-full">
                                <i data-lucide="chevron-right" class="w-4 h-4"></i>
                            </span>
                        </button>
                    </div>
                </template>
            </div>
            <template x-if="(photoViewer.item?.photos?.length || 0) > 1">
                <div class="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-thin">
                    <template x-for="(photo, photoIndex) in (photoViewer.item?.photos || [])" :key="photo + '-viewer-' + photoIndex">
                        <button @click="setPhotoViewerPhoto(photoIndex)"
                            class="shrink-0 rounded-2xl overflow-hidden border-2 transition"
                            :class="photoViewer.photoIndex === photoIndex ? 'border-[var(--color-primary)]' : 'border-transparent opacity-70 hover:opacity-100'">
                            <img :src="photo" :alt="photoViewer.item ? displayName(photoViewer.item) : '観察写真'" class="w-20 h-20 object-cover">
                        </button>
                    </template>
                </div>
            </template>
        </div>
    </div>

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
                photoViewer: {
                    open: false,
                    item: null,
                    photo: '',
                    photoIndex: 0,
                },

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

                // Mobile
                showMobileFilter: false,
                isMobile: false,

                // Onboarding
                showWelcome: !localStorage.getItem('ikimon_wb_welcomed'),
                showHelp: false,

                // Preset inline form
                showPresetForm: false,
                presetNameInput: '',

                // Undo pass
                lastPassedId: null,
                lastPassedIndex: -1,
                _undoTimer: null,

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
                    this.isMobile = window.innerWidth < 768;
                    window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 768; });
                    // フィルター変更時にモバイルドロワーを閉じる
                    this.$watch('taxonFilter', () => { if (this.isMobile) this.showMobileFilter = false; });
                    this.$watch('statusFilter', () => { if (this.isMobile) this.showMobileFilter = false; });
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
                        aiMulti: this.allItems.filter(i => this.hasMultipleAiCandidates(i)).length,
                        aiGenus: this.allItems.filter(i => this.hasAiGenusHint(i)).length,
                    };
                },

                latestAiAssessment(item) {
                    return item && Array.isArray(item.ai_assessments) && item.ai_assessments.length > 0 ? item.ai_assessments[0] : null;
                },

                currentPhotoSrc(item, photoIndex = 0) {
                    if (!item || !Array.isArray(item.photos) || item.photos.length === 0) {
                        return 'assets/img/no-photo.svg';
                    }
                    return item.photos[photoIndex] || item.photos[0] || 'assets/img/no-photo.svg';
                },

                displayName(item) {
                    if (!item) return '未同定';
                    if (item.taxon && item.taxon.name) return item.taxon.name;
                    const ai = this.latestAiAssessment(item);
                    const bestSpecific = ai && ai.best_specific_taxon ? ai.best_specific_taxon : null;
                    const recommended = ai && ai.recommended_taxon ? ai.recommended_taxon : null;
                    return (bestSpecific && (bestSpecific.label || bestSpecific.name))
                        || (recommended && (recommended.label || recommended.name))
                        || '未同定';
                },

                secondaryLabel(item) {
                    if (!item) return '';
                    const ai = this.latestAiAssessment(item);
                    const parts = [];
                    const scientificName = item.taxon?.scientific_name
                        || ai?.best_specific_taxon?.scientific_name
                        || ai?.recommended_taxon?.scientific_name
                        || '';
                    if (scientificName) parts.push(scientificName);
                    if (item.municipality) parts.push(item.municipality);
                    if (parts.length === 0 && ai?.simple_summary) {
                        return ai.simple_summary;
                    }
                    return parts.join(' · ') || 'この場で写真を見比べながら同定できます';
                },

                photoCounter(item, photoIndex = 0) {
                    const total = item && Array.isArray(item.photos) && item.photos.length > 0 ? item.photos.length : 1;
                    return `${Math.min(photoIndex + 1, total)} / ${total}`;
                },

                hasMultipleAiCandidates(item) {
                    const ai = this.latestAiAssessment(item);
                    if (!ai) return false;
                    const providerLabels = Array.isArray(ai.provider_candidates)
                        ? ai.provider_candidates.map(c => (c && c.label ? String(c.label).trim() : '')).filter(Boolean)
                        : [];
                    const compareLabels = Array.isArray(ai.similar_taxa_to_compare)
                        ? ai.similar_taxa_to_compare.map(v => String(v).trim()).filter(Boolean)
                        : [];
                    const uniqueCandidates = new Set([...providerLabels, ...compareLabels]);
                    return uniqueCandidates.size >= 2;
                },

                hasAiGenusHint(item) {
                    const ai = this.latestAiAssessment(item);
                    if (!ai) return false;
                    const recommended = ai.recommended_taxon && typeof ai.recommended_taxon === 'object' ? ai.recommended_taxon : null;
                    const rank = String((recommended && recommended.rank) || ai.recommended_rank || '').toLowerCase();
                    return rank === 'genus';
                },

                setTaxonFilter(id) {
                    this.taxonFilter = id;
                },

                get filteredItems() {
                    let items = [...this.allItems];

                    // Text filter
                    if (this.filterText) {
                        const q = this.filterText.toLowerCase();
                        items = items.filter(i => {
                            const name = i.taxon ? (i.taxon.name || '').toLowerCase() : '';
                            const sci = i.taxon ? (i.taxon.scientific_name || '').toLowerCase() : '';
                            const loc = (i.municipality || (i.location ? i.location.name : '') || '').toLowerCase();
                            const ai = this.latestAiAssessment(i);
                            const aiCandidates = [
                                ...(ai && Array.isArray(ai.provider_candidates) ? ai.provider_candidates.map(c => (c && c.label ? c.label : '')) : []),
                                ...(ai && Array.isArray(ai.similar_taxa_to_compare) ? ai.similar_taxa_to_compare : []),
                            ].join(' ').toLowerCase();
                            return name.includes(q) || sci.includes(q) || loc.includes(q) || aiCandidates.includes(q);
                        });
                    }

                    // Status filter
                    if (this.statusFilter === 'unidentified') items = items.filter(i => !i.taxon);
                    if (this.statusFilter === 'suggested') items = items.filter(i => !!i.taxon);
                    if (this.statusFilter === 'ai-multi') items = items.filter(i => this.hasMultipleAiCandidates(i));
                    if (this.statusFilter === 'ai-genus') items = items.filter(i => this.hasAiGenusHint(i));
                    if (this.statusFilter === 'later') items = items.filter(i => this.laterItems.includes(i.id));
                    if (this.statusFilter === 'passed') items = items.filter(i => this.passItems.includes(i.id));

                    // Taxon group filter
                    if (this.taxonFilter !== 'all') {
                        items = items.filter(i => this.getTaxonGroup(i) === this.taxonFilter);
                    }

                    // Exclude passed items (except when explicitly viewing them)
                    if (this.statusFilter !== 'passed') {
                        items = items.filter(i => !this.passItems.includes(i.id));
                    }

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
                        '1': 'grid-cols-2 md:grid-cols-2',
                        '2': 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
                        '3': 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5',
                        '4': 'grid-cols-3 md:grid-cols-5 lg:grid-cols-7',
                        '5': 'grid-cols-3 md:grid-cols-7 lg:grid-cols-10'
                    };
                    return m[this.gridCols] || m['3'];
                },

                activateItem(item, index) {
                    this.activeItemId = item.id;
                    this.activeItemIndex = index;
                    this.activePhotoIdx = 0;
                    this.$nextTick(() => lucide.createIcons());
                },

                setActivePhoto(photoIndex) {
                    const total = this.activeItem && Array.isArray(this.activeItem.photos) && this.activeItem.photos.length > 0
                        ? this.activeItem.photos.length
                        : 1;
                    this.activePhotoIdx = ((photoIndex % total) + total) % total;
                },

                shiftActivePhoto(step) {
                    this.setActivePhoto(this.activePhotoIdx + step);
                },

                openPhotoViewer(item, photoIndex = 0) {
                    if (!item) return;
                    const resolvedIndex = this.filteredItems.findIndex(i => i.id === item.id);
                    this.activeItemId = item.id;
                    this.activeItemIndex = resolvedIndex >= 0 ? resolvedIndex : this.activeItemIndex;
                    this.setActivePhoto(photoIndex);
                    this.photoViewer = {
                        open: true,
                        item,
                        photoIndex: this.activePhotoIdx,
                        photo: this.currentPhotoSrc(item, this.activePhotoIdx),
                    };
                    this.$nextTick(() => lucide.createIcons());
                },

                closePhotoViewer() {
                    this.photoViewer.open = false;
                },

                setPhotoViewerPhoto(photoIndex) {
                    if (!this.photoViewer.item) return;
                    const total = Array.isArray(this.photoViewer.item.photos) && this.photoViewer.item.photos.length > 0
                        ? this.photoViewer.item.photos.length
                        : 1;
                    const nextIndex = ((photoIndex % total) + total) % total;
                    this.photoViewer.photoIndex = nextIndex;
                    this.photoViewer.photo = this.currentPhotoSrc(this.photoViewer.item, nextIndex);
                    if (this.activeItemId === this.photoViewer.item.id) {
                        this.activePhotoIdx = nextIndex;
                    }
                },

                shiftPhotoViewer(step) {
                    this.setPhotoViewerPhoto(this.photoViewer.photoIndex + step);
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
                    if (this.photoViewer.open && this.photoViewer.item && this.photoViewer.item.id === id) {
                        this.closePhotoViewer();
                    }
                    this.lastPassedId = id;
                    this.lastPassedIndex = this.activeItemIndex;
                    clearTimeout(this._undoTimer);
                    this._undoTimer = setTimeout(() => { this.lastPassedId = null; }, 5000);
                    this.navigateNext();
                },

                undoPass() {
                    if (!this.lastPassedId) return;
                    const id = this.lastPassedId;
                    this.passItems = this.passItems.filter(i => i !== id);
                    localStorage.setItem('ikimon_skipped_ids', JSON.stringify(this.passItems));
                    const item = this.allItems.find(i => i.id === id);
                    if (item) this.activateItem(item, this.lastPassedIndex);
                    this.lastPassedId = null;
                    clearTimeout(this._undoTimer);
                },

                clearAllPass() {
                    this.passItems = [];
                    localStorage.removeItem('ikimon_skipped_ids');
                    if (this.statusFilter === 'passed') this.statusFilter = 'all';
                },

                clearAllLater() {
                    this.laterItems = [];
                    localStorage.removeItem('ikimon_later_ids');
                    if (this.statusFilter === 'later') this.statusFilter = 'all';
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
                    if (this.photoViewer.open) this.closePhotoViewer();
                    let idx = this.activeItemIndex;
                    if (idx < items.length - 1) idx++;
                    this.activateItem(items[idx], idx);
                },

                navigatePrev() {
                    const items = this.filteredItems;
                    if (items.length === 0) return;
                    if (this.photoViewer.open) this.closePhotoViewer();
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
                    const name = this.presetNameInput.trim();
                    if (!name) return;
                    this.presets.push({
                        name,
                        taxonFilter: this.taxonFilter,
                        statusFilter: this.statusFilter,
                        filterText: this.filterText
                    });
                    localStorage.setItem('ikimon_wb_presets', JSON.stringify(this.presets));
                    this.presetNameInput = '';
                    this.showPresetForm = false;
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

                    if (this.photoViewer.open) {
                        switch (e.key) {
                            case 'ArrowLeft':
                                e.preventDefault();
                                this.shiftPhotoViewer(-1);
                                return;
                            case 'ArrowRight':
                                e.preventDefault();
                                this.shiftPhotoViewer(1);
                                return;
                            case 'Escape':
                                e.preventDefault();
                                this.closePhotoViewer();
                                return;
                        }
                    }

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
                            if (this.photoViewer.open) {
                                this.closePhotoViewer();
                                break;
                            }
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
