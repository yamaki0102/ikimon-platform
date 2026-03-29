<?php

/**
 * Project OMOIKANE - Inference Enhancer
 * Cross-validates Gemini AI suggestions against the Omoikane knowledge graph.
 *
 * Flow:
 *   Gemini suggestions → split examples → search Omoikane by Japanese name
 *   → compare habitat/season with observation context → score & re-rank
 */

require_once __DIR__ . '/OmoikaneDB.php';

class OmoikaneInferenceEnhancer
{
    private $pdo;

    /** Confidence label → numeric score */
    private const CONFIDENCE_SCORES = [
        'high' => 0.9,
        'medium' => 0.6,
        'low' => 0.3,
    ];

    /** Month → season mapping */
    private const MONTH_TO_SEASON = [
        1 => 'winter', 2 => 'winter', 3 => 'spring',
        4 => 'spring', 5 => 'spring', 6 => 'summer',
        7 => 'summer', 8 => 'summer', 9 => 'autumn',
        10 => 'autumn', 11 => 'autumn', 12 => 'winter',
    ];

    /** Biome → habitat term mapping for cross-referencing */
    private const BIOME_HABITAT_MAP = [
        'forest' => ['forest', '森', '林', 'woodland', 'broadleaf'],
        'grassland' => ['grassland', '草原', '草地', 'meadow', 'savanna'],
        'wetland' => ['wetland', '湿地', '水辺', 'marsh', 'swamp', 'bog'],
        'urban' => ['urban', '都市', '公園', 'garden', 'residential', 'park'],
        'coastal' => ['coastal', '海岸', '干潟', 'shore', 'beach', 'marine'],
        'mountain' => ['mountain', '山', '高山', 'alpine', 'highland'],
        'freshwater' => ['river', '川', '河川', 'stream', 'pond', 'lake', 'riparian'],
    ];

    public function __construct(?OmoikaneDB $db = null)
    {
        $db = $db ?? new OmoikaneDB();
        $this->pdo = $db->getPDO();
    }

    /**
     * Cross-validate Gemini suggestions against Omoikane data.
     *
     * @param array $suggestions Gemini suggestions array (each has label, confidence, examples, etc.)
     * @param array $environment Gemini environment analysis (biome, vegetation, etc.)
     * @param array $context     Observation context: ['lat', 'lng', 'observed_at']
     * @return array ['suggestions' => enriched suggestions with omoikane_support/conflict/caution]
     */
    public function crossValidate(array $suggestions, array $environment, array $context): array
    {
        $observedMonth = null;
        if (!empty($context['observed_at'])) {
            $ts = strtotime($context['observed_at']);
            if ($ts) $observedMonth = (int)date('n', $ts);
        }
        $biome = strtolower($environment['biome'] ?? '');

        // Diagnostic counters
        $totalExamples = 0;
        $searchedExamples = 0;
        $matchedExamples = 0;
        $matchedByJaName = 0;
        $matchedByFallback = 0;

        foreach ($suggestions as &$suggestion) {
            $support = 0.0;
            $conflict = 0.0;
            $caution = null;
            $matchCount = 0;
            $cautionReasons = [];

            // Parse examples: "ヤマトシジミ, ベニシジミ" → array
            $examples = $this->parseExamples($suggestion['examples'] ?? '');
            $totalExamples += count($examples);

            foreach ($examples as $japaneseName) {
                $searchedExamples++;
                $species = $this->findByJapaneseName($japaneseName);
                if (!$species) continue;
                $matchedExamples++;
                $matchCount++;
                if (($species['match_source'] ?? '') === 'japanese_name') $matchedByJaName++;
                else $matchedByFallback++;

                // Habitat check
                $habitatResult = $this->checkHabitatMatch($species, $biome);
                $support += $habitatResult['support'];
                $conflict += $habitatResult['conflict'];
                if ($habitatResult['conflict'] > 0.3) {
                    $cautionReasons[] = "{$japaneseName}: 生息環境が異なる可能性";
                }

                // Season check
                $seasonResult = $this->checkSeasonMatch($species, $observedMonth);
                $support += $seasonResult['support'];
                $conflict += $seasonResult['conflict'];
                if ($seasonResult['conflict'] > 0.3) {
                    $cautionReasons[] = "{$japaneseName}: 活動時期が異なる可能性";
                }
            }

            // Normalize scores by match count
            if ($matchCount > 0) {
                $support = min($support / $matchCount, 1.0);
                $conflict = min($conflict / $matchCount, 1.0);
            }
            // No match → neutral (don't change ranking)

            if (!empty($cautionReasons)) {
                $caution = implode('。', array_slice($cautionReasons, 0, 2));
            }

            $suggestion['omoikane_support'] = round($support, 2);
            $suggestion['omoikane_conflict'] = round($conflict, 2);
            $suggestion['caution'] = $caution;
        }
        unset($suggestion);

        // Re-rank: composite score = gemini_confidence + support*0.3 - conflict*0.2
        usort($suggestions, function ($a, $b) {
            $scoreA = (self::CONFIDENCE_SCORES[$a['confidence'] ?? 'low'] ?? 0.3)
                    + ($a['omoikane_support'] ?? 0) * 0.3
                    - ($a['omoikane_conflict'] ?? 0) * 0.2;
            $scoreB = (self::CONFIDENCE_SCORES[$b['confidence'] ?? 'low'] ?? 0.3)
                    + ($b['omoikane_support'] ?? 0) * 0.3
                    - ($b['omoikane_conflict'] ?? 0) * 0.2;
            return $scoreB <=> $scoreA;
        });

        return [
            'suggestions' => $suggestions,
            'stats' => [
                'examples_total' => $totalExamples,
                'examples_searched' => $searchedExamples,
                'examples_matched' => $matchedExamples,
                'matched_by_ja_name' => $matchedByJaName,
                'matched_by_fallback' => $matchedByFallback,
            ],
        ];
    }

