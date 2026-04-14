<?php

require_once __DIR__ . '/CanonicalBootstrap.php';
require_once __DIR__ . '/CanonicalStore.php';
require_once __DIR__ . '/AuditLog.php';
require_once __DIR__ . '/PrivacyFilter.php';
require_once __DIR__ . '/CanonicalObservationGuard.php';

class CanonicalObservationWriter
{
    public static function writeFromObservation(array $observation): array
    {
        CanonicalBootstrap::ensureSchema();

        $originalId = (string)($observation['id'] ?? '');
        if ($originalId === '') {
            throw new InvalidArgumentException('Observation id is required.');
        }

        $guardDecision = CanonicalObservationGuard::shouldSkip($observation);
        if ($guardDecision !== null) {
            return [
                'event_id' => null,
                'occurrence_id' => null,
                'place_id' => null,
                'skipped' => true,
                'skip_reason' => $guardDecision['reason'],
            ];
        }

        $existing = CanonicalStore::findOccurrenceByOriginalObservationId($originalId);
        if ($existing !== null) {
            return $existing + ['skipped' => true];
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

        $eventId = CanonicalStore::createEvent([
            'event_date' => $observation['observed_at'] ?? $observation['created_at'] ?? date('c'),
            'decimal_latitude' => $observation['lat'] ?? null,
            'decimal_longitude' => $observation['lng'] ?? null,
            'coordinate_uncertainty_m' => $observation['coordinate_accuracy'] ?? null,
            'uncertainty_type' => !empty($observation['coordinate_accuracy']) ? 'measured' : 'device_default',
            'sampling_protocol' => !empty($observation['light_mode']) ? 'manual-light-post' : 'manual-photo-post',
            'capture_device' => !empty($observation['light_mode']) ? 'light_mode' : 'photo_upload',
            'recorded_by' => $observation['user_id'] ?? null,
            'site_id' => $observation['site_id'] ?? null,
            'session_mode' => !empty($observation['light_mode']) ? 'lightweight' : 'standard',
            'place_id' => $placeId,
            'locality_label' => $placeContext['locality_label'],
            'locality_context' => [
                'country' => $observation['country'] ?? null,
                'prefecture' => $observation['prefecture'] ?? null,
                'municipality' => $observation['municipality'] ?? null,
                'archive_track' => $observation['archive_track'] ?? null,
            ],
        ]);

        $taxon = is_array($observation['taxon'] ?? null) ? $observation['taxon'] : [];
        $occurrenceId = CanonicalStore::createOccurrence([
            'event_id' => $eventId,
            'scientific_name' => $taxon['scientific_name'] ?? ($observation['scientific_name'] ?? null),
            'vernacular_name' => $taxon['name'] ?? ($observation['species_name'] ?? null),
            'taxon_rank' => $taxon['rank'] ?? 'species',
            'basis_of_record' => !empty($observation['photos']) ? 'HumanObservation' : 'HumanObservationWithoutMedia',
            'individual_count' => $observation['individual_count'] ?? null,
            'evidence_tier' => !empty($observation['photos']) ? 1.0 : 0.5,
            'evidence_tier_by' => 'post_write',
            'data_quality' => ($observation['status'] ?? '') === '研究用' ? 'A' : 'C',
            'observation_source' => $observation['record_source'] ?? 'post',
            'original_observation_id' => $originalId,
            'occurrence_status' => 'present',
        ]);

        foreach (($observation['photos'] ?? []) as $photoPath) {
            if (!is_string($photoPath) || $photoPath === '') {
                continue;
            }
            CanonicalStore::addEvidence([
                'occurrence_id' => $occurrenceId,
                'media_type' => 'photo',
                'media_path' => $photoPath,
                'capture_timestamp' => $observation['observed_at'] ?? $observation['created_at'] ?? date('c'),
                'metadata' => [
                    'light_mode' => !empty($observation['light_mode']),
                    'location_granularity' => $observation['location_granularity'] ?? 'exact',
                ],
            ]);
        }

        foreach (($observation['identifications'] ?? []) as $identification) {
            $taxonName = (string)($identification['taxon_name'] ?? $identification['scientific_name'] ?? '');
            if ($taxonName === '') {
                continue;
            }

            CanonicalStore::addIdentification([
                'occurrence_id' => $occurrenceId,
                'identified_by' => (string)($identification['user_id'] ?? $identification['user_name'] ?? 'unknown'),
                'taxon_name' => $taxonName,
                'identification_method' => 'user_post',
                'notes' => (string)($identification['note'] ?? ''),
            ]);
        }

        CanonicalStore::setPrivacyAccess($occurrenceId, [
            'coordinate_precision' => $observation['location_granularity'] ?? 'exact',
            'access_tier' => ($observation['location_granularity'] ?? 'exact') === 'hidden' ? 'restricted' : 'public',
            'legal_basis' => 'user_submission',
            'sensitive_species' => PrivacyFilter::isProtectedSpecies((string)($taxon['name'] ?? '')) ? 1 : 0,
        ]);

        CanonicalStore::addPlaceConditionLog([
            'place_id' => $placeId,
            'event_id' => $eventId,
            'observed_at' => $observation['observed_at'] ?? $observation['created_at'] ?? date('c'),
            'biome' => $observation['biome'] ?? null,
            'substrate_tags' => $observation['substrate_tags'] ?? null,
            'evidence_tags' => $observation['evidence_tags'] ?? null,
            'cultivation' => $observation['cultivation'] ?? null,
            'organism_origin' => $observation['organism_origin'] ?? null,
            'managed_context_type' => $observation['managed_context']['type'] ?? null,
            'managed_site_name' => $observation['managed_context']['site_name'] ?? null,
            'locality_note' => $observation['note'] ?? null,
            'environment_summary' => self::buildEnvironmentSummary($observation),
            'metadata' => [
                'license' => $observation['license'] ?? null,
                'official_record' => !empty($observation['official_record']),
                'record_mode' => $observation['record_mode'] ?? 'standard',
                'quality_flags' => $observation['quality_flags'] ?? [],
            ],
        ]);
        CanonicalStore::refreshPlaceStats($placeId);

        AuditLog::log(
            AuditLog::ACTION_SYNC,
            'system:post_dual_write',
            $occurrenceId,
            $eventId,
            null,
            null,
            [
                'original_id' => $originalId,
                'light_mode' => !empty($observation['light_mode']),
                'photo_count' => count($observation['photos'] ?? []),
            ]
        );

        return [
            'event_id' => $eventId,
            'occurrence_id' => $occurrenceId,
            'place_id' => $placeId,
            'skipped' => false,
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
        if (!empty($observation['substrate_tags']) && is_array($observation['substrate_tags'])) {
            $parts[] = 'substrate:' . implode(',', $observation['substrate_tags']);
        }
        if (!empty($observation['evidence_tags']) && is_array($observation['evidence_tags'])) {
            $parts[] = 'evidence:' . implode(',', $observation['evidence_tags']);
        }
        return $parts ? implode(' | ', $parts) : null;
    }
}
