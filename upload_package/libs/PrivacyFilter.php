<?php

/**
 * PrivacyFilter — 3-Layer Privacy Model for Ambient Presence
 * 
 * Layer 1: Private   — exact coordinates, visible only to the observer
 * Layer 2: Ambient   — grid-rounded + time-delayed, for public display
 * Layer 3: Admin     — raw data accessible only to site administrators
 *
 * Design ref: ambient_presence_design.md §Position and Time Anonymization Policy
 */

require_once __DIR__ . '/GeoUtils.php';
require_once __DIR__ . '/RedListManager.php';

class PrivacyFilter
{

    /**
     * Privacy layers
     */
    const LAYER_PRIVATE = 'private';  // Observer only
    const LAYER_AMBIENT = 'ambient';  // Public (anonymized)
    const LAYER_ADMIN   = 'admin';    // Site admin (raw)

    /**
     * Apply privacy filter to an observation for public display (Ambient layer).
     *
     * @param array $observation  Raw observation data with lat/lng/species
     * @param int   $gridM        Grid size override (default auto-detect)
     * @return array Filtered observation safe for public display
     */
    public static function forAmbient(array $observation, int $gridM = 1000): array
    {
        $lat = (float)($observation['latitude'] ?? $observation['lat'] ?? 0);
        $lng = (float)($observation['longitude'] ?? $observation['lng'] ?? 0);
        $speciesName = $observation['species_name']
            ?? $observation['taxon']['name']
            ?? $observation['taxon']['scientific_name']
            ?? '';
        $observedAt = $observation['observed_at'] ?? $observation['created_at'] ?? '';

        // Check if species is on any protection list
        $isProtected = self::isProtectedSpecies($speciesName);

        // Apply spatial anonymization
        $anon = GeoUtils::roundForAmbient($lat, $lng, $isProtected, $gridM);

        // Apply temporal anonymization
        $delayedTime = self::applyTimeDelay($observedAt, $anon['delay_s']);

        // Build filtered output
        $filtered = $observation;
        $filtered['latitude']  = $anon['lat'];
        $filtered['longitude'] = $anon['lng'];
        $filtered['cell_id']   = $anon['cell_id'];
        $filtered['grid_m']    = $anon['grid_m'];
        $filtered['observed_at'] = $delayedTime;
        $filtered['privacy_layer'] = self::LAYER_AMBIENT;

        // Remove fields that should never appear in ambient layer
        unset($filtered['exact_lat']);
        unset($filtered['exact_lng']);
        unset($filtered['user_id']);  // anonymous in ambient layer

        // If protected, add flag but DON'T reveal species detail level
        if ($isProtected) {
            $filtered['is_protected'] = true;
            // Coarsen species name to genus level only
            $filtered['species_name'] = self::toGenusLevel($speciesName);
        }

        return $filtered;
    }

    /**
     * Filter a list of observations for Ambient display.
     * Only returns observations that have passed their time delay.
     *
     * @param array $observations  Array of raw observations
     * @param int   $gridM         Grid size
     * @return array Filtered observations
     */
    public static function filterListForAmbient(array $observations, int $gridM = 1000): array
    {
        $now = time();
        $result = [];

        foreach ($observations as $obs) {
            $filtered = self::forAmbient($obs, $gridM);

            // Only show if time delay has passed
            $obsTime = strtotime($obs['observed_at'] ?? $obs['created_at'] ?? 'now');
            $delaySec = GeoUtils::roundForAmbient(
                (float)($obs['latitude'] ?? $obs['lat'] ?? 0),
                (float)($obs['longitude'] ?? $obs['lng'] ?? 0),
                self::isProtectedSpecies($obs['species_name'] ?? '')
            )['delay_s'];

            if (($now - $obsTime) >= $delaySec) {
                $result[] = $filtered;
            }
        }

        return $result;
    }

    /**
     * Check if a species is on any protection/red list.
     * Uses RedListManager for lookup.
     *
     * @param string $speciesName
     * @return bool
     */
    public static function isProtectedSpecies(string $speciesName): bool
    {
        if (empty($speciesName)) {
            return false;
        }

        try {
            static $rlm = null;
            if ($rlm === null) {
                $rlm = new RedListManager();
            }
            $status = $rlm->lookup($speciesName);
            if (!$status) {
                return false;
            }
            // Check both national and prefectural entries
            $protectedCategories = [
                'CR',
                'EN',
                'VU',
                'NT',
                'DD',
                '絶滅危惧ⅠA類',
                '絶滅危惧ⅠB類',
                '絶滅危惧Ⅱ類',
                '準絶滅危惧',
                '情報不足'
            ];
            foreach ($status as $listId => $entry) {
                if (in_array($entry['category'] ?? '', $protectedCategories)) {
                    return true;
                }
            }
            return false;
        } catch (\Exception $e) {
            // If RedListManager fails, default to NOT protected (fail open)
            return false;
        }
    }

