<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/ContributionLedger.php';
Auth::init();
Auth::requireRole('Analyst');

$currentUser = Auth::user();
$sessionId = trim((string)($_GET['session_id'] ?? ''));
$recentSessions = ContributionLedger::listRecentSessions(30);
if ($sessionId === '' && !empty($recentSessions)) {
    $sessionId = (string)$recentSessions[0]['session_id'];
}
$selectedSession = $sessionId !== '' ? ContributionLedger::getSessionDebug($sessionId) : null;
$community = ContributionLedger::getCommunitySnapshot();

function h($value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php $adminTitle = 'FieldScan 解析';
    include __DIR__ . '/components/head.php'; ?>
</head>

<body class="flex h-screen overflow-hidden">
    <?php $adminPage = 'fieldscan';
    include __DIR__ . '/components/sidebar.php'; ?>

    <main class="flex-1 overflow-y-auto p-6 md:p-8">
        <header class="flex flex-col gap-3 mb-6 md:flex-row md:items-end md:justify-between">
            <div>
                <h1 class="text-2xl font-bold">FieldScan 解析</h1>
                <p class="text-sm text-slate-400 mt-1">室内テスト直後に、セッション ledger と raw log をまとめて確認するための画面。</p>
            </div>
            <div class="flex flex-wrap gap-2 text-xs">
                <a href="../api/v2/fieldscan_debug.php?limit=30" target="_blank" rel="noopener noreferrer" class="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition">JSON 一覧</a>
                <?php if ($sessionId !== ''): ?>
                    <a href="../api/v2/fieldscan_debug.php?session_id=<?php echo urlencode($sessionId); ?>" target="_blank" rel="noopener noreferrer" class="px-3 py-2 rounded-lg bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition">選択セッション JSON</a>
                <?php endif; ?>
            </div>
        </header>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">累計セッション</p>
                <p class="text-3xl font-black text-emerald-400"><?php echo number_format((int)$community['total_sessions']); ?></p>
            </div>
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">累計観測時間</p>
                <p class="text-3xl font-black text-cyan-400"><?php echo h($community['total_effort_hours']); ?><span class="text-sm text-slate-500 ml-1">h</span></p>
            </div>
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">観測枠</p>
                <p class="text-3xl font-black text-violet-400"><?php echo number_format((int)$community['total_coverage_slots']); ?></p>
            </div>
            <div class="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">参加者数</p>
                <p class="text-3xl font-black text-amber-400"><?php echo number_format((int)$community['contributor_count']); ?></p>
            </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-[440px_minmax(0,1fr)] gap-6">
            <section class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                <div class="p-5 border-b border-slate-700 flex items-center justify-between">
                    <div>
                        <h2 class="font-bold">最近のセッション</h2>
                        <p class="text-xs text-slate-400 mt-1">室内で2回連続テストしたら、この一覧で差分を追える。</p>
                    </div>
                </div>
                <div class="divide-y divide-slate-700">
                    <?php if (empty($recentSessions)): ?>
                        <div class="p-6 text-sm text-slate-500">まだ ledger にセッションがない。</div>
                    <?php else: ?>
                        <?php foreach ($recentSessions as $row): ?>
                            <?php $isActive = $sessionId === (string)$row['session_id']; ?>
                            <a href="?session_id=<?php echo urlencode((string)$row['session_id']); ?>" class="block p-4 transition <?php echo $isActive ? 'bg-emerald-500/10' : 'hover:bg-slate-700/40'; ?>">
                                <div class="flex items-start justify-between gap-3">
                                    <div class="min-w-0">
                                        <p class="font-mono text-xs text-slate-300 truncate"><?php echo h($row['session_id']); ?></p>
                                        <p class="text-xs text-slate-500 mt-1"><?php echo h(date('Y-m-d H:i:s', strtotime((string)($row['ended_at'] ?? $row['updated_at'] ?? 'now')))); ?></p>
                                    </div>
                                    <div class="flex flex-col items-end gap-1">
                                        <span class="text-[10px] px-2 py-1 rounded-full <?php echo $isActive ? 'bg-emerald-400 text-black' : 'bg-slate-700 text-slate-300'; ?>">
                                            <?php echo h($row['scan_mode'] ?: 'walk'); ?>
                                        </span>
                                        <span class="text-[10px] px-2 py-1 rounded-full <?php echo !empty($row['official_record']) ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300'; ?>">
                                            <?php echo !empty($row['official_record']) ? '本番' : 'テスト'; ?>
                                        </span>
                                    </div>
                                </div>
                                <div class="grid grid-cols-4 gap-2 mt-3 text-xs">
                                    <div>
                                        <p class="text-slate-500">分</p>
                                        <p class="font-bold"><?php echo number_format((int)round(((int)$row['duration_sec']) / 60)); ?></p>
                                    </div>
                                    <div>
                                        <p class="text-slate-500">点</p>
                                        <p class="font-bold"><?php echo number_format((int)$row['data_point_count']); ?></p>
                                    </div>
                                    <div>
                                        <p class="text-slate-500">新枠</p>
                                        <p class="font-bold text-emerald-400"><?php echo number_format((int)$row['new_coverage_slot_count']); ?></p>
                                    </div>
                                    <div>
                                        <p class="text-slate-500">再訪</p>
                                        <p class="font-bold text-cyan-400"><?php echo number_format((int)$row['revisit_mesh_count']); ?></p>
                                    </div>
                                </div>
                            </a>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </section>

            <section class="space-y-6">
                <?php if (!$selectedSession): ?>
                    <div class="bg-slate-800 rounded-2xl border border-slate-700 p-6 text-slate-400">
                        解析対象のセッションがまだない。
                    </div>
                <?php else: ?>
                    <?php
                    $ledger = $selectedSession['ledger'];
                    $summary = $ledger['summary'] ?? [];
                    $derived = $selectedSession['derived'] ?? [];
                    $topSpecies = $derived['top_species'] ?? [];
                    $observationTypes = $derived['observation_types'] ?? [];
                    ?>
                    <div class="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                                <p class="text-xs uppercase tracking-wide text-slate-500">Selected Session</p>
                                <h2 class="font-mono text-sm mt-1 break-all"><?php echo h($ledger['session_id']); ?></h2>
                                <p class="text-xs text-slate-400 mt-2"><?php echo h((string)$ledger['started_at']); ?> から <?php echo h((string)$ledger['ended_at']); ?></p>
                                <p class="text-xs mt-2 <?php echo !empty($ledger['official_record']) ? 'text-emerald-300' : 'text-sky-300'; ?>">
                                    <?php echo !empty($ledger['official_record']) ? '🌿 フィールド記録' : '🧪 動作チェック'; ?>
                                </p>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700">
                                    <p class="text-slate-500">archive</p>
                                    <p class="font-bold"><?php echo h($ledger['archive_value_score']); ?></p>
                                </div>
                                <div class="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700">
                                    <p class="text-slate-500">coverage</p>
                                    <p class="font-bold"><?php echo h($ledger['community_coverage_gain']); ?></p>
                                </div>
                                <div class="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700">
                                    <p class="text-slate-500">repeat</p>
                                    <p class="font-bold"><?php echo h($ledger['repeatability_score']); ?></p>
                                </div>
                                <div class="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700">
                                    <p class="text-slate-500">effort</p>
                                    <p class="font-bold"><?php echo h($ledger['effort_quality_score']); ?></p>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                            <div><p class="text-slate-500 text-xs">時間</p><p class="text-2xl font-black"><?php echo number_format((int)round(((int)$ledger['duration_sec']) / 60)); ?><span class="text-sm text-slate-500 ml-1">分</span></p></div>
                            <div><p class="text-slate-500 text-xs">距離</p><p class="text-2xl font-black"><?php echo number_format((float)$ledger['distance_m'] / 1000, 1); ?><span class="text-sm text-slate-500 ml-1">km</span></p></div>
                            <div><p class="text-slate-500 text-xs">データ点</p><p class="text-2xl font-black"><?php echo number_format((int)$ledger['data_point_count']); ?></p></div>
                            <div><p class="text-slate-500 text-xs">新規枠</p><p class="text-2xl font-black text-emerald-400"><?php echo number_format((int)$ledger['new_coverage_slot_count']); ?></p></div>
                            <div><p class="text-slate-500 text-xs">再訪メッシュ</p><p class="text-2xl font-black text-cyan-400"><?php echo number_format((int)$ledger['revisit_mesh_count']); ?></p></div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="bg-slate-800 rounded-2xl border border-slate-700 p-5">
                            <h3 class="font-bold mb-4">今回たまったデータ</h3>
                            <div class="space-y-3 text-sm">
                                <?php foreach (($summary['data_collected'] ?? []) as $item): ?>
                                    <div class="flex items-center justify-between gap-3">
                                        <span class="text-slate-400"><?php echo h($item['label'] ?? ''); ?></span>
                                        <span class="font-bold"><?php echo h($item['value'] ?? '0'); ?><?php echo h($item['unit'] ?? ''); ?></span>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                        <div class="bg-slate-800 rounded-2xl border border-slate-700 p-5">
                            <h3 class="font-bold mb-4">今日の前進</h3>
                            <div class="space-y-3 text-sm">
                                <?php foreach (($summary['contribution_impact'] ?? []) as $item): ?>
                                    <div class="flex gap-3">
                                        <span><?php echo h($item['icon'] ?? '•'); ?></span>
                                        <span class="text-slate-300"><?php echo h($item['text'] ?? ''); ?></span>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                        <div class="bg-slate-800 rounded-2xl border border-slate-700 p-5">
                            <h3 class="font-bold mb-4">みんなの前進</h3>
                            <div class="space-y-3 text-sm">
                                <?php foreach (($summary['community_progress'] ?? []) as $item): ?>
                                    <div class="flex gap-3">
                                        <span><?php echo h($item['icon'] ?? '•'); ?></span>
                                        <span class="text-slate-300"><?php echo h($item['text'] ?? ''); ?></span>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="bg-slate-800 rounded-2xl border border-slate-700 p-5">
                            <h3 class="font-bold mb-4">テスト確認サマリー</h3>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p class="text-slate-500 text-xs">passive logs</p>
                                    <p class="font-bold"><?php echo number_format((int)($derived['passive_log_count'] ?? 0)); ?></p>
                                </div>
                                <div>
                                    <p class="text-slate-500 text-xs">environment logs</p>
                                    <p class="font-bold"><?php echo number_format((int)($derived['environment_log_count'] ?? 0)); ?></p>
                                </div>
                                <div>
                                    <p class="text-slate-500 text-xs">observations</p>
                                    <p class="font-bold"><?php echo number_format((int)($derived['observation_count'] ?? 0)); ?></p>
                                </div>
                                <div>
                                    <p class="text-slate-500 text-xs">route points</p>
                                    <p class="font-bold"><?php echo number_format((int)($derived['route_point_count'] ?? 0)); ?></p>
                                </div>
                            </div>

                            <div class="mt-5">
                                <p class="text-slate-500 text-xs mb-2">observation types</p>
                                <div class="flex flex-wrap gap-2">
                                    <?php foreach ($observationTypes as $type => $count): ?>
                                        <span class="px-2 py-1 rounded-full bg-slate-700 text-xs"><?php echo h($type); ?>: <?php echo number_format((int)$count); ?></span>
                                    <?php endforeach; ?>
                                    <?php if (empty($observationTypes)): ?>
                                        <span class="text-sm text-slate-500">まだ観測なし</span>
                                    <?php endif; ?>
                                </div>
                            </div>

                            <div class="mt-5">
                                <p class="text-slate-500 text-xs mb-2">top species</p>
                                <div class="space-y-2 text-sm">
                                    <?php foreach ($topSpecies as $name => $count): ?>
                                        <div class="flex items-center justify-between">
                                            <span class="text-slate-300"><?php echo h($name); ?></span>
                                            <span class="font-bold"><?php echo number_format((int)$count); ?></span>
                                        </div>
                                    <?php endforeach; ?>
                                    <?php if (empty($topSpecies)): ?>
                                        <span class="text-sm text-slate-500">種検出がなくても ledger は確認できる。</span>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>

                        <div class="bg-slate-800 rounded-2xl border border-slate-700 p-5">
                            <h3 class="font-bold mb-4">室内テストで見るポイント</h3>
                            <ol class="space-y-3 text-sm text-slate-300 list-decimal list-inside">
                                <li>1回目で `passive logs / environment logs / route points` が 0 でないか。</li>
                                <li>種が 0 件でも `データ点` と `今日の前進` が返るか。</li>
                                <li>同じ部屋で2回目を回して `新規枠` が減り `再訪メッシュ` が増えるか。</li>
                                <li>選択セッション JSON を開いて final batch が記録されているか。</li>
                            </ol>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <details class="bg-slate-800 rounded-2xl border border-slate-700 p-5" open>
                            <summary class="font-bold cursor-pointer">passive logs</summary>
                            <pre class="mt-4 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap"><?php echo h(json_encode($selectedSession['passive_logs'] ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
                        </details>
                        <details class="bg-slate-800 rounded-2xl border border-slate-700 p-5">
                            <summary class="font-bold cursor-pointer">environment logs</summary>
                            <pre class="mt-4 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap"><?php echo h(json_encode($selectedSession['environment_logs'] ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
                        </details>
                        <details class="bg-slate-800 rounded-2xl border border-slate-700 p-5">
                            <summary class="font-bold cursor-pointer">observation samples</summary>
                            <pre class="mt-4 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap"><?php echo h(json_encode($selectedSession['observation_samples'] ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); ?></pre>
                        </details>
                    </div>
                <?php endif; ?>
            </section>
        </div>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>
