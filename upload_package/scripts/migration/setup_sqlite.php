<?php
/**
 * FB-06: SQLite Database Schema Setup
 * Creates all tables for ikimon data storage
 * 
 * Usage: php scripts/setup_sqlite.php
 */

require_once __DIR__ . '/../config/config.php';

$dbPath = DATA_DIR . '/ikimon.db';

echo "Creating SQLite database at: $dbPath\n";

try {
    // Create database connection
    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('PRAGMA foreign_keys = ON');
    $db->exec('PRAGMA journal_mode = WAL'); // Better concurrent access
    
    // ========================================
    // Users Table
    // ========================================
    $db->exec("
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            avatar TEXT,
            rank TEXT DEFAULT 'Observer',
            score INTEGER DEFAULT 0,
            post_count INTEGER DEFAULT 0,
            id_count INTEGER DEFAULT 0,
            badges TEXT, -- JSON array
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_users_rank ON users(rank)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_users_score ON users(score DESC)");
    echo "✓ Created users table\n";
    
    // ========================================
    // Observations Table (Darwin Core aligned)
    // ========================================
    $db->exec("
        CREATE TABLE IF NOT EXISTS observations (
            -- Core
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            
            -- Occurrence (Darwin Core)
            observed_at DATETIME NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            coordinate_uncertainty INTEGER, -- meters
            
            -- Taxon
            taxon_key INTEGER,
            taxon_name TEXT,
            scientific_name TEXT,
            kingdom TEXT,
            phylum TEXT,
            class TEXT,
            family TEXT,
            genus TEXT,
            
            -- Conservation
            redlist_status TEXT,
            is_protected INTEGER DEFAULT 0,
            
            -- Status
            status TEXT DEFAULT 'Needs ID',
            cultivation TEXT DEFAULT 'wild',
            note TEXT,
            
            -- Site (B2B)
            site_id TEXT,
            site_name TEXT,
            
            -- Media (JSON array of paths)
            photos TEXT,
            
            -- Timestamps
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_obs_user ON observations(user_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_obs_status ON observations(status)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_obs_site ON observations(site_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_obs_taxon ON observations(taxon_key)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_obs_location ON observations(lat, lng)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_obs_date ON observations(observed_at DESC)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_obs_created ON observations(created_at DESC)");
    echo "✓ Created observations table\n";
    
    // ========================================
    // Identifications Table
    // ========================================
    $db->exec("
        CREATE TABLE IF NOT EXISTS identifications (
            id TEXT PRIMARY KEY,
            observation_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            user_name TEXT,
            user_avatar TEXT,
            
            -- Taxon info
            taxon_key INTEGER,
            taxon_name TEXT,
            scientific_name TEXT,
            
            -- Confidence
            confidence TEXT,
            note TEXT,
            weight REAL DEFAULT 1.0,
            
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (observation_id) REFERENCES observations(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_id_obs ON identifications(observation_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_id_user ON identifications(user_id)");
    echo "✓ Created identifications table\n";
    
    // ========================================
    // Notifications Table
    // ========================================
    $db->exec("
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT,
            link TEXT,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, is_read)");
    echo "✓ Created notifications table\n";
    
    // ========================================
    // Corporate Sites Table (B2B)
    // ========================================
    $db->exec("
        CREATE TABLE IF NOT EXISTS sites (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            center_lat REAL,
            center_lng REAL,
            polygon TEXT, -- GeoJSON polygon
            owner_id TEXT,
            subscription_tier TEXT DEFAULT 'starter',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_sites_owner ON sites(owner_id)");
    echo "✓ Created sites table\n";
    
    // ========================================
    // Rate Limits Table
    // ========================================
    $db->exec("
        CREATE TABLE IF NOT EXISTS rate_limits (
            client_id TEXT PRIMARY KEY,
            requests TEXT, -- JSON array of timestamps
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    echo "✓ Created rate_limits table\n";
    
    // ========================================
    // Migration Log Table
    // ========================================
    $db->exec("
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    echo "✓ Created migrations table\n";
    
    // Record this schema version
    $stmt = $db->prepare("INSERT OR IGNORE INTO migrations (name) VALUES (?)");
    $stmt->execute(['001_initial_schema']);
    
    echo "\n✅ Database setup complete!\n";
    echo "Database size: " . round(filesize($dbPath) / 1024, 2) . " KB\n";
    
} catch (PDOException $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
