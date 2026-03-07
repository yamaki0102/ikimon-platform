<?php

/**
 * ReportEngine — B2Bレポート共通基盤
 *
 * 全レポートテンプレートが使うデータ取得・集計ロジックを集約。
 * generate_site_report.php / generate_tnfd_report.php 等から呼ばれる。
 *
 * Usage:
 *   $engine = new ReportEngine($siteId, ['start_date' => '2025-01-01', 'end_date' => '2025-12-31']);
 *   $data = $engine->compile();
 *   // $data contains all computed metrics for any template
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/SiteManager.php';
require_once __DIR__ . '/RedListManager.php';
require_once __DIR__ . '/BiodiversityScorer.php';

class ReportEngine
{
    private string $siteId;
    private ?string $startDate;
    private ?string $endDate;
    private bool $publicMode;

    /** @var array|null Cached compiled data */
    private ?array $compiled = null;

    public function __construct(string $siteId, array $options = [])
    {
        $this->siteId = $siteId;
        $this->startDate = $options['start_date'] ?? null;
        $this->endDate = $options['end_date'] ?? null;
        $this->publicMode = $options['public_mode'] ?? false;
    }

    /**
     * Compile all report data. Cached after first call.
     * @return array
     */
    public function compile(): array
    {
        if ($this->compiled !== null) {
            return $this->compiled;
        }

        // --- Load Site ---
        $site = SiteManager::load($this->siteId);
        if (!$site) {
            throw new \RuntimeException("Site not found: {$this->siteId}");
        }

        // --- Collect Observations ---
        $siteObs = $this->filterObservations($site);

        // --- Compute Statistics ---
        $stats = $this->computeStatistics($siteObs);

        // --- Red List Assessment ---
        $redListManager = new RedListManager();
        $redListResult = $redListManager->checkObservations($siteObs, 'shizuoka');
        $stats['speciesMap'] = $this->enrichWithRedList($stats['speciesMap'], $redListResult['species']);
        $stats['redListSpecies'] = $redListResult['species'];
        $stats['redListSummary'] = $redListResult['summary'];

        // --- Monitoring reference index ---
        $areaHa = $site['properties']['area_ha'] ?? 0;
        $referenceIndexResult = MonitoringReferenceScorer::calculate($siteObs, ['area_ha' => $areaHa]);
        $stats['monitoringReferenceIndex'] = $referenceIndexResult['total_score'];
        $stats['monitoringReferenceBreakdown'] = $referenceIndexResult['breakdown'];
        $stats['monitoringReferenceColor'] = $stats['monitoringReferenceIndex'] >= 75 ? '#10b981' : ($stats['monitoringReferenceIndex'] >= 50 ? '#eab308' : ($stats['monitoringReferenceIndex'] >= 25 ? '#f97316' : '#ef4444'));

        // --- Events ---
        $stats['events'] = $this->collectEvents($site, $siteObs);

        // --- Report Metadata ---
        $stats['reportDate'] = date('Y年m月d日');
        $stats['reportPeriod'] = $this->computeReportPeriod($stats['firstObs'], $stats['lastObs']);
        $stats['siteName'] = $site['properties']['name'] ?? $site['name'] ?? $this->siteId;
        $stats['siteNameEn'] = $site['properties']['name_en'] ?? '';
        $stats['siteId'] = $this->siteId;
        $stats['site'] = $site;
        $stats['siteObs'] = $siteObs;
        $stats['areaHa'] = $areaHa;

        // --- Photos (top observations with images) ---
        $stats['photos'] = $this->collectPhotos($siteObs, 12);

        $this->compiled = $stats;
        return $this->compiled;
    }

    // ─────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────

    /**
     * Filter observations by site and date range
     */
    private function filterObservations(array $site): array
    {
        $siteObs = [];
        foreach (SiteManager::getObservationsInSite($this->siteId) as $obs) {
            // Date filtering
            $obsDate = $obs['observed_at'] ?? ($obs['created_at'] ?? null);
            if ($obsDate) {
                $dateOnly = substr($obsDate, 0, 10);
                if ($this->startDate && $dateOnly < $this->startDate) continue;
                if ($this->endDate && $dateOnly > $this->endDate) continue;
            }
            $siteObs[] = $obs;
        }
        return $siteObs;
    }

    /**
     * Compute all statistics from observations
     */
    private function computeStatistics(array $siteObs): array
    {
        $speciesMap = [];
        $taxonomyBreakdown = [];
        $monthlyTrend = [];
        $researchGradeCount = 0;
        $firstObs = null;
        $lastObs = null;
        $observerSet = []; // unique observers

        foreach ($siteObs as $obs) {
            $name = $obs['taxon']['name'] ?? ($obs['species_name'] ?? '不明');
            $sciName = $obs['taxon']['scientific_name'] ?? ($obs['scientific_name'] ?? '');
            $taxonGroup = $obs['taxon']['class'] ?? ($obs['taxon']['kingdom'] ?? 'Other');

            $taxonGroupJa = match ($taxonGroup) {
                'Insecta' => '昆虫類',
                'Arachnida' => 'クモ類',
                'Aves' => '鳥類',
                'Mammalia' => '哺乳類',
                'Reptilia' => '爬虫類',
                'Amphibia' => '両生類',
                'Actinopterygii' => '魚類',
                'Plantae' => '植物',
                'Fungi' => '菌類',
                default => 'その他',
            };

            if (!isset($speciesMap[$name])) {
                $speciesMap[$name] = [
                    'count' => 0,
                    'sci_name' => $sciName,
                    'taxon_group' => $taxonGroupJa,
                    'last_seen' => null
                ];
            }
            $speciesMap[$name]['count']++;

            // Date tracking
            $date = $obs['observed_at'] ?? ($obs['created_at'] ?? null);
            if ($date) {
                $ts = strtotime($date);
                if ($ts) {
                    $ym = date('Y-m', $ts);
                    $monthlyTrend[$ym] = ($monthlyTrend[$ym] ?? 0) + 1;

                    if ($speciesMap[$name]['last_seen'] === null || $date > $speciesMap[$name]['last_seen']) {
                        $speciesMap[$name]['last_seen'] = $date;
                    }
                    if ($firstObs === null || $date < $firstObs) $firstObs = $date;
                    if ($lastObs === null || $date > $lastObs) $lastObs = $date;
                }
            }

            // Taxonomy breakdown
            $taxonomyBreakdown[$taxonGroupJa] = ($taxonomyBreakdown[$taxonGroupJa] ?? 0) + 1;

            // Research Grade
            if (($obs['quality_grade'] ?? ($obs['status'] ?? '')) === 'Research Grade') {
                $researchGradeCount++;
            }

            // Track unique observers
            $userId = $obs['user_id'] ?? ($obs['observer_id'] ?? null);
            if ($userId) {
                $observerSet[$userId] = true;
            }
        }

        ksort($monthlyTrend);
        arsort($taxonomyBreakdown);

        $totalObs = count($siteObs);
        $totalSpecies = count($speciesMap);
        $researchGradePercent = $totalObs > 0 ? round(($researchGradeCount / $totalObs) * 100, 1) : 0;

        // Sort species: Red-listed first (by severity desc), then by count desc
        uasort($speciesMap, function ($a, $b) {
            $sevA = $a['redlist_severity'] ?? 0;
            $sevB = $b['redlist_severity'] ?? 0;
            if ($sevA !== $sevB) return $sevB - $sevA;
            return $b['count'] - $a['count'];
        });

        return [
            'speciesMap' => $speciesMap,
            'taxonomyBreakdown' => $taxonomyBreakdown,
            'monthlyTrend' => $monthlyTrend,
            'researchGradeCount' => $researchGradeCount,
            'researchGradePercent' => $researchGradePercent,
            'totalObs' => $totalObs,
            'totalSpecies' => $totalSpecies,
            'totalObservers' => count($observerSet),
            'firstObs' => $firstObs,
            'lastObs' => $lastObs,
        ];
    }

    /**
     * Enrich species map with red list data
     */
    private function enrichWithRedList(array $speciesMap, array $redListSpecies): array
    {
        foreach ($redListSpecies as $name => $lists) {
            if (isset($speciesMap[$name])) {
                $speciesMap[$name]['redlist'] = $lists;
                $maxSeverity = 0;
                foreach ($lists as $listEntry) {
                    if ($listEntry['severity'] > $maxSeverity) {
                        $maxSeverity = $listEntry['severity'];
                    }
                }
                $speciesMap[$name]['redlist_severity'] = $maxSeverity;
            }
        }
        return $speciesMap;
    }

    /**
     * Collect events linked to this site
     */
    private function collectEvents(array $site, array $siteObs): array
    {
        $siteEvents = [];
        $allEvents = DataStore::fetchAll('events') ?: [];

        foreach ($allEvents as $ev) {
            if (($ev['site_id'] ?? '') === $this->siteId) {
                $siteEvents[] = $ev;
            } elseif (isset($ev['lat'], $ev['lng']) && isset($site['geometry'])) {
                if (SiteManager::isPointInGeometry(floatval($ev['lat']), floatval($ev['lng']), $site['geometry'])) {
                    $siteEvents[] = $ev;
                }
            }
        }

        // Count observations per event
        foreach ($siteEvents as &$ev) {
            $evObsCount = 0;
            $evSpecies = [];
            foreach ($siteObs as $obs) {
                if (($obs['event_id'] ?? '') === ($ev['id'] ?? '')) {
                    $evObsCount++;
                    $spName = $obs['taxon']['name'] ?? ($obs['species_name'] ?? null);
                    if ($spName) $evSpecies[$spName] = true;
                }
            }
            $ev['obs_count'] = $evObsCount;
            $ev['species_count'] = count($evSpecies);
        }
        unset($ev);

        usort($siteEvents, fn($a, $b) => strcmp($b['event_date'] ?? '', $a['event_date'] ?? ''));
        return $siteEvents;
    }

    /**
     * Collect top photos from observations
     */
    private function collectPhotos(array $siteObs, int $limit = 12): array
    {
        $photos = [];
        foreach ($siteObs as $obs) {
            $photoUrl = $obs['photo_url'] ?? ($obs['photos'][0]['url'] ?? null);
            if ($photoUrl) {
                $photos[] = [
                    'url' => $photoUrl,
                    'species' => $obs['taxon']['name'] ?? ($obs['species_name'] ?? '不明'),
                    'date' => $obs['observed_at'] ?? ($obs['created_at'] ?? ''),
                    'observer' => $obs['user_name'] ?? ($obs['observer_name'] ?? ''),
                ];
            }
            if (count($photos) >= $limit) break;
        }
        return $photos;
    }

    /**
     * Compute human-readable report period
     */
    private function computeReportPeriod(?string $firstObs, ?string $lastObs): string
    {
        if ($this->startDate && $this->endDate) {
            return date('Y年n月d日', strtotime($this->startDate)) . ' ～ ' . date('Y年n月d日', strtotime($this->endDate));
        }
        if ($firstObs) {
            return date('Y年n月', strtotime($firstObs)) . ' ～ ' . date('Y年n月', strtotime($lastObs));
        }
        return '観測記録がまだないため、まずは基準となる初回観測の追加が必要';
    }

    // ─────────────────────────────────────────
    // Convenience accessors
    // ─────────────────────────────────────────

    /** Get single compiled value */
    public function get(string $key, $default = null)
    {
        $data = $this->compile();
        return $data[$key] ?? $default;
    }

    /** Get the site ID */
    public function getSiteId(): string
    {
        return $this->siteId;
    }
}
