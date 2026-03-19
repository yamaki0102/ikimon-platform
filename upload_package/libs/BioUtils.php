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
        require_once __DIR__ . '/SubjectHelper.php';

        // Multi-Subject 対応: subjects[] を保証
        SubjectHelper::ensureSubjects($obs);
        SubjectHelper::distributeIdentifications($obs);

        // 各 subject ごとにコンセンサス計算
        $anyHasId = false;
        foreach ($obs['subjects'] as &$subject) {
            self::computeSubjectConsensus($subject, $obs);
            if (!empty($subject['identifications'])) {
                $anyHasId = true;
            }
        }
        unset($subject);

        // Primary subject の結果をレガシーフィールドに同期
        SubjectHelper::syncPrimaryToLegacy($obs);

        // 観察全体の status は primary subject から
        $primaryStatus = $obs['subjects'][0]['status'] ?? '未同定';
        $obs['status'] = $primaryStatus;
        $obs['quality_grade'] = $obs['subjects'][0]['quality_grade'] ?? 'Casual';

        // ただし他の subject に研究用があれば、観察全体も要同定以上にする
        foreach ($obs['subjects'] as $subject) {
            if (($subject['status'] ?? '') === '研究用' && $obs['status'] !== '研究用') {
                // 他subjectが研究用でもprimaryのstatusを維持（各subjectは独立）
                break;
            }
        }

        return $obs['status'];
    }

    /**
     * 個別 subject のコンセンサスを計算。
     */
    private static function computeSubjectConsensus(array &$subject, array $obs): void
    {
        $ids = $subject['identifications'] ?? [];

        // --- Phase 0: No identifications ---
        if (empty($ids)) {
            $subject['taxon'] = null;
            $subject['status'] = '未同定';
            $subject['quality_grade'] = 'Casual';
            $subject['consensus'] = null;
            return;
        }

        // --- Phase 1: Verifiable check ---
        if (!self::isVerifiable($obs)) {
            $firstId = $ids[0];
            $subject['taxon'] = self::buildTaxonFromId($firstId);
            $subject['status'] = 'Casual';
            $subject['quality_grade'] = 'Casual';
            return;
        }

        // --- Phase 2: Deduplicate (1 vote per user per subject, latest wins) ---
        $activeIds = self::deduplicateIdentifications($ids);

        // --- Phase 3: Calculate Weighted Votes (WE-Consensus) ---
        $votesPerTaxon = [];
        $rawVotesPerTaxon = [];
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

        arsort($votesPerTaxon);
        $topTaxonKey = array_key_first($votesPerTaxon);
        $topScore = $votesPerTaxon[$topTaxonKey];

        $subject['taxon'] = $taxonData[$topTaxonKey];

        $agreementRate = $totalWeight > 0 ? ($topScore / $totalWeight) : 0;

        $subject['consensus'] = [
            'total_votes'    => count($activeIds),
            'total_score'    => $totalWeight,
            'top_score'      => $topScore,
            'agreement_rate' => round($agreementRate, 3),
            'algorithm'      => 'we_consensus_v2',
            'updated_at'     => date('c'),
        ];

        // Also update obs-level consensus for backward compat (primary subject)
        if (($subject['id'] ?? '') === 'primary') {
            $obs['taxon'] = $subject['taxon'];
            $obs['consensus'] = $subject['consensus'];
        }

        // --- Phase 4: Determine status ---
        $hasOpenDisputes = false;
        foreach ($obs['disputes'] ?? [] as $dispute) {
            if (in_array(($dispute['status'] ?? ''), ['open', 'pending'])) {
                $hasOpenDisputes = true;
                break;
            }
        }

        $ownerId = $obs['user_id'] ?? '';
        $hasOtherIdentifier = false;
        foreach ($activeIds as $id) {
            if (($id['user_id'] ?? '') !== $ownerId) {
                $hasOtherIdentifier = true;
                break;
            }
        }

        $taxonRank = $subject['taxon']['rank'] ?? 'species';
        $speciesOrBelow = in_array($taxonRank, ['species', 'subspecies', 'variety', 'form']);

        if (
            $agreementRate > (2 / 3)
            && $topScore >= 2.0
            && $hasOtherIdentifier
            && $speciesOrBelow
            && !$hasOpenDisputes
        ) {
            $subject['status'] = '研究用';
            $subject['quality_grade'] = 'Research Grade';
        } elseif (count($activeIds) >= 1) {
            $subject['status'] = '要同定';
            $subject['quality_grade'] = 'Needs ID';
        } else {
            $subject['status'] = '未同定';
            $subject['quality_grade'] = 'Casual';
        }
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

    /**
     * Build trust guidance — what the observation needs to reach Research Grade.
     */
    public static function buildTrustGuidance(array $obs): array
    {
        $status = $obs['quality_grade'] ?? $obs['status'] ?? '';
        $ids = $obs['identifications'] ?? [];
        $activeIds = !empty($ids) ? self::deduplicateIdentifications($ids) : [];
        $ownerId = $obs['user_id'] ?? '';
        $taxonRank = $obs['taxon']['rank'] ?? '';
        $speciesOrBelow = in_array($taxonRank, ['species', 'subspecies', 'variety', 'form']);
        $consensus = $obs['consensus'] ?? [];

        // Already Research Grade
        if ($status === 'Research Grade' || $status === '研究用') {
            return ['headline' => '種レベル研究用', 'body' => '', 'steps' => [], 'status' => '種レベル研究用'];
        }

        $steps = [];

        // Check: has photo
        if (empty($obs['photos'])) {
            $steps[] = '📷 写真を追加';
        }

        // Check: has location
        if (empty($obs['lat']) || empty($obs['lng'])) {
            $steps[] = '📍 位置情報を追加';
        }

        // Check: needs identification
        if (empty($activeIds)) {
            $steps[] = '🔍 最初の同定を追加';
        }

        // Check: needs external identifier
        $hasOtherIdentifier = false;
        foreach ($activeIds as $id) {
            if (($id['user_id'] ?? '') !== $ownerId) {
                $hasOtherIdentifier = true;
                break;
            }
        }
        if (!$hasOtherIdentifier && !empty($activeIds)) {
            $steps[] = '👥 他のユーザーの同定が必要';
        }

        // Check: species-level
        if (!$speciesOrBelow && !empty($obs['taxon']['name'])) {
            $steps[] = '🎯 種レベルまで絞り込み';
        }

        // Check: agreement score
        $topScore = $consensus['top_score'] ?? 0;
        if ($topScore < 2.0 && $hasOtherIdentifier) {
            $steps[] = '⚖️ 同定スコアの積み上げ';
        }

        if (empty($steps)) {
            return ['headline' => '', 'body' => '', 'steps' => [], 'status' => ''];
        }

        return [
            'headline' => '研究用グレードへのステップ',
            'body' => 'この観察が研究用として認定されるために必要な項目です。',
            'steps' => $steps,
            'status' => $status,
        ];
    }

    /**
     * Build trust progress — percentage toward Research Grade.
     */
    public static function buildTrustProgress(array $obs): array
    {
        $status = $obs['quality_grade'] ?? $obs['status'] ?? '';
        $ids = $obs['identifications'] ?? [];
        $activeIds = !empty($ids) ? self::deduplicateIdentifications($ids) : [];
        $ownerId = $obs['user_id'] ?? '';
        $consensus = $obs['consensus'] ?? [];
        $taxonRank = $obs['taxon']['rank'] ?? '';
        $speciesOrBelow = in_array($taxonRank, ['species', 'subspecies', 'variety', 'form']);

        // Already Research Grade
        if ($status === 'Research Grade' || $status === '研究用') {
            return [
                'headline' => '研究用グレード達成！',
                'next_label' => 'この観察は研究データとして活用できます。',
                'progress' => 100,
                'checkpoints' => [
                    ['label' => '写真あり', 'detail' => '撮影済み', 'complete' => true],
                    ['label' => '位置情報', 'detail' => '記録済み', 'complete' => true],
                    ['label' => '種レベル同定', 'detail' => '確定済み', 'complete' => true],
                    ['label' => 'コミュニティ合意', 'detail' => '達成済み', 'complete' => true],
                ],
            ];
        }

        $checkpoints = [];
        $completed = 0;
        $total = 4;

        // 1. Photo
        $hasPhoto = !empty($obs['photos']);
        $checkpoints[] = ['label' => '写真あり', 'detail' => $hasPhoto ? '撮影済み' : '写真を追加してください', 'complete' => $hasPhoto];
        if ($hasPhoto) $completed++;

        // 2. Location
        $hasLocation = !empty($obs['lat']) && !empty($obs['lng']);
        $checkpoints[] = ['label' => '位置情報', 'detail' => $hasLocation ? '記録済み' : '位置情報を追加', 'complete' => $hasLocation];
        if ($hasLocation) $completed++;

        // 3. Species-level ID
        $hasSpeciesId = $speciesOrBelow && !empty($obs['taxon']['name']);
        $checkpoints[] = ['label' => '種レベル同定', 'detail' => $hasSpeciesId ? ($obs['taxon']['name'] ?? '確定済み') : '種レベルまで絞り込み', 'complete' => $hasSpeciesId];
        if ($hasSpeciesId) $completed++;

        // 4. Community agreement
        $hasOtherIdentifier = false;
        foreach ($activeIds as $id) {
            if (($id['user_id'] ?? '') !== $ownerId) {
                $hasOtherIdentifier = true;
                break;
            }
        }
        $topScore = $consensus['top_score'] ?? 0;
        $agreementRate = $consensus['agreement_rate'] ?? 0;
        $communityOk = $hasOtherIdentifier && $topScore >= 2.0 && $agreementRate > (2 / 3);
        $communityDetail = $communityOk ? '合意済み' : ($hasOtherIdentifier ? 'スコア積み上げ中' : '他ユーザーの同定待ち');
        $checkpoints[] = ['label' => 'コミュニティ合意', 'detail' => $communityDetail, 'complete' => $communityOk];
        if ($communityOk) $completed++;

        $progress = (int)round(($completed / $total) * 100);
        $nextLabels = ['写真を追加しましょう', '位置情報を記録しましょう', '種名まで同定を絞り込みましょう', 'ほかのユーザーの同定を待ちましょう'];
        $nextLabel = '';
        foreach ($checkpoints as $i => $cp) {
            if (!$cp['complete']) {
                $nextLabel = $nextLabels[$i] ?? '';
                break;
            }
        }

        return [
            'headline' => '信頼済みへの進み具合',
            'next_label' => $nextLabel ?: '研究用グレードに近づいています！',
            'progress' => $progress,
            'checkpoints' => $checkpoints,
        ];
    }
}
