-- ============================================================
-- Austria Specific Indexes
-- Only run this on landomo_austria database
-- ============================================================

-- Austrian ownership type (Eigentum, Miete, Genossenschaft, etc.)
CREATE INDEX IF NOT EXISTS idx_properties_austrian_ownership
  ON properties(austrian_ownership)
  WHERE austrian_ownership IS NOT NULL;

-- Austrian operating costs (Betriebskosten)
CREATE INDEX IF NOT EXISTS idx_properties_austrian_operating_costs
  ON properties(austrian_operating_costs)
  WHERE austrian_operating_costs IS NOT NULL;

-- Austrian heating costs (Heizkosten)
CREATE INDEX IF NOT EXISTS idx_properties_austrian_heating_costs
  ON properties(austrian_heating_costs)
  WHERE austrian_heating_costs IS NOT NULL;

-- Composite index for common queries (ownership + price range)
CREATE INDEX IF NOT EXISTS idx_properties_austrian_ownership_price
  ON properties(austrian_ownership, price)
  WHERE austrian_ownership IS NOT NULL AND price IS NOT NULL;

-- Composite index for total cost searches (operating costs + heating costs)
CREATE INDEX IF NOT EXISTS idx_properties_austrian_total_costs
  ON properties(austrian_operating_costs, austrian_heating_costs)
  WHERE austrian_operating_costs IS NOT NULL AND austrian_heating_costs IS NOT NULL;
