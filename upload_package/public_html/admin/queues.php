<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/AiAssessmentQueue.php';
require_once __DIR__ . '/../../libs/EmbeddingQueue.php';
require_once __DIR__ . '/../../libs/ObservationRecalcQueue.php';
require_once __DIR__ . '/../../libs/AsyncJobMetrics.php';
require_once __DIR__ . '/../../libs/QueueHealthNotifier.php';

Auth::init();
Auth::requireRole('Analyst');

$currentUser = Auth::user();
$adminPage = 'queues';
$pendingFlags = 0;

$snapshots = [
    'ai_assessment' => AiAssessmentQueue::snapshot(),
    'embedding' => EmbeddingQueue::snapshot(),
    'observation_recalc' => ObservationRecalcQueue::snapshot(),
];
$postLatency = AsyncJobMetrics::summarizePostLatency(20);
$queueRuns = AsyncJobMetrics::summarizeQueueRuns(30);
$recentQueueRuns = AsyncJobMetrics::getRecentQueueRuns(12);
$recentPosts = AsyncJobMetrics::getRecentPostRequests(12);
$recentAlerts = QueueHealthNotifier::getRecentAlerts(12);
$activeQueue = trim((string)($_GET['queue'] ?? ''));

function queueLabel(string $queue): string
{
    return match ($queue) {
        'ai_assessment' => 'AI Assessment',
        'embedding' => 'Embedding',
        'observation_recalc' => 'Observation Recalc',
        default => $queue,
    };
}

function formatSeconds(int $seconds): string
{
    if ($seconds <= 0) return '0s';
    if ($seconds < 60) return $seconds . 's';
    if ($seconds < 3600) return floor($seconds / 60) . 'm ' . ($seconds % 60) . 's';
    return floor($seconds / 3600) . 'h ' . floor(($seconds % 3600) / 60) . 'm';
}

