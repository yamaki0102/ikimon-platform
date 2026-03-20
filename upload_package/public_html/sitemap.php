<?php

/**
 * Dynamic XML Sitemap for ikimon.life
 * Generates sitemap entries for:
 * 1. Static pages (about, terms, etc.)
 * 2. Species pages (from taxon_resolver)
 * 3. Observation detail pages (recent)
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';

header('Content-Type: application/xml; charset=UTF-8');

$baseUrl = 'https://ikimon.life';

echo '<?xml version="1.0" encoding="UTF-8"?>';
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

    <!-- Core Pages -->
    <url>
        <loc><?php echo $baseUrl; ?>/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc><?php echo $baseUrl; ?>/explore.php</loc>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc><?php echo $baseUrl; ?>/compass.php</loc>
        <changefreq>daily</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc><?php echo $baseUrl; ?>/map.php</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc><?php echo $baseUrl; ?>/about.php</loc>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>
    <url>
        <loc><?php echo $baseUrl; ?>/for-citizen.php</loc>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>
    <url>
        <loc><?php echo $baseUrl; ?>/for-business.php</loc>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>
    <url>
        <loc><?php echo $baseUrl; ?>/for-researcher.php</loc>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>
    <url>
        <loc><?php echo $baseUrl; ?>/terms.php</loc>
        <changefreq>yearly</changefreq>
        <priority>0.3</priority>
    </url>
    <url>
        <loc><?php echo $baseUrl; ?>/privacy.php</loc>
        <changefreq>yearly</changefreq>
        <priority>0.3</priority>
    </url>
    <url>
        <loc><?php echo $baseUrl; ?>/updates.php</loc>
        <changefreq>monthly</changefreq>
        <priority>0.5</priority>
    </url>
    <url>
        <loc><?php echo $baseUrl; ?>/team.php</loc>
        <changefreq>monthly</changefreq>
        <priority>0.5</priority>
    </url>
    <url>
        <loc><?php echo $baseUrl; ?>/faq.php</loc>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>
    <url>
        <loc><?php echo $baseUrl; ?>/zukan.php</loc>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>

    <!-- Species Pages (from taxon_resolver) -->
    <?php
    $resolverFile = DATA_DIR . '/taxon_resolver.json';
    if (file_exists($resolverFile)) {
        $resolver = json_decode(file_get_contents($resolverFile), true);
        $taxa = $resolver['taxa'] ?? [];
        foreach ($taxa as $slug => $taxon) {
            // Skip temporary jp_index slugs
            if (str_starts_with($slug, '__jp__')) continue;
            $loc = htmlspecialchars($baseUrl . '/species/' . urlencode($slug));
            echo "    <url><loc>{$loc}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n";
        }
    }
    ?>

    <!-- Recent Observations -->
    <?php
    $observations = DataStore::fetchAll('observations');
    // Sort by created_at desc, take latest 200
    usort($observations, fn($a, $b) => ($b['created_at'] ?? '') <=> ($a['created_at'] ?? ''));
    $recentObs = array_slice($observations, 0, 200);
    foreach ($recentObs as $obs) {
        $id = htmlspecialchars($obs['id'] ?? '');
        if (!$id) continue;
        $lastmod = isset($obs['created_at']) ? date('Y-m-d', strtotime($obs['created_at'])) : date('Y-m-d');
        $loc = htmlspecialchars($baseUrl . '/observation_detail.php?id=' . urlencode($id));
        echo "    <url><loc>{$loc}</loc><lastmod>{$lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>\n";
    }
    ?>

</urlset>
