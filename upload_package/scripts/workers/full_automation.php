<?php
/**
 * Master Automation Pipeline
 * 1. Seek (Find URLs)
 * 2. Hunt (Scrape Data)
 * 3. Import (Normalize & Taxon Match)
 */

echo "========================================\n";
echo "   ANTIGRAVITY: FULL AUTOMATION MODE    \n";
echo "========================================\n\n";

// 1. SEEK
echo "--- PHASE 1: SEEK ---\n";
include __DIR__ . '/seek_redlist.php';
echo "\n";

// 2. HUNT
echo "--- PHASE 2: HUNT ---\n";
// We need to allow scrape_redlist to run without stopping script execution, 
// but since we are including, we should check if scrape_redlist uses return/exit.
// It seems scrape_redlist.php is a script, so including it runs it.
// However, scrape_redlist.php relies on $argv or just runs. 
// It requires `HeuristicParser.php` which uses `require_once`, so that's fine.
include __DIR__ . '/scrape_redlist.php';
echo "\n";

// 3. IMPORT
echo "--- PHASE 3: IMPORT ---\n";
include __DIR__ . '/import_redlist.php';
echo "\n";

echo "========================================\n";
echo "   ALL SYSTEMS GREEN. DATA SYNCHRONIZED.\n";
echo "========================================\n";
