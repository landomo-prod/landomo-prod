-- ============================================================
-- Italy Specific Indexes
-- Only run this on landomo_italy database
-- ============================================================

-- Italy cadastral category
CREATE INDEX IF NOT EXISTS idx_properties_italy_cadastral_category
  ON properties(italy_cadastral_category)
  WHERE italy_cadastral_category IS NOT NULL;

-- Italy cadastral income
CREATE INDEX IF NOT EXISTS idx_properties_italy_cadastral_income
  ON properties(italy_cadastral_income)
  WHERE italy_cadastral_income IS NOT NULL;
