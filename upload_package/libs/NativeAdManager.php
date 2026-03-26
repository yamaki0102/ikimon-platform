<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';

class NativeAdManager
{
    private const SPONSORS_DIR_REL = '/sponsors';
    private const HISTORY_DIR_REL = '/ad_impressions';
    private const EARTH_RADIUS_KM = 6371.0;

    private static array $sponsorCache = [];

    public static function getAdForClosing(
        float $lat,
        float $lng,
        string $guideMood,
        string $userId,
        array $contextTags = []
    ): ?array {
        if ($lat == 0 && $lng == 0) return null;
        if (empty($userId)) return null;

        $sponsors = self::loadActiveSponsors();
        if (empty($sponsors)) return null;

        $candidates = [];
        foreach ($sponsors as $sponsor) {
            if (!self::isScheduleActive($sponsor)) continue;
            if (!self::isWithinBudget($sponsor)) continue;
            if (self::isFrequencyCapped($sponsor, $userId)) continue;
            if (!self::isWithinRadius($lat, $lng, $sponsor)) continue;

            $template = self::selectTemplate($sponsor, $guideMood, $contextTags);
            if (!$template) continue;

            $score = self::scoreSponsor($sponsor, $lat, $lng, $guideMood, $contextTags, $template);
            $candidates[] = [
                'sponsor' => $sponsor,
                'template' => $template,
                'score' => $score,
            ];
        }

        if (empty($candidates)) return null;

        usort($candidates, fn($a, $b) => $b['score'] <=> $a['score']);

        $topScore = $candidates[0]['score'];
        $topCandidates = array_filter($candidates, fn($c) => $c['score'] >= $topScore * 0.8);
        $selected = $topCandidates[array_rand($topCandidates)];

        $sponsor = $selected['sponsor'];
        $template = $selected['template'];

        $narrative = str_replace('{sponsor_name}', $sponsor['name'], $template['template']);

        self::recordImpression($sponsor['id'], $userId);

        return [
            'sponsor_id' => $sponsor['id'],
            'sponsor_name' => $sponsor['name'],
            'narrative' => $narrative,
            'cta' => $template['cta_subtle'] ?? '',
            'mood' => $template['mood'],
        ];
    }

    public static function formatForPrompt(?array $ad): string
    {
        if (!$ad) return '';

        $narrative = $ad['narrative'];
        $parts = [
            "【地域のおすすめ（自然に、ガイドの話の延長として語って。広告っぽくしない）】",
            $narrative,
            "→ さりげなく、散歩の帰りの提案として。「〇〇に行ってください」ではなく「〇〇に寄ると面白いかも」程度。",
            "→ 専門用語は使わない。景観史の話と同じトーンで。",
            "→ 必ず話を完結させて。",
        ];

        return implode("\n", $parts);
    }

    // --- Sponsor loading ---

    private static function loadActiveSponsors(): array
    {
        if (!empty(self::$sponsorCache)) return self::$sponsorCache;

        $dir = DATA_DIR . self::SPONSORS_DIR_REL;
        if (!is_dir($dir)) return [];

        $sponsors = [];
        foreach (glob($dir . '/*.json') as $file) {
            $basename = basename($file);
            if (str_starts_with($basename, '_')) continue;

            $data = json_decode(file_get_contents($file), true);
            if (!$data || !($data['active'] ?? false)) continue;

            $sponsors[] = $data;
        }

        self::$sponsorCache = $sponsors;
        return $sponsors;
    }

    // --- Filtering ---

    private static function isScheduleActive(array $sponsor): bool
    {
        $schedule = $sponsor['scheduling'] ?? [];
        if (empty($schedule)) return true;

        $now = new \DateTime();
        $today = $now->format('Y-m-d');

        if (!empty($schedule['start_date']) && $today < $schedule['start_date']) return false;
        if (!empty($schedule['end_date']) && $today > $schedule['end_date']) return false;

        $dow = (int)$now->format('w');
        if (!empty($schedule['days_of_week']) && !in_array($dow, $schedule['days_of_week'], true)) return false;

        $hour = (int)$now->format('G');
        $from = $schedule['hours']['from'] ?? 0;
        $to = $schedule['hours']['to'] ?? 23;
        if ($hour < $from || $hour > $to) return false;

        return true;
    }

    private static function isWithinBudget(array $sponsor): bool
    {
        $budget = $sponsor['budget'] ?? [];
        if (empty($budget)) return true;

        $cap = $budget['monthly_impressions_cap'] ?? 0;
        if ($cap <= 0) return true;

        $currentMonth = date('Y-m');
        $logPath = DATA_DIR . self::HISTORY_DIR_REL . "/monthly/{$currentMonth}.json";
        if (!file_exists($logPath)) return true;

        $log = json_decode(file_get_contents($logPath), true) ?: [];
        $count = $log[$sponsor['id']] ?? 0;

        return $count < $cap;
    }

