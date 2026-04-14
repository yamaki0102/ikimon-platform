<?php

final class PlaceRevisitLoop
{
    public static function buildBuckets(array $observations): array
    {
        $buckets = [];

        foreach ($observations as $obs) {
            if (!is_array($obs)) {
                continue;
            }

            $placeKey = self::buildPlaceKey($obs);
            $observedAtRaw = (string)($obs['observed_at'] ?? ($obs['created_at'] ?? ''));
            $observedTs = strtotime($observedAtRaw !== '' ? $observedAtRaw : 'now') ?: time();

            if (!isset($buckets[$placeKey])) {
                $buckets[$placeKey] = [
                    'key' => $placeKey,
                    'label' => self::buildPlaceLabel($obs),
                    'count' => 0,
                    'latest_at' => 0,
                    'previous_at' => null,
                    'latest_obs_id' => '',
                    'photo' => '',
                    'lat' => isset($obs['lat']) ? (float)$obs['lat'] : null,
                    'lng' => isset($obs['lng']) ? (float)$obs['lng'] : null,
                ];
            }

            $bucket = &$buckets[$placeKey];
            $bucket['count']++;

            if ($observedTs >= (int)$bucket['latest_at']) {
                if (!empty($bucket['latest_at']) && $bucket['latest_at'] !== $observedTs) {
                    $bucket['previous_at'] = $bucket['latest_at'];
                } elseif ($bucket['previous_at'] === null && !empty($bucket['latest_at'])) {
                    $bucket['previous_at'] = $bucket['latest_at'];
                }

                $bucket['latest_at'] = $observedTs;
                $bucket['latest_obs_id'] = (string)($obs['id'] ?? '');
                $bucket['photo'] = (string)($obs['photos'][0] ?? '');
                $bucket['lat'] = isset($obs['lat']) ? (float)$obs['lat'] : $bucket['lat'];
                $bucket['lng'] = isset($obs['lng']) ? (float)$obs['lng'] : $bucket['lng'];
            } elseif ($bucket['previous_at'] === null || $observedTs > (int)$bucket['previous_at']) {
                $bucket['previous_at'] = $observedTs;
            }
            unset($bucket);
        }

        return $buckets;
    }

    public static function recent(array $buckets, int $limit = 3): array
    {
        $recent = array_values(array_filter($buckets, fn($place) => (int)($place['count'] ?? 0) >= 2));
        usort($recent, fn($a, $b) => ((int)($b['latest_at'] ?? 0)) <=> ((int)($a['latest_at'] ?? 0)));
        return array_slice($recent, 0, $limit);
    }

    public static function stale(array $buckets, int $limit = 3, int $minDays = 21): array
    {
        $stale = array_values(array_filter($buckets, function ($place) use ($minDays) {
            $latest = (int)($place['latest_at'] ?? 0);
            if ($latest <= 0) {
                return false;
            }
            $daysSince = (int)floor((time() - $latest) / 86400);
            return $daysSince >= $minDays;
        }));

        usort($stale, fn($a, $b) => ((int)($a['latest_at'] ?? 0)) <=> ((int)($b['latest_at'] ?? 0)));
        return array_slice($stale, 0, $limit);
    }

    private static function buildPlaceKey(array $obs): string
    {
        $siteId = trim((string)($obs['site_id'] ?? ''));
        if ($siteId !== '') {
            return 'site:' . $siteId;
        }

        $siteName = trim((string)($obs['site_name'] ?? ''));
        if ($siteName !== '') {
            return 'site-name:' . mb_strtolower($siteName);
        }

        $municipality = trim((string)($obs['municipality'] ?? ''));
        $prefecture = trim((string)($obs['prefecture'] ?? ''));
        if ($municipality !== '' || $prefecture !== '') {
            return 'area:' . mb_strtolower($prefecture . '|' . $municipality);
        }

        if (!empty($obs['lat']) && !empty($obs['lng'])) {
            return 'coord:' . round((float)$obs['lat'], 3) . ',' . round((float)$obs['lng'], 3);
        }

        return 'obs:' . (string)($obs['id'] ?? uniqid('obs-', true));
    }

    private static function buildPlaceLabel(array $obs): string
    {
        $siteName = trim((string)($obs['site_name'] ?? ''));
        if ($siteName !== '') {
            return $siteName;
        }

        $municipality = trim((string)($obs['municipality'] ?? ''));
        $prefecture = trim((string)($obs['prefecture'] ?? ''));
        $parts = array_values(array_filter([$municipality, $prefecture], fn($v) => $v !== ''));
        if ($parts !== []) {
            return implode(' / ', $parts);
        }

        return __('profile_page.place_fallback', 'Saved place');
    }
}
