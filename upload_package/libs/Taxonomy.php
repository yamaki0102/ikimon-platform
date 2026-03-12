<?php

/**
 * Taxonomy - canonical taxon resolver + lineage utilities
 *
 * Normalizes free-form identification inputs into a canonical taxon payload
 * with stable IDs, lineage names, lineage IDs, and ancestry paths.
 */

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/TaxonSearchService.php';

class Taxonomy
{
    private const CACHE_FILE = 'taxonomy/taxon_detail_cache';
    private const VERSION = 'gbif-backbone+inat-2026-03';
    private const RANK_ORDER = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];

    public static function resolveFromInput(array $input): array
    {
        $seedName = trim((string)($input['taxon_name'] ?? $input['name'] ?? ''));
        $seedScientific = trim((string)($input['scientific_name'] ?? ''));
        $seedSlug = trim((string)($input['taxon_slug'] ?? $input['slug'] ?? ''));
        $seedRank = strtolower((string)($input['taxon_rank'] ?? $input['rank'] ?? 'species'));
        $seedLineage = is_array($input['lineage'] ?? null) ? $input['lineage'] : [];
        $seedLineageIds = is_array($input['lineage_ids'] ?? null) ? $input['lineage_ids'] : [];

        $gbifKey = self::extractGbifKey($input);
        if ($gbifKey !== null) {
            $resolved = self::resolveByGbifKey($gbifKey);
            if ($resolved !== null) {
                return self::applyInputHints($resolved, $seedName, $seedScientific, $seedSlug, $seedRank, $seedLineage, $seedLineageIds);
            }
        }

        $inatId = self::extractINatId($input);
        if ($inatId !== null) {
            $resolved = self::resolveByINatId($inatId);
            if ($resolved !== null) {
                return self::applyInputHints($resolved, $seedName, $seedScientific, $seedSlug, $seedRank, $seedLineage, $seedLineageIds);
            }
        }

        if ($seedSlug !== '') {
            $resolved = self::resolveBySlug($seedSlug);
            if ($resolved !== null) {
                return self::applyInputHints($resolved, $seedName, $seedScientific, $seedSlug, $seedRank, $seedLineage, $seedLineageIds);
            }
        }

        if ($seedScientific !== '' || $seedName !== '') {
            $resolved = self::resolveByName($seedScientific !== '' ? $seedScientific : $seedName);
            if ($resolved !== null) {
                return self::applyInputHints($resolved, $seedName, $seedScientific, $seedSlug, $seedRank, $seedLineage, $seedLineageIds);
            }
        }

        return self::buildLegacyTaxon($seedName, $seedScientific, $seedSlug, $seedRank, $seedLineage, $seedLineageIds, $input);
    }

    public static function resolveSuggestion(array $suggestion): ?array
    {
        $label = trim((string)($suggestion['label'] ?? ''));
        if ($label === '') {
            return null;
        }
        $labelParts = self::splitSuggestionLabel($label);
        $rank = strtolower((string)($suggestion['rank'] ?? 'species'));
        $input = [
            'taxon_name' => $labelParts['display_name'] !== '' ? $labelParts['display_name'] : $label,
            'taxon_key' => $suggestion['key'] ?? ($suggestion['gbif_key'] ?? null),
            'scientific_name' => trim((string)($suggestion['scientificName'] ?? ($suggestion['scientific_name'] ?? $labelParts['scientific_name']))),
            'taxon_slug' => $suggestion['slug'] ?? '',
            'taxon_rank' => $rank,
            'inat_taxon_id' => $suggestion['inat_taxon_id'] ?? null,
        ];

        $resolved = self::resolveFromInput($input);
        if (($resolved['provider'] ?? 'legacy') === 'legacy') {
            foreach (self::suggestionFallbackQueries($labelParts, $input['scientific_name']) as $fallbackName) {
                $fallback = self::resolveFromInput([
                    'taxon_name' => $fallbackName,
                    'scientific_name' => $input['scientific_name'],
                    'taxon_rank' => $rank,
                    'inat_taxon_id' => $suggestion['inat_taxon_id'] ?? null,
                ]);
                if (($fallback['provider'] ?? 'legacy') !== 'legacy') {
                    return $fallback;
                }
            }
            // Keep a synthetic taxon when canonical resolution fails so genus/family/order
            // hints still remain usable in UI and follow-up guidance.
            return $resolved;
        }
        return $resolved;
    }

    private static function splitSuggestionLabel(string $label): array
    {
        $displayName = trim($label);
        $scientificName = '';

        if (preg_match('/^(.*?)\s*\(([^()]+)\)\s*$/u', $label, $matches)) {
            $displayName = trim((string)$matches[1]);
            $scientificName = trim((string)$matches[2]);
        }

        return [
            'display_name' => $displayName,
            'scientific_name' => $scientificName,
        ];
    }

    private static function suggestionFallbackQueries(array $labelParts, string $scientificName): array
    {
        $queries = [];
        foreach ([
            $labelParts['display_name'] ?? '',
            $scientificName,
            trim((string)($labelParts['display_name'] ?? '') . ' ' . $scientificName),
        ] as $value) {
            $value = trim((string)$value);
            if ($value !== '' && !in_array($value, $queries, true)) {
                $queries[] = $value;
            }
        }
        return $queries;
    }

    public static function toIdentificationFields(array $resolved): array
    {
        return [
            'taxon_id' => $resolved['taxon_id'],
            'taxon_provider' => $resolved['provider'],
            'taxon_provider_id' => $resolved['provider_id'],
            'taxon_key' => $resolved['key'],
            'taxon_name' => $resolved['name'],
            'taxon_slug' => $resolved['slug'],
            'scientific_name' => $resolved['scientific_name'],
            'taxon_rank' => $resolved['rank'],
            'lineage' => $resolved['lineage'],
            'lineage_ids' => $resolved['lineage_ids'],
            'ancestry' => $resolved['ancestry'],
            'ancestry_ids' => $resolved['ancestry_ids'],
            'full_path_ids' => $resolved['full_path_ids'],
            'taxonomy_version' => $resolved['taxonomy_version'],
            'taxon' => self::toObservationTaxon($resolved),
        ];
    }

    public static function toObservationTaxon(array $resolved): array
    {
        $taxon = [
            'id' => $resolved['taxon_id'],
            'name' => $resolved['name'],
            'scientific_name' => $resolved['scientific_name'],
            'slug' => $resolved['slug'],
            'rank' => $resolved['rank'],
            'provider' => $resolved['provider'],
            'provider_id' => $resolved['provider_id'],
            'key' => $resolved['key'],
            'gbif_key' => $resolved['gbif_key'],
            'inat_taxon_id' => $resolved['inat_taxon_id'],
            'lineage' => $resolved['lineage'],
            'lineage_ids' => $resolved['lineage_ids'],
            'ancestry' => $resolved['ancestry'],
            'ancestry_ids' => $resolved['ancestry_ids'],
            'full_path_ids' => $resolved['full_path_ids'],
            'taxonomy_version' => $resolved['taxonomy_version'],
            'source' => $resolved['provider'],
            'thumbnail_url' => $resolved['thumbnail_url'],
            'canonical_name' => $resolved['canonical_name'],
        ];

        foreach (self::RANK_ORDER as $rank) {
            if (isset($resolved['lineage'][$rank])) {
                $taxon[$rank] = $resolved['lineage'][$rank];
            }
        }

        return $taxon;
    }

    public static function relation(array $left, array $right): string
    {
        $leftPath = self::extractPathIds($left);
        $rightPath = self::extractPathIds($right);

        if (empty($leftPath) || empty($rightPath)) {
            return 'unknown';
        }

        $leftId = end($leftPath);
        $rightId = end($rightPath);
        if ($leftId === $rightId) {
            return 'same';
        }
        if (self::hasWeakPathEvidence($left, $leftPath) || self::hasWeakPathEvidence($right, $rightPath)) {
            return 'unknown';
        }
        if (in_array($leftId, $rightPath, true)) {
            return 'left_ancestor';
        }
        if (in_array($rightId, $leftPath, true)) {
            return 'left_descendant';
        }
        return 'conflict';
    }

    public static function extractPathIds(array $taxon): array
    {
        $path = $taxon['full_path_ids'] ?? null;
        if (is_array($path) && !empty($path)) {
            return array_values(array_filter($path, fn($id) => $id !== null && $id !== ''));
        }

        $ancestryIds = $taxon['ancestry_ids'] ?? [];
        $selfId = $taxon['id'] ?? ($taxon['taxon_id'] ?? null);
        if (is_array($ancestryIds) && $selfId) {
            $path = array_values(array_filter(array_merge($ancestryIds, [$selfId]), fn($id) => $id !== null && $id !== ''));
            if (!empty($path)) {
                return $path;
            }
        }

        $lineage = $taxon['lineage'] ?? [];
        $rank = strtolower((string)($taxon['rank'] ?? ($taxon['taxon_rank'] ?? 'species')));
        $name = trim((string)($taxon['name'] ?? ($taxon['taxon_name'] ?? $taxon['scientific_name'] ?? '')));
        $fallback = [];
        foreach (self::RANK_ORDER as $lineageRank) {
            $value = trim((string)($lineage[$lineageRank] ?? ''));
            if ($value !== '') {
                $fallback[] = self::fallbackNodeId($lineageRank, $value);
            }
        }
        if ($name !== '') {
            $fallback[] = self::fallbackNodeId($rank, $name);
        }
        return array_values(array_unique($fallback));
    }

    private static function resolveBySlug(string $slug): ?array
    {
        $resolver = self::loadResolver();
        $entry = $resolver['taxa'][$slug] ?? null;
        if (!$entry) {
            return null;
        }

        if (!empty($entry['gbif_key'])) {
            $resolved = self::resolveByGbifKey((int)$entry['gbif_key']);
            if ($resolved !== null) {
                return self::applyInputHints(
                    $resolved,
                    (string)($entry['ja_name'] ?? ''),
                    (string)($entry['accepted_name'] ?? ''),
                    $slug,
                    strtolower((string)($entry['rank'] ?? 'species')),
                    [],
                    []
                );
            }
        }

        return [
            'taxon_id' => 'local:' . $slug,
            'provider' => 'local',
            'provider_id' => $slug,
            'key' => $entry['gbif_key'] ?? null,
            'gbif_key' => $entry['gbif_key'] ?? null,
            'inat_taxon_id' => null,
            'name' => $entry['ja_name'] ?? ($entry['accepted_name'] ?? $slug),
            'canonical_name' => $entry['ja_name'] ?? ($entry['accepted_name'] ?? $slug),
            'scientific_name' => $entry['accepted_name'] ?? '',
            'slug' => $slug,
            'rank' => strtolower((string)($entry['rank'] ?? 'species')),
            'lineage' => [],
            'lineage_ids' => [],
            'ancestry' => '',
            'ancestry_ids' => [],
            'full_path_ids' => ['local:' . $slug],
            'taxonomy_version' => self::VERSION,
            'thumbnail_url' => null,
        ];
    }

    private static function resolveByName(string $query): ?array
    {
        $results = TaxonSearchService::search($query, [
            'locale' => 'ja',
            'limit' => 5,
        ]);

        foreach ($results as $candidate) {
            $gbifKey = isset($candidate['gbif_key']) && $candidate['gbif_key'] !== '' ? (int)$candidate['gbif_key'] : null;
            if ($gbifKey !== null) {
                $resolved = self::resolveByGbifKey($gbifKey);
                if ($resolved !== null) {
                    return self::applyInputHints(
                        $resolved,
                        (string)($candidate['ja_name'] ?? ''),
                        (string)($candidate['scientific_name'] ?? ''),
                        (string)($candidate['slug'] ?? ''),
                        strtolower((string)($candidate['rank'] ?? 'species')),
                        is_array($candidate['lineage'] ?? null) ? $candidate['lineage'] : [],
                        is_array($candidate['lineage_ids'] ?? null) ? $candidate['lineage_ids'] : []
                    );
                }
            }

            $inatId = isset($candidate['inat_taxon_id']) && $candidate['inat_taxon_id'] !== '' ? (int)$candidate['inat_taxon_id'] : null;
            if ($inatId !== null) {
                $resolved = self::resolveByINatId($inatId);
                if ($resolved !== null) {
                    return self::applyInputHints(
                        $resolved,
                        (string)($candidate['ja_name'] ?? ''),
                        (string)($candidate['scientific_name'] ?? ''),
                        (string)($candidate['slug'] ?? ''),
                        strtolower((string)($candidate['rank'] ?? 'species')),
                        is_array($candidate['lineage'] ?? null) ? $candidate['lineage'] : [],
                        is_array($candidate['lineage_ids'] ?? null) ? $candidate['lineage_ids'] : []
                    );
                }
            }
        }

        return null;
    }

    private static function resolveByGbifKey(int $gbifKey): ?array
    {
        $cacheId = 'gbif:' . $gbifKey;
        $cached = self::getCacheItem($cacheId);
        if ($cached !== null) {
            return $cached;
        }

        $json = @file_get_contents('https://api.gbif.org/v1/species/' . $gbifKey);
        if ($json === false) {
            return null;
        }

        $data = json_decode($json, true);
        if (!is_array($data) || empty($data['key'])) {
            return null;
        }

        $resolved = self::buildGbifTaxon($data);
        self::setCacheItem($cacheId, $resolved);
        return $resolved;
    }

    private static function resolveByINatId(int $inatId): ?array
    {
        $cacheId = 'inat:' . $inatId;
        $cached = self::getCacheItem($cacheId);
        if ($cached !== null) {
            return $cached;
        }

        $json = @file_get_contents('https://api.inaturalist.org/v1/taxa/' . $inatId);
        if ($json === false) {
            return null;
        }

        $data = json_decode($json, true);
        $result = $data['results'][0] ?? null;
        if (!is_array($result) || empty($result['id'])) {
            return null;
        }

        $resolved = self::buildINatTaxon($result);
        self::setCacheItem($cacheId, $resolved);
        return $resolved;
    }

    private static function buildGbifTaxon(array $data): array
    {
        $rank = strtolower((string)($data['rank'] ?? 'species'));
        $lineage = array_filter([
            'kingdom' => $data['kingdom'] ?? null,
            'phylum' => $data['phylum'] ?? null,
            'class' => $data['class'] ?? null,
            'order' => $data['order'] ?? null,
            'family' => $data['family'] ?? null,
            'genus' => $data['genus'] ?? null,
        ]);
        $lineageIds = array_filter([
            'kingdom' => isset($data['kingdomKey']) ? 'gbif:' . $data['kingdomKey'] : null,
            'phylum' => isset($data['phylumKey']) ? 'gbif:' . $data['phylumKey'] : null,
            'class' => isset($data['classKey']) ? 'gbif:' . $data['classKey'] : null,
            'order' => isset($data['orderKey']) ? 'gbif:' . $data['orderKey'] : null,
            'family' => isset($data['familyKey']) ? 'gbif:' . $data['familyKey'] : null,
            'genus' => isset($data['genusKey']) ? 'gbif:' . $data['genusKey'] : null,
        ]);

        $selfId = 'gbif:' . $data['key'];
        $fullPathIds = array_values(array_unique(array_merge(array_values($lineageIds), [$selfId])));
        $ancestryIds = array_values(array_filter($fullPathIds, fn($id) => $id !== $selfId));

        return [
            'taxon_id' => $selfId,
            'provider' => 'gbif',
            'provider_id' => $data['key'],
            'key' => $data['key'],
            'gbif_key' => $data['key'],
            'inat_taxon_id' => null,
            'name' => $data['canonicalName'] ?? ($data['scientificName'] ?? ''),
            'canonical_name' => $data['canonicalName'] ?? ($data['scientificName'] ?? ''),
            'scientific_name' => $data['canonicalName'] ?? ($data['scientificName'] ?? ''),
            'slug' => self::makeSlug((string)($data['canonicalName'] ?? $data['scientificName'] ?? '')),
            'rank' => $rank,
            'lineage' => $lineage,
            'lineage_ids' => $lineageIds,
            'ancestry' => implode('/', $ancestryIds),
            'ancestry_ids' => $ancestryIds,
            'full_path_ids' => $fullPathIds,
            'taxonomy_version' => self::VERSION,
            'thumbnail_url' => null,
        ];
    }

    private static function buildINatTaxon(array $result): array
    {
        $rank = strtolower((string)($result['rank'] ?? 'species'));
        $lineage = [];
        $lineageIds = [];
        foreach (($result['ancestors'] ?? []) as $ancestor) {
            $ancestorRank = strtolower((string)($ancestor['rank'] ?? ''));
            if (!in_array($ancestorRank, self::RANK_ORDER, true)) {
                continue;
            }
            $lineage[$ancestorRank] = $ancestor['name'] ?? '';
            if (!empty($ancestor['id'])) {
                $lineageIds[$ancestorRank] = 'inat:' . $ancestor['id'];
            }
        }

        $selfId = 'inat:' . $result['id'];
        $fullPathIds = array_values(array_unique(array_merge(array_values($lineageIds), [$selfId])));
        $ancestryIds = array_values(array_filter($fullPathIds, fn($id) => $id !== $selfId));

        return [
            'taxon_id' => $selfId,
            'provider' => 'inat',
            'provider_id' => $result['id'],
            'key' => null,
            'gbif_key' => null,
            'inat_taxon_id' => $result['id'],
            'name' => $result['preferred_common_name'] ?? ($result['name'] ?? ''),
            'canonical_name' => $result['preferred_common_name'] ?? ($result['name'] ?? ''),
            'scientific_name' => $result['name'] ?? '',
            'slug' => self::makeSlug((string)($result['name'] ?? '')),
            'rank' => $rank,
            'lineage' => $lineage,
            'lineage_ids' => $lineageIds,
            'ancestry' => implode('/', $ancestryIds),
            'ancestry_ids' => $ancestryIds,
            'full_path_ids' => $fullPathIds,
            'taxonomy_version' => self::VERSION,
            'thumbnail_url' => $result['default_photo']['square_url'] ?? null,
        ];
    }

    private static function buildLegacyTaxon(
        string $seedName,
        string $seedScientific,
        string $seedSlug,
        string $seedRank,
        array $seedLineage,
        array $seedLineageIds,
        array $input
    ): array {
        $baseName = $seedName !== '' ? $seedName : ($seedScientific !== '' ? $seedScientific : 'Unresolved taxon');
        $baseId = trim((string)($input['taxon_key'] ?? '')) !== ''
            ? 'legacy:' . trim((string)$input['taxon_key'])
            : ($seedSlug !== '' ? 'local:' . $seedSlug : 'text:' . md5($baseName . '|' . $seedScientific));

        $lineage = array_filter($seedLineage, fn($value) => trim((string)$value) !== '');
        $normalizedLineageIds = [];
        foreach ($seedLineageIds as $rank => $value) {
            $value = trim((string)$value);
            if ($value !== '') {
                $normalizedLineageIds[$rank] = str_contains($value, ':') ? $value : 'legacy:' . $value;
            }
        }

        $fallbackPath = [];
        foreach (self::RANK_ORDER as $rank) {
            if (!empty($normalizedLineageIds[$rank])) {
                $fallbackPath[] = $normalizedLineageIds[$rank];
                continue;
            }
            if (!empty($lineage[$rank])) {
                $fallbackPath[] = self::fallbackNodeId($rank, (string)$lineage[$rank]);
            }
        }
        $fullPathIds = array_values(array_unique(array_merge($fallbackPath, [$baseId])));
        $ancestryIds = array_values(array_filter($fullPathIds, fn($id) => $id !== $baseId));

        return [
            'taxon_id' => $baseId,
            'provider' => str_starts_with($baseId, 'local:') ? 'local' : 'legacy',
            'provider_id' => $seedSlug !== '' ? $seedSlug : $baseId,
            'key' => is_numeric($input['taxon_key'] ?? null) ? (int)$input['taxon_key'] : null,
            'gbif_key' => is_numeric($input['taxon_key'] ?? null) ? (int)$input['taxon_key'] : null,
            'inat_taxon_id' => self::extractINatId($input),
            'name' => $baseName,
            'canonical_name' => $baseName,
            'scientific_name' => $seedScientific,
            'slug' => $seedSlug !== '' ? $seedSlug : self::makeSlug($baseName),
            'rank' => $seedRank !== '' ? $seedRank : 'species',
            'lineage' => $lineage,
            'lineage_ids' => $normalizedLineageIds,
            'ancestry' => implode('/', $ancestryIds),
            'ancestry_ids' => $ancestryIds,
            'full_path_ids' => $fullPathIds,
            'taxonomy_version' => self::VERSION,
            'thumbnail_url' => null,
        ];
    }

    private static function applyInputHints(
        array $resolved,
        string $seedName,
        string $seedScientific,
        string $seedSlug,
        string $seedRank,
        array $seedLineage,
        array $seedLineageIds
    ): array {
        if ($seedName !== '') {
            $resolved['name'] = $seedName;
        }
        if ($resolved['canonical_name'] === '' && $resolved['name'] !== '') {
            $resolved['canonical_name'] = $resolved['name'];
        }
        if ($seedScientific !== '' && $resolved['scientific_name'] === '') {
            $resolved['scientific_name'] = $seedScientific;
        }
        if ($seedSlug !== '') {
            $resolved['slug'] = $seedSlug;
        }
        if ($seedRank !== '' && ($resolved['rank'] ?? '') === '') {
            $resolved['rank'] = $seedRank;
        }

        foreach ($seedLineage as $rank => $value) {
            $value = trim((string)$value);
            if ($value !== '' && empty($resolved['lineage'][$rank])) {
                $resolved['lineage'][$rank] = $value;
            }
        }
        foreach ($seedLineageIds as $rank => $value) {
            $value = trim((string)$value);
            if ($value !== '' && empty($resolved['lineage_ids'][$rank])) {
                $resolved['lineage_ids'][$rank] = str_contains($value, ':') ? $value : 'legacy:' . $value;
            }
        }

        $path = self::extractPathIds([
            'full_path_ids' => $resolved['full_path_ids'] ?? [],
            'ancestry_ids' => $resolved['ancestry_ids'] ?? [],
            'id' => $resolved['taxon_id'] ?? null,
            'lineage' => $resolved['lineage'] ?? [],
            'rank' => $resolved['rank'] ?? 'species',
            'name' => $resolved['name'] ?? '',
        ]);
        $resolved['full_path_ids'] = $path;
        $resolved['ancestry_ids'] = array_values(array_filter($path, fn($id) => $id !== ($resolved['taxon_id'] ?? null)));
        $resolved['ancestry'] = implode('/', $resolved['ancestry_ids']);

        foreach (self::RANK_ORDER as $rank) {
            if (isset($resolved['lineage'][$rank])) {
                $resolved[$rank] = $resolved['lineage'][$rank];
            }
        }

        return $resolved;
    }

    private static function loadResolver(): array
    {
        return DataStore::get('taxon_resolver', 86400);
    }

    private static function getCacheItem(string $cacheId): ?array
    {
        $cache = DataStore::get(self::CACHE_FILE, 86400);
        $item = $cache[$cacheId] ?? null;
        return is_array($item) ? $item : null;
    }

    private static function setCacheItem(string $cacheId, array $value): void
    {
        $cache = DataStore::get(self::CACHE_FILE, 86400);
        $cache[$cacheId] = $value;
        DataStore::save(self::CACHE_FILE, $cache);
    }

    private static function extractGbifKey(array $input): ?int
    {
        foreach (['taxon_key', 'gbif_key', 'key'] as $field) {
            $value = $input[$field] ?? null;
            if ($value === null || $value === '') {
                continue;
            }
            if (is_string($value) && str_starts_with($value, 'gbif:')) {
                $value = substr($value, 5);
            }
            if (is_numeric($value)) {
                return (int)$value;
            }
        }
        return null;
    }

    private static function extractINatId(array $input): ?int
    {
        foreach (['inat_taxon_id', 'provider_id'] as $field) {
            $value = $input[$field] ?? null;
            if ($value === null || $value === '') {
                continue;
            }
            if (is_string($value) && str_starts_with($value, 'inat:')) {
                $value = substr($value, 5);
            }
            if (is_numeric($value)) {
                return (int)$value;
            }
        }
        return null;
    }

    private static function makeSlug(string $name): string
    {
        $slug = strtolower(trim($name));
        $slug = preg_replace('/[^a-z0-9\s\-]/', '', $slug);
        $slug = preg_replace('/\s+/', '-', $slug);
        return $slug ?: 'taxon-' . substr(md5($name), 0, 12);
    }

    private static function fallbackNodeId(string $rank, string $name): string
    {
        return 'name:' . strtolower($rank) . ':' . md5(mb_strtolower(trim($name)));
    }

    private static function hasWeakPathEvidence(array $taxon, array $path): bool
    {
        if (count($path) > 1) {
            return false;
        }

        $hasStructuredLineage = !empty($taxon['lineage_ids']) || !empty($taxon['ancestry_ids']) || !empty($taxon['lineage']);
        return !$hasStructuredLineage;
    }
}
