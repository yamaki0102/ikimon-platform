<?php

/**
 * Temporary compatibility shim for surveyor-only posting.
 *
 * The official surveyor workflow is not fully implemented in this tree yet,
 * but post_observation.php depends on this class unconditionally. Keep normal
 * observation posting alive by denying surveyor-only mode until the real
 * manager is introduced.
 */
class SurveyorManager
{
    public static function isApproved(?array $user): bool
    {
        if (!$user) {
            return false;
        }

        return !empty($user['surveyor_approved']) || (($user['surveyor_status'] ?? '') === 'approved');
    }

    public static function getStatus(?array $user): string
    {
        if (!$user) {
            return 'guest';
        }

        if (!empty($user['surveyor_status'])) {
            return (string)$user['surveyor_status'];
        }

        return self::isApproved($user) ? 'approved' : 'unapproved';
    }
}
