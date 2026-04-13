<?php

/**
 * RedListManager - Red List species lookup across national and prefectural lists
 * 
 * Provides unified access to:
 *   - 環境省レッドリスト (Ministry of Environment, national)
 *   - 都道府県レッドリスト (Prefectural, starting with Shizuoka)
 * 
 * Data is stored as JSON in data/redlists/
 * Species matching is done by Japanese common name (和名) as primary key.
 * 
 * Usage:
 *   $rl = new RedListManager();
 *   $result = $rl->lookup('ニホンイシガメ');
 *   // => ['national' => ['category' => '準絶滅危惧', 'category_en' => 'NT', ...], 'shizuoka' => [...]]
 *   
 *   $result = $rl->lookupMultiple(['ニホンイシガメ', 'カブトムシ', 'ミカワバイケイソウ']);
 *   // => associative array keyed by species name
 */

require_once __DIR__ . '/../config/config.php';

class RedListManager
{

    private $nationalList = null;   // 環境省レッドリスト
    private $prefLists = [];        // 都道府県レッドリスト (keyed by pref code)
    private $dataDir;

    // 環境省カテゴリの正規化マッピング
    const CATEGORIES = [
        'EX'  => ['ja' => '絶滅', 'severity' => 7],
        'EW'  => ['ja' => '野生絶滅', 'severity' => 6],
        'CR'  => ['ja' => '絶滅危惧IA類', 'severity' => 5],
        'EN'  => ['ja' => '絶滅危惧IB類', 'severity' => 4],
        'CR+EN' => ['ja' => '絶滅危惧I類', 'severity' => 5],
        'VU'  => ['ja' => '絶滅危惧II類', 'severity' => 3],
        'NT'  => ['ja' => '準絶滅危惧', 'severity' => 2],
        'DD'  => ['ja' => '情報不足', 'severity' => 1],
        'LP'  => ['ja' => '絶滅のおそれのある地域個体群', 'severity' => 2],
    ];

