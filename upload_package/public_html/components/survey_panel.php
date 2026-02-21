<?php
// components/survey_panel.php
// Requires $activeSurvey (array|null) to be available in scope
// Usage: include __DIR__ . '/components/survey_panel.php';
?>

<?php if ($activeSurvey): ?>
    <?php
    $start = strtotime($activeSurvey['started_at']);
    $now = time();
    $elapsedSec = $now - $start;
    $elapsedMin = floor($elapsedSec / 60);
    $elapsedHrs = floor($elapsedMin / 60);
    $displayMin = $elapsedMin % 60;
    ?>
    <div class="max-w-5xl mx-auto px-4 md:px-6 relative z-20" style="margin-bottom:var(--phi-xl)">
        <a href="survey.php" class="block bg-gradient-to-r from-emerald-900 to-slate-900 rounded-xl p-4 text-white shadow-lg relative overflow-hidden group">
            <!-- Decoration -->
            <div class="absolute top-0 right-0 w-24 h-24 bg-emerald-500/20 blur-2xl rounded-full group-hover:bg-emerald-500/30 transition-colors"></div>

            <div class="flex items-center justify-between relative z-10">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <div class="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-xl shadow-lg relative">
                            ⏱️
                        </div>
                    </div>
                    <div>
                        <div class="text-xs text-emerald-300 font-bold uppercase tracking-wider mb-0.5">Live Survey</div>
                        <div class="font-mono font-bold text-xl leading-none">
                            <?= sprintf('%02d:%02d', $elapsedHrs, $displayMin) ?>
                            <span class="text-xs font-sans font-normal text-slate-400 ml-1">経過</span>
                        </div>
                    </div>
                </div>

                <div class="text-right">
                    <div class="text-2xl font-bold leading-none"><?= $activeSurvey['stats']['obs_count'] ?? 0 ?></div>
                    <div class="text-[10px] text-slate-400 uppercase">Records</div>
                </div>
            </div>
        </a>
    </div>
<?php else: ?>
    <!-- Invite to start survey -->
    <div class="max-w-5xl mx-auto px-4 md:px-6 relative z-20" style="margin-bottom:var(--phi-xl)">
        <a href="survey.php" class="block bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 hover:shadow-md hover:border-emerald-400 transition-all group">
            <div class="flex items-center justify-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition">
                    <i data-lucide="compass" class="w-5 h-5 text-emerald-600"></i>
                </div>
                <span class="font-bold text-emerald-700 text-sm">🚀 調査セッションを開始</span>
                <i data-lucide="chevron-right" class="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform"></i>
            </div>
        </a>
    </div>
<?php endif; ?>