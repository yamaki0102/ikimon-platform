<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';

class QuestManager
{
    const CONFIG_FILE = ROOT_DIR . '/data/config/quests.json';
    const CATALOG_FILE = ROOT_DIR . '/data/config/quest_catalog.json';
    const GOALS_DIR = DATA_DIR . '/user_goals';
    const MAX_ACTIVE_GOALS = 5;

    private static $definitions = null;
    private static ?array $catalog = null;

    public static function getDefinitions(): array
    {
        if (self::$definitions !== null) return self::$definitions;
        if (!file_exists(self::CONFIG_FILE)) {
            self::$definitions = [];
            return self::$definitions;
        }
        $defs = json_decode(file_get_contents(self::CONFIG_FILE), true) ?: [];
        self::$definitions = is_array($defs) ? $defs : [];
        return self::$definitions;
    }

    // ── Goal Catalog System (v2) ──

    public static function getGoalCatalog(): array
    {
        if (self::$catalog !== null) return self::$catalog;
        if (!file_exists(self::CATALOG_FILE)) {
            self::$catalog = [];
            return self::$catalog;
        }
        $data = json_decode(file_get_contents(self::CATALOG_FILE), true) ?: [];
        self::$catalog = $data['goals'] ?? [];
        return self::$catalog;
    }

    public static function getUserGoals(string $userId): array
    {
        $file = self::GOALS_DIR . '/' . $userId . '.json';
        if (!file_exists($file)) return [];
        $data = json_decode(file_get_contents($file), true);
        return is_array($data) ? $data : [];
    }

