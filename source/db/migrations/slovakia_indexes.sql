-- ============================================================
-- Slovakia Specific Indexes
-- Only run this on landomo_slovakia database
-- ============================================================

-- Slovak disposition (apartment layout type)
CREATE INDEX IF NOT EXISTS idx_properties_slovak_disposition
  ON properties(slovak_disposition)
  WHERE slovak_disposition IS NOT NULL;

-- Slovak ownership type
CREATE INDEX IF NOT EXISTS idx_properties_slovak_ownership
  ON properties(slovak_ownership)
  WHERE slovak_ownership IS NOT NULL;

-- Composite index for common queries (disposition + price range)
CREATE INDEX IF NOT EXISTS idx_properties_slovak_disposition_price
  ON properties(slovak_disposition, price)
  WHERE slovak_disposition IS NOT NULL AND price IS NOT NULL;
