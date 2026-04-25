<?php

require_once __DIR__ . '/RedListManager.php';

class MonitoringReferenceScorer
{
    /**
     * Calculate a monitoring reference index (0-100) from observation data.
     *
     * This is an internal heuristic for comparing observation coverage and
     * conservation signals within the product. It is not a certification score,
     * a TNFD compliance score, or a biodiversity credit unit.
     *
     * 5-axis model aligned with ikimon_b2b_strategy.md v3.0:
     *   1. Species Richness (30pt) — Shannon-Wiener Index H' normalized
     *   2. Data Confidence  (20pt) — Research Grade ratio × observation density
     *   3. Conservation Value (25pt) — IUCN category-weighted endangered species
     *   4. Taxonomic Coverage (15pt) — Detected taxonomic groups / expected groups
     *   5. Monitoring Effort (10pt) — Monthly coverage × active years
     *
     * @param array $observations List of observations in the site
     * @param array $fieldInfo    Site metadata (area_ha, etc.)
     * @return array Score details with breakdown
     */
    public static function calculate(array $observations, array $fieldInfo = []): array
    {
        $obsCount = count($observations);
        if ($obsCount === 0) {
            return self::emptyResult();
        }

        // ── Pre-calculation aggregation ──
        $speciesCounts = [];
        $speciesNamesMap = []; // Track names for structured output
        $taxonomicGroups = [];
        $months = [];
        $years = [];

        foreach ($observations as $obs) {
            // Species count (Group by Immutable Taxon Concept ID first, fallback to name)
            $id = $obs['taxon']['id'] ?? null;
            $name = $obs['taxon']['name'] ?? $obs['taxon_name_ja'] ?? 'Unknown';

            $key = $id ?? $name;
            if ($key !== 'Unknown') {
                $speciesCounts[$key] = ($speciesCounts[$key] ?? 0) + 1;
                $speciesNamesMap[$key] = $name !== 'Unknown' ? $name : (string)$id;
            }

            // Taxonomic group (taxon.group field)
            $group = $obs['taxon']['group'] ?? null;
            if ($group) {
                $taxonomicGroups[$group] = true;
            }

            // Month/year coverage
            $date = $obs['observed_at'] ?? $obs['date'] ?? '';
            if ($date) {
                $ym = substr($date, 0, 7); // "2025-07"
                $y  = substr($date, 0, 4);  // "2025"
                $months[$ym] = true;
                $years[$y] = true;
            }
        }

        // Red List assessment
        $redListManager = new RedListManager();
        $rlResult = $redListManager->checkObservations($observations);
        $redListMatches = $rlResult['species'];

        // ═══════════════════════════════════════════
        // 1. SPECIES RICHNESS (30pt)
        //    Shannon-Wiener Index H' normalized to 0-100
        //    H' = 3.5 → 100pt (mature temperate ecosystem)
        // ═══════════════════════════════════════════
        $shannonIndex = self::calculateShannonIndex($speciesCounts);
        $speciesCount = count($speciesCounts);
        $richnessScore = min(100, ($shannonIndex / 3.5) * 100);

        // ═══════════════════════════════════════════
        // 2. DATA CONFIDENCE (20pt)
        //    (RG% × 0.6) + (density × 0.4)
        //    RG = data_quality === 'A'
        // ═══════════════════════════════════════════
        $rgCount = 0;
        foreach ($observations as $obs) {
            if (($obs['data_quality'] ?? '') === 'A') {
                $rgCount++;
            }
        }
        $rgRatio = $rgCount / $obsCount;

        // Density: observations per hectare if area is known, else obs/50 normalized
        $areaHa = $fieldInfo['area_ha'] ?? 0;
        if ($areaHa > 0) {
            $densityNorm = min(1.0, ($obsCount / $areaHa) / 10); // 10 obs/ha = 100%
        } else {
            $densityNorm = min(1.0, $obsCount / 50); // 50 obs = 100% for MVP
        }
        $dcScore = min(100, (($rgRatio * 0.6) + ($densityNorm * 0.4)) * 100);

        // ═══════════════════════════════════════════
        // 3. CONSERVATION VALUE (25pt)
        //    IUCN category weights: CR=5, EN=4, VU=3, NT=2
        //    Normalized: rawScore / 20 * 100 (capped at 100)
        // ═══════════════════════════════════════════
        $cvRaw = 0;
        foreach ($redListMatches as $name => $lists) {
            $maxSeverity = 0;
            foreach ($lists as $listId => $entry) {
                $sev = $entry['severity'];
                if ($sev > $maxSeverity) $maxSeverity = $sev;
            }
            // Map severity to IUCN weight
            // RedListManager severity: CR+EN→5, EN→4, VU→3, NT→2
            $cvRaw += $maxSeverity;
        }
        $cvScore = min(100, ($cvRaw / 20) * 100);

        // ═══════════════════════════════════════════
        // 4. TAXONOMIC COVERAGE (15pt)
        //    Detected groups / expected groups
        //    Expected: 8 major groups (birds, insects, mammals,
        //    reptiles, amphibians, fish, plants, fungi)
        // ═══════════════════════════════════════════
        $expectedGroups = 8;
        $detectedGroups = count($taxonomicGroups);
        $tcScore = min(100, ($detectedGroups / $expectedGroups) * 100);

        // ═══════════════════════════════════════════
        // 5. MONITORING EFFORT (10pt)
        //    (months_covered / 12) × year_factor
        //    year_factor: 1yr=0.5, 2yr=0.75, 3yr+=1.0
        // ═══════════════════════════════════════════
        $monthsCovered = count($months);
        $uniqueMonthsInYear = min(12, $monthsCovered); // cap at 12
        $activeYears = count($years);
        $yearFactor = match (true) {
            $activeYears >= 3 => 1.0,
            $activeYears >= 2 => 0.75,
            default => 0.5,
        };
        $meScore = min(100, ($uniqueMonthsInYear / 12) * $yearFactor * 100);

        // ═══════════════════════════════════════════
        // TOTAL CALCULATION
        // ═══════════════════════════════════════════
        $weights = [
            'richness'           => 0.30,
            'data_confidence'    => 0.20,
            'conservation_value' => 0.25,
            'taxonomic_coverage' => 0.15,
            'monitoring_effort'  => 0.10,
        ];

        $totalScore = ($richnessScore * $weights['richness']) +
            ($dcScore * $weights['data_confidence']) +
            ($cvScore * $weights['conservation_value']) +
            ($tcScore * $weights['taxonomic_coverage']) +
            ($meScore * $weights['monitoring_effort']);

        // Top Species (Structured for 100-year architecture)
        arsort($speciesCounts);
        $topSpeciesIds = array_slice($speciesCounts, 0, 5, true);
        $topSpecies = [];
        foreach ($topSpeciesIds as $k => $c) {
            $topSpecies[] = [
                'id' => is_numeric($k) || str_starts_with((string)$k, 'local:') ? $k : null,
                'name' => $speciesNamesMap[$k] ?? (string)$k,
                'count' => $c
            ];
        }

        return [
            'total_score'    => round($totalScore),
            'species_count'  => $speciesCount,
            'shannon_index'  => $shannonIndex,
            'methodology' => [
                'name' => 'モニタリング参考インデックス',
                'short_name' => 'MRI',
                'version' => 'beta',
                'summary' => '観測データの厚みと保全シグナルを俯瞰するための社内向け参考指標です。',
                'limitations' => [
                    '観測努力や参加者構成の影響を受けるため、環境価値そのものを単独で確定する指標ではありません。',
                    '存在記録ベースのため、不在や個体数の厳密な推定には使えません。',
                    '認証可否、法令適合、クレジット価格を直接示すものではありません。',
                ],
            ],
            'breakdown' => [
                'richness' => [
                    'label'    => '種の多様性',
                    'raw'      => round($shannonIndex, 2),
                    'raw_label' => "多様度指数 H'=" . round($shannonIndex, 2) . "（{$speciesCount}種確認）",
                    'score'    => round($richnessScore),
                    'weighted' => round($richnessScore * $weights['richness'], 1),
                    'weight'   => $weights['richness'],
                ],
                'data_confidence' => [
                    'label'    => 'データ信頼性',
                    'raw'      => round($rgRatio * 100),
                    'raw_label' => "高品質データ率 " . round($rgRatio * 100) . "%（{$rgCount}/{$obsCount}件）",
                    'score'    => round($dcScore),
                    'weighted' => round($dcScore * $weights['data_confidence'], 1),
                    'weight'   => $weights['data_confidence'],
                ],
                'conservation_value' => [
                    'label'    => '保全価値',
                    'raw'      => count($redListMatches),
                    'raw_label' => "レッドリスト該当 " . count($redListMatches) . "種",
                    'score'    => round($cvScore),
                    'weighted' => round($cvScore * $weights['conservation_value'], 1),
                    'weight'   => $weights['conservation_value'],
                    'matches'  => array_keys($redListMatches),
                ],
                'taxonomic_coverage' => [
                    'label'    => '分類群カバー率',
                    'raw'      => $detectedGroups,
                    'raw_label' => "確認済み {$detectedGroups}/{$expectedGroups} 分類群",
                    'score'    => round($tcScore),
                    'weighted' => round($tcScore * $weights['taxonomic_coverage'], 1),
                    'weight'   => $weights['taxonomic_coverage'],
                    'groups'   => array_keys($taxonomicGroups),
                ],
                'monitoring_effort' => [
                    'label'    => '調査の継続性',
                    'raw'      => $monthsCovered,
                    'raw_label' => "活動 {$monthsCovered}ヶ月 / {$activeYears}年間",
                    'score'    => round($meScore),
                    'weighted' => round($meScore * $weights['monitoring_effort'], 1),
                    'weight'   => $weights['monitoring_effort'],
                ],
            ],
            'top_species' => $topSpecies,
            'evaluation'  => self::evaluate($totalScore),
        ];
    }

