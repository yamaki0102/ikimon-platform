<?php

/**
 * Project OMOIKANE - Trust Score Calculator
 * Computes a 0.0-1.0 trust score per species based on data quality signals.
 *
 * Score formula:
 *   trust_score = field_completeness * 0.40
 *               + trusted_source_ratio * 0.25
 *               + source_diversity * 0.20
 *               + (1.0 - inferred_penalty) * 0.15
 */

require_once __DIR__ . '/OmoikaneDB.php';

class TrustScoreCalculator
{
    private $pdo;

    /** Domains considered high-trust sources */
    private const TRUSTED_DOMAINS = [
        'wikipedia.org',
        'wikidata.org',
        'gbif.org',
    ];

    /** Fields checked for completeness (7 total) */
    private const COMPLETENESS_FIELDS = [
        'eco' => ['habitat', 'altitude', 'season', 'notes'],
        'key' => ['morphological_traits', 'similar_species', 'key_differences'],
    ];

    public function __construct(?OmoikaneDB $db = null)
    {
        $db = $db ?? new OmoikaneDB();
        $this->pdo = $db->getPDO();
    }

    /**
     * Compute and upsert trust score for a single species.
     */
    public function computeForSpecies(int $speciesId): float
    {
        $row = $this->fetchSpeciesData($speciesId);
        if (!$row) return 0.0;

        $fieldCompleteness = $this->calcFieldCompleteness($row);
        $sourceStats = $this->calcSourceStats($row['source_citations']);
        $inferredPenalty = $this->calcInferredPenalty($row);

        $trustScore = round(
            $fieldCompleteness * 0.40
            + $sourceStats['trusted_ratio'] * 0.25
            + $sourceStats['diversity'] * 0.20
            + (1.0 - $inferredPenalty) * 0.15,
            4
        );

        $this->upsert($speciesId, $trustScore, $sourceStats['count'], $sourceStats['trusted_count'], $fieldCompleteness, $inferredPenalty);

        return $trustScore;
    }

    /**
     * Recompute scores for ALL distilled species.
     * Returns [total, computed, skipped].
     */
    public function recomputeAll(?callable $progressCallback = null): array
    {
        $stmt = $this->pdo->query("SELECT id FROM species WHERE distillation_status = 'distilled'");
        $ids = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);

        $total = count($ids);
        $computed = 0;
        $skipped = 0;

        foreach ($ids as $i => $speciesId) {
            try {
                $this->computeForSpecies($speciesId);
                $computed++;
            } catch (\Exception $e) {
                $skipped++;
            }
            if ($progressCallback && ($i % 500 === 0 || $i === $total - 1)) {
                $progressCallback($i + 1, $total);
            }
        }

        return ['total' => $total, 'computed' => $computed, 'skipped' => $skipped];
    }

    // --- Private helpers ---

    private function fetchSpeciesData(int $speciesId): ?array
    {
        $stmt = $this->pdo->prepare("
            SELECT s.source_citations,
                   e.habitat, e.altitude, e.season, e.notes,
                   k.morphological_traits, k.similar_species, k.key_differences
            FROM species s
            LEFT JOIN ecological_constraints e ON s.id = e.species_id
            LEFT JOIN identification_keys k ON s.id = k.species_id
            WHERE s.id = :id AND s.distillation_status = 'distilled'
        ");
        $stmt->execute([':id' => $speciesId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Ratio of non-empty fields out of 7 target fields.
     */
    private function calcFieldCompleteness(array $row): float
    {
        $filled = 0;
        $total = 7;
        foreach (self::COMPLETENESS_FIELDS['eco'] as $f) {
            if (!empty(trim($row[$f] ?? ''))) $filled++;
        }
        foreach (self::COMPLETENESS_FIELDS['key'] as $f) {
            if (!empty(trim($row[$f] ?? ''))) $filled++;
        }
        return $filled / $total;
    }

    /**
     * Parse source_citations JSON and compute trusted ratio + diversity.
     * Returns ['count' => int, 'trusted_count' => int, 'trusted_ratio' => float, 'diversity' => float]
     */
    private function calcSourceStats(?string $citationsJson): array
    {
        $result = ['count' => 0, 'trusted_count' => 0, 'trusted_ratio' => 0.0, 'diversity' => 0.0];
        if (empty($citationsJson)) return $result;

        $citations = json_decode($citationsJson, true);
        if (!is_array($citations)) return $result;

        $count = count($citations);
        $result['count'] = $count;

        $trustedCount = 0;
        foreach ($citations as $cite) {
            $url = '';
            if (is_string($cite)) {
                $url = $cite;
            } elseif (is_array($cite)) {
                $url = $cite['url'] ?? $cite['source'] ?? $cite['link'] ?? '';
            }
            foreach (self::TRUSTED_DOMAINS as $domain) {
                if (stripos($url, $domain) !== false) {
                    $trustedCount++;
                    break;
                }
            }
        }

        $result['trusted_count'] = $trustedCount;
        $result['trusted_ratio'] = $count > 0 ? $trustedCount / $count : 0.0;
        $result['diversity'] = min($count / 5.0, 1.0);

        return $result;
    }

    /**
     * Scan text fields for "(inferred)" markers.
     * Penalty = occurrences / (total non-empty fields * 2), capped at 1.0
     */
    private function calcInferredPenalty(array $row): float
    {
        $textFields = ['habitat', 'altitude', 'season', 'notes', 'morphological_traits', 'similar_species', 'key_differences'];
        $occurrences = 0;
        $nonEmpty = 0;

        foreach ($textFields as $f) {
            $val = $row[$f] ?? '';
            if (empty(trim($val))) continue;
            $nonEmpty++;
            $occurrences += substr_count(strtolower($val), '(inferred)');
        }

        if ($nonEmpty === 0) return 0.0;
        return min($occurrences / ($nonEmpty * 2), 1.0);
    }

    private function upsert(int $speciesId, float $score, int $sourceCount, int $trustedCount, float $completeness, float $inferredRatio): void
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO trust_scores (species_id, trust_score, source_count, trusted_source_count, field_completeness, inferred_ratio, computed_at)
            VALUES (:id, :score, :src, :trusted, :completeness, :inferred, :now)
            ON CONFLICT(species_id) DO UPDATE SET
                trust_score = :score,
                source_count = :src,
                trusted_source_count = :trusted,
                field_completeness = :completeness,
                inferred_ratio = :inferred,
                computed_at = :now
        ");
        $stmt->execute([
            ':id' => $speciesId,
            ':score' => $score,
            ':src' => $sourceCount,
            ':trusted' => $trustedCount,
            ':completeness' => $completeness,
            ':inferred' => $inferredRatio,
            ':now' => date('Y-m-d H:i:s'),
        ]);
    }
}
