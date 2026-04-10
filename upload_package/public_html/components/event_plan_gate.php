<?php
/**
 * event_plan_gate.php — プラン判定 + アップグレード CTA 共通コンポーネント
 *
 * 呼び出し側で $planContext を設定してから include する:
 *   $planContext = [
 *       'canAdvanced' => bool,
 *       'canSpecies'  => bool,
 *       'plan'        => string,
 *   ];
 */

$planContext = $planContext ?? [
    'canAdvanced' => false,
    'canSpecies'  => false,
    'plan'        => 'community',
];

$_canAdvanced = !empty($planContext['canAdvanced']);
$_canSpecies  = !empty($planContext['canSpecies']);
$_plan        = $planContext['plan'] ?? 'community';
?>
<script>
    window.__planGate = {
        canAdvanced: <?php echo $_canAdvanced ? 'true' : 'false'; ?>,
        canSpecies: <?php echo $_canSpecies ? 'true' : 'false'; ?>,
        plan: <?php echo json_encode($_plan, JSON_HEX_TAG | JSON_HEX_AMP); ?>
    };
</script>
<?php if (!$_canAdvanced): ?>
<div class="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900">
    <h3 class="font-bold text-sky-800 mb-2">Public プランで使える成果物</h3>
    <ul class="space-y-1.5 text-sky-700">
        <li class="flex items-center gap-2"><i data-lucide="file-text" class="w-4 h-4"></i>正式イベントレポート PDF</li>
        <li class="flex items-center gap-2"><i data-lucide="table" class="w-4 h-4"></i>種リスト CSV / XLSX</li>
        <li class="flex items-center gap-2"><i data-lucide="shield-check" class="w-4 h-4"></i>希少種配慮付き内部版レポート</li>
        <li class="flex items-center gap-2"><i data-lucide="award" class="w-4 h-4"></i>助成金・事業報告に提出可能な品質</li>
    </ul>
    <a href="pricing.php" class="mt-3 inline-flex items-center gap-1 text-sky-600 font-bold text-sm hover:underline">
        Public プランについて <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
    </a>
</div>
<?php endif; ?>