function metricTone(int $value, int $warn, int $danger): string
{
    if ($value >= $danger) return 'text-red-400';
    if ($value >= $warn) return 'text-yellow-400';
    return 'text-emerald-400';
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php $adminTitle = 'Job Monitor'; include __DIR__ . '/components/head.php'; ?>
</head>
<body class="flex h-screen overflow-hidden">
<?php include __DIR__ . '/components/sidebar.php'; ?>
<main class="flex-1 overflow-y-auto p-8">
    <header class="flex items-start justify-between gap-4 mb-8">
        <div>
            <h1 class="text-2xl font-bold">Job Monitor</h1>
            <p class="text-sm text-slate-400 mt-2">AI / embedding / recalc の滞留、失敗、投稿レイテンシを同じ画面で監視する。</p>
        </div>
        <a href="index.php" class="px-4 py-2 bg-slate-800 rounded-lg text-sm font-bold hover:bg-slate-700 transition">Dashboardへ戻る</a>
    </header>

    <div class="grid md:grid-cols-4 gap-4 mb-8">
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <p class="text-slate-400 text-xs font-bold uppercase mb-2">最新投稿</p>
            <p class="text-3xl font-black <?php echo metricTone((int)$postLatency['latest_ms'], 2500, 4000); ?>"><?php echo (int)$postLatency['latest_ms']; ?><span class="text-base ml-1">ms</span></p>
            <p class="text-xs text-slate-500 mt-1">直近1件</p>
        </div>
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <p class="text-slate-400 text-xs font-bold uppercase mb-2">平均投稿</p>
            <p class="text-3xl font-black <?php echo metricTone((int)$postLatency['avg_ms'], 1800, 2500); ?>"><?php echo (int)$postLatency['avg_ms']; ?><span class="text-base ml-1">ms</span></p>
            <p class="text-xs text-slate-500 mt-1">直近<?php echo (int)$postLatency['count']; ?>件</p>
        </div>
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <p class="text-slate-400 text-xs font-bold uppercase mb-2">アクティブアラート</p>
            <p class="text-3xl font-black <?php echo count($recentAlerts) > 0 ? 'text-red-400' : 'text-emerald-400'; ?>"><?php echo count($recentAlerts); ?></p>
            <p class="text-xs text-slate-500 mt-1">直近12件</p>
        </div>
        <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <p class="text-slate-400 text-xs font-bold uppercase mb-2">最長滞留</p>
            <?php $maxOldest = max(array_map(static fn(array $snapshot): int => (int)($snapshot['oldest_pending_seconds'] ?? 0), $snapshots)); ?>
            <p class="text-3xl font-black <?php echo metricTone($maxOldest, 900, 1800); ?>"><?php echo htmlspecialchars(formatSeconds($maxOldest)); ?></p>
            <p class="text-xs text-slate-500 mt-1">全キュー横断</p>
        </div>
    </div>

    <div class="grid lg:grid-cols-3 gap-4 mb-8">
        <?php foreach ($snapshots as $queue => $snapshot): ?>
            <?php $queueRun = $queueRuns[$queue] ?? ['runs' => 0, 'failed' => 0, 'processed' => 0, 'latest_duration_ms' => 0]; ?>
            <section class="bg-slate-800 rounded-2xl border border-slate-700 p-5 <?php echo $activeQueue === $queue ? 'ring-2 ring-emerald-400/40' : ''; ?>">
                <div class="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <h2 class="font-bold"><?php echo htmlspecialchars(queueLabel($queue)); ?></h2>
                        <p class="text-xs text-slate-500 mt-1">latest run <?php echo (int)$queueRun['latest_duration_ms']; ?>ms</p>
                    </div>
                    <a href="?queue=<?php echo urlencode($queue); ?>" class="text-xs text-emerald-400 hover:underline">focus</a>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="rounded-xl bg-slate-900/70 p-3">
                        <p class="text-[11px] text-slate-500 uppercase font-bold">pending</p>
                        <p class="text-2xl font-black <?php echo metricTone((int)$snapshot['pending'], 3, 10); ?>"><?php echo (int)$snapshot['pending']; ?></p>
                    </div>
                    <div class="rounded-xl bg-slate-900/70 p-3">
                        <p class="text-[11px] text-slate-500 uppercase font-bold">failed</p>
                        <p class="text-2xl font-black <?php echo metricTone((int)$snapshot['failed'], 1, 3); ?>"><?php echo (int)$snapshot['failed']; ?></p>
                    </div>
                    <div class="rounded-xl bg-slate-900/70 p-3">
                        <p class="text-[11px] text-slate-500 uppercase font-bold">oldest</p>
                        <p class="text-xl font-black <?php echo metricTone((int)$snapshot['oldest_pending_seconds'], 900, 1800); ?>"><?php echo htmlspecialchars(formatSeconds((int)$snapshot['oldest_pending_seconds'])); ?></p>
                    </div>
                    <div class="rounded-xl bg-slate-900/70 p-3">
                        <p class="text-[11px] text-slate-500 uppercase font-bold">runs / processed</p>
                        <p class="text-xl font-black text-cyan-400"><?php echo (int)$queueRun['runs']; ?> / <?php echo (int)$queueRun['processed']; ?></p>
                    </div>
                </div>
                <?php if (!empty($snapshot['by_lane'])): ?>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <?php foreach ($snapshot['by_lane'] as $lane => $count): ?>
                            <span class="inline-flex items-center rounded-full bg-slate-900/60 border border-slate-700 px-3 py-1 text-xs text-slate-300"><?php echo htmlspecialchars($lane); ?> <?php echo (int)$count; ?></span>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </section>
        <?php endforeach; ?>
    </div>

    <div class="grid xl:grid-cols-2 gap-6">
        <section class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div class="p-6 border-b border-slate-700">
                <h3 class="font-bold">Recent Alerts</h3>
            </div>
            <div class="divide-y divide-slate-700">
                <?php if ($recentAlerts === []): ?>
                    <div class="p-6 text-sm text-slate-500">直近のアラートはありません。</div>
                <?php else: ?>
                    <?php foreach ($recentAlerts as $alert): ?>
                        <div class="p-5">
                            <div class="flex items-center justify-between gap-3">
                                <p class="font-bold text-red-400"><?php echo htmlspecialchars($alert['title'] ?? 'Alert'); ?></p>
                                <span class="text-xs text-slate-500"><?php echo htmlspecialchars($alert['created_at'] ?? ''); ?></span>
                            </div>
                            <p class="text-sm text-slate-300 mt-2"><?php echo htmlspecialchars($alert['message'] ?? ''); ?></p>
                            <p class="text-xs text-slate-500 mt-2"><?php echo htmlspecialchars($alert['queue'] ?? ''); ?> / <?php echo htmlspecialchars($alert['kind'] ?? ''); ?></p>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </section>

        <section class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div class="p-6 border-b border-slate-700">
                <h3 class="font-bold">Recent Post Latency</h3>
            </div>
            <table class="w-full text-sm text-left">
                <thead class="text-xs text-slate-400 uppercase bg-slate-900/50">
                    <tr>
                        <th class="px-6 py-4">Time</th>
                        <th class="px-6 py-4">Obs</th>
                        <th class="px-6 py-4">Duration</th>
                        <th class="px-6 py-4">Queued</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-700">
                    <?php if ($recentPosts === []): ?>
                        <tr><td class="px-6 py-6 text-slate-500" colspan="4">まだ投稿計測がありません。</td></tr>
                    <?php else: ?>
                        <?php foreach ($recentPosts as $item): ?>
                            <tr>
                                <td class="px-6 py-4 text-slate-400"><?php echo htmlspecialchars($item['created_at'] ?? ''); ?></td>
                                <td class="px-6 py-4 font-mono text-xs"><?php echo htmlspecialchars((string)($item['observation_id'] ?? '')); ?></td>
                                <td class="px-6 py-4 <?php echo metricTone((int)($item['duration_ms'] ?? 0), 2500, 4000); ?>"><?php echo (int)($item['duration_ms'] ?? 0); ?> ms</td>
                                <td class="px-6 py-4 text-slate-300"><?php echo !empty($item['ai_planned']) ? 'AI ' : ''; ?><?php echo !empty($item['embedding_planned']) ? 'Emb' : ''; ?></td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </section>
    </div>

    <section class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden mt-6">
        <div class="p-6 border-b border-slate-700">
            <h3 class="font-bold">Recent Queue Runs</h3>
        </div>
        <table class="w-full text-sm text-left">
            <thead class="text-xs text-slate-400 uppercase bg-slate-900/50">
                <tr>
                    <th class="px-6 py-4">Time</th>
                    <th class="px-6 py-4">Queue</th>
                    <th class="px-6 py-4">Processed</th>
                    <th class="px-6 py-4">Failed</th>
                    <th class="px-6 py-4">Oldest Pending</th>
                    <th class="px-6 py-4">Duration</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-700">
                <?php
                $filteredRuns = $activeQueue !== ''
                    ? array_values(array_filter($recentQueueRuns, static fn(array $run): bool => ($run['queue'] ?? '') === $activeQueue))
                    : $recentQueueRuns;
                ?>
                <?php if ($filteredRuns === []): ?>
                    <tr><td class="px-6 py-6 text-slate-500" colspan="6">表示できるジョブ実行履歴がありません。</td></tr>
                <?php else: ?>
                    <?php foreach ($filteredRuns as $run): ?>
                        <?php $snapshot = is_array($run['queue_snapshot'] ?? null) ? $run['queue_snapshot'] : []; ?>
                        <tr>
                            <td class="px-6 py-4 text-slate-400"><?php echo htmlspecialchars($run['created_at'] ?? ''); ?></td>
                            <td class="px-6 py-4 font-bold"><?php echo htmlspecialchars((string)($run['queue'] ?? '')); ?></td>
                            <td class="px-6 py-4 text-cyan-400"><?php echo (int)($run['processed'] ?? 0); ?></td>
                            <td class="px-6 py-4 <?php echo metricTone((int)($run['failed'] ?? 0), 1, 3); ?>"><?php echo (int)($run['failed'] ?? 0); ?></td>
                            <td class="px-6 py-4"><?php echo htmlspecialchars(formatSeconds((int)($snapshot['oldest_pending_seconds'] ?? 0))); ?></td>
                            <td class="px-6 py-4"><?php echo (int)($run['duration_ms'] ?? 0); ?> ms</td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </section>
</main>
<script nonce="<?= CspNonce::attr() ?>">lucide.createIcons();</script>
</body>
</html>
