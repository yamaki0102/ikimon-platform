-- Preserve the existing observation_data_rights contract while recording
-- the explicit publication-consent provenance used by the shared feed gate.
ALTER TABLE observation_data_rights
  ADD COLUMN consent_source TEXT NOT NULL DEFAULT 'default';

ALTER TABLE observation_data_rights
  ADD COLUMN rights_policy_version TEXT NOT NULL DEFAULT 'site_intelligence_p0_v2';
