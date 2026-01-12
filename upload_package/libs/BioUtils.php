<?php
/**
 * BioUtils - helper for biodiversity logic
 */

class BioUtils {
    /**
     * Get relative time string (Japanese)
     * @param string|int $timestamp
     * @return string
     */
    public static function timeAgo($timestamp) {
        if (!is_numeric($timestamp)) {
            $timestamp = strtotime($timestamp);
        }
        $diff = time() - $timestamp;

        if ($diff < 60) {
            return 'たった今';
        } elseif ($diff < 3600) {
            return floor($diff / 60) . '分前';
        } elseif ($diff < 86400) {
            return floor($diff / 3600) . '時間前';
        } elseif ($diff < 604800) {
            return floor($diff / 86400) . '日前';
        } else {
            return date('Y/m/d', $timestamp);
        }
    }

    /**
     * Obscure location based on Red List category
     * @param float $lat Original latitude
     * @param float $lng Original longitude
     * @param string|null $category CR, EN, VU, etc.
     * @return array [lat, lng, radius_meters]
     */
    public static function getObscuredLocation($lat, $lng, $category) {
        $grid_size = 0;
        if (in_array($category, ['CR', 'EN'])) {
            $grid_size = OBSCURE_GRID_CR_EN; // 10km
        } elseif ($category === 'VU') {
            $grid_size = OBSCURE_GRID_VU;    // 1km
        }

        if ($grid_size === 0) {
            return ['lat' => $lat, 'lng' => $lng, 'radius' => 0];
        }

        // Random offset within the grid
        // Approx 111,000 meters per degree
        $offset_lat = (rand(-500, 500) / 1000) * ($grid_size / 111000);
        $offset_lng = (rand(-500, 500) / 1000) * ($grid_size / (111000 * cos(deg2rad($lat))));

        return [
            'lat' => $lat + $offset_lat,
            'lng' => $lng + $offset_lng,
            'radius' => $grid_size
        ];
    }

    /**
     * Get CSS class for status
     */
    public static function getStatusColor($status) {
        switch ($status) {
            case 'はかせ認定': return 'text-green-400 bg-green-400/10 border-green-400/20';
            case 'ていあん': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
            case '調査中': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
            case 'はかせチェック': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
            default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
        }
    }

    /**
     * Calculate consensus and observation status
     * @param array &$obs Observation data
     * @return string New status
     */
    public static function updateConsensus(&$obs) {
        if (!isset($obs['identifications']) || empty($obs['identifications'])) {
            $obs['status'] = '調査中';
            return '調査中';
        }

        require_once __DIR__ . '/Gamification.php';
        require_once __DIR__ . '/DataStore.php';

        $scores = [];
        $taxon_data = [];
        
        foreach ($obs['identifications'] as $id) {
            $key = $id['taxon_key'];
            
            // Calculate User Weight
            $userId = $id['user_id'];
            $user = DataStore::findById('users', $userId);
            $weight = 1.0; // Base weight

            if ($user && isset($user['badges'])) {
                if (in_array('expert', $user['badges'])) {
                    $weight = 3.0; // Expert Override power
                } elseif (in_array('identifier', $user['badges'])) {
                    $weight = 1.5; // Experienced identifier
                }
            }

            $scores[$key] = ($scores[$key] ?? 0) + $weight;
            
            $taxon_data[$key] = [
                'name' => $id['taxon_name'],
                'scientific_name' => $id['scientific_name'],
                'key' => $id['taxon_key'],
                'rank' => $id['taxon_rank'] ?? 'species',
                'lineage' => $id['lineage'] ?? []
            ];
        }

        // Sort by score descending
        arsort($scores);
        $top_taxon_key = array_key_first($scores);
        $top_score = $scores[$top_taxon_key];

        // Set primary taxon to the one with most weighted votes
        $obs['taxon'] = $taxon_data[$top_taxon_key];

        // Research Grade if weighted score >= 2.0
        // (e.g. 2 beginners OR 1 expert)
        if ($top_score >= 2.0) {
            $obs['status'] = 'はかせ認定';
        } else {
            $obs['status'] = 'ていあん';
        }

        // Casual if cultivated
        if (($obs['cultivation'] ?? 'wild') === 'cultivated') {
            $obs['status'] = 'ペット・栽培';
        }

        return $obs['status'];
    }
    /**
     * Get consistent dummy user name based on ID
     */
    public static function getUserName($user_id) {
        $names = [
            'Sakura', 'Kaito', 'Ren', 'Hina', 'Yuto', 'Mei', 'Haruto', 'Yui', 'Sota', 'Mio', 
            'Daiki', 'Koharu', 'Riku', 'Ema', 'Yamato', 'Tsumugi', 'Nature_Explorer', 'BioHunter', 'YamaGirl', 'SeaBreeze'
        ];
        // Consistent mapping
        $index = hexdec(substr(md5((string)$user_id), 0, 8)) % count($names);
        return $names[$index];
    }

    /**
     * Render simplified Markdown (Bold, Italic, Link, List)
     */
    public static function renderMarkdown($text) {
        $text = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
        
        // Bold **text**
        $text = preg_replace('/\*\*(.+?)\*\*/', '<strong>$1</strong>', $text);
        
        // Italic *text*
        $text = preg_replace('/\*(.+?)\*/', '<em>$1</em>', $text);
        
        // Headers ###
        $text = preg_replace('/^###\s+(.+)$/m', '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>', $text);
        
        // Lists - 
        $text = preg_replace('/^-\s+(.+)$/m', '<li class="ml-4 list-disc">$1</li>', $text);
        
        // Wrap lists (Naive)
        $text = preg_replace('/(<li.*<\/li>)/s', '<ul class="my-2">$1</ul>', $text);
        
        // Newlines
        $text = nl2br($text);
        
        return $text;
    }

    /**
     * Render lineage breadcrumb
     */
    public static function renderLineage($lineage) {
        if (empty($lineage)) return '';
        $parts = [];
        $ranks = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus'];
        foreach ($ranks as $rank) {
            if (isset($lineage[$rank])) {
                $parts[] = "<span class='inline-block bg-white/5 px-2 py-0.5 rounded text-[10px] text-gray-400'>{$lineage[$rank]}</span>";
            }
        }
        return implode(" <span class='text-gray-600'>&rsaquo;</span> ", $parts);
    }
}
