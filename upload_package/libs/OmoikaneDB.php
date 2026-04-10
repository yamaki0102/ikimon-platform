<?php

/**
 * Project OMOIKANE - SQLite Knowledge Graph Helper
 * Manages the connection and schema for the 1 million species database.
 */

class OmoikaneDB
{
    private $pdo;
    private $dbPath;

    public function __construct($dbPath = __DIR__ . '/../data/library/omoikane.sqlite3')
    {
        $this->dbPath = $dbPath;
        $this->connect();
        $this->initializeSchema();
    }

    private function connect()
    {
        $dsn = 'sqlite:' . $this->dbPath;
        try {
            $this->pdo = new PDO($dsn);
            $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

            // Enable Foreign Keys
            $this->pdo->exec('PRAGMA foreign_keys = ON;');
            // Optimize for speed and concurrency during the daemon extraction
            $this->pdo->exec('PRAGMA journal_mode = WAL;');
            $this->pdo->exec('PRAGMA synchronous = NORMAL;');
            // CRITICAL: Wait up to 30s for locks instead of failing immediately
            // Without this, concurrent workers get instant "database is locked" errors
            $this->pdo->exec('PRAGMA busy_timeout = 30000;');
        } catch (PDOException $e) {
            die("OMOIKANE Database Connection Failed: " . $e->getMessage() . "\n");
        }
    }

    private function initializeSchema()
    {
        // Table: species (The Core Hub)
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS species (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scientific_name TEXT UNIQUE NOT NULL,
                distillation_status TEXT DEFAULT 'pending',
                last_distilled_at DATETIME,
                source_citations TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");

        // Auto-upgrade for existing databases
        try {
            $this->pdo->exec("ALTER TABLE species ADD COLUMN source_citations TEXT;");
        } catch (PDOException $e) { /* already exists */ }
        try {
            $this->pdo->exec("ALTER TABLE species ADD COLUMN japanese_name TEXT;");
        } catch (PDOException $e) { /* already exists */ }
        try {
            // knowledge_coverage: 'none' | 'basic' | 'rich'
            // none  = claims 0件, basic = 1-4件, rich = 5件以上
            $this->pdo->exec("ALTER TABLE species ADD COLUMN knowledge_coverage TEXT DEFAULT 'none';");
        } catch (PDOException $e) { /* already exists */ }
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_japanese_name ON species(japanese_name);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_knowledge_coverage ON species(knowledge_coverage);");

        // Table: ecological_constraints (The Searchable Dimensions)
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS ecological_constraints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                species_id INTEGER NOT NULL,
                habitat TEXT,
                altitude TEXT,
                season TEXT,
                notes TEXT,
                FOREIGN KEY (species_id) REFERENCES species(id) ON DELETE CASCADE,
                UNIQUE(species_id)
            )
        ");

        // Table: identification_keys (The Morphological Differentiators)
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS identification_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                species_id INTEGER NOT NULL,
                morphological_traits TEXT,
                similar_species TEXT,
                key_differences TEXT,
                FOREIGN KEY (species_id) REFERENCES species(id) ON DELETE CASCADE,
                UNIQUE(species_id)
            )
        ");


