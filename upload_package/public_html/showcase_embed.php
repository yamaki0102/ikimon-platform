<?php

/**
 * showcase_embed.php — Lightweight CSR Embed Widget
 *
 * Minimal, embeddable biodiversity showcase for iframe use.
 * Usage: <iframe src="https://ikimon.life/showcase_embed.php?site_id=xxx" width="100%" height="400"></iframe>
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/SiteManager.php';
require_once __DIR__ . '/../libs/RedListManager.php';

$siteId = $_GET['site_id'] ?? '';
if (!$siteId) {
    echo '<p>site_id required</p>';
    exit;
}

$site = SiteManager::load($siteId);
if (!$site) {
    echo '<p>Site not found</p>';
    exit;
}

$siteName = $site['properties']['name'] ?? $site['name'] ?? $siteId;

// Lightweight data collection
$allObs = DataStore::fetchAll('observations');
$siteObs = [];
foreach ($allObs as $obs) {
    if (($obs['site_id'] ?? null) === $siteId) {
        $siteObs[] = $obs;
    }
}

$speciesSet = [];
$rgCount = 0;
foreach ($siteObs as $obs) {
    $name = $obs['taxon']['name'] ?? ($obs['species_name'] ?? '不明');
    $speciesSet[$name] = true;
    $status = $obs['quality_grade'] ?? ($obs['status'] ?? '');
    if (in_array($status, ['Research Grade', '研究用'])) $rgCount++;
}

$totalObs = count($siteObs);
$totalSpecies = count($speciesSet);
$rgPercent = $totalObs > 0 ? round(($rgCount / $totalObs) * 100, 1) : 0;

// BIS (simplified)
$bis = round(min(100, min(40, $totalSpecies * 1.5) + min(25, $rgPercent * 0.25)), 1);
$meta_title = htmlspecialchars($siteName) . ' - ikimon';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap');

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans JP', system-ui, sans-serif;
            background: linear-gradient(135deg, #064e3b, #047857);
            color: white;
            padding: 24px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .embed-brand {
            font-size: 10px;
            font-weight: 700;
            opacity: 0.5;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .embed-name {
            font-size: 1.25rem;
            font-weight: 900;
            margin-bottom: 16px;
            line-height: 1.3;
        }

        .embed-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 20px;
        }

        .embed-stat {
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 12px 8px;
            border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .embed-stat-val {
            font-size: 1.5rem;
            font-weight: 900;
            line-height: 1;
        }

        .embed-stat-label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            opacity: 0.6;
            margin-top: 4px;
            font-weight: 700;
        }

        .embed-cta {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(255, 255, 255, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.25);
            border-radius: 100px;
            padding: 8px 16px;
            color: white;
            text-decoration: none;
            font-size: 11px;
            font-weight: 700;
            transition: background 0.2s;
        }

        .embed-cta:hover {
            background: rgba(255, 255, 255, 0.25);
        }

        .embed-compliance {
            font-size: 9px;
            opacity: 0.4;
            margin-top: 12px;
        }

        @media (max-width: 400px) {
            .embed-stats {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>

<body>
    <div class="embed-brand">🌿 ikimon.life</div>
    <div class="embed-name"><?php echo htmlspecialchars($siteName); ?></div>
    <div class="embed-stats">
        <div class="embed-stat">
            <div class="embed-stat-val"><?php echo $bis; ?></div>
            <div class="embed-stat-label">BIS</div>
        </div>
        <div class="embed-stat">
            <div class="embed-stat-val"><?php echo $totalSpecies; ?></div>
            <div class="embed-stat-label">種</div>
        </div>
        <div class="embed-stat">
            <div class="embed-stat-val"><?php echo $totalObs; ?></div>
            <div class="embed-stat-label">観察</div>
        </div>
        <div class="embed-stat">
            <div class="embed-stat-val"><?php echo $rgPercent; ?>%</div>
            <div class="embed-stat-label">認定率</div>
        </div>
    </div>
    <a href="<?php echo BASE_URL; ?>/csr_showcase.php?site_id=<?php echo urlencode($siteId); ?>" target="_blank" rel="noopener noreferrer" class="embed-cta">
        🔍 詳細を見る →
    </a>
    <div class="embed-compliance">30by30 / TNFD LEAP 対応 — Powered by ikimon.life</div>
</body>

</html>