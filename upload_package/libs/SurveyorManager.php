<?php

require_once __DIR__ . '/UserStore.php';
require_once __DIR__ . '/DataStore.php';

class SurveyorManager
{
    public const STATUS_NONE = 'none';
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_SUSPENDED = 'suspended';

    public static function getStatus(?array $user): string
    {
        $status = (string)($user['surveyor_status'] ?? self::STATUS_NONE);
        $allowed = [
            self::STATUS_NONE,
            self::STATUS_PENDING,
            self::STATUS_APPROVED,
            self::STATUS_SUSPENDED,
        ];

        return in_array($status, $allowed, true) ? $status : self::STATUS_NONE;
    }

    public static function isApproved(?array $user): bool
    {
        return $user && self::getStatus($user) === self::STATUS_APPROVED;
    }

    public static function getProfile(array $user): array
    {
        $profile = is_array($user['surveyor_profile'] ?? null) ? $user['surveyor_profile'] : [];

        return [
            'headline' => trim((string)($profile['headline'] ?? '')),
            'summary' => trim((string)($profile['summary'] ?? '')),
            'areas' => array_values(array_filter(array_map('trim', (array)($profile['areas'] ?? [])))),
            'specialties' => array_values(array_filter(array_map('trim', (array)($profile['specialties'] ?? [])))),
            'price_band' => trim((string)($profile['price_band'] ?? '')),
            'available_days' => array_values(array_filter(array_map('trim', (array)($profile['available_days'] ?? [])))),
            'travel_range' => trim((string)($profile['travel_range'] ?? '')),
            'contact_label' => trim((string)($profile['contact_label'] ?? '')),
            'contact_url' => trim((string)($profile['contact_url'] ?? '')),
            'contact_notes' => trim((string)($profile['contact_notes'] ?? '')),
            'achievements' => trim((string)($profile['achievements'] ?? '')),
            'availability' => trim((string)($profile['availability'] ?? '')),
            'public_visible' => !array_key_exists('public_visible', $profile) || !empty($profile['public_visible']),
            'updated_at' => (string)($profile['updated_at'] ?? ''),
        ];
    }

    public static function getAdminMeta(array $user): array
    {
        $meta = is_array($user['surveyor_admin'] ?? null) ? $user['surveyor_admin'] : [];

        return [
            'application_note' => trim((string)($meta['application_note'] ?? '')),
            'interview_date' => trim((string)($meta['interview_date'] ?? '')),
            'approval_reason' => trim((string)($meta['approval_reason'] ?? '')),
            'updated_at' => trim((string)($meta['updated_at'] ?? '')),
        ];
    }

    public static function getStatusHistory(array $user): array
    {
        $history = is_array($user['surveyor_status_history'] ?? null) ? $user['surveyor_status_history'] : [];
        return array_values(array_filter($history, fn($entry) => is_array($entry)));
    }

    public static function normalizeAdminMeta(array $input): array
    {
        $interviewDate = trim((string)($input['interview_date'] ?? ''));
        if ($interviewDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $interviewDate)) {
            $interviewDate = '';
        }

