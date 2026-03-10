-- ============================================================
-- France Specific Indexes
-- Only run this on landomo_france database
-- ============================================================

-- France DPE (Energy Performance Diagnostic) rating
CREATE INDEX IF NOT EXISTS idx_properties_france_dpe
  ON properties(france_dpe_rating)
  WHERE france_dpe_rating IS NOT NULL;

-- France GES (Greenhouse Gas) rating
CREATE INDEX IF NOT EXISTS idx_properties_france_ges
  ON properties(france_ges_rating)
  WHERE france_ges_rating IS NOT NULL;

-- France co-ownership building status
CREATE INDEX IF NOT EXISTS idx_properties_france_copropriete
  ON properties(france_copropriete)
  WHERE france_copropriete IS NOT NULL;
