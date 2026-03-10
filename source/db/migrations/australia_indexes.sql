-- ============================================================
-- Australia Specific Indexes
-- Only run this on landomo_australia database
-- ============================================================

-- Australia land size
CREATE INDEX IF NOT EXISTS idx_properties_australia_land_size
  ON properties(australia_land_size_sqm)
  WHERE australia_land_size_sqm IS NOT NULL;

-- Composite index for land size range queries
CREATE INDEX IF NOT EXISTS idx_properties_australia_land_price
  ON properties(australia_land_size_sqm, price)
  WHERE australia_land_size_sqm IS NOT NULL AND price IS NOT NULL;
