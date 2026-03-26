<?php

/**
 * Project OMOIKANE - Reverse-Lookup Engine
 * Provides multi-dimensional semantic search capabilities over the 1M species SQLite database.
 */

require_once __DIR__ . '/OmoikaneDB.php';

class OmoikaneSearchEngine
{
    private $db;

    public function __construct(?OmoikaneDB $db = null)
    {
        $this->db = $db ?? new OmoikaneDB();
    }

    /**
     * Executes a complex reverse-lookup search across ecological constraints and morphological traits.
     *
     * @param array $filters An array of search parameters:
     *                       [
     *                         'habitat' => string,
     *                         'season' => string,
     *                         'altitude' => string,
     *                         'keyword' => string (searches notes and morphological_traits)
     *                       ]
     * @param int $limit Maximum number of results to return.
     * @param int $offset Offset for pagination.
     * @return array The list of matched species and their data.
     */
    public function search(array $filters, int $limit = 50, int $offset = 0): array
    {
        $pdo = $this->db->getPDO();

        $query = "
            SELECT
                s.id,
                s.scientific_name,
                e.habitat,
                e.altitude,
                e.season,
                e.notes,
                k.morphological_traits,
                k.similar_species,
                k.key_differences,
                COALESCE(ts.trust_score, 0.0) AS trust_score
            FROM species s
            LEFT JOIN ecological_constraints e ON s.id = e.species_id
            LEFT JOIN identification_keys k ON s.id = k.species_id
            LEFT JOIN trust_scores ts ON s.id = ts.species_id
            WHERE s.distillation_status = 'distilled'
        ";

        $params = [];
        $conditions = [];

        if (!empty($filters['habitat'])) {
            $conditions[] = "e.habitat LIKE :habitat";
            $params[':habitat'] = '%' . $filters['habitat'] . '%';
        }

        if (!empty($filters['season'])) {
            $conditions[] = "e.season LIKE :season";
            $params[':season'] = '%' . $filters['season'] . '%';
        }

        if (!empty($filters['altitude'])) {
            $conditions[] = "e.altitude LIKE :altitude";
            $params[':altitude'] = '%' . $filters['altitude'] . '%';
        }

        if (!empty($filters['keyword'])) {
            $conditions[] = "(e.notes LIKE :keyword OR k.morphological_traits LIKE :keyword OR k.key_differences LIKE :keyword OR s.scientific_name LIKE :keyword)";
            $params[':keyword'] = '%' . $filters['keyword'] . '%';
        }

        if (!empty($conditions)) {
            $query .= " AND " . implode(" AND ", $conditions);
        }

        // Sort by trust_score (higher = more reliable), then by id
        $query .= " ORDER BY COALESCE(ts.trust_score, 0.0) DESC, s.id ASC LIMIT :limit OFFSET :offset";

        $stmt = $pdo->prepare($query);

        // Bind normal params
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val, PDO::PARAM_STR);
        }

        // Bind integer params
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Retrieves ecological and morphological traits for a specific species by its scientific name.
     * 
     * @param string $scientificName The scientific name to look up.
     * @return array|null The traits array if found, null otherwise.
     */
    public function getTraitsByScientificName(string $scientificName): ?array
    {
        $pdo = $this->db->getPDO();

        $query = "
            SELECT 
                s.id, 
                s.scientific_name, 
                e.habitat, 
                e.altitude, 
                e.season, 
                e.notes,
                k.morphological_traits, 
                k.similar_species, 
                k.key_differences
            FROM species s
            LEFT JOIN ecological_constraints e ON s.id = e.species_id
            LEFT JOIN identification_keys k ON s.id = k.species_id
            WHERE s.scientific_name = :scientific_name AND s.distillation_status = 'distilled'
            LIMIT 1
        ";

        $stmt = $pdo->prepare($query);
        $stmt->execute([':scientific_name' => $scientificName]);

        $result = $stmt->fetch();
        return $result ? $result : null;
    }
}
