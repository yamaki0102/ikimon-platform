<?php

require_once __DIR__ . '/CanonicalStore.php';

class CanonicalObservationView
{
    public static function hydrate(array $observation, bool $summaryMode = false): array
    {
        if (!CANONICAL_READ_PILOT_ENABLED) {
            $observation['canonical_view'] = [
                'enabled' => false,
                'source' => 'json_only',
            ];
            return $observation;
        }

        $originalId = (string)($observation['id'] ?? '');
        if ($originalId === '') {
            $observation['canonical_view'] = [
                'enabled' => false,
                'source' => 'json_only',
            ];
            return $observation;
        }

        $aggregate = CanonicalStore::getObservationAggregateByOriginalObservationId($originalId);
        if ($aggregate === null) {
            $observation['canonical_view'] = [
                'enabled' => false,
                'source' => 'json_only',
            ];
            return $observation;
        }

        $merged = $observation;
        $event = is_array($aggregate['event'] ?? null) ? $aggregate['event'] : [];
        $occurrence = is_array($aggregate['occurrence'] ?? null) ? $aggregate['occurrence'] : [];
        $evidence = array_values(array_filter($aggregate['evidence'] ?? [], fn($item) => is_array($item)));
        $identifications = array_values(array_filter($aggregate['identifications'] ?? [], fn($item) => is_array($item)));
        $privacyAccess = is_array($aggregate['privacy_access'] ?? null) ? $aggregate['privacy_access'] : [];

        if (($event['event_date'] ?? '') !== '') {
            $merged['observed_at'] = $event['event_date'];
        }
        if (($event['decimal_latitude'] ?? null) !== null) {
            $merged['lat'] = (float)$event['decimal_latitude'];
        }
        if (($event['decimal_longitude'] ?? null) !== null) {
            $merged['lng'] = (float)$event['decimal_longitude'];
        }
        if (($event['coordinate_uncertainty_m'] ?? null) !== null) {
            $merged['coordinate_accuracy'] = (float)$event['coordinate_uncertainty_m'];
        }
        if (($privacyAccess['coordinate_precision'] ?? '') !== '') {
            $merged['location_granularity'] = $privacyAccess['coordinate_precision'];
        }

        if ($evidence !== []) {
            $merged['photos'] = array_values(array_map(
                static fn(array $item): string => (string)($item['media_path'] ?? ''),
                array_filter($evidence, static function (array $item): bool {
                    $type = (string)($item['media_type'] ?? '');
                    return in_array($type, ['photo', 'image'], true) && ($item['media_path'] ?? '') !== '';
                })
            ));

            $merged['media_assets'] = array_values(array_filter(array_map(static function (array $item): ?array {
                $type = (string)($item['media_type'] ?? '');
                if ($type === 'video') {
                    $metadata = is_array($item['metadata'] ?? null) ? $item['metadata'] : [];
                    return [
                        'provider' => $metadata['provider'] ?? 'cloudflare_stream',
                        'provider_uid' => $item['media_path'] ?? null,
                        'media_type' => 'video',
                        'asset_role' => 'observation_video',
                        'thumbnail_url' => $metadata['thumbnail_url'] ?? null,
                        'poster_path' => $metadata['poster_path'] ?? null,
                        'watch_url' => $metadata['watch_url'] ?? null,
                        'iframe_url' => $metadata['iframe_url'] ?? null,
                        'duration_ms' => $metadata['duration_ms'] ?? null,
                        'upload_status' => $metadata['upload_status'] ?? null,
                    ];
                }

                if (!in_array($type, ['photo', 'image'], true) || ($item['media_path'] ?? '') === '') {
                    return null;
                }

                return [
                    'provider' => 'local_upload',
                    'media_type' => 'photo',
                    'asset_role' => 'observation_photo',
                    'media_path' => (string)$item['media_path'],
                    'thumbnail_url' => (string)$item['media_path'],
                    'upload_status' => 'ready',
                ];
            }, $evidence)));
        }

        if (!is_array($merged['taxon'] ?? null)) {
            $merged['taxon'] = [];
        }
        if (($occurrence['vernacular_name'] ?? '') !== '') {
            $merged['taxon']['name'] = $occurrence['vernacular_name'];
            $merged['species_name'] = $occurrence['vernacular_name'];
        }
        if (($occurrence['scientific_name'] ?? '') !== '') {
            $merged['taxon']['scientific_name'] = $occurrence['scientific_name'];
            $merged['scientific_name'] = $occurrence['scientific_name'];
        }
        if (($occurrence['taxon_rank'] ?? '') !== '') {
            $merged['taxon']['rank'] = $occurrence['taxon_rank'];
        }

        $currentJsonIds = count($merged['identifications'] ?? []);
        if (!$summaryMode && count($identifications) >= $currentJsonIds && $identifications !== []) {
            $merged['identifications'] = array_map(static function (array $item): array {
                return [
                    'id' => $item['identification_id'] ?? null,
                    'user_id' => $item['identified_by'] ?? null,
                    'user_name' => $item['identified_by'] ?? 'unknown',
                    'taxon_name' => $item['taxon_name'] ?? '',
                    'confidence' => $item['confidence'] ?? null,
                    'note' => $item['notes'] ?? '',
                    'created_at' => $item['created_at'] ?? null,
                ];
            }, $identifications);
        }

        $merged['canonical_view'] = [
            'enabled' => true,
            'source' => 'canonical_pilot',
            'summary_mode' => $summaryMode,
            'event_id' => $event['event_id'] ?? null,
            'occurrence_id' => $occurrence['occurrence_id'] ?? null,
            'evidence_count' => count($evidence),
            'identification_count' => count($identifications),
            'coordinate_precision' => $privacyAccess['coordinate_precision'] ?? null,
        ];

        return $merged;
    }
}
