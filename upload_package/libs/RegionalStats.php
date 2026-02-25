<?php

/**
 * RegionalStats — Regional biodiversity completion statistics
 * 
 * Simple approach: observations already have a 'prefecture' field (JP-XX).
 * No runtime reverse geocoding. Just group and count.
 * 
 * Extensible: swap 'prefecture' for 'region' with any country's codes.
 * 
 * @since Phase E (2026-02-10)
 */

require_once __DIR__ . '/../config/config.php';

class RegionalStats
{
    private array $observations = [];
    private bool $loaded = false;

    // Prefecture names (could move to JSON if list grows for i18n)
    private static array $prefNames = [
        'JP-01' => ['北海道', 'Hokkaido'],
        'JP-02' => ['青森県', 'Aomori'],
        'JP-03' => ['岩手県', 'Iwate'],
        'JP-04' => ['宮城県', 'Miyagi'],
        'JP-05' => ['秋田県', 'Akita'],
        'JP-06' => ['山形県', 'Yamagata'],
        'JP-07' => ['福島県', 'Fukushima'],
        'JP-08' => ['茨城県', 'Ibaraki'],
        'JP-09' => ['栃木県', 'Tochigi'],
        'JP-10' => ['群馬県', 'Gunma'],
        'JP-11' => ['埼玉県', 'Saitama'],
        'JP-12' => ['千葉県', 'Chiba'],
        'JP-13' => ['東京都', 'Tokyo'],
        'JP-14' => ['神奈川県', 'Kanagawa'],
        'JP-15' => ['新潟県', 'Niigata'],
        'JP-16' => ['富山県', 'Toyama'],
        'JP-17' => ['石川県', 'Ishikawa'],
        'JP-18' => ['福井県', 'Fukui'],
        'JP-19' => ['山梨県', 'Yamanashi'],
        'JP-20' => ['長野県', 'Nagano'],
        'JP-21' => ['岐阜県', 'Gifu'],
        'JP-22' => ['静岡県', 'Shizuoka'],
        'JP-23' => ['愛知県', 'Aichi'],
        'JP-24' => ['三重県', 'Mie'],
        'JP-25' => ['滋賀県', 'Shiga'],
        'JP-26' => ['京都府', 'Kyoto'],
        'JP-27' => ['大阪府', 'Osaka'],
        'JP-28' => ['兵庫県', 'Hyogo'],
        'JP-29' => ['奈良県', 'Nara'],
        'JP-30' => ['和歌山県', 'Wakayama'],
        'JP-31' => ['鳥取県', 'Tottori'],
        'JP-32' => ['島根県', 'Shimane'],
        'JP-33' => ['岡山県', 'Okayama'],
        'JP-34' => ['広島県', 'Hiroshima'],
        'JP-35' => ['山口県', 'Yamaguchi'],
        'JP-36' => ['徳島県', 'Tokushima'],
        'JP-37' => ['香川県', 'Kagawa'],
        'JP-38' => ['愛媛県', 'Ehime'],
        'JP-39' => ['高知県', 'Kochi'],
        'JP-40' => ['福岡県', 'Fukuoka'],
        'JP-41' => ['佐賀県', 'Saga'],
        'JP-42' => ['長崎県', 'Nagasaki'],
        'JP-43' => ['熊本県', 'Kumamoto'],
        'JP-44' => ['大分県', 'Oita'],
        'JP-45' => ['宮崎県', 'Miyazaki'],
        'JP-46' => ['鹿児島県', 'Kagoshima'],
        'JP-47' => ['沖縄県', 'Okinawa'],
    ];

