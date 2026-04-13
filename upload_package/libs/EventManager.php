<?php

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/Indexer.php';

class EventManager
{
    private static $resource = 'events';

    /**
     * Create or Update an Event
     * 
     * @param array $data Event data (must include 'title', 'organizer_id')
     * @return array|false The saved event with ID or false on failure
     */
    public static function save(array $data)
    {
        // 1. ID Generation
        if (empty($data['id'])) {
            $data['id'] = 'evt_' . bin2hex(random_bytes(8));
            $data['created_at'] = date('c');
            $data['is_new'] = true; // Internal flag
        } else {
            $data['updated_at'] = date('c');
        }

        // 2. Validate & Sanitize Event Code
        if (!empty($data['event_code'])) {
            // Normalize: uppercase, alphanumeric only
            $data['event_code'] = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $data['event_code']));

            // Check for duplicate code (if it's a new code for this event)
            $existingId = self::getIdByCode($data['event_code']);
            if ($existingId && $existingId !== $data['id']) {
                throw new Exception("Event code '{$data['event_code']}' is already in use by another event.");
            }
        } else {
            // Auto-generate if empty and requested (optional, can be done by caller)
            // For now, we allow empty event_code if not strictly required
        }

        // 3. Save to DataStore
        // Use upsert to handle both new and existing
        if (DataStore::upsert(self::$resource, $data)) {

            // 4. Update Indices

            // Index by Event Code
            if (!empty($data['event_code'])) {
                Indexer::addToIndex('event_codes', $data['event_code'], $data['id']);
            }

            // Index by Owner (using standard DataStore pattern if not already handled)
            if (!empty($data['organizer_id'])) {
                Indexer::addToIndex('user_' . $data['organizer_id'] . '_events', date('Y-m'), $data['id']);
            }

            // Index by Site (if linked to a site)
            if (!empty($data['location']['site_id'])) {
                Indexer::addToIndex('site_' . $data['location']['site_id'] . '_events', date('Y-m'), $data['id']);
            }

            return $data;
        }

        return false;
    }

    /**
     * Get Event by ID
     */
    public static function get(string $id)
    {
        return DataStore::findById(self::$resource, $id);
    }

    /**
     * Get Event by Event Code
     */
    public static function getByCode(string $code)
    {
        $code = strtoupper(trim($code));
        $ids = Indexer::getFromIndex('event_codes', $code);

        if (empty($ids)) return null;

        // Code should be unique, so we take the first/latest one
        $id = $ids[0];
        return self::get($id);
    }

    /**
     * Helper to get just the ID from a code (lighter weight)
     */
    public static function getIdByCode(string $code)
    {
        $code = strtoupper(trim($code));
        $ids = Indexer::getFromIndex('event_codes', $code);
        return !empty($ids) ? $ids[0] : null;
    }

    /**
     * List Events with Filtering
     * 
     * @param array $filters ['status' => 'upcoming'|'past'|'live', 'site_id' => '...', 'limit' => 20]
     * @return array List of events
     */
    public static function listItems(array $filters = [])
    {
        $limit = $filters['limit'] ?? 50;

        // Callback for filtering
        $filterFunc = function ($item) use ($filters) {
            // Site Filter
            if (!empty($filters['site_id'])) {
                $itemSiteId = $item['location']['site_id'] ?? '';
                if ($itemSiteId !== $filters['site_id']) return false;
            }

            // Status Filter
            if (!empty($filters['status'])) {
                $now = new DateTime();
                $date = $item['event_date'] ?? '1970-01-01';
                $start = $item['start_time'] ?? '00:00';
                $end = $item['end_time'] ?? '23:59';

                $eventStart = new DateTime("$date $start");
                $eventEnd = new DateTime("$date $end");
                // Add margins
                $eventStart->modify('-30 minutes');
                $eventEnd->modify('+30 minutes');

                if ($filters['status'] === 'live') {
                    if (!($now >= $eventStart && $now <= $eventEnd)) return false;
                } elseif ($filters['status'] === 'upcoming') {
                    if (!($now < $eventStart)) return false;
                } elseif ($filters['status'] === 'past') {
                    if (!($now > $eventEnd)) return false;
                }
            }

            return true;
        };

        // Use DataStore::getLatest for efficiency
        $events = DataStore::getLatest(self::$resource, $limit * 2, $filterFunc); // Fetch more to safe-guard sort

        // Sort
        usort($events, function ($a, $b) {
            $da = $a['event_date'] . ' ' . ($a['start_time'] ?? '');
            $db = $b['event_date'] . ' ' . ($b['start_time'] ?? '');
            return strcmp($da, $db); // Oldest first? Usually upcoming is Soonest first.
        });

        // Loop for upcoming: we want Soonest (Ascending) 
        // Loop for past: we want Newest/Latest (Descending)

        if (($filters['status'] ?? '') === 'past') {
            usort($events, function ($a, $b) {
                $da = $a['event_date'] . ' ' . ($a['start_time'] ?? '');
                $db = $b['event_date'] . ' ' . ($b['start_time'] ?? '');
                return strcmp($db, $da); // Descending
            });
        } else {
            usort($events, function ($a, $b) {
                $da = $a['event_date'] . ' ' . ($a['start_time'] ?? '');
                $db = $b['event_date'] . ' ' . ($b['start_time'] ?? '');
                return strcmp($da, $db); // Ascending
            });
        }

        return array_slice($events, 0, $limit);
    }

    /**
     * Generate a random unique 6-char alphanumeric code
     */
    public static function generateUniqueCode()
    {
        $maxTries = 10;
        for ($i = 0; $i < $maxTries; $i++) {
            $code = strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
            // Check uniqueness
            if (!self::getIdByCode($code)) {
                return $code;
            }
        }
        return null; // Should rarely happen
    }

    /**
     * Get Event Statistics
     * 
     * @param string $eventId
     * @return array
     */
    public static function getStats(string $eventId)
    {
        $event = self::get($eventId);
        if (!$event) return [
            'species_count' => 0,
            'observation_count' => 0,
            'contributor_count' => 0,
            'recent_observations' => []
        ];

        $eventCode = $event['event_code'] ?? '';
        if (empty($eventCode)) {
            // Fallback: check linked_observations if manually linked
            $obsIds = $event['linked_observations'] ?? [];
            return [
                'species_count' => 0, // Hard to calc without loading all
                'observation_count' => count($obsIds),
                'contributor_count' => 0,
                'recent_observations' => []
            ];
        }

        // Scan observations for this event code
        // Note: usage of DataStore::getLatest with filter
        // For performance in future, we should index by event_tag.
        $filterFunc = function ($obs) use ($eventCode) {
            return ($obs['event_tag'] ?? '') === $eventCode;
        };

        // Fetch up to 1000 observations associated with this event
        $observations = DataStore::getLatest('observations', 1000, $filterFunc);

        $species = [];
        $contributors = [];
        $recent = [];

        foreach ($observations as $obs) {
            // Count species
            $sp = $obs['species_name'] ?? '';
            if ($sp) $species[$sp] = true;

            // Count contributors
            $user = $obs['user_id'] ?? '';
            if ($user) $contributors[$user] = true;
        }

        return [
            'species_count' => count($species),
            'observation_count' => count($observations),
            'contributor_count' => count($contributors),
            'recent_observations' => array_slice($observations, 0, 5) // Return top 5 recent
        ];
    }
}
