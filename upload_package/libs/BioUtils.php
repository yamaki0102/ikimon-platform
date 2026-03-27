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
            case 'Research Grade':
            case '種レベル研究用':
                return 'text-primary bg-primary-surface border-primary-glow';
            case '研究利用可':
                return 'text-emerald-700 bg-emerald-50 border-emerald-200';
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
        require_once __DIR__ . '/Taxonomy.php';
        require_once __DIR__ . '/TrustLevel.php';

        // --- Phase 0: No identifications ---
        if (!isset($obs['identifications']) || empty($obs['identifications'])) {
            $obs['status'] = '未同定';
            $obs['quality_grade'] = 'Needs ID';
            $obs['quality_detail'] = 'needs_id';
            $obs['consensus'] = [
                'total_votes' => 0,
                'total_score' => 0,
                'agreement_rate' => 0,
                'algorithm' => 'taxonomy_lca_v2',
                'updated_at' => date('c'),
            ];
            return '未同定';
        }

        // --- Phase 1: Deduplicate (1 vote per user, latest wins) ---
        $activeIds = self::deduplicateIdentifications($obs['identifications']);
        $preparedVotes = [];
        $leafVotes = [];
        $nodeVotes = [];
        $nodeMeta = [];
        $nodeSupporters = [];
        $totalWeight = 0.0;

        foreach ($activeIds as $identification) {
            $taxon = self::buildTaxonFromId($identification);
            $path = Taxonomy::extractPathIds($taxon);
            $weight = self::getIdentificationWeight($identification);
            if (empty($path)) {
                continue;
            }

            $preparedVotes[] = [
                'user_id' => $identification['user_id'] ?? '',
                'taxon' => $taxon,
                'path' => $path,
                'weight' => $weight,
            ];

            $leafId = end($path);
            $leafVotes[$leafId] = ($leafVotes[$leafId] ?? 0.0) + $weight;
            $totalWeight += $weight;

            foreach ($path as $depth => $nodeId) {
                $nodeVotes[$nodeId] = ($nodeVotes[$nodeId] ?? 0.0) + $weight;
                $userId = $identification['user_id'] ?? '';
                if ($userId !== '') {
                    $nodeSupporters[$nodeId][$userId] = true;
                }
                $nodeMeta[$nodeId] = [
                    'id' => $nodeId,
                    'name' => self::labelPathNode($taxon, $nodeId, $depth, $path),
                    'rank' => self::rankForPathNode($taxon, $nodeId, $depth, $path),
                    'depth' => $depth + 1,
                ];
            }
        }

        if (empty($preparedVotes)) {
            $obs['status'] = '未同定';
            $obs['quality_grade'] = 'Needs ID';
            $obs['quality_detail'] = 'needs_id';
            return '未同定';
        }

        $lineageAnalysis = self::analyzeLineageConsistency($preparedVotes);
        $obs['lineage_consistency'] = $lineageAnalysis;
        if (!isset($obs['quality_flags']) || !is_array($obs['quality_flags'])) {
            $obs['quality_flags'] = [];
        }
        $obs['quality_flags']['has_lineage_conflict'] = ($lineageAnalysis['conflict_count'] ?? 0) > 0;

        $communityNodeId = self::selectCommunityNodeId($nodeVotes, $nodeMeta, $totalWeight);
        $topLeafId = self::selectTopLeafId($leafVotes);
        $bestSupportedDescendant = self::selectBestSupportedDescendant($preparedVotes, $leafVotes, $communityNodeId);
        $communityScore = $communityNodeId !== null ? ($nodeVotes[$communityNodeId] ?? 0.0) : 0.0;
        $communitySupporterCount = $communityNodeId !== null ? count($nodeSupporters[$communityNodeId] ?? []) : 0;
        $agreementRate = $totalWeight > 0 ? ($communityScore / $totalWeight) : 0.0;

        if ($communityNodeId !== null) {
            $obs['taxon'] = self::buildCommunityTaxon($communityNodeId, $preparedVotes, $nodeMeta);
        } elseif ($topLeafId !== null) {
            $obs['taxon'] = self::buildCommunityTaxon($topLeafId, $preparedVotes, $nodeMeta);
        }
        $obs['best_supported_descendant_taxon'] = $bestSupportedDescendant;

        // --- Phase 2: Verifiable check ---
        if (!self::isVerifiable($obs)) {
            $obs['status'] = 'Casual';
            $obs['quality_grade'] = 'Casual';
            $obs['quality_detail'] = 'casual';
            $obs['consensus'] = [
                'total_votes' => count($preparedVotes),
                'total_score' => $totalWeight,
                'top_score' => round($communityScore, 3),
                'agreement_rate' => round($agreementRate, 3),
                'community_taxon_id' => $communityNodeId,
                'community_rank' => $obs['taxon']['rank'] ?? 'species',
                'community_supporters' => $communitySupporterCount,
                'best_supported_descendant_taxon_id' => $bestSupportedDescendant['id'] ?? null,
                'best_supported_descendant_rank' => $bestSupportedDescendant['rank'] ?? null,
                'best_supported_descendant_score' => $bestSupportedDescendant['support_score'] ?? null,
                'algorithm' => 'taxonomy_lca_v2',
                'updated_at' => date('c'),
            ];
            return 'Casual';
        }

        // Store consensus metadata for transparency
        $obs['consensus'] = [
            'total_votes'    => count($preparedVotes),
            'total_score'    => round($totalWeight, 3),
            'top_score'      => round($communityScore, 3),
            'agreement_rate' => round($agreementRate, 3),
            'community_taxon_id' => $communityNodeId,
            'community_rank' => $obs['taxon']['rank'] ?? 'species',
            'community_supporters' => $communitySupporterCount,
            'leaf_top_taxon_id' => $topLeafId,
            'leaf_top_score' => $topLeafId !== null ? round($leafVotes[$topLeafId] ?? 0.0, 3) : 0.0,
            'best_supported_descendant_taxon_id' => $bestSupportedDescendant['id'] ?? null,
            'best_supported_descendant_rank' => $bestSupportedDescendant['rank'] ?? null,
            'best_supported_descendant_score' => $bestSupportedDescendant['support_score'] ?? null,
            'lineage_conflict_count' => $lineageAnalysis['conflict_count'] ?? 0,
            'algorithm'      => 'taxonomy_lca_v2',
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
        $speciesOrBelow = self::isSpeciesOrBelowRank($taxonRank);
        $researchUsableRank = self::isResearchUsableRank($taxonRank);

        // Strict Research Grade Criteria:
        // 1. Weighted Agreement Rate > 2/3 (66.6%)
        // 2. Top Weighted Score >= 2.0 (Equivalent to 2 Regulars or 1 Expert)
        // 3. Must be Family level or lower for research-usable status
        // 4. Must have external identifier
        // 5. No open disputes

        if (
            $agreementRate >= (2 / 3)
            && $communitySupporterCount >= 2
            && $hasOtherIdentifier
            && $researchUsableRank
            && !$hasOpenDisputes
            && !($obs['quality_flags']['has_lineage_conflict'] ?? false)
        ) {
            $obs['quality_grade'] = 'Research Grade';
            if ($speciesOrBelow) {
                $obs['status'] = '種レベル研究用';
                $obs['quality_detail'] = 'species_supported';
            } else {
                $obs['status'] = '研究利用可';
                $obs['quality_detail'] = 'coarse_supported';
            }
        } elseif (count($activeIds) >= 1) {
            // Has at least one identification but not yet consensus
            $obs['status'] = '要同定';
            $obs['quality_grade'] = 'Needs ID';
            $obs['quality_detail'] = 'needs_id';
        } else {
            $obs['status'] = '未同定';
            $obs['quality_grade'] = 'Casual';
            $obs['quality_detail'] = 'casual';
        }

        return $obs['status'];
    }

    public static function isResearchGradeLike(?string $value): bool
    {
        return in_array((string)$value, ['Research Grade', '研究用', '研究利用可', '種レベル研究用'], true);
    }

    public static function displayStatus(array $obs, string $fallback = '未同定'): string
    {
        $status = (string)($obs['status'] ?? ($obs['quality_grade'] ?? $fallback));
        if ($status === '') {
            return $fallback;
        }

        if ($status === 'Research Grade') {
            return (($obs['quality_detail'] ?? '') === 'species_supported') ? '種レベル研究用' : '研究利用可';
        }

        if (in_array($status, ['研究用', 'はかせ認定'], true)) {
            return '種レベル研究用';
        }

        if ($status === 'Needs ID') {
            return '要同定';
        }

        return $status;
    }

    public static function isResearchGradeObservation(array $obs): bool
    {
        return self::isResearchGradeLike(self::displayStatus($obs, ''));
    }

    public static function buildTrustGuidance(array $obs): array
    {
        $status = self::displayStatus($obs, '未同定');
        $activeIds = self::deduplicateIdentifications($obs['identifications'] ?? []);
        $activeCount = count($activeIds);
        $communitySupporters = (int)($obs['consensus']['community_supporters'] ?? 0);
        $taxonRank = strtolower((string)($obs['taxon']['rank'] ?? ($obs['consensus']['community_rank'] ?? 'unknown')));
        $hasConflict = !empty($obs['quality_flags']['has_lineage_conflict']);
        $speciesOrBelow = self::isSpeciesOrBelowRank($taxonRank);
        $researchUsable = self::isResearchUsableRank($taxonRank);

        $headline = '次に進みやすいこと';
        $body = '少しずつ意見が集まるほど、記録は安定していきます。';
        $steps = [];

        if ($activeCount === 0) {
            $headline = 'まずは最初の提案を待つ段階';
            $body = '名前の候補が1つ入るだけでも、次の人が訂正や補足をしやすくなります。';
            $steps[] = '最初の同定が1件入ると、記録が動き始めます';
        } elseif ($hasConflict) {
            $headline = 'いまは意見が割れている段階';
            $body = '系統の外れた候補が混じっているので、別の人の同定や追加写真があると整理しやすくなります。';
            $steps[] = '別の人からの同定があと1件あると、方向がまとまりやすいです';
            $steps[] = '見分けに効く写真を1枚足すと、訂正が入りやすくなります';
        } elseif (in_array($status, ['未同定', '要同定'], true)) {
            if ($communitySupporters < 2) {
                $steps[] = 'ほかの人からの同定があと1件あると、記録が安定しやすいです';
            }
            if (!$researchUsable) {
                $steps[] = '科か属までの提案が入ると、研究利用可に近づきます';
            } elseif (!$speciesOrBelow) {
                $steps[] = '種まで進めたいなら、種レベルの提案や細部写真があると進みやすいです';
            } else {
                $steps[] = '同じ種への別票があと1件あると、信頼済みに近づきます';
            }
            $body = '投稿だけで終わりではなく、同定や追加写真が入るほど記録の使いやすさが上がります。';
        } elseif ($status === '研究利用可') {
            $headline = 'いまは科・属レベルでかなり安定';
            $body = 'このままでも使いやすい記録ですが、種まで進む余地が残っています。';
            $steps[] = '種レベルの提案があと1件あると、種レベル研究用に近づきます';
            $steps[] = '花・葉・尾羽など決め手の写真があると、下位分類へ進みやすいです';
        } elseif ($status === '種レベル研究用') {
            $headline = 'いまは種レベルで安定';
            $body = '信頼済みの状態です。必要なら追加写真や補足で、あとから見返しやすくできます。';
            $steps[] = '行動や環境メモを足すと、100年後にも読みやすい記録になります';
        }

        return [
            'status' => $status,
            'active_identifications' => $activeCount,
            'community_supporters' => $communitySupporters,
            'headline' => $headline,
            'body' => $body,
            'steps' => array_values(array_unique(array_filter($steps))),
        ];
    }

    public static function buildTrustProgress(array $obs): array
    {
        $status = self::displayStatus($obs, '未同定');
        $activeIds = self::deduplicateIdentifications($obs['identifications'] ?? []);
        $activeCount = count($activeIds);
        $communitySupporters = (int)($obs['consensus']['community_supporters'] ?? 0);
        $taxonRank = strtolower((string)($obs['taxon']['rank'] ?? ($obs['consensus']['community_rank'] ?? 'unknown')));
        $researchUsable = self::isResearchUsableRank($taxonRank);
        $speciesOrBelow = self::isSpeciesOrBelowRank($taxonRank);
        $qualityFlags = is_array($obs['quality_flags'] ?? null) ? $obs['quality_flags'] : [];
        $managedContext = is_array($obs['managed_context'] ?? null) ? $obs['managed_context'] : [];

        $hasCoreRecord = !empty($qualityFlags['has_media']) && !empty($qualityFlags['has_date']) && !empty($qualityFlags['has_location']);
        $hasContext = (($obs['biome'] ?? 'unknown') !== 'unknown')
            || (($obs['life_stage'] ?? 'unknown') !== 'unknown')
            || !empty($obs['individual_count'])
            || !empty($managedContext['type'])
            || (($obs['organism_origin'] ?? 'wild') !== 'wild');
        $hasCommunityId = $activeCount > 0;
        $isStable = in_array($status, ['研究利用可', '種レベル研究用'], true);

        $progress = 0;
        if ($hasCoreRecord) {
            $progress += 25;
        }
        if ($hasContext) {
            $progress += 20;
        }
        if ($hasCommunityId) {
            $progress += 20;
        }
        if ($communitySupporters >= 2) {
            $progress += 15;
        }
        if ($status === '研究利用可') {
            $progress = max($progress, 80);
        }
        if ($status === '種レベル研究用') {
            $progress = 100;
        }
        $progress = max(10, min(100, $progress));

        $checkpoints = [
            [
                'label' => '記録できた',
                'complete' => $hasCoreRecord,
                'detail' => '写真・日時・場所',
            ],
            [
                'label' => '環境が入った',
                'complete' => $hasContext,
                'detail' => '環境・状態・個体数',
            ],
            [
                'label' => '名前が育った',
                'complete' => $hasCommunityId,
                'detail' => $activeCount > 0 ? $activeCount . '件の同定' : '最初の提案待ち',
            ],
            [
                'label' => $speciesOrBelow ? '種まで安定' : '安定した記録',
                'complete' => $isStable,
                'detail' => $status,
            ],
        ];

        $nextLabel = 'まずは写真・日時・場所をそろえる';
        if ($hasCoreRecord && !$hasContext) {
            $nextLabel = '環境や状態を1つ足すと、訂正が入りやすくなります';
        } elseif ($hasContext && !$hasCommunityId) {
            $nextLabel = '最初の名前提案が入ると、記録が動き始めます';
        } elseif ($hasCommunityId && !$isStable) {
            if (!$researchUsable) {
                $nextLabel = '科か属までの提案が入ると、研究利用可に近づきます';
            } elseif (!$speciesOrBelow) {
                $nextLabel = '種レベルの提案や細部写真があると、さらに進みやすくなります';
            } else {
                $nextLabel = '別の人からの同意が入ると、種レベルで安定しやすくなります';
            }
        } elseif ($isStable) {
            $nextLabel = '行動や環境メモを足すと、あとから見返しやすくなります';
        }

        return [
            'status' => $status,
            'progress' => $progress,
            'headline' => '信頼済みへの進み具合',
            'current_label' => $status,
            'next_label' => $nextLabel,
            'checkpoints' => $checkpoints,
            'community_supporters' => $communitySupporters,
            'active_identifications' => $activeCount,
        ];
    }

    public static function hasResolvedTaxon(array $obs): bool
    {
        $taxon = is_array($obs['taxon'] ?? null) ? $obs['taxon'] : [];
        $taxonName = trim((string)($taxon['name'] ?? ''));
        $taxonId = trim((string)($taxon['id'] ?? ''));
        $communityName = trim((string)($obs['community_taxon']['name'] ?? ''));
        $hasIdentifications = !empty($obs['identifications']) && is_array($obs['identifications']);

        if ($taxonId !== '') {
            return true;
        }

        if ($taxonName !== '' && $taxonName !== '未同定') {
            return true;
        }

        if ($communityName !== '') {
            return true;
        }

        return $hasIdentifications;
    }

    public static function isSpeciesResearchGrade(?string $value): bool
    {
        return in_array((string)$value, ['Research Grade', '研究用', '種レベル研究用'], true);
    }

    private static function isSpeciesOrBelowRank(string $rank): bool
    {
        return in_array($rank, ['species', 'subspecies', 'variety', 'form'], true);
    }

    private static function isResearchUsableRank(string $rank): bool
    {
        return in_array($rank, ['family', 'genus', 'species', 'subspecies', 'variety', 'form'], true);
    }

    /**
     * Build a taxon array from an identification record.
     *
     * @param array $id Identification entry
     * @return array Taxon data
     */
    private static function buildTaxonFromId(array $id): array
    {
        $taxon = is_array($id['taxon'] ?? null) ? $id['taxon'] : [];
        $built = [
            'id'              => $id['taxon_id'] ?? ($taxon['id'] ?? null),
            'name'            => $id['taxon_name'] ?? ($taxon['name'] ?? ''),
            'scientific_name' => $id['scientific_name'] ?? ($taxon['scientific_name'] ?? ''),
            'key'             => $id['taxon_key'] ?? ($taxon['key'] ?? ''),
            'slug'            => $id['taxon_slug'] ?? ($taxon['slug'] ?? ''),
            'rank'            => $id['taxon_rank'] ?? ($taxon['rank'] ?? 'species'),
            'lineage'         => $id['lineage'] ?? ($taxon['lineage'] ?? []),
            'lineage_ids'     => $id['lineage_ids'] ?? ($taxon['lineage_ids'] ?? []),
            'ancestry'        => $id['ancestry'] ?? ($taxon['ancestry'] ?? ''),
            'ancestry_ids'    => $id['ancestry_ids'] ?? ($taxon['ancestry_ids'] ?? []),
            'full_path_ids'   => $id['full_path_ids'] ?? ($taxon['full_path_ids'] ?? []),
            'taxonomy_version' => $id['taxonomy_version'] ?? ($taxon['taxonomy_version'] ?? null),
        ];

        if (!empty($built['id']) || !empty($built['full_path_ids']) || !empty($built['ancestry_ids']) || !empty($built['lineage_ids'])) {
            return $built;
        }

        require_once __DIR__ . '/Taxonomy.php';
        $resolved = Taxonomy::resolveFromInput([
            'taxon_name' => $built['name'],
            'scientific_name' => $built['scientific_name'],
            'taxon_slug' => $built['slug'],
            'taxon_key' => $built['key'],
            'taxon_rank' => $built['rank'],
            'lineage' => is_array($built['lineage']) ? $built['lineage'] : [],
            'lineage_ids' => is_array($built['lineage_ids']) ? $built['lineage_ids'] : [],
        ]);

        if (($resolved['provider'] ?? 'legacy') === 'legacy') {
            return $built;
        }

        return Taxonomy::toObservationTaxon($resolved);
    }

    private static function getIdentificationWeight(array $id): float
    {
        $stored = $id['weight_snapshot'] ?? $id['trust_weight'] ?? $id['weight'] ?? null;
        if ($stored !== null && is_numeric($stored)) {
            return (float)$stored;
        }

        require_once __DIR__ . '/TrustLevel.php';
        return TrustLevel::getWeight($id['user_id'] ?? '');
    }

    private static function selectTopLeafId(array $leafVotes): ?string
    {
        if (empty($leafVotes)) {
            return null;
        }
        arsort($leafVotes);
        return (string)array_key_first($leafVotes);
    }

    private static function selectCommunityNodeId(array $nodeVotes, array $nodeMeta, float $totalWeight): ?string
    {
        if ($totalWeight <= 0 || empty($nodeVotes)) {
            return null;
        }

        $eligible = [];
        foreach ($nodeVotes as $nodeId => $score) {
            $ratio = $score / $totalWeight;
            if ($ratio >= (2 / 3)) {
                $eligible[$nodeId] = [
                    'score' => $score,
                    'ratio' => $ratio,
                    'depth' => $nodeMeta[$nodeId]['depth'] ?? 0,
                ];
            }
        }

        if (empty($eligible)) {
            return null;
        }

        uasort($eligible, function ($left, $right) {
            if (($left['depth'] ?? 0) !== ($right['depth'] ?? 0)) {
                return ($right['depth'] ?? 0) <=> ($left['depth'] ?? 0);
            }
            if (($left['score'] ?? 0) !== ($right['score'] ?? 0)) {
                return ($right['score'] ?? 0) <=> ($left['score'] ?? 0);
            }
            return 0;
        });

        return (string)array_key_first($eligible);
    }

    private static function analyzeLineageConsistency(array $preparedVotes): array
    {
        require_once __DIR__ . '/Taxonomy.php';

        $conflicts = [];
        $compatible = 0;
        $unknown = 0;
        $count = count($preparedVotes);

        for ($i = 0; $i < $count; $i++) {
            for ($j = $i + 1; $j < $count; $j++) {
                $left = $preparedVotes[$i];
                $right = $preparedVotes[$j];
                $relation = Taxonomy::relation($left['taxon'], $right['taxon']);
                if ($relation === 'conflict') {
                    $conflicts[] = [
                        'left_user_id' => $left['user_id'],
                        'right_user_id' => $right['user_id'],
                        'left_taxon' => $left['taxon']['name'] ?? '',
                        'right_taxon' => $right['taxon']['name'] ?? '',
                    ];
                } elseif ($relation === 'unknown') {
                    $unknown++;
                } else {
                    $compatible++;
                }
            }
        }

        return [
            'pair_count' => ($count * ($count - 1)) / 2,
            'compatible_count' => $compatible,
            'unknown_count' => $unknown,
            'conflict_count' => count($conflicts),
            'conflicts' => array_slice($conflicts, 0, 10),
            'status' => count($conflicts) > 0 ? 'conflict' : ($unknown > 0 ? 'partial' : 'consistent'),
        ];
    }

    private static function buildCommunityTaxon(string $communityNodeId, array $preparedVotes, array $nodeMeta): array
    {
        foreach ($preparedVotes as $vote) {
            $path = $vote['path'];
            $position = array_search($communityNodeId, $path, true);
            if ($position === false) {
                continue;
            }

            $taxon = $vote['taxon'];
            $isLeaf = ($position === count($path) - 1);
            if ($isLeaf) {
                return $taxon;
            }

            return [
                'id' => $communityNodeId,
                'name' => $nodeMeta[$communityNodeId]['name'] ?? '',
                'scientific_name' => $nodeMeta[$communityNodeId]['name'] ?? '',
                'key' => self::extractLegacyKey($communityNodeId),
                'rank' => $nodeMeta[$communityNodeId]['rank'] ?? 'species',
                'lineage' => self::truncateLineage($taxon['lineage'] ?? [], $nodeMeta[$communityNodeId]['rank'] ?? 'species'),
                'lineage_ids' => self::truncateLineage($taxon['lineage_ids'] ?? [], $nodeMeta[$communityNodeId]['rank'] ?? 'species'),
                'ancestry' => implode('/', array_slice($path, 0, max(0, $position))),
                'ancestry_ids' => array_slice($path, 0, max(0, $position)),
                'full_path_ids' => array_slice($path, 0, $position + 1),
            ];
        }

        return [
            'id' => $communityNodeId,
            'name' => $nodeMeta[$communityNodeId]['name'] ?? '',
            'scientific_name' => $nodeMeta[$communityNodeId]['name'] ?? '',
            'key' => self::extractLegacyKey($communityNodeId),
            'rank' => $nodeMeta[$communityNodeId]['rank'] ?? 'species',
            'lineage' => [],
            'lineage_ids' => [],
            'ancestry' => '',
            'ancestry_ids' => [],
            'full_path_ids' => [$communityNodeId],
        ];
    }

    private static function selectBestSupportedDescendant(array $preparedVotes, array $leafVotes, ?string $communityNodeId): ?array
    {
        if ($communityNodeId === null) {
            return null;
        }

        $candidates = [];
        foreach ($preparedVotes as $vote) {
            $path = $vote['path'];
            if (!in_array($communityNodeId, $path, true)) {
                continue;
            }

            $leafId = end($path);
            if ($leafId === $communityNodeId) {
                continue;
            }

            $taxon = $vote['taxon'];
            $supporters = $candidates[$leafId]['supporters'] ?? [];
            $userId = $vote['user_id'] ?? '';
            if ($userId !== '') {
                $supporters[$userId] = true;
            }

            $candidates[$leafId] = [
                'taxon' => $taxon,
                'score' => $leafVotes[$leafId] ?? $vote['weight'],
                'depth' => count($path),
                'supporters' => $supporters,
            ];
        }

        if (empty($candidates)) {
            return null;
        }

        uasort($candidates, function ($left, $right) {
            if (($left['score'] ?? 0) !== ($right['score'] ?? 0)) {
                return ($right['score'] ?? 0) <=> ($left['score'] ?? 0);
            }
            if (($left['depth'] ?? 0) !== ($right['depth'] ?? 0)) {
                return ($right['depth'] ?? 0) <=> ($left['depth'] ?? 0);
            }
            return count($right['supporters'] ?? []) <=> count($left['supporters'] ?? []);
        });

        $best = reset($candidates);
        $taxon = $best['taxon'];
        $taxon['support_score'] = round((float)($best['score'] ?? 0.0), 3);
        $taxon['supporters'] = count($best['supporters'] ?? []);
        return $taxon;
    }

    private static function rankForPathNode(array $taxon, string $nodeId, int $depth, array $path): string
    {
        if ($nodeId === end($path)) {
            return strtolower((string)($taxon['rank'] ?? 'species'));
        }

        $lineageIds = $taxon['lineage_ids'] ?? [];
        foreach ($lineageIds as $rank => $lineageId) {
            if ($lineageId === $nodeId) {
                return strtolower((string)$rank);
            }
        }

        return ['kingdom', 'phylum', 'class', 'order', 'family', 'genus'][$depth] ?? 'species';
    }

    private static function labelPathNode(array $taxon, string $nodeId, int $depth, array $path): string
    {
        if ($nodeId === end($path)) {
            return $taxon['name'] ?? ($taxon['scientific_name'] ?? '');
        }

        $lineageIds = $taxon['lineage_ids'] ?? [];
        $lineage = $taxon['lineage'] ?? [];
        foreach ($lineageIds as $rank => $lineageId) {
            if ($lineageId === $nodeId) {
                return $lineage[$rank] ?? $nodeId;
            }
        }

        $lineageValues = array_values($lineage);
        return $lineageValues[$depth] ?? $nodeId;
    }

    private static function truncateLineage(array $lineage, string $rank): array
    {
        $order = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
        $result = [];
        foreach ($order as $candidateRank) {
            if (isset($lineage[$candidateRank])) {
                $result[$candidateRank] = $lineage[$candidateRank];
            }
            if ($candidateRank === $rank) {
                break;
            }
        }
        return $result;
    }

    private static function extractLegacyKey(string $nodeId): ?int
    {
        if (str_starts_with($nodeId, 'gbif:')) {
            $value = substr($nodeId, 5);
            return is_numeric($value) ? (int)$value : null;
        }
        return null;
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

    public static function resolveJaName(string $name): string
    {
        if ($name === '') return $name;
        if (!preg_match('/^[A-Za-z]/', $name)) return $name;

        try {
            require_once ROOT_DIR . '/libs/OmoikaneSearchEngine.php';
            $engine = new \OmoikaneSearchEngine();

            $resolved = $engine->resolveByScientificName($name);
            if ($resolved && !empty($resolved['japanese_name'])) {
                return $resolved['japanese_name'];
            }

            $resolved = $engine->resolveByJapaneseName($name);
            if ($resolved && !empty($resolved['japanese_name'])) {
                return $resolved['japanese_name'];
            }
        } catch (\Throwable $e) {
            // silent fallback
        }

        return $name;
    }
}
