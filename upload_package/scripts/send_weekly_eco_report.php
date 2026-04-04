<?php
/**
 * 連理の木の下で — 週次生態レポート送信スクリプト
 *
 * 全登録サイトのツインスナップショットを集約し、
 * yamaki0102@gmail.com へ HTML メールで送信。
 *
 * Cron 設定 (Xserver VPS):
 *   0 8 * * 1 php /var/www/ikimon.life/repo/upload_package/scripts/send_weekly_eco_report.php
 *   (毎週月曜 AM8時)
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/SiteTwinSnapshot.php';
require_once __DIR__ . '/../libs/WeatherContext.php';

$TO      = 'yamaki0102@gmail.com';
$FROM    = 'ikimon.life <yamaki0102@gmail.com>';
$SUBJECT = '連理の木の下で — ' . date('n月j日') . '週の生態レポート';

// --- データ収集 ---
$sites = SiteManager::listAll();
$siteReports = [];
$totalSpecies = 0;
$totalObs = 0;
$globalAnomalies = [];
$globalGained = [];
$globalLost = [];

foreach ($sites as $site) {
    $snapshot = SiteTwinSnapshot::getLatest($site['id']);
    if (!$snapshot) {
        $snapshot = SiteTwinSnapshot::generate($site['id']);
    }
    if (!$snapshot) continue;

    $siteReports[] = $snapshot;
    $totalSpecies += count($snapshot['species_state'] ?? []);
    $totalObs += $snapshot['activity']['total_observations'] ?? 0;

    if (!empty($snapshot['comparison']['species_gained'])) {
        foreach ($snapshot['comparison']['species_gained'] as $sp) {
            $globalGained[] = ['species' => $sp, 'site' => $site['name']];
        }
    }
    if (!empty($snapshot['comparison']['species_lost'])) {
        foreach ($snapshot['comparison']['species_lost'] as $sp) {
            $globalLost[] = ['species' => $sp, 'site' => $site['name']];
        }
    }
}

// --- HTML メール生成 ---
$html = buildEmailHtml($siteReports, $totalSpecies, $totalObs, $globalGained, $globalLost);

// --- 送信 ---
$headers = implode("\r\n", [
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'From: ' . $FROM,
    'X-Mailer: ikimon.life EcoReport/1.0',
]);

$sent = mail($TO, '=?UTF-8?B?' . base64_encode($SUBJECT) . '?=', $html, $headers);
echo ($sent ? 'OK' : 'FAIL') . ' — ' . date('Y-m-d H:i:s') . "\n";

// ----------

function buildEmailHtml(array $siteReports, int $totalSpecies, int $totalObs, array $gained, array $lost): string
{
    $week = date('Y年n月j日');
    $currentMonth = (int)date('n');
    $seasonLabel = seasonLabel($currentMonth);
    $siteCount = count($siteReports);

    $siteBlocksHtml = '';
    foreach ($siteReports as $snap) {
        $siteBlocksHtml .= buildSiteBlock($snap);
    }

    $gainedHtml = '';
    foreach (array_slice($gained, 0, 8) as $g) {
        $gainedHtml .= '<li><strong>' . e($g['species']) . '</strong> <span class="site-tag">' . e($g['site']) . '</span></li>';
    }
    $gainedHtml = $gainedHtml ?: '<p class="no-data">先週との差分なし</p>';

    $lostHtml = '';
    foreach (array_slice($lost, 0, 8) as $l) {
        $lostHtml .= '<li><strong>' . e($l['species']) . '</strong> <span class="site-tag">' . e($l['site']) . '</span></li>';
    }
    $lostHtml = $lostHtml ?: '<p class="no-data">先週との差分なし</p>';

    return <<<HTML
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>連理の木の下で</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif; background: #0f1a0d; color: #e8f0e5; line-height: 1.7; }
  .wrapper { max-width: 640px; margin: 0 auto; padding: 24px 16px; }
  .header { text-align: center; padding: 48px 24px 32px; border-bottom: 1px solid #2d4a26; }
  .header .eyebrow { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #7ab87a; margin-bottom: 16px; }
  .header h1 { font-size: 28px; font-weight: 300; color: #c8e6c4; letter-spacing: 2px; margin-bottom: 8px; }
  .header .date { font-size: 13px; color: #6a8f65; }
  .kv { background: linear-gradient(135deg, #1a2f16 0%, #0f1a0d 100%); padding: 32px 24px; text-align: center; margin: 24px 0; border-radius: 4px; border: 1px solid #2d4a26; }
  .kv .season { font-size: 40px; margin-bottom: 12px; }
  .kv .season-label { font-size: 16px; color: #9dc99a; margin-bottom: 24px; }
  .stats-row { display: flex; justify-content: center; gap: 48px; }
  .stat { text-align: center; }
  .stat .num { font-size: 32px; font-weight: 200; color: #c8e6c4; }
  .stat .label { font-size: 11px; color: #6a8f65; letter-spacing: 1px; }
  .section { margin: 32px 0; }
  .section-title { font-size: 11px; letter-spacing: 3px; color: #7ab87a; text-transform: uppercase; border-bottom: 1px solid #2d4a26; padding-bottom: 8px; margin-bottom: 20px; }
  .species-lists { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .species-col { background: #1a2f16; padding: 16px; border-radius: 4px; }
  .species-col h3 { font-size: 12px; color: #7ab87a; margin-bottom: 12px; font-weight: 600; }
  .species-col ul { list-style: none; }
  .species-col li { font-size: 13px; padding: 4px 0; color: #b8d4b5; border-bottom: 1px solid #2d4a26; }
  .species-col li:last-child { border-bottom: none; }
  .species-col.lost li { color: #c4a882; }
  .site-tag { font-size: 10px; color: #6a8f65; display: block; }
  .site-card { background: #1a2f16; border: 1px solid #2d4a26; border-radius: 4px; padding: 20px; margin-bottom: 16px; }
  .site-card .site-name { font-size: 16px; color: #c8e6c4; margin-bottom: 4px; }
  .site-card .site-meta { font-size: 11px; color: #6a8f65; margin-bottom: 16px; }
  .site-metrics { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 12px; }
  .metric { }
  .metric .val { font-size: 20px; font-weight: 200; color: #9dc99a; }
  .metric .lbl { font-size: 10px; color: #6a8f65; }
  .trend-badge { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 2px; margin-left: 8px; }
  .trend-up { background: #1e3d1a; color: #7ab87a; }
  .trend-down { background: #3d1a1a; color: #c47a7a; }
  .trend-stable { background: #1a2f16; color: #6a8f65; }
  .top-species { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .sp-chip { background: #0f1a0d; border: 1px solid #2d4a26; border-radius: 2px; font-size: 11px; padding: 2px 8px; color: #9dc99a; }
  .footer { text-align: center; padding: 32px 24px; border-top: 1px solid #2d4a26; font-size: 11px; color: #4a6b45; }
  .footer a { color: #6a9f65; text-decoration: none; }
  .haiku { text-align: center; padding: 32px 24px; font-size: 15px; color: #6a8f65; font-style: italic; letter-spacing: 2px; line-height: 2; }
  .no-data { color: #4a6b45; font-size: 13px; font-style: italic; text-align: center; padding: 16px; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="eyebrow">ikimon.life — Ecological Intelligence</div>
    <h1>連理の木の下で</h1>
    <div class="date">{$week}週の生態レポート &nbsp;·&nbsp; {$seasonLabel}</div>
  </div>

  <div class="kv">
    <div class="season">{$seasonLabel}</div>
    <div class="stats-row">
      <div class="stat">
        <div class="num">{$totalSpecies}</div>
        <div class="label">記録種数</div>
      </div>
      <div class="stat">
        <div class="num">{$totalObs}</div>
        <div class="label">総観測記録</div>
      </div>
      <div class="stat">
        <div class="num">{$siteCount}</div>
        <div class="label">監視サイト</div>
      </div>
    </div>
  </div>

  <!-- 今週の出現・消失 -->
  <div class="section">
    <div class="section-title">今週の動き</div>
    <div class="species-lists">
      <div class="species-col">
        <h3>▲ 新たに確認</h3>
        {$gainedHtml}
      </div>
      <div class="species-col lost">
        <h3>▼ 確認されなくなった</h3>
        {$lostHtml}
      </div>
    </div>
  </div>

  <!-- サイト別レポート -->
  <div class="section">
    <div class="section-title">サイト別状態</div>
    {$siteBlocksHtml}
  </div>

  <!-- 俳句 -->
  <div class="haiku">
    連理の木<br>二つの命が<br>今ここに在る
  </div>

  <div class="footer">
    <p><a href="https://ikimon.life">ikimon.life</a> — 生態デジタルツイン</p>
    <p style="margin-top:8px">このレポートは自動生成されています。週次スナップショットに基づきます。</p>
  </div>
</div>
</body>
</html>
HTML;

    return $html;
}

function buildSiteBlock(array $snap): string
{
    $name = e($snap['site_name'] ?? $snap['site_id']);
    $phase = phaseLabel($snap['seasonal_phase']['current_phase'] ?? 'unknown');
    $obsTotal = $snap['activity']['total_observations'] ?? 0;
    $obs30d = $snap['activity']['observations_30d'] ?? 0;
    $speciesCount = count($snap['species_state'] ?? []);
    $actLevel = round(($snap['activity']['activity_level'] ?? 0) * 100);
    $grade = $snap['confidence_envelope']['data_quality_grade'] ?? '?';

    $actDelta = $snap['comparison']['activity_delta'] ?? null;
    $trend = '';
    if ($actDelta !== null) {
        if ($actDelta > 0.05) {
            $trend = '<span class="trend-badge trend-up">活発化</span>';
        } elseif ($actDelta < -0.05) {
            $trend = '<span class="trend-badge trend-down">低下</span>';
        } else {
            $trend = '<span class="trend-badge trend-stable">安定</span>';
        }
    }

    // Top species chips
    $topSpeciesChips = '';
    foreach (array_slice($snap['species_state'] ?? [], 0, 8, true) as $sp => $data) {
        $topSpeciesChips .= '<span class="sp-chip">' . e($sp) . '</span>';
    }

    // Anomalies from PhenologyEngine (if integrated)
    $anomalyHtml = '';
    if (!empty($snap['comparison']['species_gained'])) {
        $cnt = count($snap['comparison']['species_gained']);
        $anomalyHtml = "<p style='font-size:11px;color:#7ab87a;margin-top:8px'>▲ {$cnt}種が新たに確認されました</p>";
    }

    // Weather summary
    $weatherHtml = '';
    if (!empty($snap['weather_summary']['available'])) {
        $temp = $snap['weather_summary']['temperature']['mean'] ?? null;
        $weather = $snap['weather_summary']['dominant_weather'] ?? '';
        if ($temp !== null) {
            $weatherHtml = "<span style='font-size:11px;color:#6a8f65;'>{$weather} {$temp}°C</span>";
        }
    }

    return <<<BLOCK
<div class="site-card">
  <div class="site-name">{$name} {$trend}</div>
  <div class="site-meta">{$phase} &nbsp;·&nbsp; DQ: {$grade} &nbsp;·&nbsp; {$weatherHtml}</div>
  <div class="site-metrics">
    <div class="metric"><div class="val">{$speciesCount}</div><div class="lbl">記録種</div></div>
    <div class="metric"><div class="val">{$obs30d}</div><div class="lbl">30日観測</div></div>
    <div class="metric"><div class="val">{$actLevel}%</div><div class="lbl">活動指数</div></div>
    <div class="metric"><div class="val">{$obsTotal}</div><div class="lbl">累計記録</div></div>
  </div>
  <div class="top-species">{$topSpeciesChips}</div>
  {$anomalyHtml}
</div>
BLOCK;
}

function e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function seasonLabel(int $month): string
{
    return match (true) {
        $month >= 3 && $month <= 5   => '🌸 春',
        $month >= 6 && $month <= 8   => '🌿 夏',
        $month >= 9 && $month <= 11  => '🍂 秋',
        default                       => '❄️ 冬',
    };
}

function phaseLabel(string $phase): string
{
    return match ($phase) {
        'early_spring' => '早春',
        'spring'       => '春',
        'late_spring'  => '晩春',
        'early_summer' => '初夏',
        'summer'       => '夏',
        'early_autumn' => '初秋',
        'autumn'       => '秋',
        'late_autumn'  => '晩秋',
        'winter'       => '冬',
        default        => '—',
    };
}
