<?php

require_once __DIR__ . '/Auth.php';
require_once __DIR__ . '/ManagedSiteRegistry.php';
require_once __DIR__ . '/TrustLevel.php';

class ObservationMeta
{
    public const STALE_DAYS = 30;
    public const AUTO_ACCEPT_SUPPORT_WEIGHT = 2.5;
    public const AUTO_ACCEPT_SUPPORTERS = 2;

    public const PROPOSABLE_FIELDS = [
        'biome',
        'organism_origin',
        'managed_context_type',
        'managed_site_name',
        'managed_context_note',
        'life_stage',
    ];

    public static function canEditObservation(array $observation, ?array $user): bool
    {
        if (!$user) {
            return false;
        }

        if ((string)($observation['user_id'] ?? '') === (string)($user['id'] ?? '')) {
            return true;
        }

        return Auth::hasRole('Admin');
    }

    public static function canDirectlyModerateMetadata(?array $user): bool
    {
        if (!$user) {
            return false;
        }

        return Auth::hasRole('Specialist');
    }

    public static function canReviewMetadataProposals(array $observation, ?array $user): bool
    {
        return self::canEditObservation($observation, $user) || self::canDirectlyModerateMetadata($user);
    }

    public static function isStaleObservation(array $observation): bool
    {
        $base = (string)($observation['updated_at'] ?? $observation['created_at'] ?? '');
        if ($base === '') {
            return false;
        }
        $timestamp = strtotime($base);
        if (!$timestamp) {
            return false;
        }
        return $timestamp <= strtotime('-' . self::STALE_DAYS . ' days');
    }

    public static function normalizeEditableInput(array $input, array $existingObservation): array
    {
        $observedAt = trim((string)($input['observed_at'] ?? ($existingObservation['observed_at'] ?? '')));
        $lat = self::normalizeFloat($input['lat'] ?? ($existingObservation['lat'] ?? null));
        $lng = self::normalizeFloat($input['lng'] ?? ($existingObservation['lng'] ?? null));
        $biome = self::normalizeBiome($input['biome'] ?? ($existingObservation['biome'] ?? 'unknown'));
        $lifeStage = self::normalizeLifeStage($input['life_stage'] ?? ($existingObservation['life_stage'] ?? 'unknown'));
        $individualCount = self::normalizeIndividualCount($input['individual_count'] ?? ($existingObservation['individual_count'] ?? null));
        $cultivation = self::normalizeCultivation($input['cultivation'] ?? ($existingObservation['cultivation'] ?? 'wild'));
        $context = ManagedSiteRegistry::normalizeObservationContext([
            'organism_origin' => $input['organism_origin'] ?? ($existingObservation['organism_origin'] ?? ''),
            'cultivation' => $cultivation,
            'managed_context_type' => $input['managed_context_type'] ?? ($existingObservation['managed_context']['type'] ?? null),
            'managed_site_id' => $input['managed_site_id'] ?? ($existingObservation['managed_context']['site_id'] ?? null),
            'managed_site_name' => $input['managed_site_name'] ?? ($existingObservation['managed_context']['site_name'] ?? null),
            'managed_context_note' => $input['managed_context_note'] ?? ($existingObservation['managed_context']['note'] ?? null),
        ]);

        return [
            'observed_at' => $observedAt !== '' ? $observedAt : ($existingObservation['observed_at'] ?? date('Y-m-d H:i:s')),
            'lat' => $lat,
            'lng' => $lng,
            'biome' => $biome,
            'life_stage' => $lifeStage,
            'individual_count' => $individualCount,
            'cultivation' => $cultivation,
            'organism_origin' => $context['organism_origin'],
            'managed_context' => $context['managed_context'],
            'note' => mb_substr(trim((string)($input['note'] ?? ($existingObservation['note'] ?? ''))), 0, 1000),
        ];
    }

