<?php

require_once __DIR__ . '/CorporateAccess.php';
require_once __DIR__ . '/CorporateManager.php';

class CorporatePlanGate
{
    public static function resolveCorporationForSite(string $siteId): ?array
    {
        return CorporateAccess::resolveCorporationForSite($siteId);
    }

    public static function resolveCorporationForEvent(array $event): ?array
    {
        $siteId = trim((string)($event['location']['site_id'] ?? ($event['site_id'] ?? '')));
        if ($siteId === '') {
            return null;
        }

        return self::resolveCorporationForSite($siteId);
    }

    public static function getPlan(?array $corporation): string
    {
        if (!$corporation) {
            return 'personal';
        }

        return (string)($corporation['plan'] ?? 'community');
    }

    public static function canUseAdvancedOutputs(?array $corporation): bool
    {
        return CorporateManager::corporationHasFeature($corporation, 'advanced_outputs');
    }

    public static function canRevealSpeciesDetails(?array $corporation): bool
    {
        return CorporateManager::corporationHasFeature($corporation, 'full_species_visibility');
    }

    public static function isCommunityWorkspace(?array $corporation): bool
    {
        return self::getPlan($corporation) === 'community';
    }
}
