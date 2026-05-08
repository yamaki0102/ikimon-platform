-- destructive-ok: narrow data repair only; rollback by restoring official_url to https://ikimon.life/guide/aikan-renri-report.php for certification_id aikan-renri-ikan-hq if needed.
UPDATE observation_fields
SET official_url = 'https://i-kan.co.jp/company/biodiversity/'
WHERE certification_id = 'aikan-renri-ikan-hq'
  AND source = 'nature_symbiosis_site'
  AND (
    official_url = ''
    OR official_url = 'https://ikimon.life/guide/aikan-renri-report.php'
    OR official_url IS NULL
  );
