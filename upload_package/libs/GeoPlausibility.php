<?php

/**
 * GeoPlausibility
 *
 * 日本国内の FieldScan 候補に対して、地域妥当性の粗いガードをかける。
 * - 外来定着種や逸出可能種は残す
 * - 現実的にほぼ不可能な候補だけ implausible として落とす
 */
class GeoPlausibility
{
    private const COUNTRY_JAPAN = ['japan', 'jpn', 'jp', '日本'];

    private const ALIEN_ESTABLISHED = [
        'leiothrix lutea' => '定着外来種として知られる',
        'garrulax canorus' => '定着外来種として知られる',
        'akepa?'=> '',
        'pycnonotus sinensis' => '外来定着の記録がある',
        'lonchura punctulata' => '移入個体群の記録がある',
        'trachemys scripta elegans' => '定着外来種として広く見られる',
        'procambarus clarkii' => '定着外来種として広く見られる',
        'xenopus laevis' => '定着外来種の記録がある',
    ];

    private const ESCAPE_POSSIBLE = [
        'melopsittacus undulatus' => '飼育逸出の可能性がある',
        'nymphicus hollandicus' => '飼育逸出の可能性がある',
        'agapornis roseicollis' => '飼育逸出の可能性がある',
        'amazona amazonica' => '飼育逸出の可能性がある',
        'amazona farinosa' => '飼育逸出の可能性がある',
        'amazona kawalli' => '飼育逸出の可能性がある',
        'psittacara euops' => '飼育逸出の可能性がある',
    ];

    private const IMPLAUSIBLE_EXACT = [
        'aptenodytes forsteri' => '日本のフィールド記録としては現実的でない',
        'alligator mississippiensis' => '日本の野外記録としては現実的でない',
        'alouatta caraya' => '日本の野外記録としては現実的でない',
        'aquila africana' => '日本の野外記録としては現実的でない',
        'actinodura ramsayi' => '日本の野外記録としては現実的でない',
        'amblyornis macgregoriae' => '日本の野外記録としては現実的でない',
    ];

    private const IMPLAUSIBLE_COMMON = [
        'emperor penguin' => '日本のフィールド記録としては現実的でない',
        'american alligator' => '日本の野外記録としては現実的でない',
        'black howler monkey' => '日本の野外記録としては現実的でない',
    ];

    public static function assess(array $event, array $geo = []): array
    {
        $country = self::normalize((string)($geo['country'] ?? ''));
        if (!self::isJapan($country)) {
            return self::result('plausible', 0.8, '地域フィルタ未適用');
        }

        $scientific = self::normalize((string)($event['scientific_name'] ?? ''));
        $common = self::normalize((string)($event['taxon_name'] ?? ''));

        if ($scientific !== '' && isset(self::ALIEN_ESTABLISHED[$scientific])) {
            return self::result('alien_established', 0.7, self::ALIEN_ESTABLISHED[$scientific]);
        }
        if ($scientific !== '' && isset(self::ESCAPE_POSSIBLE[$scientific])) {
            return self::result('escape_possible', 0.45, self::ESCAPE_POSSIBLE[$scientific]);
        }
        if ($scientific !== '' && isset(self::IMPLAUSIBLE_EXACT[$scientific])) {
            return self::result('implausible', 0.05, self::IMPLAUSIBLE_EXACT[$scientific]);
        }
        if ($common !== '' && isset(self::IMPLAUSIBLE_COMMON[$common])) {
            return self::result('implausible', 0.05, self::IMPLAUSIBLE_COMMON[$common]);
        }

        return self::result('plausible', 0.9, '地域妥当性フィルタを通過');
    }

    private static function result(string $status, float $score, string $note): array
    {
        return [
            'status' => $status,
            'score' => $score,
            'note' => $note,
        ];
    }

    private static function isJapan(string $country): bool
    {
        return in_array($country, self::COUNTRY_JAPAN, true);
    }

    private static function normalize(string $value): string
    {
        $value = trim(mb_strtolower($value, 'UTF-8'));
        $value = preg_replace('/\s+/', ' ', $value) ?? $value;
        return $value;
    }
}
