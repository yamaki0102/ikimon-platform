<?php
require_once __DIR__ . '/upload_package/config/config.php';
require_once __DIR__ . '/upload_package/libs/CorporateSites.php';
require_once __DIR__ . '/upload_package/libs/GeoUtils.php';

// Prepare directories
$sitesDir = DATA_DIR . '/sites';
if (!is_dir($sitesDir)) {
    mkdir($sitesDir, 0755, true);
}

echo "Starting migration of Corporate Sites...\n";

foreach (CorporateSites::SITES as $id => $site) {
    echo "Migrating {$id} ({$site['name']})...\n";

    $siteDir = $sitesDir . '/' . $id;
    if (!is_dir($siteDir)) {
        mkdir($siteDir, 0755, true);
    }

    // 1. Create meta.json
    $meta = [
        'id' => $id,
        'name' => $site['name'],
        'owner' => $site['owner'],
        'owner_org_id' => '1', // Default to Org ID 1 for now (Demo Corp)
        'description' => $site['description'],
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s'),
        'status' => 'active'
    ];
    file_put_contents($siteDir . '/meta.json', json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    // 2. Create boundary.geojson (Convert Point to Polygon 100m radius box)
    $centerLng = $site['location'][0];
    $centerLat = $site['location'][1];

    // Simple box: +/- 0.001 degree (approx 100m)
    $delta = 0.001;
    $polygon = [
        [
            [$centerLng - $delta, $centerLat - $delta],
            [$centerLng + $delta, $centerLat - $delta],
            [$centerLng + $delta, $centerLat + $delta],
            [$centerLng - $delta, $centerLat + $delta],
            [$centerLng - $delta, $centerLat - $delta] // Close loop
        ]
    ];

    $geojson = [
        'type' => 'FeatureCollection',
        'features' => [
            [
                'type' => 'Feature',
                'properties' => [
                    'site_id' => $id,
                    'name' => $site['name']
                ],
                'geometry' => [
                    'type' => 'Polygon',
                    'coordinates' => $polygon
                ]
            ]
        ]
    ];

    file_put_contents($siteDir . '/boundary.geojson', json_encode($geojson, JSON_PRETTY_PRINT));
    echo "  > Created {$siteDir}/boundary.geojson\n";
}

echo "Migration complete.\n";