    public static function extractProposableChanges(array $input, array $existingObservation): array
    {
        $normalized = self::normalizeEditableInput($input, $existingObservation);
        $changes = [];

        foreach ([
            'biome',
            'organism_origin',
            'life_stage',
            'individual_count',
        ] as $field) {
            if (($normalized[$field] ?? null) !== ($existingObservation[$field] ?? null)) {
                $changes[$field] = [
                    'from' => $existingObservation[$field] ?? null,
                    'to' => $normalized[$field] ?? null,
                ];
            }
        }

        $existingContext = is_array($existingObservation['managed_context'] ?? null) ? $existingObservation['managed_context'] : [];
        foreach ([
            'type' => 'managed_context_type',
            'site_name' => 'managed_site_name',
            'note' => 'managed_context_note',
        ] as $contextKey => $publicField) {
            if (($normalized['managed_context'][$contextKey] ?? null) !== ($existingContext[$contextKey] ?? null)) {
                $changes[$publicField] = [
                    'from' => $existingContext[$contextKey] ?? null,
                    'to' => $normalized['managed_context'][$contextKey] ?? null,
                ];
            }
        }

        return $changes;
    }

    public static function applyDirectEdit(array &$observation, array $normalizedInput, array $actor, string $note = ''): bool
    {
        $before = self::snapshotEditableFields($observation);

        $observation['observed_at'] = $normalizedInput['observed_at'];
        $observation['lat'] = $normalizedInput['lat'];
        $observation['lng'] = $normalizedInput['lng'];
        $observation['biome'] = $normalizedInput['biome'];
        $observation['life_stage'] = $normalizedInput['life_stage'];
        $observation['individual_count'] = $normalizedInput['individual_count'];
        $observation['cultivation'] = $normalizedInput['cultivation'];
        $observation['organism_origin'] = $normalizedInput['organism_origin'];
        $observation['managed_context'] = $normalizedInput['managed_context'];
        $observation['archive_track'] = ManagedSiteRegistry::isWildLike($normalizedInput['organism_origin']) ? 'wild_occurrence' : 'managed_collection';
        $observation['note'] = $normalizedInput['note'];
        $observation['updated_at'] = date('Y-m-d H:i:s');

        $after = self::snapshotEditableFields($observation);
        if (($before['biome'] ?? null) !== ($after['biome'] ?? null)) {
            $observation['biome_meta'] = [
                'auto_selected' => false,
                'source' => 'manual_edit',
                'reason' => 'manual_update',
                'updated_at' => date('c'),
            ];
        }
        if ($before === $after) {
            return false;
        }

        $observation['edit_log'] = is_array($observation['edit_log'] ?? null) ? $observation['edit_log'] : [];
        $observation['edit_log'][] = [
            'id' => 'edit-' . substr(bin2hex(random_bytes(8)), 0, 12),
            'type' => 'direct_edit',
            'actor_id' => (string)($actor['id'] ?? ''),
            'actor_name' => (string)($actor['name'] ?? ''),
            'at' => date('c'),
            'note' => mb_substr(trim($note), 0, 280),
            'before' => $before,
            'after' => $after,
        ];

        return true;
    }

    public static function addMetadataProposal(array &$observation, array $changes, array $actor, string $note = ''): bool
    {
        if ($changes === []) {
            return false;
        }

        $observation['metadata_proposals'] = is_array($observation['metadata_proposals'] ?? null) ? $observation['metadata_proposals'] : [];
        $observation['metadata_proposals'][] = [
            'id' => 'proposal-' . substr(bin2hex(random_bytes(8)), 0, 12),
            'status' => 'pending',
            'actor_id' => (string)($actor['id'] ?? ''),
            'actor_name' => (string)($actor['name'] ?? ''),
            'actor_role' => Auth::getRole($actor),
            'at' => date('c'),
            'changes' => $changes,
            'note' => mb_substr(trim($note), 0, 280),
        ];
        $observation['updated_at'] = date('Y-m-d H:i:s');

        return true;
    }

