<?php

require_once __DIR__ . '/CanonicalBootstrap.php';
require_once __DIR__ . '/CanonicalStore.php';
require_once __DIR__ . '/CanonicalObservationWriter.php';
require_once __DIR__ . '/ConsensusEngine.php';
require_once __DIR__ . '/AuditLog.php';
require_once __DIR__ . '/PrivacyFilter.php';

class CanonicalObservationUpdater
{
    public static function syncEditableState(array $observation, string $actorId = 'system:update_path'): array
    {
        CanonicalBootstrap::ensureSchema();

        $binding = self::ensureBinding($observation);
        if (!empty($binding['skipped'])) {
            return $binding;
        }

        $aggregate = $binding['aggregate'];
        $event = is_array($aggregate['event'] ?? null) ? $aggregate['event'] : [];
        $occurrence = is_array($aggregate['occurrence'] ?? null) ? $aggregate['occurrence'] : [];
        if ($event === [] || $occurrence === []) {
            return [
                'skipped' => true,
                'skip_reason' => 'missing_canonical_binding',
            ];
        }

        $placeContext = CanonicalStore::derivePlaceContext([
            'event_date' => $observation['observed_at'] ?? $observation['created_at'] ?? date('c'),
            'decimal_latitude' => $observation['lat'] ?? null,
            'decimal_longitude' => $observation['lng'] ?? null,
            'country' => $observation['country'] ?? null,
            'prefecture' => $observation['prefecture'] ?? null,
            'municipality' => $observation['municipality'] ?? null,
            'site_id' => $observation['site_id'] ?? null,
            'site_name' => $observation['site_name'] ?? null,
            'locality_label' => $observation['site_name'] ?? ($observation['municipality'] ?? null),
        ]);
        $placeId = CanonicalStore::upsertPlace($placeContext);

        $taxon = is_array($observation['taxon'] ?? null) ? $observation['taxon'] : [];
        CanonicalStore::updateEvent((string)$event['event_id'], [
            'event_date' => $observation['observed_at'] ?? $event['event_date'] ?? date('c'),
            'decimal_latitude' => $observation['lat'] ?? null,
            'decimal_longitude' => $observation['lng'] ?? null,
            'coordinate_uncertainty_m' => $observation['coordinate_accuracy'] ?? ($observation['location_uncertainty_m'] ?? null),
            'uncertainty_type' => !empty($observation['coordinate_accuracy']) || !empty($observation['location_uncertainty_m'])
                ? 'measured'
                : 'device_default',
            'place_id' => $placeId,
            'locality_label' => $placeContext['locality_label'],
            'locality_context' => [
                'country' => $observation['country'] ?? null,
                'prefecture' => $observation['prefecture'] ?? null,
                'municipality' => $observation['municipality'] ?? null,
                'archive_track' => $observation['archive_track'] ?? null,
            ],
        ]);

        CanonicalStore::updateOccurrence((string)$occurrence['occurrence_id'], [
            'scientific_name' => $taxon['scientific_name'] ?? ($observation['scientific_name'] ?? ($occurrence['scientific_name'] ?? null)),
            'vernacular_name' => $taxon['name'] ?? ($observation['species_name'] ?? ($occurrence['vernacular_name'] ?? null)),
            'taxon_rank' => $taxon['rank'] ?? ($occurrence['taxon_rank'] ?? 'species'),
            'individual_count' => $observation['individual_count'] ?? null,
            'data_quality' => $observation['data_quality'] ?? ($occurrence['data_quality'] ?? 'C'),
        ]);

        CanonicalStore::setPrivacyAccess((string)$occurrence['occurrence_id'], [
            'coordinate_precision' => $observation['location_granularity'] ?? 'exact',
            'access_tier' => ($observation['location_granularity'] ?? 'exact') === 'hidden' ? 'restricted' : 'public',
            'legal_basis' => 'user_submission',
            'sensitive_species' => PrivacyFilter::isProtectedSpecies((string)($taxon['name'] ?? '')) ? 1 : 0,
        ]);

        CanonicalStore::addPlaceConditionLog([
            'place_id' => $placeId,
            'event_id' => (string)$event['event_id'],
            'observed_at' => $observation['observed_at'] ?? $observation['created_at'] ?? date('c'),
            'biome' => $observation['biome'] ?? null,
            'cultivation' => $observation['cultivation'] ?? null,
            'organism_origin' => $observation['organism_origin'] ?? null,
            'managed_context_type' => $observation['managed_context']['type'] ?? null,
            'managed_site_name' => $observation['managed_context']['site_name'] ?? null,
            'locality_note' => $observation['note'] ?? null,
            'environment_summary' => self::buildEnvironmentSummary($observation),
            'metadata' => [
                'sync_source' => 'update_observation',
                'managed_context_note' => $observation['managed_context']['note'] ?? null,
            ],
        ]);
        CanonicalStore::refreshPlaceStats($placeId);

        AuditLog::log(
            AuditLog::ACTION_SYNC,
            $actorId,
            (string)$occurrence['occurrence_id'],
            (string)$event['event_id'],
            null,
            null,
            [
                'source' => 'update_observation',
                'original_observation_id' => $observation['id'] ?? null,
                'place_id' => $placeId,
            ]
        );

        return [
            'skipped' => false,
            'event_id' => (string)$event['event_id'],
            'occurrence_id' => (string)$occurrence['occurrence_id'],
            'place_id' => $placeId,
        ];
    }

