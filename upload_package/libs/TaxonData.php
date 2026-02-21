<?php

/**
 * TaxonData — 分類データの値オブジェクト
 * 
 * 設計書 taxonomy_database_design.md v3.0 Phase A 準拠。
 * ローカルリゾルバー、iNaturalist API、GBIF API の
 * いずれのソースからも統一構造に変換する。
 */
class TaxonData
{
    public string $slug = '';
    public string $scientificName = '';
    public string $rank = 'species';
    public array $commonNames = [];      // ['ja' => '...', 'en' => '...']
    public ?array $lineage = null;       // ['kingdom'=>..., 'phylum'=>..., ...]
    public ?int $gbifKey = null;
    public ?int $inatTaxonId = null;
    public ?string $thumbnailUrl = null;
    public string $source = 'local';     // 'local' | 'inat' | 'gbif'
    public float $confidence = 1.0;      // 0.0-1.0

    /**
     * ローカルリゾルバーデータから生成
     */
    public static function fromResolver(array $data): self
    {
        $t = new self();
        $t->slug = $data['slug'] ?? '';
        $t->scientificName = $data['accepted_name'] ?? '';
        $t->rank = $data['rank'] ?? 'species';
        $t->gbifKey = isset($data['gbif_key']) ? (int)$data['gbif_key'] : null;
        $t->source = 'local';
        $t->confidence = 1.0;

        // 和名がある場合
        if (!empty($data['ja_name'])) {
            $t->commonNames['ja'] = $data['ja_name'];
        }

        return $t;
    }

    /**
     * iNaturalist Taxa API レスポンスから生成
     * 
     * iNat API shape: {
     *   id: int,
     *   name: string,             // 学名
     *   rank: string,             // "species", "genus" etc.
     *   preferred_common_name: string,  // ロケール依存
     *   default_photo: { square_url: string },
     *   iconic_taxon_name: string,
     *   ancestors: [{ id, name, rank }]
     * }
     */
    public static function fromINat(array $r): self
    {
        $t = new self();
        $t->scientificName = $r['name'] ?? '';
        $t->slug = self::makeSlug($t->scientificName);
        $t->rank = $r['rank'] ?? 'species';
        $t->inatTaxonId = isset($r['id']) ? (int)$r['id'] : null;
        $t->source = 'inat';
        $t->confidence = 0.9;

        // 代表画像
        if (!empty($r['default_photo']['square_url'])) {
            $t->thumbnailUrl = $r['default_photo']['square_url'];
        }

        // 和名 / 英名
        if (!empty($r['preferred_common_name'])) {
            // ロケール依存 — 呼び出し時に locale=ja なら日本語名
            $t->commonNames['ja'] = $r['preferred_common_name'];
        }
        if (!empty($r['english_common_name'])) {
            $t->commonNames['en'] = $r['english_common_name'];
        }

        // 系統情報（ancestors）
        if (!empty($r['ancestors']) && is_array($r['ancestors'])) {
            $t->lineage = self::buildLineageFromINat($r['ancestors']);
        }

        return $t;
    }

    /**
     * GBIF Species API レスポンスから生成
     * 
     * GBIF suggest shape: {
     *   key: int,
     *   canonicalName: string,
     *   scientificName: string,
     *   rank: string,        // "SPECIES", "GENUS" etc.
     *   kingdom, phylum, class, order, family, genus
     * }
     */
    public static function fromGBIF(array $r): self
    {
        $t = new self();
        $t->scientificName = $r['canonicalName'] ?? ($r['scientificName'] ?? '');
        $t->slug = self::makeSlug($t->scientificName);
        $t->rank = strtolower($r['rank'] ?? 'species');
        $t->gbifKey = isset($r['key']) ? (int)$r['key'] : null;
        $t->source = 'gbif';
        $t->confidence = 0.8;

        // GBIF は系統情報をフラットフィールドで返す
        $t->lineage = array_filter([
            'kingdom' => $r['kingdom'] ?? null,
            'phylum'  => $r['phylum'] ?? null,
            'class'   => $r['class'] ?? null,
            'order'   => $r['order'] ?? null,
            'family'  => $r['family'] ?? null,
            'genus'   => $r['genus'] ?? null,
        ]);

        return $t;
    }

    /**
     * 配列に変換（内部保存用）
     */
    public function toArray(): array
    {
        return [
            'slug'           => $this->slug,
            'scientific_name' => $this->scientificName,
            'rank'           => $this->rank,
            'common_names'   => $this->commonNames,
            'lineage'        => $this->lineage,
            'gbif_key'       => $this->gbifKey,
            'inat_taxon_id'  => $this->inatTaxonId,
            'thumbnail_url'  => $this->thumbnailUrl,
            'source'         => $this->source,
            'confidence'     => $this->confidence,
        ];
    }

    /**
     * 観察レコード埋込用の taxon フィールド
     * 後方互換: 旧 {id, name, scientific_name, slug} を包含
     */
    public function toObservationTaxon(): array
    {
        return [
            'id'              => $this->gbifKey,
            'name'            => $this->commonNames['ja'] ?? $this->scientificName,
            'scientific_name' => $this->scientificName,
            'slug'            => $this->slug,
            'rank'            => $this->rank,
            'inat_taxon_id'   => $this->inatTaxonId,
            'source'          => $this->source,
            'thumbnail_url'   => $this->thumbnailUrl,
        ];
    }

    /**
     * 検索候補として返すサマリ配列
     */
    public function toSearchResult(): array
    {
        return [
            'slug'           => $this->slug,
            'scientific_name' => $this->scientificName,
            'rank'           => $this->rank,
            'ja_name'        => $this->commonNames['ja'] ?? '',
            'en_name'        => $this->commonNames['en'] ?? '',
            'thumbnail_url'  => $this->thumbnailUrl,
            'gbif_key'       => $this->gbifKey,
            'inat_taxon_id'  => $this->inatTaxonId,
            'source'         => $this->source,
            'confidence'     => $this->confidence,
        ];
    }

    // --- Private Helpers ---

    /**
     * 学名からURLスラグを生成
     */
    private static function makeSlug(string $name): string
    {
        $slug = strtolower(trim($name));
        $slug = preg_replace('/[^a-z0-9\s\-]/', '', $slug);
        $slug = preg_replace('/\s+/', '-', $slug);
        return $slug;
    }

    /**
     * iNat ancestors 配列から lineage マップを構築
     */
    private static function buildLineageFromINat(array $ancestors): array
    {
        $lineage = [];
        $rankMap = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus'];
        foreach ($ancestors as $a) {
            $rank = strtolower($a['rank'] ?? '');
            if (in_array($rank, $rankMap)) {
                $lineage[$rank] = $a['name'] ?? '';
            }
        }
        return $lineage;
    }
}