    // Neighboring prefectures for "quiet rivalry"
    private static array $neighbors = [
        'JP-01' => ['JP-02'],
        'JP-02' => ['JP-01', 'JP-03', 'JP-05'],
        'JP-03' => ['JP-02', 'JP-04', 'JP-05'],
        'JP-04' => ['JP-03', 'JP-05', 'JP-06', 'JP-07'],
        'JP-05' => ['JP-02', 'JP-03', 'JP-04', 'JP-06'],
        'JP-06' => ['JP-04', 'JP-05', 'JP-07', 'JP-15'],
        'JP-07' => ['JP-04', 'JP-06', 'JP-08', 'JP-09', 'JP-10', 'JP-15'],
        'JP-08' => ['JP-07', 'JP-09', 'JP-11', 'JP-12'],
        'JP-09' => ['JP-07', 'JP-08', 'JP-10', 'JP-11'],
        'JP-10' => ['JP-07', 'JP-09', 'JP-11', 'JP-15', 'JP-20'],
        'JP-11' => ['JP-08', 'JP-09', 'JP-10', 'JP-12', 'JP-13', 'JP-19'],
        'JP-12' => ['JP-08', 'JP-11', 'JP-13'],
        'JP-13' => ['JP-11', 'JP-12', 'JP-14', 'JP-19'],
        'JP-14' => ['JP-13', 'JP-22'],
        'JP-15' => ['JP-06', 'JP-07', 'JP-10', 'JP-16', 'JP-20'],
        'JP-16' => ['JP-15', 'JP-17', 'JP-20', 'JP-21'],
        'JP-17' => ['JP-16', 'JP-18', 'JP-21'],
        'JP-18' => ['JP-17', 'JP-21', 'JP-25', 'JP-26'],
        'JP-19' => ['JP-11', 'JP-13', 'JP-14', 'JP-20', 'JP-22'],
        'JP-20' => ['JP-10', 'JP-15', 'JP-16', 'JP-19', 'JP-21', 'JP-22', 'JP-23'],
        'JP-21' => ['JP-16', 'JP-17', 'JP-18', 'JP-20', 'JP-23', 'JP-24', 'JP-25'],
        'JP-22' => ['JP-14', 'JP-19', 'JP-20', 'JP-23'],
        'JP-23' => ['JP-20', 'JP-21', 'JP-22', 'JP-24'],
        'JP-24' => ['JP-21', 'JP-23', 'JP-25', 'JP-26', 'JP-29', 'JP-30'],
        'JP-25' => ['JP-18', 'JP-21', 'JP-24', 'JP-26'],
        'JP-26' => ['JP-18', 'JP-25', 'JP-27', 'JP-28', 'JP-29'],
        'JP-27' => ['JP-26', 'JP-28', 'JP-29', 'JP-30'],
        'JP-28' => ['JP-26', 'JP-27', 'JP-31', 'JP-33'],
        'JP-29' => ['JP-24', 'JP-26', 'JP-27', 'JP-30'],
        'JP-30' => ['JP-24', 'JP-27', 'JP-29'],
        'JP-31' => ['JP-28', 'JP-32', 'JP-33'],
        'JP-32' => ['JP-31', 'JP-34', 'JP-35'],
        'JP-33' => ['JP-28', 'JP-31', 'JP-34'],
        'JP-34' => ['JP-32', 'JP-33', 'JP-35'],
        'JP-35' => ['JP-32', 'JP-34'],
        'JP-36' => ['JP-37', 'JP-39'],
        'JP-37' => ['JP-36', 'JP-38'],
        'JP-38' => ['JP-37', 'JP-39'],
        'JP-39' => ['JP-36', 'JP-38'],
        'JP-40' => ['JP-41', 'JP-43', 'JP-44'],
        'JP-41' => ['JP-40', 'JP-42'],
        'JP-42' => ['JP-41'],
        'JP-43' => ['JP-40', 'JP-44', 'JP-45', 'JP-46'],
        'JP-44' => ['JP-40', 'JP-43', 'JP-45'],
        'JP-45' => ['JP-43', 'JP-44', 'JP-46'],
        'JP-46' => ['JP-43', 'JP-45'],
        'JP-47' => [],
    ];

    private function load(): void
    {
        if ($this->loaded) return;
        $file = DATA_DIR . '/observations.json';
        if (file_exists($file)) {
            $this->observations = json_decode(file_get_contents($file), true) ?: [];
        }
        $this->loaded = true;
    }

