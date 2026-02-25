#!/usr/bin/env python3
"""
Patch cron_extraction_engine.php:
1. Replace INSERT OR REPLACE with INSERT OR IGNORE + COALESCE UPDATE (safety guard)
2. Add active_period (new format) support alongside active_season (legacy)
"""

filepath = '/home/yamaki/projects/ikimon-platform/upload_package/scripts/cron_extraction_engine.php'

with open(filepath, 'r') as f:
    content = f.read()

# === PATCH 1: Species INSERT OR REPLACE -> INSERT OR IGNORE + UPDATE ===
old_species_insert = '''      // Insert into OMOIKANE SQLite Data Warehouse
      $stmtSpecies = $pdo->prepare("INSERT OR REPLACE INTO species (scientific_name, distillation_status, last_distilled_at, source_citations) VALUES (?, 'distilled', ?, ?)");
      $citationsJson = isset($item['source_citations']) ? json_encode($item['source_citations'], JSON_UNESCAPED_UNICODE) : null;
      $stmtSpecies->execute([$scientificName, date('Y-m-d H:i:s'), $citationsJson]);'''

new_species_insert = '''      // Insert into OMOIKANE SQLite Data Warehouse
      // SAFE: Use INSERT OR IGNORE to preserve existing ID, then UPDATE status
      $pdo->prepare("INSERT OR IGNORE INTO species (scientific_name, distillation_status, last_distilled_at) VALUES (?, 'pending', ?)")->execute([$scientificName, date('Y-m-d H:i:s')]);
      $citationsJson = isset($item['source_citations']) ? json_encode($item['source_citations'], JSON_UNESCAPED_UNICODE) : null;
      $pdo->prepare("UPDATE species SET distillation_status = 'distilled', last_distilled_at = ?, source_citations = COALESCE(?, source_citations) WHERE scientific_name = ?")->execute([date('Y-m-d H:i:s'), $citationsJson, $scientificName]);'''

if old_species_insert in content:
    content = content.replace(old_species_insert, new_species_insert)
    print("PATCH 1 (species INSERT): Applied")
else:
    print("PATCH 1 (species INSERT): Already applied or text not found")

# === PATCH 2: Ecological constraints INSERT OR REPLACE -> GUARD + COALESCE + active_period ===
old_eco = '''        $stmtEco = $pdo->prepare("INSERT OR REPLACE INTO ecological_constraints (species_id, habitat, altitude, season, notes) VALUES (?, ?, ?, ?, ?)");
        $eco = $spData['ecological_constraints'] ?? [];
        $stmtEco->execute([
          $speciesId,
          is_array($eco['habitat'] ?? '') ? implode(', ', $eco['habitat']) : ($eco['habitat'] ?? null),
          $eco['altitude_range'] ?? ($eco['altitude'] ?? null),
          is_array($eco['active_season'] ?? '') ? implode(', ', $eco['active_season']) : ($eco['active_season'] ?? ($eco['season'] ?? null)),
          $eco['notes'] ?? null
        ]);'''

new_eco = '''        // Parse ecological data with active_period (new) and active_season (legacy) support
        $eco = $spData['ecological_constraints'] ?? [];
        $habitatVal = is_array($eco['habitat'] ?? '') ? implode(', ', $eco['habitat']) : ($eco['habitat'] ?? null);
        $altitudeVal = $eco['altitude_range'] ?? ($eco['altitude'] ?? null);
        // Handle new active_period format {months, region} and legacy active_season
        $seasonVal = null;
        if (isset($eco['active_period'])) {
          $ap = $eco['active_period'];
          if (is_array($ap)) {
            $months = $ap['months'] ?? '';
            $region = $ap['region'] ?? '';
            $seasonVal = $region ? "{$months} ({$region})" : $months;
          } else {
            $seasonVal = (string)$ap;
          }
        } elseif (isset($eco['active_season'])) {
          $seasonVal = is_array($eco['active_season']) ? implode(', ', $eco['active_season']) : $eco['active_season'];
        } elseif (isset($eco['season'])) {
          $seasonVal = $eco['season'];
        }
        $notesVal = $eco['notes'] ?? null;

        // GUARD: Only write ecological data if we actually have something
        if (!empty($habitatVal) || !empty($altitudeVal) || !empty($seasonVal) || !empty($notesVal)) {
          $pdo->prepare("INSERT OR IGNORE INTO ecological_constraints (species_id) VALUES (?)")->execute([$speciesId]);
          $pdo->prepare("UPDATE ecological_constraints SET habitat = COALESCE(NULLIF(?, ''), habitat), altitude = COALESCE(NULLIF(?, ''), altitude), season = COALESCE(NULLIF(?, ''), season), notes = COALESCE(NULLIF(?, ''), notes) WHERE species_id = ?")->execute([$habitatVal, $altitudeVal, $seasonVal, $notesVal, $speciesId]);
        }'''

if old_eco in content:
    content = content.replace(old_eco, new_eco)
    print("PATCH 2 (eco constraints): Applied")
else:
    print("PATCH 2 (eco constraints): Already applied or text not found")

# === PATCH 3: Identification keys INSERT OR REPLACE -> GUARD + COALESCE ===
old_keys_head = '''        $stmtKeys = $pdo->prepare("INSERT OR REPLACE INTO identification_keys (species_id, morphological_traits, similar_species, key_differences) VALUES (?, ?, ?, ?)");'''
new_keys_head = '''        // Parse identification keys'''

if old_keys_head in content:
    content = content.replace(old_keys_head, new_keys_head)
    print("PATCH 3a (keys prepare): Applied")
else:
    print("PATCH 3a (keys prepare): Already applied or text not found")

old_keys_exec = '''        $stmtKeys->execute([$speciesId, $morphTraits, $simSpecies, $keyDiffs]);'''
new_keys_exec = '''        // GUARD: Only write ID keys if we actually have something
        if (!empty($morphTraits) || !empty($simSpecies) || !empty($keyDiffs)) {
          $pdo->prepare("INSERT OR IGNORE INTO identification_keys (species_id) VALUES (?)")->execute([$speciesId]);
          $pdo->prepare("UPDATE identification_keys SET morphological_traits = COALESCE(NULLIF(?, ''), morphological_traits), similar_species = COALESCE(NULLIF(?, ''), similar_species), key_differences = COALESCE(NULLIF(?, ''), key_differences) WHERE species_id = ?")->execute([$morphTraits, $simSpecies, $keyDiffs, $speciesId]);
        }'''

if old_keys_exec in content:
    content = content.replace(old_keys_exec, new_keys_exec)
    print("PATCH 3b (keys execute): Applied")
else:
    print("PATCH 3b (keys execute): Already applied or text not found")

with open(filepath, 'w') as f:
    f.write(content)

print("\nAll patches written. Verifying...")

# Verify
with open(filepath, 'r') as f:
    verify = f.read()

remaining = verify.count('INSERT OR REPLACE')
print(f"Remaining INSERT OR REPLACE: {remaining}")
has_guard = 'GUARD: Only write ecological' in verify
print(f"Has ecological guard: {has_guard}")
has_period = 'active_period' in verify
print(f"Has active_period handling: {has_period}")
