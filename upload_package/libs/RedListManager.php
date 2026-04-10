<?php

/**
 * RedListManager v2 — Global Red List lookup with MECE geographic scope
 *
 * Primary backend: OmoikaneDB.redlist_assessments (SQLite)
 * Fallback: Legacy JSON files in data/redlists/ (for migration period)
 *
 * MECE scope hierarchy:
 *   global → regional → national → subnational_1 → subnational_2
 *
 * 100-year resilience:
 *   - Geographic anchors (centroids) survive administrative mergers
 *   - Scope names are time-stamped snapshots
 *   - Multiple assessments per species (one per scope+authority)
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/OmoikaneDB.php';

class RedListManager
{
    private ?PDO $pdo = null;
    private bool $dbAvailable = false;

    private $nationalList = null;
    private $prefLists = [];
    private $dataDir;

    const CATEGORIES = [
        'EX'    => ['ja' => '絶滅', 'severity' => 7],
        'EW'    => ['ja' => '野生絶滅', 'severity' => 6],
        'CR'    => ['ja' => '絶滅危惧IA類', 'severity' => 5],
        'EN'    => ['ja' => '絶滅危惧IB類', 'severity' => 4],
        'CR+EN' => ['ja' => '絶滅危惧I類', 'severity' => 5],
        'VU'    => ['ja' => '絶滅危惧II類', 'severity' => 3],
        'NT'    => ['ja' => '準絶滅危惧', 'severity' => 2],
        'DD'    => ['ja' => '情報不足', 'severity' => 1],
        'LP'    => ['ja' => '絶滅のおそれのある地域個体群', 'severity' => 2],
        'LC'    => ['ja' => '低懸念', 'severity' => 0],
        'NE'    => ['ja' => '未評価', 'severity' => 0],
    ];

    const CATEGORY_COLORS = [
        'EX'    => '#1a1a2e',
        'EW'    => '#6b21a8',
        'CR'    => '#dc2626',
        'EN'    => '#ea580c',
        'CR+EN' => '#dc2626',
        'VU'    => '#eab308',
        'NT'    => '#22c55e',
        'DD'    => '#6b7280',
        'LP'    => '#3b82f6',
        'LC'    => '#a3e635',
        'NE'    => '#d4d4d8',
    ];

    public function __construct(?OmoikaneDB $db = null)
    {
        $this->dataDir = DATA_DIR . '/redlists';

        if (!is_dir($this->dataDir)) {
            mkdir($this->dataDir, 0755, true);
        }

        try {
            $db = $db ?? new OmoikaneDB();
            $this->pdo = $db->getPDO();
            $count = $this->pdo->query("SELECT COUNT(*) FROM redlist_assessments")->fetchColumn();
            $this->dbAvailable = ($count > 0);
        } catch (\Throwable $e) {
            $this->dbAvailable = false;
        }
    }

    /**
     * Look up a species by Japanese name and/or taxon ID.
     * Returns all matching assessments grouped by scope.
     *
     * @param string|int|null $taxonId GBIF taxon key
     * @param string|null $jaName Japanese common name
     * @param string|null $scopeHint Scope hint for filtering (e.g., 'shizuoka', 'JP-22', 'JP')
     * @return array|null Assessments grouped by scope_level, or null if not listed
     */
    public function lookupTaxon($taxonId = null, ?string $jaName = null, ?string $scopeHint = null): ?array
    {
        if ($this->dbAvailable) {
            return $this->lookupFromDb($taxonId, $jaName, $scopeHint);
        }
        return $this->lookupFromJson($taxonId, $jaName, $scopeHint);
    }

    /**
     * Legacy wrapper: lookup by Japanese name
     */
    public function lookup(string $jaName, ?string $prefecture = 'shizuoka'): ?array
    {
        $result = $this->lookupTaxon(null, $jaName, $prefecture);
        if ($result === null) return null;

        $legacy = [];
        if (isset($result['national'])) {
            $legacy['national'] = $result['national'][0] ?? $result['national'];
        }
        foreach ($result as $key => $entries) {
            if ($key !== 'national' && $key !== 'global' && $key !== 'regional') {
                $legacy[$key] = is_array($entries) && isset($entries[0]) ? $entries[0] : $entries;
            }
        }
        return !empty($legacy) ? $legacy : null;
    }

    /**
     * Look up multiple species at once
     */
    public function lookupMultiple(array $jaNames, ?string $prefecture = 'shizuoka'): array
    {
        $results = [];
        foreach ($jaNames as $name) {
            $result = $this->lookup($name, $prefecture);
            if ($result !== null) {
                $results[$name] = $result;
            }
        }
        return $results;
    }

    /**
     * Get all assessments for a species across ALL scopes (global view).
     * This is the world-standard query: "What is the conservation status of X everywhere?"
     */
    public function getGlobalAssessments(string $scientificName): array
    {
        if (!$this->dbAvailable) return [];

        $stmt = $this->pdo->prepare("
            SELECT * FROM redlist_assessments
            WHERE scientific_name = ?
            ORDER BY
                CASE scope_level
                    WHEN 'global' THEN 1
                    WHEN 'regional' THEN 2
                    WHEN 'national' THEN 3
                    WHEN 'subnational_1' THEN 4
                    WHEN 'subnational_2' THEN 5
                END,
                assessment_year DESC
        ");
        $stmt->execute([$scientificName]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(fn($r) => $this->enrichEntry($r, $r['scope_level'] . ':' . $r['scope_name']), $rows);
    }

    /**
     * Get the highest severity assessment for a species.
     * Used by ObservationSignificanceScorer for quick category lookup.
     */
    public function getHighestSeverity(string $jaName, ?string $scientificName = null): ?array
    {
        if (!$this->dbAvailable) {
            $result = $this->lookup($jaName);
            if (!$result) return null;
            $best = null;
            foreach ($result as $entry) {
                $sev = self::getSeverity($entry['category'] ?? '');
                if ($best === null || $sev > self::getSeverity($best['category'] ?? '')) {
                    $best = $entry;
                }
            }
            return $best;
        }

        $conditions = [];
        $params = [];

        if ($jaName) {
            $conditions[] = "japanese_name = ?";
            $params[] = $jaName;
        }
        if ($scientificName) {
            $conditions[] = "scientific_name = ?";
            $params[] = $scientificName;
        }

        if (empty($conditions)) return null;

        $where = implode(' OR ', $conditions);
        $stmt = $this->pdo->prepare("
            SELECT * FROM redlist_assessments
            WHERE ({$where})
            ORDER BY
                CASE category
                    WHEN 'EX' THEN 7 WHEN 'EW' THEN 6
                    WHEN 'CR' THEN 5 WHEN 'CR+EN' THEN 5
                    WHEN 'EN' THEN 4 WHEN 'VU' THEN 3
                    WHEN 'NT' THEN 2 WHEN 'LP' THEN 2
                    WHEN 'DD' THEN 1
                    ELSE 0
                END DESC
            LIMIT 1
        ");
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? $this->enrichEntry($row, $row['scope_level'] . ':' . $row['scope_name']) : null;
    }

    /**
     * Get all species in a given category from a specific scope
     */
    public function getByCategory(string $categoryCode, string $listId = 'national'): array
    {
        if ($this->dbAvailable) {
            $stmt = $this->pdo->prepare("
                SELECT * FROM redlist_assessments
                WHERE category = ? AND scope_level = ?
                ORDER BY scientific_name
            ");
            $scopeLevel = ($listId === 'national') ? 'national' : 'subnational_1';
            $stmt->execute([$categoryCode, $scopeLevel]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        if ($listId === 'national') {
            $this->loadNational();
            $list = $this->nationalList;
        } else {
            $this->loadPrefectural($listId);
            $list = $this->prefLists[$listId] ?? [];
        }

        return array_filter($list, fn($e) => ($e['category'] ?? '') === $categoryCode);
    }

    /**
     * Get summary statistics
     */
    public function getStats(string $listId = 'national'): array
    {
        if ($this->dbAvailable) {
            $scopeLevel = ($listId === 'national') ? 'national' : 'subnational_1';
            $stmt = $this->pdo->prepare("
                SELECT category, taxon_group, COUNT(*) as cnt
                FROM redlist_assessments
                WHERE scope_level = ?
                GROUP BY category, taxon_group
            ");
            $stmt->execute([$scopeLevel]);

            $stats = ['total' => 0, 'by_category' => [], 'by_taxon' => []];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $stats['total'] += $row['cnt'];
                $cat = $row['category'];
                $taxon = $row['taxon_group'] ?? 'Other';
                $stats['by_category'][$cat] = ($stats['by_category'][$cat] ?? 0) + $row['cnt'];
                $stats['by_taxon'][$taxon] = ($stats['by_taxon'][$taxon] ?? 0) + $row['cnt'];
            }

            uksort($stats['by_category'], function ($a, $b) {
                return (self::CATEGORIES[$b]['severity'] ?? 0) - (self::CATEGORIES[$a]['severity'] ?? 0);
            });
            return $stats;
        }

        if ($listId === 'national') {
            $this->loadNational();
            $list = $this->nationalList;
        } else {
            $this->loadPrefectural($listId);
            $list = $this->prefLists[$listId] ?? [];
        }

        $stats = ['total' => count($list), 'by_category' => [], 'by_taxon' => []];
        foreach ($list as $entry) {
            $cat = $entry['category'] ?? 'Unknown';
            $taxon = $entry['taxon_group'] ?? 'Other';
            $stats['by_category'][$cat] = ($stats['by_category'][$cat] ?? 0) + 1;
            $stats['by_taxon'][$taxon] = ($stats['by_taxon'][$taxon] ?? 0) + 1;
        }

        uksort($stats['by_category'], function ($a, $b) {
            return (self::CATEGORIES[$b]['severity'] ?? 0) - (self::CATEGORIES[$a]['severity'] ?? 0);
        });
        return $stats;
    }

    /**
     * Check observations against Red Lists
     */
    public function checkObservations(array $observations, string $prefecture = 'shizuoka'): array
    {
        $uniqueTaxa = [];
        foreach ($observations as $obs) {
            $id = $obs['taxon']['id'] ?? null;
            $name = $obs['taxon']['name'] ?? ($obs['species_name'] ?? null);
            if (!$id && !$name) continue;
            $key = $id ?? $name;
            if (!isset($uniqueTaxa[$key])) {
                $uniqueTaxa[$key] = ['id' => $id, 'name' => $name];
            }
        }

        $matches = [];
        foreach ($uniqueTaxa as $taxon) {
            $match = $this->lookupTaxon($taxon['id'], $taxon['name'], $prefecture);
            if ($match) {
                $displayName = $taxon['name'] ?: (string)$taxon['id'];
                $matches[$displayName] = $match;
            }
        }

        $summary = ['total' => count($matches), 'by_category' => [], 'by_list' => ['national' => 0]];
        if ($prefecture) $summary['by_list'][$prefecture] = 0;

        foreach ($matches as $lists) {
            foreach ($lists as $listId => $entryOrEntries) {
                $entries = isset($entryOrEntries[0]) ? $entryOrEntries : [$entryOrEntries];
                foreach ($entries as $entry) {
                    $cat = $entry['category'] ?? 'Unknown';
                    $summary['by_category'][$cat] = ($summary['by_category'][$cat] ?? 0) + 1;
                    $summary['by_list'][$listId] = ($summary['by_list'][$listId] ?? 0) + 1;
                }
            }
        }

        return ['species' => $matches, 'summary' => $summary];
    }

    /**
     * Get assessments for RAG context generation.
     * Returns structured chunks suitable for OmoikaneInferenceEnhancer.
     */
    public function getAssessmentChunks(string $jaName, ?string $scientificName = null): array
    {
        if (!$this->dbAvailable) return [];

        $conditions = [];
        $params = [];
        if ($jaName) {
            $conditions[] = "japanese_name = ?";
            $params[] = $jaName;
        }
        if ($scientificName) {
            $conditions[] = "scientific_name = ?";
            $params[] = $scientificName;
        }
        if (empty($conditions)) return [];

        $where = implode(' OR ', $conditions);
        $stmt = $this->pdo->prepare("
            SELECT * FROM redlist_assessments
            WHERE ({$where})
            ORDER BY
                CASE scope_level
                    WHEN 'global' THEN 1 WHEN 'regional' THEN 2
                    WHEN 'national' THEN 3 WHEN 'subnational_1' THEN 4
                    WHEN 'subnational_2' THEN 5
                END
        ");
        $stmt->execute($params);

        $chunks = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $label = self::getCategoryLabel($row['category']);
            $scopeLabel = $row['scope_name'];
            $yearStr = $row['assessment_year'] ? "({$row['assessment_year']})" : '';

            $text = "{$row['authority']} {$yearStr}: {$label}({$row['category']})";
            if ($row['criteria']) {
                $text .= " [criteria: {$row['criteria']}]";
            }
            $text .= " — {$scopeLabel}";

            $chunks[] = [
                'text'         => $text,
                'source_type'  => 'conservation_status',
                'source_tier'  => 'A',
                'doi'          => null,
                'source_title' => $row['authority'],
                'source_url'   => $row['source_url'],
                'taxon_key'    => $row['scientific_name'],
                'confidence'   => 0.95,
                'scope_level'  => $row['scope_level'],
                'category'     => $row['category'],
            ];
        }
        return $chunks;
    }

    // --- Static helpers ---

    public static function getCategoryColor(string $category): string
    {
        return self::CATEGORY_COLORS[$category] ?? '#6b7280';
    }

    public static function getCategoryLabel(string $category): string
    {
        return self::CATEGORIES[$category]['ja'] ?? $category;
    }

    public static function getSeverity(string $category): int
    {
        return self::CATEGORIES[$category]['severity'] ?? 0;
    }

    // --- Private: OmoikaneDB backend ---

    private function lookupFromDb($taxonId, ?string $jaName, ?string $scopeHint): ?array
    {
        $conditions = [];
        $params = [];

        if ($taxonId) {
            $conditions[] = "taxon_key = ?";
            $params[] = (int)$taxonId;
        }
        if ($jaName) {
            $jaNameNorm = $this->normalizeName($jaName);
            $conditions[] = "japanese_name = ?";
            $params[] = $jaNameNorm;
        }

        if (empty($conditions)) return null;

        $where = implode(' OR ', $conditions);
        $stmt = $this->pdo->prepare("
            SELECT * FROM redlist_assessments
            WHERE ({$where})
            ORDER BY
                CASE scope_level
                    WHEN 'global' THEN 1 WHEN 'regional' THEN 2
                    WHEN 'national' THEN 3 WHEN 'subnational_1' THEN 4
                    WHEN 'subnational_2' THEN 5
                END,
                assessment_year DESC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($rows)) return null;

        $grouped = [];
        foreach ($rows as $row) {
            $key = $row['scope_level'];
            if ($key === 'subnational_1' || $key === 'subnational_2') {
                $key = $row['region_code'] ?? $row['scope_name'];
            }
            $grouped[$key][] = $this->enrichEntry($row, $row['scope_level'] . ':' . $row['scope_name']);
        }

        if ($scopeHint) {
            $filtered = $this->filterByScope($grouped, $scopeHint);
            if (!empty($filtered)) return $filtered;
        }

        return $grouped;
    }

    private function filterByScope(array $grouped, string $hint): array
    {
        $hint = strtolower($hint);
        $result = [];

        if (isset($grouped['national'])) {
            $result['national'] = $grouped['national'];
        }
        if (isset($grouped['global'])) {
            $result['global'] = $grouped['global'];
        }

        foreach ($grouped as $key => $entries) {
            if ($key === 'national' || $key === 'global') continue;
            foreach ($entries as $entry) {
                $matchFields = [
                    strtolower($entry['region_code'] ?? ''),
                    strtolower($entry['scope_name'] ?? ''),
                    strtolower($entry['scope_name_en'] ?? ''),
                    strtolower($entry['municipality_code'] ?? ''),
                ];
                foreach ($matchFields as $field) {
                    if ($field && str_contains($field, $hint)) {
                        $result[$key] = $entries;
                        break 2;
                    }
                }
            }
        }

        return $result;
    }

    // --- Private: Legacy JSON fallback ---

    private function lookupFromJson($taxonId, ?string $jaName, ?string $scopeHint): ?array
    {
        $this->loadNational();
        $result = [];
        $found = false;
        $jaNameNorm = $jaName ? $this->normalizeName($jaName) : null;

        foreach ($this->nationalList as $entry) {
            $matchId = $taxonId && isset($entry['taxon_id']) && (string)$entry['taxon_id'] === (string)$taxonId;
            $matchName = $jaNameNorm && $this->normalizeName($entry['ja_name'] ?? '') === $jaNameNorm;
            if ($matchId || $matchName) {
                $result['national'] = $this->enrichEntry($entry, 'national');
                $found = true;
                break;
            }
        }

        $prefecture = $scopeHint ?? 'shizuoka';
        $this->loadPrefectural($prefecture);
        foreach ($this->prefLists[$prefecture] as $entry) {
            $matchId = $taxonId && isset($entry['taxon_id']) && (string)$entry['taxon_id'] === (string)$taxonId;
            $matchName = $jaNameNorm && $this->normalizeName($entry['ja_name'] ?? '') === $jaNameNorm;
            if ($matchId || $matchName) {
                $result[$prefecture] = $this->enrichEntry($entry, $prefecture);
                $found = true;
                break;
            }
        }

        return $found ? $result : null;
    }

    private function loadNational(): void
    {
        if ($this->nationalList !== null) return;
        $file = $this->dataDir . '/env_ministry.json';
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true);
            $this->nationalList = $data['species'] ?? [];
        } else {
            $this->nationalList = [];
        }
    }

    private function loadPrefectural(string $prefCode): void
    {
        if (isset($this->prefLists[$prefCode])) return;
        $file = $this->dataDir . "/{$prefCode}.json";
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true);
            $this->prefLists[$prefCode] = $data['species'] ?? [];
        } else {
            $this->prefLists[$prefCode] = [];
        }
    }

    private function normalizeName(string $name): string
    {
        $name = trim($name);
        $name = mb_convert_kana($name, 'KVC');
        return $name;
    }

    private function enrichEntry(array $entry, string $listId): array
    {
        $entry['list_id'] = $listId;
        $cat = $entry['category'] ?? '';
        $entry['category_label'] = self::getCategoryLabel($cat);
        $entry['category_color'] = self::getCategoryColor($cat);
        $entry['severity'] = self::getSeverity($cat);
        return $entry;
    }
}
