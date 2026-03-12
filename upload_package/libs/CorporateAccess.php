<?php

require_once __DIR__ . '/Auth.php';
require_once __DIR__ . '/CorporateManager.php';
require_once __DIR__ . '/SiteManager.php';

class CorporateAccess
{
    public static function isInternalManager(?array $user): bool
    {
        if (!$user) {
            return false;
        }
        return Auth::hasRole('Analyst') || Auth::hasRole('Admin');
    }

    public static function resolveCorporationIdForSite(string $siteId): ?string
    {
        $siteId = trim($siteId);
        if ($siteId === '') {
            return null;
        }

        $site = SiteManager::load($siteId);
        if (!$site) {
            return null;
        }

        $ownerOrgId = trim((string)($site['owner_org_id'] ?? ''));
        if ($ownerOrgId !== '') {
            return $ownerOrgId;
        }

        $ownerName = trim((string)($site['owner'] ?? ''));
        if ($ownerName === '') {
            return null;
        }

        foreach (CorporateManager::list() as $corporation) {
            if (trim((string)($corporation['name'] ?? '')) === $ownerName) {
                return (string)($corporation['id'] ?? '');
            }
        }

        return null;
    }

    public static function resolveCorporationForSite(string $siteId): ?array
    {
        $corpId = self::resolveCorporationIdForSite($siteId);
        return $corpId !== null ? CorporateManager::get($corpId) : null;
    }

    public static function getUserCorpRole(string $corpId, ?array $user): ?string
    {
        if (!$user || $corpId === '') {
            return null;
        }

        $userId = (string)($user['id'] ?? '');
        if ($userId === '') {
            return null;
        }

        $corporation = CorporateManager::get($corpId);
        if (!$corporation) {
            return null;
        }

        $member = $corporation['members'][$userId] ?? null;
        if (!is_array($member)) {
            return null;
        }

        return trim((string)($member['role'] ?? '')) ?: null;
    }

    public static function getVisibleCorporations(?array $user): array
    {
        if (!$user) {
            return [];
        }

        if (self::isInternalManager($user)) {
            return CorporateManager::list();
        }

        $items = [];
        foreach (CorporateManager::getUserAffiliations((string)($user['id'] ?? '')) as $affiliation) {
            $corporation = CorporateManager::get((string)($affiliation['corp_id'] ?? ''));
            if ($corporation) {
                $items[] = $corporation;
            }
        }

        return $items;
    }

    public static function getManageableCorporations(?array $user): array
    {
        if (!$user) {
            return [];
        }

        if (self::isInternalManager($user)) {
            return CorporateManager::list();
        }

        $items = [];
        foreach (CorporateManager::getUserAffiliations((string)($user['id'] ?? '')) as $affiliation) {
            $role = (string)($affiliation['role'] ?? '');
            if (!in_array($role, ['owner', 'admin', 'editor'], true)) {
                continue;
            }

            $corporation = CorporateManager::get((string)($affiliation['corp_id'] ?? ''));
            if ($corporation) {
                $items[] = $corporation;
            }
        }

        return $items;
    }

    public static function getPreferredCorporation(?array $user, string $preferredCorpId = ''): ?array
    {
        $available = self::getVisibleCorporations($user);
        if (empty($available)) {
            return null;
        }

        if ($preferredCorpId !== '') {
            foreach ($available as $corporation) {
                if ((string)($corporation['id'] ?? '') === $preferredCorpId) {
                    return $corporation;
                }
            }
        }

        return $available[0];
    }

    public static function canAccessCorporation(string $corpId, ?array $user): bool
    {
        if ($corpId === '' || !$user) {
            return false;
        }
        if (self::isInternalManager($user)) {
            return true;
        }
        return self::getUserCorpRole($corpId, $user) !== null;
    }

    public static function canManageCorporation(string $corpId, ?array $user): bool
    {
        if ($corpId === '' || !$user) {
            return false;
        }
        if (self::isInternalManager($user)) {
            return true;
        }
        return in_array(self::getUserCorpRole($corpId, $user), ['owner', 'admin'], true);
    }

    public static function canEditCorporation(string $corpId, ?array $user): bool
    {
        if ($corpId === '' || !$user) {
            return false;
        }
        if (self::isInternalManager($user)) {
            return true;
        }
        return in_array(self::getUserCorpRole($corpId, $user), ['owner', 'admin', 'editor'], true);
    }

    public static function canViewSite(string $siteId, ?array $user): bool
    {
        $corpId = self::resolveCorporationIdForSite($siteId);
        if ($corpId === null) {
            return false;
        }
        return self::canAccessCorporation($corpId, $user);
    }

    public static function canEditSite(string $siteId, ?array $user): bool
    {
        $corpId = self::resolveCorporationIdForSite($siteId);
        if ($corpId === null) {
            return false;
        }
        return self::canEditCorporation($corpId, $user);
    }
}
