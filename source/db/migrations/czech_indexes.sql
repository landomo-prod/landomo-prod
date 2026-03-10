-- ============================================================
-- Czech Republic Specific Indexes
-- Only run this on landomo_czech database
-- ============================================================

-- Czech disposition (apartment layout type)
CREATE INDEX IF NOT EXISTS idx_properties_czech_disposition
  ON properties(czech_disposition)
  WHERE czech_disposition IS NOT NULL;

-- Czech ownership type
CREATE INDEX IF NOT EXISTS idx_properties_czech_ownership
  ON properties(czech_ownership)
  WHERE czech_ownership IS NOT NULL;

-- Composite index for common queries (disposition + price range)
CREATE INDEX IF NOT EXISTS idx_properties_czech_disposition_price
  ON properties(czech_disposition, price)
  WHERE czech_disposition IS NOT NULL AND price IS NOT NULL;
