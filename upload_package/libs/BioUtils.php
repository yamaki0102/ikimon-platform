<?php

/**
 * BioUtils - helper for biodiversity logic
 */

class BioUtils
{
    /**
     * Get relative time string (Japanese)
     * @param string|int $timestamp
     * @return string
     */
    public static function timeAgo($timestamp)
    {
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
    public static function getObscuredLocation($lat, $lng, $category)
    {
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
    public static function getStatusColor($status)
    {
        switch ($status) {
            case '研究用':
                return 'text-primary bg-primary-surface border-primary-glow';
            case '要同定':
                return 'text-primary-light bg-primary-surface border-primary-glow';
            case '未同定':
                return 'text-warning bg-warning-surface border-warning/20';
            case 'はかせチェック':
                return 'text-accent bg-accent-surface border-accent/20';
            default:
                return 'text-faint bg-surface border-border';
        }
    }

    /**
     * Check if an observation meets Verifiable conditions.
     * Must have: date, location (lat+lng), photo/audio, and be wild.
     *
     * @param array $obs Observation data
     * @return bool
     */
    public static function isVerifiable(array $obs): bool
    {
        // Must have observation date
        if (empty($obs['observed_at']) && empty($obs['date'])) {
            return false;
        }
        // Must have location (support both field name conventions)
        $lat = $obs['lat'] ?? $obs['location_lat'] ?? null;
        $lng = $obs['lng'] ?? $obs['location_lng'] ?? null;
        if (empty($lat) || empty($lng)) {
            return false;
        }
        // Must have photo or audio evidence
        if (empty($obs['photo_url']) && empty($obs['photos']) && empty($obs['audio_url'])) {
            return false;
        }
        // Must be wild (not cultivated/captive)
        if (($obs['cultivation'] ?? 'wild') === 'cultivated') {
            return false;
        }
        if (!empty($obs['is_captive'])) {
            return false;
        }
        return true;
    }

    /**
     * Deduplicate identifications: keep only the latest per user.
     *
     * @param array $identifications
     * @return array Deduplicated identifications (latest per user)
     */
    public static function deduplicateIdentifications(array $identifications): array
    {
        $byUser = [];
        foreach ($identifications as $id) {
            $userId = $id['user_id'] ?? '';
            if (!$userId) continue;
            // Later entries overwrite earlier ones (latest wins)
            $byUser[$userId] = $id;
        }
        return array_values($byUser);
    }

    /**
     * Calculate consensus and observation status using iNaturalist-style 2/3 majority rule.
     *
     * Algorithm:
     * 1. Check Verifiable conditions → Casual if not met
     * 2. Deduplicate identifications (1 per user, latest wins)
     * 3. Find Community Taxon (most precise level with ≧2/3 agreement)
     * 4. Determine status: 未同定 → 要同定 → 研究用
     *
     * @param array &$obs Observation data (modified in place)
     * @return string New status
     */

    public static function updateConsensus(array &$obs): string
    {
        require_once __DIR__ . '/TrustLevel.php';

        // --- Phase 0: No identifications ---
        if (!isset($obs['identifications']) || empty($obs['identifications'])) {
            $obs['status'] = '未同定';
            return '未同定';
        }

        // --- Phase 1: Verifiable check ---
        if (!self::isVerifiable($obs)) {
            // Set taxon from first identification but mark as Casual
            $firstId = $obs['identifications'][0];
            $obs['taxon'] = self::buildTaxonFromId($firstId);
            $obs['status'] = 'Casual';
            return 'Casual';
        }

        // --- Phase 2: Deduplicate (1 vote per user, latest wins) ---
        $activeIds = self::deduplicateIdentifications($obs['identifications']);

        // --- Phase 3: Calculate Weighted Votes (WE-Consensus) ---
        $votesPerTaxon = []; // Weighted score per taxon
        $rawVotesPerTaxon = []; // Raw count
        $taxonData = [];
        $totalWeight = 0.0;

        foreach ($activeIds as $id) {
            $key = $id['taxon_key'] ?? $id['taxon_name'] ?? '';
            if (!$key) continue;

            $userId = $id['user_id'] ?? '';
            $weight = TrustLevel::getWeight($userId);

            $votesPerTaxon[$key] = ($votesPerTaxon[$key] ?? 0.0) + $weight;
            $rawVotesPerTaxon[$key] = ($rawVotesPerTaxon[$key] ?? 0) + 1;
            $taxonData[$key] = self::buildTaxonFromId($id);

            $totalWeight += $weight;
        }

        // Sort by weighted score descending
        arsort($votesPerTaxon);
        $topTaxonKey = array_key_first($votesPerTaxon);
        $topScore = $votesPerTaxon[$topTaxonKey];
        $topRawVotes = $rawVotesPerTaxon[$topTaxonKey];

        // Set primary taxon to the one with highest weighted score
        $obs['taxon'] = $taxonData[$topTaxonKey];

        // Agreement Rate (Weighted)
        $agreementRate = $totalWeight > 0 ? ($topScore / $totalWeight) : 0;

        // Store consensus metadata for transparency
        $obs['consensus'] = [
            'total_votes'    => count($activeIds), // Raw count
            'total_score'    => $totalWeight,      // Weighted total
            'top_score'      => $topScore,         // Weighted top score
            'agreement_rate' => round($agreementRate, 3),
            'algorithm'      => 'we_consensus_v1', // Weighted Evidence Consensus
            'updated_at'     => date('c'),
        ];

        // --- Phase 4: Determine status ---

        // Check for unresolved disputes
        $hasOpenDisputes = false;
        foreach ($obs['disputes'] ?? [] as $dispute) {
            if (in_array(($dispute['status'] ?? ''), ['open', 'pending'])) {
                $hasOpenDisputes = true;
                break;
            }
        }

        // Check if observation owner is the ONLY identifier
        $ownerId = $obs['user_id'] ?? '';
        $hasOtherIdentifier = false;
        foreach ($activeIds as $id) {
            if (($id['user_id'] ?? '') !== $ownerId) {
                $hasOtherIdentifier = true;
                break;
            }
        }

        // Determine taxon rank
        $taxonRank = $obs['taxon']['rank'] ?? 'species';
        $speciesOrBelow = in_array($taxonRank, ['species', 'subspecies', 'variety', 'form']);

        // Strict Research Grade Criteria:
        // 1. Weighted Agreement Rate > 2/3 (66.6%)
        // 2. Top Weighted Score >= 2.0 (Equivalent to 2 Regulars or 1 Expert)
        // 3. Must be Species level or lower
        // 4. Must have external identifier
        // 5. No open disputes

        if (
            $agreementRate > (2 / 3)
            && $topScore >= 2.0
            && $hasOtherIdentifier
            && $speciesOrBelow
            && !$hasOpenDisputes
        ) {
            // Research Grade (研究用)
            $obs['status'] = '研究用';
            $obs['quality_grade'] = 'Research Grade'; // Explicit set
        } elseif (count($activeIds) >= 1) {
            // Has at least one identification but not yet consensus
            $obs['status'] = '要同定';
            $obs['quality_grade'] = 'Needs ID';
        } else {
            $obs['status'] = '未同定';
            $obs['quality_grade'] = 'Casual';
        }

        return $obs['status'];
    }

    /**
     * Build a taxon array from an identification record.
     *
     * @param array $id Identification entry
     * @return array Taxon data
     */
    private static function buildTaxonFromId(array $id): array
    {
        return [
            'name'            => $id['taxon_name'] ?? '',
            'scientific_name' => $id['scientific_name'] ?? '',
            'key'             => $id['taxon_key'] ?? '',
            'rank'            => $id['taxon_rank'] ?? 'species',
            'lineage'         => $id['lineage'] ?? [],
        ];
    }
    /**
     * Get consistent dummy user name based on ID
     */
    /**
     * Get user name (cached per request)
     */
    private static $user_cache = [];

    public static function getUserName($user_id)
    {
        if (empty($user_id)) return 'Unknown';

        // Check runtime cache
        if (isset(self::$user_cache[$user_id])) {
            return self::$user_cache[$user_id];
        }

        // Try to fetch real user
        if (!class_exists('UserStore')) {
            require_once __DIR__ . '/UserStore.php';
        }

        $user = UserStore::findById($user_id);
        if ($user && !empty($user['name'])) {
            self::$user_cache[$user_id] = $user['name'];
            return $user['name'];
        }

        // Fallback to consistent dummy name if user not found
        $names = [
            'Sakura',
            'Kaito',
            'Ren',
            'Hina',
            'Yuto',
            'Mei',
            'Haruto',
            'Yui',
            'Sota',
            'Mio',
            'Daiki',
            'Koharu',
            'Riku',
            'Ema',
            'Yamato',
            'Tsumugi',
            'Nature_Explorer',
            'BioHunter',
            'YamaGirl',
            'SeaBreeze'
        ];
        $index = hexdec(substr(md5((string)$user_id), 0, 8)) % count($names);
        $dummyName = $names[$index];

        self::$user_cache[$user_id] = $dummyName;
        return $dummyName;
    }

    /**
     * Render simplified Markdown (Bold, Italic, Link, List)
     */
    public static function renderMarkdown($text)
    {
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
    public static function renderLineage($lineage)
    {
        if (empty($lineage)) return '';
        $parts = [];
        $ranks = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus'];
        foreach ($ranks as $rank) {
            if (isset($lineage[$rank])) {
                $parts[] = "<span class='inline-block bg-white/5 px-2 py-0.5 rounded text-[10px] text-muted'>{$lineage[$rank]}</span>";
            }
        }
        return implode(" <span class='text-faint'>&rsaquo;</span> ", $parts);
    }
}
