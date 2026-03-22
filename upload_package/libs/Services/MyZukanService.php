<?php

require_once __DIR__ . '/../DataStore.php';
require_once __DIR__ . '/../RedList.php';
require_once __DIR__ . '/../MyFieldManager.php';

class MyZukanService
{
    private const CACHE_TTL = 600;

    private const GROUP_MAP = [
        'bird'    => ['鳥類', 'Aves', 'bird'],
        'insect'  => ['昆虫', 'Insecta', 'insect'],
        'plant'   => ['植物', 'Plantae', 'plant'],
        'mammal'  => ['哺乳類', 'Mammalia', 'mammal'],
        'fish'    => ['魚類', 'Actinopterygii', 'fish'],
        'fungi'   => ['菌類', 'Fungi', 'fungi'],
        'amphibian_reptile' => ['両生爬虫類', '両生類', '爬虫類', 'Amphibia', 'Reptilia', 'amphibian', 'reptile'],
    ];

    private const ENCOUNTER_LABELS = [
        1  => 'はじめまして!',
        2  => 'また会えた!',
        3  => 'なかよし!',
        10 => 'だいすき!',
    ];

    public static function buildUserIndex(string $userId): array
    {
        return DataStore::getCached("my_zukan_{$userId}", self::CACHE_TTL, function () use ($userId) {
            $observations = DataStore::fetchAll('observations');
            $tracks = self::loadUserTracks($userId);
            $index = [];

            foreach ($observations as $obs) {
                $taxonName = $obs['taxon']['name'] ?? '';
                if (!$taxonName) continue;
                $taxonKey = $obs['taxon']['key'] ?? '';
                if (!$taxonKey) {
                    $taxonKey = 'name_' . md5($taxonName);
                }

                $obsUserId = $obs['user_id'] ?? '';
                $obsDate = $obs['observed_at'] ?? $obs['created_at'] ?? '';
                $obsSource = $obs['observation_source'] ?? '';

                $encounters = [];

                if ($obsUserId === $userId) {
                    $type = self::resolveEncounterType($obsSource);
                    $encounters[] = self::buildEncounter($obs, $type, $tracks);
                }

                if ($obsUserId !== $userId) {
                    $ids = $obs['identifications'] ?? [];
                    foreach ($ids as $id) {
                        if (($id['user_id'] ?? '') === $userId) {
                            $encounters[] = self::buildIdentifyEncounter($obs, $id);
                            break;
                        }
                    }
                }

                if (empty($encounters)) continue;

                if (!isset($index[$taxonKey])) {
                    $index[$taxonKey] = [
                        'taxon_key'       => $taxonKey,
                        'name'            => $taxonName,
                        'scientific_name' => $obs['taxon']['scientific_name'] ?? '',
                        'rank'            => $obs['taxon']['rank'] ?? 'species',
                        'group'           => $obs['taxon']['group'] ?? '',
                        '_class'          => $obs['taxon']['class'] ?? '',
                        'lineage'         => $obs['taxon']['lineage'] ?? null,
                        'cover_photo'     => null,
                        'first_encounter' => null,
                        'latest_encounter'=> null,
                        'encounter_count' => 0,
                        'categories'      => [],
                        'has_audio'       => false,
                        'encounters'      => [],
                        'red_list'        => null,
                    ];
                }

                $entry = &$index[$taxonKey];

                foreach ($encounters as $enc) {
                    $entry['encounters'][] = $enc;
                    $entry['encounter_count']++;

                    $cat = $enc['type'];
                    if (!in_array($cat, $entry['categories'])) {
                        $entry['categories'][] = $cat;
                    }

                    if ($enc['audio_url']) {
                        $entry['has_audio'] = true;
                        if (!in_array('audio', $entry['categories'])) {
                            $entry['categories'][] = 'audio';
                        }
                    }

                    $date = $enc['date'] ?? '';
                    if (!$entry['first_encounter'] || $date < $entry['first_encounter']) {
                        $entry['first_encounter'] = $date;
                    }
                    if (!$entry['latest_encounter'] || $date > $entry['latest_encounter']) {
                        $entry['latest_encounter'] = $date;
                    }

                    if (!empty($enc['photos'])) {
                        $entry['cover_photo'] = $enc['photos'][0];
                    }
                }

                unset($entry);
            }

            foreach ($index as &$entry) {
                usort($entry['encounters'], fn($a, $b) => strcmp($b['date'] ?? '', $a['date'] ?? ''));

                if (!$entry['cover_photo']) {
                    foreach ($entry['encounters'] as $enc) {
                        if (!empty($enc['photos'])) {
                            $entry['cover_photo'] = $enc['photos'][0];
                            break;
                        }
                    }
                }

                $entry['encounter_label'] = self::encounterLabel($entry['encounter_count']);
                $entry['red_list'] = RedList::check($entry['name']);
                unset($entry['_class']);
            }
            unset($entry);

            return $index;
        });
    }