    /**
     * Apply time delay to an observation timestamp.
     * Returns a "fuzzy" time if delay hasn't fully elapsed,
     * or the rounded time if it has.
     *
     * @param string $timestamp  ISO timestamp
     * @param int    $delaySec   Delay in seconds
     * @return string  Delayed ISO timestamp (rounded to nearest hour)
     */
    public static function applyTimeDelay(string $timestamp, int $delaySec): string
    {
        if (empty($timestamp)) {
            return '';
        }

        $obsTime = strtotime($timestamp);
        if ($obsTime === false) {
            return $timestamp;
        }

        $delayedTime = $obsTime + $delaySec;

        // Round to nearest hour for additional ambiguity
        $roundedTime = floor($delayedTime / 3600) * 3600;

        return date('Y-m-d\TH:00:00+09:00', (int)$roundedTime);
    }

    /**
     * Truncate species name to genus level only.
     * "Papilio machaon" → "Papilio sp."
     * "アゲハチョウ" → unchanged (Japanese names stay as-is)
     *
     * @param string $name Species name
     * @return string Genus-level name
     */
    public static function toGenusLevel(string $name): string
    {
        // Japanese names: can't reliably split, return as-is
        if (preg_match('/[\x{3040}-\x{309F}\x{30A0}-\x{30FF}\x{4E00}-\x{9FFF}]/u', $name)) {
            return $name;
        }

        // Latin binomial: "Genus species" → "Genus sp."
        $parts = explode(' ', trim($name));
        if (count($parts) >= 2) {
            return $parts[0] . ' sp.';
        }

        return $name;
    }

    /**
     * Check if current user has admin access (Layer 3).
     * Admins can see unfiltered data.
     *
     * @return bool
     */
    public static function hasAdminAccess(): bool
    {
        require_once __DIR__ . '/Auth.php';
        $user = Auth::user();
        return $user && Auth::hasRole('Analyst');
    }

    /**
     * Check if a user is viewing their own observation (Layer 1).
     *
     * @param array $observation
     * @return bool
     */
    public static function isOwnObservation(array $observation): bool
    {
        require_once __DIR__ . '/Auth.php';
        $user = Auth::user();
        if (!$user) return false;
        return ($observation['user_id'] ?? '') === ($user['id'] ?? '');
    }

    /**
     * Smart filter: auto-select privacy layer based on viewer.
     * - Own observation → raw data (Private layer)
     * - Admin → raw data (Admin layer)
     * - Everyone else → anonymized (Ambient layer)
     *
     * @param array $observation  Raw observation
     * @param int   $gridM        Grid size
     * @return array  Appropriately filtered observation
     */
    public static function autoFilter(array $observation, int $gridM = 1000): array
    {
        // Layer 1: Own observation
        if (self::isOwnObservation($observation)) {
            $observation['privacy_layer'] = self::LAYER_PRIVATE;
            return $observation;
        }

        // Layer 3: Admin
        if (self::hasAdminAccess()) {
            $observation['privacy_layer'] = self::LAYER_ADMIN;
            return $observation;
        }

        // User-specified location granularity override
        $granularity = $observation['location_granularity'] ?? 'exact';
        if ($granularity === 'hidden') {
            $filtered = $observation;
            $filtered['latitude'] = null;
            $filtered['longitude'] = null;
            $filtered['lat'] = null;
            $filtered['lng'] = null;
            $filtered['privacy_layer'] = self::LAYER_AMBIENT;
            return $filtered;
        }
        if ($granularity === 'prefecture') {
            return self::forAmbient($observation, 10000);
        }
        if ($granularity === 'municipality') {
            return self::forAmbient($observation, 1000);
        }

        // Layer 2: Ambient (default for all public viewers)
        return self::forAmbient($observation, $gridM);
    }

    public static function describeGranularity(string $granularity): array
    {
        return match ($granularity) {
            'hidden' => ['label' => '位置非公開', 'grid_m' => null],
            'prefecture' => ['label' => '都道府県レベル', 'grid_m' => 10000],
            'municipality' => ['label' => '市区町村レベル', 'grid_m' => 1000],
            default => ['label' => '環境レイヤー', 'grid_m' => 1000],
        };
    }
}
