<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/CanonicalObservationGuard.php';

const EXIT_PASS = 0;
const EXIT_WARN = 2;
const EXIT_FAIL = 3;

$options = getopt('', ['scope::', 'sample::', 'json']);
$scope = normalizeScope($options['scope'] ?? 'all');
$sampleSize = max(1, (int)($options['sample'] ?? 20));
$jsonOutput = array_key_exists('json', $options);

$dbPath = DATA_DIR . '/ikimon.db';
if (!file_exists($dbPath)) {
    fwrite(STDERR, "ikimon.db not found: {$dbPath}\n");
    exit(1);
}

$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$report = buildReport($pdo, $scope, $sampleSize);

if ($jsonOutput) {
    echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
} else {
    renderHumanReport($report);
}

exit(match ($report['status']) {
    'PASS' => EXIT_PASS,
    'WARN' => EXIT_WARN,
    default => EXIT_FAIL,
});

function normalizeScope(string $scope): string
{
    $scope = strtolower(trim($scope));
    $allowed = ['all', 'observations', 'assets', 'auth', 'business'];
    return in_array($scope, $allowed, true) ? $scope : 'all';
}

function buildReport(PDO $pdo, string $scope, int $sampleSize): array
{
    $counts = [];
    $mapping = [];
    $orphans = [];
    $samples = [];
    $warnings = [];
    $criticalFailures = 0;

    if (in_array($scope, ['all', 'observations', 'assets'], true)) {
        $observationData = analyzeObservationsAndAssets($pdo, $sampleSize);
        $counts = array_merge($counts, $observationData['counts']);
        $mapping = array_merge($mapping, $observationData['mapping']);
        $orphans = array_merge($orphans, $observationData['orphans']);
        $samples = array_merge($samples, $observationData['samples']);
        $warnings = array_merge($warnings, $observationData['warnings']);
        $criticalFailures += $observationData['critical_failures'];
    }

    if (in_array($scope, ['all', 'auth'], true)) {
        $authData = analyzeAuthCounts();
        $counts = array_merge($counts, $authData['counts']);
        $mapping = array_merge($mapping, $authData['mapping']);
        $orphans = array_merge($orphans, $authData['orphans']);
        $warnings = array_merge($warnings, $authData['warnings']);
        $samples = array_merge($samples, $authData['samples']);
        $criticalFailures += $authData['critical_failures'];
    }

    if (in_array($scope, ['all', 'business'], true)) {
        $businessData = analyzeBusinessCounts();
        $counts = array_merge($counts, $businessData['counts']);
        $mapping = array_merge($mapping, $businessData['mapping']);
        $orphans = array_merge($orphans, $businessData['orphans']);
        $warnings = array_merge($warnings, $businessData['warnings']);
        $samples = array_merge($samples, $businessData['samples']);
        $criticalFailures += $businessData['critical_failures'];
    }

    if (in_array($scope, ['all', 'observations', 'assets'], true)) {
        $visitData = analyzeVisitAndPlaceMapping($pdo);
        $counts = array_merge($counts, $visitData['counts']);
        $mapping = array_merge($mapping, $visitData['mapping']);
        $orphans = array_merge($orphans, $visitData['orphans']);
        $warnings = array_merge($warnings, $visitData['warnings']);
        $samples = array_merge($samples, $visitData['samples']);
        $criticalFailures += $visitData['critical_failures'];
    }

    $status = 'PASS';
    if ($criticalFailures > 0) {
        $status = 'FAIL';
    } elseif (!empty($warnings)) {
        $status = 'WARN';
    }

    return [
        'status' => $status,
        'scope' => $scope,
        'summary' => [
            'critical_failures' => $criticalFailures,
            'warnings' => count($warnings),
        ],
        'counts' => $counts,
        'mapping' => $mapping,
        'orphans' => $orphans,
        'samples' => $samples,
        'warnings_detail' => array_values(array_unique($warnings)),
    ];
}