    public static function appendIdentification(array $observation, array $identification, array $actor): array
    {
        CanonicalBootstrap::ensureSchema();

        $binding = self::ensureBinding($observation);
        if (!empty($binding['skipped'])) {
            return $binding;
        }

        $aggregate = $binding['aggregate'];
        $occurrence = is_array($aggregate['occurrence'] ?? null) ? $aggregate['occurrence'] : [];
        $event = is_array($aggregate['event'] ?? null) ? $aggregate['event'] : [];
        if ($occurrence === []) {
            return [
                'skipped' => true,
                'skip_reason' => 'missing_canonical_occurrence',
            ];
        }

        $identifiedBy = (string)($identification['user_id'] ?? ($actor['id'] ?? 'unknown'));
        $taxonName = (string)($identification['scientific_name'] ?? $identification['taxon_name'] ?? '');
        if ($taxonName === '') {
            return [
                'skipped' => true,
                'skip_reason' => 'missing_taxon_name',
                'occurrence_id' => (string)$occurrence['occurrence_id'],
            ];
        }

        CanonicalStore::addIdentification([
            'occurrence_id' => (string)$occurrence['occurrence_id'],
            'identified_by' => $identifiedBy,
            'taxon_name' => $taxonName,
            'identification_method' => (string)($identification['evidence']['type'] ?? 'visual'),
            'confidence' => self::normalizeConfidence($identification['confidence'] ?? null),
            'reviewer_level' => self::reviewerLevelFromActor($actor),
            'notes' => (string)($identification['note'] ?? ''),
        ]);

        $consensus = ConsensusEngine::applyConsensus((string)$occurrence['occurrence_id']);

        AuditLog::log(
            AuditLog::ACTION_IDENTIFICATION,
            $identifiedBy,
            (string)$occurrence['occurrence_id'],
            (string)($event['event_id'] ?? null),
            null,
            $taxonName,
            [
                'source' => 'post_identification',
                'original_observation_id' => $observation['id'] ?? null,
                'reviewer_level' => self::reviewerLevelFromActor($actor),
            ]
        );

        return [
            'skipped' => false,
            'occurrence_id' => (string)$occurrence['occurrence_id'],
            'event_id' => (string)($event['event_id'] ?? null),
            'consensus' => $consensus,
        ];
    }

    private static function ensureBinding(array $observation): array
    {
        $originalId = (string)($observation['id'] ?? '');
        if ($originalId === '') {
            return [
                'skipped' => true,
                'skip_reason' => 'missing_observation_id',
            ];
        }

        $aggregate = CanonicalStore::getObservationAggregateByOriginalObservationId($originalId);
        if ($aggregate === null) {
            $writerResult = CanonicalObservationWriter::writeFromObservation($observation);
            if (!empty($writerResult['skipped'])) {
                return $writerResult;
            }
            $aggregate = CanonicalStore::getObservationAggregateByOriginalObservationId($originalId);
        }

        if ($aggregate === null) {
            return [
                'skipped' => true,
                'skip_reason' => 'canonical_backfill_failed',
            ];
        }

        return [
            'skipped' => false,
            'aggregate' => $aggregate,
        ];
    }

    private static function buildEnvironmentSummary(array $observation): ?string
    {
        $parts = [];
        if (!empty($observation['biome']) && $observation['biome'] !== 'unknown') {
            $parts[] = 'biome:' . $observation['biome'];
        }
        if (!empty($observation['managed_context']['type'])) {
            $parts[] = 'managed:' . $observation['managed_context']['type'];
        }
        if (!empty($observation['organism_origin'])) {
            $parts[] = 'origin:' . $observation['organism_origin'];
        }
        if (!empty($observation['life_stage']) && $observation['life_stage'] !== 'unknown') {
            $parts[] = 'life_stage:' . $observation['life_stage'];
        }

        return $parts === [] ? null : implode(' | ', $parts);
    }

    private static function reviewerLevelFromActor(array $actor): string
    {
        $role = strtolower((string)($actor['role'] ?? ''));
        if (in_array($role, ['admin', 'specialist'], true)) {
            return 'expert';
        }
        return 'community';
    }

    private static function normalizeConfidence(mixed $confidence): ?float
    {
        if (is_numeric($confidence)) {
            return max(0.0, min(1.0, (float)$confidence));
        }

        $map = [
            'sure' => 1.0,
            'likely' => 0.75,
            'maybe' => 0.5,
            'literature' => 0.6,
        ];
        $key = strtolower(trim((string)$confidence));
        return $map[$key] ?? null;
    }
}
