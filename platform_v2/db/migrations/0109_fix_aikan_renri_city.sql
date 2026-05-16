-- destructive-ok: narrow data repair only; rollback by setting city back to 浜松市中央区 for certification_id aikan-renri-ikan-hq if needed.
UPDATE observation_fields
SET city = '浜松市浜名区',
    updated_at = NOW()
WHERE certification_id = 'aikan-renri-ikan-hq'
  AND source = 'nature_symbiosis_site'
  AND city IS DISTINCT FROM '浜松市浜名区';
