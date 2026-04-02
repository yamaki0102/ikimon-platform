<?php

/**
 * Omoikane Status Dashboard
 * Real-time monitoring of the autonomous extraction engine.
 */
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CspNonce.php';
Auth::requireRole('Admin');
CspNonce::sendHeader();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OMOIKANE 抽出コンソール</title>
    <!-- Alpine.js & Tailwind (Using CDN for quick standalone dashboard) -->
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.9/dist/cdn.min.js"></script>
    <script src="/assets/js/tailwind.3.4.17.min.js"></script>
    <style>
        body {
            background-color: #0f172a;
            color: #e2e8f0;
            font-family: 'Inter', 'Noto Sans JP', sans-serif;
            background-image:
                radial-gradient(circle at 15% 50%, rgba(16, 185, 129, 0.05), transparent 25%),
                radial-gradient(circle at 85% 30%, rgba(56, 189, 248, 0.05), transparent 25%);
        }

        .glass-panel {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
        }

        .pulse-green {
            animation: pulseGreen 2s infinite;
        }

        @keyframes pulseGreen {
            0% {
                box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
            }

            70% {
                box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
            }

            100% {
                box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
            }
        }

        /* Subtle scanline effect */
        .scanlines {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(to bottom,
                    rgba(255, 255, 255, 0),
                    rgba(255, 255, 255, 0) 50%,
                    rgba(0, 0, 0, 0.1) 50%,
                    rgba(0, 0, 0, 0.1));
            background-size: 100% 4px;
            pointer-events: none;
            z-index: 50;
            opacity: 0.3;
        }
    </style>
</head>

