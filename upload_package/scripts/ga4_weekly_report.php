<?php
declare(strict_types=1);

/**
 * GA4 週次レポート ランナー
 *
 * 使い方:
 *   php ga4_weekly_report.php              # GA4_SITES に定義された全サイトを実行
 *   php ga4_weekly_report.php ikimon       # slug が "ikimon" のサイトのみ実行
 *
 * Cron (毎週月曜 9:00 JST = 0:00 UTC):
 *   0 0 * * 1 php /var/www/ikimon.life/repo/upload_package/scripts/ga4_weekly_report.php >> /var/log/ikimon/ga4_report.log 2>&1
 *
 * サイト設定は secret.php の GA4_SITES 配列で管理する。
 * 設定例は upload_package/config/secret.php.example を参照。
 */

require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/GA4Reporter.php';

// ── サイト設定チェック ────────────────────────────────────────────────────────
if (!defined('GA4_SITES') || !is_array(GA4_SITES) || count(GA4_SITES) === 0) {
    fwrite(STDERR, "[ERROR] GA4_SITES が secret.php に未設定です\n");
    fwrite(STDERR, "        設定例: upload_package/config/secret.php.example\n");
    exit(1);
}

// ── 実行対象サイトを決定 ──────────────────────────────────────────────────────
$targetSlug = $argv[1] ?? null;

if ($targetSlug !== null) {
    $sites = array_filter(GA4_SITES, fn($s) => ($s['slug'] ?? '') === $targetSlug);
    if (count($sites) === 0) {
        fwrite(STDERR, "[ERROR] slug '{$targetSlug}' に一致するサイトが見つかりません\n");
        fwrite(STDERR, "        登録済み slug: " . implode(', ', array_column(GA4_SITES, 'slug')) . "\n");
        exit(1);
    }
} else {
    $sites = GA4_SITES;
}

// ── 全サイトのレポートを順次実行 ──────────────────────────────────────────────
$results  = [];
$total    = count($sites);
$success  = 0;
$failed   = 0;

echo "[INFO] " . date('Y-m-d H:i:s') . " レポート生成開始 ({$total}サイト)\n";
echo str_repeat('─', 50) . "\n";

foreach ($sites as $site) {
    $slug = $site['slug'] ?? '?';
    $name = $site['name'] ?? $slug;

    echo "[RUN]  {$name} ({$slug})\n";
    $result = GA4Reporter::run($site);
    $results[] = $result;

    if ($result['success']) {
        echo "[OK]   {$name} → {$result['report_file']}\n";
        $success++;
    } else {
        fwrite(STDERR, "[FAIL] {$name}: {$result['error']}\n");
        $failed++;
    }
}

// ── サマリー出力 ──────────────────────────────────────────────────────────────
echo str_repeat('─', 50) . "\n";
echo "[DONE] 完了: {$success}成功 / {$failed}失敗 / {$total}サイト\n";

exit($failed > 0 ? 1 : 0);
