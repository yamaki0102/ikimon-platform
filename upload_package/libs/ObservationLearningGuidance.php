<?php

final class ObservationLearningGuidance
{
    public static function build(array $obs, ?array $latestAiAssessment = null): array
    {
        $rank = self::resolveRank($obs, $latestAiAssessment);
        $status = BioUtils::displayStatus($obs, '未同定');
        $photoCount = count(array_values(array_filter($obs['photos'] ?? [], fn($photo) => is_string($photo) && trim($photo) !== '')));
        $identificationCount = count(BioUtils::deduplicateIdentifications($obs['identifications'] ?? []));
        $communitySupporters = (int)($obs['consensus']['community_supporters'] ?? 0);
        $hasConflict = !empty($obs['quality_flags']['has_lineage_conflict']);
        $observerBoost = trim((string)($latestAiAssessment['observer_boost'] ?? ''));
        $nextStep = trim((string)($latestAiAssessment['next_step'] ?? ''));
        $missingEvidence = array_values(array_filter(
            is_array($latestAiAssessment['missing_evidence'] ?? null) ? $latestAiAssessment['missing_evidence'] : [],
            fn($item) => is_string($item) && trim($item) !== ''
        ));

        $progressBody = __('observation_page.learning_progress_body_default', 'The record is already moving if it stays honest about what the evidence supports.');
        if ($identificationCount === 0) {
            $progressBody = __('observation_page.learning_progress_body_unidentified', 'Even before a name settles, a dated record with place and photos becomes something you can revisit and compare later.');
        } elseif (self::isSpeciesOrBelow($rank)) {
            $progressBody = __('observation_page.learning_progress_body_species', 'A species-level idea is useful when the photo, place, and season all line up. Leaving room for uncertainty is better than forcing certainty.');
        } elseif ($rank !== 'unknown') {
            $progressBody = __('observation_page.learning_progress_body_coarse', 'Stopping at genus or another coarse rank is valid when the evidence is not enough for species. That is quality control, not failure.');
        }
        $progressNote = self::buildProgressNote($status, $identificationCount, $communitySupporters, $hasConflict);

        if ($nextStep !== '') {
            $retakeBody = $nextStep;
        } elseif (!empty($missingEvidence)) {
            $retakeBody = strtr(
                __('observation_page.learning_retake_body_missing', 'The next gain will come from checking: {points}.'),
                ['{points}' => implode(' / ', array_slice($missingEvidence, 0, 3))]
            );
        } elseif ($photoCount <= 1) {
            $retakeBody = __('observation_page.learning_retake_body_single', 'One closer photo and one wider place shot will make the next narrowing much easier.');
        } else {
            $retakeBody = __('observation_page.learning_retake_body_multi', 'You already have multiple photos. The next gain is a decisive angle or a place clue that rules out similar taxa.');
        }

        $contributionBody = $observerBoost !== ''
            ? $observerBoost
            : (
                $identificationCount === 0
                    ? __('observation_page.learning_contribution_body_first', 'This record has no earlier grounded suggestion yet. The first careful clue can become the anchor for later review.')
                    : __('observation_page.learning_contribution_body_existing', 'This record already has suggestions. Another careful reason or comparison helps the community narrow the consensus.')
            );

        $contributionNote = $communitySupporters > 0
            ? self::replace(
                __('observation_page.learning_contribution_note_supporters', 'Right now {count} community checks are already helping this record stay grounded.'),
                ['count' => (string)$communitySupporters]
            )
            : __('observation_page.learning_contribution_note', 'As records get clearer, they also become better guidance for the next person and stronger training signal for future ikimon AI.');

        return [
            'section_title' => __('observation_page.learning_section_title', 'Turn this observation into learning'),
            'section_body' => __('observation_page.learning_section_body', 'The goal is not perfect certainty at once. It is to leave a record you can revisit, improve, and feed back into the next person’s learning loop.'),
            'cards' => [
                [
                    'icon' => '🪜',
                    'title' => __('observation_page.learning_progress_title', 'Why this still counts as progress'),
                    'body' => $progressBody,
                    'note' => $progressNote,
                ],
                [
                    'icon' => '📷',
                    'title' => __('observation_page.learning_retake_title', 'What to capture next'),
                    'body' => $retakeBody,
                ],
                [
                    'icon' => '🌍',
                    'title' => __('observation_page.learning_contribution_title', 'How this helps beyond you'),
                    'body' => $contributionBody,
                    'note' => $contributionNote,
                ],
            ],
        ];
    }

    private static function buildProgressNote(string $status, int $identificationCount, int $communitySupporters, bool $hasConflict): ?string
    {
        if ($hasConflict) {
            return __('observation_page.learning_progress_note_conflict', 'There is still disagreement in the record. One more grounded check or decisive photo can reduce the conflict.');
        }

        if ($identificationCount === 0) {
            return __('observation_page.learning_progress_note_first_id', 'The next meaningful step is not perfection. It is getting the first grounded identification onto the record.');
        }

        if (in_array($status, ['研究利用可', '種レベル研究用'], true)) {
            return __('observation_page.learning_progress_note_trusted', 'This record is already on a trusted lane. What you add now makes later revisits and reuse easier.');
        }

        if ($communitySupporters < 2) {
            return self::replace(
                __('observation_page.learning_progress_note_more_support', 'If {count} more grounded check comes in, the record will usually become easier to stabilize.'),
                ['count' => '1']
            );
        }

        return null;
    }

    private static function resolveRank(array $obs, ?array $latestAiAssessment): string
    {
        $candidates = [
            $obs['taxon']['rank'] ?? null,
            $obs['consensus']['community_rank'] ?? null,
            $latestAiAssessment['recommended_taxon']['rank'] ?? null,
            $latestAiAssessment['best_specific_taxon']['rank'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            $value = strtolower(trim((string)$candidate));
            if ($value !== '') {
                return $value;
            }
        }

        return 'unknown';
    }

    private static function isSpeciesOrBelow(string $rank): bool
    {
        return in_array($rank, ['species', 'subspecies', 'variety', 'form'], true);
    }

    private static function replace(string $template, array $vars): string
    {
        $pairs = [];
        foreach ($vars as $key => $value) {
            $pairs['{' . $key . '}'] = $value;
        }

        return strtr($template, $pairs);
    }
}