<body class="min-h-screen p-4 md:p-8" x-data="omoikaneDashboard()">
    <div class="scanlines"></div>
    <div class="max-w-7xl mx-auto space-y-6 relative z-10">

        <!-- Header -->
        <div class="glass-panel p-6 flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
            <div>
                <h1 class="text-2xl md:text-3xl font-bold tracking-wider text-slate-100 uppercase flex items-center gap-3">
                    Omoikane 抽出エンジン
                    <span class="px-2 py-1 bg-slate-800 text-xs text-slate-400 rounded-md border border-slate-700">v1.2</span>
                </h1>
                <p class="text-sm text-slate-400 mt-1">10万種・自律型ナレッジグラフ生成プロジェクト</p>
            </div>
            <div class="flex items-center space-x-3 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700/50">
                <span class="relative flex h-3 w-3">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span class="text-sm font-bold text-green-400 tracking-wide uppercase">システム稼働中</span>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <!-- Left Column: Metrics -->
            <div class="lg:col-span-2 space-y-6">
                <!-- Metrics Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <div class="glass-panel p-6 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <svg class="w-24 h-24" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <h2 class="text-sm text-slate-400 font-bold tracking-widest mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-cyan-400"></span> 処理スループット
                        </h2>
                        <div class="text-5xl font-light text-cyan-400 mt-4 font-mono">
                            <span x-text="metrics.speed.per_hour">0</span> <span class="text-xl text-slate-500 font-sans">/ 時間</span>
                        </div>
                        <p class="text-xs text-slate-500 mt-4 font-mono bg-slate-800/40 p-2 rounded inline-block">現在: <span x-text="metrics.speed.per_minute"></span> / 分</p>
                    </div>

                    <div class="glass-panel p-6 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <svg class="w-24 h-24" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"></path>
                            </svg>
                        </div>
                        <h2 class="text-sm text-slate-400 font-bold tracking-widest mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-green-400"></span> 抽出完了 (合計)
                        </h2>
                        <div class="text-5xl font-light text-green-400 mt-4 font-mono">
                            <span x-text="metrics.sqlite_distilled.toLocaleString()">0</span> <span class="text-xl text-slate-500 font-sans">種</span>
                        </div>
                        <p class="text-xs text-slate-500 mt-4">SQLiteデータベースへの格納数</p>
                    </div>

                    <div class="glass-panel p-6 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <svg class="w-24 h-24" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <h2 class="text-sm text-slate-400 font-bold tracking-widest mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-purple-400"></span> 参考文献 (収集済)
                        </h2>
                        <div class="text-5xl font-light text-purple-400 mt-4 font-mono">
                            <span x-text="(metrics.total_papers || 0).toLocaleString()">0</span> <span class="text-xl text-slate-500 font-sans">件</span>
                        </div>
                        <p class="text-xs text-slate-500 mt-4">学術論文・文献データ</p>
                    </div>
                    <div class="glass-panel p-6">
                        <h2 class="text-sm text-slate-400 font-bold tracking-widest mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-yellow-400"></span> 実行キュー (処理中)
                        </h2>
                        <div class="flex items-baseline space-x-2 mt-4">
                            <div class="text-5xl font-light text-yellow-400 font-mono" x-text="metrics.queue.processing">0</div>
                            <div class="text-sm text-slate-500">AI推論中</div>
                            <div class="text-3xl font-light text-blue-400 font-mono ml-4" x-text="metrics.queue.fetching_lit">0</div>
                            <div class="text-sm text-slate-500">文献取得中</div>
                        </div>
                        <div class="w-full bg-slate-800 rounded-full h-1.5 mt-4 flex overflow-hidden">
                            <div class="bg-blue-400 h-1.5" :style="'width: ' + ((metrics.queue.fetching_lit / (metrics.queue.total || 1)) * 100) + '%'"></div>
                            <div class="bg-indigo-400 h-1.5" :style="'width: ' + ((metrics.queue.literature_ready / (metrics.queue.total || 1)) * 100) + '%'"></div>
                            <div class="bg-yellow-400 h-1.5" :style="'width: ' + ((metrics.queue.processing / (metrics.queue.total || 1)) * 100) + '%'"></div>
                        </div>
                        <p class="text-xs text-slate-500 mt-2 flex justify-between">
                            <span>待機: <span x-text="metrics.queue.pending" class="text-slate-300"></span></span>
                            <span>抽出待: <span x-text="metrics.queue.literature_ready" class="text-indigo-400"></span></span>
                            <span>全件: <span x-text="metrics.queue.total" class="text-slate-300"></span></span>
                        </p>
                    </div>

                    <div class="glass-panel p-6">
                        <h2 class="text-sm text-slate-400 font-bold tracking-widest mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-purple-400"></span> 推定残り時間
                        </h2>
                        <div class="text-5xl font-light text-purple-400 mt-4 font-mono">
                            <span x-text="metrics.eta_hours > 0 ? metrics.eta_hours : '--'">--</span> <span class="text-xl text-slate-500 font-sans">時間</span>
                        </div>
                        <p class="text-xs text-slate-500 mt-4 line-clamp-1">現在のスループットから算出</p>
                    </div>
                </div>

                <!-- Status Details -->
                <div class="glass-panel p-6">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-lg font-semibold text-slate-200">システム状態</h2>
                        <div class="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-md border border-slate-700">
                            <svg class="w-4 h-4 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span x-text="refreshInterval / 1000"></span>秒ごとに自動更新
                        </div>
                    </div>

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div class="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-700/40 transition-colors">
                            <div class="text-xs text-slate-500 uppercase font-bold tracking-wider">エラー / 失敗</div>
                            <div class="text-2xl font-light text-red-400 mt-2 font-mono" x-text="metrics.recent_failed">0</div>
                        </div>
                        <div class="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-700/40 transition-colors">
                            <div class="text-xs text-slate-500 uppercase font-bold tracking-wider">文献なし</div>
                            <div class="text-2xl font-light text-orange-400 mt-2 font-mono" x-text="metrics.queue.no_literature || 0">0</div>
                        </div>
                        <div class="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-700/40 transition-colors">
                            <div class="text-xs text-slate-500 uppercase font-bold tracking-wider">抽出待ち</div>
                            <div class="text-2xl font-light text-indigo-400 mt-2 font-mono" x-text="metrics.queue.literature_ready || 0">0</div>
                        </div>
                        <div class="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:bg-slate-700/40 transition-colors">
                            <div class="text-xs text-slate-500 uppercase font-bold tracking-wider">最終更新</div>
                            <div class="text-lg font-bold text-slate-300 mt-3" x-text="lastUpdateString() || '--'">--</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column: Live Feed -->
            <div class="glass-panel p-0 flex flex-col h-[600px] overflow-hidden">
                <div class="p-6 border-b border-slate-700/50 bg-slate-800/30">
                    <h2 class="text-lg font-semibold text-slate-200 flex items-center justify-between">
                        <span>LIVE 抽出フィード</span>
                        <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    </h2>
                    <p class="text-xs text-slate-500 mt-1">直近にDB登録された10種</p>
                </div>

                <div class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    <template x-if="recentSpecies.length === 0">
                        <div class="text-center text-sm text-slate-500 py-10">データがありません</div>
                    </template>

                    <template x-for="(species, index) in recentSpecies" :key="species.scientific_name + species.last_distilled_at">
                        <div class="bg-slate-800/60 p-4 rounded-lg border border-slate-700/50 flex items-center gap-4 transform transition-all duration-500"
                            x-show="true"
                            x-transition:enter="transition ease-out duration-300"
                            x-transition:enter-start="opacity-0 translate-y-4"
                            x-transition:enter-end="opacity-100 translate-y-0">

                            <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 text-slate-400 font-mono text-xs border border-slate-600">
                                <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                            </div>
                            <div class="overflow-hidden">
                                <h3 class="text-sm font-semibold text-slate-200 truncate pr-2 flex items-center gap-2">
                                    <template x-if="species.ja_name">
                                        <span x-text="species.ja_name" class="font-bold text-slate-100"></span>
                                    </template>
                                    <template x-if="!species.ja_name">
                                        <span x-text="species.scientific_name" class="font-bold text-slate-100"></span>
                                    </template>

                                    <a :href="'explore.php?q=' + encodeURIComponent(species.scientific_name)" target="_blank" rel="noopener noreferrer" class="hover:text-cyan-400 hover:underline inline-flex items-center gap-1 transition-colors text-xs text-slate-400 font-mono italic">
                                        <span x-text="species.ja_name ? species.scientific_name : '検索'"></span>
                                        <svg class="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                        </svg>
                                    </a>
                                </h3>
                                <p class="text-xs text-slate-500 mt-1 font-mono flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    <span x-text="formatTime(species.last_distilled_at)"></span>
                                </p>
                            </div>
                        </div>
                    </template>
                </div>
            </div>

        </div>

        <!-- Active Workers Panel -->
        <div class="glass-panel p-6" x-show="activeWorkers.length > 0" x-transition>
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-lg font-semibold text-slate-200 flex items-center gap-2">
                    <span class="relative flex h-2.5 w-2.5">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                    </span>
                    アクティブワーカー
                </h2>
                <div class="flex items-center gap-2">
                    <span class="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded border border-purple-500/30"
                        x-text="activeWorkers.filter(w => w.type === 'writer').length + ' DB書込'"></span>
                    <span class="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded border border-amber-500/30"
                        x-text="activeWorkers.filter(w => w.phase && (w.phase.includes('AI') || w.phase.includes('検証'))).length + ' 推論'"></span>
                    <span class="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30"
                        x-text="activeWorkers.filter(w => w.phase && w.phase.includes('Prefetch')).length + ' 取得'"></span>
                    <span class="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30"
                        x-text="activeWorkers.filter(w => w.phase && w.phase.includes('完了')).length + ' 完了'"></span>
                </div>
            </div>

            <!-- DB Spool Writer -->
            <template x-if="activeWorkers.filter(w => w.type === 'writer').length > 0">
                <div class="mb-4">
                    <div class="text-xs text-purple-400 font-bold tracking-widest mb-2 uppercase flex items-center gap-1.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                        JSONスプールライター (専任DB書込)
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <template x-for="(w, i) in activeWorkers.filter(w => w.type === 'writer')" :key="w.pid">
                            <div class="bg-slate-800/80 p-3 rounded-lg border border-purple-500/30 hover:border-purple-500/50 transition-colors">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-[10px] font-mono text-slate-400 bg-slate-900/50 px-1.5 py-0.5 rounded" x-text="'PID:' + w.pid"></span>
                                    <span class="text-[10px] font-mono text-slate-400" x-text="formatTime(w.updated_at)"></span>
                                </div>
                                <div class="text-sm font-semibold text-purple-300 truncate mb-1.5" x-text="w.status || w.name" :title="w.status || w.name"></div>
                            </div>
                        </template>
                    </div>
                </div>
            </template>

            <!-- AI Extraction Workers -->
            <template x-if="activeWorkers.filter(w => w.phase && (w.phase.includes('AI') || w.phase.includes('検証'))).length > 0">
                <div class="mb-4">
                    <div class="text-xs text-amber-400 font-bold tracking-widest mb-2 uppercase flex items-center gap-1.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        AI推論 / 検証ゲート
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <template x-for="(w, i) in activeWorkers.filter(w => w.phase && (w.phase.includes('AI') || w.phase.includes('検証')))" :key="w.pid">
                            <div class="bg-slate-800/60 p-3 rounded-lg border border-amber-500/20 hover:border-amber-500/40 transition-colors">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-[10px] font-mono text-slate-500 bg-slate-900/50 px-1.5 py-0.5 rounded" x-text="'PID:' + w.pid"></span>
                                    <span class="text-[10px] font-mono text-slate-500" x-text="formatTime(w.updated_at)"></span>
                                </div>
                                <div class="text-sm font-semibold text-slate-200 truncate mb-1.5" x-text="w.species" :title="w.species"></div>
                                <div class="flex items-center gap-1.5">
                                    <span class="w-1.5 h-1.5 rounded-full" :class="phaseColor(w.phase)"></span>
                                    <span class="text-xs font-mono" :class="phaseTextColor(w.phase)" x-text="w.phase"></span>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </template>

            <!-- Prefetcher Workers -->
            <template x-if="activeWorkers.filter(w => w.phase && w.phase.includes('Prefetch')).length > 0">
                <div class="mb-4">
                    <div class="text-xs text-blue-400 font-bold tracking-widest mb-2 uppercase flex items-center gap-1.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        文献プリフェッチ
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                        <template x-for="(w, i) in activeWorkers.filter(w => w.phase && w.phase.includes('Prefetch'))" :key="w.pid">
                            <div class="bg-slate-800/40 p-2 rounded-lg border border-blue-500/10 hover:border-blue-500/30 transition-colors">
                                <div class="flex items-center justify-between mb-1">
                                    <span class="text-[10px] font-mono text-slate-600" x-text="'PID:' + w.pid"></span>
                                    <span class="text-[10px] font-mono text-slate-600" x-text="formatTime(w.updated_at)"></span>
                                </div>
                                <div class="text-xs text-blue-300 truncate" x-text="w.species" :title="w.species"></div>
                            </div>
                        </template>
                    </div>
                </div>
            </template>

            <!-- Completed Workers (compact) -->
            <template x-if="activeWorkers.filter(w => w.phase && w.phase.includes('完了')).length > 0">
                <div>
                    <div class="text-xs text-green-400 font-bold tracking-widest mb-2 uppercase flex items-center gap-1.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                        直近完了
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <template x-for="(w, i) in activeWorkers.filter(w => w.phase && w.phase.includes('完了'))" :key="w.pid">
                            <span class="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded border border-green-500/20 font-mono truncate max-w-[200px]" x-text="w.species" :title="w.species + ' (PID:' + w.pid + ')'"></span>
                        </template>
                    </div>
                </div>
            </template>
        </div>

    </div>

    <!-- Scrollbar Styling -->
    <style>
        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(30, 41, 59, 0.5);
            border-radius: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(71, 85, 105, 0.8);
            border-radius: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(100, 116, 139, 1);
        }
    </style>

    <script nonce="<?= CspNonce::attr() ?>">
        document.addEventListener('alpine:init', () => {
            Alpine.data('omoikaneDashboard', () => ({
                metrics: {
                    queue: {
                        completed: 0,
                        processing: 0,
                        pending: 0,
                        failed: 0,
                        fetching_lit: 0,
                        literature_ready: 0,
                        no_literature: 0,
                        total: 0
                    },
                    sqlite_distilled: 0,
                    total_papers: 0,
                    speed: {
                        per_minute: 0,
                        per_hour: 0
                    },
                    eta_hours: -1,
                    recent_failed: 0,
                },
                recentSpecies: [],
                activeWorkers: [],
                lastUpdate: null,
                refreshInterval: 5000,

                init() {
                    this.fetchStatus();
                    setInterval(() => {
                        this.fetchStatus();
                    }, this.refreshInterval);
                },

                fetchStatus() {
                    fetch('api_omoikane_status.php')
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                this.metrics = data.metrics;
                                this.recentSpecies = data.metrics.recent_species || [];
                                this.activeWorkers = data.metrics.active_workers || [];
                                this.lastUpdate = new Date();
                            }
                        })
                        .catch(err => console.error("Failed to fetch Omoikane status:", err));
                },

                lastUpdateString() {
                    if (!this.lastUpdate) return "";
                    return this.lastUpdate.toLocaleTimeString('ja-JP', {
                        hour12: false
                    });
                },

                formatTime(datetimeStr) {
                    if (!datetimeStr) return '';
                    const d = new Date(datetimeStr);
                    return d.toLocaleTimeString('ja-JP', {
                        hour12: false
                    });
                },

                phaseColor(phase) {
                    if (!phase) return 'bg-slate-400';
                    if (phase.includes('完了')) return 'bg-green-400';
                    if (phase.includes('検証')) return 'bg-purple-400';
                    if (phase.includes('AI')) return 'bg-amber-400 animate-pulse';
                    if (phase.includes('GBIF')) return 'bg-cyan-400';
                    return 'bg-slate-400';
                },

                phaseTextColor(phase) {
                    if (!phase) return 'text-slate-400';
                    if (phase.includes('完了')) return 'text-green-400';
                    if (phase.includes('検証')) return 'text-purple-400';
                    if (phase.includes('AI')) return 'text-amber-400';
                    if (phase.includes('GBIF')) return 'text-cyan-400';
                    return 'text-slate-400';
                }
            }))
        })
    </script>
</body>

</html>