        return [
            'application_note' => mb_substr(trim((string)($input['application_note'] ?? '')), 0, 1000),
            'interview_date' => $interviewDate,
            'approval_reason' => mb_substr(trim((string)($input['approval_reason'] ?? '')), 0, 1000),
            'updated_at' => date('c'),
        ];
    }

    public static function buildPublicCard(array $user): ?array
    {
        if (!self::isApproved($user)) {
            return null;
        }

        $profile = self::getProfile($user);
        if (!$profile['public_visible']) {
            return null;
        }

        $stats = self::collectStats((string)($user['id'] ?? ''));

        return [
            'id' => (string)$user['id'],
            'name' => (string)($user['name'] ?? '調査員'),
            'avatar' => (string)($user['avatar'] ?? 'assets/img/default-avatar.svg'),
            'bio' => trim((string)($user['bio'] ?? '')),
            'headline' => $profile['headline'],
            'summary' => $profile['summary'],
            'areas' => $profile['areas'],
            'specialties' => $profile['specialties'],
            'price_band' => $profile['price_band'],
            'available_days' => $profile['available_days'],
            'travel_range' => $profile['travel_range'],
            'contact_label' => $profile['contact_label'],
            'contact_url' => $profile['contact_url'],
            'contact_notes' => $profile['contact_notes'],
            'achievements' => $profile['achievements'],
            'availability' => $profile['availability'],
            'official_record_count' => $stats['official_record_count'],
            'observation_count' => $stats['observation_count'],
            'species_count' => $stats['species_count'],
            'profile_updated_at' => $profile['updated_at'],
        ];
    }

    public static function listPublicSurveyors(int $limit = 0): array
    {
        $cards = DataStore::getCached('surveyors_public_cards', 120, function (): array {
            $items = [];
            foreach (UserStore::getAll(false) as $user) {
                $card = self::buildPublicCard($user);
                if ($card) {
                    $items[] = $card;
                }
            }

            usort($items, function (array $a, array $b): int {
                $aScore = ($a['official_record_count'] ?? 0) * 10 + ($a['species_count'] ?? 0);
                $bScore = ($b['official_record_count'] ?? 0) * 10 + ($b['species_count'] ?? 0);
                if ($aScore === $bScore) {
                    return strcmp((string)$a['name'], (string)$b['name']);
                }
                return $bScore <=> $aScore;
            });

            return $items;
        });

        if ($limit > 0) {
            return array_slice($cards, 0, $limit);
        }

        return $cards;
    }

    public static function findPublicSurveyorById(string $userId): ?array
    {
        $user = UserStore::findById($userId);
        if (!$user) {
            return null;
        }

        return self::buildPublicCard($user);
    }

    public static function listOfficialRecords(array $filters = []): array
    {
        $filters = array_merge([
            'q' => '',
            'area' => '',
            'specialty' => '',
            'limit' => 100,
        ], $filters);

        $surveyors = [];
        foreach (self::listPublicSurveyors() as $surveyor) {
            $surveyors[$surveyor['id']] = $surveyor;
        }

        $records = [];
        foreach (DataStore::fetchAll('observations') as $obs) {
            if (($obs['record_mode'] ?? '') !== 'surveyor_official') {
                continue;
            }

            $userId = (string)($obs['user_id'] ?? '');
            if (!isset($surveyors[$userId])) {
                continue;
            }

            $surveyor = $surveyors[$userId];
            $record = [
                'id' => (string)($obs['id'] ?? ''),
                'observed_at' => (string)($obs['observed_at'] ?? $obs['created_at'] ?? ''),
                'created_at' => (string)($obs['created_at'] ?? ''),
                'municipality' => (string)($obs['municipality'] ?? ''),
                'prefecture' => (string)($obs['prefecture'] ?? ''),
                'note' => trim((string)($obs['note'] ?? '')),
                'taxon_name' => (string)($obs['taxon']['name'] ?? '未同定'),
                'photos' => (array)($obs['photos'] ?? []),
                'surveyor' => $surveyor,
            ];

            if (!self::matchesRecordFilters($record, $filters)) {
                continue;
            }

            $records[] = $record;
        }

        usort($records, fn(array $a, array $b): int => strtotime($b['observed_at'] ?: $b['created_at']) <=> strtotime($a['observed_at'] ?: $a['created_at']));

        $limit = max(1, (int)$filters['limit']);
        return array_slice($records, 0, $limit);
    }

    public static function matchSurveyors(array $criteria, int $limit = 5): array
    {
        $area = mb_strtolower(trim((string)($criteria['area'] ?? '')));
        $specialty = mb_strtolower(trim((string)($criteria['specialty'] ?? '')));
        $q = mb_strtolower(trim((string)($criteria['q'] ?? '')));
        $preferredDays = self::normalizeList($criteria['preferred_days'] ?? []);
        $travelCondition = trim((string)($criteria['travel_condition'] ?? ''));
        $budgetStance = trim((string)($criteria['budget_stance'] ?? ''));

        $matches = [];
        foreach (self::listPublicSurveyors() as $surveyor) {
            $score = 0;
            $reasons = [];

            foreach ($surveyor['areas'] as $candidateArea) {
                $candidateArea = mb_strtolower($candidateArea);
                if ($area !== '' && (str_contains($candidateArea, $area) || str_contains($area, $candidateArea))) {
                    $score += 3;
                    $reasons['area'] = '活動地域が依頼エリアに近い';
                }
                if ($q !== '' && str_contains($candidateArea, $q)) {
                    $score += 1;
                }
            }

            foreach ($surveyor['specialties'] as $candidateSpecialty) {
                $candidateSpecialty = mb_strtolower($candidateSpecialty);
                if ($specialty !== '' && (str_contains($candidateSpecialty, $specialty) || str_contains($specialty, $candidateSpecialty))) {
                    $score += 4;
                    $reasons['specialty'] = '得意分野が依頼内容に近い';
                }
                if ($q !== '' && str_contains($candidateSpecialty, $q)) {
                    $score += 1;
                }
            }

            $text = mb_strtolower($surveyor['headline'] . ' ' . $surveyor['summary'] . ' ' . $surveyor['bio']);
            if ($q !== '' && str_contains($text, $q)) {
                $score += 2;
                $reasons['summary'] = 'プロフィール文脈が依頼内容と重なる';
            }

            if (!empty($preferredDays) && !empty($surveyor['available_days'])) {
                $matchedDays = array_intersect($preferredDays, $surveyor['available_days']);
                if (!empty($matchedDays)) {
                    $score += 3;
                    $reasons['days'] = '希望曜日と対応可能曜日が重なる';
                }
            }

            if ($travelCondition !== '' && ($surveyor['travel_range'] ?? '') !== '') {
                if ($surveyor['travel_range'] === $travelCondition) {
                    $score += 3;
                    $reasons['travel'] = '移動条件が一致している';
                } else {
                    $rangeOrder = [
                        '近隣のみ' => 1,
                        '市内中心' => 2,
                        '県内広域' => 3,
                        '隣県まで' => 4,
                        '全国対応' => 5,
                    ];
                    $surveyorRange = $rangeOrder[$surveyor['travel_range']] ?? 0;
                    $requestRange = $rangeOrder[$travelCondition] ?? 0;
                    if ($surveyorRange >= $requestRange && $requestRange > 0) {
                        $score += 2;
                        $reasons['travel'] = '移動可能範囲が依頼条件を満たす';
                    }
                }
            }

            if ($budgetStance !== '' && ($surveyor['price_band'] ?? '') !== '') {
                if ($surveyor['price_band'] === $budgetStance) {
                    $score += 3;
                    $reasons['budget'] = '予算スタンスと対応単価帯が一致している';
                } elseif ($budgetStance === '相談して決定') {
                    $score += 1;
                    $reasons['budget'] = '予算は相談前提で調整しやすい';
                }
            }

            if (($surveyor['official_record_count'] ?? 0) >= 3) {
                $score += 2;
                $reasons['records'] = '公式記録の実績が多い';
            }

            if ($score > 0) {
                $surveyor['match_score'] = $score;
                $surveyor['match_reasons'] = array_values($reasons);
                $matches[] = $surveyor;
            }
        }

        usort($matches, function (array $a, array $b): int {
            if (($a['match_score'] ?? 0) === ($b['match_score'] ?? 0)) {
                return ($b['official_record_count'] ?? 0) <=> ($a['official_record_count'] ?? 0);
            }
            return ($b['match_score'] ?? 0) <=> ($a['match_score'] ?? 0);
        });

        return array_slice($matches, 0, $limit);
    }

    public static function buildStatusHistoryEntry(string $from, string $to, array $actor, string $note = ''): array
    {
        return [
            'id' => uniqid('surveyor_history_'),
            'from' => $from,
            'to' => $to,
            'actor_id' => (string)($actor['id'] ?? ''),
            'actor_name' => (string)($actor['name'] ?? ''),
            'note' => mb_substr(trim($note), 0, 500),
            'created_at' => date('Y-m-d H:i:s'),
        ];
    }

    public static function normalizeProfileInput(array $input): array
    {
        $areas = self::normalizeList($input['areas'] ?? []);
        $specialties = self::normalizeList($input['specialties'] ?? []);
        $availableDays = self::normalizeList($input['available_days'] ?? []);
        $contactUrl = trim((string)($input['contact_url'] ?? ''));
        $priceBand = trim((string)($input['price_band'] ?? ''));
        $travelRange = trim((string)($input['travel_range'] ?? ''));

        $allowedPriceBands = ['', '相談して決定', '半日相当', '1日相当', '報告書込み', '案件規模で見積もり'];
        if (!in_array($priceBand, $allowedPriceBands, true)) {
            $priceBand = '';
        }

        $allowedTravelRanges = ['', '近隣のみ', '市内中心', '県内広域', '隣県まで', '全国対応'];
        if (!in_array($travelRange, $allowedTravelRanges, true)) {
            $travelRange = '';
        }

        if ($contactUrl !== '' && !preg_match('/^https?:\/\//i', $contactUrl) && !preg_match('/^mailto:/i', $contactUrl)) {
            $contactUrl = 'https://' . $contactUrl;
        }

        return [
            'headline' => mb_substr(trim((string)($input['headline'] ?? '')), 0, 80),
            'summary' => mb_substr(trim((string)($input['summary'] ?? '')), 0, 1200),
            'areas' => array_slice($areas, 0, 8),
            'specialties' => array_slice($specialties, 0, 8),
            'price_band' => $priceBand,
            'available_days' => array_slice($availableDays, 0, 7),
            'travel_range' => $travelRange,
            'contact_label' => mb_substr(trim((string)($input['contact_label'] ?? '')), 0, 40),
            'contact_url' => mb_substr($contactUrl, 0, 255),
            'contact_notes' => mb_substr(trim((string)($input['contact_notes'] ?? '')), 0, 200),
            'achievements' => mb_substr(trim((string)($input['achievements'] ?? '')), 0, 500),
            'availability' => mb_substr(trim((string)($input['availability'] ?? '')), 0, 120),
            'public_visible' => !empty($input['public_visible']),
            'updated_at' => date('c'),
        ];
    }

    private static function normalizeList($value): array
    {
        if (is_string($value)) {
            $value = preg_split('/[\r\n,、]+/u', $value);
        }

        if (!is_array($value)) {
            return [];
        }

        $list = [];
        foreach ($value as $item) {
            $text = mb_substr(trim((string)$item), 0, 40);
            if ($text !== '') {
                $list[] = $text;
            }
        }

        return array_values(array_unique($list));
    }

    private static function collectStats(string $userId): array
    {
        $observations = DataStore::fetchAll('observations');
        $observationCount = 0;
        $officialRecordCount = 0;
        $species = [];

        foreach ($observations as $obs) {
            if ((string)($obs['user_id'] ?? '') !== $userId) {
                continue;
            }

            $observationCount++;
            if (($obs['record_mode'] ?? '') === 'surveyor_official') {
                $officialRecordCount++;
            }

            $taxonKey = $obs['taxon']['key'] ?? $obs['taxon']['scientific_name'] ?? $obs['taxon']['name'] ?? null;
            if ($taxonKey) {
                $species[$taxonKey] = true;
            }
        }

        return [
            'observation_count' => $observationCount,
            'official_record_count' => $officialRecordCount,
            'species_count' => count($species),
        ];
    }

    private static function matchesRecordFilters(array $record, array $filters): bool
    {
        $q = mb_strtolower(trim((string)($filters['q'] ?? '')));
        $area = mb_strtolower(trim((string)($filters['area'] ?? '')));
        $specialty = mb_strtolower(trim((string)($filters['specialty'] ?? '')));

        if ($q !== '') {
            $haystack = mb_strtolower(implode(' ', [
                $record['taxon_name'] ?? '',
                $record['note'] ?? '',
                $record['municipality'] ?? '',
                $record['prefecture'] ?? '',
                $record['surveyor']['name'] ?? '',
                $record['surveyor']['headline'] ?? '',
            ]));
            if (!str_contains($haystack, $q)) {
                return false;
            }
        }

        if ($area !== '') {
            $areas = array_map('mb_strtolower', $record['surveyor']['areas'] ?? []);
            $location = mb_strtolower(trim(($record['prefecture'] ?? '') . ' ' . ($record['municipality'] ?? '')));
            $matched = str_contains($location, $area);
            foreach ($areas as $candidate) {
                if (str_contains($candidate, $area) || str_contains($area, $candidate)) {
                    $matched = true;
                    break;
                }
            }
            if (!$matched) {
                return false;
            }
        }

        if ($specialty !== '') {
            $matched = false;
            foreach (array_map('mb_strtolower', $record['surveyor']['specialties'] ?? []) as $candidate) {
                if (str_contains($candidate, $specialty) || str_contains($specialty, $candidate)) {
                    $matched = true;
                    break;
                }
            }
            if (!$matched) {
                return false;
            }
        }

        return true;
    }
}