function analyzeObservationsAndAssets(PDO $pdo, int $sampleSize): array
{
    $counts = [];
    $mapping = [];
    $orphans = [];
    $samples = [];
    $warnings = [];
    $criticalFailures = 0;

    $jsonObservations = DataStore::fetchAll('observations');
    $jsonObservationMap = [];
    $jsonPhotoReferences = [];
    $guardSkippedObservations = [];
    $guardSkipReasons = [];
    foreach ($jsonObservations as $observation) {
        $id = (string)($observation['id'] ?? '');
        if ($id === '') {
            continue;
        }
        $guardDecision = CanonicalObservationGuard::shouldSkip($observation);
        if ($guardDecision !== null) {
            $guardSkippedObservations[$id] = (string)$guardDecision['reason'];
            $reason = (string)$guardDecision['reason'];
            $guardSkipReasons[$reason] = ($guardSkipReasons[$reason] ?? 0) + 1;
        }
        $jsonObservationMap[$id] = $observation;
        foreach (($observation['photos'] ?? []) as $photoPath) {
            if (is_string($photoPath) && $photoPath !== '') {
                $jsonPhotoReferences[$id][] = $photoPath;
            }
        }
    }

    $occurrenceRows = $pdo->query("
        SELECT occurrence_id, event_id, original_observation_id
        FROM occurrences
        WHERE original_observation_id IS NOT NULL
    ")->fetchAll(PDO::FETCH_ASSOC);

    $canonicalObservationMap = [];
    foreach ($occurrenceRows as $row) {
        $canonicalObservationMap[(string)$row['original_observation_id']] = $row;
    }

    $eventIds = array_values(array_filter(array_map(
        static fn(array $row): string => (string)($row['event_id'] ?? ''),
        $occurrenceRows
    )));
    $eventPresence = [];
    if ($eventIds !== []) {
        $eventQuery = buildInQuery($eventIds);
        $stmt = $pdo->prepare("SELECT event_id FROM events WHERE event_id IN ({$eventQuery['placeholders']})");
        $stmt->execute($eventQuery['params']);
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $eventId) {
            $eventPresence[(string)$eventId] = true;
        }
    }

    $evidenceRows = $pdo->query("
        SELECT occurrence_id, media_path
        FROM evidence
        WHERE occurrence_id IS NOT NULL
    ")->fetchAll(PDO::FETCH_ASSOC);
    $evidenceByOccurrence = [];
    foreach ($evidenceRows as $row) {
        $occurrenceId = (string)($row['occurrence_id'] ?? '');
        if ($occurrenceId === '') {
            continue;
        }
        $evidenceByOccurrence[$occurrenceId][] = (string)($row['media_path'] ?? '');
    }

    $jsonIds = array_keys($jsonObservationMap);
    $canonicalIds = array_keys($canonicalObservationMap);
    $missingInCanonical = array_values(array_diff($jsonIds, $canonicalIds));
    $orphanCanonical = array_values(array_diff($canonicalIds, $jsonIds));
    $classifiedOrphans = classifyOrphanCanonical($pdo, $orphanCanonical);
    $actionableOrphans = $classifiedOrphans['actionable_ids'];
    $testResidueOrphans = $classifiedOrphans['test_residue_ids'];

    $resolvedOccurrences = 0;
    $resolvedEvents = 0;
    $resolvedEvidence = 0;
    $photoReferenceCount = 0;
    $photoExistingCount = 0;
    $audioReferenceCount = 0;
    $audioExistingCount = 0;
    $photoMissingPaths = [];
    $audioMissingPaths = [];
    $evidenceMissingForObservation = [];
    $eventMissingForObservation = [];
    $leadingSlashPaths = [];

    foreach ($jsonObservationMap as $observationId => $observation) {
        $canonical = $canonicalObservationMap[$observationId] ?? null;
        if ($canonical !== null) {
            $resolvedOccurrences++;
            $occurrenceId = (string)$canonical['occurrence_id'];
            $eventId = (string)$canonical['event_id'];
            if ($eventId !== '' && isset($eventPresence[$eventId])) {
                $resolvedEvents++;
            } else {
                $eventMissingForObservation[] = $observationId;
            }

            $jsonPhotos = array_values(array_filter($jsonPhotoReferences[$observationId] ?? []));
            $photoReferenceCount += count($jsonPhotos);
            $evidencePaths = array_values(array_filter($evidenceByOccurrence[$occurrenceId] ?? []));
            if ($jsonPhotos === []) {
                $resolvedEvidence++;
            } else {
                $missingEvidencePaths = array_values(array_diff($jsonPhotos, $evidencePaths));
                if ($missingEvidencePaths === []) {
                    $resolvedEvidence++;
                } else {
                    $evidenceMissingForObservation[$observationId] = $missingEvidencePaths;
                }
            }
        }

        foreach (($jsonPhotoReferences[$observationId] ?? []) as $photoPath) {
            $fullPath = PUBLIC_DIR . '/' . ltrim($photoPath, '/');
            if (file_exists($fullPath)) {
                $photoExistingCount++;
            } else {
                $photoMissingPaths[$observationId][] = $photoPath;
            }
        }
    }

    $soundArchiveRows = DataStore::fetchAll('sound_archive');
    foreach ($soundArchiveRows as $row) {
        $recordId = (string)($row['id'] ?? 'unknown');
        foreach (['audio_path', 'image_path'] as $field) {
            $assetPath = trim((string)($row[$field] ?? ''));
            if ($assetPath === '') {
                continue;
            }
            if (str_starts_with($assetPath, '/')) {
                $leadingSlashPaths[$recordId . ':' . $field] = $assetPath;
            }
            if ($field === 'audio_path') {
                $audioReferenceCount++;
                $fullPath = PUBLIC_DIR . '/' . ltrim($assetPath, '/');
                if (file_exists($fullPath)) {
                    $audioExistingCount++;
                } else {
                    $audioMissingPaths[$recordId][] = $assetPath;
                }
            }
        }
    }

    $voiceGuideDir = DATA_DIR . '/voice_guide_history';
    if (is_dir($voiceGuideDir)) {
        foreach (glob($voiceGuideDir . '/*.json') as $historyFile) {
            $rows = json_decode((string)file_get_contents($historyFile), true) ?: [];
            foreach ($rows as $index => $entry) {
                foreach (['audio_url', 'audio_path'] as $field) {
                    $assetPath = trim((string)($entry[$field] ?? ''));
                    if ($assetPath !== '' && str_starts_with($assetPath, '/')) {
                        $leadingSlashPaths[basename($historyFile) . ':' . $index . ':' . $field] = $assetPath;
                    }
                }
            }
        }
    }

    $counts['json_observations'] = count($jsonIds);
    $counts['canonical_occurrences'] = count($canonicalIds);
    $counts['canonical_events'] = count($eventPresence);
    $counts['canonical_evidence_rows'] = count($evidenceRows);
    $counts['json_photo_references'] = $photoReferenceCount;
    $counts['existing_photo_files'] = $photoExistingCount;
    $counts['json_audio_references'] = $audioReferenceCount;
    $counts['existing_audio_files'] = $audioExistingCount;
    $counts['leading_slash_asset_paths'] = count($leadingSlashPaths);
    $counts['guard_skipped_observations'] = count($guardSkippedObservations);

    $mapping['observation_to_occurrence_resolution_rate'] = safeRate($resolvedOccurrences, count($jsonIds));
    $mapping['occurrence_to_event_resolution_rate'] = safeRate($resolvedEvents, max(1, $resolvedOccurrences));
    $mapping['occurrence_to_evidence_resolution_rate'] = safeRate($resolvedEvidence, max(1, $resolvedOccurrences));
    $mapping['photo_file_exists_rate'] = safeRate($photoExistingCount, max(1, $photoReferenceCount));
    $mapping['audio_file_exists_rate'] = safeRate($audioExistingCount, $audioReferenceCount);
    $mapping['guard_skip_rate'] = safeRate(count($guardSkippedObservations), count($jsonIds));

    $orphans['missing_in_canonical_count'] = count($missingInCanonical);
    $orphans['orphan_canonical_count'] = count($orphanCanonical);
    $orphans['actionable_orphan_canonical_count'] = count($actionableOrphans);
    $orphans['test_residue_orphan_canonical_count'] = count($testResidueOrphans);
    $orphans['missing_event_count'] = count($eventMissingForObservation);
    $orphans['missing_evidence_count'] = count($evidenceMissingForObservation);
    $orphans['missing_photo_file_count'] = count($photoMissingPaths);
    $orphans['missing_audio_file_count'] = count($audioMissingPaths);
    $orphans['leading_slash_asset_path_count'] = count($leadingSlashPaths);
    $orphans['guard_skip_reason_count'] = count($guardSkipReasons);

    $samples['missing_in_canonical_sample'] = array_slice($missingInCanonical, 0, $sampleSize);
    $samples['orphan_canonical_sample'] = array_slice($orphanCanonical, 0, $sampleSize);
    $samples['actionable_orphan_canonical_sample'] = array_slice($actionableOrphans, 0, $sampleSize);
    $samples['test_residue_orphan_canonical_sample'] = array_slice($testResidueOrphans, 0, $sampleSize);
    $samples['orphan_canonical_classification_sample'] = sliceAssoc($classifiedOrphans['classified_sample'], $sampleSize);
    $samples['guard_skipped_observation_sample'] = sliceAssoc($guardSkippedObservations, $sampleSize);
    $samples['guard_skip_reason_sample'] = sliceAssoc($guardSkipReasons, $sampleSize);
    $samples['missing_event_sample'] = array_slice($eventMissingForObservation, 0, $sampleSize);
    $samples['missing_evidence_sample'] = sliceAssoc($evidenceMissingForObservation, $sampleSize);
    $samples['missing_photo_file_sample'] = sliceAssoc($photoMissingPaths, $sampleSize);
    $samples['missing_audio_file_sample'] = sliceAssoc($audioMissingPaths, $sampleSize);
    $samples['leading_slash_asset_path_sample'] = sliceAssoc($leadingSlashPaths, $sampleSize);

    if ($missingInCanonical !== []) {
        $warnings[] = 'Some JSON observations are missing canonical occurrences.';
        $criticalFailures++;
    }
    if ($eventMissingForObservation !== []) {
        $warnings[] = 'Some canonical occurrences are missing linked events.';
        $criticalFailures++;
    }
    if ($evidenceMissingForObservation !== []) {
        $warnings[] = 'Some observation photo references are not mirrored in canonical evidence.';
        $criticalFailures++;
    }
    if ($photoReferenceCount > 0 && $photoExistingCount !== $photoReferenceCount) {
        $warnings[] = 'Some photo files referenced by JSON observations do not exist on disk.';
        $criticalFailures++;
    }
    if ($audioReferenceCount > 0 && $audioExistingCount !== $audioReferenceCount) {
        $warnings[] = 'Some audio files referenced by sound archive records do not exist on disk.';
        $criticalFailures++;
    }
    if ($actionableOrphans !== []) {
        $warnings[] = 'Canonical contains occurrences that do not map back to current JSON observations.';
    } elseif ($testResidueOrphans !== []) {
        $warnings[] = 'Canonical orphan rows are currently limited to likely local test/dev residue.';
    }
    if ($leadingSlashPaths !== []) {
        $warnings[] = 'Some asset paths still include a leading slash and need normalization before migration.';
    }
    if ($guardSkippedObservations !== []) {
        $warnings[] = 'Some current JSON observations would now be skipped by canonical guard rules.';
    }

    return [
        'counts' => $counts,
        'mapping' => $mapping,
        'orphans' => $orphans,
        'samples' => $samples,
        'warnings' => $warnings,
        'critical_failures' => $criticalFailures,
    ];
}

function classifyOrphanCanonical(PDO $pdo, array $orphanOriginalIds): array
{
    if ($orphanOriginalIds === []) {
        return [
            'actionable_ids' => [],
            'test_residue_ids' => [],
            'classified_sample' => [],
        ];
    }

    $query = buildInQuery($orphanOriginalIds);
    $stmt = $pdo->prepare("
        SELECT
            o.original_observation_id,
            o.scientific_name,
            e.recorded_by,
            a.actor,
            a.details
        FROM occurrences o
        LEFT JOIN events e
            ON e.event_id = o.event_id
        LEFT JOIN audit_log a
            ON a.occurrence_id = o.occurrence_id
        WHERE o.original_observation_id IN ({$query['placeholders']})
    ");
    $stmt->execute($query['params']);

    $rowsByOriginalId = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $originalId = (string)($row['original_observation_id'] ?? '');
        if ($originalId === '') {
            continue;
        }
        $rowsByOriginalId[$originalId][] = $row;
    }

    $actionableIds = [];
    $testResidueIds = [];
    $classifiedSample = [];

    foreach ($orphanOriginalIds as $originalId) {
        $rows = $rowsByOriginalId[$originalId] ?? [];
        $classification = classifyOrphanRows($originalId, $rows);
        $classifiedSample[$originalId] = $classification;
        if ($classification['likely_test_residue']) {
            $testResidueIds[] = $originalId;
        } else {
            $actionableIds[] = $originalId;
        }
    }

    return [
        'actionable_ids' => $actionableIds,
        'test_residue_ids' => $testResidueIds,
        'classified_sample' => $classifiedSample,
    ];
}

function classifyOrphanRows(string $originalId, array $rows): array
{
    $actors = [];
    $recordedBy = [];
    $scientificNames = [];
    foreach ($rows as $row) {
        $actor = trim((string)($row['actor'] ?? ''));
        if ($actor !== '') {
            $actors[$actor] = true;
        }
        $recorder = trim((string)($row['recorded_by'] ?? ''));
        if ($recorder !== '') {
            $recordedBy[$recorder] = true;
        }
        $scientificName = trim((string)($row['scientific_name'] ?? ''));
        if ($scientificName !== '') {
            $scientificNames[$scientificName] = true;
        }
    }

    $reasons = [];
    if (preg_match('/^test[-_]/i', $originalId) === 1) {
        $reasons[] = 'original_id_prefixed_as_test';
    }
    if (preg_match('/^obs-(writer|sync)-/i', $originalId) === 1) {
        $reasons[] = 'feature_test_original_id';
    }
    if (preg_match('/^o\d+$/', $originalId) === 1) {
        $reasons[] = 'short_fixture_style_original_id';
    }
    if (isset($actors['system:canonical_sync'])) {
        $reasons[] = 'written_by_canonical_sync';
    }
    if (isset($actors['system:post_dual_write']) && preg_match('/^test[-_]/i', $originalId) === 1) {
        $reasons[] = 'dual_write_from_test_named_observation';
    }
    if (isset($recordedBy['test-user'])) {
        $reasons[] = 'recorded_by_test_user';
    }
    if ($scientificNames === []) {
        $reasons[] = 'missing_scientific_name';
    }

    $likelyTestResidue = false;
    if (
        in_array('original_id_prefixed_as_test', $reasons, true)
        || in_array('recorded_by_test_user', $reasons, true)
        || in_array('feature_test_original_id', $reasons, true)
    ) {
        $likelyTestResidue = true;
    } elseif (
        in_array('short_fixture_style_original_id', $reasons, true)
        && in_array('written_by_canonical_sync', $reasons, true)
    ) {
        $likelyTestResidue = true;
    }

    return [
        'likely_test_residue' => $likelyTestResidue,
        'actors' => array_keys($actors),
        'recorded_by' => array_keys($recordedBy),
        'scientific_names' => array_keys($scientificNames),
        'reasons' => $reasons,
    ];
}

function analyzeAuthCounts(): array
{
    $users = DataStore::get('users');
    $userIds = [];
    foreach ($users as $user) {
        $id = (string)($user['id'] ?? '');
        if ($id !== '') {
            $userIds[$id] = true;
        }
    }

    $installs = DataStore::get('fieldscan_installs');
    $installIds = [];
    $missingInstallUsers = [];
    foreach ($installs as $install) {
        $installId = (string)($install['install_id'] ?? '');
        if ($installId !== '') {
            $installIds[$installId] = true;
        }
        $userId = (string)($install['user_id'] ?? '');
        if ($userId !== '' && !isset($userIds[$userId])) {
            $missingInstallUsers[$installId !== '' ? $installId : 'unknown_install'] = $userId;
        }
    }

    $tokens = DataStore::get('fieldscan_app_tokens');
    $missingTokenUsers = [];
    $missingTokenInstalls = [];
    foreach ($tokens as $token) {
        $tokenId = (string)($token['id'] ?? 'unknown_token');
        $userId = (string)($token['user_id'] ?? '');
        $installId = (string)($token['install_id'] ?? '');
        if ($userId !== '' && !isset($userIds[$userId])) {
            $missingTokenUsers[$tokenId] = $userId;
        }
        if ($installId !== '' && !isset($installIds[$installId])) {
            $missingTokenInstalls[$tokenId] = $installId;
        }
    }

    $oauthStates = DataStore::get('fieldscan_oauth_states');
    $stateInstallRefs = 0;
    $missingStateInstalls = [];
    foreach ($oauthStates as $state) {
        $installId = (string)($state['install_id'] ?? '');
        if ($installId === '') {
            continue;
        }
        $stateInstallRefs++;
        if (!isset($installIds[$installId])) {
            $missingStateInstalls[(string)($state['state'] ?? 'unknown_state')] = $installId;
        }
    }

    $warnings = [];
    $criticalFailures = 0;
    if ($missingInstallUsers !== []) {
        $warnings[] = 'Some fieldscan installs reference users that do not exist.';
        $criticalFailures++;
    }
    if ($missingTokenUsers !== []) {
        $warnings[] = 'Some fieldscan app tokens reference users that do not exist.';
        $criticalFailures++;
    }
    if ($missingTokenInstalls !== []) {
        $warnings[] = 'Some fieldscan app tokens reference installs that do not exist.';
        $criticalFailures++;
    }
    if ($missingStateInstalls !== []) {
        $warnings[] = 'Some fieldscan oauth states reference installs that do not exist.';
    }

    return [
        'counts' => [
            'json_users' => count($users),
            'json_auth_tokens' => count(DataStore::get('auth_tokens')),
            'json_fieldscan_app_tokens' => count($tokens),
            'json_fieldscan_installs' => count($installs),
            'json_fieldscan_oauth_states' => count($oauthStates),
        ],
        'mapping' => [
            'fieldscan_install_user_resolution_rate' => safeRate(count($installs) - count($missingInstallUsers), count($installs)),
            'fieldscan_token_user_resolution_rate' => safeRate(count($tokens) - count($missingTokenUsers), count($tokens)),
            'fieldscan_token_install_resolution_rate' => safeRate(count(array_filter($tokens, static fn($row) => trim((string)($row['install_id'] ?? '')) !== '')) - count($missingTokenInstalls), count(array_filter($tokens, static fn($row) => trim((string)($row['install_id'] ?? '')) !== ''))),
            'fieldscan_oauth_state_install_resolution_rate' => safeRate($stateInstallRefs - count($missingStateInstalls), $stateInstallRefs),
        ],
        'orphans' => [
            'missing_install_user_count' => count($missingInstallUsers),
            'missing_token_user_count' => count($missingTokenUsers),
            'missing_token_install_count' => count($missingTokenInstalls),
            'missing_oauth_state_install_count' => count($missingStateInstalls),
        ],
        'warnings' => $warnings,
        'samples' => [
            'missing_install_user_sample' => sliceAssoc($missingInstallUsers, 20),
            'missing_token_user_sample' => sliceAssoc($missingTokenUsers, 20),
            'missing_token_install_sample' => sliceAssoc($missingTokenInstalls, 20),
            'missing_oauth_state_install_sample' => sliceAssoc($missingStateInstalls, 20),
        ],
        'critical_failures' => $criticalFailures,
    ];
}

function analyzeBusinessCounts(): array
{
    $users = DataStore::get('users');
    $userIds = [];
    foreach ($users as $user) {
        $id = (string)($user['id'] ?? '');
        if ($id !== '') {
            $userIds[$id] = true;
        }
    }

    $corporations = DataStore::get('corporations');
    $corporationIds = [];
    $missingCorporationMembers = [];
    foreach ($corporations as $corporation) {
        $corpId = (string)($corporation['id'] ?? '');
        if ($corpId !== '') {
            $corporationIds[$corpId] = true;
        }
        foreach ((array)($corporation['members'] ?? []) as $memberUserId => $memberData) {
            if ((string)$memberUserId !== '' && !isset($userIds[(string)$memberUserId])) {
                $missingCorporationMembers[$corpId !== '' ? $corpId : 'unknown_corp'][] = (string)$memberUserId;
            }
        }
    }

    $businessApplications = DataStore::fetchAll('business_applications');
    $missingApplicationCorporations = [];
    $missingApplicationOwners = [];
    foreach ($businessApplications as $application) {
        $appId = (string)($application['id'] ?? 'unknown_application');
        $corpId = trim((string)($application['workspace']['corporation_id'] ?? ''));
        $ownerUserId = trim((string)($application['workspace']['owner_user_id'] ?? ''));
        if ($corpId !== '' && !isset($corporationIds[$corpId])) {
            $missingApplicationCorporations[$appId] = $corpId;
        }
        if ($ownerUserId !== '' && !isset($userIds[$ownerUserId])) {
            $missingApplicationOwners[$appId] = $ownerUserId;
        }
    }

    $corporateInvites = DataStore::fetchAll('corporate_invites');
    $missingInviteCorporations = [];
    $missingInviteAcceptedUsers = [];
    foreach ($corporateInvites as $invite) {
        $inviteId = (string)($invite['id'] ?? 'unknown_invite');
        $corpId = trim((string)($invite['corporation_id'] ?? ''));
        $acceptedBy = trim((string)($invite['accepted_by'] ?? ''));
        if ($corpId !== '' && !isset($corporationIds[$corpId])) {
            $missingInviteCorporations[$inviteId] = $corpId;
        }
        if ($acceptedBy !== '' && !isset($userIds[$acceptedBy])) {
            $missingInviteAcceptedUsers[$inviteId] = $acceptedBy;
        }
    }

    $invites = DataStore::get('invites');
    $missingInviteOwners = [];
    $missingAcceptedUsers = [];
    foreach ($invites as $invite) {
        $code = (string)($invite['code'] ?? $invite['id'] ?? 'unknown_code');
        $ownerUserId = trim((string)($invite['user_id'] ?? ''));
        if ($ownerUserId !== '' && !isset($userIds[$ownerUserId])) {
            $missingInviteOwners[$code] = $ownerUserId;
        }
        foreach ((array)($invite['accepted_users'] ?? []) as $accepted) {
            $acceptedId = trim((string)($accepted['user_id'] ?? ''));
            if ($acceptedId !== '' && !isset($userIds[$acceptedId])) {
                $missingAcceptedUsers[$code . ':' . $acceptedId] = $acceptedId;
            }
        }
    }

    $warnings = [];
    $criticalFailures = 0;
    if ($missingCorporationMembers !== []) {
        $warnings[] = 'Some corporation members reference users that do not exist.';
        $criticalFailures++;
    }
    if ($missingApplicationCorporations !== []) {
        $warnings[] = 'Some business applications reference corporations that do not exist.';
        $criticalFailures++;
    }
    if ($missingApplicationOwners !== []) {
        $warnings[] = 'Some business applications reference owner users that do not exist.';
        $criticalFailures++;
    }
    if ($missingInviteCorporations !== []) {
        $warnings[] = 'Some corporate invites reference corporations that do not exist.';
        $criticalFailures++;
    }
    if ($missingInviteAcceptedUsers !== []) {
        $warnings[] = 'Some corporate invites reference accepted users that do not exist.';
        $criticalFailures++;
    }
    if ($missingInviteOwners !== []) {
        $warnings[] = 'Some invite owners do not exist in users.json.';
        $criticalFailures++;
    }
    if ($missingAcceptedUsers !== []) {
        $warnings[] = 'Some invite accepted users do not exist in users.json.';
        $criticalFailures++;
    }

    $applicationCorpRefs = count(array_filter($businessApplications, static fn($row) => trim((string)($row['workspace']['corporation_id'] ?? '')) !== ''));
    $applicationOwnerRefs = count(array_filter($businessApplications, static fn($row) => trim((string)($row['workspace']['owner_user_id'] ?? '')) !== ''));
    $corporateInviteCorpRefs = count(array_filter($corporateInvites, static fn($row) => trim((string)($row['corporation_id'] ?? '')) !== ''));
    $corporateInviteAcceptedRefs = count(array_filter($corporateInvites, static fn($row) => trim((string)($row['accepted_by'] ?? '')) !== ''));
    $inviteOwnerRefs = count(array_filter($invites, static fn($row) => trim((string)($row['user_id'] ?? '')) !== ''));
    $acceptedInviteRefs = 0;
    foreach ($invites as $invite) {
        foreach ((array)($invite['accepted_users'] ?? []) as $accepted) {
            if (trim((string)($accepted['user_id'] ?? '')) !== '') {
                $acceptedInviteRefs++;
            }
        }
    }

    return [
        'counts' => [
            'json_corporations' => count($corporations),
            'json_business_applications' => count($businessApplications),
            'json_corporate_invites' => count($corporateInvites),
            'json_invites' => count($invites),
        ],
        'mapping' => [
            'corporation_member_user_resolution_rate' => safeRate(count($corporations) === 0 ? 0 : array_sum(array_map(static fn($corp) => count((array)($corp['members'] ?? [])), $corporations)) - array_sum(array_map('count', $missingCorporationMembers)), count($corporations) === 0 ? 0 : array_sum(array_map(static fn($corp) => count((array)($corp['members'] ?? [])), $corporations))),
            'business_application_corporation_resolution_rate' => safeRate($applicationCorpRefs - count($missingApplicationCorporations), $applicationCorpRefs),
            'business_application_owner_resolution_rate' => safeRate($applicationOwnerRefs - count($missingApplicationOwners), $applicationOwnerRefs),
            'corporate_invite_corporation_resolution_rate' => safeRate($corporateInviteCorpRefs - count($missingInviteCorporations), $corporateInviteCorpRefs),
            'corporate_invite_accepted_user_resolution_rate' => safeRate($corporateInviteAcceptedRefs - count($missingInviteAcceptedUsers), $corporateInviteAcceptedRefs),
            'invite_owner_user_resolution_rate' => safeRate($inviteOwnerRefs - count($missingInviteOwners), $inviteOwnerRefs),
            'invite_accepted_user_resolution_rate' => safeRate($acceptedInviteRefs - count($missingAcceptedUsers), $acceptedInviteRefs),
        ],
        'orphans' => [
            'missing_corporation_member_user_count' => array_sum(array_map('count', $missingCorporationMembers)),
            'missing_application_corporation_count' => count($missingApplicationCorporations),
            'missing_application_owner_count' => count($missingApplicationOwners),
            'missing_corporate_invite_corporation_count' => count($missingInviteCorporations),
            'missing_corporate_invite_accepted_user_count' => count($missingInviteAcceptedUsers),
            'missing_invite_owner_count' => count($missingInviteOwners),
            'missing_invite_accepted_user_count' => count($missingAcceptedUsers),
        ],
        'warnings' => $warnings,
        'samples' => [
            'missing_corporation_member_user_sample' => sliceAssoc($missingCorporationMembers, 20),
            'missing_application_corporation_sample' => sliceAssoc($missingApplicationCorporations, 20),
            'missing_application_owner_sample' => sliceAssoc($missingApplicationOwners, 20),
            'missing_corporate_invite_corporation_sample' => sliceAssoc($missingInviteCorporations, 20),
            'missing_corporate_invite_accepted_user_sample' => sliceAssoc($missingInviteAcceptedUsers, 20),
            'missing_invite_owner_sample' => sliceAssoc($missingInviteOwners, 20),
            'missing_invite_accepted_user_sample' => sliceAssoc($missingAcceptedUsers, 20),
        ],
        'critical_failures' => $criticalFailures,
    ];
}

function analyzeVisitAndPlaceMapping(PDO $pdo): array
{
    $warnings = [];
    $criticalFailures = 0;

    $fieldIds = [];
    $fieldDir = DATA_DIR . '/my_fields';
    if (is_dir($fieldDir)) {
        foreach (glob($fieldDir . '/*.json') as $file) {
            $row = json_decode((string)file_get_contents($file), true) ?: [];
            $fieldId = (string)($row['id'] ?? '');
            if ($fieldId !== '') {
                $fieldIds[$fieldId] = true;
            }
        }
    }

    $trackSessions = [];
    $missingTrackFields = [];
    $tracksRoot = DATA_DIR . '/tracks';
    if (is_dir($tracksRoot)) {
        foreach (glob($tracksRoot . '/*/*.json') as $trackFile) {
            $row = json_decode((string)file_get_contents($trackFile), true) ?: [];
            $sessionId = (string)($row['session_id'] ?? basename($trackFile, '.json'));
            $trackSessions[$sessionId] = $row;
            $fieldId = trim((string)($row['field_id'] ?? ''));
            if ($fieldId !== '' && !isset($fieldIds[$fieldId])) {
                $missingTrackFields[$sessionId] = $fieldId;
            }
        }
    }

    $passiveSessions = DataStore::fetchAll('passive_sessions');
    $passiveSessionIds = [];
    foreach ($passiveSessions as $session) {
        $sessionId = trim((string)($session['session_id'] ?? ''));
        if ($sessionId !== '') {
            $passiveSessionIds[$sessionId] = true;
        }
    }

    $environmentLogs = DataStore::fetchAll('environment_logs');
    $missingEnvironmentSessions = [];
    $missingEnvironmentEvents = [];
    $environmentEventRefs = [];
    $eventIds = [];
    foreach ($environmentLogs as $log) {
        $sessionId = trim((string)($log['session_id'] ?? ''));
        $eventId = trim((string)($log['canonical_event_id'] ?? ''));
        if ($sessionId !== '' && !isset($passiveSessionIds[$sessionId])) {
            $missingEnvironmentSessions[$sessionId] = $sessionId;
        }
        if ($eventId !== '') {
            $environmentEventRefs[$sessionId !== '' ? $sessionId : ('envlog_' . count($environmentEventRefs))] = $eventId;
            $eventIds[$eventId] = true;
        }
    }

    $canonicalEventPresence = [];
    if ($eventIds !== []) {
        $eventQuery = buildInQuery(array_keys($eventIds));
        $stmt = $pdo->prepare("SELECT event_id FROM events WHERE event_id IN ({$eventQuery['placeholders']})");
        $stmt->execute($eventQuery['params']);
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $eventId) {
            $canonicalEventPresence[(string)$eventId] = true;
        }
    }
    foreach ($environmentEventRefs as $key => $eventId) {
        if (!isset($canonicalEventPresence[$eventId])) {
            $missingEnvironmentEvents[$key] = $eventId;
        }
    }

    $observations = DataStore::fetchAll('observations');
    $passiveObservationRefs = 0;
    $missingPassiveObservationSessions = [];
    $placeCandidateRefs = 0;
    $placeCandidateResolved = 0;
    foreach ($observations as $observation) {
        $sessionId = trim((string)($observation['passive_session_id'] ?? ''));
        if ($sessionId !== '') {
            $passiveObservationRefs++;
            if (!isset($passiveSessionIds[$sessionId])) {
                $missingPassiveObservationSessions[(string)($observation['id'] ?? ('obs_' . $passiveObservationRefs))] = $sessionId;
            }
        }

        $siteId = trim((string)($observation['site_id'] ?? ''));
        $municipality = trim((string)($observation['municipality'] ?? ''));
        $lat = $observation['lat'] ?? $observation['location']['lat'] ?? null;
        $lng = $observation['lng'] ?? $observation['location']['lng'] ?? null;
        if ($siteId !== '' || $municipality !== '' || ($lat !== null && $lng !== null)) {
            $placeCandidateRefs++;
            $placeCandidateResolved++;
        }
    }

    $recapIds = [];
    $missingRecapSessions = [];
    $recapDir = DATA_DIR . '/session_recaps';
    if (is_dir($recapDir)) {
        foreach (glob($recapDir . '/*.json') as $recapFile) {
            $sessionId = basename($recapFile, '.json');
            $recapIds[$sessionId] = true;
            if (!isset($passiveSessionIds[$sessionId]) && !isset($trackSessions[$sessionId])) {
                $missingRecapSessions[$sessionId] = $sessionId;
            }
        }
    }

    if ($missingTrackFields !== []) {
        $warnings[] = 'Some track sessions reference my_fields that do not exist.';
        $criticalFailures++;
    }
    if ($missingEnvironmentSessions !== []) {
        $warnings[] = 'Some environment logs reference passive sessions that do not exist.';
        $criticalFailures++;
    }
    if ($missingEnvironmentEvents !== []) {
        $warnings[] = 'Some environment logs reference canonical events that do not exist.';
        $criticalFailures++;
    }
    if ($missingPassiveObservationSessions !== []) {
        $warnings[] = 'Some passive observations reference passive sessions that do not exist.';
        $criticalFailures++;
    }
    if ($missingRecapSessions !== []) {
        $warnings[] = 'Some session recaps do not resolve to passive sessions or track sessions.';
    }

    return [
        'counts' => [
            'json_my_fields' => count($fieldIds),
            'json_track_sessions' => count($trackSessions),
            'json_passive_sessions' => count($passiveSessionIds),
            'json_environment_logs' => count($environmentLogs),
            'json_passive_observation_refs' => $passiveObservationRefs,
            'json_session_recaps' => count($recapIds),
        ],
        'mapping' => [
            'track_field_resolution_rate' => safeRate(count($trackSessions) - count($missingTrackFields), count($trackSessions)),
            'environment_log_session_resolution_rate' => safeRate(count($environmentLogs) - count($missingEnvironmentSessions), count($environmentLogs)),
            'environment_log_canonical_event_resolution_rate' => safeRate(count($environmentEventRefs) - count($missingEnvironmentEvents), count($environmentEventRefs)),
            'passive_observation_session_resolution_rate' => safeRate($passiveObservationRefs - count($missingPassiveObservationSessions), $passiveObservationRefs),
            'session_recap_session_resolution_rate' => safeRate(count($recapIds) - count($missingRecapSessions), count($recapIds)),
            'place_candidate_resolution_rate' => safeRate($placeCandidateResolved, $placeCandidateRefs),
        ],
        'orphans' => [
            'missing_track_field_count' => count($missingTrackFields),
            'missing_environment_session_count' => count($missingEnvironmentSessions),
            'missing_environment_event_count' => count($missingEnvironmentEvents),
            'missing_passive_observation_session_count' => count($missingPassiveObservationSessions),
            'missing_session_recap_session_count' => count($missingRecapSessions),
        ],
        'warnings' => $warnings,
        'samples' => [
            'missing_track_field_sample' => sliceAssoc($missingTrackFields, 20),
            'missing_environment_session_sample' => sliceAssoc($missingEnvironmentSessions, 20),
            'missing_environment_event_sample' => sliceAssoc($missingEnvironmentEvents, 20),
            'missing_passive_observation_session_sample' => sliceAssoc($missingPassiveObservationSessions, 20),
            'missing_session_recap_session_sample' => sliceAssoc($missingRecapSessions, 20),
        ],
        'critical_failures' => $criticalFailures,
    ];
}

