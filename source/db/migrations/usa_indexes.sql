-- ============================================================
-- United States Specific Indexes
-- Only run this on landomo_usa database
-- ============================================================

-- USA lot size
CREATE INDEX IF NOT EXISTS idx_properties_usa_lot_size
  ON properties(usa_lot_size_sqft)
  WHERE usa_lot_size_sqft IS NOT NULL;

-- USA MLS number (Multiple Listing Service ID)
CREATE INDEX IF NOT EXISTS idx_properties_usa_mls
  ON properties(usa_mls_number)
  WHERE usa_mls_number IS NOT NULL;

-- USA parcel number (tax assessor ID)
CREATE INDEX IF NOT EXISTS idx_properties_usa_parcel
  ON properties(usa_parcel_number)
  WHERE usa_parcel_number IS NOT NULL;

-- Composite index for lot size range queries
CREATE INDEX IF NOT EXISTS idx_properties_usa_lot_price
  ON properties(usa_lot_size_sqft, price)
  WHERE usa_lot_size_sqft IS NOT NULL AND price IS NOT NULL;
