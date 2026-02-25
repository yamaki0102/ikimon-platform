<?php
require_once __DIR__ . '/upload_package/libs/SiteManager.php';

echo "Start checking SiteManager...\n";
$start = microtime(true);

try {
    $sites = SiteManager::getByOwnerOrg('1');
    echo "Sites found: " . count($sites) . "\n";
    foreach ($sites as $site) {
        echo " - " . $site['name'] . " (" . $site['id'] . ")\n";

        // Check getSiteStats performance
        $sStart = microtime(true);
        $stats = SiteManager::getSiteStats($site['id']);
        echo "   > Stats loaded in " . (microtime(true) - $sStart) . " sec\n";
        echo "     Obs: " . ($stats['total_observations'] ?? 0) . "\n";
    }
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}

echo "Total Time: " . (microtime(true) - $start) . " sec\n";