    public static function getSpeciesList(string $userId, array $options = []): array
    {
        $query    = $options['q'] ?? '';
        $group    = $options['group'] ?? '';
        $category = $options['category'] ?? '';
        $sort     = $options['sort'] ?? 'latest';
        $limit    = min((int)($options['limit'] ?? 24), 100);
        $offset   = max((int)($options['offset'] ?? 0), 0);

        $index = self::buildUserIndex($userId);
        $species = array_values($index);

        if (!empty($query)) {
            $species = array_values(array_filter($species, function ($s) use ($query) {
                return stripos($s['name'], $query) !== false
                    || stripos($s['scientific_name'], $query) !== false;
            }));
        }

        if (!empty($group) && isset(self::GROUP_MAP[$group])) {
            $keywords = self::GROUP_MAP[$group];
            $species = array_values(array_filter($species, function ($s) use ($keywords) {
                $g = $s['group'] ?? '';
                foreach ($keywords as $kw) {
                    if (stripos($g, $kw) !== false) return true;
                }
                return false;
            }));
        }

        if (!empty($category)) {
            if ($category === 'audio') {
                $species = array_values(array_filter($species, fn($s) => $s['has_audio']));
            } else {
                $species = array_values(array_filter($species, fn($s) => in_array($category, $s['categories'])));
            }
        }

        switch ($sort) {
            case 'name':
                usort($species, fn($a, $b) => strcmp($a['name'], $b['name']));
                break;
            case 'first':
                usort($species, fn($a, $b) => strcmp($a['first_encounter'] ?? '', $b['first_encounter'] ?? ''));
                break;
            case 'encounters':
                usort($species, fn($a, $b) => $b['encounter_count'] - $a['encounter_count']);
                break;
            case 'latest':
            default:
                usort($species, fn($a, $b) => strcmp($b['latest_encounter'] ?? '', $a['latest_encounter'] ?? ''));
                break;
        }

        $total = count($species);

        $data = array_slice($species, $offset, $limit);
        foreach ($data as &$item) {
            $item['encounters'] = array_slice($item['encounters'], 0, 3);
        }
        unset($item);

        return [
            'total'    => $total,
            'data'     => $data,
            'has_more' => ($offset + $limit) < $total,
            'stats'    => self::computeStats($index),
        ];
    }

    public static function getSpeciesDetail(string $userId, string $taxonKey): ?array
    {
        $index = self::buildUserIndex($userId);
        if (!isset($index[$taxonKey])) return null;

        $entry = $index[$taxonKey];
        return $entry;
    }

    private static function computeStats(array $index): array
    {
        $totalSpecies = count($index);
        $totalEncounters = 0;
        $categoryCounts = ['post' => 0, 'walk' => 0, 'scan' => 0, 'identify' => 0, 'audio' => 0];
        $groupCounts = [];
        $firstDate = null;
        $seasonCounts = ['春' => 0, '夏' => 0, '秋' => 0, '冬' => 0];

        foreach ($index as $entry) {
            $totalEncounters += $entry['encounter_count'];

            foreach ($entry['categories'] as $cat) {
                if (isset($categoryCounts[$cat])) {
                    $categoryCounts[$cat]++;
                }
            }

            $g = $entry['group'] ?: 'その他';
            $groupCounts[$g] = ($groupCounts[$g] ?? 0) + 1;

            if ($entry['first_encounter']) {
                if (!$firstDate || $entry['first_encounter'] < $firstDate) {
                    $firstDate = $entry['first_encounter'];
                }
            }

            foreach ($entry['encounters'] as $enc) {
                $season = self::getSeason($enc['date'] ?? '');
                if ($season && isset($seasonCounts[$season])) {
                    $seasonCounts[$season]++;
                }
            }
        }

        return [
            'total_species'    => $totalSpecies,
            'total_encounters' => $totalEncounters,
            'first_date'       => $firstDate,
            'category_counts'  => $categoryCounts,
            'group_counts'     => $groupCounts,
            'season_counts'    => $seasonCounts,
        ];
    }

