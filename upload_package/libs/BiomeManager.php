<?php

class BiomeManager
{
    // Biome Definitions
    public const LIST = [
        'forest' => [
            'label' => '森林',
            'icon' => 'trees',
            'description' => '木々が生い茂る場所（雑木林、鎮守の森など）'
        ],
        'grassland' => [
            'label' => '草地・河川敷',
            'icon' => 'wind',
            'description' => '草に覆われた開けた場所'
        ],
        'wetland' => [
            'label' => '湿地・水辺',
            'icon' => 'droplets',
            'description' => '池、沼、湿原、水田など'
        ],
        'coastal' => [
            'label' => '海岸・干潟',
            'icon' => 'waves',
            'description' => '海に面した砂浜や岩場'
        ],
        'urban' => [
            'label' => '都市・公園',
            'icon' => 'building-2',
            'description' => '建物や舗装が多い場所、都市公園'
        ],
        'farmland' => [
            'label' => '農地・里山',
            'icon' => 'wheat',
            'description' => '畑、果樹園、里山環境'
        ],
        'unknown' => [
            'label' => '不明',
            'icon' => 'help-circle',
            'description' => '判断できない場合'
        ]
    ];

    /**
     * Get all biomes
     * @return array
     */
    public static function getAll(): array
    {
        return self::LIST;
    }

    /**
     * Validate biome key
     * @param string $key
     * @return bool
     */
    public static function isValid(string $key): bool
    {
        return array_key_exists($key, self::LIST);
    }

    /**
     * Get label for a biome key
     * @param string $key
     * @return string
     */
    public static function getLabel(string $key): string
    {
        return self::LIST[$key]['label'] ?? '不明';
    }
}
