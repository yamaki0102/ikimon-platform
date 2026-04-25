<?php

/**
 * SiteManager - GeoJSON-based site boundary management
 *
 * Replaces the hardcoded CorporateSites.php with a file-based approach.
 * Each site has a directory under data/sites/{site_id}/ containing:
 *   - boundary.geojson  (FeatureCollection with polygon boundaries)
 *   - meta.json          (optional overrides)
 *
 * Supports MultiPolygon for 飛び地 (enclaves/non-contiguous areas).
 */

require_once __DIR__ . '/GeoUtils.php';
require_once __DIR__ . '/DataStore.php';

class SiteManager
{

    private static function getSitesDir(): string
    {
        return DATA_DIR . '/sites';
    }

    /**
     * List all registered sites
     * @return array Site summaries
     */
    public static function listAll(bool $activeOnly = true): array
    {
        $dir = self::getSitesDir();
        if (!is_dir($dir)) return [];

        $sites = [];
        foreach (scandir($dir) as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $sitePath = $dir . '/' . $entry;
            if (!is_dir($sitePath)) continue;

            $site = self::load($entry);
            if ($site) {
                if ($activeOnly && ($site['status'] ?? 'active') !== 'active') continue;
                $sites[] = $site;
            }
        }
        return $sites;
    }

    /**
     * Get sites owned by a specific organization
     */
    public static function getByOwnerOrg(string $orgId): array
    {
        $all = self::listAll();
        $filtered = [];
        foreach ($all as $site) {
            if (isset($site['owner_org_id']) && $site['owner_org_id'] === $orgId) {
                $filtered[] = $site;
            }
        }
        return $filtered;
    }

    /**
     * Load a site by ID
     * @param string $siteId
     * @return array|null Site data with properties and geometry
     */
    public static function load(string $siteId): ?array
    {
        $dir = self::getSitesDir() . '/' . $siteId;
        $geojsonPath = $dir . '/boundary.geojson';

        if (!file_exists($geojsonPath)) return null;

        $raw = file_get_contents($geojsonPath);
        $geojson = json_decode($raw, true);
        if (!$geojson) return null;

        // Support both FeatureCollection and single Feature GeoJSON
        if (($geojson['type'] ?? '') === 'FeatureCollection') {
            if (empty($geojson['features'])) return null;
            $feature = $geojson['features'][0];
        } elseif (($geojson['type'] ?? '') === 'Feature') {
            $feature = $geojson;
        } else {
            return null;
        }

        $props = $feature['properties'] ?? [];

        // Load meta.json if exists (Phase 18)
        $metaPath = $dir . '/meta.json';
        $meta = [];
        if (file_exists($metaPath)) {
            $meta = json_decode(file_get_contents($metaPath), true) ?? [];
        }

        // Merge properties: meta.json > GeoJSON properties
        $merged = array_merge($props, $meta);

        return [
            'id'           => $merged['id'] ?? $siteId,
            'name'         => $merged['name'] ?? $siteId,
            'name_en'      => $merged['name_en'] ?? '',
            'description'  => $merged['description'] ?? '',
            'address'      => $merged['address'] ?? '',
            'owner'        => $merged['owner'] ?? '',
            'owner_org_id' => $merged['owner_org_id'] ?? null, // Link to CorporateManager
            'center'       => $merged['center'] ?? self::calculateCenter($feature['geometry']),
            'status'       => $merged['status'] ?? 'active',
            'created'      => $merged['created'] ?? '',
            'updated'      => $merged['updated'] ?? '',
            'geometry'     => $feature['geometry'],
        ];
    }

    /**
     * Get the raw GeoJSON FeatureCollection for a site
     * (for passing to MapLibre as a source)
     */
    public static function getGeoJSON(string $siteId): ?array
    {
        $dir = self::getSitesDir() . '/' . $siteId;
        $geojsonPath = $dir . '/boundary.geojson';

        if (!file_exists($geojsonPath)) return null;

        return json_decode(file_get_contents($geojsonPath), true);
    }

