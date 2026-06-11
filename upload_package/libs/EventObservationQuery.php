<?php

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/GeoUtils.php';
require_once __DIR__ . '/SiteManager.php';

class EventObservationQuery
{
    public const MODE_SUMMARY = 'summary';
    public const MODE_OFFICIAL = 'official';
    public const EVENT_TIME_BUFFER_MINUTES = 30;

    public static function range(array $event): array
    {
        $eventDate = $event['event_date'] ?? date('Y-m-d');
        $startTime = $event['start_time'] ?? '09:00';
        $endTime = $event['end_time'] ?? '12:00';

        $start = new DateTime("{$eventDate} {$startTime}");
        $end = new DateTime("{$eventDate} {$endTime}");

        // Covers early arrival and delayed uploads around the announced event window.
        $start->modify('-' . self::EVENT_TIME_BUFFER_MINUTES . ' minutes');
        $end->modify('+' . self::EVENT_TIME_BUFFER_MINUTES . ' minutes');

        return [$start, $end];
    }

    public static function collect(array $event, string $mode = self::MODE_SUMMARY): array
    {
        [$start, $end] = self::range($event);
        $officialMode = $mode === self::MODE_OFFICIAL;
        $matched = [];
        $seen = [];

        foreach (self::candidates($event, $start, $end) as $obs) {
            $obsId = (string)($obs['id'] ?? '');
            $fallbackId = $obsId !== '' ? $obsId : hash('sha256', json_encode($obs, JSON_UNESCAPED_UNICODE));
            if (isset($seen[$fallbackId])) {
                continue;
            }

            $source = self::matchSource($event, $obs, $start, $end);
            if ($source === null) {
                continue;
            }
            if ($officialMode && $source === 'radius') {
                continue;
            }

            $seen[$fallbackId] = true;
            $obs['_event_match_source'] = $source;
            $matched[] = $obs;
        }

        return $matched;
    }

    private static function candidates(array $event, DateTime $start, DateTime $end): array
    {
        $items = [];
        $seen = [];

        foreach (self::monthsBetween($start, $end) as $month) {
            foreach (DataStore::get('observations/' . $month, 60) as $obs) {
                self::appendUnique($items, $seen, $obs);
            }
        }

        foreach (($event['linked_observations'] ?? []) as $obsId) {
            $obsId = (string)$obsId;
            if ($obsId === '') {
                continue;
            }
            $obs = DataStore::findById('observations', $obsId);
            if (is_array($obs)) {
                self::appendUnique($items, $seen, $obs);
            }
        }

        if (empty($items)) {
            foreach (DataStore::fetchAll('observations') as $obs) {
                self::appendUnique($items, $seen, $obs);
            }
        }

        return $items;
    }

    private static function appendUnique(array &$items, array &$seen, array $obs): void
    {
        $obsId = (string)($obs['id'] ?? '');
        $key = $obsId !== '' ? $obsId : hash('sha256', json_encode($obs, JSON_UNESCAPED_UNICODE));
        if (isset($seen[$key])) {
            return;
        }
        $seen[$key] = true;
        $items[] = $obs;
    }

    private static function monthsBetween(DateTime $start, DateTime $end): array
    {
        $months = [];
        $cursor = (clone $start)->modify('first day of this month')->setTime(0, 0);
        $last = (clone $end)->modify('first day of this month')->setTime(0, 0);

        while ($cursor <= $last) {
            $months[] = $cursor->format('Y-m');
            $cursor->modify('+1 month');
        }

        return $months;
    }

    private static function matchSource(array $event, array $obs, DateTime $rangeStart, DateTime $rangeEnd): ?string
    {
        $obsId = (string)($obs['id'] ?? '');
        $linkedIds = array_map('strval', $event['linked_observations'] ?? []);
        if ($obsId !== '' && in_array($obsId, $linkedIds, true)) {
            return 'linked';
        }

        $obsDateTime = self::observationDateTime($obs);
        if (!$obsDateTime || $obsDateTime < $rangeStart || $obsDateTime > $rangeEnd) {
            return null;
        }

        $eventCode = trim((string)($event['event_code'] ?? ''));
        if ($eventCode !== '' && ($obs['event_tag'] ?? '') === $eventCode) {
            return 'event_tag';
        }

        $siteId = trim((string)($event['location']['site_id'] ?? ($event['site_id'] ?? '')));
        if ($siteId !== '') {
            if (($obs['site_id'] ?? '') === $siteId) {
                return 'site';
            }

            $lat = (float)($obs['lat'] ?? 0);
            $lng = (float)($obs['lng'] ?? 0);
            if ($lat && $lng && SiteManager::isPointInSite($lat, $lng, $siteId)) {
                return 'site';
            }

            return null;
        }

        $evtLat = (float)($event['location']['lat'] ?? 0);
        $evtLng = (float)($event['location']['lng'] ?? 0);
        $radiusM = (int)($event['location']['radius_m'] ?? 500);
        $obsLat = (float)($obs['lat'] ?? 0);
        $obsLng = (float)($obs['lng'] ?? 0);

        if (!$evtLat || !$evtLng || !$obsLat || !$obsLng) {
            return null;
        }

        return GeoUtils::distance($evtLat, $evtLng, $obsLat, $obsLng) <= $radiusM ? 'radius' : null;
    }

    private static function observationDateTime(array $obs): ?DateTime
    {
        $value = $obs['observed_at'] ?? ($obs['created_at'] ?? '');
        if ($value === '') {
            return null;
        }

        try {
            return new DateTime($value);
        } catch (Throwable $e) {
            return null;
        }
    }
}