    /**
     * Group observations by their prefecture field. Dead simple.
     */
    private function byPrefecture(): array
    {
        $this->load();
        $grouped = [];
        foreach ($this->observations as $obs) {
            $pref = $obs['prefecture'] ?? null;
            if (!$pref) continue;
            $grouped[$pref][] = $obs;
        }
        return $grouped;
    }

    /**
     * Unique species per prefecture
     */
    private function speciesByPrefecture(): array
    {
        $byPref = $this->byPrefecture();
        $result = [];

        foreach ($byPref as $code => $observations) {
            $species = [];
            foreach ($observations as $obs) {
                $name = $obs['taxon']['name'] ?? '';
                $sciName = $obs['taxon']['scientific_name'] ?? '';
                if (!$name || $name === '未同定') continue;

                $key = $sciName ?: $name;
                if (!isset($species[$key])) {
                    $species[$key] = [
                        'name' => $name,
                        'scientific_name' => $sciName,
                        'count' => 0,
                    ];
                }
                $species[$key]['count']++;
            }
            $result[$code] = [
                'species' => $species,
                'unique_count' => count($species),
                'observation_count' => count($observations),
            ];
        }
        return $result;
    }

    // ──── Public API ────

    public function getPrefectureStats(string $prefCode): array
    {
        $all = $this->speciesByPrefecture();
        $data = $all[$prefCode] ?? ['species' => [], 'unique_count' => 0, 'observation_count' => 0];
        $names = self::$prefNames[$prefCode] ?? [$prefCode, $prefCode];

        return [
            'code' => $prefCode,
            'name' => $names[0],
            'name_en' => $names[1],
            'observation_count' => $data['observation_count'],
            'unique_species' => $data['unique_count'],
            /** @phpstan-ignore-line */
            'species_list' => $data['species'],
            'redlist' => $this->redlistCoverage($prefCode, $data['species']),
        ];
    }

    public function getNeighboringComparison(string $prefCode): array
    {
        $neighbors = self::$neighbors[$prefCode] ?? [];
        $all = $this->speciesByPrefecture();
        $result = [];

        foreach ($neighbors as $nCode) {
            $nData = $all[$nCode] ?? ['unique_count' => 0, 'observation_count' => 0];
            $names = self::$prefNames[$nCode] ?? [$nCode, $nCode];
            $result[] = [
                'code' => $nCode,
                'name' => $names[0],
                'unique_species' => $nData['unique_count'],
                'observation_count' => $nData['observation_count'],
            ];
        }
        usort($result, fn($a, $b) => $b['unique_species'] - $a['unique_species']);
        return $result;
    }

    public function getRecentDiscoveries(string $prefCode, int $days = 30): array
    {
        $byPref = $this->byPrefecture();
        $observations = $byPref[$prefCode] ?? [];
        $cutoff = date('Y-m-d H:i:s', strtotime("-{$days} days"));
        $firsts = [];

        foreach ($observations as $obs) {
            $name = $obs['taxon']['name'] ?? '';
            if (!$name || $name === '未同定') continue;
            $date = $obs['observed_at'] ?? $obs['created_at'] ?? '';
            if (!isset($firsts[$name]) || $date < $firsts[$name]['date']) {
                $firsts[$name] = [
                    'name' => $name,
                    'scientific_name' => $obs['taxon']['scientific_name'] ?? '',
                    'date' => $date,
                    'observer' => $obs['user_name'] ?? 'unknown',
                ];
            }
        }

        $recent = array_filter($firsts, fn($sp) => $sp['date'] >= $cutoff);
        usort($recent, fn($a, $b) => strcmp($b['date'], $a['date']));
        return $recent;
    }

    public function getTaxonGroupDistribution(string $prefCode): array
    {
        $byPref = $this->byPrefecture();
        $observations = $byPref[$prefCode] ?? [];
        $groups = [];

        foreach ($observations as $obs) {
            $group = $obs['taxon']['group'] ?? $obs['taxon']['taxon_group'] ?? '不明';
            $name = $obs['taxon']['name'] ?? '';
            if (!$name || $name === '未同定') continue;

            if (!isset($groups[$group])) $groups[$group] = [];
            $groups[$group][$name] = true;
        }

        $result = [];
        foreach ($groups as $group => $species) {
            $result[] = ['group' => $group, 'species_count' => count($species)];
        }
        usort($result, fn($a, $b) => $b['species_count'] - $a['species_count']);
        return $result;
    }

