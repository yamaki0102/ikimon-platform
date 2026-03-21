<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';

class QuestManager
{
    const CONFIG_FILE = ROOT_DIR . '/data/config/quests.json';
    private static $definitions = null;

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

    // ── Scan Quest: 心理学ベース動的クエスト生成 ──
    // Variable Ratio + 内発的動機づけ + 科学的価値優先

    const SCAN_QUEST_TTL = 72 * 3600; // 72h（Zeigarnik: 長めに残す）
    const MAX_QUESTS_PER_SCAN = 2;

    private static array $QUEST_TYPES = [
        'redlist'          => ['score' => 100, 'reward' => 300, 'rarity_label' => '極めて貴重',    'cta' => '記録を残す',    'icon' => 'alert-triangle'],
        'area_first'       => ['score' => 80,  'reward' => 250, 'rarity_label' => '地域初記録',    'cta' => '初記録に挑戦',  'icon' => 'map-pin'],
        'id_challenge'     => ['score' => 70,  'reward' => 200, 'rarity_label' => '同定チャレンジ', 'cta' => '同定に挑戦',   'icon' => 'microscope'],
        'evidence_upgrade' => ['score' => 50,  'reward' => 150, 'rarity_label' => '証拠強化',      'cta' => '証拠を追加',   'icon' => 'shield-check'],
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

        // Variable Ratio 判定
        if (!self::shouldShowQuests($candidates, $sessionMeta)) {
            return [];
        }

        usort($candidates, fn($a, $b) => $b['priority_score'] - $a['priority_score']);
        $selected = array_slice($candidates, 0, self::MAX_QUESTS_PER_SCAN);

        $now = date('c');
        $expires = date('c', time() + self::SCAN_QUEST_TTL);
        $sessionId = $sessionMeta['session_id'] ?? ('ps_' . bin2hex(random_bytes(6)));

        $quests = [];
        foreach ($selected as $c) {
            $type = self::$QUEST_TYPES[$c['trigger']];
            $quests[] = [
                'id' => 'sq_' . bin2hex(random_bytes(6)),
                'type' => 'scan_followup',
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
                'expires_at' => $expires,
                'completed_at' => null,
            ];
        }

        return $quests;
    }

    private static function shouldShowQuests(array $candidates, array $sessionMeta): bool
    {
        $highValueTriggers = ['redlist', 'area_first', 'id_challenge'];
        foreach ($candidates as $c) {
            if (in_array($c['trigger'], $highValueTriggers, true)) {
                return true;
            }
        }

        $seed = crc32($sessionMeta['session_id'] ?? date('c'));
        $roll = abs($seed) % 100;
        return $roll < 70;
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

        $now = time();
        $existing = array_filter($existing, function ($q) use ($now) {
            if (!empty($q['completed_at'])) return false;
            $exp = strtotime($q['expires_at'] ?? '');
            return $exp && $exp > $now;
        });

        $existing = array_merge(array_values($existing), $newQuests);
        if (count($existing) > 10) {
            $existing = array_slice($existing, -10);
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
            $exp = strtotime($q['expires_at'] ?? '');
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
}
