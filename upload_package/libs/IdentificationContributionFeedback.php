<?php

final class IdentificationContributionFeedback
{
    public static function buildForObservation(array $obs): array
    {
        $identifications = self::normalizedIdentifications($obs);
        if ($identifications === []) {
            return [];
        }

        $firstId = (string)($identifications[0]['id'] ?? '');
        $count = count($identifications);

        $result = [];
        foreach ($identifications as $ident) {
            $id = (string)($ident['id'] ?? '');
            if ($id === '') {
                continue;
            }
            $result[$id] = self::buildFeedback($obs, $ident, $firstId, $count);
        }

        return $result;
    }

    public static function buildTimeline(array $obs, int $limit = 4): array
    {
        $identifications = self::normalizedIdentifications($obs);
        if ($identifications === []) {
            return [];
        }

        $firstId = (string)($identifications[0]['id'] ?? '');
        $count = count($identifications);
        $timeline = [];

        foreach ($identifications as $ident) {
            $id = (string)($ident['id'] ?? '');
            if ($id === '') {
                continue;
            }

            $feedback = self::buildFeedback($obs, $ident, $firstId, $count);
            $timeline[] = [
                'id' => $id,
                'tone' => (string)($feedback['tone'] ?? 'sky'),
                'title' => (string)($feedback['title'] ?? ''),
                'body' => (string)($feedback['body'] ?? ''),
                'actor_name' => (string)($ident['user_name'] ?? __('observation_page.community', 'Community')),
                'at' => (string)($ident['created_at'] ?? ''),
                'taxon_name' => (string)($ident['taxon_name'] ?? ''),
            ];
        }

        usort($timeline, static function (array $a, array $b): int {
            return strcmp((string)($b['at'] ?? ''), (string)($a['at'] ?? ''));
        });

        return array_slice($timeline, 0, max(1, $limit));
    }

    private static function defaultFeedback(): array
    {
        return [
            'tone' => 'sky',
            'title' => __('observation_page.id_feedback_default_title', 'One more review clue'),
            'body' => __('observation_page.id_feedback_default_body', 'This suggestion gives the community one more concrete angle to compare and refine later.'),
        ];
    }

    private static function replace(string $template, array $vars): string
    {
        $pairs = [];
        foreach ($vars as $key => $value) {
            $pairs['{' . $key . '}'] = $value;
        }

        return strtr($template, $pairs);
    }

    private static function normalizedIdentifications(array $obs): array
    {
        $identifications = array_values(array_filter($obs['identifications'] ?? [], fn($ident) => is_array($ident)));
        usort($identifications, static function (array $a, array $b): int {
            return strcmp((string)($a['created_at'] ?? ''), (string)($b['created_at'] ?? ''));
        });

        return $identifications;
    }

    private static function buildFeedback(array $obs, array $ident, string $firstId, int $count): array
    {
        $status = BioUtils::displayStatus($obs, '未同定');
        $consensusTaxon = (string)($obs['taxon']['name'] ?? '');
        $communitySupporters = (int)($obs['consensus']['community_supporters'] ?? 0);
        $hasConflict = !empty($obs['quality_flags']['has_lineage_conflict']);
        $taxonName = (string)($ident['taxon_name'] ?? '');
        $confidence = (string)($ident['confidence'] ?? 'likely');
        $evidenceType = (string)($ident['evidence']['type'] ?? 'visual');
        $trustLevel = TrustLevel::calculate((string)($ident['user_id'] ?? ''));
        $matchesConsensus = $consensusTaxon !== '' && $taxonName !== '' && $taxonName === $consensusTaxon;
        $isTrustedLane = in_array($status, ['研究利用可', '種レベル研究用'], true);
        $id = (string)($ident['id'] ?? '');

        if ($id === $firstId && $count === 1) {
            return [
                'tone' => 'sky',
                'title' => __('observation_page.id_feedback_first_title', 'First clue created'),
                'body' => __('observation_page.id_feedback_first_body', 'This suggestion gave the record its first grounded starting point for later review.'),
            ];
        }

        if ($matchesConsensus && $isTrustedLane) {
            return [
                'tone' => 'emerald',
                'title' => __('observation_page.id_feedback_trusted_title', 'Trusted lane reinforced'),
                'body' => __('observation_page.id_feedback_trusted_body', 'This suggestion is aligned with the current trusted lane and helps keep the record reusable later.'),
            ];
        }

        if ($matchesConsensus && $communitySupporters >= 2) {
            return [
                'tone' => 'emerald',
                'title' => __('observation_page.id_feedback_stable_title', 'Consensus became easier to hold'),
                'body' => self::replace(
                    __('observation_page.id_feedback_stable_body', 'This suggestion now sits with {count} community checks on the same direction.'),
                    ['count' => (string)$communitySupporters]
                ),
            ];
        }

        if ($hasConflict && !$matchesConsensus) {
            return [
                'tone' => 'amber',
                'title' => __('observation_page.id_feedback_conflict_title', 'Review stayed open'),
                'body' => __('observation_page.id_feedback_conflict_body', 'This different view keeps the record from closing too early and signals that more evidence is needed.'),
            ];
        }

        if ($confidence === 'literature' || $evidenceType === 'reference') {
            return [
                'tone' => 'violet',
                'title' => __('observation_page.id_feedback_reference_title', 'Reference lane added'),
                'body' => __('observation_page.id_feedback_reference_body', 'This suggestion adds a literature or field-guide angle that later review can compare against the photos.'),
            ];
        }

        if ($trustLevel >= TrustLevel::LEVEL_EXPERT) {
            return [
                'tone' => 'emerald',
                'title' => __('observation_page.id_feedback_expert_title', 'Expert review signal'),
                'body' => __('observation_page.id_feedback_expert_body', 'This suggestion comes from the expert lane and gives later review a stronger anchor.'),
            ];
        }

        return self::defaultFeedback();
    }
}