    private static function isFrequencyCapped(array $sponsor, string $userId): bool
    {
        $cap = $sponsor['frequency_cap'] ?? [];
        $days = $cap['per_user_days'] ?? 7;

        $safeUserId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $userId);
        $path = DATA_DIR . self::HISTORY_DIR_REL . "/users/{$safeUserId}.json";
        if (!file_exists($path)) return false;

        $history = json_decode(file_get_contents($path), true) ?: [];
        $lastSeen = $history[$sponsor['id']] ?? null;
        if (!$lastSeen) return false;

        $lastDate = strtotime($lastSeen);
        if ($lastDate === false) return false;

        $daysSince = (time() - $lastDate) / 86400;
        return $daysSince < $days;
    }

    private static function isWithinRadius(float $lat, float $lng, array $sponsor): bool
    {
        $sLat = (float)($sponsor['location']['lat'] ?? 0);
        $sLng = (float)($sponsor['location']['lng'] ?? 0);
        $radius = (float)($sponsor['location']['radius_km'] ?? 3.0);

        $dist = self::haversine($lat, $lng, $sLat, $sLng);
        return $dist <= $radius;
    }

    // --- Template selection ---

    private static function selectTemplate(array $sponsor, string $guideMood, array $contextTags): ?array
    {
        $templates = $sponsor['narrative_templates'] ?? [];
        if (empty($templates)) return null;

        $moodMatches = [];
        $anyMatches = [];

        foreach ($templates as $tpl) {
            $tplMood = $tpl['mood'] ?? 'any';
            if ($tplMood === $guideMood) {
                $moodMatches[] = $tpl;
            } elseif ($tplMood === 'any') {
                $anyMatches[] = $tpl;
            }
        }

        $pool = !empty($moodMatches) ? $moodMatches : $anyMatches;
        if (empty($pool)) return null;

        if (!empty($contextTags)) {
            $tagMatches = array_filter($pool, function ($tpl) use ($contextTags) {
                $tplTags = $tpl['context_tags'] ?? [];
                if (empty($tplTags)) return false;
                return !empty(array_intersect($tplTags, $contextTags));
            });
            if (!empty($tagMatches)) {
                return $tagMatches[array_rand($tagMatches)];
            }
        }

        return $pool[array_rand($pool)];
    }

    // --- Scoring ---

    private static function scoreSponsor(
        array $sponsor,
        float $lat,
        float $lng,
        string $guideMood,
        array $contextTags,
        array $template
    ): float {
        $sLat = (float)($sponsor['location']['lat'] ?? 0);
        $sLng = (float)($sponsor['location']['lng'] ?? 0);
        $radius = (float)($sponsor['location']['radius_km'] ?? 3.0);

        $dist = self::haversine($lat, $lng, $sLat, $sLng);
        $distScore = max(0, 1.0 - ($dist / $radius));

        $moodScore = ($template['mood'] === $guideMood) ? 1.0 : 0.5;

        $tagScore = 0.3;
        if (!empty($contextTags) && !empty($template['context_tags'])) {
            $overlap = count(array_intersect($contextTags, $template['context_tags']));
            $tagScore = min(1.0, $overlap * 0.4);
        }

        return ($distScore * 0.4) + ($moodScore * 0.3) + ($tagScore * 0.3);
    }

    // --- Impression recording ---

    private static function recordImpression(string $sponsorId, string $userId): void
    {
        $safeUserId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $userId);

        $userDir = DATA_DIR . self::HISTORY_DIR_REL . '/users';
        if (!is_dir($userDir)) @mkdir($userDir, 0755, true);

        $userPath = "{$userDir}/{$safeUserId}.json";
        $history = [];
        if (file_exists($userPath)) {
            $history = json_decode(file_get_contents($userPath), true) ?: [];
        }
        $history[$sponsorId] = date('c');

        if (count($history) > 100) {
            arsort($history);
            $history = array_slice($history, 0, 100, true);
        }
        file_put_contents($userPath, json_encode($history, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        $currentMonth = date('Y-m');
        $monthlyDir = DATA_DIR . self::HISTORY_DIR_REL . '/monthly';
        if (!is_dir($monthlyDir)) @mkdir($monthlyDir, 0755, true);

        $monthlyPath = "{$monthlyDir}/{$currentMonth}.json";
        $monthly = [];
        if (file_exists($monthlyPath)) {
            $monthly = json_decode(file_get_contents($monthlyPath), true) ?: [];
        }
        $monthly[$sponsorId] = ($monthly[$sponsorId] ?? 0) + 1;
        file_put_contents($monthlyPath, json_encode($monthly, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        $logDir = DATA_DIR . self::HISTORY_DIR_REL . '/log';
        if (!is_dir($logDir)) @mkdir($logDir, 0755, true);

        $logPath = "{$logDir}/" . date('Y-m-d') . '.jsonl';
        $entry = json_encode([
            'sponsor_id' => $sponsorId,
            'user_id' => $safeUserId,
            'at' => date('c'),
        ], JSON_UNESCAPED_UNICODE) . "\n";
        file_put_contents($logPath, $entry, FILE_APPEND | LOCK_EX);
    }

    // --- Geo ---

    private static function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return self::EARTH_RADIUS_KM * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
