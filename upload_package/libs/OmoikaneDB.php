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

        // Auto-upgrade for existing databases to support CC-BY-SA compliance citations
        try {
            $this->pdo->exec("ALTER TABLE species ADD COLUMN source_citations TEXT;");
        } catch (PDOException $e) {
            // Column likely already exists, ignore safely
        }

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
