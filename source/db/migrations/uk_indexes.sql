-- ============================================================
-- United Kingdom Specific Indexes
-- Only run this on landomo_uk database
-- ============================================================

-- UK tenure (freehold/leasehold)
CREATE INDEX IF NOT EXISTS idx_properties_uk_tenure
  ON properties(uk_tenure)
  WHERE uk_tenure IS NOT NULL;

-- UK Energy Performance Certificate rating
CREATE INDEX IF NOT EXISTS idx_properties_uk_epc
  ON properties(uk_epc_rating)
  WHERE uk_epc_rating IS NOT NULL;

-- UK Council tax band
CREATE INDEX IF NOT EXISTS idx_properties_uk_council_tax
  ON properties(uk_council_tax_band)
  WHERE uk_council_tax_band IS NOT NULL;

-- Composite index for leasehold properties with remaining years
CREATE INDEX IF NOT EXISTS idx_properties_uk_leasehold
  ON properties(uk_tenure, uk_leasehold_years_remaining)
  WHERE uk_tenure = 'leasehold' AND uk_leasehold_years_remaining IS NOT NULL;