    public static function reviewMetadataProposal(array &$observation, string $proposalId, string $action, array $actor, string $note = ''): bool
    {
        if (!in_array($action, ['accept', 'reject'], true)) {
            return false;
        }

        $proposals = is_array($observation['metadata_proposals'] ?? null) ? $observation['metadata_proposals'] : [];
        foreach ($proposals as $index => $proposal) {
            if ((string)($proposal['id'] ?? '') !== $proposalId) {
                continue;
            }
            if (($proposal['status'] ?? 'pending') !== 'pending') {
                return false;
            }

            $before = self::snapshotEditableFields($observation);
            if ($action === 'accept') {
                self::applyProposalChanges($observation, (array)($proposal['changes'] ?? []));
                $observation['updated_at'] = date('Y-m-d H:i:s');
            }

            $proposals[$index]['status'] = $action === 'accept' ? 'accepted' : 'rejected';
            $proposals[$index]['resolved_at'] = date('c');
            $proposals[$index]['resolved_by'] = (string)($actor['id'] ?? '');
            $proposals[$index]['resolved_by_name'] = (string)($actor['name'] ?? '');
            $proposals[$index]['resolution_note'] = mb_substr(trim($note), 0, 280);
            $observation['metadata_proposals'] = $proposals;

            $after = self::snapshotEditableFields($observation);
            $observation['edit_log'] = is_array($observation['edit_log'] ?? null) ? $observation['edit_log'] : [];
            $observation['edit_log'][] = [
                'id' => 'edit-' . substr(bin2hex(random_bytes(8)), 0, 12),
                'type' => $action === 'accept' ? 'metadata_proposal_accepted' : 'metadata_proposal_rejected',
                'proposal_id' => $proposalId,
                'actor_id' => (string)($actor['id'] ?? ''),
                'actor_name' => (string)($actor['name'] ?? ''),
                'at' => date('c'),
                'note' => mb_substr(trim($note), 0, 280),
                'before' => $before,
                'after' => $after,
                'changes' => $proposal['changes'] ?? [],
            ];

            return true;
        }

        return false;
    }

    public static function supportMetadataProposal(array &$observation, string $proposalId, array $actor): array
    {
        $proposals = is_array($observation['metadata_proposals'] ?? null) ? $observation['metadata_proposals'] : [];
        foreach ($proposals as $index => $proposal) {
            if ((string)($proposal['id'] ?? '') !== $proposalId) {
                continue;
            }
            if (($proposal['status'] ?? 'pending') !== 'pending') {
                return ['changed' => false, 'reason' => 'resolved'];
            }

            $supporters = is_array($proposal['supporters'] ?? null) ? $proposal['supporters'] : [];
            foreach ($supporters as $supporter) {
                if ((string)($supporter['user_id'] ?? '') === (string)($actor['id'] ?? '')) {
                    return ['changed' => false, 'reason' => 'duplicate'];
                }
            }

            if ((string)($proposal['actor_id'] ?? '') === (string)($actor['id'] ?? '')) {
                return ['changed' => false, 'reason' => 'self'];
            }

            $supporters[] = [
                'user_id' => (string)($actor['id'] ?? ''),
                'user_name' => (string)($actor['name'] ?? ''),
                'trust_level' => TrustLevel::calculate((string)($actor['id'] ?? '')),
                'weight' => TrustLevel::getWeight((string)($actor['id'] ?? '')),
                'at' => date('c'),
            ];
            $proposals[$index]['supporters'] = $supporters;
            $observation['metadata_proposals'] = $proposals;
            $observation['updated_at'] = date('Y-m-d H:i:s');

            $summary = self::getProposalSupportSummary($proposals[$index], $observation);
            if ($summary['eligible_for_auto_accept']) {
                self::reviewMetadataProposal($observation, $proposalId, 'accept', [
                    'id' => 'community-auto',
                    'name' => 'community-auto',
                ], 'community_support_auto_accept');
                return ['changed' => true, 'reason' => 'auto_accepted', 'summary' => $summary];
            }

            return ['changed' => true, 'reason' => 'supported', 'summary' => $summary];
        }

        return ['changed' => false, 'reason' => 'missing'];
    }

    public static function getProposalSupportSummary(array $proposal, array $observation): array
    {
        $supporters = is_array($proposal['supporters'] ?? null) ? $proposal['supporters'] : [];
        $supportCount = count($supporters);
        $supportWeight = 0.0;
        foreach ($supporters as $supporter) {
            $supportWeight += (float)($supporter['weight'] ?? 0);
        }

        $authorId = (string)($proposal['actor_id'] ?? '');
        $authorWeight = $authorId !== '' ? TrustLevel::getWeight($authorId) : 0.0;
        $totalPeople = $supportCount + ($authorId !== '' ? 1 : 0);
        $totalWeight = $supportWeight + $authorWeight;
        $isStale = self::isStaleObservation($observation);
        $neededPeople = max(0, self::AUTO_ACCEPT_SUPPORTERS - $totalPeople);
        $neededWeight = max(0, self::AUTO_ACCEPT_SUPPORT_WEIGHT - $totalWeight);

        return [
            'support_count' => $supportCount,
            'support_weight' => $supportWeight,
            'author_weight' => $authorWeight,
            'total_people' => $totalPeople,
            'total_weight' => $totalWeight,
            'is_stale' => $isStale,
            'eligible_for_auto_accept' => $isStale
                && $totalPeople >= self::AUTO_ACCEPT_SUPPORTERS
                && $totalWeight >= self::AUTO_ACCEPT_SUPPORT_WEIGHT,
            'needed_people' => $neededPeople,
            'needed_weight' => $neededWeight,
        ];
    }

