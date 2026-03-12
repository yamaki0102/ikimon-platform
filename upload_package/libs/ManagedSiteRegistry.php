<?php

require_once __DIR__ . '/DataStore.php';

class ManagedSiteRegistry
{
    private const FILE = 'reference/managed_sites';
    private const VALID_CONTEXT_TYPES = [
        'botanical_garden',
        'zoo',
        'aquarium',
        'aviary',
        'conservation_center',
        'park_planting',
        'school_biotope',
        'private_collection',
        'other',
    ];
    private const VALID_ORIGINS = [
        'wild',
        'captive',
        'cultivated',
        'released',
        'escaped',
        'naturalized',
        'uncertain',
    ];

    public static function normalizeObservationContext(array $input): array
    {
        $contextType = self::normalizeContextType($input['managed_context_type'] ?? null);
        $siteId = trim((string)($input['managed_site_id'] ?? ''));
        $siteName = trim((string)($input['managed_site_name'] ?? ''));
        $contextNote = trim((string)($input['managed_context_note'] ?? ''));
        $origin = self::normalizeOrigin($input['organism_origin'] ?? null, $input['cultivation'] ?? null);
        $site = null;

        if ($siteId !== '') {
            $site = self::findById($siteId);
            if ($site) {
                $siteId = (string)($site['id'] ?? $siteId);
                $siteName = trim((string)($site['name'] ?? $siteName));
                $contextType = self::normalizeContextType($site['type'] ?? $contextType);
            }
        }

        return [
            'organism_origin' => $origin,
            'managed_context' => [
                'type' => $contextType,
                'site_id' => $siteId !== '' ? $siteId : null,
                'site_name' => $siteName !== '' ? $siteName : null,
                'note' => $contextNote !== '' ? mb_substr($contextNote, 0, 280) : null,
                'inside_boundary' => $site ? self::toBoolOrNull($site['inside_boundary'] ?? null) : null,
                'registry_source' => $site ? self::FILE : null,
            ],
        ];
    }

    public static function findById(string $siteId): ?array
    {
        if ($siteId === '') {
            return null;
        }

        foreach (self::all() as $site) {
            if ((string)($site['id'] ?? '') === $siteId) {
                return $site;
            }
        }

        return null;
    }

    public static function all(): array
    {
        $sites = DataStore::get(self::FILE, 3600);
        return is_array($sites) ? $sites : [];
    }

    public static function isWildLike(?string $origin): bool
    {
        return in_array((string)$origin, ['wild', 'naturalized'], true);
    }

    private static function normalizeContextType($value): ?string
    {
        $value = trim(strtolower((string)$value));
        if ($value === '' || !in_array($value, self::VALID_CONTEXT_TYPES, true)) {
            return null;
        }
        return $value;
    }

    private static function normalizeOrigin($origin, $cultivation): string
    {
        $origin = trim(strtolower((string)$origin));
        if (in_array($origin, self::VALID_ORIGINS, true)) {
            return $origin;
        }

        return trim((string)$cultivation) === 'cultivated' ? 'cultivated' : 'wild';
    }

    private static function toBoolOrNull($value): ?bool
    {
        if ($value === null || $value === '') {
            return null;
        }
        return (bool)$value;
    }
}