    /**
     * Check if a point (lat, lng) is inside a site's boundary
     * Supports Polygon and MultiPolygon
     */
    public static function isPointInSite(float $lat, float $lng, string $siteId): bool
    {
        $site = self::load($siteId);
        if (!$site) return false;

        return self::isPointInGeometry($lat, $lng, $site['geometry']);
    }

    /**
     * Check if a point is inside a GeoJSON geometry (Polygon or MultiPolygon)
     */
    public static function isPointInGeometry(float $lat, float $lng, array $geometry): bool
    {
        $type = $geometry['type'] ?? '';
        $coords = $geometry['coordinates'] ?? [];

        if ($type === 'Polygon') {
            // First ring is the outer boundary
            return GeoUtils::isPointInPolygon($lat, $lng, $coords[0]);
        }

        if ($type === 'MultiPolygon') {
            // Check each polygon (飛び地対応)
            foreach ($coords as $polygon) {
                if (GeoUtils::isPointInPolygon($lat, $lng, $polygon[0])) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get observations belonging to a site (by site_id OR geometry containment)
     */
    public static function getObservationsInSite(string $siteId, int $limit = 0): array
    {
        $site = self::load($siteId);
        if (!$site) return [];

        $allObs = DataStore::fetchAll('observations');
        $filtered = [];
        $seen = [];

        foreach ($allObs as $obs) {
            $obsId = $obs['id'] ?? spl_object_id((object)$obs);

            // Match 1: explicit site_id field
            if (($obs['site_id'] ?? '') === $siteId) {
                if (!isset($seen[$obsId])) {
                    $filtered[] = $obs;
                    $seen[$obsId] = true;
                }
                if ($limit > 0 && count($filtered) >= $limit) break;
                continue;
            }

            // Match 2: geometry containment (for obs without site_id)
            $lat = floatval($obs['lat'] ?? 0);
            $lng = floatval($obs['lng'] ?? 0);
            if ($lat == 0 && $lng == 0) continue;

            if (!isset($seen[$obsId]) && self::isPointInGeometry($lat, $lng, $site['geometry'])) {
                $filtered[] = $obs;
                $seen[$obsId] = true;
            }

            if ($limit > 0 && count($filtered) >= $limit) break;
        }

        return $filtered;
    }

    /**
     * Get comprehensive statistics for a site (Business Dashboard grade)
     */
    public static function getSiteStats(string $siteId): array
    {
        $observations = self::getObservationsInSite($siteId);

        $speciesSet = [];
        $observerSet = [];
        $monthlyData = [];
        $taxonomicGroups = [];
        $phenologyMatrix = []; // month => group => count
        $latestDate = '';

        $latestObs = null;

        foreach ($observations as $obs) {
            // Species count
            $taxonName = $obs['taxon']['name'] ?? ($obs['species_name'] ?? 'Unknown');
            if ($taxonName && $taxonName !== 'Unknown') {
                $speciesSet[$taxonName] = ($speciesSet[$taxonName] ?? 0) + 1;
            }

            // Observer count
            $userId = $obs['user_id'] ?? ($obs['observer'] ?? 'anonymous');
            $observerSet[$userId] = true;

            // Monthly aggregation
            $date = $obs['observed_at'] ?? ($obs['created_at'] ?? '');
            if ($date) {
                $month = substr($date, 0, 7); // YYYY-MM
                $monthlyData[$month] = ($monthlyData[$month] ?? 0) + 1;
                if ($date > $latestDate) {
                    $latestDate = $date;
                    $latestObs = $obs;
                }

                // Phenology matrix: month × group
                $group = $obs['taxon']['group'] ?? ($obs['category'] ?? 'その他');
                $monthNum = intval(substr($date, 5, 2));
                $phenologyMatrix[$monthNum][$group] = ($phenologyMatrix[$monthNum][$group] ?? 0) + 1;
            }

            // Taxonomic group
            $group = $obs['taxon']['group'] ?? ($obs['category'] ?? 'その他');
            $taxonomicGroups[$group] = ($taxonomicGroups[$group] ?? 0) + 1;
        }

        // Sort species by frequency
        arsort($speciesSet);
        arsort($taxonomicGroups);
        ksort($monthlyData);
        ksort($phenologyMatrix);

        $totalObs = count($observations);
        $totalSpecies = count($speciesSet);
        $totalObservers = count($observerSet);

        // --- Regional Baseline Analytics ---
        // Fetch platform-wide totals to calculate "Regional Contribution Share"
        $regionalStats = self::getRegionalStats();
        $regionalSharePct = $regionalStats['total_species'] > 0 ? round(($totalSpecies / $regionalStats['total_species']) * 100, 1) : 0;

        // --- Advanced Analytics ---

        // Shannon-Wiener Diversity Index H'
        $shannonH = self::calcShannonWiener($speciesSet, $totalObs);

        // Chao1 Estimated Species Richness
        $chao1 = self::calcChao1($speciesSet);

        // Sampling completeness (observed / Chao1)
        $completeness = $chao1 > 0 ? round($totalSpecies / $chao1 * 100, 1) : 0;

        // Red list count (via observations data — only truly threatened: CR/EN/VU/NT)
        $redlistCount = 0;
        try {
            require_once __DIR__ . '/RedListManager.php';
            $rlm = new RedListManager();
            $rlResults = $rlm->lookupMultiple(array_keys($speciesSet), 'shizuoka');
            $threatenedCategories = [
                'CR',
                'EN',
                'VU',
                'NT',
                '絶滅危惧IA類',
                '絶滅危惧IB類',
                '絶滅危惧II類',
                '準絶滅危惧'
            ];
            foreach ($rlResults as $name => $entries) {
                foreach ($entries as $entry) {
                    $cat = $entry['category'] ?? '';
                    if (in_array($cat, $threatenedCategories)) {
                        $redlistCount++;
                        break; // Count each species once
                    }
                }
            }
        } catch (\Throwable $e) {
            // Skip if RedListManager unavailable
        }

        // Data freshness
        $daysSinceLastObs = 0;
        if ($latestDate) {
            $daysSinceLastObs = max(0, intval((time() - strtotime($latestDate)) / 86400));
        }

        // Active months count (months with observations)
        $activeMonths = count($monthlyData);

        // Credit Reference Score (β) — composite 0-100
        // Advanced analytics
        require_once __DIR__ . '/BiodiversityScorer.php';

        // Use MonitoringReferenceScorer for consistent scoring across the platform
        // SiteInfo usually doesn't have biome yet, but we pass what we have
        $siteInfo = ['biome_type' => 'unknown']; // Sites might need biome data in JSON later
        $scorerResult = MonitoringReferenceScorer::calculate($observations, $siteInfo);

        // Map Scorer results to SiteStats Structure
        $shannonH = $scorerResult['breakdown']['richness']['raw'] ?? $shannonH;
        // Chao1 is not in Scorer yet, keep existing calculation if needed, or deprecate?
        // For now, let's keep calcChao1 as it's specific to SiteManager for now
        $chao1 = self::calcChao1($speciesSet);
        $completeness = $chao1 > 0 ? round($totalSpecies / $chao1 * 100, 1) : 0;

        $creditScore = $scorerResult['total_score'];

        return [
            'total_observations'  => $totalObs,
            'total_species'       => $totalSpecies,
            'total_observers'     => count($observerSet),
            'days_since_last_obs' => $daysSinceLastObs,
            'latest_observation'  => $latestObs ? $latestObs['observed_at'] : null,
            'monthly_trend'       => $monthlyData,     // Restored key name
            'taxonomic_groups'    => $taxonomicGroups, // Restored key name
            'phenology_matrix'    => $phenologyMatrix, // Restored key name
            'shannon_wiener'      => round($shannonH, 3),
            'chao1_estimate'      => round($chao1, 1),
            'completeness_pct'    => $completeness,
            'redlist_count'       => $redlistCount,
            'regional_share_pct'  => $regionalSharePct,
            'regional_total_species' => $regionalStats['total_species'],
            'regional_total_redlist' => $regionalStats['total_redlist'],

            // New Scorer Data
            'credit_score'        => $creditScore, // Keep key for dashboard compatibility
            'credit_rank'         => self::creditRank($creditScore),
            'biodiversity_score'  => $scorerResult, // Full details

            'top_species'         => array_slice($speciesSet, 0, 10, true),
            'active_months'       => $activeMonths,
        ];
    }

    /**
     * Shannon-Wiener Diversity Index: H' = -Σ(pi × ln(pi))
     */
    private static function calcShannonWiener(array $speciesSet, int $totalObs): float
    {
        if ($totalObs <= 0 || empty($speciesSet)) return 0.0;
        $h = 0.0;
        foreach ($speciesSet as $count) {
            $pi = $count / $totalObs;
            if ($pi > 0) {
                $h -= $pi * log($pi);
            }
        }
        return $h;
    }

    /**
     * Chao1 Non-parametric Species Richness Estimator
     * S_chao1 = S_obs + (f1² / (2 * f2))
     * f1 = singletons, f2 = doubletons
     */
    private static function calcChao1(array $speciesSet): float
    {
        $sObs = count($speciesSet);
        if ($sObs === 0) return 0;

        $f1 = 0; // singletons
        $f2 = 0; // doubletons
        foreach ($speciesSet as $count) {
            if ($count === 1) $f1++;
            if ($count === 2) $f2++;
        }

        if ($f2 === 0) {
            // Bias-corrected form when f2 = 0
            return $sObs + ($f1 * ($f1 - 1)) / 2;
        }
        return $sObs + ($f1 * $f1) / (2 * $f2);
    }



    /**
     * Map credit score to A-E rank
     */
    private static function creditRank(int $score): string
    {
        if ($score >= 80) return 'A';
        if ($score >= 60) return 'B';
        if ($score >= 40) return 'C';
        if ($score >= 20) return 'D';
        return 'E';
    }

    /**
     * Calculate center point from geometry
     */
    private static function calculateCenter(array $geometry): array
    {
        $type = $geometry['type'] ?? '';
        $coords = $geometry['coordinates'] ?? [];

        $allPoints = [];
        if ($type === 'Polygon') {
            $allPoints = $coords[0];
        } elseif ($type === 'MultiPolygon') {
            foreach ($coords as $polygon) {
                $allPoints = array_merge($allPoints, $polygon[0]);
            }
        }

        if (empty($allPoints)) return [0, 0];

        $sumLng = 0;
        $sumLat = 0;
        foreach ($allPoints as $p) {
            $sumLng += $p[0];
            $sumLat += $p[1];
        }
        $n = count($allPoints);

        return [round($sumLng / $n, 6), round($sumLat / $n, 6)];
    }

    /**
     * Get baseline statistics for the entire region (platform-wide)
     * Used for calculating Regional Contribution Share
     */
    public static function getRegionalStats(string $prefecture = 'shizuoka'): array
    {
        $allObs = DataStore::fetchAll('observations');
        $speciesSet = [];
        foreach ($allObs as $obs) {
            $taxonName = $obs['taxon']['name'] ?? ($obs['species_name'] ?? null);
            if ($taxonName && $taxonName !== 'Unknown') {
                $speciesSet[$taxonName] = true;
            }
        }

        $totalSpecies = count($speciesSet);
        $redlistCount = 0;

        try {
            require_once __DIR__ . '/RedListManager.php';
            $rlm = new RedListManager();
            $rlResults = $rlm->lookupMultiple(array_keys($speciesSet), $prefecture);
            $redlistCount = count($rlResults);
        } catch (\Throwable $e) {
            // Error handling
        }

        return [
            'total_species' => $totalSpecies,
            'total_redlist' => $redlistCount
        ];
    }
}