    public static function snapshotEditableFields(array $observation): array
    {
        $managedContext = is_array($observation['managed_context'] ?? null) ? $observation['managed_context'] : [];
        return [
            'observed_at' => $observation['observed_at'] ?? null,
            'lat' => $observation['lat'] ?? null,
            'lng' => $observation['lng'] ?? null,
            'note' => $observation['note'] ?? null,
            'biome' => $observation['biome'] ?? 'unknown',
            'life_stage' => $observation['life_stage'] ?? 'unknown',
            'individual_count' => $observation['individual_count'] ?? null,
            'cultivation' => $observation['cultivation'] ?? 'wild',
            'organism_origin' => $observation['organism_origin'] ?? 'wild',
            'managed_context_type' => $managedContext['type'] ?? null,
            'managed_site_name' => $managedContext['site_name'] ?? null,
            'managed_context_note' => $managedContext['note'] ?? null,
        ];
    }

    private static function normalizeFloat(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (!is_numeric($value)) {
            return null;
        }
        return round((float)$value, 7);
    }

    private static function normalizeBiome(mixed $value): string
    {
        $value = trim((string)$value);
        $allowed = ['unknown', 'forest', 'grassland', 'wetland', 'coastal', 'urban', 'farmland'];
        return in_array($value, $allowed, true) ? $value : 'unknown';
    }

    private static function normalizeLifeStage(mixed $value): string
    {
        $value = trim((string)$value);
        $allowed = ['unknown', 'adult', 'juvenile', 'egg', 'trace', 'larva', 'pupa', 'exuviae'];
        return in_array($value, $allowed, true) ? $value : 'unknown';
    }

    private static function normalizeIndividualCount(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $value = (int)$value;
        return in_array($value, [1, 3, 8, 30, 51], true) ? $value : null;
    }

    private static function normalizeCultivation(mixed $value): string
    {
        $value = trim((string)$value);
        return in_array($value, ['wild', 'cultivated'], true) ? $value : 'wild';
    }

    private static function applyProposalChanges(array &$observation, array $changes): void
    {
        $managedContext = is_array($observation['managed_context'] ?? null) ? $observation['managed_context'] : [];

        foreach ($changes as $field => $change) {
            $to = $change['to'] ?? null;
            switch ($field) {
                case 'biome':
                    $observation['biome'] = self::normalizeBiome($to);
                    break;
                case 'organism_origin':
                    $observation['organism_origin'] = trim((string)$to) !== '' ? (string)$to : 'wild';
                    break;
                case 'life_stage':
                    $observation['life_stage'] = self::normalizeLifeStage($to);
                    break;
                case 'individual_count':
                    $observation['individual_count'] = self::normalizeIndividualCount($to);
                    break;
                case 'managed_context_type':
                    $managedContext['type'] = trim((string)$to) !== '' ? (string)$to : null;
                    break;
                case 'managed_site_name':
                    $managedContext['site_name'] = trim((string)$to) !== '' ? (string)$to : null;
                    break;
                case 'managed_context_note':
                    $managedContext['note'] = trim((string)$to) !== '' ? (string)$to : null;
                    break;
            }
        }

        $observation['managed_context'] = $managedContext;
        $observation['archive_track'] = ManagedSiteRegistry::isWildLike((string)($observation['organism_origin'] ?? 'wild'))
            ? 'wild_occurrence'
            : 'managed_collection';
        if (array_key_exists('biome', $changes)) {
            $observation['biome_meta'] = [
                'auto_selected' => false,
                'source' => 'community_update',
                'reason' => 'community_review',
                'updated_at' => date('c'),
            ];
        }
    }
}
