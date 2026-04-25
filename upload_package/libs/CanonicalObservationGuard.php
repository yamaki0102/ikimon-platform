<?php

class CanonicalObservationGuard
{
    public static function shouldSkip(array $observation): ?array
    {
        $originalId = trim((string)($observation['id'] ?? ''));
        $userId = trim((string)($observation['user_id'] ?? ''));

        if ($originalId !== '' && preg_match('/^test[-_]/i', $originalId) === 1) {
            return [
                'skip' => true,
                'reason' => 'test_named_observation_id',
            ];
        }

        if ($userId !== '' && preg_match('/^test[-_]?user$/i', $userId) === 1) {
            return [
                'skip' => true,
                'reason' => 'test_user_submission',
            ];
        }

        if (self::looksLikeFixtureObservation($observation)) {
            return [
                'skip' => true,
                'reason' => 'fixture_style_observation',
            ];
        }

        return null;
    }

    private static function looksLikeFixtureObservation(array $observation): bool
    {
        $originalId = trim((string)($observation['id'] ?? ''));
        if ($originalId === '' || preg_match('/^o\d+$/', $originalId) !== 1) {
            return false;
        }

        $scientificName = trim((string)($observation['scientific_name'] ?? (($observation['taxon']['scientific_name'] ?? ''))));
        $hasCoordinates = isset($observation['lat'], $observation['lng'])
            || isset($observation['location']['lat'], $observation['location']['lng']);
        $hasIdentifications = !empty($observation['identifications']);
        $photos = $observation['photos'] ?? [];
        $photoCount = is_array($photos) ? count($photos) : 0;

        return $scientificName === ''
            && !$hasCoordinates
            && !$hasIdentifications
            && $photoCount === 0;
    }
}