    // カテゴリ → CSSカラーマッピング（UI用）
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
    ];

    public function __construct()
    {
        $this->dataDir = DATA_DIR . '/redlists';

        // Ensure data directory exists
        if (!is_dir($this->dataDir)) {
            mkdir($this->dataDir, 0755, true);
        }
    }

    /**
     * Load the national (環境省) Red List
     */
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

    /**
     * Load a prefectural Red List
     * @param string $prefCode Prefecture code (e.g. 'shizuoka', 'aichi')
     */
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

    /**
     * Look up a species by Japanese common name (和名)
     * 
     * @param string $jaName Japanese common name
     * @param string|null $prefecture Prefecture code to check (default: 'shizuoka')
     * @return array|null Array with 'national' and prefectural keys, or null if not listed
     */
    public function lookup(string $jaName, ?string $prefecture = 'shizuoka'): ?array
    {
        return $this->lookupTaxon(null, $jaName, $prefecture);
    }

    /**
     * Look up a species by Taxon Concept ID (Primary) and/or Japanese name (Fallback)
     * Future-proof (100-year architecture)
     * 
     * @param string|int|null $taxonId Immutable Taxon Concept ID (e.g., GBIF TaxonKey)
     * @param string|null $jaName Fallback Japanese common name
     * @param string|null $prefecture Prefecture code
     */
    public function lookupTaxon($taxonId, ?string $jaName = null, ?string $prefecture = 'shizuoka'): ?array
    {
        $this->loadNational();

        $result = [];
        $found = false;

        $jaNameNorm = $jaName ? $this->normalizeName($jaName) : null;

        // Check national list
        foreach ($this->nationalList as $entry) {
            $matchId = $taxonId && isset($entry['taxon_id']) && (string)$entry['taxon_id'] === (string)$taxonId;
            $matchName = $jaNameNorm && $this->normalizeName($entry['ja_name']) === $jaNameNorm;

            if ($matchId || $matchName) {
                $result['national'] = $this->enrichEntry($entry, 'national');
                $found = true;
                break;
            }
        }

        // Check prefectural list
        if ($prefecture) {
            $this->loadPrefectural($prefecture);
            foreach ($this->prefLists[$prefecture] as $entry) {
                $matchId = $taxonId && isset($entry['taxon_id']) && (string)$entry['taxon_id'] === (string)$taxonId;
                $matchName = $jaNameNorm && $this->normalizeName($entry['ja_name']) === $jaNameNorm;

                if ($matchId || $matchName) {
                    $result[$prefecture] = $this->enrichEntry($entry, $prefecture);
                    $found = true;
                    break;
                }
            }
        }

        return $found ? $result : null;
    }

    /**
     * Look up multiple species at once by name (Legacy wrapper)
     * 
     * @param array $jaNames Array of Japanese common names
     * @param string|null $prefecture Prefecture code
     * @return array Associative array keyed by species name
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
     * Get all species in a given category from a specific list
     * 
     * @param string $categoryCode e.g. 'VU', 'NT', 'CR'
     * @param string $listId 'national' or prefecture code
     * @return array
     */
    public function getByCategory(string $categoryCode, string $listId = 'national'): array
    {
        if ($listId === 'national') {
            $this->loadNational();
            $list = $this->nationalList;
        } else {
            $this->loadPrefectural($listId);
            $list = $this->prefLists[$listId] ?? [];
        }

        return array_filter($list, function ($entry) use ($categoryCode) {
            return ($entry['category'] ?? '') === $categoryCode;
        });
    }

    /**
     * Get summary statistics for a list
     * 
     * @param string $listId 'national' or prefecture code
     * @return array
     */
    public function getStats(string $listId = 'national'): array
    {
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

        // Sort categories by severity
        uksort($stats['by_category'], function ($a, $b) {
            $sevA = self::CATEGORIES[$a]['severity'] ?? 0;
            $sevB = self::CATEGORIES[$b]['severity'] ?? 0;
            return $sevB - $sevA;
        });

        return $stats;
    }

    /**
     * Check a list of observation species against Red Lists.
     * Returns only the matches (red-listed species found in observations).
     * 
     * This is the key function for site reports.
     * 
     * @param array $observations Array of observations with 'taxon.id' or 'taxon.name'
     * @param string $prefecture Prefecture code
     * @return array{species: array<string, array<string, array{severity: int, category: string, category_label: string, category_color: string, list_id: string}>>, summary: array{total: int, by_category: array<string, int>, by_list: array<string, int>}}
     */
    public function checkObservations(array $observations, string $prefecture = 'shizuoka'): array
    {
        // Extract unique taxa (combining ID and name)
        $uniqueTaxa = [];
        foreach ($observations as $obs) {
            $id = $obs['taxon']['id'] ?? null;
            $name = $obs['taxon']['name'] ?? ($obs['species_name'] ?? null);

            if (!$id && !$name) continue;

            // Generate a unique cache key for uniqueness deduplication
            $key = $id ?? $name;
            if (!isset($uniqueTaxa[$key])) {
                $uniqueTaxa[$key] = ['id' => $id, 'name' => $name];
            }
        }

        $matches = [];
        foreach ($uniqueTaxa as $key => $taxon) {
            $match = $this->lookupTaxon($taxon['id'], $taxon['name'], $prefecture);
            if ($match) {
                // Key by name for UI compatibility, fallback to ID if no name
                $displayName = $taxon['name'] ?: (string)$taxon['id'];
                $matches[$displayName] = $match;
            }
        }

        // Build summary
        $summary = ['total' => count($matches), 'by_category' => [], 'by_list' => ['national' => 0]];
        if ($prefecture) $summary['by_list'][$prefecture] = 0;

        foreach ($matches as $name => $lists) {
            foreach ($lists as $listId => $entry) {
                $cat = $entry['category'] ?? 'Unknown';
                $summary['by_category'][$cat] = ($summary['by_category'][$cat] ?? 0) + 1;
                $summary['by_list'][$listId] = ($summary['by_list'][$listId] ?? 0) + 1;
            }
        }

        return [
            'species' => $matches,
            'summary' => $summary
        ];
    }

    /**
     * Get the CSS color for a category
     */
    public static function getCategoryColor(string $category): string
    {
        return self::CATEGORY_COLORS[$category] ?? '#6b7280';
    }

    /**
     * Get the Japanese label for a category
     */
    public static function getCategoryLabel(string $category): string
    {
        return self::CATEGORIES[$category]['ja'] ?? $category;
    }

    /**
     * Get severity level (0-7) for a category
     */
    public static function getSeverity(string $category): int
    {
        return self::CATEGORIES[$category]['severity'] ?? 0;
    }

    // --- Private helpers ---

    private function normalizeName(string $name): string
    {
        // Remove whitespace, normalize katakana/hiragana
        $name = trim($name);
        $name = mb_convert_kana($name, 'KVC'); // Normalize fullwidth to halfwidth, katakana to katakana
        return $name;
    }

    private function enrichEntry(array $entry, string $listId): array
    {
        $entry['list_id'] = $listId;
        $entry['category_label'] = self::getCategoryLabel($entry['category'] ?? '');
        $entry['category_color'] = self::getCategoryColor($entry['category'] ?? '');
        $entry['severity'] = self::getSeverity($entry['category'] ?? '');
        return $entry;
    }
}