    public function getNationalOverview(): array
    {
        $all = $this->speciesByPrefecture();
        $overview = [];

        foreach (self::$prefNames as $code => $names) {
            $data = $all[$code] ?? ['unique_count' => 0, 'observation_count' => 0];
            $overview[] = [
                'code' => $code,
                'name' => $names[0],
                'name_en' => $names[1],
                'unique_species' => $data['unique_count'],
                'observation_count' => $data['observation_count'],
            ];
        }

        $this->load();
        $allNames = [];
        foreach ($this->observations as $obs) {
            $name = $obs['taxon']['name'] ?? '';
            if ($name && $name !== '未同定') $allNames[$name] = true;
        }

        return [
            'total_observations' => count($this->observations),
            'total_species' => count($allNames),
            'prefectures' => $overview,
            'active_prefectures' => count(array_filter($overview, fn($p) => $p['observation_count'] > 0)),
        ];
    }

    public function getPrefectureList(): array
    {
        $list = [];
        foreach (self::$prefNames as $code => $names) {
            $list[] = ['code' => $code, 'name' => $names[0], 'name_en' => $names[1]];
        }
        return $list;
    }

    /**
     * Get the prefecture code from a user's most recent observation.
     * Returns null if user has no observations with prefecture data.
     */
    public function getUserLatestPrefecture(?string $userId): ?string
    {
        if (!$userId) return null;
        $this->load();

        $latestDate = '';
        $latestPref = null;

        foreach ($this->observations as $obs) {
            $obsUserId = (string)($obs['user_id'] ?? '');
            if ($obsUserId !== $userId) continue;

            $pref = $obs['prefecture'] ?? null;
            if (!$pref) continue;

            $date = $obs['observed_at'] ?? $obs['created_at'] ?? '';
            if ($date > $latestDate) {
                $latestDate = $date;
                $latestPref = $pref;
            }
        }

        return $latestPref;
    }

    // ──── Private helpers ────

    private function redlistCoverage(string $prefCode, array $observedSpecies): array
    {
        $prefNum = (int)substr($prefCode, 3);
        $rlMap = [22 => 'shizuoka', 47 => 'okinawa'];

        $rlFile = isset($rlMap[$prefNum])
            ? DATA_DIR . '/redlists/' . $rlMap[$prefNum] . '.json'
            : null;

        if (!$rlFile || !file_exists($rlFile)) {
            return [
                'available' => false,
                'total_listed' => 0,
                'observed' => 0,
                'coverage_pct' => 0,
                'matched' => [],
                'not_yet_found' => []
            ];
        }

        $rlData = json_decode(file_get_contents($rlFile), true);
        $rlSpecies = $rlData['species'] ?? [];

        // Build lookup of observed names
        $lookup = [];
        foreach ($observedSpecies as $sp) {
            $lookup[mb_strtolower($sp['name'])] = true;
            if (!empty($sp['scientific_name'])) {
                $lookup[mb_strtolower($sp['scientific_name'])] = true;
            }
        }

        $matched = $notFound = [];
        foreach ($rlSpecies as $rl) {
            $ja = mb_strtolower($rl['ja_name'] ?? '');
            $sci = mb_strtolower($rl['sci_name'] ?? '');
            if (isset($lookup[$ja]) || isset($lookup[$sci])) {
                $matched[] = $rl;
            } else {
                $notFound[] = $rl;
            }
        }

        return [
            'available' => true,
            'source' => $rlData['metadata']['source'] ?? 'Unknown',
            'total_listed' => count($rlSpecies),
            'observed' => count($matched),
            'coverage_pct' => count($rlSpecies) > 0
                ? round(count($matched) / count($rlSpecies) * 100, 1) : 0,
            'matched' => $matched,
            'not_yet_found' => array_slice($notFound, 0, 20),
        ];
    }

