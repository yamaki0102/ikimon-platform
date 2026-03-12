<?php

class SpeciesNarrative
{
    public static function build(array $context): array
    {
        $messages = (array)($context['messages'] ?? []);
        $blocks = [];

        $taxonomyText = self::buildTaxonomyText(
            trim((string)($context['display_name'] ?? '')),
            trim((string)($context['rank'] ?? '')),
            $messages
        );
        if ($taxonomyText !== null) {
            $blocks[] = [
                'label' => $messages['label_taxonomy'] ?? '分類として',
                'icon' => 'network',
                'text' => $taxonomyText,
            ];
        }

        $observationText = self::buildObservationText(
            (int)($context['observation_count'] ?? 0),
            (array)($context['month_counts'] ?? []),
            (int)($context['mapped_location_count'] ?? 0),
            $messages
        );
        if ($observationText !== null) {
            $blocks[] = [
                'label' => $messages['label_observation'] ?? '観察から',
                'icon' => 'binoculars',
                'text' => $observationText,
            ];
        }

        $literatureText = self::buildLiteratureText(
            (int)($context['citation_count'] ?? 0),
            (int)($context['paper_count'] ?? 0),
            (int)($context['specimen_count'] ?? 0),
            (bool)($context['has_redlist'] ?? false),
            $messages
        );
        if ($literatureText !== null) {
            $blocks[] = [
                'label' => $messages['label_literature'] ?? '文献・標本から',
                'icon' => 'library',
                'text' => $literatureText,
            ];
        }

        $distilledText = self::buildDistilledText((array)($context['distilled'] ?? []), $messages);
        if ($distilledText !== null) {
            $blocks[] = [
                'label' => $messages['label_distilled'] ?? '整理メモから',
                'icon' => 'notebook-tabs',
                'text' => $distilledText,
            ];
        }

        $note = count($blocks) <= 1
            ? ($messages['note_single'] ?? 'このページの要約は、今ある材料だけで組み立てています。記録や文献が増えると内容も育ちます。')
            : ($messages['note_multi'] ?? 'この要約は、観察・文献・標本・整理メモのうち、ページ内にある材料だけで組み立てています。');

        return [
            'intro' => $messages['intro'] ?? '最初に、いま分かっていることを短くまとめています。',
            'blocks' => $blocks,
            'note' => $note,
        ];
    }

    private static function buildTaxonomyText(string $displayName, string $rank, array $messages): ?string
    {
        if ($displayName === '') {
            return null;
        }

        $rankLabels = [
            'species' => $messages['rank_species'] ?? '種',
            'genus' => $messages['rank_genus'] ?? '属',
            'family' => $messages['rank_family'] ?? '科',
            'order' => $messages['rank_order'] ?? '目',
            'class' => $messages['rank_class'] ?? '綱',
            'phylum' => $messages['rank_phylum'] ?? '門',
            'kingdom' => $messages['rank_kingdom'] ?? '界',
        ];
        $rankLabel = $rankLabels[strtolower($rank)] ?? ($messages['rank_generic'] ?? '分類群');

        return self::fill($messages['taxonomy_text'] ?? '{name} は {rank} レベルのまとまりです。このページでは、近い仲間の記録をまとめて見られます。', [
            '{name}' => $displayName,
            '{rank}' => $rankLabel,
        ]);
    }

    private static function buildObservationText(int $observationCount, array $monthCounts, int $mappedLocationCount, array $messages): ?string
    {
        if ($observationCount <= 0) {
            return null;
        }

        $parts = [self::fill($messages['obs_count'] ?? '{count}件の観察があります。', [
            '{count}' => (string)$observationCount,
        ])];

        $peakMonths = self::pickPeakMonths($monthCounts, $messages);
        if (!empty($peakMonths)) {
            $parts[] = self::fill($messages['obs_peak'] ?? '{months}の記録が目立ちます。', [
                '{months}' => implode($messages['list_separator'] ?? '・', $peakMonths),
            ]);
        }

        if ($mappedLocationCount > 0) {
            $parts[] = self::fill($messages['obs_map'] ?? '地図には{count}地点の記録があります。', [
                '{count}' => (string)$mappedLocationCount,
            ]);
        }

        return implode(' ', $parts);
    }

    private static function buildLiteratureText(int $citationCount, int $paperCount, int $specimenCount, bool $hasRedlist, array $messages): ?string
    {
        $parts = [];
        if ($citationCount > 0) {
            $parts[] = self::fill($messages['lit_citations'] ?? '図鑑文献{count}件', [
                '{count}' => (string)$citationCount,
            ]);
        }
        if ($paperCount > 0) {
            $parts[] = self::fill($messages['lit_papers'] ?? '論文{count}件', [
                '{count}' => (string)$paperCount,
            ]);
        }
        if ($specimenCount > 0) {
            $parts[] = self::fill($messages['lit_specimens'] ?? '標本{count}件', [
                '{count}' => (string)$specimenCount,
            ]);
        }
        if (empty($parts) && !$hasRedlist) {
            return null;
        }

        $text = [];
        if (!empty($parts)) {
            $text[] = self::fill($messages['lit_linked'] ?? '{items}をひも付けています。', [
                '{items}' => implode($messages['item_separator'] ?? '、', $parts),
            ]);
        }
        if ($hasRedlist) {
            $text[] = $messages['lit_redlist'] ?? '保全状況の情報も確認できます。';
        }

        return implode(' ', $text);
    }

    private static function buildDistilledText(array $distilled, array $messages): ?string
    {
        $eco = (array)($distilled['ecological_constraints'] ?? []);
        $habitats = array_values(array_filter((array)($eco['habitat'] ?? []), 'strlen'));
        $seasons = array_values(array_filter((array)($eco['active_season'] ?? []), 'strlen'));
        $notes = array_values(array_filter((array)($eco['notes'] ?? []), 'strlen'));

        $parts = [];
        if (!empty($habitats)) {
            $parts[] = self::fill($messages['distilled_habitat'] ?? '環境の手がかりは {items} です。', [
                '{items}' => implode($messages['list_separator'] ?? '・', array_slice($habitats, 0, 3)),
            ]);
        }
        if (!empty($seasons)) {
            $parts[] = self::fill($messages['distilled_season'] ?? '活動期の手がかりは {items} です。', [
                '{items}' => implode($messages['list_separator'] ?? '・', array_slice($seasons, 0, 3)),
            ]);
        }
        if (!empty($notes)) {
            $parts[] = self::shorten($notes[0], 72);
        }

        return empty($parts) ? null : implode(' ', $parts);
    }

    private static function pickPeakMonths(array $monthCounts, array $messages): array
    {
        $counts = [];
        foreach ($monthCounts as $month => $count) {
            $count = (int)$count;
            if ($count > 0) {
                $counts[(int)$month] = $count;
            }
        }
        if (empty($counts)) {
            return [];
        }

        arsort($counts);
        $top = array_slice($counts, 0, 2, true);
        $labels = [];
        foreach (array_keys($top) as $month) {
            $labels[] = self::fill($messages['month_label'] ?? '{month}月', [
                '{month}' => (string)$month,
            ]);
        }
        return $labels;
    }

    private static function shorten(string $text, int $length): string
    {
        $text = trim(preg_replace('/\s+/', ' ', $text));
        if (mb_strlen($text) <= $length) {
            return $text;
        }
        return mb_substr($text, 0, $length - 1) . '…';
    }

    private static function fill(string $template, array $replacements): string
    {
        return strtr($template, $replacements);
    }
}