    // --- Private helpers ---

    /**
     * Split examples string into individual Japanese names.
     * Handles "ヤマトシジミ, ベニシジミ" and "ヤマトシジミ・ベニシジミ"
     */
    private function parseExamples(string $examples): array
    {
        if (empty(trim($examples))) return [];
        $names = preg_split('/[,、・\s]+/u', $examples);
        return array_filter(array_map('trim', $names), fn($n) => mb_strlen($n) > 1);
    }

    /**
     * Search Omoikane by Japanese name.
     * Priority: 1) species.japanese_name exact match  2) LIKE fallback on text fields
     * Returns the highest trust_score match, or null if not found.
     */
    private function findByJapaneseName(string $japaneseName): ?array
    {
        // Priority 1: Exact match on structured japanese_name column
        $stmt = $this->pdo->prepare("
            SELECT s.id, s.scientific_name, s.japanese_name,
                   e.habitat, e.altitude, e.season, e.notes,
                   COALESCE(ts.trust_score, 0.0) AS trust_score,
                   'japanese_name' AS match_source
            FROM species s
            LEFT JOIN ecological_constraints e ON s.id = e.species_id
            LEFT JOIN trust_scores ts ON s.id = ts.species_id
            WHERE s.distillation_status = 'distilled'
              AND s.japanese_name = :name
            ORDER BY COALESCE(ts.trust_score, 0.0) DESC
            LIMIT 1
        ");
        $stmt->execute([':name' => $japaneseName]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) return $row;

        // Priority 2: LIKE fallback on notes/traits (low precision, kept for coverage)
        $likeName = '%' . $japaneseName . '%';
        $stmt = $this->pdo->prepare("
            SELECT s.id, s.scientific_name, s.japanese_name,
                   e.habitat, e.altitude, e.season, e.notes,
                   COALESCE(ts.trust_score, 0.0) AS trust_score,
                   'like_fallback' AS match_source
            FROM species s
            LEFT JOIN ecological_constraints e ON s.id = e.species_id
            LEFT JOIN identification_keys k ON s.id = k.species_id
            LEFT JOIN trust_scores ts ON s.id = ts.species_id
            WHERE s.distillation_status = 'distilled'
              AND (e.notes LIKE :n1
                   OR k.morphological_traits LIKE :n2
                   OR k.key_differences LIKE :n3)
            ORDER BY COALESCE(ts.trust_score, 0.0) DESC
            LIMIT 1
        ");
        $stmt->execute([':n1' => $likeName, ':n2' => $likeName, ':n3' => $likeName]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Retrieve RAG context for fun_fact generation.
     * Collects ecological, morphological, and distilled knowledge from OmoikaneDB.
     * Returns a text string (≤500 chars) or null if no data found.
     */
    public function retrieveFunFactContext(string $japaneseName, string $scientificName): ?string
    {
        $speciesId = null;

        if (!empty($japaneseName)) {
            $stmt = $this->pdo->prepare("
                SELECT id FROM species
                WHERE japanese_name = :name AND distillation_status = 'distilled'
                LIMIT 1
            ");
            $stmt->execute([':name' => $japaneseName]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) $speciesId = $row['id'];
        }

        if (!$speciesId && !empty($scientificName)) {
            $stmt = $this->pdo->prepare("
                SELECT id FROM species WHERE scientific_name = :name LIMIT 1
            ");
            $stmt->execute([':name' => $scientificName]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) $speciesId = $row['id'];
        }

        if (!$speciesId) return null;

        $parts = [];

        $stmt = $this->pdo->prepare("
            SELECT habitat, season, notes
            FROM ecological_constraints WHERE species_id = :id LIMIT 1
        ");
        $stmt->execute([':id' => $speciesId]);
        $eco = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($eco) {
            if (!empty($eco['habitat'])) $parts[] = '生息地: ' . $eco['habitat'];
            if (!empty($eco['season'])) $parts[] = '活動時期: ' . $eco['season'];
            if (!empty($eco['notes'])) $parts[] = $eco['notes'];
        }

        $stmt = $this->pdo->prepare("
            SELECT morphological_traits, key_differences
            FROM identification_keys WHERE species_id = :id LIMIT 1
        ");
        $stmt->execute([':id' => $speciesId]);
        $key = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($key) {
            if (!empty($key['morphological_traits'])) $parts[] = '形態: ' . $key['morphological_traits'];
            if (!empty($key['key_differences'])) $parts[] = '見分け方: ' . $key['key_differences'];
        }

        // distilled_knowledge: try by integer species_id and by scientific_name as taxon_key
        $stmt = $this->pdo->prepare("
            SELECT content FROM distilled_knowledge
            WHERE (taxon_key = :id_str OR taxon_key = :sci)
              AND knowledge_type IN ('ecological_constraint', 'identification_key')
            LIMIT 3
        ");
        $stmt->execute([':id_str' => (string)$speciesId, ':sci' => $scientificName]);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if (!empty($row['content'])) $parts[] = $row['content'];
        }

        if (empty($parts)) return null;

        return mb_substr(implode("\n", $parts), 0, 500);
    }

    /**
     * Retrieve a pre-computed fun_fact from distilled_knowledge (Phase 2 cache).
     * Returns the cached fun_fact body string or null.
     */
    public function getCachedFunFact(string $scientificName): ?string
    {
        if (empty($scientificName)) return null;

        $stmt = $this->pdo->prepare("SELECT id FROM species WHERE scientific_name = :name LIMIT 1");
        $stmt->execute([':name' => $scientificName]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;

        $stmt = $this->pdo->prepare("
            SELECT content FROM distilled_knowledge
            WHERE taxon_key = :id AND knowledge_type = 'fun_fact'
            ORDER BY created_at DESC LIMIT 1
        ");
        $stmt->execute([':id' => (string)$row['id']]);
        $fact = $stmt->fetch(PDO::FETCH_ASSOC);
        return ($fact && !empty($fact['content'])) ? $fact['content'] : null;
    }

    /**
     * Check if species' habitat aligns with the observation biome.
     * Returns ['support' => 0.0-1.0, 'conflict' => 0.0-1.0]
     */
    private function checkHabitatMatch(array $species, string $biome): array
    {
        $habitat = strtolower($species['habitat'] ?? '');
        if (empty($habitat) || empty($biome)) {
            return ['support' => 0.0, 'conflict' => 0.0]; // Can't judge → neutral
        }

        // Find which habitat group the biome belongs to
        $biomeTerms = [];
        foreach (self::BIOME_HABITAT_MAP as $group => $terms) {
            foreach ($terms as $term) {
                if (strpos($biome, $term) !== false) {
                    $biomeTerms = $terms;
                    break 2;
                }
            }
        }

        if (empty($biomeTerms)) {
            return ['support' => 0.0, 'conflict' => 0.0];
        }

        // Check if species habitat overlaps with biome terms
        foreach ($biomeTerms as $term) {
            if (mb_strpos($habitat, $term) !== false) {
                return ['support' => 0.6, 'conflict' => 0.0];
            }
        }

        // No overlap = potential conflict
        return ['support' => 0.0, 'conflict' => 0.4];
    }

    /**
     * Check if the observation month falls within the species' active season.
     * Returns ['support' => 0.0-1.0, 'conflict' => 0.0-1.0]
     */
    private function checkSeasonMatch(array $species, ?int $observedMonth): array
    {
        $season = strtolower($species['season'] ?? '');
        if (empty($season) || $observedMonth === null) {
            return ['support' => 0.0, 'conflict' => 0.0];
        }

        $observedSeason = self::MONTH_TO_SEASON[$observedMonth] ?? '';

        // Direct season name match
        if (strpos($season, $observedSeason) !== false) {
            return ['support' => 0.5, 'conflict' => 0.0];
        }

        // Check for month numbers in season text (e.g., "March-October", "3月-10月")
        if (preg_match_all('/(\d{1,2})/', $season, $matches)) {
            $months = array_map('intval', $matches[1]);
            if (count($months) >= 2) {
                $start = $months[0];
                $end = $months[count($months) - 1];
                if ($start <= $end) {
                    $inRange = $observedMonth >= $start && $observedMonth <= $end;
                } else {
                    // Wraps around year (e.g., Nov-Mar)
                    $inRange = $observedMonth >= $start || $observedMonth <= $end;
                }
                return $inRange
                    ? ['support' => 0.5, 'conflict' => 0.0]
                    : ['support' => 0.0, 'conflict' => 0.5];
            }
        }

        // Season text exists but doesn't match → mild conflict
        if (!empty($season) && !empty($observedSeason)) {
            return ['support' => 0.0, 'conflict' => 0.3];
        }

        return ['support' => 0.0, 'conflict' => 0.0];
    }
}