    /**
     * Get municipality-level stats within a prefecture.
     * Requires observations to have 'municipality' field (backfilled).
     */
    public function getMunicipalityStats(string $prefCode): array
    {
        $this->load();
        $municipalities = [];

        foreach ($this->observations as $obs) {
            $pref = $obs['prefecture'] ?? '';
            $muni = $obs['municipality'] ?? '';
            if ($pref !== $prefCode || !$muni) continue;

            if (!isset($municipalities[$muni])) {
                $municipalities[$muni] = [
                    'name' => $muni,
                    'observation_count' => 0,
                    'species' => [],
                ];
            }
            $municipalities[$muni]['observation_count']++;
            $name = $obs['taxon']['name'] ?? '';
            if ($name && $name !== '未同定') {
                $municipalities[$muni]['species'][$name] = true;
            }
        }

        $result = [];
        foreach ($municipalities as $muni => $data) {
            $result[] = [
                'name' => $muni,
                'observation_count' => $data['observation_count'],
                'unique_species' => count($data['species']),
            ];
        }

        // Sort by unique_species descending
        usort($result, fn($a, $b) => $b['unique_species'] - $a['unique_species']);

        return $result;
    }

    /**
     * Get users who posted observations in a given prefecture.
     * Returns user list sorted by observation count (desc).
     */
    public function getAreaUsers(string $prefCode): array
    {
        $byPref = $this->byPrefecture();
        $observations = $byPref[$prefCode] ?? [];
        $users = [];

        foreach ($observations as $obs) {
            $userId = $obs['user_id'] ?? '';
            $userName = $obs['user_name'] ?? '';
            if (!$userId || !$userName) continue;

            if (!isset($users[$userId])) {
                $users[$userId] = [
                    'user_id' => $userId,
                    'user_name' => $userName,
                    'display_name' => $obs['user_display_name'] ?? $userName,
                    'avatar' => $obs['user_avatar'] ?? null,
                    'observation_count' => 0,
                    'species' => [],
                    'last_observed' => '',
                ];
            }
            $users[$userId]['observation_count']++;

            $name = $obs['taxon']['name'] ?? '';
            if ($name && $name !== '未同定') {
                $users[$userId]['species'][$name] = true;
            }

            $date = $obs['observed_at'] ?? $obs['created_at'] ?? '';
            if ($date > $users[$userId]['last_observed']) {
                $users[$userId]['last_observed'] = $date;
            }
        }

        // Finalize: convert species set to count
        $result = [];
        foreach ($users as $u) {
            $u['unique_species'] = count($u['species']);
            unset($u['species']);
            $result[] = $u;
        }

        // Sort by observation count desc, then species count desc
        usort($result, function ($a, $b) {
            $diff = $b['observation_count'] - $a['observation_count'];
            return $diff !== 0 ? $diff : $b['unique_species'] - $a['unique_species'];
        });

        return $result;
    }

    /**
     * Get country-level overview (for international expansion).
     */
    public function getCountryOverview(): array
    {
        $this->load();
        $countries = [];

        foreach ($this->observations as $obs) {
            $country = $obs['country'] ?? 'JP'; // Default to JP for legacy data
            if (!isset($countries[$country])) {
                $countries[$country] = [
                    'code' => $country,
                    'observation_count' => 0,
                    'species' => [],
                    'prefectures' => [],
                ];
            }
            $countries[$country]['observation_count']++;
            $name = $obs['taxon']['name'] ?? '';
            if ($name && $name !== '未同定') {
                $countries[$country]['species'][$name] = true;
            }
            $pref = $obs['prefecture'] ?? '';
            if ($pref) {
                $countries[$country]['prefectures'][$pref] = true;
            }
        }

        $result = [];
        foreach ($countries as $code => $data) {
            $result[] = [
                'code' => $code,
                'observation_count' => $data['observation_count'],
                'unique_species' => count($data['species']),
                'active_regions' => count($data['prefectures']),
            ];
        }

        usort($result, fn($a, $b) => $b['unique_species'] - $a['unique_species']);

        return $result;
    }
}
