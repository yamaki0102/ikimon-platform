<?php

class CanonicalMachineObservationPolicy
{
    public static function evaluate(array $sessionMeta): array
    {
        $sessionIntent = strtolower(trim((string)($sessionMeta['session_intent'] ?? 'official')));
        $officialRecord = array_key_exists('official_record', $sessionMeta)
            ? (bool)$sessionMeta['official_record']
            : true;
        $testProfile = strtolower(trim((string)($sessionMeta['test_profile'] ?? 'field')));

        if (!$officialRecord) {
            return [
                'enabled' => false,
                'reason' => 'official_record_false',
            ];
        }

        if ($sessionIntent !== '' && $sessionIntent !== 'official') {
            return [
                'enabled' => false,
                'reason' => 'session_intent_not_official',
            ];
        }

        if ($testProfile !== '' && !in_array($testProfile, ['field', 'official', 'production', 'prod'], true)) {
            return [
                'enabled' => false,
                'reason' => 'test_profile_not_field',
            ];
        }

        return [
            'enabled' => true,
            'reason' => null,
        ];
    }
}