        // Table: specimen_records (Museum Specimen Data from GBIF)
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS specimen_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                species_id INTEGER NOT NULL,
                gbif_occurrence_key TEXT,
                institution_code TEXT,
                collection_code TEXT,
                catalog_number TEXT,
                recorded_by TEXT,
                event_date TEXT,
                country TEXT,
                locality TEXT,
                decimal_latitude REAL,
                decimal_longitude REAL,
                basis_of_record TEXT DEFAULT 'PRESERVED_SPECIMEN',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (species_id) REFERENCES species(id) ON DELETE CASCADE,
                UNIQUE(gbif_occurrence_key)
            )
        ");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_specimen_species ON specimen_records(species_id);");

        // Table: trust_scores (Quality Gate for distilled data)
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS trust_scores (
                species_id INTEGER PRIMARY KEY,
                trust_score REAL DEFAULT 0.0,
                source_count INTEGER DEFAULT 0,
                trusted_source_count INTEGER DEFAULT 0,
                field_completeness REAL DEFAULT 0.0,
                inferred_ratio REAL DEFAULT 0.0,
                computed_at DATETIME,
                FOREIGN KEY (species_id) REFERENCES species(id) ON DELETE CASCADE
            )
        ");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_trust_score ON trust_scores(trust_score);");

        // Table: papers (Phase 2 — 論文メタデータ。PaperStore JSON→SQLite移行)
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS papers (
                doi TEXT PRIMARY KEY,
                title TEXT,
                authors TEXT,
                year INTEGER,
                journal TEXT,
                source TEXT DEFAULT 'gbif_lit',
                abstract TEXT,
                language TEXT DEFAULT 'ja',
                url TEXT,
                subjects TEXT,
                ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                distilled_at DATETIME,
                distill_status TEXT DEFAULT 'pending'
            )
        ");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_papers_year ON papers(year);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_papers_source ON papers(source);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_papers_distill ON papers(distill_status);");

        // Table: paper_taxa (Phase 2 — 論文-種マッピング。TaxonPaperIndex JSON→SQLite移行)
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS paper_taxa (
                doi TEXT NOT NULL,
                taxon_key TEXT NOT NULL,
                confidence REAL DEFAULT 1.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (doi, taxon_key)
            )
        ");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_paper_taxa_taxon ON paper_taxa(taxon_key);");

        // Table: distilled_knowledge (Phase 2 — 蒸留結果。生態制約 + 同定キー)
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS distilled_knowledge (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doi TEXT,
                taxon_key TEXT NOT NULL,
                knowledge_type TEXT NOT NULL,
                content TEXT,
                confidence REAL DEFAULT 0.0,
                reviewed_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_dk_taxon ON distilled_knowledge(taxon_key);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_dk_type ON distilled_knowledge(knowledge_type);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_dk_doi ON distilled_knowledge(doi);");

        // --- Reverse-Lookup Indexes ---
        // These indexes allow extremely fast querying (e.g. "Find all species in 'Forest' above '1000m' during 'Summer'")
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_scientific_name ON species(scientific_name);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_habitat ON ecological_constraints(habitat);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_season ON ecological_constraints(season);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_altitude ON ecological_constraints(altitude);");

        // Table: claims (Phase 4 — sentence-level grounding 用の claim/根拠分離モデル)
        //
        // distilled_knowledge が paragraph 単位の blob なのに対し、
        // claims は「1つの主張 + その根拠」という最小単位で保存する。
        //
        // claim_type: 'habitat' | 'season' | 'conservation' | 'distribution' | 'morphology' | 'behavior'
        // source_tier: 'A' (査読論文・環境省) | 'B' (大学・学会) | 'C' (未検証)
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS claims (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                taxon_key TEXT NOT NULL,
                claim_type TEXT NOT NULL,
                claim_text TEXT NOT NULL,
                source_tier TEXT DEFAULT 'B',
                doi TEXT,
                source_title TEXT,
                region_scope TEXT,
                confidence REAL DEFAULT 0.5,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_claims_taxon ON claims(taxon_key);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_claims_type ON claims(claim_type);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_claims_tier ON claims(source_tier);");
        // claim_hash: taxon_key + claim_type + claim_text の md5。重複 claim 防止に使う。
        try {
            $this->pdo->exec("ALTER TABLE claims ADD COLUMN claim_hash TEXT;");
        } catch (PDOException $e) { /* already exists */ }
        try {
            $this->pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_hash ON claims(claim_hash) WHERE claim_hash IS NOT NULL;");
        } catch (PDOException $e) { /* already exists */ }

        // Table: redlist_assessments — グローバル保全ステータス統合テーブル
        //
        // 設計原則:
        //   1. MECE地理スコープ: global → regional → national → subnational_1 → subnational_2
        //   2. 100年耐性: 行政コードは便宜。地理アンカー(重心座標)で永続的に位置を特定
        //   3. 時点スナップショット: 行政区画名は評価時点の名称を保存（合併・分割を追跡可能）
        //   4. IUCN準拠カテゴリ: EX/EW/CR/EN/VU/NT/LC/DD/NE + 地域拡張(LP)
        //
        // scope_level MECE階層:
        //   'global'        — IUCN Red List (country_code=NULL)
        //   'regional'      — EU Red Lists, ASEAN etc.
        //   'national'      — 環境省, US ESA, etc.
        //   'subnational_1' — 都道府県 / State / Province
        //   'subnational_2' — 市区町村 / Municipality / County
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS redlist_assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,

                -- Taxon identification (multiple keys for resilience)
                taxon_key INTEGER,
                scientific_name TEXT NOT NULL,
                japanese_name TEXT,
                common_name_en TEXT,

                -- IUCN-compatible assessment
                category TEXT NOT NULL,
                criteria TEXT,

                -- MECE Geographic Scope (hierarchical)
                scope_level TEXT NOT NULL,
                country_code TEXT,
                region_code TEXT,
                municipality_code TEXT,

                -- 100-year resilience: human-readable names + geographic anchor
                scope_name TEXT NOT NULL,
                scope_name_en TEXT,
                scope_centroid_lat REAL,
                scope_centroid_lng REAL,
                parent_scope_name TEXT,
                scope_valid_from TEXT,
                scope_valid_until TEXT,
                scope_note TEXT,

                -- Source provenance
                authority TEXT NOT NULL,
                source_url TEXT,
                assessment_year INTEGER,
                version TEXT,

                -- Taxonomy
                taxon_group TEXT,
                taxon_group_en TEXT,

                -- Metadata
                notes TEXT,
                imported_at TEXT DEFAULT (datetime('now')),

                -- Dedup key: computed on INSERT via import script
                dedup_key TEXT UNIQUE
            )
        ");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_redlist_taxon_key ON redlist_assessments(taxon_key);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_redlist_sciname ON redlist_assessments(scientific_name);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_redlist_janame ON redlist_assessments(japanese_name);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_redlist_category ON redlist_assessments(category);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_redlist_scope ON redlist_assessments(scope_level, country_code);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_redlist_region ON redlist_assessments(region_code);");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_redlist_municipality ON redlist_assessments(municipality_code);");
    }

    public function getPDO()
    {
        return $this->pdo;
    }

    /**
     * claims テーブルの件数に基づいて species.knowledge_coverage を更新する。
     * none=0件, basic=1-4件, rich=5件以上。
     * 引数は学名 or taxon_key (species.id の文字列表現)。
     */
    public function refreshKnowledgeCoverage(string $taxonKey): void
    {
        try {
            $stmt = $this->pdo->prepare("
                SELECT COUNT(*) FROM claims
                WHERE taxon_key = :key
                  AND claim_type IN ('identification_pitfall','photo_target','hybridization',
                                     'cultural','ecology_trivia','taxonomy_note','regional_variation')
            ");
            $stmt->execute([':key' => $taxonKey]);
            $count = (int)$stmt->fetchColumn();

            $coverage = match(true) {
                $count >= 5 => 'rich',
                $count >= 1 => 'basic',
                default     => 'none',
            };

            $this->pdo->prepare("
                UPDATE species SET knowledge_coverage = :cov
                WHERE scientific_name = :key OR CAST(id AS TEXT) = :key2
            ")->execute([':cov' => $coverage, ':key' => $taxonKey, ':key2' => $taxonKey]);
        } catch (\Throwable $e) {
            // non-fatal
        }
    }
}