    /**
     * Convenience helper for legacy widgets that request site-level summary stats.
     */
    public static function calculateSiteStats(string $siteId): array
    {
        require_once __DIR__ . '/SiteManager.php';

        $site = SiteManager::load($siteId);
        if (!$site) {
            return self::emptyResult();
        }

        $observations = SiteManager::getObservationsInSite($siteId);
        $areaHa = $site['properties']['area_ha'] ?? 0;

        $result = self::calculate($observations, ['area_ha' => $areaHa]);
        $redListMatches = $result['breakdown']['conservation_value']['matches'] ?? [];

        return $result + [
            'total_observations' => count($observations),
            'total_species' => $result['species_count'] ?? 0,
            'redlist_count' => count($redListMatches),
            'monitoring_reference_index' => $result['total_score'] ?? 0,
        ];
    }

    /**
     * Return empty result for sites with no observations
     */
    private static function emptyResult(): array
    {
        return [
            'total_score'    => 0,
            'species_count'  => 0,
            'shannon_index'  => 0.0,
            'methodology' => [
                'name' => 'モニタリング参考インデックス',
                'short_name' => 'MRI',
                'version' => 'beta',
                'summary' => '観測データの厚みと保全シグナルを俯瞰するための社内向け参考指標です。',
                'limitations' => [
                    '観測努力や参加者構成の影響を受けるため、環境価値そのものを単独で確定する指標ではありません。',
                    '存在記録ベースのため、不在や個体数の厳密な推定には使えません。',
                    '認証可否、法令適合、クレジット価格を直接示すものではありません。',
                ],
            ],
            'breakdown' => [
                'richness'           => ['label' => '種の多様性',        'raw' => 0, 'raw_label' => "多様度指数 H'=0（0種確認）", 'score' => 0, 'weighted' => 0, 'weight' => 0.30],
                'data_confidence'    => ['label' => 'データ信頼性',     'raw' => 0, 'raw_label' => '高品質データ率 0%（0/0件）',  'score' => 0, 'weighted' => 0, 'weight' => 0.20],
                'conservation_value' => ['label' => '保全価値',          'raw' => 0, 'raw_label' => 'レッドリスト該当 0種',       'score' => 0, 'weighted' => 0, 'weight' => 0.25, 'matches' => []],
                'taxonomic_coverage' => ['label' => '分類群カバー率',   'raw' => 0, 'raw_label' => '確認済み 0/8 分類群',        'score' => 0, 'weighted' => 0, 'weight' => 0.15, 'groups' => []],
                'monitoring_effort'  => ['label' => '調査の継続性',     'raw' => 0, 'raw_label' => '活動 0ヶ月 / 0年間',        'score' => 0, 'weighted' => 0, 'weight' => 0.10],
            ],
            'top_species' => [],
            'evaluation'  => self::evaluate(0),
        ];
    }

    /**
     * Calculate Shannon Diversity Index (H')
     */
    private static function calculateShannonIndex(array $speciesCounts): float
    {
        $totalIndividuals = array_sum($speciesCounts);
        $shannonIndex = 0.0;

        if ($totalIndividuals > 0) {
            foreach ($speciesCounts as $count) {
                $pi = $count / $totalIndividuals;
                $shannonIndex -= $pi * log($pi);
            }
        }
        return round($shannonIndex, 2);
    }

    /**
     * Get evaluation comment based on score
     */
    private static function evaluate(float $score): string
    {
        if ($score >= 80) return "観測データが比較的厚い状態";
        if ($score >= 60) return "複数の指標が揃いつつある状態";
        if ($score >= 40) return "基礎的な観測傾向が見え始めた状態";
        if ($score >= 20) return "継続観測と補足が必要な状態";
        return "判断に十分なデータがまだ少ない状態";
    }
}

/**
 * @deprecated Use MonitoringReferenceScorer instead.
 */
class BiodiversityScorer extends MonitoringReferenceScorer
{
}
