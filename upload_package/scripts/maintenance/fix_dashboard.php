<?php
// Fix the dashboard worker display - replace flat list with grouped sections
$file = '/home/yamaki/projects/ikimon-platform/upload_package/public_html/omoikane_dashboard.php';
$content = file_get_contents($file);

$old = <<<'OLD'
                <span class="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded" x-text="activeWorkers.length + ' 稼働中'"></span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <template x-for="(w, i) in activeWorkers" :key="w.pid">
                    <div class="bg-slate-800/60 p-3 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-colors">
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
OLD;

$new = <<<'NEW'
                <div class="flex items-center gap-2">
                    <span class="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded border border-amber-500/30"
                          x-text="activeWorkers.filter(w => w.phase && (w.phase.includes('AI') || w.phase.includes('検証'))).length + ' 推論'"></span>
                    <span class="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30"
                          x-text="activeWorkers.filter(w => w.phase && w.phase.includes('Prefetch')).length + ' 取得'"></span>
                    <span class="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30"
                          x-text="activeWorkers.filter(w => w.phase && w.phase.includes('完了')).length + ' 完了'"></span>
                </div>
            </div>

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
NEW;

// Normalize line endings for matching
$content = str_replace("\r\n", "\n", $content);
$old = str_replace("\r\n", "\n", $old);

if (strpos($content, $old) !== false) {
    $content = str_replace($old, $new, $content);
    file_put_contents($file, $content);
    echo "SUCCESS: Dashboard updated!\n";
} else {
    echo "FAILED: Could not find target section.\n";
    // Debug: show what's around line 269
    $lines = file($file);
    for ($i = 266; $i < 290 && $i < count($lines); $i++) {
        echo ($i + 1) . ': ' . $lines[$i];
    }
}
