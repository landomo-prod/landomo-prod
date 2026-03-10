-- ============================================================
-- Hungary Specific Indexes
-- Only run this on landomo_hungary database
-- ============================================================

-- Hungarian room count (szobaszam)
CREATE INDEX IF NOT EXISTS idx_properties_hungarian_room_count
  ON properties(hungarian_room_count)
  WHERE hungarian_room_count IS NOT NULL;

-- Hungarian ownership type (tulajdon, berlet, etc.)
CREATE INDEX IF NOT EXISTS idx_properties_hungarian_ownership
  ON properties(hungarian_ownership)
  WHERE hungarian_ownership IS NOT NULL;

-- Composite index for common queries (room count + price range)
CREATE INDEX IF NOT EXISTS idx_properties_hungarian_room_count_price
  ON properties(hungarian_room_count, price)
  WHERE hungarian_room_count IS NOT NULL AND price IS NOT NULL;

-- Composite index for common queries (ownership + price range)
CREATE INDEX IF NOT EXISTS idx_properties_hungarian_ownership_price
  ON properties(hungarian_ownership, price)
  WHERE hungarian_ownership IS NOT NULL AND price IS NOT NULL;