function safeRate(int $numerator, int $denominator): float
{
    if ($denominator <= 0) {
        return 1.0;
    }
    return round($numerator / $denominator, 4);
}

function buildInQuery(array $values): array
{
    $params = [];
    $placeholders = [];
    foreach (array_values($values) as $index => $value) {
        $key = ':p' . $index;
        $placeholders[] = $key;
        $params[$key] = $value;
    }
    return [
        'placeholders' => implode(', ', $placeholders),
        'params' => $params,
    ];
}

function sliceAssoc(array $items, int $limit): array
{
    $sliced = [];
    $count = 0;
    foreach ($items as $key => $value) {
        $sliced[$key] = $value;
        $count++;
        if ($count >= $limit) {
            break;
        }
    }
    return $sliced;
}

function renderHumanReport(array $report): void
{
    echo 'status: ' . $report['status'] . PHP_EOL;
    echo 'scope: ' . $report['scope'] . PHP_EOL;
    echo 'critical_failures: ' . $report['summary']['critical_failures'] . PHP_EOL;
    echo 'warnings: ' . $report['summary']['warnings'] . PHP_EOL;
    echo PHP_EOL . '[counts]' . PHP_EOL;
    foreach ($report['counts'] as $key => $value) {
        echo $key . ': ' . formatValue($value) . PHP_EOL;
    }
    if ($report['mapping'] !== []) {
        echo PHP_EOL . '[mapping]' . PHP_EOL;
        foreach ($report['mapping'] as $key => $value) {
            echo $key . ': ' . formatValue($value) . PHP_EOL;
        }
    }
    if (!empty($report['warnings_detail'])) {
        echo PHP_EOL . '[warnings_detail]' . PHP_EOL;
        foreach ($report['warnings_detail'] as $warning) {
            echo '- ' . $warning . PHP_EOL;
        }
    }
    if (!empty($report['samples'])) {
        echo PHP_EOL . '[samples]' . PHP_EOL;
        foreach ($report['samples'] as $key => $value) {
            if ($value === [] || $value === null) {
                continue;
            }
            echo $key . ': ' . json_encode($value, JSON_UNESCAPED_UNICODE) . PHP_EOL;
        }
    }
}

function formatValue(mixed $value): string
{
    if (is_float($value)) {
        return number_format($value, 4, '.', '');
    }
    return (string)$value;
}
