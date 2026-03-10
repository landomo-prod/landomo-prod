-- ============================================================
-- Germany Specific Indexes
-- Only run this on landomo_germany database
-- ============================================================

-- German ownership type (Eigentum, Erbpacht, etc.)
CREATE INDEX IF NOT EXISTS idx_properties_german_ownership
  ON properties(german_ownership)
  WHERE german_ownership IS NOT NULL;

-- German Hausgeld (monthly maintenance fee for apartments)
CREATE INDEX IF NOT EXISTS idx_properties_german_hausgeld
  ON properties(german_hausgeld)
  WHERE german_hausgeld IS NOT NULL;

-- German courtage (broker commission)
CREATE INDEX IF NOT EXISTS idx_properties_german_courtage
  ON properties(german_courtage)
  WHERE german_courtage IS NOT NULL;

-- German KfW energy efficiency standard
CREATE INDEX IF NOT EXISTS idx_properties_german_kfw_standard
  ON properties(german_kfw_standard)
  WHERE german_kfw_standard IS NOT NULL;

-- German Denkmalschutz (heritage protection status)
CREATE INDEX IF NOT EXISTS idx_properties_german_is_denkmalschutz
  ON properties(german_is_denkmalschutz)
  WHERE german_is_denkmalschutz IS NOT NULL;

-- Composite index for common queries (ownership + price range)
CREATE INDEX IF NOT EXISTS idx_properties_german_ownership_price
  ON properties(german_ownership, price)
  WHERE german_ownership IS NOT NULL AND price IS NOT NULL;

-- Composite index for energy-efficient property searches (KfW + price)
CREATE INDEX IF NOT EXISTS idx_properties_german_kfw_price
  ON properties(german_kfw_standard, price)
  WHERE german_kfw_standard IS NOT NULL AND price IS NOT NULL;
