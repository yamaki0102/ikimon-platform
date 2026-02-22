<?php
$queueFile = __DIR__ . '/../data/library/extraction_queue.json';
$q = json_decode(file_get_contents($queueFile), true) ?: [];
$c = 0;
$p = 0;
$pend = 0;
$f = 0;
foreach ($q as $v) {
    if ($v['status'] === 'completed') $c++;
    elseif ($v['status'] === 'processing') $p++;
    elseif ($v['status'] === 'pending') $pend++;
    elseif ($v['status'] === 'failed') $f++;
}
echo "Queue Status:\n";
echo "- Completed: $c\n- Processing: $p\n- Pending: $pend\n- Failed: $f\n\n";

require_once __DIR__ . '/../libs/OmoikaneDB.php';
$db = new OmoikaneDB();
$pdo = $db->getPDO();
$count = $pdo->query("SELECT COUNT(*) FROM species WHERE distillation_status='distilled'")->fetchColumn();
echo "SQLite 'distilled' species count: $count\n\n";

// Calculate speed for recent entries only (last 5 minutes)
$recentRates = $pdo->query("SELECT last_distilled_at FROM species WHERE distillation_status='distilled' AND last_distilled_at > datetime('now', '-5 minutes') ORDER BY last_distilled_at ASC")->fetchAll(PDO::FETCH_COLUMN);
echo "Recent (last 5 min) distilled: " . count($recentRates) . "\n";
if (count($recentRates) > 1) {
    $first = strtotime($recentRates[0]);
    $last = strtotime($recentRates[count($recentRates) - 1]);
    $diff = $last - $first;
    if ($diff > 0) {
        $ratePerSecond = count($recentRates) / $diff;
        echo sprintf("Recent Speed:\n");
        echo sprintf("- %.2f species / minute\n", $ratePerSecond * 60);
        echo sprintf("- %.2f species / hour\n", $ratePerSecond * 3600);
    }
}