    private static function resolveEncounterType(string $source): string
    {
        if (in_array($source, ['walk', 'walk-audio'])) return 'walk';
        if ($source === 'live-scan') return 'scan';
        return 'post';
    }

    private static function buildEncounter(array $obs, string $type, array $tracks): array
    {
        $date = $obs['observed_at'] ?? $obs['created_at'] ?? '';
        $audioUrl = self::resolveAudio($obs);

        $enc = [
            'id'             => $obs['id'] ?? '',
            'date'           => $date,
            'type'           => $type,
            'photos'         => $obs['photos'] ?? [],
            'audio_url'      => $audioUrl,
            'note'           => $obs['note'] ?? '',
            'location_label' => self::locationLabel($obs),
            'season_icon'    => self::seasonIcon($date),
            'walk_info'      => null,
        ];

        if ($type === 'walk' || $type === 'scan') {
            $enc['walk_info'] = self::matchWalkSession($date, $tracks);
        }

        return $enc;
    }

    private static function buildIdentifyEncounter(array $obs, array $identification): array
    {
        $date = $identification['created_at'] ?? $obs['observed_at'] ?? '';

        return [
            'id'             => $obs['id'] ?? '',
            'date'           => $date,
            'type'           => 'identify',
            'photos'         => $obs['photos'] ?? [],
            'audio_url'      => null,
            'note'           => $identification['evidence']['notes'] ?? '',
            'location_label' => self::locationLabel($obs),
            'season_icon'    => self::seasonIcon($date),
            'walk_info'      => null,
            'observer_name'  => $obs['user_name'] ?? '',
        ];
    }

    private static function resolveAudio(array $obs): ?string
    {
        if (!empty($obs['audio'][0])) {
            return $obs['audio'][0];
        }
        if (!empty($obs['audio_evidence_path'])) {
            return $obs['audio_evidence_path'];
        }
        return null;
    }

    private static function locationLabel(array $obs): string
    {
        if (!empty($obs['location']['name'])) return $obs['location']['name'];
        if (!empty($obs['municipality'])) return $obs['municipality'];
        if (!empty($obs['prefecture'])) return $obs['prefecture'];
        return '';
    }

    private static function matchWalkSession(string $obsDate, array $tracks): ?array
    {
        if (!$obsDate || empty($tracks)) return null;

        $obsTime = strtotime($obsDate);
        if (!$obsTime) return null;

        foreach ($tracks as $track) {
            $start = strtotime($track['started_at'] ?? '');
            $end = strtotime($track['ended_at'] ?? $track['updated_at'] ?? '');
            if (!$start || !$end) continue;

            if ($obsTime >= $start && $obsTime <= $end) {
                $durationMin = ($track['duration_sec'] ?? 0) > 0
                    ? round(($track['duration_sec']) / 60)
                    : null;
                return [
                    'session_id'  => $track['session_id'] ?? '',
                    'distance_m'  => $track['total_distance'] ?? $track['total_distance_m'] ?? 0,
                    'duration_min'=> $durationMin,
                    'field_name'  => $track['field_name'] ?? '',
                    'step_count'  => $track['step_count'] ?? null,
                ];
            }
        }

        return null;
    }

    private static function loadUserTracks(string $userId): array
    {
        try {
            return MyFieldManager::getUserTracks($userId) ?: [];
        } catch (\Throwable $e) {
            return [];
        }
    }

    private static function encounterLabel(int $count): string
    {
        if ($count >= 10) return self::ENCOUNTER_LABELS[10];
        if ($count >= 3)  return self::ENCOUNTER_LABELS[3];
        if ($count >= 2)  return self::ENCOUNTER_LABELS[2];
        return self::ENCOUNTER_LABELS[1];
    }

    private static function getSeason(string $date): string
    {
        if (!$date) return '';
        $month = (int)date('n', strtotime($date));
        if ($month >= 3 && $month <= 5) return '春';
        if ($month >= 6 && $month <= 8) return '夏';
        if ($month >= 9 && $month <= 11) return '秋';
        return '冬';
    }

    private static function seasonIcon(string $date): string
    {
        $season = self::getSeason($date);
        return match ($season) {
            '春' => '🌸',
            '夏' => '☀️',
            '秋' => '🍂',
            '冬' => '❄️',
            default => '',
        };
    }
}