    private static function saveUserGoals(string $userId, array $data): void
    {
        if (!is_dir(self::GOALS_DIR)) mkdir(self::GOALS_DIR, 0755, true);
        file_put_contents(self::GOALS_DIR . '/' . $userId . '.json',
            json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    public static function activateGoal(string $userId, string $goalId): bool
    {
        $catalog = self::getGoalCatalog();
        $goalDef = null;
        foreach ($catalog as $g) {
            if (($g['id'] ?? '') === $goalId) { $goalDef = $g; break; }
        }
        if (!$goalDef) return false;

        $data = self::getUserGoals($userId);
        $activeGoals = $data['active_goals'] ?? [];
        if (in_array($goalId, $activeGoals, true)) return true;
        if (count($activeGoals) >= self::MAX_ACTIVE_GOALS) return false;

        $activeGoals[] = $goalId;
        $data['active_goals'] = $activeGoals;
        if (!isset($data['progress'][$goalId])) {
            $data['progress'][$goalId] = [
                'current' => 0,
                'last_milestone' => 0,
                'milestones_completed' => [],
                'activated_at' => date('Y-m-d'),
                'last_updated' => date('Y-m-d'),
            ];
        }
        self::saveUserGoals($userId, $data);
        return true;
    }

    public static function deactivateGoal(string $userId, string $goalId): bool
    {
        $data = self::getUserGoals($userId);
        $activeGoals = $data['active_goals'] ?? [];
        $key = array_search($goalId, $activeGoals, true);
        if ($key === false) return false;

        array_splice($activeGoals, $key, 1);
        $data['active_goals'] = array_values($activeGoals);
        self::saveUserGoals($userId, $data);
        return true;
    }

    public static function checkGoalProgress(string $userId, string $goalId): array
    {
        $catalog = self::getGoalCatalog();
        $goalDef = null;
        foreach ($catalog as $g) {
            if (($g['id'] ?? '') === $goalId) { $goalDef = $g; break; }
        }
        if (!$goalDef) return ['current' => 0, 'target' => 0, 'milestones' => [], 'current_milestone' => 0];

        $target = $goalDef['target'] ?? [];
        $milestones = $goalDef['milestones'] ?? [];
        $targetCount = (int)($target['count'] ?? 0);

        $current = self::computeGoalCount($userId, $target);

        $completedMilestones = [];
        $currentMilestoneIndex = 0;
        foreach ($milestones as $i => $m) {
            if ($current >= $m) {
                $completedMilestones[] = $m;
                $currentMilestoneIndex = $i + 1;
            }
        }

        return [
            'current' => $current,
            'target' => $targetCount,
            'percent' => $targetCount > 0 ? min(100, (int)floor(($current / $targetCount) * 100)) : 0,
            'milestones' => $milestones,
            'milestones_completed' => $completedMilestones,
            'current_milestone' => $currentMilestoneIndex,
            'total_milestones' => count($milestones),
            'completed' => $current >= $targetCount,
        ];
    }

    private static function computeGoalCount(string $userId, array $target): int
    {
        $metric = $target['metric'] ?? '';
        $type = $target['type'] ?? '';

        if (!empty($target['taxon_group'])) {
            $groups = explode('|', $target['taxon_group']);
            $all = DataStore::fetchAll('observations');
            $species = [];
            foreach ($all as $obs) {
                if (($obs['user_id'] ?? '') !== $userId) continue;
                $group = self::resolveTaxonGroup($obs);
                if (in_array($group, $groups, true)) {
                    $key = self::resolveSpeciesKey($obs);
                    if ($key) $species[$key] = true;
                }
            }
            return count($species);
        }

        if (!empty($target['taxon_order'])) {
            $all = DataStore::fetchAll('observations');
            $species = [];
            foreach ($all as $obs) {
                if (($obs['user_id'] ?? '') !== $userId) continue;
                $order = $obs['taxon']['lineage']['order'] ?? '';
                if ($order === $target['taxon_order']) {
                    $key = self::resolveSpeciesKey($obs);
                    if ($key) $species[$key] = true;
                }
            }
            return count($species);
        }

        switch ($type) {
            case 'post_count':
                $all = DataStore::fetchAll('observations');
                $count = 0;
                foreach ($all as $obs) {
                    if (($obs['user_id'] ?? '') !== $userId) continue;
                    if ($metric === 'total_with_photo' && empty($obs['photos'])) continue;
                    $count++;
                }
                return $count;

            case 'identifications':
                $all = DataStore::fetchAll('observations');
                $count = 0;
                foreach ($all as $obs) {
                    foreach ($obs['identifications'] ?? [] as $id) {
                        if (($id['user_id'] ?? '') === $userId) $count++;
                    }
                }
                return $count;

            case 'new_species':
                $lifeList = self::collectUserSpecies($userId, '9999-99-99');
                return count($lifeList);

            case 'new_location':
                $locations = self::collectUserLocations($userId, '9999-99-99');
                return count($locations);

            case 'phenology':
                $all = DataStore::fetchAll('observations');
                $count = 0;
                foreach ($all as $obs) {
                    if (($obs['user_id'] ?? '') !== $userId) continue;
                    $phenology = $obs['annotations']['phenology'] ?? 'none';
                    if ($phenology !== 'none' && $phenology !== 'unknown') $count++;
                }
                return $count;

            case 'taxon_groups':
                $all = DataStore::fetchAll('observations');
                $groups = [];
                foreach ($all as $obs) {
                    if (($obs['user_id'] ?? '') !== $userId) continue;
                    $g = self::resolveTaxonGroup($obs);
                    if ($g) $groups[$g] = true;
                }
                return count($groups);
        }

        return 0;
    }

    public static function getActiveGoalsWithProgress(string $userId): array
    {
        $data = self::getUserGoals($userId);
        $activeGoals = $data['active_goals'] ?? [];
        if (empty($activeGoals)) return [];

        $catalog = self::getGoalCatalog();
        $catalogMap = [];
        foreach ($catalog as $g) {
            $catalogMap[$g['id']] = $g;
        }

        $result = [];
        foreach ($activeGoals as $goalId) {
            if (!isset($catalogMap[$goalId])) continue;
            $goalDef = $catalogMap[$goalId];
            $progress = self::checkGoalProgress($userId, $goalId);
            $stored = $data['progress'][$goalId] ?? [];

            $result[] = [
                'goal' => $goalDef,
                'progress' => $progress,
                'last_milestone' => (int)($stored['last_milestone'] ?? 0),
                'milestones_completed' => $stored['milestones_completed'] ?? [],
                'activated_at' => $stored['activated_at'] ?? null,
            ];
        }
        return $result;
    }

    public static function syncGoalMilestones(string $userId): array
    {
        $data = self::getUserGoals($userId);
        $activeGoals = $data['active_goals'] ?? [];
        if (empty($activeGoals)) return [];

        $newMilestones = [];
        $changed = false;

        foreach ($activeGoals as $goalId) {
            $progress = self::checkGoalProgress($userId, $goalId);
            $stored = $data['progress'][$goalId] ?? [
                'current' => 0, 'last_milestone' => 0,
                'milestones_completed' => [], 'activated_at' => date('Y-m-d'), 'last_updated' => date('Y-m-d'),
            ];

            $oldMilestone = (int)($stored['last_milestone'] ?? 0);
            $newMilestone = $progress['current_milestone'];

            if ($newMilestone > $oldMilestone) {
                $catalog = self::getGoalCatalog();
                $goalDef = null;
                foreach ($catalog as $g) {
                    if (($g['id'] ?? '') === $goalId) { $goalDef = $g; break; }
                }

                $reward = $goalDef['reward_per_milestone'] ?? 100;
                $totalReward = ($newMilestone - $oldMilestone) * $reward;

                $stored['last_milestone'] = $newMilestone;
                $stored['milestones_completed'] = $progress['milestones_completed'];
                $stored['current'] = $progress['current'];
                $stored['last_updated'] = date('Y-m-d');
                $data['progress'][$goalId] = $stored;
                $changed = true;

                $newMilestones[] = [
                    'goal_id' => $goalId,
                    'goal' => $goalDef,
                    'milestone_index' => $newMilestone,
                    'milestone_value' => $progress['milestones'][$newMilestone - 1] ?? 0,
                    'reward' => $totalReward,
                    'progress' => $progress,
                ];
            } else {
                $stored['current'] = $progress['current'];
                $stored['last_updated'] = date('Y-m-d');
                $data['progress'][$goalId] = $stored;
                $changed = true;
            }
        }

        if ($changed) {
            self::saveUserGoals($userId, $data);
        }

        return $newMilestones;
    }

    public static function getRecommendedGoals(string $userId): array
    {
        $catalog = self::getGoalCatalog();
        $data = self::getUserGoals($userId);
        $activeGoals = $data['active_goals'] ?? [];

        $available = [];
        foreach ($catalog as $g) {
            if (!in_array($g['id'], $activeGoals, true)) {
                $available[] = $g;
            }
        }

        $lifeList = self::collectUserSpecies($userId, '9999-99-99');
        $speciesCount = count($lifeList);

        usort($available, function ($a, $b) use ($speciesCount) {
            $aScore = self::recommendationScore($a, $speciesCount);
            $bScore = self::recommendationScore($b, $speciesCount);
            return $bScore - $aScore;
        });

        return array_slice($available, 0, 5);
    }

    private static function recommendationScore(array $goal, int $speciesCount): int
    {
        $score = 0;
        $diff = $goal['difficulty'] ?? 'medium';
        if ($speciesCount < 10 && $diff === 'easy') $score += 30;
        elseif ($speciesCount >= 10 && $speciesCount < 30 && $diff === 'medium') $score += 30;
        elseif ($speciesCount >= 30 && $diff === 'hard') $score += 30;

        if (in_array('beginner', $goal['tags'] ?? []) && $speciesCount < 10) $score += 20;

        $month = (int)date('n');
        if ($month >= 3 && $month <= 5 && in_array('birds', $goal['tags'] ?? [])) $score += 15;
        if ($month >= 4 && $month <= 10 && in_array('insects', $goal['tags'] ?? [])) $score += 15;

        return $score;
    }

    // ── Legacy: Daily Quests (backward compat) ──

    public static function getActiveQuests(?string $userId = null): array
    {
        $definitions = self::getDefinitions();
        if (empty($definitions)) return [];

        $seed = crc32(date('Y-m-d') . ($userId ?? ''));
        $shuffled = $definitions;
        usort($shuffled, function ($a, $b) use ($seed) {
            $aKey = hash('sha256', $seed . ($a['id'] ?? ''));
            $bKey = hash('sha256', $seed . ($b['id'] ?? ''));
            return strcmp($aKey, $bKey);
        });

        return array_slice($shuffled, 0, 3);
    }

    public static function checkProgress(string $userId, string $questId): int
    {
        $definitions = self::getDefinitions();
        $quest = null;
        foreach ($definitions as $q) {
            if (($q['id'] ?? '') === $questId) {
                $quest = $q;
                break;
            }
        }
        if (!$quest) return 0;

        $today = date('Y-m-d');
        $todaysObs = DataStore::getLatest('observations', 300, function ($item) use ($userId, $today) {
            $created = $item['created_at'] ?? '';
            return ($item['user_id'] ?? '') === $userId && strpos($created, $today) === 0;
        });

        $target = $quest['target'] ?? [];
        $targetCount = (int)($target['count'] ?? 1);
        if ($targetCount <= 0) return 0;

        if (!empty($target['taxon_group'])) {
            $count = 0;
            foreach ($todaysObs as $obs) {
                $group = self::resolveTaxonGroup($obs);
                if ($group === $target['taxon_group']) {
                    $count++;
                }
            }
            return min(100, (int)floor(($count / $targetCount) * 100));
        }

        $type = $target['type'] ?? '';
        switch ($type) {
            case 'post_count':
                $count = count($todaysObs);
                return min(100, (int)floor(($count / $targetCount) * 100));
            case 'identifications':
                $count = 0;
                foreach ($todaysObs as $obs) {
                    foreach ($obs['identifications'] ?? [] as $id) {
                        if (($id['user_id'] ?? '') === $userId) $count++;
                    }
                }
                return min(100, (int)floor(($count / $targetCount) * 100));
            case 'new_species':
                $pastSpecies = self::collectUserSpecies($userId, $today);
                $newCount = 0;
                foreach ($todaysObs as $obs) {
                    $key = self::resolveSpeciesKey($obs);
                    if ($key && empty($pastSpecies[$key])) {
                        $newCount++;
                    }
                }
                return min(100, (int)floor(($newCount / $targetCount) * 100));
            case 'new_location':
                $pastLocations = self::collectUserLocations($userId, $today);
                $newCount = 0;
                foreach ($todaysObs as $obs) {
                    $key = self::resolveLocationKey($obs);
                    if ($key && empty($pastLocations[$key])) {
                        $newCount++;
                    }
                }
                return min(100, (int)floor(($newCount / $targetCount) * 100));
        }

        return 0;
    }

    private static function resolveTaxonGroup(array $obs): ?string
    {
        $lineage = $obs['taxon']['lineage'] ?? [];
        return $obs['taxon_group']
            ?? ($lineage['class'] ?? ($lineage['order'] ?? ($lineage['kingdom'] ?? null)));
    }

    private static function resolveSpeciesKey(array $obs): ?string
    {
        if (!empty($obs['taxon']['key'])) return $obs['taxon']['key'];
        if (!empty($obs['taxon']['name'])) return $obs['taxon']['name'];
        if (!empty($obs['taxon_name'])) return $obs['taxon_name'];
        return null;
    }

    private static function resolveLocationKey(array $obs): ?string
    {
        $name = $obs['location']['name'] ?? $obs['location_name'] ?? '';
        if (!empty($name)) return $name;
        $lat = $obs['latitude'] ?? $obs['lat'] ?? null;
        $lng = $obs['longitude'] ?? $obs['lng'] ?? null;
        if ($lat !== null && $lng !== null) {
            return round((float)$lat, 3) . ',' . round((float)$lng, 3);
        }
        return null;
    }

    private static function collectUserSpecies(string $userId, string $today): array
    {
        $all = DataStore::fetchAll('observations');
        $set = [];
        foreach ($all as $obs) {
            if (($obs['user_id'] ?? '') !== $userId) continue;
            $created = $obs['created_at'] ?? '';
            if (strpos($created, $today) === 0) continue;
            $key = self::resolveSpeciesKey($obs);
            if ($key) $set[$key] = true;
        }
        return $set;
    }

    private static function collectUserLocations(string $userId, string $today): array
    {
        $all = DataStore::fetchAll('observations');
        $set = [];
        foreach ($all as $obs) {
            if (($obs['user_id'] ?? '') !== $userId) continue;
            $created = $obs['created_at'] ?? '';
            if (strpos($created, $today) === 0) continue;
            $key = self::resolveLocationKey($obs);
            if ($key) $set[$key] = true;
        }
        return $set;
    }

    // ── Field Signals: 科学的緊急性のある観察機会のみ ──
    // 高価値4トリガーのみ時限付き。低価値はマイゴール統合

    const FIELD_SIGNAL_TTL_HIGH = 48 * 3600;  // 48h: redlist, area_first
    const FIELD_SIGNAL_TTL_MID  = 72 * 3600;  // 72h: id_challenge, evidence_upgrade
    const SCAN_QUEST_TTL = 72 * 3600; // legacy compat
    const MAX_QUESTS_PER_SCAN = 2;

    private static array $FIELD_SIGNAL_TRIGGERS = ['redlist', 'area_first', 'id_challenge', 'evidence_upgrade'];

    private static array $QUEST_TYPES = [
        'redlist'          => ['score' => 100, 'reward' => 450, 'rarity_label' => '極めて貴重',    'cta' => '記録を残す',    'icon' => 'alert-triangle'],
        'rare_find'        => ['score' => 90,  'reward' => 280, 'rarity_label' => 'レアファインド', 'cta' => '珍しい記録を残す', 'icon' => 'sparkles'],
        'area_first'       => ['score' => 80,  'reward' => 375, 'rarity_label' => '地域初記録',    'cta' => '初記録に挑戦',  'icon' => 'map-pin'],
        'multi_evidence'   => ['score' => 75,  'reward' => 220, 'rarity_label' => '多角的証拠',    'cta' => '写真+音声で記録', 'icon' => 'layers'],
        'id_challenge'     => ['score' => 70,  'reward' => 300, 'rarity_label' => '同定チャレンジ', 'cta' => '同定に挑戦',   'icon' => 'microscope'],
        'phenology_watch'  => ['score' => 60,  'reward' => 180, 'rarity_label' => '季節ウォッチャー', 'cta' => '季節を記録',  'icon' => 'calendar'],
        'evidence_upgrade' => ['score' => 50,  'reward' => 225, 'rarity_label' => '証拠強化',      'cta' => '証拠を追加',   'icon' => 'shield-check'],
        'new_species'      => ['score' => 40,  'reward' => 150, 'rarity_label' => '初記録種',      'cta' => '図鑑に追加',   'icon' => 'book-open'],
        'photo_needed'     => ['score' => 30,  'reward' => 100, 'rarity_label' => '写真募集',      'cta' => '写真で記録',   'icon' => 'camera'],
    ];

    public static function generateFromScan(string $userId, array $summary, array $sessionMeta): array
    {
        $speciesDetail = $summary['species_detail'] ?? [];
        $detectedSpecies = $summary['species'] ?? [];
        if (empty($detectedSpecies) && empty($speciesDetail)) return [];

        if (empty($speciesDetail)) {
            foreach ($detectedSpecies as $name => $count) {
                $speciesDetail[$name] = ['count' => $count, 'scientific_name' => '', 'max_confidence' => 0.5, 'category' => ''];
            }
        }

        $lifeList = self::collectUserSpecies($userId, '9999-99-99');
        $photoSpecies = self::collectUserPhotoSpecies($userId);
        $lat = (float)($sessionMeta['center_lat'] ?? 0);
        $lng = (float)($sessionMeta['center_lng'] ?? 0);

        $redListMgr = null;
        if (file_exists(ROOT_DIR . '/libs/RedListManager.php')) {
            require_once ROOT_DIR . '/libs/RedListManager.php';
            $redListMgr = new RedListManager();
        }

        $hasCanonical = file_exists(ROOT_DIR . '/libs/CanonicalStore.php');
        if ($hasCanonical) {
            require_once ROOT_DIR . '/libs/CanonicalStore.php';
        }

        $candidates = [];
        $seenSpecies = [];

        foreach ($speciesDetail as $name => $detail) {
            if (empty($name) || mb_strlen($name) < 2) continue;

            $sci = $detail['scientific_name'] ?? '';
            $conf = (float)($detail['max_confidence'] ?? 0);
            $count = (int)($detail['count'] ?? 1);
            $category = $detail['category'] ?? '';

            $bestTrigger = null;
            $bestScore = 0;
            $extraContext = [];

            // 1. レッドリスト種
            if ($redListMgr && !empty($sci)) {
                $rlResult = $redListMgr->lookup($name);
                $natCode = $rlResult['national']['code'] ?? '';
                if (in_array($natCode, ['CR', 'EN', 'VU'], true)) {
                    $score = self::$QUEST_TYPES['redlist']['score'];
                    if ($score > $bestScore) {
                        $bestTrigger = 'redlist';
                        $bestScore = $score;
                        $extraContext['redlist_code'] = $natCode;
                        $extraContext['redlist_label'] = match($natCode) {
                            'CR' => '絶滅危惧IA類',
                            'EN' => '絶滅危惧IB類',
                            'VU' => '絶滅危惧II類',
                            default => $natCode,
                        };
                    }
                }
            }

            // 2. 地域初記録
            if ($hasCanonical && !empty($sci) && $lat && $lng) {
                if (self::checkAreaFirstRecord($sci, $lat, $lng)) {
                    $score = self::$QUEST_TYPES['area_first']['score'];
                    if ($score > $bestScore) {
                        $bestTrigger = 'area_first';
                        $bestScore = $score;
                    }
                }
            }

            // 3. 同定チャレンジ（scientific_name空 = 科名レベル止まり）
            if (empty($sci) && $conf >= 0.3) {
                $score = self::$QUEST_TYPES['id_challenge']['score'];
                if ($score > $bestScore) {
                    $bestTrigger = 'id_challenge';
                    $bestScore = $score;
                }
            }

            // 4. 証拠グレードアップ（既存Tier1の再検出）
            if ($hasCanonical && !empty($sci)) {
                $existing = CanonicalStore::searchBySpecies($sci, 5);
                $hasTier1 = false;
                foreach ($existing as $occ) {
                    if (($occ['evidence_tier'] ?? 0) <= 1) { $hasTier1 = true; break; }
                }
                if ($hasTier1) {
                    $score = self::$QUEST_TYPES['evidence_upgrade']['score'];
                    if ($score > $bestScore) {
                        $bestTrigger = 'evidence_upgrade';
                        $bestScore = $score;
                    }
                }
            }

            // 5. ユーザー初記録
            if (!isset($lifeList[$name])) {
                $score = self::$QUEST_TYPES['new_species']['score'];
                if ($score > $bestScore) {
                    $bestTrigger = 'new_species';
                    $bestScore = $score;
                }
            }

            // 6. 写真なし
            if (!isset($photoSpecies[$name]) && isset($lifeList[$name])) {
                $score = self::$QUEST_TYPES['photo_needed']['score'];
                if ($score > $bestScore) {
                    $bestTrigger = 'photo_needed';
                    $bestScore = $score;
                }
            }

            if (!$bestTrigger) continue;

            // ボーナス加算
            if ($conf >= 0.7) $bestScore += 10;
            if ($count >= 2) $bestScore += 15;

            $candidates[] = [
                'species_name' => $name,
                'scientific_name' => $sci,
                'trigger' => $bestTrigger,
                'priority_score' => $bestScore,
                'confidence' => $conf,
                'category' => $category,
                'context' => $extraContext,
            ];
        }

        if (empty($candidates)) return [];

        // フィールドシグナル: 高価値トリガーのみ時限クエスト化
        $candidates = array_values(array_filter($candidates, function ($c) {
            return in_array($c['trigger'], self::$FIELD_SIGNAL_TRIGGERS, true);
        }));

        if (empty($candidates)) return [];

        // Variable Ratio: redlist/area_first は常時表示、他は85%
        if (!self::shouldShowQuests($candidates, $sessionMeta)) {
            return [];
        }

        usort($candidates, fn($a, $b) => $b['priority_score'] - $a['priority_score']);
        $selected = array_slice($candidates, 0, self::MAX_QUESTS_PER_SCAN);

        $now = date('c');
        $sessionId = $sessionMeta['session_id'] ?? ('ps_' . bin2hex(random_bytes(6)));

        $quests = [];
        foreach ($selected as $c) {
            $type = self::$QUEST_TYPES[$c['trigger']];
            $quests[] = [
                'id' => 'sq_' . bin2hex(random_bytes(6)),
                'type' => 'field_signal',
                'species_name' => $c['species_name'],
                'scientific_name' => $c['scientific_name'],
                'trigger' => $c['trigger'],
                'priority_score' => $c['priority_score'],
                'title' => self::buildQuestTitle($c),
                'description' => self::buildQuestDescription($c),
                'progress_hint' => self::buildProgressHint($c),
                'reward' => $type['reward'],
                'rarity_label' => $type['rarity_label'],
                'cta_text' => $type['cta'],
                'icon' => $type['icon'],
                'scan_session_id' => $sessionId,
                'created_at' => $now,
                'expires_at' => null,
                'completed_at' => null,
            ];
        }

        return $quests;
    }

    private static function shouldShowQuests(array $candidates, array $sessionMeta): bool
    {
        $alwaysShow = ['redlist', 'area_first'];
        foreach ($candidates as $c) {
            if (in_array($c['trigger'], $alwaysShow, true)) {
                return true;
            }
        }

        $seed = crc32($sessionMeta['session_id'] ?? date('c'));
        $roll = abs($seed) % 100;
        return $roll < 85;
    }

    private static function checkAreaFirstRecord(string $scientificName, float $lat, float $lng): bool
    {
        if (empty($scientificName) || !$lat || !$lng) return false;

        try {
            $existing = CanonicalStore::searchBySpecies($scientificName, 50);
            foreach ($existing as $occ) {
                $oLat = (float)($occ['decimal_latitude'] ?? 0);
                $oLng = (float)($occ['decimal_longitude'] ?? 0);
                if (abs($oLat - $lat) < 0.01 && abs($oLng - $lng) < 0.01) {
                    return false;
                }
            }
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    private static function buildQuestTitle(array $c): string
    {
        $name = $c['species_name'];
        return match($c['trigger']) {
            'redlist' => '絶滅危惧種の記録チャンス',
            'area_first' => 'このエリアで ' . $name . ' は初検出',
            'id_challenge' => $name . ' — 種名を特定できますか？',
            'evidence_upgrade' => $name . ' の確実な証拠を残そう',
            'new_species' => 'キミの図鑑に新しい1ページ',
            'photo_needed' => $name . ' の写真記録を完成させよう',
            default => $name . ' を記録しよう',
        };
    }

    private static function buildQuestDescription(array $c): string
    {
        $name = $c['species_name'];
        return match($c['trigger']) {
            'redlist' => '環境省レッドリスト ' . ($c['context']['redlist_label'] ?? '') . '。写真記録はこの地域の保全データとして大きな価値があります',
            'area_first' => 'このエリアで ' . $name . ' はまだ記録がありません。あなたが最初の記録者になれるかもしれません',
            'id_challenge' => 'AIが「' . $name . '」まで絞り込みました。近づいて特徴を撮影すると、種レベルの同定につながります',
            'evidence_upgrade' => $name . ' のAI検出記録はありますが、写真証拠がまだありません。1枚の写真でデータの信頼度が上がります',
            'new_species' => $name . ' はキミがまだ記録したことのない種です。写真付きで図鑑に追加しましょう',
            'photo_needed' => $name . ' は過去に検出されていますが、写真がまだありません',
            default => $name . ' を写真で記録しましょう',
        };
    }

    private static function buildProgressHint(array $c): string
    {
        $pct = max(1, (int)round($c['confidence'] * 100));
        return match($c['trigger']) {
            'redlist' => 'AIが ' . $pct . '% の確度で検出。写真1枚で確定記録に',
            'area_first' => 'AIが ' . $pct . '% の確度で検出。この地域のデータベースに初めて登録されます',
            'id_challenge' => 'AI同定率 ' . $pct . '%（科レベル）。あと少しで種名確定',
            'evidence_upgrade' => '現在の証拠グレード: Tier 1（AI単独）→ 写真追加で Tier 2 へ',
            'new_species' => 'AIが ' . $pct . '% の確度で検出。写真で確定させよう',
            'photo_needed' => '記録はあるが写真がまだない種です',
            default => '',
        };
    }

    public static function saveScanQuests(string $userId, array $newQuests): void
    {
        if (empty($newQuests)) return;
        $file = 'scan_quests/' . $userId;
        $existing = DataStore::get($file) ?: [];
        if (!is_array($existing)) $existing = [];

        $existing = array_filter($existing, function ($q) {
            return empty($q['completed_at']);
        });

        $existing = array_merge(array_values($existing), $newQuests);
        if (count($existing) > 20) {
            $existing = array_slice($existing, -20);
        }
        DataStore::save($file, $existing);
    }

    public static function getScanQuests(string $userId): array
    {
        $file = 'scan_quests/' . $userId;
        $quests = DataStore::get($file) ?: [];
        if (!is_array($quests)) return [];

        $now = time();
        return array_values(array_filter($quests, function ($q) use ($now) {
            if (!empty($q['completed_at'])) return false;
            $expiresAt = $q['expires_at'] ?? null;
            if ($expiresAt === null) return true;
            $exp = strtotime($expiresAt);
            return $exp && $exp > $now;
        }));
    }

    public static function completeScanQuest(string $userId, string $questId): ?array
    {
        $file = 'scan_quests/' . $userId;
        $quests = DataStore::get($file) ?: [];
        if (!is_array($quests)) return null;

        $completed = null;
        foreach ($quests as &$q) {
            if (($q['id'] ?? '') === $questId && empty($q['completed_at'])) {
                $q['completed_at'] = date('c');
                $completed = $q;
                break;
            }
        }
        unset($q);

        if ($completed) {
            DataStore::save($file, $quests);
        }
        return $completed;
    }

    public static function checkScanQuestMatch(string $userId, array $obs): ?array
    {
        $quests = self::getScanQuests($userId);
        if (empty($quests)) return null;
        if (empty($obs['photos'])) return null;

        $obsSpecies = $obs['taxon']['name'] ?? $obs['species_name'] ?? '';
        if (empty($obsSpecies)) return null;

        foreach ($quests as $q) {
            if ($q['species_name'] === $obsSpecies) {
                return self::completeScanQuest($userId, $q['id']);
            }
        }
        return null;
    }

    private static function collectUserPhotoSpecies(string $userId): array
    {
        $all = DataStore::fetchAll('observations');
        $set = [];
        foreach ($all as $obs) {
            if (($obs['user_id'] ?? '') !== $userId) continue;
            if (empty($obs['photos'])) continue;
            $key = self::resolveSpeciesKey($obs);
            if ($key) $set[$key] = true;
        }
        return $set;
    }

    // ── Phase 16: 新クエストトリガー ──

    /**
     * 分布異常検出と連動した rare_find クエスト生成
     */
    public static function checkRareFindTrigger(string $userId, array $observation): ?array
    {
        if (!file_exists(ROOT_DIR . '/libs/DistributionAnalyzer.php')) return null;
        require_once ROOT_DIR . '/libs/DistributionAnalyzer.php';

        $result = DistributionAnalyzer::analyzeObservation($observation);
        if ($result === null) return null;

        $name = $observation['taxon']['name'] ?? $observation['taxon_name'] ?? '';
        $type = self::$QUEST_TYPES['rare_find'];
        $now = date('c');

        return [
            'id' => 'sq_' . bin2hex(random_bytes(6)),
            'type' => 'scan_followup',
            'species_name' => $name,
            'trigger' => 'rare_find',
            'priority_score' => $type['score'],
            'title' => "{$name} — {$result['area_name']}で珍しい発見！",
            'description' => $result['message'],
            'reward' => $type['reward'],
            'rarity_label' => $result['rarity_level'] === 'area_first' ? '地域初記録' : 'レアファインド',
            'cta_text' => $type['cta'],
            'icon' => $type['icon'],
            'distribution_data' => $result,
            'created_at' => $now,
            'expires_at' => date('c', time() + self::SCAN_QUEST_TTL),
            'completed_at' => null,
        ];
    }

    /**
     * アノテーション付き投稿と連動した phenology_watch クエスト
     */
    public static function checkPhenologyTrigger(string $userId, array $observation): ?array
    {
        $annotations = $observation['annotations'] ?? [];
        $phenology = $annotations['phenology'] ?? 'none';
        if ($phenology === 'none' || $phenology === 'unknown') return null;

        $phenologyLabels = [
            'flowering' => '開花', 'fruiting' => '結実',
            'budding' => '発芽', 'senescing' => '紅葉/落葉',
        ];
        $label = $phenologyLabels[$phenology] ?? $phenology;
        $type = self::$QUEST_TYPES['phenology_watch'];
        $now = date('c');

        $todayAnnotated = self::countTodayAnnotatedObs($userId);
        if ($todayAnnotated >= 3) return null;

        return [
            'id' => 'sq_' . bin2hex(random_bytes(6)),
            'type' => 'scan_followup',
            'trigger' => 'phenology_watch',
            'priority_score' => $type['score'],
            'title' => "季節ウォッチャー: {$label}を記録中",
            'description' => "今日{$label}の状態を3種記録しよう。フェノロジーデータは気候変動研究に直結します",
            'progress_hint' => "{$todayAnnotated}/3 種記録済み",
            'reward' => $type['reward'],
            'rarity_label' => $type['rarity_label'],
            'cta_text' => $type['cta'],
            'icon' => $type['icon'],
            'target_count' => 3,
            'current_count' => $todayAnnotated,
            'created_at' => $now,
            'expires_at' => date('c', strtotime('tomorrow')),
            'completed_at' => $todayAnnotated >= 2 ? $now : null,
        ];
    }

    private static function countTodayAnnotatedObs(string $userId): int
    {
        $today = date('Y-m-d');
        $obs = DataStore::getLatest('observations', 100, function ($item) use ($userId, $today) {
            return ($item['user_id'] ?? '') === $userId
                && strpos($item['created_at'] ?? '', $today) === 0
                && !empty($item['annotations'])
                && ($item['annotations']['phenology'] ?? 'none') !== 'none';
        });
        return count($obs);
    }

    // ── Phase 16: クエストチェーン ──

    const CHAIN_DIR = DATA_DIR . '/quest_chains';

    /**
     * アクティブなチェーンクエストを取得
     */
    public static function getUserChains(string $userId): array
    {
        $file = self::CHAIN_DIR . '/' . $userId . '.json';
        if (!file_exists($file)) return [];
        $data = json_decode(file_get_contents($file), true);
        return is_array($data) ? $data : [];
    }

    /**
     * チェーンの進捗を更新
     */
    public static function advanceChain(string $userId, string $chainId): ?array
    {
        $chains = self::getUserChains($userId);
        foreach ($chains as &$chain) {
            if (($chain['id'] ?? '') !== $chainId) continue;
            $steps = $chain['steps'] ?? [];
            $currentStep = (int)($chain['current_step'] ?? 0);

            if ($currentStep >= count($steps)) continue;

            $chain['current_step'] = $currentStep + 1;
            if ($chain['current_step'] >= count($steps)) {
                $chain['completed_at'] = date('c');
            }

            if (!is_dir(self::CHAIN_DIR)) mkdir(self::CHAIN_DIR, 0755, true);
            file_put_contents(self::CHAIN_DIR . '/' . $userId . '.json',
                json_encode($chains, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

            return $chain;
        }
        return null;
    }

    /**
     * 初期チェーンクエストを生成（季節ベース）
     */
    public static function generateSeasonalChains(string $userId): array
    {
        $existing = self::getUserChains($userId);
        $activeIds = array_column($existing, 'id');

        $month = (int)date('n');
        $chains = [];

        if ($month >= 3 && $month <= 5) {
            $chainId = 'chain_spring_birds_' . date('Y');
            if (!in_array($chainId, $activeIds, true)) {
                $chains[] = [
                    'id' => $chainId,
                    'title' => '春の渡り鳥チェーン',
                    'description' => '春の渡り鳥を段階的に記録しよう',
                    'icon' => 'bird',
                    'steps' => [
                        ['title' => '渡り鳥を1種発見', 'target_count' => 1, 'completed' => false],
                        ['title' => '渡り鳥を3種発見', 'target_count' => 3, 'completed' => false],
                        ['title' => '渡り鳥5種+音声証拠', 'target_count' => 5, 'completed' => false],
                    ],
                    'current_step' => 0,
                    'reward_badge' => 'spring_migration_master',
                    'created_at' => date('c'),
                    'expires_at' => null,
                    'completed_at' => null,
                ];
            }
        }

        if ($month >= 4 && $month <= 10) {
            $chainId = 'chain_insect_diversity_' . date('Y');
            if (!in_array($chainId, $activeIds, true)) {
                $chains[] = [
                    'id' => $chainId,
                    'title' => '昆虫多様性チェーン',
                    'description' => '異なる目の昆虫を記録しよう',
                    'icon' => 'bug',
                    'steps' => [
                        ['title' => '昆虫を3目記録', 'target_count' => 3, 'completed' => false],
                        ['title' => '昆虫を5目記録', 'target_count' => 5, 'completed' => false],
                        ['title' => '昆虫7目+幼虫1種', 'target_count' => 7, 'completed' => false],
                    ],
                    'current_step' => 0,
                    'reward_badge' => 'insect_diversity_master',
                    'created_at' => date('c'),
                    'expires_at' => null,
                    'completed_at' => null,
                ];
            }
        }

        if ($month >= 3 && $month <= 5 || $month >= 9 && $month <= 11) {
            $chainId = 'chain_phenology_' . date('Y') . '_' . ($month <= 5 ? 'spring' : 'autumn');
            if (!in_array($chainId, $activeIds, true)) {
                $season = $month <= 5 ? '春' : '秋';
                $chains[] = [
                    'id' => $chainId,
                    'title' => "{$season}のフェノロジーチェーン",
                    'description' => '季節の変化を記録しよう',
                    'icon' => 'calendar',
                    'steps' => [
                        ['title' => "アノテーション付き投稿を3件", 'target_count' => 3, 'completed' => false],
                        ['title' => "異なる種で5件のアノテーション", 'target_count' => 5, 'completed' => false],
                        ['title' => "3つの異なるフェノロジー状態を記録", 'target_count' => 3, 'completed' => false],
                    ],
                    'current_step' => 0,
                    'reward_badge' => 'phenology_observer',
                    'created_at' => date('c'),
                    'expires_at' => null,
                    'completed_at' => null,
                ];
            }
        }

        if (!empty($chains)) {
            $all = array_merge($existing, $chains);
            if (!is_dir(self::CHAIN_DIR)) mkdir(self::CHAIN_DIR, 0755, true);
            file_put_contents(self::CHAIN_DIR . '/' . $userId . '.json',
                json_encode($all, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        }

        return $chains;
    }

    // ── Phase 16: AI パーソナルクエスト生成 ──

    /**
     * GPT-5.4 nano でユーザー個別の今日のクエストを生成
     */
    public static function generatePersonalQuest(string $userId, float $lat, float $lng): ?array
    {
        $weekKey = date('Y') . '-W' . date('W');
        $cacheFile = 'personal_quests/' . $userId . '_' . $weekKey;
        $cached = DataStore::get($cacheFile);
        if ($cached && is_array($cached)) return $cached;

        if (!file_exists(ROOT_DIR . '/libs/OpenAiClient.php')) return null;
        require_once ROOT_DIR . '/libs/OpenAiClient.php';
        if (!OpenAiClient::isConfigured()) return null;

        require_once ROOT_DIR . '/libs/SpeciesRecommender.php';
        $recommendations = SpeciesRecommender::recommend($lat, $lng, $userId);

        $lifeList = self::collectUserSpecies($userId, '9999-99-99');
        $speciesCount = count($lifeList);

        $taxonGroups = [];
        foreach ($lifeList as $name => $_) {
            $taxonGroups[] = $name;
        }
        $recentGroups = array_slice($taxonGroups, -10);

        $recNames = array_map(fn($r) => $r['species_name'], $recommendations);
        $month = (int)date('n');
        $seasonLabel = match(true) {
            $month >= 3 && $month <= 5 => '春',
            $month >= 6 && $month <= 8 => '夏',
            $month >= 9 && $month <= 11 => '秋',
            default => '冬',
        };

        $recentLabel = $recentGroups[0] ?? '不明';
        $rec1 = $recNames[0] ?? '不明';
        $rec2 = $recNames[1] ?? '不明';
        $rec3 = $recNames[2] ?? '不明';

        $systemPrompt = <<<PROMPT
あなたは生物多様性プラットフォーム「ikimon」のクエストデザイナーです。
ユーザーの観察履歴と周辺環境から、今日の最適なチャレンジを1つ生成してください。
科学的価値のある行動を促し、発見の喜びを感じさせる文章にしてください。
出力はJSON形式のみ。
PROMPT;

        $userMessage = <<<MSG
ユーザー情報:
- 記録種数: {$speciesCount}種
- 最近の記録: {$recentLabel}など
- 現在の季節: {$seasonLabel}（{$month}月）
- 近くで見つかりそうな未記録種: {$rec1}, {$rec2}, {$rec3}

以下のJSON形式で1つのクエストを生成:
{"quest_type": "explore|photograph|identify|phenology", "target_description": "具体的な目標(30文字以内)", "motivation_text": "やる気が出る一言(40文字以内)", "difficulty": "easy|medium|hard", "scientific_value": "データの科学的価値(20文字以内)"}
MSG;

        $schema = [
            'name' => 'personal_quest',
            'schema' => [
                'type' => 'object',
                'properties' => [
                    'quest_type' => ['type' => 'string', 'enum' => ['explore', 'photograph', 'identify', 'phenology']],
                    'target_description' => ['type' => 'string'],
                    'motivation_text' => ['type' => 'string'],
                    'difficulty' => ['type' => 'string', 'enum' => ['easy', 'medium', 'hard']],
                    'scientific_value' => ['type' => 'string'],
                ],
                'required' => ['quest_type', 'target_description', 'motivation_text', 'difficulty', 'scientific_value'],
                'additionalProperties' => false,
            ],
        ];

        $result = OpenAiClient::generate($systemPrompt, $userMessage, $schema, [
            'max_tokens' => 200,
            'temperature' => 0.8,
        ]);

        if ($result === null) return null;

        $questData = $result['data'] ?? [];
        $icons = [
            'explore' => 'compass', 'photograph' => 'camera',
            'identify' => 'microscope', 'phenology' => 'calendar',
        ];

        $quest = [
            'id' => 'pq_' . bin2hex(random_bytes(6)),
            'type' => 'personal',
            'quest_type' => $questData['quest_type'] ?? 'explore',
            'title' => $questData['target_description'] ?? '今日のチャレンジ',
            'description' => $questData['motivation_text'] ?? '',
            'difficulty' => $questData['difficulty'] ?? 'medium',
            'scientific_value' => $questData['scientific_value'] ?? '',
            'icon' => $icons[$questData['quest_type'] ?? 'explore'] ?? 'compass',
            'reward' => match($questData['difficulty'] ?? 'medium') {
                'easy' => 100, 'hard' => 250, default => 150,
            },
            'ai_model' => $result['model'] ?? 'gpt-5.4-nano',
            'created_at' => date('c'),
            'expires_at' => null,
            'completed_at' => null,
        ];

        DataStore::save($cacheFile, $quest);
        return $quest;
    }

    // ── Community Signals: 他人枠 ──

    const COMMUNITY_SIGNALS_FILE = 'community_signals';
    const COMMUNITY_SIGNAL_TTL = 72 * 3600;
    const COMMUNITY_MAX_RESPONDENTS = 5;
    const COMMUNITY_REWARD_CAP = 300;

    public static function publishCommunitySignal(string $userId, array $quest, float $lat, float $lng): void
    {
        if (empty($quest['species_name']) || empty($quest['trigger'])) return;

        $existing = DataStore::get(self::COMMUNITY_SIGNALS_FILE) ?: [];
        if (!is_array($existing)) $existing = [];

        $dupKey = $quest['species_name'] . '|' . round($lat, 2) . '|' . round($lng, 2);
        foreach ($existing as $s) {
            if (!($s['closed'] ?? false)) {
                $sKey = ($s['species_name'] ?? '') . '|' . round($s['center_lat'] ?? 0, 2) . '|' . round($s['center_lng'] ?? 0, 2);
                if ($sKey === $dupKey) return;
            }
        }

        $reward = min((int)($quest['reward'] ?? 300), self::COMMUNITY_REWARD_CAP);

        $roundedLat = round($lat, 2);
        $roundedLng = round($lng, 2);

        $areaLabel = '';
        if (file_exists(ROOT_DIR . '/libs/GeoUtils.php')) {
            require_once ROOT_DIR . '/libs/GeoUtils.php';
            $geo = GeoUtils::reverseGeocode($lat, $lng);
            $areaLabel = ($geo['municipality'] ?? '') ?: ($geo['prefecture'] ?? '');
            if ($areaLabel) $areaLabel .= '周辺';
        }

        $signal = [
            'id' => 'cs_' . bin2hex(random_bytes(6)),
            'source_user_id' => $userId,
            'species_name' => $quest['species_name'],
            'scientific_name' => $quest['scientific_name'] ?? '',
            'trigger' => $quest['trigger'],
            'title' => $quest['title'] ?? '',
            'description' => $quest['description'] ?? '',
            'reward' => $reward,
            'rarity_label' => $quest['rarity_label'] ?? '',
            'cta_text' => $quest['cta_text'] ?? '記録する',
            'icon' => $quest['icon'] ?? 'radio',
            'center_lat' => $roundedLat,
            'center_lng' => $roundedLng,
            'area_label' => $areaLabel,
            'created_at' => date('c'),
            'expires_at' => date('c', time() + self::COMMUNITY_SIGNAL_TTL),
            'respondents' => [],
            'max_respondents' => self::COMMUNITY_MAX_RESPONDENTS,
            'closed' => false,
        ];

        $existing[] = $signal;

        self::cleanupCommunitySignals($existing);
        DataStore::save(self::COMMUNITY_SIGNALS_FILE, $existing);
    }

    public static function getCommunitySignals(string $userId, ?float $lat = null, ?float $lng = null): array
    {
        $all = DataStore::get(self::COMMUNITY_SIGNALS_FILE) ?: [];
        if (!is_array($all)) return [];

        $now = time();
        $result = [];

        foreach ($all as $s) {
            if ($s['closed'] ?? false) continue;
            if (($s['source_user_id'] ?? '') === $userId) continue;
            if (in_array($userId, $s['respondents'] ?? [], true)) continue;

            $exp = strtotime($s['expires_at'] ?? '');
            if ($exp && $exp <= $now) continue;

            $respondents = $s['respondents'] ?? [];
            if (count($respondents) >= ($s['max_respondents'] ?? self::COMMUNITY_MAX_RESPONDENTS)) continue;

            if ($lat !== null && $lng !== null) {
                $dist = self::haversineDistance($lat, $lng, $s['center_lat'] ?? 0, $s['center_lng'] ?? 0);
                if ($dist > 2.0) continue;
                $s['distance_km'] = round($dist, 1);
            }

            $s['remaining_slots'] = ($s['max_respondents'] ?? self::COMMUNITY_MAX_RESPONDENTS) - count($respondents);
            $result[] = $s;
        }

        usort($result, function ($a, $b) {
            $aScore = self::$QUEST_TYPES[$a['trigger'] ?? '']['score'] ?? 0;
            $bScore = self::$QUEST_TYPES[$b['trigger'] ?? '']['score'] ?? 0;
            return $bScore - $aScore;
        });

        return $result;
    }

    public static function respondToCommunitySignal(string $userId, string $signalId): bool
    {
        $all = DataStore::get(self::COMMUNITY_SIGNALS_FILE) ?: [];
        if (!is_array($all)) return false;

        foreach ($all as &$s) {
            if (($s['id'] ?? '') !== $signalId) continue;
            if ($s['closed'] ?? false) return false;
            if (($s['source_user_id'] ?? '') === $userId) return false;

            $respondents = $s['respondents'] ?? [];
            if (in_array($userId, $respondents, true)) return true;
            if (count($respondents) >= ($s['max_respondents'] ?? self::COMMUNITY_MAX_RESPONDENTS)) return false;

            $s['respondents'][] = $userId;

            if (count($s['respondents']) >= ($s['max_respondents'] ?? self::COMMUNITY_MAX_RESPONDENTS)) {
                $s['closed'] = true;
            }

            DataStore::save(self::COMMUNITY_SIGNALS_FILE, $all);
            return true;
        }
        return false;
    }

    public static function completeCommunitySignal(string $userId, string $signalId): ?array
    {
        $all = DataStore::get(self::COMMUNITY_SIGNALS_FILE) ?: [];
        if (!is_array($all)) return null;

        foreach ($all as &$s) {
            if (($s['id'] ?? '') !== $signalId) continue;

            $completed = $s['completed_by'] ?? [];
            if (in_array($userId, $completed, true)) return null;

            if (!isset($s['completed_by'])) $s['completed_by'] = [];
            $s['completed_by'][] = $userId;

            DataStore::save(self::COMMUNITY_SIGNALS_FILE, $all);
            return $s;
        }
        return null;
    }

    public static function checkCommunitySignalMatch(string $userId, array $obs): ?array
    {
        if (empty($obs['photos'])) return null;
        $obsSpecies = $obs['taxon']['name'] ?? $obs['species_name'] ?? '';
        if (empty($obsSpecies)) return null;

        $all = DataStore::get(self::COMMUNITY_SIGNALS_FILE) ?: [];
        if (!is_array($all)) return null;

        $now = time();
        foreach ($all as $s) {
            if ($s['closed'] ?? false) continue;
            if (($s['source_user_id'] ?? '') === $userId) continue;
            $exp = strtotime($s['expires_at'] ?? '');
            if ($exp && $exp <= $now) continue;
            if (($s['species_name'] ?? '') !== $obsSpecies) continue;

            $completed = $s['completed_by'] ?? [];
            if (in_array($userId, $completed, true)) continue;

            $respondents = $s['respondents'] ?? [];
            if (count($respondents) >= ($s['max_respondents'] ?? self::COMMUNITY_MAX_RESPONDENTS)) continue;

            self::respondToCommunitySignal($userId, $s['id']);
            return self::completeCommunitySignal($userId, $s['id']);
        }
        return null;
    }

    private static function cleanupCommunitySignals(array &$signals): void
    {
        $now = time();
        $signals = array_values(array_filter($signals, function ($s) use ($now) {
            if ($s['closed'] ?? false) {
                $created = strtotime($s['created_at'] ?? '');
                return $created && ($now - $created) < 7 * 86400;
            }
            $exp = strtotime($s['expires_at'] ?? '');
            if ($exp && $exp <= $now) return false;
            return true;
        }));
    }

    private static function haversineDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $R = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) * sin($dLat / 2)
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) * sin($dLng / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $R * $c;
    }
}
