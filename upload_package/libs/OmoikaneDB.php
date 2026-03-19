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
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_japanese_name ON species(japanese_name);");

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
    }

    public function getPDO()
    {
        return $this->pdo;
    }
}
