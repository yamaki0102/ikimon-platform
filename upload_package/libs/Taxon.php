<?php
/**
 * Taxon - GBIF API integration and caching
 */

class Taxon {
    private static $cache_file = 'taxa_cache';

    public static function search($query) {
        $query = urlencode($query);
        $url = "https://api.gbif.org/v1/species/suggest?q={$query}&limit=10";
        
        $options = [
            'http' => [
                'method' => 'GET',
                'timeout' => 5,
                'header' => "User-Agent: ikimon-bot/1.0\r\n"
            ]
        ];
        $context = stream_context_create($options);
        $response = @file_get_contents($url, false, $context);

        if (!$response) return [];

        $results = json_decode($response, true);
        return $results ?: [];
    }

    public static function get($taxon_key) {
        // Check cache first
        $cache = DataStore::get(self::$cache_file);
        if (isset($cache[$taxon_key])) {
            return $cache[$taxon_key];
        }

        // Fetch from GBIF
        $url = "https://api.gbif.org/v1/species/{$taxon_key}";
        $response = file_get_contents($url);
        if (!$response) return null;

        $data = json_decode($response, true);
        if ($data) {
            // Store in cache
            $cache[$taxon_key] = $data;
            DataStore::save(self::$cache_file, $cache);
        }

        return $data;
    }

    public static function match($name) {
        $name = urlencode($name);
        $url = "https://api.gbif.org/v1/species/match?name={$name}";
        $content = @file_get_contents($url);
        if (!$content) return null;
        return json_decode($content, true);
    }

    // New: Expand search term into [Scientific, Japanese, English]
    public static function expandSearchTerm($term) {
        // 1. Check Cache first (simple file cache for search terms)
        $cacheKey = 'term_' . md5(strtolower($term));
        $cached = DataStore::getCached($cacheKey, 3600*24, function() use ($term) {
             
            $candidates = [$term];
            
            // Try matching
            $match = self::match($term);
            if ($match && isset($match['usageKey'])) {
                $candidates[] = $match['scientificName'];
                if (isset($match['canonicalName'])) $candidates[] = $match['canonicalName'];
                
                // Fetch Vernacular Names
                $url = "https://api.gbif.org/v1/species/{$match['usageKey']}/vernacularNames";
                $content = @file_get_contents($url);
                if ($content) {
                    $data = json_decode($content, true);
                    if (isset($data['results'])) {
                        foreach ($data['results'] as $res) {
                            if (isset($res['language']) && in_array($res['language'], ['eng', 'jpn'])) {
                                $candidates[] = $res['vernacularName'];
                            }
                        }
                    }
                }
            }
            return array_unique($candidates);
        });
        
        return $cached ?: [$term];
    }
    public static function getJapaneseName($taxon_key) {
        // Local lookup first (GBIF Backbone VernacularName.tsv)
        if ($taxon_key && defined('ROOT_DIR') && file_exists(ROOT_DIR . '/libs/OmoikaneDB.php')) {
            try {
                require_once ROOT_DIR . '/libs/OmoikaneDB.php';
                $db = new OmoikaneDB();
                $pdo = $db->getPDO();
                $stmt = $pdo->prepare(
                    "SELECT name FROM vernacular_names WHERE gbif_taxon_id = :gid AND language IN ('ja', 'jpn') LIMIT 1"
                );
                $stmt->execute([':gid' => (int)$taxon_key]);
                $localName = $stmt->fetchColumn();
                if ($localName) return $localName;
            } catch (Exception $e) {
                // Fall through to API
            }
        }

        // API fallback
        $url = "https://api.gbif.org/v1/species/{$taxon_key}/vernacularNames";
        $content = @file_get_contents($url);
        if ($content) {
            $data = json_decode($content, true);
            if (isset($data['results'])) {
                foreach ($data['results'] as $res) {
                    if (isset($res['language']) && $res['language'] === 'jpn') {
                        return $res['vernacularName'];
                    }
                }
            }
        }
        return null;
    }
}
